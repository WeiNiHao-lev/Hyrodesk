import { UnitKnowledge } from "./knowledge";

/**
 * Knowledge entries for the high-strength wastewater units.
 *
 * The reference points are the seventeen leachate plants delivered by Wuhan
 * City Environment Protection between 2012 and 2022 and the Bantargebang IPAS 2
 * engineering analysis. Where a number came from one of those it says so, and
 * where it is a textbook figure it says that instead.
 */
export const ADVANCED_KNOWLEDGE: Record<string, UnitKnowledge> = {
  phadjust: {
    principle:
      "A stirred tank with a reagent pump and a pH controller. Nothing is removed; the chemistry of what is already dissolved is changed. That sounds trivial and it is not, because pH decides the form a substance takes, and the form decides whether the next unit can remove it. Ammonia at pH 11 is a dissolved gas that a stripping tower can blow out; the same ammonia at pH 7 is an ion that a membrane can reject. The same nitrogen, two completely different removal routes, chosen with a dosing pump.",
    whenToUse: [
      "Ahead of ammonia stripping, to convert ammonium into free ammonia. Nothing else in the train matters if this step is missing.",
      "Ahead of any membrane, to bring the water back to pH 6.5-7 so that ammonia is an ion again and gets rejected.",
      "On reverse osmosis permeate before discharge. Carbon dioxide passes the membrane and the alkalinity that would buffer it does not, so RO permeate is acidic and will fail a pH 6-9 limit on its own.",
      "Before coagulation, where the coagulant has a narrow optimum: PAC and alum work at pH 6-7 and lose most of their effectiveness outside it.",
    ],
    whenNotToUse: [
      "As a way of meeting a discharge pH limit while the real problem is elsewhere. Neutralising an effluent that fails on COD does not make it compliant, it makes it neutral.",
      "With lime, immediately upstream of a membrane. Lime adds calcium, and calcium is what scales the membrane you are feeding.",
      "Where the water has almost no buffering. On a soft water the controller will hunt and overshoot; add a buffer or accept a wider band.",
    ],
    designRules: [
      {
        rule: "Size the reagent from a titration curve, never from the pH difference.",
        why: "pH is a logarithm of concentration, not a quantity of anything. Two waters at the same pH can need doses that differ a hundredfold. The only honest way to size the dose is to titrate the actual water in a beaker and read off how much reagent moves it to the target.",
      },
      {
        rule: "On a high-ammonia water, expect ammonium to dominate the alkali demand.",
        why: "Every mole of NH4+ that has to become NH3 consumes a mole of hydroxide. At 5000 mg/L of ammoniacal nitrogen that is roughly 340 milliequivalents per litre, against perhaps 100 from the carbonate system. An engineer who sizes the caustic from alkalinity alone will order a quarter of what the plant needs.",
      },
      {
        rule: "Lime is cheaper per equivalent; caustic is cleaner per equivalent.",
        why: "Hydrated lime costs a fraction of caustic soda for the same neutralising power, which on a 20 t/d duty is a large number. But it arrives as a slurry, it needs slaking and handling, it adds calcium to the water, and it leaves sludge. Whether that trade is worth taking depends entirely on what is downstream.",
      },
      {
        rule: "Allow 10-20 % excess over the stoichiometric demand.",
        why: "The controller sees the pH after mixing, so it is always correcting a condition that has already passed. Without margin the plant sits below target whenever the load moves.",
      },
    ],
    keyNumbers: [
      { param: "Reaction time", typical: "15-30 min", why: "Long enough for the reagent to disperse and the pH probe to read a settled value. Shorter and the controller chases its own tail." },
      { param: "Mixing intensity", typical: "30-60 W/m3", why: "Enough to keep the tank uniform. Acid-base reactions are instantaneous; the time is for mixing, not for chemistry." },
      { param: "Caustic demand, leachate to pH 11", typical: "300-500 meq/L", why: "Dominated by the ammonium. Translates to roughly 12-20 kg NaOH per m3 of leachate, which is normally the largest single operating cost in the plant." },
      { param: "Dosing excess", typical: "10-20 %", why: "Covers control lag and the error in reading a titration curve." },
      { param: "Alkalinity per mg NH4-N nitrified", typical: "7.14 mg as CaCO3", why: "The stoichiometry of nitrification. It is why a biological plant on a high-ammonia water often needs alkali dosing even when nobody planned for it." },
    ],
    failureModes: [
      { mode: "Under-ordered reagent", symptom: "Plant never reaches target pH; ammonia removal far below design", prevention: "Titrate the real water. Include the ammonium term explicitly in the calculation." },
      { mode: "Overshoot and hunting", symptom: "pH oscillating either side of setpoint, reagent consumption far above theory", prevention: "Two-stage dosing (coarse then trim), adequate mixing, probe positioned where the water is mixed." },
      { mode: "Scaling in the dosing line", symptom: "Blocked injection quill, dosing pump running against a closed line", prevention: "Injection into a turbulent zone, flushing connection, and lime slurry lines sized for velocity not for pressure drop." },
      { mode: "Precipitate carried downstream", symptom: "Suspended solids rising across a unit that removes nothing", prevention: "Expect magnesium hydroxide above pH 10.5 and provide somewhere for it to settle or be filtered." },
    ],
    upstream: "Equalisation, so the reagent controller sees a steady load rather than a moving one.",
    downstream: "Whatever needed the pH changed: a stripping tower, a membrane, a coagulation stage.",
    ccepcNote:
      "Every CCEPC leachate plant has at least two of these, and they are usually drawn as a single small box on a flowsheet. On the Bantargebang analysis the caustic and acid together come to over 40 t/d, which is more operating cost than the membranes and the evaporator combined.",
  },

  nh3strip: {
    principle:
      "Water falls through a packed tower while air is blown up against it. Ammonia that is present as the dissolved gas NH3 transfers into the air and leaves; ammonium ions, being charged, cannot. The whole design therefore rests on one number: what fraction of the ammonia is in the free form. That fraction comes from pH and temperature through the dissociation constant, and at pH 7 it is under 1 per cent while at pH 11 it is 98 per cent. Raise the pH and the same water becomes strippable.",
    whenToUse: [
      "Ammoniacal nitrogen above roughly 500 mg/L, where biological nitrification would need an impossible amount of oxygen and alkalinity.",
      "Old landfill leachate, where the carbon needed for denitrification simply is not present and the biological route cannot close.",
      "Warm climates. The free ammonia fraction rises with temperature, so a tropical site strips far more cheaply than a temperate one.",
      "Where land is tight. The tower is tall and narrow relative to a biological basin, though not as small as it first appears.",
    ],
    whenNotToUse: [
      "Without an acid scrubber on the off-gas. Stripping without capture does not treat the ammonia, it moves it into the air, and in most jurisdictions that is not permittable.",
      "Where most of the nitrogen is organic. Only ammonia strips; organic nitrogen passes straight through and sets a floor no air ratio can break.",
      "On cold water without heating. Below about 15 degC the economics collapse.",
      "Where scaling is likely and no softening is provided. At pH 11 calcium carbonate and magnesium hydroxide precipitate onto the packing, and a fouled tower loses its transfer area.",
    ],
    designRules: [
      {
        rule: "The tower diameter is set by the air, not by the water.",
        why: "At an air-to-water ratio of 3000, the gas flow is three thousand times the liquid flow. Keeping the superficial gas velocity below about 2 m/s then demands ten times the cross-section that the liquid loading would suggest. Sizing from the water flow alone produces a tower that floods on the day it starts.",
      },
      {
        rule: "Raise the pH above 10.5, and check it, before believing any removal figure.",
        why: "At pH 10 the free fraction is about 85 %; at pH 9 it is 35 %. The blower power is the same in all three cases. Stripping at the wrong pH is the most expensive way to move air there is.",
      },
      {
        rule: "Provide for scaling from the first day.",
        why: "You have deliberately created the exact conditions under which calcium carbonate precipitates. Either soften ahead of the tower, or accept an acid-wash cycle and design the packing so it can be washed in place.",
      },
      {
        rule: "Treat the ammonium sulphate as a liability until an offtake is signed.",
        why: "A plant producing 25 t/d of fertiliser needs a buyer, a store, a loading arrangement and a matching acid supply chain. Counted as revenue in a feasibility study and then unsold, it becomes a hazardous waste with a disposal cost.",
      },
    ],
    keyNumbers: [
      { param: "Air-to-water ratio", typical: "2000-4000 m3/m3", why: "Sets both removal and blower power. CCEPC designs leachate towers at 3000. Below 1500 the removal falls away; above 4000 the extra air buys very little." },
      { param: "Operating pH", typical: "10.5-11.5", why: "Puts 95-99 % of the ammonia in the strippable free form. This is the single most sensitive parameter in the unit." },
      { param: "Superficial gas velocity", typical: "1.5-2.5 m/s", why: "Above about 3 m/s the upward air holds the water up and the packing floods. This governs the diameter." },
      { param: "Packing height", typical: "6-12 m", why: "More height means more transfer units and better removal, at the cost of pumping the water to the top of it." },
      { param: "Packing pressure drop", typical: "1000-2000 Pa", why: "Multiplied by a very large air flow, this is the blower power and therefore most of the running cost." },
      { param: "Removal achieved", typical: "85-95 % of NH3-N", why: "Of the free ammonia. Total nitrogen falls by less, because organic nitrogen is untouched." },
      { param: "Acid demand", typical: "3.5 kg H2SO4 per kg N", why: "From the stoichiometry: two moles of ammonia per mole of sulphuric acid." },
      { param: "Fertiliser produced", typical: "4.7 kg (NH4)2SO4 per kg N", why: "The same stoichiometry, on the product side." },
    ],
    failureModes: [
      { mode: "Insufficient pH", symptom: "Removal far below design at the correct air ratio", prevention: "Continuous pH measurement at the tower inlet, interlocked to the caustic dosing." },
      { mode: "Scaling of the packing", symptom: "Rising pressure drop, falling removal, water channelling down one side", prevention: "Softening upstream or a routine acid clean; random packing that can be removed and washed." },
      { mode: "Flooding", symptom: "Water carried up the tower, liquid at the fan, violent pressure fluctuation", prevention: "Size the diameter on gas velocity, and check it again at the maximum design flow." },
      { mode: "Ammonia release", symptom: "Odour complaints and an air-quality violation while the water analysis looks excellent", prevention: "Acid scrubber with its own pH control, sized for the full stripped load and not for the average." },
      { mode: "Fertiliser with no buyer", symptom: "Ammonium sulphate accumulating on site", prevention: "Secure the offtake before the plant is built, or plan to recycle the scrubber liquor back into the process." },
    ],
    upstream: "Alkali dosing to pH 11. Ideally a solids removal step too, because the tower will otherwise blind.",
    downstream: "Neutralisation back to pH 7, without exception, before any membrane or biological stage.",
    ccepcNote:
      "The Bantargebang analysis sizes this at an air-to-water ratio of 3000 on 1200 m3/d, giving roughly 150,000 m3/h of air and a tower whose diameter is set entirely by that air flow.",
  },

  mbr: {
    principle:
      "Conventional activated sludge separates biomass from water by letting it settle, which limits how much biomass the tank can hold: push the concentration too high and the clarifier fails. An MBR replaces the clarifier with a membrane immersed in the sludge, so separation no longer depends on settling. The reactor can then run at three times the biomass concentration in the same volume, the sludge age is decoupled from the hydraulic retention time, and the effluent contains no suspended solids at all because the membrane is an absolute barrier.",
    whenToUse: [
      "Where land is limited. The footprint is roughly half a conventional plant with a clarifier.",
      "Ahead of reverse osmosis. An MBR permeate is the best RO feed any biological process can produce.",
      "Where the biology is slow-growing, such as nitrification at low temperature, because a long sludge age can be held without a huge tank.",
      "Where a sludge settles badly and a conventional clarifier would never work.",
    ],
    whenNotToUse: [
      "On a water whose organic matter is refractory. An MBR removes what biology can degrade, and on an old leachate that may be only 10-20 % of the COD. The membrane does not change that; it only guarantees the solids.",
      "Where the operator cannot maintain a membrane. Chemical cleaning is a routine that has to actually happen.",
      "Where the feed carries oil, grease or fibre that has not been removed. These foul irreversibly.",
      "As a way to reach a nitrogen limit without carbon. Nitrification needs oxygen and alkalinity; denitrification needs carbon. An MBR supplies neither.",
    ],
    designRules: [
      {
        rule: "Design the flux for the water, not for the catalogue.",
        why: "A clean-water UF module runs at 60-80 LMH. The same module in mixed liquor runs at 15-25, and on a leachate at 8-15. The difference is the cake layer, and it is not optional.",
      },
      {
        rule: "Scouring air, not process air, is what makes an MBR expensive.",
        why: "Air is blown continuously along the membrane surface to keep solids from settling on it. That air does no treatment at all. On a typical MBR it is a third to a half of the total power, and it runs whether or not there is load.",
      },
      {
        rule: "Check the alkalinity balance before believing the ammonia removal.",
        why: "Nitrification consumes 7.14 mg of alkalinity as calcium carbonate for every mg of ammoniacal nitrogen oxidised. On a high-ammonia water the alkalinity runs out, the pH falls, nitrification stops, and the plant fails on ammonia while every biological indicator looks normal.",
      },
      {
        rule: "Do not exceed about 12,000 mg/L MLSS.",
        why: "Above that the sludge viscosity rises sharply, oxygen transfer efficiency collapses, and the membrane fouls faster than it can be cleaned. The apparent gain in capacity is paid for twice.",
      },
    ],
    keyNumbers: [
      { param: "MLSS", typical: "8,000-12,000 mg/L", why: "Three times a conventional plant. This is the reason the tank is small." },
      { param: "Net flux", typical: "15-25 LMH municipal, 8-15 leachate", why: "Net of backwash and relaxation. Quoting gross flux overstates the capacity by 10-15 %." },
      { param: "Scouring air", typical: "0.3-0.5 Nm3/m2.h", why: "Set by the membrane supplier. It is the dominant energy term and cannot be reduced without fouling." },
      { param: "Sludge age", typical: "20-40 d", why: "Long enough for nitrifiers, which grow slowly. Decoupled from HRT, which is the second reason an MBR is compact." },
      { param: "Oxygen transfer efficiency", typical: "1.2 kgO2/kWh at high MLSS", why: "Against 2.5-3 in clean municipal sludge. Thick, saline liquor transfers oxygen badly, and designing on the clean figure undersizes the blowers by half." },
      { param: "Sludge yield", typical: "0.2-0.35 kgVSS/kgBOD", why: "Lower than conventional activated sludge because the long sludge age lets the biomass digest itself." },
      { param: "Recovery cleans", typical: "2-6 per year", why: "Hypochlorite for organic fouling, citric or oxalic acid for inorganic. More often than this means something upstream is wrong." },
    ],
    failureModes: [
      { mode: "Irreversible fouling", symptom: "Permeability falling and not recovering after cleaning", prevention: "Screening to 1-3 mm, oil removal, and cleaning on schedule rather than on symptom." },
      { mode: "Alkalinity exhaustion", symptom: "pH drifting down, ammonia breaking through, nitrate not rising", prevention: "Alkalinity balance at design, alkali dosing provided, pH alarmed." },
      { mode: "Sludge bulking", symptom: "Viscosity rising, membrane fouling accelerating", prevention: "Control the F/M ratio and the dissolved oxygen; do not chase capacity with MLSS." },
      { mode: "Screening failure", symptom: "Hair and fibre braiding around hollow fibres, torn membranes", prevention: "A fine screen ahead of the membrane tank is not optional, and 3 mm is not fine enough for hollow fibre." },
      { mode: "Assumed COD removal", symptom: "Effluent COD far above prediction on an old leachate", prevention: "Measure BOD:COD. If it is below 0.15 the COD is refractory and no biological process will remove it." },
    ],
    upstream: "Fine screening, oil removal, and pH correction to 6.5-7.5.",
    downstream: "Reverse osmosis or DTRO. MBR permeate is a good membrane feed, but it is not a dischargeable effluent on a refractory water.",
    ccepcNote:
      "CCEPC has MBR on leachate at Zhongshan (300 m3/h, MBR + NF + RO), Jiyuan (180 m3/d, MBR + RO) and Wuhan Shenneng (330 t/d, anaerobic + MBR + membrane), plus two-stage AO + MBR on the Qianzishan biogas slurry plant.",
  },

  anaerobic: {
    principle:
      "Bacteria break organic matter down in the absence of oxygen, ending in methane and carbon dioxide. Nothing has to be aerated, so the largest energy cost of biological treatment disappears, and the process returns a fuel instead of consuming power. In a UASB the biomass forms dense granules that settle against the upward flow, which is what allows a very high biomass concentration in a simple tank with no mechanical parts inside it.",
    whenToUse: [
      "COD above roughly 2000 mg/L. Below that the methane does not repay the reactor.",
      "As the first biological step on leachate, distillery, food or coking wastewater — which is exactly where CCEPC puts it, in thirteen of its seventeen leachate plants.",
      "Where sludge disposal cost matters. Anaerobic yield is roughly a tenth of aerobic.",
      "Warm wastewater. A tropical leachate needs no heating at all, which removes the main operating cost of digestion in a temperate country.",
    ],
    whenNotToUse: [
      "As the last biological step. Anaerobic effluent still carries substantial COD and all of the nitrogen; something aerobic has to follow.",
      "On dilute wastewater, where the reactor is large and the gas is negligible.",
      "Where sulphate is high relative to COD. Sulphate reducers outcompete methanogens, and you get hydrogen sulphide instead of methane — an odour, corrosion and gas-cleaning problem in one.",
      "Immediately before a membrane on a high-nitrogen water. Anaerobic treatment mineralises organic nitrogen into ammonium, so it raises the ammonia load rather than lowering it.",
    ],
    designRules: [
      {
        rule: "Size on organic loading rate, not on retention time.",
        why: "On strong wastewater the volume needed to keep the loading within what the biomass can process is far larger than the volume needed for a nominal HRT. Whichever is larger governs, and on leachate it is almost always the loading.",
      },
      {
        rule: "Check the COD to sulphate ratio before committing.",
        why: "Below about 10 the sulphate reducers take a large share of the substrate. The methane yield falls, the gas needs treating for hydrogen sulphide, and the concrete and steel start corroding.",
      },
      {
        rule: "Control the upflow velocity.",
        why: "Too low and the granules are not fluidised, so short-circuiting begins. Too high and the granules wash out and the reactor loses its biomass, which takes months to recover.",
      },
      {
        rule: "Decide what happens to the gas before designing the reactor.",
        why: "Biogas is only a credit if something on site can burn it. On a landfill with a waste-to-energy plant that is easy; on a standalone plant it is flared, and the energy saving is only the aeration you avoided.",
      },
    ],
    keyNumbers: [
      { param: "Organic loading rate", typical: "4-12 kgCOD/m3.d UASB, 10-25 EGSB", why: "Set by how much substrate the granular biomass can turn over. This normally fixes the volume." },
      { param: "Upflow velocity", typical: "0.5-1.5 m/h UASB, 4-10 EGSB", why: "Fluidises the sludge bed without washing it out." },
      { param: "COD removal", typical: "65-85 %", why: "Higher on readily degradable wastewater, much lower on refractory leachate." },
      { param: "Methane yield", typical: "0.28-0.32 Nm3/kgCOD removed", why: "The theoretical maximum is 0.35 at standard conditions; the rest dissolves or goes to biomass." },
      { param: "Methane heating value", typical: "9.97 kWh/Nm3", why: "Converts the gas into a comparable energy figure." },
      { param: "Sludge yield", typical: "0.05-0.1 kgVSS/kgCOD", why: "An order of magnitude below aerobic. Little sludge is the second reason to choose anaerobic treatment." },
      { param: "Free ammonia inhibition", typical: "above ~100 mg/L NH3", why: "Methanogens stall. On a high-ammonia leachate this constrains how high the pH may drift." },
    ],
    failureModes: [
      { mode: "Granule washout", symptom: "Suspended solids in the effluent, gas production collapsing", prevention: "Upflow velocity control and a properly designed gas-liquid-solid separator at the top." },
      { mode: "Sulphide poisoning", symptom: "Gas smells, methane fraction falls, concrete and steel corroding", prevention: "Check COD:SO4 at design; provide gas desulphurisation if it is marginal." },
      { mode: "Ammonia inhibition", symptom: "Volatile fatty acids accumulating, pH falling, reactor souring", prevention: "Hold the pH down so that ammonia stays ionised; consider stripping ahead of the reactor." },
      { mode: "Overloading after a shutdown", symptom: "Acidification, weeks or months to recover", prevention: "Ramp the load back slowly. Methanogens grow slowly and cannot be hurried." },
    ],
    upstream: "Equalisation and solids removal. Some plants add a conditioning tank to correct pH and nutrients first.",
    downstream: "An aerobic stage, almost always. In the CCEPC leachate train it is two-stage A/O, then UF, NF and RO.",
    ccepcNote:
      "The standard CCEPC leachate train is pretreatment conditioning tank, anaerobic, two-stage A/O, UF, NF, RO. It appears in that form at Wuhan South (1500 m3/d), Qianzishan phase II (500 m3/d), Heze Jinjiang (210 m3/d) and Mianyang (400 m3/d).",
  },

  baf: {
    principle:
      "A submerged bed of granular or floating media, aerated from below. Biomass grows on the media as a film while the bed simultaneously filters the suspended solids, so a single vessel does the work of an aeration tank and a clarifier. Because the biomass is attached rather than suspended, nothing has to settle and the footprint is small.",
    whenToUse: [
      "As a tertiary or polishing stage after a main biological process.",
      "Where land is severely constrained and a clarifier will not fit.",
      "Where the load varies: attached biomass is far more resilient to shock than suspended sludge.",
      "In two stages, the first removing carbon and the second nitrifying, which is how CCEPC configured it at Qianzishan.",
    ],
    whenNotToUse: [
      "On high suspended solids. The bed filters as well as it treats, so solids consume the run length directly and the backwash frequency becomes unworkable.",
      "As the primary treatment of a strong wastewater. The volumetric loading it can take is limited.",
      "Where backwash handling has not been provided for. A BAF produces a large, dirty, intermittent backwash that has to go somewhere.",
    ],
    designRules: [
      {
        rule: "Separate the carbon stage from the nitrifying stage.",
        why: "Heterotrophs grow far faster than nitrifiers and will outcompete them wherever organic carbon remains. Removing the carbon first is what lets the second stage nitrify at all.",
      },
      {
        rule: "Design the backwash before designing the filter.",
        why: "The backwash is 3-8 % of throughput, arrives all at once, and carries the solids the bed has captured. Without a buffer tank and a return route it destabilises whatever is upstream.",
      },
      {
        rule: "Watch the volumetric load, not just the filtration rate.",
        why: "The hydraulic rate sets the area; the organic load per unit volume sets whether the biofilm can process what arrives. Exceed the second and the bed blinds however generous the first looks.",
      },
    ],
    keyNumbers: [
      { param: "Filtration rate", typical: "2-6 m/h", why: "Balances contact time against footprint." },
      { param: "Media depth", typical: "2-4 m", why: "Enough biofilm surface without an unreasonable head loss or backwash demand." },
      { param: "Volumetric BOD load", typical: "1.5-4 kgBOD/m3.d carbon stage, 0.3-1 nitrifying", why: "Nitrifiers are slow, so the nitrifying stage is loaded far more gently." },
      { param: "Process air ratio", typical: "5-20 m3/m3", why: "Higher than a suspended-growth system because oxygen has to diffuse into a film." },
      { param: "Backwash water", typical: "3-8 % of throughput", why: "Recycled to the head of the works, so it reduces net plant capacity by the same amount." },
    ],
    failureModes: [
      { mode: "Bed blinding", symptom: "Head loss rising quickly, run time falling to hours", prevention: "Solids removal upstream, and a realistic volumetric load." },
      { mode: "Media loss", symptom: "Media in the effluent or the backwash", prevention: "Correct backwash rate and a nozzle floor that is actually maintained." },
      { mode: "Nitrification failure", symptom: "Ammonia passing while COD looks fine", prevention: "Separate stages; check that the carbon stage is really removing the carbon." },
    ],
    upstream: "A settling, flotation or membrane step. Solids are what kill a BAF.",
    downstream: "Disinfection or discharge, or a membrane if reuse is the target.",
    ccepcNote: "Two-stage BAF on the Qianzishan organic solid waste biogas slurry plant, 700 m3/d, following MBR and electrochemical treatment.",
  },

  dtro: {
    principle:
      "The same reverse osmosis membrane chemistry as any other RO, in a completely different module. Instead of a tightly wound spiral with a thin mesh spacer, the membrane is stacked as discs on a central tension rod, and water flows across each disc in an open channel a few millimetres wide. That channel is what lets the module run on a liquid that would block a spiral element within hours. The price is packing density: far less membrane area in the same volume, and a much higher pressure to push water through it.",
    whenToUse: [
      "Landfill leachate. This is the application the module was designed for and where it has no real competitor.",
      "Any feed with high fouling potential, high suspended solids or a high SDI that has to be desalinated anyway.",
      "Concentrating a reject stream towards zero liquid discharge, where the salinity is beyond a spiral element's pressure rating.",
      "Where the plant will be operated by people who cannot guarantee perfect pretreatment.",
    ],
    whenNotToUse: [
      "On clean water. A spiral element does the same separation for a fraction of the capital and energy.",
      "Where the osmotic pressure of the feed approaches the module rating. A membrane cannot work below its own osmotic pressure, and at that point the answer is evaporation.",
      "Without neutralisation on a high-ammonia water. At high pH the ammonia is a dissolved gas and passes the membrane freely.",
      "As a substitute for a biological stage. Rejecting COD into a concentrate does not destroy it; it just makes it someone else's problem in a smaller volume.",
    ],
    designRules: [
      {
        rule: "Two stages, not one, for leachate.",
        why: "A single stage at very high recovery pushes the concentrate to the scaling and pressure limit at once. Two stages in series, the first at about 75 % and the second taking its concentrate, reaches 85 % overall with each stage inside its own envelope.",
      },
      {
        rule: "Distinguish the local rejection from the system rejection.",
        why: "A vendor quotes 98.5 % system rejection at the design recovery. The membrane itself rejects more than that, because the concentration rises along the module. Enter one where the other belongs and the permeate quality will be wrong by a factor of two — in whichever direction is least convenient.",
      },
      {
        rule: "Check the osmotic pressure before choosing a recovery.",
        why: "Osmotic pressure is roughly 0.78 bar per 1000 mg/L of dissolved solids. At 85 % recovery the concentrate is 2.6 times the feed, and if that lands above the module rating the recovery is not achievable at any cost.",
      },
      {
        rule: "Budget for cleaning as an operating routine, not an event.",
        why: "DTRO on leachate is cleaned every week or two. That is normal and it is designed in; a plant that has to be shut down to clean has been designed wrongly.",
      },
    ],
    keyNumbers: [
      { param: "Operating pressure", typical: "60-120 bar", why: "Set by the osmotic pressure of a concentrated leachate plus the driving pressure. This is a high-pressure plant with the safety implications that carries." },
      { param: "Flux", typical: "8-20 LMH", why: "18 is the CCEPC leachate design figure. Similar to spiral RO, but achieved with far less area per unit volume." },
      { param: "Recovery", typical: "75-80 % single stage, 85 % over two", why: "Beyond that the concentrate salinity and the pressure both go past the module envelope." },
      { param: "Channel gap", typical: "3-6 mm open channel", why: "Two orders of magnitude more open than a spiral feed spacer. This is the whole reason the module exists." },
      { param: "COD rejection", typical: "98-99 % system", why: "Leachate COD is largely humic macromolecules, which a dense membrane rejects almost completely." },
      { param: "Specific energy", typical: "6-15 kWh/m3 permeate", why: "Far above brackish RO. The pressure is the price of running on a liquid nothing else will handle." },
      { param: "Cleaning frequency", typical: "every 1-4 weeks", why: "Designed in, with a CIP set sized to clean one stage while the other runs." },
    ],
    failureModes: [
      { mode: "Ammonia breakthrough", symptom: "Nitrogen limit missed while every other parameter passes", prevention: "Neutralise to pH 6.5-7 upstream, and verify the pH at the membrane rather than at the dosing tank." },
      { mode: "Scaling of the concentrate stage", symptom: "Second-stage pressure rising, recovery falling", prevention: "Antiscalant selected against the actual concentrate composition, not a generic dose." },
      { mode: "High-pressure incidents", symptom: "Hose or fitting failure at 100 bar", prevention: "Rated hoses, guarded runs and a pressure-relief philosophy. This is the real safety hazard of a leachate plant." },
      { mode: "Concentrate with nowhere to go", symptom: "Plant limited by concentrate storage rather than by treatment", prevention: "Decide the concentrate route — evaporation, recirculation to the landfill, or solidification — before the recovery is fixed." },
    ],
    upstream: "Neutralisation, and a cartridge filter. Even though DTRO tolerates solids, removing them extends the cleaning interval enough to pay for the filter.",
    downstream: "Polishing (AOP) on the permeate; evaporation or crystallisation on the concentrate.",
    ccepcNote:
      "The CCEPC leachate references use two-stage material membrane reduction on the nanofiltration concentrate at Qianzishan II, Heze Jinjiang and Mianyang. The Bantargebang analysis uses two-stage DTRO at 18 LMH and 85 % recovery, with 98.5 % COD and 97 % TN system rejection.",
  },

  aop: {
    principle:
      "Ozone, or ozone with a catalyst or peroxide, generates hydroxyl radicals in the water. The hydroxyl radical is close to the strongest oxidant available in water treatment and it attacks organic molecules indiscriminately, breaking rings and double bonds that no organism will touch. That is why it removes the colour of an old leachate when nothing else will, and why the energy is proportional to the amount of organic matter it has to attack.",
    whenToUse: [
      "As a final polish on an already low-COD stream, to remove residual colour and refractory organics.",
      "Ahead of a biological stage, to break refractory molecules into biodegradable fragments and raise the BOD:COD ratio.",
      "Where colour is a compliance or perception problem. Membranes and oxidation are the only two things that produce genuinely clear water; coagulation does not.",
      "For disinfection at the same time, which comes free with the ozone.",
    ],
    whenNotToUse: [
      "On raw high-COD wastewater. The energy scales with the load: oxidising 11,000 mg/L costs roughly a hundred times more than oxidising 126 mg/L for the same flow.",
      "As the last unit, if partial oxidation is releasing BOD that will then be discharged.",
      "On a high-chloride water without testing. Chloride scavenges hydroxyl radicals and forms chlorinated by-products and chlorate.",
      "Where the operator cannot manage an ozone system. Ozone is toxic and the generator, destructor and leak detection are a plant of their own.",
    ],
    designRules: [
      {
        rule: "Position matters more than the variant chosen.",
        why: "The oxidant demand is proportional to the COD destroyed. Moving the same unit from ahead of the membranes to behind them can cut its energy by two orders of magnitude while achieving the same effluent. If an AOP is expensive to run, it is almost always in the wrong place, not the wrong technology.",
      },
      {
        rule: "Determine the oxidant demand experimentally.",
        why: "The 2-3 kg of ozone per kg of COD figure is an average across water types. On a specific water it can be half or double, and the ozone generator is the largest capital item in the unit.",
      },
      {
        rule: "Provide ozone destruction on the off-gas.",
        why: "Transfer is never complete, and undissolved ozone leaving a contact tank is an occupational hazard, not an emission technicality." ,
      },
      {
        rule: "Expect the BOD to rise even as the COD falls.",
        why: "Partial oxidation cuts large refractory molecules into small biodegradable ones. Ahead of a biological polish that is exactly what you want; as the last unit before discharge it can turn a COD success into a BOD failure.",
      },
    ],
    keyNumbers: [
      { param: "Ozone per COD removed", typical: "2-3 kg O3/kgCOD", why: "2.5 is the CCEPC design basis. Catalytic ozonation improves on it by converting more ozone into hydroxyl radicals rather than letting it react directly." },
      { param: "Generator energy", typical: "8-12 kWh/kgO3 from oxygen", why: "Roughly double from air feed. The oxygen supply, liquid or PSA, is a plant in itself." },
      { param: "Contact time", typical: "20-60 min", why: "Long enough for the radicals to do their work and for the residual ozone to decay." },
      { param: "Specific energy in position", typical: "0.5-2 kWh/m3 as polishing", why: "Against 50-200 kWh/m3 if applied to raw leachate. The same unit, the same chemistry, a different position." },
      { param: "Colour removal", typical: "85-95 %", why: "Colour comes from conjugated double bonds, which is precisely what hydroxyl radicals break." },
    ],
    failureModes: [
      { mode: "Applied in the wrong position", symptom: "Enormous power bill for a modest COD reduction", prevention: "Put it after the membranes. Calculate the load it will see before selecting the generator." },
      { mode: "Generator undersized", symptom: "COD reduction far below design and unimprovable", prevention: "Size from the measured ozone demand of the real water, not from a literature ratio." },
      { mode: "Bromate formation", symptom: "A new regulated by-product appearing in the effluent", prevention: "Check the bromide in the feed. Where it is significant, consider peroxide-based routes instead." },
      { mode: "Residual BOD", symptom: "COD passes, BOD fails", prevention: "Either a small biological polish afterwards, or enough oxidation to mineralise rather than fragment." },
    ],
    upstream: "Anything that has already removed the bulk of the load. On a leachate plant that means the membranes.",
    downstream: "Discharge, online monitoring, or a small biological polish if the released BOD matters.",
    ccepcNote:
      "Zuoling WWTP in Wuhan, 100,000 m3/d, includes an ozone oxidation tank, so CCEPC has large-scale AOP operating experience. Wuhan Erfei Mountain landfill leachate, 100 m3/h, is advanced oxidation followed by secondary A/O and sand and carbon filtration.",
  },

  electroox: {
    principle:
      "Current is passed between electrodes immersed in the wastewater. Organics are oxidised directly at the anode surface, and indirectly by hypochlorite generated from the chloride already dissolved in the water. Nothing is delivered to site and nothing precipitates, so there is no chemical logistics and no sludge — but every bit of the oxidation is paid for as electricity, at the meter, continuously.",
    whenToUse: [
      "On small, concentrated, saline streams, where the flow is low enough that the power is affordable.",
      "Where chloride is already high, because the indirect chlorine route is far more efficient than direct anodic oxidation alone.",
      "For ammonia removal by breakpoint chlorination generated in situ, which on a leachate is often the real reason it is chosen.",
      "Where chemical delivery is difficult and electricity is available.",
    ],
    whenNotToUse: [
      "On low-conductivity water. Without ions to carry the current the cell voltage and the energy per kg of COD both climb steeply.",
      "On large flows. The economics are set by kWh per cubic metre and they do not improve with scale.",
      "Where chlorinated by-products or chlorate in the effluent would be a problem, which on a river discharge they usually are.",
      "As a substitute for a membrane. It destroys organics; it does not desalinate.",
    ],
    designRules: [
      {
        rule: "Verify the specific energy on the actual water.",
        why: "Published figures span 10 to 150 kWh per kg of COD depending on conductivity, anode material and target. Designing from the wrong end of that range is an order-of-magnitude error in the running cost.",
      },
      {
        rule: "Analyse the by-products before committing.",
        why: "Chloride makes the process efficient and simultaneously creates chlorinated organics and chlorate. Both are regulated in more places every year.",
      },
      {
        rule: "Budget for anode replacement.",
        why: "Boron-doped diamond and mixed-metal-oxide anodes are a large part of the capital and they wear. A life of three to five years is normal and it belongs in the operating cost, not the capital.",
      },
    ],
    keyNumbers: [
      { param: "Specific energy", typical: "20-40 kWh/kgCOD on saline water", why: "Rises steeply as conductivity falls. This single number decides whether the unit is viable." },
      { param: "Current density", typical: "100-500 A/m2", why: "Higher gives more throughput per electrode and more side reactions and wear." },
      { param: "Cell voltage", typical: "4-8 V", why: "Set by the gap, the conductivity and the electrode. Multiplied by the current, it is the power." },
      { param: "Chloride needed", typical: "above ~1500 mg/L", why: "Below that the indirect chlorine route weakens and the efficiency falls away." },
      { param: "Anode life", typical: "3-5 y", why: "A recurring capital item that is often left out of a comparison and should not be." },
    ],
    failureModes: [
      { mode: "Electrode scaling", symptom: "Cell voltage rising at constant current", prevention: "Polarity reversal or acid cleaning; softening if the hardness is high." },
      { mode: "Chlorate and perchlorate", symptom: "New regulated species in the effluent", prevention: "Analyse before committing; consider a downstream reduction step." },
      { mode: "Runaway energy cost", symptom: "Operating cost several times the estimate", prevention: "Bench-test the specific energy on the real water at the real conductivity." },
    ],
    upstream: "Solids removal, and ideally a membrane so the stream is small and concentrated.",
    downstream: "Polishing or discharge, with by-product monitoring.",
    ccepcNote: "Electrochemistry appears in the Qianzishan biogas slurry train, between flocculation-precipitation and the two-stage BAF.",
  },

  oilsep: {
    principle:
      "Oil separates from water the same way sand does, only upwards: a droplet less dense than water rises at a velocity set by its diameter and the density difference, exactly as Stokes' law describes for a settling particle. If the water moves slowly enough that the droplet reaches the surface before the outlet, it is skimmed off. Corrugated plates shorten the distance a droplet has to travel, in the same way inclined plates shorten a settling path.",
    whenToUse: [
      "Wherever free or dispersed oil is present: refinery, petrochemical, coking, vehicle workshop, or a leachate with an oily fraction.",
      "As the first unit, before anything the oil could foul — which means before every membrane and every biological process.",
      "Where oil has value and can be recovered rather than disposed of.",
    ],
    whenNotToUse: [
      "On emulsified oil. A chemically or mechanically stabilised emulsion will not separate by gravity at any retention time; it needs demulsification, flotation or an ultrafiltration membrane.",
      "As the only oil removal step ahead of a membrane. Gravity separation leaves tens of mg/L, and a membrane wants single figures.",
      "On dissolved hydrocarbons, which are not droplets and do not rise.",
    ],
    designRules: [
      {
        rule: "Design for the smallest droplet you intend to catch.",
        why: "The rise velocity goes with the square of the diameter, so the design droplet size sets the area directly. API separators are conventionally designed on 150 micron and corrugated-plate units on 60, which is why a CPI is several times smaller for the same duty.",
      },
      {
        rule: "Keep the flow laminar and undisturbed.",
        why: "Any turbulence re-entrains the oil that has already risen. Inlet distribution, and no pumps between the separator and its skimmer, matter more than retention time.",
      },
      {
        rule: "Provide for the sludge as well as the oil.",
        why: "Solids settle while oil rises. A separator with no sludge draw-off silts up and loses its volume, and then its separation.",
      },
    ],
    keyNumbers: [
      { param: "Design rise rate", typical: "0.5-2 m/h", why: "Corresponds to the rise velocity of the design droplet. Directly sets the surface area." },
      { param: "Retention time", typical: "20-40 min", why: "Enough for the design droplet to travel the plate spacing, with margin for flow variation." },
      { param: "Free oil removal", typical: "85-95 %", why: "Of free and dispersed oil. Emulsified oil passes essentially untouched." },
      { param: "Effluent oil", typical: "20-100 mg/L", why: "The realistic floor for gravity separation. A discharge or membrane limit below this needs flotation as well." },
      { param: "Skimmed volume", typical: "0.5-2 % of feed", why: "The recovered oil layer, which still contains water and must be dewatered or disposed of." },
    ],
    failureModes: [
      { mode: "Emulsified feed", symptom: "Removal far below design, oil visible in the effluent", prevention: "Test whether the oil is free or emulsified before selecting the unit; avoid centrifugal pumps upstream, which create the emulsion themselves." },
      { mode: "Sludge accumulation", symptom: "Falling effective volume, short-circuiting", prevention: "Sludge hopper with a scraper and a routine draw-off." },
      { mode: "Short-circuiting", symptom: "Tracer appearing at the outlet far too early", prevention: "Inlet distribution baffles; check by dye test at commissioning rather than assuming." },
    ],
    upstream: "Screening and grit removal.",
    downstream: "Flotation or biological treatment. On a membrane plant, never straight to the membrane.",
    ccepcNote: "Microfiltration with oil separation and two-stage air flotation opens the Qianzishan biogas slurry train.",
  },
};
