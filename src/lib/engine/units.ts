import { Component, ParamDef, Params, UnitModel } from "./types";
import {
  alkalinityAsCaCO3, clamp, cloneStream, emptyStream, hardnessAsCaCO3,
  osmoticPressureBar, removeToSideStream, splitByRejection,
} from "./stream";
import { aux, b, costCurve, n, pumpKW, s } from "./unitkit";
import { ADVANCED_MODELS } from "./units-advanced";


const PARAM_FLOWMARGIN: ParamDef = {
  key: "designMarginPct", label: "Design margin", type: "number", unit: "%",
  min: 0, max: 50, step: 5, group: "Sizing",
  help: "Extra capacity installed above the calculated duty.",
};

/* ================================================================= INTAKE */

const intake: UnitModel = {
  type: "intake", label: "Intake & Bar Screen", short: "INTAKE",
  category: "intake", inlets: 1, outlets: ["out"],
  description:
    "River or seawater abstraction with coarse bar screen and intake pumps. Removes debris only; no change in dissolved quality.",
  ccepcMaturity: 5,
  params: [
    { key: "headM", label: "Pump head", type: "number", unit: "m", min: 5, max: 120, step: 1, group: "Hydraulics" },
    { key: "pumpEff", label: "Pump efficiency", type: "number", unit: "-", min: 0.4, max: 0.9, step: 0.01, group: "Hydraulics" },
    { key: "screenRemovalTSS", label: "TSS removal", type: "number", unit: "%", min: 0, max: 20, step: 1, group: "Performance" },
    { key: "electrochlorination", label: "Electrochlorination", type: "boolean", group: "Chemicals",
      help: "Marine growth control for seawater intakes. CCEPC standard on seawater projects." },
    { key: "cl2Dose", label: "Cl2 dose", type: "number", unit: "mg/L", min: 0, max: 10, step: 0.5, group: "Chemicals" },
  ],
  defaults: { headM: 30, pumpEff: 0.7, screenRemovalTSS: 3, electrochlorination: false, cl2Dose: 2 },
  solve: (inlet, p) => {
    const out = cloneStream(inlet);
    out.c.TSS *= 1 - n(p, "screenRemovalTSS") / 100;
    out.extras.turbidityNTU *= 1 - n(p, "screenRemovalTSS") / 200;
    const chem: Record<string, number> = {};
    if (b(p, "electrochlorination") || n(p, "cl2Dose") > 0) {
      chem["Sodium hypochlorite (as Cl2)"] = (n(p, "cl2Dose") * inlet.flow) / 1000;
      out.extras.coliform *= 0.02;
    }
    const kw = pumpKW(inlet.flow, n(p, "headM", 30), n(p, "pumpEff", 0.7));
    return {
      outlets: { out },
      aux: aux({
        powerKW: kw, chemicals: chem,
        sizing: [
          { label: "Intake pumps", value: `2 x 100 % @ ${(inlet.flow * 1.1).toFixed(0)} m3/h` },
          { label: "Pump shaft power", value: `${kw.toFixed(1)} kW` },
        ],
        capexUSD: costCurve(inlet.flow, 5200, 0.62),
      }),
    };
  },
};

/* ================================================================= TANKS */

/** Draw-off names for a tank configured with `count` outlets. */
function tankOutlets(count: number): string[] {
  const k = Math.max(1, Math.min(4, Math.round(count)));
  return k === 1 ? ["out"] : Array.from({ length: k }, (_, i) => `out${i + 1}`);
}

function tankModel(
  type: string, label: string, short: string, defaultHRT: number,
  category: UnitModel["category"] = "storage",
): UnitModel {
  return {
    type, label, short, category, inlets: 1, outlets: ["out"],
    dynamicOutlets: (p) => tankOutlets(n(p, "outletCount", 1)),
    description:
      "Storage or buffer volume sized on hydraulic retention time. Provides no treatment; equalises flow and quality. More than one outlet may be drawn from it — a bypass and a membrane feed, for instance — with the split set here.",
    ccepcMaturity: 5,
    params: [
      { key: "outletCount", label: "Number of outlets", type: "number", unit: "-", min: 1, max: 4, step: 1, group: "Connections",
        help: "One vessel, several draw-off lines. Inlets need no setting: every connection made to the inlet is mixed." },
      { key: "split2", label: "Outlet 2 share", type: "number", unit: "%", min: 0, max: 100, step: 0.1, group: "Connections" },
      { key: "split3", label: "Outlet 3 share", type: "number", unit: "%", min: 0, max: 100, step: 0.1, group: "Connections" },
      { key: "split4", label: "Outlet 4 share", type: "number", unit: "%", min: 0, max: 100, step: 0.1, group: "Connections" },
      { key: "hrtH", label: "Retention time (HRT)", type: "number", unit: "h", min: 0.1, max: 72, step: 0.5, group: "Sizing",
        help: "Volume = inlet flow x HRT. Drives both tank size and capital cost." },
      { key: "lossPct", label: "Evaporation / desilting loss", type: "number", unit: "%", min: 0, max: 5, step: 0.1, group: "Performance" },
      { key: "settleTSSPct", label: "Plain settling of TSS", type: "number", unit: "%", min: 0, max: 60, step: 1, group: "Performance" },
      PARAM_FLOWMARGIN,
    ],
    defaults: {
      hrtH: defaultHRT, lossPct: 0, settleTSSPct: 0, designMarginPct: 10,
      outletCount: 1, split2: 0, split3: 0, split4: 0,
    },
    solve: (inlet, p) => {
      const loss = n(p, "lossPct") / 100;
      const out = cloneStream(inlet);
      out.flow = inlet.flow * (1 - loss);
      const settle = n(p, "settleTSSPct") / 100;
      if (settle > 0 && out.flow > 0) {
        const keep = inlet.flow * inlet.c.TSS * (1 - settle);
        out.c.TSS = keep / out.flow;
        out.extras.turbidityNTU *= 1 - settle * 0.8;
      }
      const hrt = n(p, "hrtH", defaultHRT);
      const vol = inlet.flow * hrt * (1 + n(p, "designMarginPct", 10) / 100);

      // Split the outflow across however many draw-off lines are configured.
      // Outlet 1 takes whatever the named shares leave, so the shares can never
      // sum to more than the tank holds.
      const names = tankOutlets(n(p, "outletCount", 1));
      const shares = names.map((_, i) => (i === 0 ? 0 : n(p, `split${i + 1}`, 0)));
      const rest = 100 - shares.reduce((a, b) => a + b, 0);
      shares[0] = rest;
      const outs: Record<string, typeof out> = {};
      const splitNotes: string[] = [];
      if (rest < 0) {
        splitNotes.push(`The outlet shares total ${(100 - rest).toFixed(1)} %, which is more water than enters the tank. Reduce them until they sum to 100 %.`);
      }
      names.forEach((nm, i) => {
        const s = clamp(shares[i], 0, 100) / 100;
        const branch = cloneStream(out);
        branch.flow = out.flow * s;
        outs[nm] = branch;
      });
      return {
        outlets: outs,
        aux: aux({
          hrtH: hrt,
          sizing: [
            { label: "Working volume", value: `${vol.toFixed(0)} m3` },
            { label: "HRT", value: `${hrt.toFixed(1)} h` },
          ],
          capexUSD: costCurve(vol, 320, 0.68),
          notes: [
            ...(loss > 0 ? [`${(loss * 100).toFixed(1)} % volumetric loss taken as evaporation / desilting.`] : []),
            ...splitNotes,
          ],
        }),
      };
    },
  };
}

/* ================================================================= COAG / CLARIFY */

const coagFloc: UnitModel = {
  type: "coagfloc", label: "Coagulation & Flocculation", short: "COAG",
  category: "pretreatment", inlets: 1, outlets: ["out"],
  description:
    "Rapid mix and tapered flocculation. Destabilises colloids ahead of clarification. Consumes alkalinity, so caustic is usually required on low-alkalinity water.",
  ccepcMaturity: 5,
  params: [
    { key: "coagDose", label: "Coagulant dose (PAC)", type: "number", unit: "mg/L", min: 0, max: 150, step: 1, group: "Chemicals" },
    { key: "polymerDose", label: "Polymer dose", type: "number", unit: "mg/L", min: 0, max: 5, step: 0.1, group: "Chemicals" },
    { key: "targetPH", label: "Target pH", type: "number", unit: "-", min: 5.5, max: 9, step: 0.1, group: "Chemicals" },
    { key: "mixTimeMin", label: "Rapid mix time", type: "number", unit: "min", min: 0.5, max: 5, step: 0.5, group: "Sizing" },
    { key: "flocTimeMin", label: "Flocculation time", type: "number", unit: "min", min: 5, max: 45, step: 1, group: "Sizing" },
  ],
  defaults: { coagDose: 30, polymerDose: 0.5, targetPH: 7.2, mixTimeMin: 1.5, flocTimeMin: 20 },
  solve: (inlet, p) => {
    const out = cloneStream(inlet);
    const dose = n(p, "coagDose");
    // PAC consumes about 0.5 mg/L alkalinity as CaCO3 per mg/L of product.
    const alkBefore = alkalinityAsCaCO3(inlet);
    const alkConsumed = Math.min(dose * 0.5, alkBefore * 0.8);
    const hco3Drop = (alkConsumed / 50) * 61.02;
    out.c.HCO3 = Math.max(0, out.c.HCO3 - hco3Drop);
    // Aluminium carried into the floc, added as solids not as dissolved metal.
    out.c.TSS += dose * 0.45;
    const target = n(p, "targetPH", 7.2);
    out.pH = target;
    // Caustic demand to hold the target pH against coagulant acidity.
    const naohDose = Math.max(0, (alkConsumed - alkBefore * 0.15) * 0.8);
    const chem: Record<string, number> = {
      "Poly-aluminium chloride": (dose * inlet.flow) / 1000,
      "Polymer flocculant": (n(p, "polymerDose") * inlet.flow) / 1000,
    };
    if (naohDose > 0.5) chem["Caustic soda (pH correction)"] = (naohDose * inlet.flow) / 1000;
    const vol =
      (inlet.flow / 60) * (n(p, "mixTimeMin", 1.5) + n(p, "flocTimeMin", 20));
    return {
      outlets: { out },
      aux: aux({
        powerKW: 0.02 * inlet.flow ** 0.75 + 2,
        chemicals: chem,
        hrtH: (n(p, "mixTimeMin", 1.5) + n(p, "flocTimeMin", 20)) / 60,
        sizing: [
          { label: "Rapid mix volume", value: `${((inlet.flow / 60) * n(p, "mixTimeMin", 1.5)).toFixed(1)} m3` },
          { label: "Flocculation volume", value: `${((inlet.flow / 60) * n(p, "flocTimeMin", 20)).toFixed(0)} m3` },
        ],
        capexUSD: costCurve(vol, 900, 0.7),
        notes:
          alkBefore < 40
            ? ["Raw water alkalinity is low; pH control will be active and caustic demand significant."]
            : [],
      }),
    };
  },
};

const clarifier: UnitModel = {
  type: "clarifier", label: "Lamella Clarifier", short: "CLAR",
  category: "pretreatment", inlets: 1, outlets: ["out", "sludge"],
  description:
    "Inclined-plate (lamella) clarifier. Multiplies settling area within a small plan area. CCEPC standard on the Gresik seawater train.",
  ccepcMaturity: 5,
  params: [
    { key: "riseRate", label: "Surface loading rate", type: "number", unit: "m3/m2.h", min: 1, max: 15, step: 0.5, group: "Sizing" },
    { key: "tssRemoval", label: "TSS removal", type: "number", unit: "%", min: 50, max: 99, step: 1, group: "Performance" },
    { key: "sludgeFlowPct", label: "Sludge blowdown", type: "number", unit: "% of feed", min: 0.5, max: 8, step: 0.1, group: "Performance" },
    { key: "codRemoval", label: "COD removal", type: "number", unit: "%", min: 0, max: 60, step: 1, group: "Performance" },
    { key: "trains", label: "Number of trains", type: "number", unit: "-", min: 1, max: 8, step: 1, group: "Sizing" },
  ],
  defaults: { riseRate: 6, tssRemoval: 90, sludgeFlowPct: 2, codRemoval: 35, trains: 2 },
  solve: (inlet, p) => {
    const { product, side } = removeToSideStream(inlet, n(p, "sludgeFlowPct", 2) / 100, {
      TSS: n(p, "tssRemoval", 90) / 100,
      COD: n(p, "codRemoval", 35) / 100,
      BOD: (n(p, "codRemoval", 35) / 100) * 0.7,
      TOC: (n(p, "codRemoval", 35) / 100) * 0.6,
      TP: 0.6, Fe: 0.7, Mn: 0.4, Oil: 0.5,
    });
    product.extras.turbidityNTU = inlet.extras.turbidityNTU * (1 - n(p, "tssRemoval", 90) / 100);
    product.extras.coliform = inlet.extras.coliform * 0.4;
    const area = inlet.flow / Math.max(n(p, "riseRate", 6), 0.1);
    const ds = (inlet.flow * inlet.c.TSS * (n(p, "tssRemoval", 90) / 100)) / 1000;
    return {
      outlets: { out: product, sludge: side },
      aux: aux({
        powerKW: 0.008 * inlet.flow + 2,
        drySolidsKgH: ds,
        sizing: [
          { label: "Total plan area", value: `${area.toFixed(1)} m2` },
          { label: "Configuration", value: `${n(p, "trains", 2)} x ${(area / Math.max(n(p, "trains", 2), 1)).toFixed(1)} m2` },
          { label: "Dry solids to sludge", value: `${ds.toFixed(1)} kg/h` },
        ],
        capexUSD: costCurve(area, 4200, 0.75),
      }),
    };
  },
};

const daf: UnitModel = {
  type: "daf", label: "Dissolved Air Flotation", short: "DAF",
  category: "pretreatment", inlets: 1, outlets: ["out", "float"],
  description:
    "Micro-bubble flotation for low-density solids, algae and oil. Used at Gresik downstream of the sedimentation basin.",
  ccepcMaturity: 5,
  params: [
    { key: "loading", label: "Surface loading rate", type: "number", unit: "m3/m2.h", min: 3, max: 15, step: 0.5, group: "Sizing" },
    { key: "recyclePct", label: "Saturation recycle", type: "number", unit: "% of feed", min: 5, max: 20, step: 1, group: "Performance" },
    { key: "tssRemoval", label: "TSS removal", type: "number", unit: "%", min: 50, max: 98, step: 1, group: "Performance" },
    { key: "oilRemoval", label: "Oil removal", type: "number", unit: "%", min: 50, max: 99, step: 1, group: "Performance" },
    { key: "floatFlowPct", label: "Float / scum draw-off", type: "number", unit: "% of feed", min: 0.5, max: 6, step: 0.1, group: "Performance" },
  ],
  defaults: { loading: 8, recyclePct: 10, tssRemoval: 85, oilRemoval: 92, floatFlowPct: 1.5 },
  solve: (inlet, p) => {
    const { product, side } = removeToSideStream(inlet, n(p, "floatFlowPct", 1.5) / 100, {
      TSS: n(p, "tssRemoval", 85) / 100,
      Oil: n(p, "oilRemoval", 92) / 100,
      COD: 0.3, BOD: 0.25, TOC: 0.25, TP: 0.4,
    });
    product.extras.turbidityNTU = inlet.extras.turbidityNTU * (1 - n(p, "tssRemoval", 85) / 100);
    const area = inlet.flow / Math.max(n(p, "loading", 8), 0.1);
    const ds = (inlet.flow * inlet.c.TSS * (n(p, "tssRemoval", 85) / 100)) / 1000;
    return {
      outlets: { out: product, float: side },
      aux: aux({
        powerKW: pumpKW(inlet.flow * (n(p, "recyclePct", 10) / 100), 60, 0.7) + 0.01 * inlet.flow + 3,
        drySolidsKgH: ds,
        sizing: [
          { label: "Flotation area", value: `${area.toFixed(1)} m2` },
          { label: "Saturation recycle", value: `${(inlet.flow * n(p, "recyclePct", 10) / 100).toFixed(1)} m3/h @ 5-6 bar` },
        ],
        capexUSD: costCurve(area, 6500, 0.72),
      }),
    };
  },
};

/* ================================================================= FILTERS */

function granularFilter(
  type: string, label: string, short: string,
  d: { rate: number; bw: number; tss: number; capex: number },
  extraParams: ParamDef[] = [], extraDefaults: Params = {},
): UnitModel {
  return {
    type, label, short, category: "pretreatment", inlets: 1, outlets: ["out", "backwash"],
    description:
      "Granular media filter operated in down-flow with periodic air-scour and water backwash. Backwash is drawn from the filtrate and reports as a side stream.",
    ccepcMaturity: 5,
    params: [
      { key: "filtrationRate", label: "Filtration rate", type: "number", unit: "m/h", min: 4, max: 20, step: 0.5, group: "Sizing" },
      { key: "bedDepth", label: "Bed depth", type: "number", unit: "m", min: 0.6, max: 2.5, step: 0.1, group: "Sizing" },
      { key: "backwashPct", label: "Backwash water", type: "number", unit: "% of feed", min: 0.5, max: 10, step: 0.1, group: "Performance" },
      { key: "tssRemoval", label: "TSS removal", type: "number", unit: "%", min: 50, max: 99, step: 1, group: "Performance" },
      { key: "standby", label: "Standby units", type: "number", unit: "-", min: 0, max: 3, step: 1, group: "Sizing" },
      ...extraParams,
    ],
    defaults: {
      filtrationRate: d.rate, bedDepth: 1.2, backwashPct: d.bw,
      tssRemoval: d.tss, standby: 1, ...extraDefaults,
    },
    solve: (inlet, p) => {
      const removal: Partial<Record<Component, number>> = {
        TSS: n(p, "tssRemoval", d.tss) / 100,
        Fe: 0.6, Mn: 0.4,
      };
      if (type === "acf") {
        const tocRem = n(p, "tocRemoval", 55) / 100;
        removal.TOC = tocRem;
        removal.COD = tocRem * 0.8;
        removal.BOD = tocRem * 0.7;
        removal.Oil = 0.8;
      }
      const { product, side } = removeToSideStream(inlet, n(p, "backwashPct", d.bw) / 100, removal);
      product.extras.turbidityNTU = Math.max(
        inlet.extras.turbidityNTU * (1 - n(p, "tssRemoval", d.tss) / 100), 0.1,
      );
      product.extras.sdi15 = Math.min(inlet.extras.sdi15, type === "acf" ? 3.5 : 4.5);
      const area = inlet.flow / Math.max(n(p, "filtrationRate", d.rate), 0.1);
      const nUnits = Math.max(2, Math.ceil(area / 12)) + n(p, "standby", 1);
      const chem: Record<string, number> = {};
      const notes: string[] = [];
      if (type === "acf") {
        const ebct = (n(p, "bedDepth", 1.2) / Math.max(n(p, "filtrationRate", d.rate), 0.1)) * 60;
        notes.push(`Empty bed contact time ${ebct.toFixed(1)} min.`);
        if (ebct < 6) notes.push("EBCT below 6 min: dechlorination may be incomplete, verify with SMBS backup dosing.");
      }
      return {
        outlets: { out: product, backwash: side },
        aux: aux({
          powerKW: pumpKW(inlet.flow, 12, 0.72) + 0.004 * inlet.flow,
          chemicals: chem,
          sizing: [
            { label: "Total filtration area", value: `${area.toFixed(1)} m2` },
            { label: "Units", value: `${nUnits} (incl. ${n(p, "standby", 1)} standby)` },
            { label: "Media volume", value: `${(area * n(p, "bedDepth", 1.2)).toFixed(1)} m3` },
          ],
          capexUSD: costCurve(area, d.capex, 0.72),
          notes,
        }),
      };
    },
  };
}

const mmf = granularFilter("mmf", "Multimedia Filter", "MMF",
  { rate: 10, bw: 3, tss: 80, capex: 5200 });

const acf = granularFilter("acf", "Activated Carbon Filter", "ACF",
  { rate: 10, bw: 2, tss: 40, capex: 6000 },
  [{ key: "tocRemoval", label: "TOC removal", type: "number", unit: "%", min: 20, max: 90, step: 1, group: "Performance",
     help: "Also removes free chlorine, protecting downstream polyamide membranes." }],
  { tocRemoval: 55, bedDepth: 1.5 });

const cartridge: UnitModel = {
  type: "cartridge", label: "Cartridge Filter", short: "CF",
  category: "pretreatment", inlets: 1, outlets: ["out"],
  description:
    "Final particulate guard ahead of a membrane. Acts as the earliest warning of upstream upset through rising differential pressure.",
  ccepcMaturity: 5,
  params: [
    { key: "micron", label: "Rating", type: "number", unit: "um", min: 1, max: 25, step: 1, group: "Performance" },
    { key: "flowPerElement", label: "Flow per 40 in element", type: "number", unit: "m3/h", min: 1, max: 5, step: 0.1, group: "Sizing" },
  ],
  defaults: { micron: 5, flowPerElement: 2.3 },
  solve: (inlet, p) => {
    const out = cloneStream(inlet);
    out.c.TSS *= 0.5;
    out.extras.sdi15 = Math.max(0, inlet.extras.sdi15 - 0.5);
    const els = Math.ceil(inlet.flow / Math.max(n(p, "flowPerElement", 2.3), 0.1));
    return {
      outlets: { out },
      aux: aux({
        powerKW: 0,
        sizing: [{ label: "Elements", value: `${els} x 40 in, ${n(p, "micron", 5)} um` }],
        capexUSD: costCurve(inlet.flow, 380, 0.6),
      }),
    };
  },
};

/* ================================================================= MEMBRANES */

const UF_REJ: Partial<Record<Component, number>> = {
  TSS: 0.995, Fe: 0.8, Mn: 0.5, TOC: 0.25, COD: 0.2, BOD: 0.15, Oil: 0.9,
};

const uf: UnitModel = {
  type: "uf", label: "Ultrafiltration", short: "UF",
  category: "membrane", inlets: 1, outlets: ["out", "backwash"],
  description:
    "Pressurised hollow-fibre UF, 0.01-0.1 um, dead-end with air scour, periodic backwash and chemically enhanced backwash. Delivers a consistently low SDI regardless of upstream fluctuation, which is what makes high RO recovery dependable.",
  ccepcMaturity: 5,
  params: [
    { key: "flux", label: "Design flux", type: "number", unit: "LMH", min: 30, max: 110, step: 1, group: "Sizing" },
    { key: "moduleArea", label: "Membrane area per module", type: "number", unit: "m2", min: 20, max: 100, step: 1, group: "Sizing" },
    { key: "recovery", label: "Net recovery", type: "number", unit: "%", min: 85, max: 99, step: 0.5, group: "Performance",
      help: "Accounts for backwash and CEB losses. Backwash reports as a side stream that can be recycled." },
    { key: "tmpBar", label: "Trans-membrane pressure", type: "number", unit: "bar", min: 0.3, max: 3, step: 0.1, group: "Hydraulics" },
    { key: "dutyTrains", label: "Duty trains", type: "number", unit: "-", min: 1, max: 12, step: 1, group: "Sizing" },
    { key: "standbyTrains", label: "Standby trains", type: "number", unit: "-", min: 0, max: 3, step: 1, group: "Sizing" },
    { key: "cebNaOCl", label: "CEB hypochlorite", type: "number", unit: "kg/h", min: 0, max: 2, step: 0.01, group: "Chemicals" },
    { key: "cebAcid", label: "CEB acid", type: "number", unit: "kg/h", min: 0, max: 2, step: 0.01, group: "Chemicals" },
  ],
  defaults: {
    flux: 65, moduleArea: 60, recovery: 95, tmpBar: 1.0,
    dutyTrains: 4, standbyTrains: 1, cebNaOCl: 0.15, cebAcid: 0.1,
  },
  solve: (inlet, p) => {
    const Y = clamp(n(p, "recovery", 95) / 100, 0.5, 0.999);
    const { product, side } = removeToSideStream(inlet, 1 - Y, UF_REJ);
    product.extras.turbidityNTU = Math.min(inlet.extras.turbidityNTU, 0.08);
    product.extras.sdi15 = Math.min(inlet.extras.sdi15, 2.5);
    product.extras.coliform = 0;
    const areaDuty = (product.flow * 1000) / Math.max(n(p, "flux", 65), 1);
    const duty = Math.max(1, n(p, "dutyTrains", 4));
    const modulesPerTrain = Math.ceil(areaDuty / n(p, "moduleArea", 60) / duty);
    const total = modulesPerTrain * (duty + n(p, "standbyTrains", 1));
    return {
      outlets: { out: product, backwash: side },
      aux: aux({
        powerKW:
          pumpKW(inlet.flow, n(p, "tmpBar", 1.0) * 10.2 + 8, 0.72) +
          0.03 * inlet.flow + 5,
        chemicals: {
          "Sodium hypochlorite (UF CEB)": n(p, "cebNaOCl", 0.15),
          "Hydrochloric acid (UF CEB)": n(p, "cebAcid", 0.1),
        },
        sizing: [
          { label: "Duty membrane area", value: `${areaDuty.toFixed(0)} m2` },
          { label: "Configuration", value: `${duty} duty + ${n(p, "standbyTrains", 1)} standby x ${modulesPerTrain} modules` },
          { label: "Modules installed", value: `${total}` },
          { label: "Design flux", value: `${n(p, "flux", 65)} LMH` },
        ],
        capexUSD: costCurve(areaDuty, 190, 0.85),
        notes:
          inlet.extras.turbidityNTU > 50
            ? ["Feed turbidity above 50 NTU: derate flux or confirm upstream clarification."]
            : [],
      }),
    };
  },
};

/**
 * NF rejections calibrated against the CCEPC Gresik Water & Salt Balance
 * Diagram (Attached Drawing 2-001): NF passes Na and Cl while rejecting Ca, Mg
 * and SO4, which is what makes the downstream salt separation work.
 */
const NF_REJ: Partial<Record<Component, number>> = {
  Na: 0.47, K: 0.47, NH4: 0.40, Cl: 0.44, NO3: 0.50,
  Ca: 0.855, Mg: 0.946, SO4: 0.974, HCO3: 0.75, CO3: 0.90,
  SiO2: 0.50, F: 0.60, Fe: 0.95, Mn: 0.90, Ba: 0.95, Sr: 0.95,
  TDS: 0.506, TSS: 0.99, TOC: 0.90, COD: 0.85, BOD: 0.8, TN: 0.5, TP: 0.95, Oil: 0.95,
};

const RO_REJ_BW: Partial<Record<Component, number>> = {
  Na: 0.985, K: 0.98, NH4: 0.90, Cl: 0.985, NO3: 0.92,
  Ca: 0.995, Mg: 0.995, SO4: 0.996, HCO3: 0.95, CO3: 0.98,
  SiO2: 0.97, F: 0.94, Fe: 0.99, Mn: 0.98, Ba: 0.99, Sr: 0.99,
  TDS: 0.975, TSS: 0.99, TOC: 0.95, COD: 0.93, BOD: 0.9, TN: 0.9, TP: 0.98, Oil: 0.98,
};

const RO_REJ_SW: Partial<Record<Component, number>> = {
  Na: 0.995, K: 0.993, NH4: 0.94, Cl: 0.995, NO3: 0.96,
  Ca: 0.998, Mg: 0.998, SO4: 0.999, HCO3: 0.98, CO3: 0.99,
  SiO2: 0.99, F: 0.97, Fe: 0.998, Mn: 0.995, Ba: 0.998, Sr: 0.998,
  TDS: 0.995, TSS: 0.995, TOC: 0.98, COD: 0.96, BOD: 0.95, TN: 0.95, TP: 0.99, Oil: 0.99,
};

function membraneUnit(
  type: string, label: string, short: string,
  baseRej: Partial<Record<Component, number>>,
  d: { recovery: number; flux: number; pressure: number; maturity: number },
  note: string,
): UnitModel {
  return {
    type, label, short, category: "membrane", inlets: 1, outlets: ["permeate", "concentrate"],
    description: note,
    ccepcMaturity: d.maturity,
    params: [
      { key: "recovery", label: "Recovery", type: "number", unit: "%", min: 30, max: 95, step: 0.5, group: "Performance",
        help: "Permeate flow divided by feed flow. Drives concentrate concentration and scaling risk." },
      { key: "flux", label: "Design flux", type: "number", unit: "LMH", min: 8, max: 35, step: 0.5, group: "Sizing" },
      { key: "elementArea", label: "Area per element", type: "number", unit: "m2", min: 25, max: 45, step: 0.1, group: "Sizing" },
      { key: "elementsPerVessel", label: "Elements per vessel", type: "number", unit: "-", min: 1, max: 8, step: 1, group: "Sizing" },
      { key: "trains", label: "Parallel trains", type: "number", unit: "-", min: 1, max: 8, step: 1, group: "Sizing" },
      { key: "feedPressureBar", label: "Feed pressure", type: "number", unit: "bar", min: 5, max: 120, step: 1, group: "Hydraulics",
        help: "Leave at 0 to let the model estimate it from osmotic pressure plus net driving pressure." },
      { key: "pumpEff", label: "HP pump efficiency", type: "number", unit: "-", min: 0.5, max: 0.88, step: 0.01, group: "Hydraulics" },
      { key: "erd", label: "Energy recovery device", type: "boolean", group: "Hydraulics",
        help: "Recovers pressure from the concentrate. Worthwhile on seawater duty, rarely on brackish." },
      { key: "antiscalantDose", label: "Antiscalant dose", type: "number", unit: "mg/L", min: 0, max: 10, step: 0.5, group: "Chemicals" },
      { key: "smbsDose", label: "SMBS dose", type: "number", unit: "mg/L", min: 0, max: 10, step: 0.5, group: "Chemicals" },
      { key: "rejectionScale", label: "Rejection adjustment", type: "number", unit: "x", min: 0.9, max: 1.02, step: 0.005, group: "Performance",
        help: "Scales every ion rejection. Use to match a vendor projection or an aged membrane." },
    ],
    defaults: {
      recovery: d.recovery, flux: d.flux, elementArea: 37.2, elementsPerVessel: 6,
      trains: 2, feedPressureBar: 0, pumpEff: 0.75, erd: false,
      antiscalantDose: 3, smbsDose: 0, rejectionScale: 1,
    },
    solve: (inlet, p) => {
      const Y = clamp(n(p, "recovery", d.recovery) / 100, 0.05, 0.95);
      const scale = clamp(n(p, "rejectionScale", 1), 0.5, 1.02);
      const rej: Partial<Record<Component, number>> = {};
      for (const [k, v] of Object.entries(baseRej)) {
        rej[k as Component] = clamp(v * scale, 0, 0.9999);
      }
      const { product, reject } = splitByRejection(inlet, Y, rej, 0.9);
      const permeate = product;
      const concentrate = reject;
      // Carbon dioxide passes a membrane freely, so permeate pH falls.
      permeate.pH = clamp(inlet.pH - 1.0, 4.5, 8.5);
      permeate.extras.sdi15 = 0;
      permeate.extras.turbidityNTU = 0.02;

      const osmFeed = osmoticPressureBar(inlet);
      const osmConc = osmoticPressureBar(concentrate);
      const ndp = 2.5;
      const estPressure = (osmFeed + osmConc) / 2 + ndp + 1.5;
      const pressure = n(p, "feedPressureBar", 0) > 0 ? n(p, "feedPressureBar", 0) : estPressure;
      let kw = pumpKW(inlet.flow, pressure * 10.2, n(p, "pumpEff", 0.75));
      if (b(p, "erd")) kw *= 1 - 0.55 * (1 - Y);

      const area = (permeate.flow * 1000) / Math.max(n(p, "flux", d.flux), 1);
      const elements = Math.ceil(area / n(p, "elementArea", 37.2));
      const vessels = Math.ceil(elements / Math.max(n(p, "elementsPerVessel", 6), 1));
      const actualFlux = (permeate.flow * 1000) / Math.max(elements * n(p, "elementArea", 37.2), 1);

      const notes: string[] = [];
      const lsiRisk = hardnessAsCaCO3(concentrate);
      if (lsiRisk > 900 && n(p, "antiscalantDose", 3) < 2) {
        notes.push(`Concentrate hardness ${lsiRisk.toFixed(0)} mg/L as CaCO3 with little antiscalant: calcium carbonate scaling risk.`);
      }
      if (pressure > 83) notes.push(`Estimated feed pressure ${pressure.toFixed(0)} bar exceeds standard 83 bar membrane rating.`);
      if (inlet.extras.sdi15 > 3) notes.push(`Feed SDI15 ${inlet.extras.sdi15.toFixed(1)} exceeds the usual limit of 3 for RO.`);

      return {
        outlets: { permeate, concentrate },
        aux: aux({
          powerKW: kw,
          chemicals: {
            Antiscalant: (n(p, "antiscalantDose", 3) * inlet.flow) / 1000,
            "Sodium metabisulphite": (n(p, "smbsDose", 0) * inlet.flow) / 1000,
          },
          sizing: [
            { label: "Membrane area", value: `${area.toFixed(0)} m2` },
            { label: "Elements / vessels", value: `${elements} elements in ${vessels} vessels` },
            { label: "Trains", value: `${n(p, "trains", 2)} x ${(100 / Math.max(n(p, "trains", 2), 1)).toFixed(0)} %` },
            { label: "Actual flux", value: `${actualFlux.toFixed(1)} LMH` },
            { label: "Feed pressure", value: `${pressure.toFixed(1)} bar${n(p, "feedPressureBar", 0) > 0 ? " (user)" : " (estimated)"}` },
            { label: "Specific energy", value: `${(kw / Math.max(permeate.flow, 0.01)).toFixed(3)} kWh/m3 permeate` },
          ],
          capexUSD: costCurve(area, 210, 0.86) + costCurve(inlet.flow, 1600, 0.7),
          notes,
        }),
      };
    },
  };
}

const nf = membraneUnit("nf", "Nanofiltration", "NF", NF_REJ,
  { recovery: 77, flux: 20, pressure: 0, maturity: 5 },
  "Nanofiltration for salt separation: passes sodium and chloride while rejecting calcium, magnesium and sulphate. Rejections calibrated against the CCEPC Gresik salt balance.");

const roBW = membraneUnit("ro", "Reverse Osmosis (brackish)", "RO", RO_REJ_BW,
  { recovery: 75, flux: 18, pressure: 0, maturity: 5 },
  "Brackish-water RO. Removes hardness, dissolved solids, silica and organics in one step. Permeate pH falls because carbon dioxide passes the membrane.");

const roSW = membraneUnit("swro", "Reverse Osmosis (sea / high pressure)", "HPRO", RO_REJ_SW,
  { recovery: 45, flux: 14, pressure: 0, maturity: 5 },
  "Seawater or high-pressure RO for desalination and brine concentration. Energy recovery is normally justified at this salinity.");

/* ================================================================= POLISHING */

const edi: UnitModel = {
  type: "edi", label: "Electrodeionisation", short: "EDI",
  category: "ionexchange", inlets: 1, outlets: ["product", "concentrate"],
  description:
    "Continuous electrical regeneration of mixed resin. No acid or caustic regeneration, no regenerant effluent, no neutralisation pit, and no drift in product quality between regenerations. Feed hardness must be below about 1 mg/L as CaCO3.",
  ccepcMaturity: 4,
  params: [
    { key: "recovery", label: "Recovery", type: "number", unit: "%", min: 85, max: 98, step: 0.5, group: "Performance" },
    { key: "productResistivity", label: "Target resistivity", type: "number", unit: "MOhm.cm", min: 1, max: 18, step: 0.5, group: "Performance" },
    { key: "specificEnergy", label: "DC energy", type: "number", unit: "kWh/m3", min: 0.05, max: 0.6, step: 0.01, group: "Hydraulics" },
    { key: "moduleCapacity", label: "Capacity per module", type: "number", unit: "m3/h", min: 2, max: 20, step: 0.5, group: "Sizing" },
    { key: "trains", label: "Parallel skids", type: "number", unit: "-", min: 1, max: 6, step: 1, group: "Sizing" },
    { key: "hardnessLimit", label: "Feed hardness limit", type: "number", unit: "mg/L CaCO3", min: 0.1, max: 2, step: 0.1, group: "Performance" },
  ],
  defaults: {
    recovery: 95, productResistivity: 16, specificEnergy: 0.15,
    moduleCapacity: 7, trains: 2, hardnessLimit: 1.0,
  },
  solve: (inlet, p) => {
    const Y = clamp(n(p, "recovery", 95) / 100, 0.7, 0.99);
    const rej: Partial<Record<Component, number>> = {};
    for (const k of Object.keys(RO_REJ_BW) as Component[]) rej[k] = 0.995;
    rej.SiO2 = 0.99;
    rej.TDS = 0.995;
    const { product, reject } = splitByRejection(inlet, Y, rej, 0.99);
    product.pH = 7.0;
    const hard = hardnessAsCaCO3(inlet);
    const notes: string[] = [];
    const limit = n(p, "hardnessLimit", 1.0);
    if (hard > limit) {
      notes.push(
        `Feed hardness ${hard.toFixed(3)} mg/L as CaCO3 exceeds the ${limit} mg/L limit. Hardness fouling is the principal EDI failure mode: add a second RO pass or a softener upstream.`,
      );
    }
    if (inlet.c.TOC > 0.5) notes.push(`Feed TOC ${inlet.c.TOC.toFixed(2)} mg/L exceeds the usual 0.5 mg/L guideline.`);
    const mods = Math.ceil(product.flow / Math.max(n(p, "moduleCapacity", 7), 0.1));
    return {
      outlets: { product, concentrate: reject },
      aux: aux({
        powerKW: n(p, "specificEnergy", 0.15) * product.flow + pumpKW(inlet.flow, 30, 0.72),
        sizing: [
          { label: "Modules", value: `${mods} across ${n(p, "trains", 2)} skids` },
          { label: "Product", value: `${product.flow.toFixed(2)} m3/h` },
          { label: "Target quality", value: `${n(p, "productResistivity", 16)} MOhm.cm (< ${(1 / n(p, "productResistivity", 16)).toFixed(3)} uS/cm)` },
        ],
        capexUSD: costCurve(product.flow, 5200, 0.8),
        notes,
      }),
    };
  },
};

const mixedBed: UnitModel = {
  type: "mixedbed", label: "Mixed Bed Polisher", short: "MB",
  category: "ionexchange", inlets: 1, outlets: ["product", "regenwaste"],
  description:
    "Intimately mixed strong-acid cation and strong-base anion resin. Lower capital cost than EDI but requires acid and caustic regeneration, a neutralisation pit and operator attention.",
  ccepcMaturity: 5,
  params: [
    { key: "recovery", label: "Recovery", type: "number", unit: "%", min: 90, max: 99.5, step: 0.1, group: "Performance" },
    { key: "resinVolume", label: "Resin volume per vessel", type: "number", unit: "m3", min: 0.2, max: 10, step: 0.1, group: "Sizing" },
    { key: "serviceVelocity", label: "Service velocity", type: "number", unit: "m/h", min: 10, max: 60, step: 1, group: "Sizing" },
    { key: "hclPerRegen", label: "HCl per regeneration", type: "number", unit: "kg", min: 0, max: 500, step: 1, group: "Chemicals" },
    { key: "naohPerRegen", label: "NaOH per regeneration", type: "number", unit: "kg", min: 0, max: 500, step: 1, group: "Chemicals" },
    { key: "runLengthH", label: "Run length between regenerations", type: "number", unit: "h", min: 8, max: 1000, step: 1, group: "Chemicals" },
  ],
  defaults: {
    recovery: 98, resinVolume: 1.5, serviceVelocity: 30,
    hclPerRegen: 62, naohPerRegen: 62, runLengthH: 300,
  },
  solve: (inlet, p) => {
    const Y = clamp(n(p, "recovery", 98) / 100, 0.8, 0.999);
    const rej: Partial<Record<Component, number>> = {};
    for (const k of Object.keys(RO_REJ_BW) as Component[]) rej[k] = 0.99;
    rej.TDS = 0.99;
    const { product, reject } = splitByRejection(inlet, Y, rej, 0.98);
    product.pH = 7.0;
    const run = Math.max(n(p, "runLengthH", 300), 1);
    return {
      outlets: { product, regenwaste: reject },
      aux: aux({
        powerKW: pumpKW(inlet.flow, 25, 0.72),
        chemicals: {
          "Hydrochloric acid (regeneration)": n(p, "hclPerRegen", 62) / run,
          "Caustic soda (regeneration)": n(p, "naohPerRegen", 62) / run,
        },
        sizing: [
          { label: "Vessels", value: `2 x 100 % (1 duty, 1 regenerating)` },
          { label: "Resin volume", value: `${n(p, "resinVolume", 1.5)} m3 per vessel` },
          { label: "Run length", value: `${run.toFixed(0)} h between regenerations` },
        ],
        capexUSD: costCurve(inlet.flow, 2400, 0.72),
        notes: ["Regenerant is acidic then alkaline: a neutralisation pit is mandatory."],
      }),
    };
  },
};

const softener: UnitModel = {
  type: "softener", label: "Sodium Ion Exchange Softener", short: "SOFT",
  category: "ionexchange", inlets: 1, outlets: ["product", "brine"],
  description:
    "Exchanges calcium and magnesium for sodium. Removes hardness without removing TDS, so it cannot on its own make boiler feed water.",
  ccepcMaturity: 5,
  params: [
    { key: "recovery", label: "Recovery", type: "number", unit: "%", min: 90, max: 99, step: 0.5, group: "Performance" },
    { key: "hardnessRemoval", label: "Hardness removal", type: "number", unit: "%", min: 80, max: 99.9, step: 0.1, group: "Performance" },
    { key: "saltPerEq", label: "Salt per equivalent", type: "number", unit: "g NaCl/eq", min: 80, max: 200, step: 5, group: "Chemicals" },
  ],
  defaults: { recovery: 97, hardnessRemoval: 99, saltPerEq: 110 },
  solve: (inlet, p) => {
    const Y = clamp(n(p, "recovery", 97) / 100, 0.8, 0.995);
    const rem = n(p, "hardnessRemoval", 99) / 100;
    const { product, side } = removeToSideStream(inlet, 1 - Y, {
      Ca: rem, Mg: rem, Ba: rem, Sr: rem, Fe: rem * 0.9, Mn: rem * 0.9,
    });
    // Sodium replaces the removed hardness on an equivalent basis.
    const eqRemoved = (inlet.c.Ca / 20.04 + inlet.c.Mg / 12.15) * rem;
    product.c.Na += eqRemoved * 22.99;
    const eqPerH = (eqRemoved * inlet.flow) / 1000; // keq/h
    return {
      outlets: { product, brine: side },
      aux: aux({
        powerKW: pumpKW(inlet.flow, 20, 0.72),
        chemicals: { "Sodium chloride (regeneration)": eqPerH * n(p, "saltPerEq", 110) },
        sizing: [
          { label: "Hardness removed", value: `${(eqRemoved * 50).toFixed(1)} mg/L as CaCO3` },
          { label: "Salt consumption", value: `${(eqPerH * n(p, "saltPerEq", 110)).toFixed(1)} kg/h NaCl` },
        ],
        capexUSD: costCurve(inlet.flow, 1900, 0.7),
        notes: ["Produces a saline regeneration brine which counts against overall recovery."],
      }),
    };
  },
};

const degasser: UnitModel = {
  type: "degasser", label: "Degasser / Decarbonator", short: "DEG",
  category: "pretreatment", inlets: 1, outlets: ["out"],
  description:
    "Forced-draught tower stripping free carbon dioxide. Reduces the anion load on downstream ion exchange or EDI at the cost of a blower only.",
  ccepcMaturity: 5,
  params: [
    { key: "co2Removal", label: "CO2 removal", type: "number", unit: "%", min: 50, max: 99, step: 1, group: "Performance" },
    { key: "airRatio", label: "Air-to-water ratio", type: "number", unit: "m3/m3", min: 20, max: 120, step: 5, group: "Hydraulics" },
  ],
  defaults: { co2Removal: 90, airRatio: 60 },
  solve: (inlet, p) => {
    const out = cloneStream(inlet);
    const rem = n(p, "co2Removal", 90) / 100;
    out.c.HCO3 *= 1 - rem * 0.6;
    out.pH = clamp(inlet.pH + 1.2 * rem, 4, 9);
    return {
      outlets: { out },
      aux: aux({
        powerKW: 0.0004 * inlet.flow * n(p, "airRatio", 60) + 2,
        sizing: [{ label: "Air flow", value: `${(inlet.flow * n(p, "airRatio", 60)).toFixed(0)} m3/h` }],
        capexUSD: costCurve(inlet.flow, 900, 0.68),
      }),
    };
  },
};

const chemSoftening: UnitModel = {
  type: "chemsoft", label: "Chemical Softening (dual alkali)", short: "CSOFT",
  category: "pretreatment", inlets: 1, outlets: ["out", "sludge"],
  description:
    "Na2CO3 / NaOH / MgO dosing to precipitate calcium and magnesium ahead of evaporation. CCEPC uses this with a ceramic membrane at Gresik.",
  ccepcMaturity: 4,
  params: [
    { key: "caRemoval", label: "Ca removal", type: "number", unit: "%", min: 70, max: 99.9, step: 0.1, group: "Performance" },
    { key: "mgRemoval", label: "Mg removal", type: "number", unit: "%", min: 70, max: 99.9, step: 0.1, group: "Performance" },
    { key: "reactionMin", label: "Reaction time", type: "number", unit: "min", min: 10, max: 120, step: 5, group: "Sizing" },
    { key: "sludgePct", label: "Sludge draw", type: "number", unit: "% of feed", min: 0.5, max: 10, step: 0.1, group: "Performance" },
    { key: "na2co3Stoich", label: "Na2CO3 stoichiometric factor", type: "number", unit: "x", min: 1, max: 2, step: 0.05, group: "Chemicals" },
  ],
  defaults: { caRemoval: 98, mgRemoval: 97, reactionMin: 45, sludgePct: 3, na2co3Stoich: 1.15 },
  solve: (inlet, p) => {
    const caR = n(p, "caRemoval", 98) / 100;
    const mgR = n(p, "mgRemoval", 97) / 100;
    const { product, side } = removeToSideStream(inlet, n(p, "sludgePct", 3) / 100, {
      Ca: caR, Mg: mgR, Ba: 0.95, Sr: 0.95, SiO2: 0.4,
    });
    product.pH = 10.2;
    const caEq = (inlet.c.Ca / 20.04) * caR * inlet.flow / 1000; // keq/h
    const mgEq = (inlet.c.Mg / 12.15) * mgR * inlet.flow / 1000;
    const ds = ((inlet.c.Ca * caR * 2.5 + inlet.c.Mg * mgR * 2.4) * inlet.flow) / 1000;
    return {
      outlets: { out: product, sludge: side },
      aux: aux({
        powerKW: 0.02 * inlet.flow + 4,
        chemicals: {
          "Sodium carbonate": caEq * 53 * n(p, "na2co3Stoich", 1.15),
          "Caustic soda (softening)": mgEq * 40 * 1.1,
        },
        drySolidsKgH: ds,
        hrtH: n(p, "reactionMin", 45) / 60,
        sizing: [
          { label: "Reaction volume", value: `${((inlet.flow / 60) * n(p, "reactionMin", 45)).toFixed(0)} m3` },
          { label: "Precipitate", value: `${ds.toFixed(1)} kg/h dry solids` },
        ],
        capexUSD: costCurve(inlet.flow, 2100, 0.7),
      }),
    };
  },
};

const ceramicMF: UnitModel = {
  type: "ceramicmf", label: "Ceramic Membrane Filter", short: "CMF",
  category: "membrane", inlets: 1, outlets: ["permeate", "concentrate"],
  description:
    "Ceramic microfiltration downstream of chemical softening. Tolerates high salinity, high solids and aggressive cleaning where polymeric membranes would fail.",
  ccepcMaturity: 4,
  params: [
    { key: "recovery", label: "Recovery", type: "number", unit: "%", min: 80, max: 99, step: 0.5, group: "Performance" },
    { key: "flux", label: "Design flux", type: "number", unit: "LMH", min: 50, max: 300, step: 5, group: "Sizing" },
    { key: "tssRemoval", label: "TSS removal", type: "number", unit: "%", min: 95, max: 99.99, step: 0.01, group: "Performance" },
  ],
  defaults: { recovery: 95, flux: 150, tssRemoval: 99.5 },
  solve: (inlet, p) => {
    const Y = clamp(n(p, "recovery", 95) / 100, 0.6, 0.99);
    const { product, side } = removeToSideStream(inlet, 1 - Y, {
      TSS: n(p, "tssRemoval", 99.5) / 100, Fe: 0.95, Mn: 0.9, Ca: 0.1, Mg: 0.1,
    });
    product.extras.turbidityNTU = 0.05;
    const area = (product.flow * 1000) / Math.max(n(p, "flux", 150), 1);
    return {
      outlets: { permeate: product, concentrate: side },
      aux: aux({
        powerKW: pumpKW(inlet.flow, 35, 0.72) + 0.04 * inlet.flow,
        sizing: [
          { label: "Membrane area", value: `${area.toFixed(0)} m2` },
          { label: "Design flux", value: `${n(p, "flux", 150)} LMH` },
        ],
        capexUSD: costCurve(area, 900, 0.85),
      }),
    };
  },
};

/* ================================================================= BIOLOGICAL */

function bioUnit(
  type: string, label: string, short: string,
  d: { hrt: number; bod: number; cod: number; tn: number; tp: number; nh4: number; maturity: number },
  note: string,
): UnitModel {
  return {
    type, label, short, category: "biological", inlets: 1, outlets: ["out", "was"],
    description: note,
    ccepcMaturity: d.maturity,
    params: [
      { key: "hrtH", label: "Total HRT", type: "number", unit: "h", min: 2, max: 72, step: 0.5, group: "Sizing" },
      { key: "mlss", label: "MLSS", type: "number", unit: "mg/L", min: 1500, max: 12000, step: 100, group: "Sizing" },
      { key: "srtD", label: "Sludge age (SRT)", type: "number", unit: "d", min: 3, max: 40, step: 1, group: "Sizing" },
      { key: "bodRemoval", label: "BOD removal", type: "number", unit: "%", min: 70, max: 99.5, step: 0.5, group: "Performance" },
      { key: "codRemoval", label: "COD removal", type: "number", unit: "%", min: 60, max: 98, step: 0.5, group: "Performance" },
      { key: "tnRemoval", label: "TN removal", type: "number", unit: "%", min: 0, max: 95, step: 1, group: "Performance" },
      { key: "tpRemoval", label: "TP removal", type: "number", unit: "%", min: 0, max: 98, step: 1, group: "Performance" },
      { key: "nh4Removal", label: "Ammonia removal", type: "number", unit: "%", min: 0, max: 99.5, step: 0.5, group: "Performance" },
      { key: "aeUp", label: "Aeration efficiency", type: "number", unit: "kgO2/kWh", min: 0.8, max: 4, step: 0.1, group: "Hydraulics" },
      { key: "wasPct", label: "Waste sludge draw", type: "number", unit: "% of feed", min: 0.2, max: 8, step: 0.1, group: "Performance" },
      { key: "yieldCoef", label: "Sludge yield", type: "number", unit: "kgVSS/kgBOD", min: 0.2, max: 0.9, step: 0.05, group: "Performance" },
      { key: "carbonDose", label: "External carbon", type: "number", unit: "mg/L", min: 0, max: 200, step: 5, group: "Chemicals" },
    ],
    defaults: {
      hrtH: d.hrt, mlss: 4000, srtD: 15, bodRemoval: d.bod, codRemoval: d.cod,
      tnRemoval: d.tn, tpRemoval: d.tp, nh4Removal: d.nh4, aeUp: 2.0,
      wasPct: 1.5, yieldCoef: 0.45, carbonDose: 0,
    },
    solve: (inlet, p) => {
      const { product, side } = removeToSideStream(inlet, n(p, "wasPct", 1.5) / 100, {
        BOD: n(p, "bodRemoval", d.bod) / 100,
        COD: n(p, "codRemoval", d.cod) / 100,
        TOC: n(p, "codRemoval", d.cod) / 100,
        TN: n(p, "tnRemoval", d.tn) / 100,
        TP: n(p, "tpRemoval", d.tp) / 100,
        NH4: n(p, "nh4Removal", d.nh4) / 100,
        TSS: 0.6, Oil: 0.8,
      });
      product.extras.coliform = inlet.extras.coliform * 0.05;
      const bodLoadKgH = (inlet.flow * inlet.c.BOD * (n(p, "bodRemoval", d.bod) / 100)) / 1000;
      const o2KgH = bodLoadKgH * 1.2 +
        ((inlet.flow * inlet.c.NH4 * (n(p, "nh4Removal", d.nh4) / 100)) / 1000) * 4.57;
      const aerKW = o2KgH / Math.max(n(p, "aeUp", 2.0), 0.1);
      const vol = inlet.flow * n(p, "hrtH", d.hrt);
      const wasKgH = bodLoadKgH * n(p, "yieldCoef", 0.45);
      const fm = bodLoadKgH * 24 / Math.max((vol * n(p, "mlss", 4000)) / 1000, 0.001);
      const notes: string[] = [];
      if (fm > 0.35) notes.push(`F/M ratio ${fm.toFixed(2)} kgBOD/kgMLSS.d is high; increase volume or MLSS.`);
      if (inlet.c.BOD > 0 && inlet.c.TN > 0) {
        const ratio = inlet.c.BOD / Math.max(inlet.c.TN, 0.01);
        if (ratio < 4 && n(p, "tnRemoval", d.tn) > 60)
          notes.push(`BOD:TN ratio ${ratio.toFixed(1)} is low for the target denitrification; external carbon will be required.`);
      }
      const chem: Record<string, number> = {};
      if (n(p, "carbonDose", 0) > 0)
        chem["External carbon source"] = (n(p, "carbonDose", 0) * inlet.flow) / 1000;
      return {
        outlets: { out: product, was: side },
        aux: aux({
          powerKW: aerKW + 0.01 * inlet.flow + 3,
          chemicals: chem,
          drySolidsKgH: wasKgH,
          hrtH: n(p, "hrtH", d.hrt),
          sizing: [
            { label: "Total reactor volume", value: `${vol.toFixed(0)} m3` },
            { label: "HRT / SRT", value: `${n(p, "hrtH", d.hrt)} h / ${n(p, "srtD", 15)} d` },
            { label: "Oxygen demand", value: `${o2KgH.toFixed(1)} kgO2/h` },
            { label: "Aeration power", value: `${aerKW.toFixed(1)} kW` },
            { label: "F/M ratio", value: `${fm.toFixed(3)} kgBOD/kgMLSS.d` },
            { label: "Waste sludge", value: `${wasKgH.toFixed(1)} kg/h dry solids` },
          ],
          capexUSD: costCurve(vol, 700, 0.72),
          notes,
        }),
      };
    },
  };
}

const aao = bioUnit("aao", "AAO / Modified AAO", "AAO",
  { hrt: 14, bod: 96, cod: 88, tn: 75, tp: 70, nh4: 97, maturity: 5 },
  "Anaerobic-anoxic-oxic activated sludge for combined carbon, nitrogen and phosphorus removal. CCEPC reference: Baoxie WWTP, Wuhan, 70,000 m3/d.");

const msbr = bioUnit("msbr", "MSBR", "MSBR",
  { hrt: 16, bod: 97, cod: 90, tn: 80, tp: 80, nh4: 98, maturity: 5 },
  "Modified sequencing batch reactor. Single-basin nutrient removal with a small footprint. CCEPC reference: Zuoling WWTP, Wuhan, 100,000 m3/d.");

const mbbr = bioUnit("mbbr", "MBBR / IFAS", "MBBR",
  { hrt: 8, bod: 92, cod: 82, tn: 65, tp: 30, nh4: 95, maturity: 4 },
  "Moving-bed biofilm reactor. Compact, resilient to load swings, and well suited to upgrading an existing basin.");

const anaerobicAO = bioUnit("coke-ao", "A/O for Coking Wastewater", "A/O",
  { hrt: 48, bod: 95, cod: 92, tn: 80, tp: 40, nh4: 96, maturity: 5 },
  "Anoxic-oxic biological treatment for high-strength coking wastewater containing phenol, cyanide and thiocyanate. CCEPC reference: Hubei Jinshenglan, 120 m3/h DBO.");

const denitriFilter: UnitModel = {
  type: "denitrifilter", label: "Denitrification Filter", short: "DNF",
  category: "biological", inlets: 1, outlets: ["out", "backwash"],
  description:
    "Fixed-film tertiary denitrification with methanol dosing. Polishes total nitrogen to below 10 mg/L.",
  ccepcMaturity: 5,
  params: [
    { key: "filtrationRate", label: "Filtration rate", type: "number", unit: "m/h", min: 4, max: 15, step: 0.5, group: "Sizing" },
    { key: "tnRemoval", label: "TN removal", type: "number", unit: "%", min: 30, max: 90, step: 1, group: "Performance" },
    { key: "tssRemoval", label: "TSS removal", type: "number", unit: "%", min: 50, max: 95, step: 1, group: "Performance" },
    { key: "backwashPct", label: "Backwash water", type: "number", unit: "% of feed", min: 1, max: 8, step: 0.1, group: "Performance" },
    { key: "carbonRatio", label: "Methanol : NO3-N", type: "number", unit: "kg/kg", min: 2.5, max: 5, step: 0.1, group: "Chemicals" },
  ],
  defaults: { filtrationRate: 8, tnRemoval: 70, tssRemoval: 80, backwashPct: 3, carbonRatio: 3.2 },
  solve: (inlet, p) => {
    const { product, side } = removeToSideStream(inlet, n(p, "backwashPct", 3) / 100, {
      TN: n(p, "tnRemoval", 70) / 100, NO3: n(p, "tnRemoval", 70) / 100,
      TSS: n(p, "tssRemoval", 80) / 100, BOD: 0.4, COD: 0.3,
    });
    const tnRemovedKgH = (inlet.flow * inlet.c.TN * (n(p, "tnRemoval", 70) / 100)) / 1000;
    const area = inlet.flow / Math.max(n(p, "filtrationRate", 8), 0.1);
    return {
      outlets: { out: product, backwash: side },
      aux: aux({
        powerKW: pumpKW(inlet.flow, 10, 0.72) + 0.006 * inlet.flow,
        chemicals: { "Methanol (external carbon)": tnRemovedKgH * n(p, "carbonRatio", 3.2) },
        sizing: [
          { label: "Filter area", value: `${area.toFixed(1)} m2` },
          { label: "TN removed", value: `${tnRemovedKgH.toFixed(2)} kg/h` },
        ],
        capexUSD: costCurve(area, 5000, 0.72),
      }),
    };
  },
};

const disinfection: UnitModel = {
  type: "disinfection", label: "Disinfection", short: "DIS",
  category: "pretreatment", inlets: 1, outlets: ["out"],
  description: "Sodium hypochlorite or UV disinfection with a contact tank.",
  ccepcMaturity: 5,
  params: [
    { key: "method", label: "Method", type: "select", group: "Performance",
      options: [
        { value: "naocl", label: "Sodium hypochlorite" },
        { value: "uv", label: "Ultraviolet" },
      ] },
    { key: "dose", label: "Cl2 dose", type: "number", unit: "mg/L", min: 0, max: 15, step: 0.1, group: "Chemicals" },
    { key: "contactMin", label: "Contact time", type: "number", unit: "min", min: 5, max: 120, step: 5, group: "Sizing" },
  ],
  defaults: { method: "naocl", dose: 2, contactMin: 30 },
  solve: (inlet, p) => {
    const out = cloneStream(inlet);
    out.extras.coliform = 0;
    const chem: Record<string, number> = {};
    let kw = 0;
    if (s(p, "method", "naocl") === "naocl") {
      chem["Sodium hypochlorite (as Cl2)"] = (n(p, "dose", 2) * inlet.flow) / 1000;
    } else {
      kw = 0.02 * inlet.flow + 1;
    }
    const vol = (inlet.flow / 60) * n(p, "contactMin", 30);
    return {
      outlets: { out },
      aux: aux({
        powerKW: kw, chemicals: chem, hrtH: n(p, "contactMin", 30) / 60,
        sizing: [{ label: "Contact volume", value: `${vol.toFixed(1)} m3` }],
        capexUSD: costCurve(inlet.flow, 420, 0.65),
      }),
    };
  },
};

/* ================================================================= SLUDGE / THERMAL */

const thickener: UnitModel = {
  type: "thickener", label: "Sludge Thickener", short: "THK",
  category: "sludge", inlets: 1, outlets: ["thickened", "supernatant"],
  description:
    "Gravity thickener. The supernatant is normally returned to the head of the works, which is one of the cheapest ways to raise overall plant recovery.",
  ccepcMaturity: 5,
  params: [
    { key: "supernatantPct", label: "Supernatant recovered", type: "number", unit: "% of feed", min: 0, max: 90, step: 1, group: "Performance" },
    { key: "solidsCapture", label: "Solids capture", type: "number", unit: "%", min: 80, max: 99, step: 0.5, group: "Performance" },
    { key: "loading", label: "Solids loading", type: "number", unit: "kg/m2.d", min: 20, max: 150, step: 5, group: "Sizing" },
  ],
  defaults: { supernatantPct: 50, solidsCapture: 95, loading: 60 },
  solve: (inlet, p) => {
    const f = clamp(n(p, "supernatantPct", 50) / 100, 0, 0.9);
    const cap = n(p, "solidsCapture", 95) / 100;
    const thickened = cloneStream(inlet);
    const supernatant = cloneStream(inlet);
    thickened.flow = inlet.flow * (1 - f);
    supernatant.flow = inlet.flow * f;
    for (const k of ["TSS", "TP", "Fe", "Mn", "COD", "BOD"] as Component[]) {
      const load = inlet.flow * inlet.c[k];
      const toThick = load * cap;
      thickened.c[k] = thickened.flow > 0 ? toThick / thickened.flow : 0;
      supernatant.c[k] = supernatant.flow > 0 ? (load - toThick) / supernatant.flow : 0;
    }
    const dsKgH = (inlet.flow * inlet.c.TSS) / 1000;
    const area = (dsKgH * 24) / Math.max(n(p, "loading", 60), 1);
    return {
      outlets: { thickened, supernatant },
      aux: aux({
        powerKW: 1.5,
        sizing: [
          { label: "Thickener area", value: `${area.toFixed(1)} m2` },
          { label: "Dry solids", value: `${dsKgH.toFixed(1)} kg/h` },
        ],
        capexUSD: costCurve(Math.max(area, 1), 3800, 0.7),
      }),
    };
  },
};

const dewatering: UnitModel = {
  type: "dewatering", label: "Filter Press / Dewatering", short: "FP",
  category: "sludge", inlets: 1, outlets: ["cake", "filtrate"],
  description:
    "Plate-and-frame filter press or centrifuge. Produces a disposable cake and a filtrate that is normally returned to the head of the works.",
  ccepcMaturity: 5,
  params: [
    { key: "cakeDryness", label: "Cake dryness", type: "number", unit: "% DS", min: 15, max: 45, step: 1, group: "Performance" },
    { key: "solidsCapture", label: "Solids capture", type: "number", unit: "%", min: 85, max: 99.5, step: 0.5, group: "Performance" },
    { key: "polymerDose", label: "Polymer dose", type: "number", unit: "kg/tDS", min: 0, max: 12, step: 0.5, group: "Chemicals" },
  ],
  defaults: { cakeDryness: 30, solidsCapture: 96, loading: 0, polymerDose: 4 },
  solve: (inlet, p) => {
    const dsKgH = (inlet.flow * inlet.c.TSS) / 1000;
    const cap = n(p, "solidsCapture", 96) / 100;
    const cakeDS = dsKgH * cap;
    const cakeMassKgH = cakeDS / Math.max(n(p, "cakeDryness", 30) / 100, 0.05);
    const cakeFlow = cakeMassKgH / 1100; // m3/h at ~1.1 t/m3
    const cake = cloneStream(inlet);
    const filtrate = cloneStream(inlet);
    cake.flow = Math.min(cakeFlow, inlet.flow * 0.9);
    filtrate.flow = inlet.flow - cake.flow;
    for (const k of ["TSS", "TP", "Fe", "COD", "BOD"] as Component[]) {
      const load = inlet.flow * inlet.c[k];
      const toCake = load * cap;
      cake.c[k] = cake.flow > 0 ? toCake / cake.flow : 0;
      filtrate.c[k] = filtrate.flow > 0 ? (load - toCake) / filtrate.flow : 0;
    }
    return {
      outlets: { cake, filtrate },
      aux: aux({
        powerKW: 0.6 + dsKgH * 0.03,
        chemicals: { "Polymer (dewatering)": (dsKgH / 1000) * n(p, "polymerDose", 4) },
        drySolidsKgH: cakeDS,
        sizing: [
          { label: "Cake production", value: `${cakeMassKgH.toFixed(1)} kg/h at ${n(p, "cakeDryness", 30)} % DS` },
          { label: "Dry solids to disposal", value: `${cakeDS.toFixed(1)} kg/h` },
        ],
        capexUSD: costCurve(Math.max(dsKgH, 1), 5200, 0.7),
      }),
    };
  },
};

const mvr: UnitModel = {
  type: "mvr", label: "MVR Evaporator", short: "MVR",
  category: "thermal", inlets: 1, outlets: ["distillate", "concentrate"],
  description:
    "Mechanical vapour recompression evaporator. Concentrates brine toward crystallisation using compressor work rather than live steam. The dominant energy consumer in any ZLD or salt-production train.",
  ccepcMaturity: 4,
  params: [
    { key: "waterEvapPct", label: "Water evaporated", type: "number", unit: "% of feed", min: 30, max: 95, step: 1, group: "Performance" },
    { key: "specificEnergy", label: "Specific energy", type: "number", unit: "kWh/m3 evaporated", min: 8, max: 60, step: 1, group: "Hydraulics" },
    { key: "distillateTDS", label: "Distillate TDS", type: "number", unit: "mg/L", min: 1, max: 200, step: 1, group: "Performance" },
  ],
  defaults: { waterEvapPct: 70, specificEnergy: 25, distillateTDS: 20 },
  solve: (inlet, p) => {
    const evapFrac = clamp(n(p, "waterEvapPct", 70) / 100, 0.05, 0.95);
    const distillate = emptyStream();
    const concentrate = cloneStream(inlet);
    distillate.flow = inlet.flow * evapFrac;
    concentrate.flow = inlet.flow - distillate.flow;
    distillate.T = 60;
    distillate.pH = 7;
    distillate.c.TDS = n(p, "distillateTDS", 20);
    for (const k of ["Na", "Cl"] as Component[]) {
      distillate.c[k] = n(p, "distillateTDS", 20) * 0.4;
    }
    for (const k of Object.keys(inlet.c) as Component[]) {
      const load = inlet.flow * inlet.c[k];
      const toDist = distillate.flow * distillate.c[k];
      concentrate.c[k] = concentrate.flow > 0 ? Math.max(0, load - toDist) / concentrate.flow : 0;
    }
    const kw = distillate.flow * n(p, "specificEnergy", 25);
    return {
      outlets: { distillate, concentrate },
      aux: aux({
        powerKW: kw,
        sizing: [
          { label: "Evaporation duty", value: `${distillate.flow.toFixed(1)} m3/h` },
          { label: "Compressor power", value: `${kw.toFixed(0)} kW` },
          { label: "Concentrate TDS", value: `${concentrate.c.TDS.toFixed(0)} mg/L` },
        ],
        capexUSD: costCurve(Math.max(distillate.flow, 0.1), 42000, 0.72),
        notes: ["Verify scaling and boiling point elevation with a rigorous thermal model before committing."],
      }),
    };
  },
};

const crystalliser: UnitModel = {
  type: "crystalliser", label: "Crystalliser", short: "XTAL",
  category: "thermal", inlets: 1, outlets: ["salt", "mother"],
  description:
    "Forced-circulation crystalliser recovering solid salt. Mother liquor is normally recycled to the evaporator.",
  ccepcMaturity: 4,
  params: [
    { key: "saltRecoveryPct", label: "Salt recovery", type: "number", unit: "%", min: 50, max: 98, step: 1, group: "Performance" },
    { key: "specificEnergy", label: "Specific energy", type: "number", unit: "kWh/t salt", min: 30, max: 300, step: 5, group: "Hydraulics" },
    { key: "motherFlowPct", label: "Mother liquor purge", type: "number", unit: "% of feed", min: 2, max: 40, step: 1, group: "Performance" },
  ],
  defaults: { saltRecoveryPct: 90, specificEnergy: 120, motherFlowPct: 15 },
  solve: (inlet, p) => {
    const rec = n(p, "saltRecoveryPct", 90) / 100;
    const { product: mother, side: salt } = removeToSideStream(
      inlet, n(p, "motherFlowPct", 15) / 100,
      { Na: rec, Cl: rec, TDS: rec, K: rec * 0.5 },
    );
    const saltTPH = (inlet.flow * inlet.c.TDS * rec) / 1e6;
    return {
      outlets: { salt, mother },
      aux: aux({
        powerKW: saltTPH * n(p, "specificEnergy", 120),
        sizing: [
          { label: "Salt production", value: `${saltTPH.toFixed(2)} t/h` },
          { label: "Mother liquor purge", value: `${(inlet.flow * n(p, "motherFlowPct", 15) / 100).toFixed(1)} m3/h` },
        ],
        capexUSD: costCurve(Math.max(saltTPH, 0.05), 260000, 0.7),
      }),
    };
  },
};

/* ================================================================= NETWORK */

const splitter: UnitModel = {
  type: "splitter", label: "Splitter", short: "SPLIT",
  category: "network", inlets: 1, outlets: ["a", "b"],
  description: "Divides a stream on a volumetric fraction with no change in composition. Use it to send part of a stream to recycle.",
  ccepcMaturity: 5,
  params: [
    { key: "fractionA", label: "Fraction to outlet A", type: "number", unit: "%", min: 0, max: 100, step: 0.5, group: "Performance" },
  ],
  defaults: { fractionA: 50 },
  solve: (inlet, p) => {
    const f = clamp(n(p, "fractionA", 50) / 100, 0, 1);
    const a = cloneStream(inlet);
    const bStream = cloneStream(inlet);
    a.flow = inlet.flow * f;
    bStream.flow = inlet.flow * (1 - f);
    return { outlets: { a, b: bStream }, aux: aux() };
  },
};

const pump: UnitModel = {
  type: "pump", label: "Pump", short: "PUMP",
  category: "transport", inlets: 1, outlets: ["out"],
  description: "Transfer or distribution pump. Adds head and therefore power, with no change in composition.",
  ccepcMaturity: 5,
  params: [
    { key: "headM", label: "Head", type: "number", unit: "m", min: 3, max: 200, step: 1, group: "Hydraulics" },
    { key: "pumpEff", label: "Efficiency", type: "number", unit: "-", min: 0.4, max: 0.9, step: 0.01, group: "Hydraulics" },
    { key: "standby", label: "Standby units", type: "number", unit: "-", min: 0, max: 3, step: 1, group: "Sizing" },
  ],
  defaults: { headM: 30, pumpEff: 0.72, standby: 1 },
  solve: (inlet, p) => {
    const kw = pumpKW(inlet.flow, n(p, "headM", 30), n(p, "pumpEff", 0.72));
    return {
      outlets: { out: cloneStream(inlet) },
      aux: aux({
        powerKW: kw,
        sizing: [
          { label: "Duty", value: `${inlet.flow.toFixed(1)} m3/h @ ${n(p, "headM", 30)} m` },
          { label: "Configuration", value: `${1 + n(p, "standby", 1)} x 100 %` },
          { label: "Shaft power", value: `${kw.toFixed(1)} kW` },
        ],
        capexUSD: costCurve(Math.max(kw, 0.5), 1400, 0.7),
      }),
    };
  },
};

/**
 * The raw water itself, as a block you can place and click.
 *
 * The analysis still lives in one place on the flowsheet — there is a single
 * feed specification, not one per node — but putting it on the canvas means the
 * water enters the drawing where it enters the plant, and is edited by clicking
 * the thing it describes rather than by finding a tab. The solver needs no
 * special case: a node with nothing connected to its inlet already receives the
 * plant feed, and this block simply has no inlet at all.
 */
const feedSource: UnitModel = {
  type: "feedsource", label: "Raw Water Feed", short: "FEED",
  category: "intake", inlets: 0, outlets: ["out"],
  description:
    "Where the raw water enters the flowsheet. Click it to edit the water analysis. It removes nothing and costs nothing — it is the drawing's statement of what you are treating.",
  ccepcMaturity: 5,
  params: [],
  defaults: {},
  solve: (inlet) => ({ outlets: { out: cloneStream(inlet) }, aux: aux() }),
};

/**
 * A terminal that needs no configuration.
 *
 * Product and Waste both ask what kind of stream they are, which is the right
 * question on a plant with several products. On a plant with one it is friction.
 * The outfall counts as product in the balance — treated water leaving the works
 * is the works' output, and recovery should include it — and that is stated here
 * rather than left to be discovered.
 */
const outfall: UnitModel = {
  type: "outfall", label: "Outfall / Discharge", short: "OUTFALL",
  category: "network", inlets: 1, outlets: [],
  description:
    "Marks where treated water leaves the plant. No settings: it counts as product in the water balance, so recovery includes it. Use the Waste Outlet block for reject, sludge and backwash instead.",
  ccepcMaturity: 5,
  params: [],
  defaults: {},
  solve: () => ({ outlets: {}, aux: aux() }),
};

/**
 * Abstraction with no screening structure — because on many sites the screen is
 * a separate civil work under someone else's scope, or the source is already
 * screened, and modelling one that is not there overstates the solids removal.
 */
const intakePlain: UnitModel = {
  type: "intake-plain", label: "Intake (no screen)", short: "INTAKE",
  category: "intake", inlets: 1, outlets: ["out"],
  description:
    "Abstraction and lifting only. Nothing is removed. Use this where screening is a separate structure, outside your scope, or already provided — modelling a screen that is not in your scope quietly credits you with solids removal you are not delivering.",
  ccepcMaturity: 5,
  params: [
    { key: "headM", label: "Static + friction head", type: "number", unit: "m", min: 2, max: 200, step: 1, group: "Hydraulics" },
    { key: "pumpEff", label: "Pump efficiency", type: "number", unit: "-", min: 0.4, max: 0.9, step: 0.01, group: "Hydraulics" },
    { key: "standby", label: "Standby pumps", type: "number", unit: "-", min: 0, max: 3, step: 1, group: "Sizing" },
  ],
  defaults: { headM: 25, pumpEff: 0.72, standby: 1 },
  solve: (inlet, p) => {
    const out = cloneStream(inlet);
    const kw = pumpKW(inlet.flow, n(p, "headM", 25), n(p, "pumpEff", 0.72));
    return {
      outlets: { out },
      aux: aux({
        powerKW: kw,
        sizing: [
          { label: "Duty", value: `${inlet.flow.toFixed(1)} m3/h @ ${n(p, "headM", 25)} m` },
          { label: "Configuration", value: `${1 + n(p, "standby", 1)} x 100 %` },
          { label: "Shaft power", value: `${kw.toFixed(1)} kW` },
        ],
        capexUSD: costCurve(Math.max(inlet.flow, 1), 900, 0.7),
        notes: ["No screening is modelled here. If debris can reach the intake, a screen belongs in the scope — and if it belongs to someone else, say so in the proposal."],
      }),
    };
  },
};

const product: UnitModel = {
  type: "product", label: "Product Outlet", short: "PROD",
  category: "network", inlets: 1, outlets: [],
  description: "Terminates a stream as a plant product. Product flows are summed to compute overall recovery.",
  ccepcMaturity: 5,
  params: [
    { key: "name", label: "Product name", type: "select", group: "Identification",
      options: [
        { value: "demin", label: "Demineralised water" },
        { value: "cooling", label: "Cooling tower make-up" },
        { value: "service", label: "Service water" },
        { value: "potable", label: "Potable water" },
        { value: "process", label: "Process water" },
        { value: "salt", label: "Salt product" },
        { value: "reuse", label: "Reuse / recycled water" },
      ] },
  ],
  defaults: { name: "process" },
  solve: () => ({ outlets: {}, aux: aux() }),
};

const waste: UnitModel = {
  type: "waste", label: "Waste Outlet", short: "WASTE",
  category: "network", inlets: 1, outlets: [],
  description: "Terminates a stream as an effluent or solid waste. Waste flows are summed and reported in the effluent table.",
  ccepcMaturity: 5,
  params: [
    { key: "name", label: "Waste description", type: "select", group: "Identification",
      options: [
        { value: "reject", label: "Membrane reject / concentrate" },
        { value: "backwash", label: "Backwash blowdown" },
        { value: "sludge", label: "Sludge / cake" },
        { value: "regen", label: "Regeneration effluent" },
        { value: "loss", label: "Evaporation / process loss" },
      ] },
  ],
  defaults: { name: "reject" },
  solve: () => ({ outlets: {}, aux: aux() }),
};

/* ================================================================= REGISTRY */

export const UNIT_MODELS: UnitModel[] = [
  feedSource, intake, intakePlain,
  tankModel("rawtank", "Raw Water Pond / Tank", "TANK", 12, "storage"),
  tankModel("eqtank", "Equalisation Tank", "EQ", 8, "storage"),
  tankModel("producttank", "Product Storage Tank", "PTANK", 8, "storage"),
  coagFloc, clarifier, daf, mmf, acf, cartridge,
  uf, nf, roBW, roSW, ceramicMF,
  edi, mixedBed, softener, degasser, chemSoftening,
  aao, msbr, mbbr, anaerobicAO, denitriFilter, disinfection,
  thickener, dewatering, mvr, crystalliser,
  ...ADVANCED_MODELS,
  splitter, pump, product, outfall, waste,
];

export const UNIT_BY_TYPE: Record<string, UnitModel> = Object.fromEntries(
  UNIT_MODELS.map((m) => [m.type, m]),
);

/**
 * The outlets a block actually has, given how it is configured. Every consumer
 * — the canvas handles, the palette, the balance — must go through this rather
 * than reading `model.outlets`, or a second draw-off line will exist in the
 * solver and be invisible on the drawing.
 */
export function outletsOf(type: string, params: Params): string[] {
  const m = UNIT_BY_TYPE[type];
  if (!m) return [];
  return m.dynamicOutlets ? m.dynamicOutlets(params) : m.outlets;
}

export const CATEGORY_LABELS: Record<UnitModel["category"], string> = {
  intake: "Intake",
  pretreatment: "Pre-treatment",
  membrane: "Membrane",
  ionexchange: "Ion exchange / polishing",
  biological: "Biological",
  oxidation: "Oxidation / AOP",
  thermal: "Thermal / ZLD",
  sludge: "Sludge",
  storage: "Storage",
  transport: "Transport",
  network: "Network",
};

export function defaultParams(type: string): Params {
  const m = UNIT_BY_TYPE[type];
  return m ? { ...m.defaults } : {};
}
