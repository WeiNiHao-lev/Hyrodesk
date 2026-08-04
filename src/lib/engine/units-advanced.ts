import { Component, Params, Stream, UnitModel } from "./types";
import {
  alkalinityAsCaCO3, clamp, cloneStream, removeToSideStream, splitByRejection,
} from "./stream";
import { aux, b, costCurve, freeAmmoniaFraction, n, pumpKW, s } from "./unitkit";

/**
 * Units for high-strength wastewater: landfill leachate, coking liquor, biogas
 * slurry. Everything here comes from either the CCEPC leachate reference list
 * (17 plants delivered 2012-2022 by Wuhan City Environment Protection) or from
 * the Bantargebang IPAS 2 engineering analysis, and the defaults are set to the
 * figures used there rather than to textbook generics. Where a default came
 * from that analysis it is marked in the parameter help.
 */

const MW = {
  NH3: 17.031, NH4: 18.039, N: 14.007,
  NaOH: 39.997, CaOH2: 74.093, H2SO4: 98.079, HCl: 36.461,
  AmSulphate: 132.14, MgOH2: 58.32, Mg: 24.305, CaCO3: 100.09, Ca: 40.078,
  O3: 47.997,
};

/* ============================================================ pH adjustment */

/**
 * The caustic demand of a leachate is not set by its alkalinity. It is set by
 * its ammonium: every mole of NH4+ that has to become NH3 consumes a mole of
 * hydroxide, and at 5000 mg/L of ammoniacal nitrogen that dwarfs the carbonate
 * system by an order of magnitude. Designers who size the dose from alkalinity
 * alone under-order the caustic by ten times.
 */
const phAdjust: UnitModel = {
  type: "phadjust", label: "pH Adjustment / Neutralisation", short: "pH",
  category: "pretreatment", inlets: 1, outlets: ["out"],
  description:
    "Dosing tank that moves the water to a target pH. Raising pH ahead of ammonia stripping and dropping it again before a membrane are the same unit used twice. The reagent demand is computed from the carbonate system and from the ammonium that has to be deprotonated, not assumed.",
  ccepcMaturity: 5,
  params: [
    { key: "targetPH", label: "Target pH", type: "number", min: 2, max: 13, step: 0.1, group: "Performance",
      help: "11.0 ahead of ammonia stripping; 6.5-7.0 ahead of any membrane." },
    { key: "reagentUp", label: "Reagent to raise pH", type: "select", group: "Chemicals",
      options: [
        { value: "naoh", label: "Caustic soda, NaOH" },
        { value: "lime", label: "Hydrated lime, Ca(OH)2" },
      ],
      help: "Lime is far cheaper per equivalent but adds calcium and produces sludge." },
    { key: "reagentDown", label: "Reagent to lower pH", type: "select", group: "Chemicals",
      options: [
        { value: "h2so4", label: "Sulphuric acid, H2SO4" },
        { value: "hcl", label: "Hydrochloric acid, HCl" },
      ] },
    { key: "excessPct", label: "Dosing excess", type: "number", unit: "%", min: 0, max: 60, step: 5, group: "Chemicals",
      help: "Allowance above the stoichiometric demand for control lag and titration-curve error." },
    { key: "codCoPrecipPct", label: "COD co-precipitated", type: "number", unit: "%", min: 0, max: 25, step: 0.5, group: "Performance",
      help: "Raising the pH past 10.5 throws a magnesium hydroxide floc that carries some of the humic colour down with it. Around 5 % on an old leachate; zero if the pH is not being raised that far." },
    { key: "hrtMin", label: "Reaction time", type: "number", unit: "min", min: 2, max: 60, step: 1, group: "Sizing" },
    { key: "mixWkW", label: "Mixing intensity", type: "number", unit: "W/m3", min: 10, max: 120, step: 5, group: "Hydraulics" },
  ],
  defaults: {
    targetPH: 11, reagentUp: "naoh", reagentDown: "h2so4", excessPct: 15,
    codCoPrecipPct: 5, hrtMin: 20, mixWkW: 40,
  },
  solve: (inlet, p) => {
    const target = n(p, "targetPH", 11);
    const out = cloneStream(inlet);
    out.pH = clamp(target, 1, 14);
    const notes: string[] = [];
    const chem: Record<string, number> = {};
    let drySolids = 0;

    // Equivalents per litre that have to be added or removed, in meq/L.
    let meq = 0;
    if (target > inlet.pH) {
      // Carbonate system: above about pH 10.3 the bicarbonate present is
      // converted to carbonate, one equivalent each.
      const alk = alkalinityAsCaCO3(inlet); // mg/L as CaCO3
      const carbonateEq = target > 10.3 ? alk / 50 : (alk / 50) * ((target - inlet.pH) / Math.max(10.3 - inlet.pH, 0.1));
      // Ammonium: the dominant term whenever the water is a leachate.
      const fBefore = freeAmmoniaFraction(inlet.pH, inlet.T);
      const fAfter = freeAmmoniaFraction(target, inlet.T);
      const nh4meq = (inlet.c.NH4 / MW.NH4) * Math.max(fAfter - fBefore, 0);
      meq = clamp(carbonateEq, 0, 1e5) + nh4meq;
      if (fBefore > 0.15 && inlet.c.NH4 > 100) {
        notes.push(`At the inlet pH of ${inlet.pH.toFixed(1)} already ${(fBefore * 100).toFixed(0)} % of the ammonia is the free gas, so an open equalisation pond upstream is losing ammonia to the air and creating an odour. It also means less alkali is needed here than a calculation starting from fully ionised ammonium would suggest.`);
      }
      if (nh4meq > carbonateEq * 2 && nh4meq > 1) {
        notes.push(`Ammonium accounts for ${(100 * nh4meq / Math.max(meq, 1e-9)).toFixed(0)} % of the alkali demand. Sizing the dose from alkalinity alone would under-order the reagent several times over.`);
      }
      const excess = 1 + n(p, "excessPct", 15) / 100;
      const kgPerH = (meq * excess * inlet.flow) / 1000; // keq/h
      if (s(p, "reagentUp", "naoh") === "lime") {
        chem["Hydrated lime Ca(OH)2"] = kgPerH * (MW.CaOH2 / 2);
        // Above pH 10.5 magnesium leaves as hydroxide, and the added calcium
        // meets any carbonate. Both report as suspended solids, which is why
        // the TSS rises across this step rather than falling.
        if (target >= 10.5) {
          const mgRem = 0.9;
          const mgKgH = (inlet.flow * inlet.c.Mg * mgRem) / 1000;
          out.c.Mg = inlet.c.Mg * (1 - mgRem);
          drySolids += mgKgH * (MW.MgOH2 / MW.Mg);
        }
        notes.push("Lime adds calcium to the water. Where the next step is a membrane, check the concentrate saturation before choosing it over caustic.");
      } else {
        chem["Caustic soda NaOH"] = kgPerH * MW.NaOH;
        out.c.Na = inlet.c.Na + meq * excess * 22.99;
        if (target >= 10.5) {
          const mgRem = 0.85;
          const mgKgH = (inlet.flow * inlet.c.Mg * mgRem) / 1000;
          out.c.Mg = inlet.c.Mg * (1 - mgRem);
          drySolids += mgKgH * (MW.MgOH2 / MW.Mg);
        }
      }
    } else if (target < inlet.pH) {
      // Coming down, the carbonate and any free hydroxide have to be neutralised.
      const alk = alkalinityAsCaCO3(inlet);
      const frac = clamp((inlet.pH - target) / Math.max(inlet.pH - 4.5, 0.1), 0, 1);
      const hydroxideEq = inlet.pH > 10 ? Math.pow(10, inlet.pH - 14 + 3) : 0; // meq/L from free OH-
      meq = (alk / 50) * frac + hydroxideEq;
      const excess = 1 + n(p, "excessPct", 15) / 100;
      const kgPerH = (meq * excess * inlet.flow) / 1000;
      if (s(p, "reagentDown", "h2so4") === "hcl") {
        chem["Hydrochloric acid HCl"] = kgPerH * MW.HCl;
        out.c.Cl = inlet.c.Cl + meq * excess * 35.45;
      } else {
        chem["Sulphuric acid H2SO4"] = kgPerH * (MW.H2SO4 / 2);
        out.c.SO4 = inlet.c.SO4 + meq * excess * 48.03;
      }
      if (inlet.pH > 10 && target < 8) {
        notes.push("Neutralising before a membrane is not optional. At high pH the ammonia is a dissolved gas and passes reverse osmosis almost freely; at neutral pH it is the ammonium ion and is rejected above 95 %.");
      }
    } else {
      notes.push("Target pH equals the inlet pH: this unit is doing nothing. Remove it or set a target.");
    }

    // Inorganic carbon changes form with the pH. Above 10.3 the bicarbonate is
    // carbonate; below 8.3 it is bicarbonate again. Carbon is conserved either
    // way, but which species is present decides what the next unit sees.
    const cTotal = inlet.c.HCO3 / 61.02 + inlet.c.CO3 / 30.005;
    if (target > 10.3) {
      out.c.CO3 = cTotal * 30.005;
      out.c.HCO3 = 0;
    } else if (target < 8.3) {
      out.c.HCO3 = cTotal * 61.02;
      out.c.CO3 = 0;
    }

    // Precipitated solids stay in the water as suspended solids.
    if (drySolids > 0 && out.flow > 0) {
      out.c.TSS = inlet.c.TSS + (drySolids * 1000) / out.flow;
      const co = n(p, "codCoPrecipPct", 5) / 100;
      if (co > 0) {
        out.c.COD = inlet.c.COD * (1 - co);
        out.c.TOC = inlet.c.TOC * (1 - co);
        out.c.BOD = inlet.c.BOD * (1 - co * 0.6);
        notes.push(`The hydroxide floc carries about ${(co * 100).toFixed(0)} % of the COD down with it, which is why the suspended solids rise across this step while the dissolved organics fall. Those solids have to be removed somewhere downstream.`);
      }
    }

    const vol = (inlet.flow * n(p, "hrtMin", 20)) / 60;
    return {
      outlets: { out },
      aux: aux({
        powerKW: (vol * n(p, "mixWkW", 40)) / 1000 + 1.5,
        chemicals: chem,
        drySolidsKgH: drySolids,
        hrtH: n(p, "hrtMin", 20) / 60,
        sizing: [
          { label: "Tank volume", value: `${vol.toFixed(1)} m3` },
          { label: "Reagent demand", value: `${meq.toFixed(1)} meq/L` },
          ...Object.entries(chem).map(([k, v]) => ({
            label: k, value: `${v.toFixed(1)} kg/h (${(v * 24 / 1000).toFixed(2)} t/d)`,
          })),
          { label: "Precipitated solids", value: `${drySolids.toFixed(1)} kg/h` },
        ],
        capexUSD: costCurve(Math.max(vol, 1), 2600, 0.66),
        notes,
      }),
    };
  },
};

/* ======================================================== ammonia stripping */

/**
 * Only the free NH3 fraction can be stripped, and that fraction is set by pH
 * and temperature. Removal is therefore the product of two terms: how much of
 * the ammonia is in the strippable form, and how much of that the tower
 * actually contacts. The second term is tuned so that the CCEPC design
 * air-to-water ratio of 3000 m3/m3 reproduces the removal used in the
 * Bantargebang analysis.
 */
const AIR_RATIO_K = 1350;

const ammoniaStripper: UnitModel = {
  type: "nh3strip", label: "Ammonia Stripping Tower", short: "STRIP",
  category: "pretreatment", inlets: 1, outlets: ["out"],
  description:
    "Packed or tray tower that blows air counter-current to the water, carrying dissolved ammonia out as a gas. The tower is tall and narrow, so it costs very little land. The off-gas must be captured in an acid scrubber, otherwise the plant has moved a water problem into the air.",
  ccepcMaturity: 4,
  params: [
    { key: "airRatio", label: "Air-to-water ratio", type: "number", unit: "m3/m3", min: 500, max: 6000, step: 100, group: "Performance",
      help: "3000 m3/m3 at pH 11 is the CCEPC design basis used for Bantargebang. This is the single largest energy term in the unit." },
    { key: "liquidLoading", label: "Liquid loading", type: "number", unit: "m3/m2.h", min: 2, max: 60, step: 1, group: "Sizing",
      help: "One of the two limits on tower diameter. Above about 40 the packing floods on the liquid side." },
    { key: "maxGasVel", label: "Maximum gas velocity", type: "number", unit: "m/s", min: 0.5, max: 4, step: 0.1, group: "Sizing",
      help: "The other limit, and at a high air-to-water ratio it is always the governing one. Packed towers flood above roughly 2-3 m/s superficial velocity." },
    { key: "packingHeightM", label: "Packing height", type: "number", unit: "m", min: 3, max: 20, step: 0.5, group: "Sizing" },
    { key: "packingDPa", label: "Packing pressure drop", type: "number", unit: "Pa", min: 300, max: 4000, step: 100, group: "Hydraulics" },
    { key: "blowerEff", label: "Blower efficiency", type: "number", unit: "-", min: 0.4, max: 0.85, step: 0.05, group: "Hydraulics" },
    { key: "acidScrubber", label: "Acid scrubber on off-gas", type: "boolean", group: "Chemicals",
      help: "Captures the stripped ammonia as ammonium sulphate fertiliser. Without it the ammonia is simply released." },
    { key: "scrubberEff", label: "Scrubber capture", type: "number", unit: "%", min: 80, max: 99.5, step: 0.5, group: "Chemicals" },
    { key: "codStripPct", label: "COD removed", type: "number", unit: "%", min: 0, max: 20, step: 0.5, group: "Performance",
      help: "Volatile organics leave with the air. Small, but not zero." },
  ],
  defaults: {
    airRatio: 3000, liquidLoading: 25, maxGasVel: 2.0, packingHeightM: 8, packingDPa: 1500,
    blowerEff: 0.7, acidScrubber: true, scrubberEff: 97, codStripPct: 5,
  },
  solve: (inlet, p) => {
    const out = cloneStream(inlet);
    const f = freeAmmoniaFraction(inlet.pH, inlet.T);
    const contact = 1 - Math.exp(-n(p, "airRatio", 3000) / AIR_RATIO_K);
    const removal = clamp(f * contact, 0, 0.995);

    // Ammonia leaves; organic nitrogen does not. Total nitrogen therefore falls
    // by the ammonia mass only, which is why a leachate with a large organic-N
    // fraction cannot be stripped to a low TN however hard the tower is driven.
    const nh4Before = inlet.c.NH4;
    out.c.NH4 = nh4Before * (1 - removal);
    const nRemovedMgL = (nh4Before - out.c.NH4) * (MW.N / MW.NH4);
    out.c.TN = Math.max(inlet.c.TN - nRemovedMgL, 0);
    const codRem = n(p, "codStripPct", 5) / 100;
    out.c.COD = inlet.c.COD * (1 - codRem);
    out.c.TOC = inlet.c.TOC * (1 - codRem);
    out.c.BOD = inlet.c.BOD * (1 - codRem * 0.6);

    const nKgH = (inlet.flow * nRemovedMgL) / 1000;
    const airM3H = inlet.flow * n(p, "airRatio", 3000);
    // Two independent limits set the diameter, and at 3000 m3/m3 the air is
    // always the governing one: a tower sized on liquid loading alone would be
    // a fifth of the diameter it needs and would flood immediately.
    const areaByLiquid = inlet.flow / Math.max(n(p, "liquidLoading", 25), 1);
    const areaByGas = airM3H / 3600 / Math.max(n(p, "maxGasVel", 2.0), 0.1);
    const area = Math.max(areaByLiquid, areaByGas);
    const governedBy = areaByGas > areaByLiquid ? "gas velocity" : "liquid loading";
    const diameter = Math.sqrt((4 * area) / Math.PI);
    const gasVel = airM3H / 3600 / Math.max(area, 0.01);
    const actualLiquidLoading = inlet.flow / Math.max(area, 0.01);
    const blowerKW =
      (airM3H / 3600) * n(p, "packingDPa", 1500) / Math.max(n(p, "blowerEff", 0.7), 0.1) / 1000;
    const pumpsKW = pumpKW(inlet.flow, n(p, "packingHeightM", 8) + 6, 0.7);

    const chem: Record<string, number> = {};
    let amSulphate = 0;
    if (b(p, "acidScrubber", true)) {
      const captured = nKgH * (n(p, "scrubberEff", 97) / 100);
      const kmolN = captured / MW.N;
      chem["Sulphuric acid H2SO4"] = (kmolN / 2) * MW.H2SO4;
      amSulphate = (kmolN / 2) * MW.AmSulphate;
    }

    const notes: string[] = [];
    if (inlet.pH < 10.5) {
      notes.push(`Inlet pH ${inlet.pH.toFixed(1)} leaves only ${(f * 100).toFixed(0)} % of the ammonia in the free form. Stripping below pH 10.5 wastes the blower: raise the pH first.`);
    }
    if (inlet.T < 20) {
      notes.push(`At ${inlet.T.toFixed(0)} degC the dissociation constant works against you. Warm climates strip ammonia far more cheaply than temperate ones, and a tower designed on European data will be undersized here in reverse.`);
    }
    if (governedBy === "gas velocity") {
      notes.push(`The diameter is set by the air, not the water: ${areaByGas.toFixed(1)} m2 is needed to keep the gas below ${n(p, "maxGasVel", 2.0)} m/s, against ${areaByLiquid.toFixed(1)} m2 for the liquid. The actual liquid loading is only ${actualLiquidLoading.toFixed(1)} m3/m2.h. This is why a stripping tower designed from the water flow alone comes out far too small.`);
    }
    if (!b(p, "acidScrubber", true)) {
      notes.push(`${nKgH.toFixed(1)} kg/h of ammonia would be released to atmosphere. This is an odour and air-quality liability, and in most jurisdictions it is not permittable.`);
    }
    if (amSulphate > 0) {
      notes.push(`${(amSulphate * 24 / 1000).toFixed(1)} t/d of ammonium sulphate is produced. That is a fertiliser with a real market, but it needs offtake, storage and logistics — and the matching sulphuric acid supply chain — before it can be counted as a credit.`);
    }
    const orgN = Math.max(inlet.c.TN - inlet.c.NH4 * (MW.N / MW.NH4), 0);
    if (orgN > 50) {
      notes.push(`About ${orgN.toFixed(0)} mg/L of the total nitrogen is organic and cannot be stripped at any air ratio. It sets the floor on what this unit can achieve.`);
    }

    return {
      outlets: { out },
      aux: aux({
        powerKW: blowerKW + pumpsKW,
        chemicals: chem,
        sizing: [
          { label: "Free ammonia fraction", value: `${(f * 100).toFixed(1)} % at pH ${inlet.pH.toFixed(1)}, ${inlet.T.toFixed(0)} degC` },
          { label: "Ammonia removal", value: `${(removal * 100).toFixed(1)} %` },
          { label: "Nitrogen stripped", value: `${nKgH.toFixed(1)} kgN/h (${(nKgH * 24 / 1000).toFixed(2)} t/d)` },
          { label: "Air flow", value: `${airM3H.toFixed(0)} m3/h` },
          { label: "Tower diameter x packing", value: `${diameter.toFixed(1)} m x ${n(p, "packingHeightM", 8)} m` },
          { label: "Cross-section governed by", value: `${governedBy} (${area.toFixed(1)} m2)` },
          { label: "Superficial gas velocity", value: `${gasVel.toFixed(2)} m/s` },
          { label: "Actual liquid loading", value: `${actualLiquidLoading.toFixed(1)} m3/m2.h` },
          { label: "Footprint", value: `${(Math.PI * diameter * diameter / 4).toFixed(0)} m2 per tower` },
          { label: "Blower power", value: `${blowerKW.toFixed(1)} kW` },
          ...(amSulphate > 0
            ? [{ label: "Ammonium sulphate produced", value: `${amSulphate.toFixed(1)} kg/h (${(amSulphate * 24 / 1000).toFixed(2)} t/d)` }]
            : []),
        ],
        capexUSD: costCurve(Math.max(inlet.flow, 1), 5200, 0.7) + costCurve(airM3H / 1000, 900, 0.75),
        notes,
      }),
    };
  },
};

/* =================================================== membrane bioreactor */

const mbr: UnitModel = {
  type: "mbr", label: "Membrane Bioreactor (MBR)", short: "MBR",
  category: "biological", inlets: 1, outlets: ["out", "was"],
  description:
    "Activated sludge whose clarifier has been replaced by an immersed membrane. Because solids leave only with the waste sludge, the reactor can hold three times the biomass of a conventional plant in the same tank, and the effluent carries no suspended solids at all. CCEPC uses MBR on leachate at Zhongshan, Jiyuan and Wuhan Shenneng.",
  ccepcMaturity: 5,
  params: [
    { key: "hrtH", label: "Total HRT", type: "number", unit: "h", min: 4, max: 96, step: 1, group: "Sizing" },
    { key: "mlss", label: "MLSS", type: "number", unit: "mg/L", min: 5000, max: 15000, step: 250, group: "Sizing",
      help: "8000-12000 is the working range. Below 6000 the membrane is not earning its cost; above 14000 the sludge will not transfer oxygen." },
    { key: "srtD", label: "Sludge age (SRT)", type: "number", unit: "d", min: 10, max: 60, step: 1, group: "Sizing" },
    { key: "flux", label: "Net membrane flux", type: "number", unit: "LMH", min: 5, max: 35, step: 1, group: "Sizing",
      help: "15-25 for municipal, 8-15 for leachate. Anyone quoting clean-water UF flux here has not run an MBR." },
    { key: "bodRemoval", label: "BOD removal", type: "number", unit: "%", min: 80, max: 99.5, step: 0.5, group: "Performance" },
    { key: "codRemoval", label: "COD removal", type: "number", unit: "%", min: 5, max: 98, step: 0.5, group: "Performance",
      help: "Old leachate is largely refractory: 10-20 % is realistic there, against 85-95 % on municipal sewage." },
    { key: "tnRemoval", label: "TN removal", type: "number", unit: "%", min: 0, max: 95, step: 1, group: "Performance" },
    { key: "nh4Removal", label: "Ammonia removal", type: "number", unit: "%", min: 0, max: 99.5, step: 0.5, group: "Performance" },
    { key: "tpRemoval", label: "TP removal", type: "number", unit: "%", min: 0, max: 95, step: 1, group: "Performance" },
    { key: "scourAir", label: "Scouring air", type: "number", unit: "Nm3/m2.h", min: 0.1, max: 1.2, step: 0.05, group: "Hydraulics",
      help: "Air blown along the membrane to keep the cake off. This, not the process aeration, is what makes an MBR expensive to run." },
    { key: "aeUp", label: "Aeration efficiency", type: "number", unit: "kgO2/kWh", min: 0.6, max: 3, step: 0.1, group: "Hydraulics",
      help: "1.2 kgO2/kWh at high MLSS and high salinity, against 2.5-3 in clean municipal sludge." },
    { key: "wasPct", label: "Waste sludge draw", type: "number", unit: "% of feed", min: 0.1, max: 6, step: 0.1, group: "Performance" },
    { key: "yieldCoef", label: "Sludge yield", type: "number", unit: "kgVSS/kgBOD", min: 0.1, max: 0.7, step: 0.05, group: "Performance" },
    { key: "carbonDose", label: "External carbon", type: "number", unit: "mg/L", min: 0, max: 3000, step: 10, group: "Chemicals" },
    { key: "cipPerYear", label: "Recovery cleans", type: "number", unit: "1/y", min: 1, max: 12, step: 1, group: "Chemicals" },
  ],
  defaults: {
    hrtH: 24, mlss: 10000, srtD: 30, flux: 12, bodRemoval: 95, codRemoval: 15,
    tnRemoval: 25, nh4Removal: 90, tpRemoval: 60, scourAir: 0.35, aeUp: 1.2,
    wasPct: 1.0, yieldCoef: 0.3, carbonDose: 0, cipPerYear: 4,
  },
  solve: (inlet, p) => {
    const { product, side } = removeToSideStream(inlet, n(p, "wasPct", 1.0) / 100, {
      BOD: n(p, "bodRemoval", 95) / 100,
      COD: n(p, "codRemoval", 15) / 100,
      TOC: n(p, "codRemoval", 15) / 100,
      TN: n(p, "tnRemoval", 25) / 100,
      TP: n(p, "tpRemoval", 60) / 100,
      NH4: n(p, "nh4Removal", 90) / 100,
      // The membrane is an absolute barrier to solids, which is the whole point.
      TSS: 0.999, Oil: 0.98, Fe: 0.9, Mn: 0.7,
    });
    product.extras.coliform = 0;
    product.extras.turbidityNTU = 0.1;
    product.extras.sdi15 = 2.5;

    const bodLoadKgH = (inlet.flow * inlet.c.BOD * (n(p, "bodRemoval", 95) / 100)) / 1000;
    const nitrifiedMgL = inlet.c.NH4 * (MW.N / MW.NH4) * (n(p, "nh4Removal", 90) / 100);
    const nitrKgH = (inlet.flow * nitrifiedMgL) / 1000;
    const o2KgH = bodLoadKgH * 1.2 + nitrKgH * 4.57;

    // Nitrification consumes 7.14 mg of alkalinity as CaCO3 for every mg of
    // ammoniacal nitrogen oxidised. Denitrification gives about half of it
    // back. On a leachate carrying thousands of mg/L of ammonia this is not a
    // detail: it is usually what decides whether the reactor holds its pH.
    const alkNeeded = nitrifiedMgL * 7.14
      - inlet.c.TN * (n(p, "tnRemoval", 25) / 100) * 3.57;
    const alkAvail = alkalinityAsCaCO3(inlet);
    const alkLeft = alkAvail - alkNeeded;
    product.c.HCO3 = Math.max(alkLeft, 0) / 50 * 61.02;
    product.c.CO3 = 0;
    const processKW = o2KgH / Math.max(n(p, "aeUp", 1.2), 0.1);

    const area = (product.flow * 1000) / Math.max(n(p, "flux", 12), 1);
    // Scouring air is proportional to membrane area, and it runs continuously.
    const scourM3H = area * n(p, "scourAir", 0.35);
    const scourKW = (scourM3H / 3600) * 6000 / 0.65 / 1000;
    const permeateKW = pumpKW(product.flow, 6, 0.6);

    const vol = inlet.flow * n(p, "hrtH", 24);
    const wasKgH = bodLoadKgH * n(p, "yieldCoef", 0.3);
    const fm = (bodLoadKgH * 24) / Math.max((vol * n(p, "mlss", 10000)) / 1000, 0.001);

    const notes: string[] = [];
    if (alkNeeded > 0) {
      if (alkLeft < 100) {
        notes.push(`Nitrification needs ${alkNeeded.toFixed(0)} mg/L of alkalinity as CaCO3 and only ${alkAvail.toFixed(0)} is present. The pH will crash, nitrification will stall, and the plant will fail on ammonia while looking like a biology problem. Dose alkalinity or accept a lower ammonia removal.`);
      } else if (alkNeeded > alkAvail * 0.6) {
        notes.push(`Nitrification consumes ${alkNeeded.toFixed(0)} of the ${alkAvail.toFixed(0)} mg/L alkalinity available, leaving ${alkLeft.toFixed(0)}. That is enough, but there is little margin and the buffer downstream is now weak.`);
      }
    }
    const bodTn = inlet.c.BOD / Math.max(inlet.c.TN, 0.01);
    if (bodTn < 3 && n(p, "tnRemoval", 25) > 40) {
      notes.push(`BOD:TN is ${bodTn.toFixed(2)}, far below the 3-4 that denitrification needs. The nitrogen removal set here is not achievable without external carbon, and on a high-TN leachate that carbon bill is usually the reason the biological route is abandoned in favour of stripping.`);
    }
    if (n(p, "codRemoval", 15) > 50 && inlet.c.BOD / Math.max(inlet.c.COD, 1) < 0.15) {
      notes.push(`BOD:COD is ${(inlet.c.BOD / Math.max(inlet.c.COD, 1)).toFixed(2)}, so most of the COD is refractory and no biology will touch it. A COD removal above about 20 % is not credible on this water.`);
    }
    if (n(p, "mlss", 10000) > 12000) notes.push("Above 12000 mg/L MLSS the oxygen transfer efficiency collapses and the membrane fouls quickly.");
    if (fm > 0.15) notes.push(`F/M ratio ${fm.toFixed(3)} kgBOD/kgMLSS.d is high for an MBR; increase the volume or the MLSS.`);

    const chem: Record<string, number> = {};
    if (n(p, "carbonDose", 0) > 0) chem["External carbon source"] = (n(p, "carbonDose", 0) * inlet.flow) / 1000;
    chem["Sodium hypochlorite (CIP)"] = (area * 0.5 * n(p, "cipPerYear", 4)) / 8760;
    chem["Citric acid (CIP)"] = (area * 0.3 * n(p, "cipPerYear", 4)) / 8760;

    return {
      outlets: { out: product, was: side },
      aux: aux({
        powerKW: processKW + scourKW + permeateKW + 0.02 * inlet.flow,
        chemicals: chem,
        drySolidsKgH: wasKgH,
        hrtH: n(p, "hrtH", 24),
        sizing: [
          { label: "Reactor volume", value: `${vol.toFixed(0)} m3` },
          { label: "HRT / SRT", value: `${n(p, "hrtH", 24)} h / ${n(p, "srtD", 30)} d` },
          { label: "Membrane area", value: `${area.toFixed(0)} m2 at ${n(p, "flux", 12)} LMH net` },
          { label: "Oxygen demand", value: `${o2KgH.toFixed(1)} kgO2/h` },
          { label: "Process aeration", value: `${processKW.toFixed(1)} kW` },
          { label: "Membrane scouring", value: `${scourKW.toFixed(1)} kW (${scourM3H.toFixed(0)} Nm3/h)` },
          { label: "Scouring share of power", value: `${(100 * scourKW / Math.max(processKW + scourKW + permeateKW, 0.01)).toFixed(0)} %` },
          { label: "F/M ratio", value: `${fm.toFixed(3)} kgBOD/kgMLSS.d` },
          { label: "Waste sludge", value: `${wasKgH.toFixed(1)} kg/h dry solids` },
        ],
        capexUSD: costCurve(vol, 900, 0.72) + costCurve(area, 190, 0.85),
        notes,
      }),
    };
  },
};

/* ============================================================ anaerobic */

const anaerobic: UnitModel = {
  type: "anaerobic", label: "Anaerobic Reactor (UASB / EGSB)", short: "UASB",
  category: "biological", inlets: 1, outlets: ["out", "was"],
  description:
    "Removes organic load without aeration and returns methane instead of consuming power. It appears in thirteen of the seventeen leachate plants CCEPC has delivered, always as the first biological step, because taking several thousand mg/L of COD out anaerobically is far cheaper than blowing air at it.",
  ccepcMaturity: 5,
  params: [
    { key: "hrtH", label: "HRT", type: "number", unit: "h", min: 4, max: 240, step: 2, group: "Sizing" },
    { key: "olr", label: "Organic loading rate", type: "number", unit: "kgCOD/m3.d", min: 1, max: 25, step: 0.5, group: "Sizing",
      help: "UASB 4-12, EGSB 10-25. The reactor volume is normally set by this, not by HRT." },
    { key: "upflowVel", label: "Upflow velocity", type: "number", unit: "m/h", min: 0.3, max: 10, step: 0.1, group: "Hydraulics" },
    { key: "codRemoval", label: "COD removal", type: "number", unit: "%", min: 20, max: 92, step: 1, group: "Performance" },
    { key: "bodRemoval", label: "BOD removal", type: "number", unit: "%", min: 30, max: 96, step: 1, group: "Performance" },
    { key: "ch4Yield", label: "Methane yield", type: "number", unit: "Nm3CH4/kgCOD", min: 0.15, max: 0.4, step: 0.01, group: "Performance",
      help: "0.35 is the theoretical maximum at standard conditions; 0.28-0.32 is what is actually collected." },
    { key: "ch4Fraction", label: "Methane in biogas", type: "number", unit: "%", min: 45, max: 85, step: 1, group: "Performance" },
    { key: "wasPct", label: "Waste sludge draw", type: "number", unit: "% of feed", min: 0.05, max: 3, step: 0.05, group: "Performance" },
    { key: "yieldCoef", label: "Sludge yield", type: "number", unit: "kgVSS/kgCOD", min: 0.02, max: 0.2, step: 0.01, group: "Performance",
      help: "An order of magnitude below aerobic treatment. Little sludge is the second reason anaerobic steps are used." },
    { key: "heatingKWhM3", label: "Heating demand", type: "number", unit: "kWh/m3", min: 0, max: 30, step: 0.5, group: "Hydraulics",
      help: "Zero in the tropics, substantial in a temperate climate. Mesophilic digestion needs 35 degC." },
  ],
  defaults: {
    hrtH: 24, olr: 8, upflowVel: 1.0, codRemoval: 75, bodRemoval: 88,
    ch4Yield: 0.30, ch4Fraction: 65, wasPct: 0.3, yieldCoef: 0.08, heatingKWhM3: 0,
  },
  solve: (inlet, p) => {
    const codRem = n(p, "codRemoval", 75) / 100;
    const { product, side } = removeToSideStream(inlet, n(p, "wasPct", 0.3) / 100, {
      COD: codRem,
      BOD: n(p, "bodRemoval", 88) / 100,
      TOC: codRem,
      TSS: 0.7, Oil: 0.85, SO4: 0.6,
      // Organic nitrogen is mineralised rather than removed: ammonia rises.
      TN: 0.05, TP: 0.15,
    });
    // Ammonification releases part of the organic nitrogen as ammonium, which is
    // why an anaerobic step ahead of stripping helps and ahead of a membrane hurts.
    const orgN = Math.max(inlet.c.TN - inlet.c.NH4 * (MW.N / MW.NH4), 0);
    product.c.NH4 = inlet.c.NH4 + orgN * 0.4 * (MW.NH4 / MW.N);
    // Ammonification moves nitrogen between forms without destroying it, so the
    // total can never fall below the ammonia it contains. Removing a little TN
    // with the sludge while leaving NH4 untouched used to produce exactly that
    // impossible state, and it understates the load the stripper has to carry.
    product.c.TN = Math.max(product.c.TN, product.c.NH4 * (MW.N / MW.NH4));
    product.pH = clamp(inlet.pH + 0.3, 4, 9);

    const codRemovedKgH = (inlet.flow * inlet.c.COD * codRem) / 1000;
    const ch4M3H = codRemovedKgH * n(p, "ch4Yield", 0.30);
    const biogasM3H = ch4M3H / Math.max(n(p, "ch4Fraction", 65) / 100, 0.1);
    // Lower heating value of methane, 9.97 kWh/Nm3.
    const biogasKW = ch4M3H * 9.97;

    const volByOlr = (inlet.flow * 24 * inlet.c.COD / 1000) / Math.max(n(p, "olr", 8), 0.1);
    const volByHrt = inlet.flow * n(p, "hrtH", 24);
    const vol = Math.max(volByOlr, volByHrt);
    const area = inlet.flow / Math.max(n(p, "upflowVel", 1.0), 0.05);
    const heightM = vol / Math.max(area, 0.1);

    const notes: string[] = [];
    notes.push(`Biogas recovers about ${biogasKW.toFixed(0)} kW of thermal energy. Whether that is a credit depends on there being something on site that can use it — on a landfill with a waste-to-energy plant it is; on a standalone leachate plant it usually is not, and the gas is flared.`);
    if (volByOlr > volByHrt * 1.05) {
      notes.push(`Volume is set by the organic loading rate (${volByOlr.toFixed(0)} m3), not by the HRT (${volByHrt.toFixed(0)} m3). On strong wastewater this is normal.`);
    }
    if (inlet.c.SO4 > 500) {
      notes.push(`Sulphate ${inlet.c.SO4.toFixed(0)} mg/L will be reduced to hydrogen sulphide, competing with methanogenesis and creating an odour, corrosion and gas-treatment problem. Above roughly COD:SO4 of 10 this becomes the governing design issue.`);
    }
    if (inlet.c.NH4 > 3000) {
      notes.push(`Ammonium ${inlet.c.NH4.toFixed(0)} mg/L is inhibitory to methanogens. Free ammonia above about 100 mg/L stalls the reactor, and at this concentration that means holding the pH down.`);
    }
    if (inlet.T < 20 && n(p, "heatingKWhM3", 0) === 0) {
      notes.push(`At ${inlet.T.toFixed(0)} degC without heating the kinetics are slow; either heat the reactor or increase the volume substantially.`);
    }

    return {
      outlets: { out: product, was: side },
      aux: aux({
        powerKW: 0.03 * inlet.flow + 2 + (n(p, "heatingKWhM3", 0) * inlet.flow),
        drySolidsKgH: codRemovedKgH * n(p, "yieldCoef", 0.08),
        hrtH: vol / Math.max(inlet.flow, 0.01),
        sizing: [
          { label: "Reactor volume", value: `${vol.toFixed(0)} m3` },
          { label: "Actual HRT", value: `${(vol / Math.max(inlet.flow, 0.01)).toFixed(1)} h` },
          { label: "Cross-sectional area", value: `${area.toFixed(1)} m2, height ${heightM.toFixed(1)} m` },
          { label: "COD removed", value: `${codRemovedKgH.toFixed(1)} kg/h` },
          { label: "Biogas", value: `${biogasM3H.toFixed(0)} Nm3/h at ${n(p, "ch4Fraction", 65)} % CH4` },
          { label: "Recoverable energy", value: `${biogasKW.toFixed(0)} kW thermal` },
        ],
        capexUSD: costCurve(vol, 620, 0.72),
        notes,
      }),
    };
  },
};

/* ================================================ biological aerated filter */

const baf: UnitModel = {
  type: "baf", label: "Biological Aerated Filter (BAF)", short: "BAF",
  category: "biological", inlets: 1, outlets: ["out", "backwash"],
  description:
    "A submerged bed of media that carries the biofilm and filters the solids at the same time, so it needs no clarifier and very little land. CCEPC used a two-stage BAF on the Qianzishan biogas slurry plant. Usually configured as a carbon-removal stage followed by a nitrifying stage.",
  ccepcMaturity: 4,
  params: [
    { key: "filtrationRate", label: "Filtration rate", type: "number", unit: "m/h", min: 1, max: 12, step: 0.5, group: "Sizing" },
    { key: "mediaDepthM", label: "Media depth", type: "number", unit: "m", min: 1.5, max: 5, step: 0.1, group: "Sizing" },
    { key: "volLoad", label: "Volumetric BOD load", type: "number", unit: "kgBOD/m3.d", min: 0.5, max: 8, step: 0.25, group: "Sizing" },
    { key: "codRemoval", label: "COD removal", type: "number", unit: "%", min: 20, max: 92, step: 1, group: "Performance" },
    { key: "bodRemoval", label: "BOD removal", type: "number", unit: "%", min: 40, max: 97, step: 1, group: "Performance" },
    { key: "nh4Removal", label: "Ammonia removal", type: "number", unit: "%", min: 0, max: 98, step: 1, group: "Performance" },
    { key: "tnRemoval", label: "TN removal", type: "number", unit: "%", min: 0, max: 80, step: 1, group: "Performance" },
    { key: "tssRemoval", label: "TSS removal", type: "number", unit: "%", min: 60, max: 98, step: 1, group: "Performance" },
    { key: "airRatio", label: "Process air ratio", type: "number", unit: "m3/m3", min: 3, max: 40, step: 1, group: "Hydraulics" },
    { key: "backwashPct", label: "Backwash water", type: "number", unit: "% of feed", min: 1, max: 12, step: 0.5, group: "Performance" },
  ],
  defaults: {
    filtrationRate: 4, mediaDepthM: 3, volLoad: 3, codRemoval: 70, bodRemoval: 90,
    nh4Removal: 85, tnRemoval: 40, tssRemoval: 90, airRatio: 12, backwashPct: 5,
  },
  solve: (inlet, p) => {
    const { product, side } = removeToSideStream(inlet, n(p, "backwashPct", 5) / 100, {
      COD: n(p, "codRemoval", 70) / 100,
      BOD: n(p, "bodRemoval", 90) / 100,
      TOC: n(p, "codRemoval", 70) / 100,
      NH4: n(p, "nh4Removal", 85) / 100,
      TN: n(p, "tnRemoval", 40) / 100,
      TSS: n(p, "tssRemoval", 90) / 100,
      TP: 0.3, Oil: 0.7,
    });
    product.extras.coliform = inlet.extras.coliform * 0.2;

    const area = inlet.flow / Math.max(n(p, "filtrationRate", 4), 0.1);
    const vol = area * n(p, "mediaDepthM", 3);
    const bodLoadKgD = (inlet.flow * 24 * inlet.c.BOD * (n(p, "bodRemoval", 90) / 100)) / 1000;
    const actualLoad = bodLoadKgD / Math.max(vol, 0.1);
    const airM3H = inlet.flow * n(p, "airRatio", 12);
    const blowerKW = (airM3H / 3600) * (n(p, "mediaDepthM", 3) * 9810 + 3000) / 0.65 / 1000;

    const notes: string[] = [];
    if (actualLoad > n(p, "volLoad", 3) * 1.15) {
      notes.push(`Actual volumetric load ${actualLoad.toFixed(2)} kgBOD/m3.d exceeds the design ${n(p, "volLoad", 3)}. The bed will blind and the backwash interval will collapse.`);
    }
    if (inlet.c.TSS > 150) {
      notes.push(`Feed TSS ${inlet.c.TSS.toFixed(0)} mg/L is high for a BAF. It filters as well as treats, so solids shorten the run time directly; a settling or flotation step ahead of it pays for itself.`);
    }
    return {
      outlets: { out: product, backwash: side },
      aux: aux({
        powerKW: blowerKW + 0.015 * inlet.flow,
        drySolidsKgH: (inlet.flow * inlet.c.TSS * (n(p, "tssRemoval", 90) / 100)) / 1000,
        hrtH: vol / Math.max(inlet.flow, 0.01),
        sizing: [
          { label: "Filter area", value: `${area.toFixed(1)} m2` },
          { label: "Media volume", value: `${vol.toFixed(0)} m3 at ${n(p, "mediaDepthM", 3)} m depth` },
          { label: "Volumetric load", value: `${actualLoad.toFixed(2)} kgBOD/m3.d` },
          { label: "Process air", value: `${airM3H.toFixed(0)} m3/h` },
          { label: "Blower power", value: `${blowerKW.toFixed(1)} kW` },
        ],
        capexUSD: costCurve(vol, 1100, 0.74),
        notes,
      }),
    };
  },
};

/* ================================================================ DTRO */

/**
 * Disc-tube RO uses the same membrane chemistry as seawater RO but an open
 * flow channel, which is what lets it run on a liquid that would block a spiral
 * element within hours.
 *
 * These are LOCAL rejections, the property of the membrane itself, not the
 * system rejection a design report quotes. The solver multiplies by the
 * log-mean concentration factor along the module, which at 85 % recovery is
 * 2.23 — so a membrane rejecting 99.33 % locally delivers 98.5 % across the
 * system. Entering a quoted system figure here would understate the permeate
 * quality by a factor of two, which is exactly the error this comment exists to
 * prevent. The organics are back-calculated from the Bantargebang analysis
 * (system COD 98.5 %, TN 97 % over two stages at 85 % recovery).
 */
const DTRO_REJ: Partial<Record<Component, number>> = {
  Na: 0.993, K: 0.99, NH4: 0.96, Cl: 0.993, NO3: 0.95,
  Ca: 0.998, Mg: 0.998, SO4: 0.999, HCO3: 0.97, CO3: 0.99,
  SiO2: 0.98, F: 0.96, Fe: 0.998, Mn: 0.995, Ba: 0.998, Sr: 0.998,
  TDS: 0.992, TSS: 0.999, TOC: 0.9930, COD: 0.9933, BOD: 0.991, TN: 0.9863,
  TP: 0.99, Oil: 0.99,
};

const dtro: UnitModel = {
  type: "dtro", label: "Disc-Tube RO (DTRO)", short: "DTRO",
  category: "membrane", inlets: 1, outlets: ["permeate", "concentrate"],
  description:
    "High-pressure reverse osmosis in an open-channel disc-tube module. The flow path is short and wide, so it tolerates the suspended solids and fouling that would destroy a spiral element, at the cost of low packing density and high pressure. It is the standard leachate membrane and the reason a leachate plant can meet a discharge limit at all.",
  ccepcMaturity: 4,
  params: [
    { key: "stages", label: "Stages in series", type: "number", unit: "-", min: 1, max: 3, step: 1, group: "Performance",
      help: "Two stages is the usual leachate arrangement: the first at about 75 % recovery, the second taking its concentrate to roughly 85 % overall." },
    { key: "recovery", label: "Overall recovery", type: "number", unit: "%", min: 40, max: 92, step: 1, group: "Performance" },
    { key: "flux", label: "Flux", type: "number", unit: "LMH", min: 5, max: 30, step: 1, group: "Sizing",
      help: "18 LMH is the CCEPC design figure for leachate. Spiral RO on clean water runs at 18-25, so the flux is similar; it is the packing density that differs." },
    { key: "moduleArea", label: "Area per module", type: "number", unit: "m2", min: 4, max: 20, step: 0.5, group: "Sizing" },
    { key: "maxPressureBar", label: "Maximum pressure", type: "number", unit: "bar", min: 40, max: 160, step: 5, group: "Hydraulics" },
    { key: "feedPressureBar", label: "Feed pressure override", type: "number", unit: "bar", min: 0, max: 160, step: 1, group: "Hydraulics",
      help: "Leave at zero to let the model estimate from the osmotic pressure." },
    { key: "pumpEff", label: "Pump efficiency", type: "number", unit: "-", min: 0.5, max: 0.85, step: 0.01, group: "Hydraulics" },
    { key: "antiscalantDose", label: "Antiscalant dose", type: "number", unit: "mg/L", min: 0, max: 30, step: 0.5, group: "Chemicals" },
    { key: "rejectionScale", label: "Rejection scaling", type: "number", unit: "x", min: 0.5, max: 1.02, step: 0.01, group: "Performance" },
    { key: "cipPerYear", label: "Cleans per year", type: "number", unit: "1/y", min: 4, max: 100, step: 2, group: "Chemicals" },
  ],
  defaults: {
    stages: 2, recovery: 85, flux: 18, moduleArea: 9, maxPressureBar: 120,
    feedPressureBar: 0, pumpEff: 0.75, antiscalantDose: 6, rejectionScale: 1, cipPerYear: 24,
  },
  solve: (inlet, p) => {
    const Y = clamp(n(p, "recovery", 85) / 100, 0.05, 0.95);
    const scale = clamp(n(p, "rejectionScale", 1), 0.5, 1.02);
    const rej: Partial<Record<Component, number>> = {};
    for (const [k, v] of Object.entries(DTRO_REJ)) rej[k as Component] = clamp(v * scale, 0, 0.9999);

    const { product: permeate, reject: concentrate } = splitByRejection(inlet, Y, rej, 0.95);
    // Carbon dioxide passes the membrane freely and re-forms carbonic acid on
    // the permeate side, so the drop depends on how much alkalinity there was
    // to convert. A neutralised, low-alkalinity feed barely moves.
    const alkFeed = alkalinityAsCaCO3(inlet);
    permeate.pH = clamp(inlet.pH - clamp(alkFeed / 1200, 0.1, 1.2), 4.5, 8.5);
    permeate.extras.sdi15 = 0;
    permeate.extras.turbidityNTU = 0.02;

    // Van 't Hoff on the log-mean concentration, plus the net driving pressure
    // and the module losses, which are appreciable in an open channel.
    const osmFeed = 0.78 * inlet.c.TDS / 1000;
    const osmConc = 0.78 * concentrate.c.TDS / 1000;
    const estPressure = (osmFeed + osmConc) / 2 + 8 + 3 * n(p, "stages", 2);
    const pressure = n(p, "feedPressureBar", 0) > 0 ? n(p, "feedPressureBar", 0) : estPressure;
    const kw = pumpKW(inlet.flow, pressure * 10.2, n(p, "pumpEff", 0.75));

    const area = (permeate.flow * 1000) / Math.max(n(p, "flux", 18), 1);
    const modules = Math.ceil(area / Math.max(n(p, "moduleArea", 9), 1));

    const notes: string[] = [];
    const maxP = n(p, "maxPressureBar", 120);
    if (pressure > maxP) {
      notes.push(`Estimated feed pressure ${pressure.toFixed(0)} bar exceeds the ${maxP} bar module rating. Either the recovery is too high for this salinity or the water is too concentrated for DTRO at all — check the feed TDS before anything else.`);
    }
    if (osmFeed > maxP * 0.6) {
      notes.push(`Feed osmotic pressure alone is ${osmFeed.toFixed(0)} bar. A membrane cannot work below its own osmotic pressure, so at this salinity the answer is evaporation, not more pressure.`);
    }
    if (concentrate.c.TDS > 120000) {
      notes.push(`Concentrate reaches ${(concentrate.c.TDS / 1000).toFixed(0)} g/L. That is at the practical ceiling for DTRO; taking it further needs an evaporator or a brine concentrator.`);
    }
    if (inlet.c.TSS > 200) {
      notes.push(`Feed TSS ${inlet.c.TSS.toFixed(0)} mg/L is tolerable for DTRO — that is its purpose — but the cleaning frequency will rise sharply. A cartridge filter ahead of it is still worth its cost.`);
    }
    if (inlet.pH > 8.5 && inlet.c.NH4 > 100) {
      notes.push(`At pH ${inlet.pH.toFixed(1)} the ammonia is largely the free gas, which passes the membrane. Neutralise to about pH 7 first or the nitrogen limit will be missed however good the membrane is.`);
    }

    return {
      outlets: { permeate, concentrate },
      aux: aux({
        powerKW: kw,
        chemicals: {
          Antiscalant: (n(p, "antiscalantDose", 6) * inlet.flow) / 1000,
          "Citric acid (CIP)": (area * 0.4 * n(p, "cipPerYear", 24)) / 8760,
          "Caustic soda (CIP)": (area * 0.3 * n(p, "cipPerYear", 24)) / 8760,
        },
        sizing: [
          { label: "Stages", value: `${n(p, "stages", 2)} in series at ${(Y * 100).toFixed(0)} % overall` },
          { label: "Membrane area", value: `${area.toFixed(0)} m2` },
          { label: "Modules", value: `${modules} x ${n(p, "moduleArea", 9)} m2` },
          { label: "Feed pressure", value: `${pressure.toFixed(0)} bar${n(p, "feedPressureBar", 0) > 0 ? " (user)" : " (estimated)"}` },
          { label: "Feed / concentrate osmotic", value: `${osmFeed.toFixed(0)} / ${osmConc.toFixed(0)} bar` },
          { label: "Concentrate TDS", value: `${(concentrate.c.TDS / 1000).toFixed(1)} g/L` },
          { label: "Specific energy", value: `${(kw / Math.max(permeate.flow, 0.01)).toFixed(2)} kWh/m3 permeate` },
        ],
        capexUSD: costCurve(area, 420, 0.86) + costCurve(inlet.flow, 3200, 0.7),
        notes,
      }),
    };
  },
};

/* ======================================================= advanced oxidation */

const aop: UnitModel = {
  type: "aop", label: "Advanced Oxidation (AOP)", short: "AOP",
  category: "oxidation", inlets: 1, outlets: ["out"],
  description:
    "Generates hydroxyl radicals to break down the organic matter that biology cannot. It is the only thing that removes the colour of an old leachate. The energy is proportional to the COD it has to oxidise, so where it sits in the train matters more than which variant is chosen: after a membrane it polishes a hundred mg/L, ahead of one it would have to attack ten thousand.",
  ccepcMaturity: 4,
  params: [
    { key: "method", label: "Method", type: "select", group: "Performance",
      options: [
        { value: "o3cat", label: "Catalytic ozonation" },
        { value: "o3", label: "Ozonation" },
        { value: "o3h2o2", label: "Ozone + peroxide (peroxone)" },
        { value: "fenton", label: "Fenton / Fe2+ + H2O2" },
      ] },
    { key: "codRemoval", label: "COD removal", type: "number", unit: "%", min: 10, max: 90, step: 1, group: "Performance" },
    { key: "o3PerCod", label: "Oxidant per COD removed", type: "number", unit: "kg/kgCOD", min: 0.8, max: 6, step: 0.1, group: "Chemicals",
      help: "2.5 kg O3 per kg COD removed is the CCEPC design basis. Catalytic ozonation improves on plain ozonation because the catalyst converts more of the ozone into hydroxyl radicals." },
    { key: "o3EnergyKWhKg", label: "Ozone generation energy", type: "number", unit: "kWh/kgO3", min: 6, max: 20, step: 0.5, group: "Hydraulics",
      help: "10 kWh/kg from oxygen feed; roughly double from air feed." },
    { key: "contactMin", label: "Contact time", type: "number", unit: "min", min: 5, max: 120, step: 5, group: "Sizing" },
    { key: "colourRemoval", label: "Colour removal", type: "number", unit: "%", min: 30, max: 99, step: 1, group: "Performance" },
    { key: "feDose", label: "Fe2+ dose (Fenton)", type: "number", unit: "mg/L", min: 0, max: 2000, step: 10, group: "Chemicals" },
    { key: "bodIncrease", label: "BOD released", type: "number", unit: "% of COD removed", min: 0, max: 60, step: 5, group: "Performance",
      help: "Partial oxidation breaks refractory molecules into biodegradable fragments. That is a benefit if a biological step follows, and a problem if this is the last unit." },
  ],
  defaults: {
    method: "o3cat", codRemoval: 60, o3PerCod: 2.5, o3EnergyKWhKg: 10,
    contactMin: 30, colourRemoval: 90, feDose: 0, bodIncrease: 20,
  },
  solve: (inlet, p) => {
    const out = cloneStream(inlet);
    const rem = n(p, "codRemoval", 60) / 100;
    const codRemovedKgH = (inlet.flow * inlet.c.COD * rem) / 1000;
    out.c.COD = inlet.c.COD * (1 - rem);
    out.c.TOC = inlet.c.TOC * (1 - rem * 0.85);
    // Some of the destroyed COD reappears as biodegradable fragments.
    out.c.BOD = inlet.c.BOD + inlet.c.COD * rem * (n(p, "bodIncrease", 20) / 100);
    out.extras.coliform = 0;
    out.c.Oil = inlet.c.Oil * (1 - rem);

    const method = s(p, "method", "o3cat");
    const oxidantKgH = codRemovedKgH * n(p, "o3PerCod", 2.5);
    const chem: Record<string, number> = {};
    let kw = 0.02 * inlet.flow + 2;
    const notes: string[] = [];

    if (method === "fenton") {
      chem["Hydrogen peroxide H2O2"] = oxidantKgH;
      chem["Ferrous sulphate FeSO4"] = (n(p, "feDose", 500) * inlet.flow) / 1000;
      // Fenton runs acid and leaves an iron sludge that has to be settled out.
      const feKgH = (n(p, "feDose", 500) * inlet.flow) / 1000;
      out.c.Fe = inlet.c.Fe + n(p, "feDose", 500) * 0.05;
      notes.push("Fenton needs pH 3 going in and neutralisation coming out, and it leaves an iron hydroxide sludge. Its low power draw is real, but the chemical and sludge-disposal cost usually cancels it.");
      return {
        outlets: { out },
        aux: aux({
          powerKW: kw, chemicals: chem, drySolidsKgH: feKgH * 1.9,
          hrtH: n(p, "contactMin", 30) / 60,
          sizing: [
            { label: "COD removed", value: `${codRemovedKgH.toFixed(1)} kg/h` },
            { label: "Peroxide demand", value: `${oxidantKgH.toFixed(1)} kg/h` },
            { label: "Reactor volume", value: `${(inlet.flow * n(p, "contactMin", 30) / 60).toFixed(0)} m3` },
            { label: "Iron sludge", value: `${(feKgH * 1.9).toFixed(1)} kg/h dry` },
          ],
          capexUSD: costCurve(Math.max(inlet.flow, 1), 2400, 0.68),
          notes,
        }),
      };
    }

    // Ozone routes: the generator dominates both capital and running cost.
    const genKW = oxidantKgH * n(p, "o3EnergyKWhKg", 10);
    kw += genKW;
    if (method === "o3h2o2") chem["Hydrogen peroxide H2O2"] = oxidantKgH * 0.35;
    chem["Oxygen (LOX or PSA)"] = oxidantKgH * 12;

    const vol = (inlet.flow * n(p, "contactMin", 30)) / 60;
    if (inlet.c.COD > 1000) {
      notes.push(`Feed COD is ${inlet.c.COD.toFixed(0)} mg/L, so this unit is being asked to oxidise ${codRemovedKgH.toFixed(0)} kg/h and draws ${genKW.toFixed(0)} kW to do it. Advanced oxidation is a polishing step; placing it after the membranes instead of before them typically cuts this by two orders of magnitude.`);
    }
    if (inlet.c.Cl > 5000) {
      notes.push(`Chloride ${inlet.c.Cl.toFixed(0)} mg/L will scavenge hydroxyl radicals and can form chlorinated by-products. Verify the oxidant demand experimentally rather than from the COD alone.`);
    }
    if (n(p, "bodIncrease", 20) > 0 && out.c.BOD > inlet.c.BOD) {
      notes.push(`Effluent BOD rises from ${inlet.c.BOD.toFixed(0)} to ${out.c.BOD.toFixed(0)} mg/L as refractory molecules are broken into biodegradable fragments. Useful ahead of a biological polishing step; a compliance problem if this is the final unit.`);
    }

    return {
      outlets: { out },
      aux: aux({
        powerKW: kw,
        chemicals: chem,
        hrtH: n(p, "contactMin", 30) / 60,
        sizing: [
          { label: "COD removed", value: `${codRemovedKgH.toFixed(1)} kg/h (${(codRemovedKgH * 24 / 1000).toFixed(2)} t/d)` },
          { label: "Ozone demand", value: `${oxidantKgH.toFixed(1)} kg/h (${(oxidantKgH * 24).toFixed(0)} kg/d)` },
          { label: "Generator power", value: `${genKW.toFixed(0)} kW` },
          { label: "Specific energy", value: `${(kw / Math.max(inlet.flow, 0.01)).toFixed(2)} kWh/m3` },
          { label: "Contact volume", value: `${vol.toFixed(0)} m3` },
        ],
        capexUSD: costCurve(Math.max(oxidantKgH * 24, 1), 3400, 0.7) + costCurve(Math.max(vol, 1), 1400, 0.66),
        notes,
      }),
    };
  },
};

/* =================================================== electrochemical oxidation */

const electroOx: UnitModel = {
  type: "electroox", label: "Electrochemical Oxidation", short: "EOX",
  category: "oxidation", inlets: 1, outlets: ["out"],
  description:
    "Oxidises organics directly at an anode surface, and indirectly through chlorine generated from the chloride already in the water. No chemical delivery and no sludge, but the energy is paid entirely as electricity. CCEPC used electrochemistry on the Qianzishan biogas slurry plant.",
  ccepcMaturity: 3,
  params: [
    { key: "codRemoval", label: "COD removal", type: "number", unit: "%", min: 10, max: 90, step: 1, group: "Performance" },
    { key: "specEnergy", label: "Specific energy", type: "number", unit: "kWh/kgCOD", min: 10, max: 150, step: 5, group: "Hydraulics",
      help: "Strongly dependent on conductivity and on the anode. 20-40 on a saline leachate, far more on a low-conductivity water." },
    { key: "currentDensity", label: "Current density", type: "number", unit: "A/m2", min: 50, max: 1000, step: 25, group: "Sizing" },
    { key: "cellVoltage", label: "Cell voltage", type: "number", unit: "V", min: 3, max: 15, step: 0.5, group: "Sizing" },
    { key: "nh4Removal", label: "Ammonia removal", type: "number", unit: "%", min: 0, max: 95, step: 1, group: "Performance",
      help: "Chloride-rich water generates hypochlorite at the anode, which breakpoint-oxidises ammonia. On a leachate this is often the main reason the unit is chosen." },
    { key: "anodeLifeY", label: "Anode life", type: "number", unit: "y", min: 1, max: 10, step: 0.5, group: "Performance" },
  ],
  defaults: {
    codRemoval: 55, specEnergy: 30, currentDensity: 300, cellVoltage: 6,
    nh4Removal: 60, anodeLifeY: 4,
  },
  solve: (inlet, p) => {
    const out = cloneStream(inlet);
    const rem = n(p, "codRemoval", 55) / 100;
    const codRemovedKgH = (inlet.flow * inlet.c.COD * rem) / 1000;
    out.c.COD = inlet.c.COD * (1 - rem);
    out.c.TOC = inlet.c.TOC * (1 - rem * 0.9);
    out.c.BOD = inlet.c.BOD * (1 - rem * 0.8);
    const nh4Rem = n(p, "nh4Removal", 60) / 100;
    out.c.NH4 = inlet.c.NH4 * (1 - nh4Rem);
    out.c.TN = Math.max(inlet.c.TN - (inlet.c.NH4 - out.c.NH4) * (MW.N / MW.NH4), 0);
    // Chloride is consumed making hypochlorite and largely regenerated.
    out.c.Cl = inlet.c.Cl * 0.97;
    out.extras.coliform = 0;

    const kw = codRemovedKgH * n(p, "specEnergy", 30);
    const currentA = (kw * 1000) / Math.max(n(p, "cellVoltage", 6), 1);
    const anodeArea = currentA / Math.max(n(p, "currentDensity", 300), 1);

    const notes: string[] = [];
    if (inlet.c.Cl < 1000) {
      notes.push(`Chloride is only ${inlet.c.Cl.toFixed(0)} mg/L. Without chloride there is no indirect oxidation, the energy per kg COD rises steeply, and the ammonia removal set here will not happen.`);
    }
    if (inlet.c.Cl > 2000) {
      notes.push("High chloride makes the unit efficient but generates chlorinated organics and chlorate. Where the effluent goes to a river, have the by-products analysed before committing to this route.");
    }
    if (n(p, "specEnergy", 30) * codRemovedKgH / Math.max(inlet.flow, 0.01) > 15) {
      notes.push(`Specific energy works out at ${(kw / Math.max(inlet.flow, 0.01)).toFixed(1)} kWh/m3. Electrochemical oxidation only makes sense on a small, concentrated stream — check whether it is being applied to the wrong point in the train.`);
    }
    return {
      outlets: { out },
      aux: aux({
        powerKW: kw + 1,
        sizing: [
          { label: "COD removed", value: `${codRemovedKgH.toFixed(2)} kg/h` },
          { label: "Rectifier power", value: `${kw.toFixed(1)} kW` },
          { label: "Current", value: `${(currentA / 1000).toFixed(1)} kA at ${n(p, "cellVoltage", 6)} V` },
          { label: "Anode area", value: `${anodeArea.toFixed(1)} m2 at ${n(p, "currentDensity", 300)} A/m2` },
          { label: "Specific energy", value: `${(kw / Math.max(inlet.flow, 0.01)).toFixed(2)} kWh/m3` },
          { label: "Anode replacement", value: `every ${n(p, "anodeLifeY", 4)} y` },
        ],
        capexUSD: costCurve(Math.max(anodeArea, 0.1), 9000, 0.8),
        notes,
      }),
    };
  },
};

/* ========================================================= oil separation */

const oilSeparator: UnitModel = {
  type: "oilsep", label: "Oil Separator (API / CPI)", short: "OILSEP",
  category: "pretreatment", inlets: 1, outlets: ["out", "oil"],
  description:
    "Gravity separation of free oil, which rises instead of settling. Corrugated plates shorten the rise path in the same way inclined plates shorten a settling path. It removes free and dispersed oil only — emulsified oil needs flotation or chemistry.",
  ccepcMaturity: 5,
  params: [
    { key: "design", label: "Type", type: "select", group: "Sizing",
      options: [
        { value: "api", label: "API separator (open channel)" },
        { value: "cpi", label: "CPI / corrugated plate interceptor" },
      ] },
    { key: "riseRateMh", label: "Design rise rate", type: "number", unit: "m/h", min: 0.3, max: 6, step: 0.1, group: "Sizing",
      help: "Set by the smallest droplet to be captured. API designs on 150 micron, CPI on 60 micron." },
    { key: "oilRemoval", label: "Oil removal", type: "number", unit: "%", min: 50, max: 98, step: 1, group: "Performance" },
    { key: "tssRemoval", label: "TSS removal", type: "number", unit: "%", min: 10, max: 80, step: 1, group: "Performance" },
    { key: "oilFlowPct", label: "Skimmed flow", type: "number", unit: "% of feed", min: 0.1, max: 5, step: 0.1, group: "Performance" },
    { key: "hrtMin", label: "Retention time", type: "number", unit: "min", min: 10, max: 120, step: 5, group: "Sizing" },
  ],
  defaults: { design: "cpi", riseRateMh: 1.2, oilRemoval: 90, tssRemoval: 45, oilFlowPct: 0.8, hrtMin: 30 },
  solve: (inlet, p) => {
    const { product, side } = removeToSideStream(inlet, n(p, "oilFlowPct", 0.8) / 100, {
      Oil: n(p, "oilRemoval", 90) / 100,
      TSS: n(p, "tssRemoval", 45) / 100,
      COD: n(p, "oilRemoval", 90) / 100 * 0.25,
      BOD: n(p, "oilRemoval", 90) / 100 * 0.2,
    });
    const area = inlet.flow / Math.max(n(p, "riseRateMh", 1.2), 0.05);
    const vol = (inlet.flow * n(p, "hrtMin", 30)) / 60;
    const notes: string[] = [];
    if (inlet.c.Oil > 2000) {
      notes.push(`Oil ${inlet.c.Oil.toFixed(0)} mg/L is very high. Gravity separation alone will not reach a dischargeable figure; plan a flotation step after it.`);
    }
    if (s(p, "design", "cpi") === "api" && area > 250) {
      notes.push(`An API separator at this flow needs ${area.toFixed(0)} m2. A corrugated-plate unit would do it in roughly a fifth of the area.`);
    }
    return {
      outlets: { out: product, oil: side },
      aux: aux({
        powerKW: 1 + 0.004 * inlet.flow,
        drySolidsKgH: (inlet.flow * inlet.c.Oil * (n(p, "oilRemoval", 90) / 100)) / 1000,
        hrtH: n(p, "hrtMin", 30) / 60,
        sizing: [
          { label: "Separator area", value: `${area.toFixed(1)} m2` },
          { label: "Volume", value: `${vol.toFixed(0)} m3` },
          { label: "Oil recovered", value: `${((inlet.flow * inlet.c.Oil * (n(p, "oilRemoval", 90) / 100)) / 1000).toFixed(2)} kg/h` },
        ],
        capexUSD: costCurve(Math.max(area, 1), 3000, 0.7),
        notes,
      }),
    };
  },
};

export const ADVANCED_MODELS: UnitModel[] = [
  phAdjust, ammoniaStripper, oilSeparator,
  anaerobic, mbr, baf,
  dtro, aop, electroOx,
];

/** Re-exported so the report layer can describe what a stream carries. */
export type { Params, Stream };
