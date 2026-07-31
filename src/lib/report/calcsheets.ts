import { NodeResult, Params, Stream } from "../engine/types";
import { hardnessAsCaCO3 } from "../engine/stream";
import { ADVANCED_BUILDERS } from "./calcsheets-advanced";

/**
 * Design calculation recipes.
 *
 * Each unit type produces a sheet in the same form the industry uses: item,
 * symbol, value, unit, the formula in symbolic terms, and a note carrying the
 * reference range. The value is written into Excel as a LIVE FORMULA referring
 * to the cells above it, so the reader can trace any number back to its inputs
 * and change an assumption to see what moves.
 *
 * `expr` uses ${key} placeholders which the writer resolves to real cell
 * addresses. `theory` explains where the equation comes from and is included in
 * the learning export.
 */

export interface CalcRow {
  /** Referenceable id for use in other rows' expressions. */
  key?: string;
  no?: string;
  /** Absent on a section-heading row. */
  item?: string;
  symbol?: string;
  unit?: string;
  /** A literal value: an input, a design choice, or a physical constant. */
  val?: number;
  /** Expression in ${key} terms, written to Excel as a formula. */
  expr?: string;
  /** The same relationship in symbols, for the Formula column. */
  formula?: string;
  note?: string;
  /** Where the equation comes from. Learning export only. */
  theory?: string;
  /** Section heading rather than a calculation row. */
  section?: string;
  /** True where the engineer chooses the number rather than deriving it. */
  input?: boolean;
}

const n = (p: Params, k: string, d = 0): number => {
  const v = p[k];
  return typeof v === "number" && Number.isFinite(v) ? v : d;
};

type Builder = (r: NodeResult, p: Params) => CalcRow[];

/* ------------------------------------------------------------------ helpers */

function feedRows(r: NodeResult): CalcRow[] {
  return [
    { section: "Duty" },
    {
      key: "Qin", no: "1", item: "Inlet flow", symbol: "Q_in", unit: "m³/h",
      val: r.inlet.flow, input: true,
      note: "From the water balance. In product-driven mode this is itself a result of the demand.",
      theory:
        "Every sizing calculation starts from the hydraulic duty. Get this wrong and nothing downstream can be right, which is why the water balance is solved before any equipment is sized.",
    },
  ];
}

function tankRows(defaultHRT: number): Builder {
  return (r, p) => [
    ...feedRows(r),
    { section: "Volume from retention time" },
    {
      key: "HRT", no: "2", item: "Design retention time", symbol: "t", unit: "h",
      val: n(p, "hrtH", defaultHRT), input: true,
      note: "Chosen from the duty of the tank: buffering, settling, contact or storage security.",
      theory:
        "Hydraulic retention time is the average time a parcel of water spends in the vessel. It is the design variable for anything whose job is to hold water rather than to change it.",
    },
    {
      key: "V", no: "3", item: "Working volume", symbol: "V", unit: "m³",
      expr: "${Qin}*${HRT}", formula: "V = Q_in × t",
      theory:
        "Directly from the definition of retention time: t = V / Q, therefore V = Q × t. Consistent units matter — flow in m³/h with time in hours gives m³.",
    },
    {
      key: "margin", no: "4", item: "Design margin", symbol: "m", unit: "%",
      val: n(p, "designMarginPct", 10), input: true,
      note: "Allowance for fouling, ageing, sludge accumulation and off-design operation.",
    },
    {
      key: "Vd", no: "5", item: "Volume to be built", symbol: "V_design", unit: "m³",
      expr: "${V}*(1+${margin}/100)", formula: "V_design = V × (1 + m/100)",
    },
    { section: "Geometry — check it is buildable" },
    {
      key: "depth", no: "6", item: "Effective water depth", symbol: "h", unit: "m",
      val: 4.5, input: true,
      note: "Practical range 3–6 m for a concrete basin; deeper needs thicker walls and more excavation.",
    },
    {
      key: "area", no: "7", item: "Plan area required", symbol: "A", unit: "m²",
      expr: "${Vd}/${depth}", formula: "A = V_design / h",
    },
    {
      key: "diam", no: "8", item: "Equivalent diameter if circular", symbol: "D", unit: "m",
      expr: "(4*${area}/PI())^0.5", formula: "D = √(4A / π)",
      theory:
        "From A = πD²/4. A circular tank uses the least wall material for a given volume, which is why storage tanks are round and process basins — needing baffles and internals — are rectangular.",
    },
  ];
}

/* ------------------------------------------------------------------ builders */

const BUILDERS: Record<string, Builder> = {
  coagfloc: (r, p) => [
    ...feedRows(r),
    { section: "Mixing and flocculation volumes" },
    { key: "tmix", no: "2", item: "Rapid mix time", symbol: "t_mix", unit: "min", val: n(p, "mixTimeMin", 1.5), input: true,
      note: "1–2 min. Charge neutralisation is complete in seconds; the time is to distribute the dose.",
      theory: "Coagulant hydrolyses within a second of contact. The rapid mix exists only to spread it evenly before it does so, which is why the energy input matters more than the time." },
    { key: "tfloc", no: "3", item: "Flocculation time", symbol: "t_floc", unit: "min", val: n(p, "flocTimeMin", 20), input: true,
      note: "15–30 min, in 3 tapered stages.",
      theory: "Floc growth is a collision process: the number of successful collisions rises with time and with velocity gradient, but too much shear breaks the floc up again. Tapering the energy grows large floc without tearing it." },
    { key: "Vmix", no: "4", item: "Rapid mix volume", symbol: "V_mix", unit: "m³", expr: "${Qin}/60*${tmix}", formula: "V_mix = Q_in / 60 × t_mix" },
    { key: "Vfloc", no: "5", item: "Flocculation volume", symbol: "V_floc", unit: "m³", expr: "${Qin}/60*${tfloc}", formula: "V_floc = Q_in / 60 × t_floc" },
    { section: "Chemical dosing" },
    { key: "dose", no: "6", item: "Coagulant dose", symbol: "C_PAC", unit: "mg/L", val: n(p, "coagDose", 30), input: true,
      note: "10–50 mg/L. Confirm by jar test — no correlation predicts it reliably.",
      theory: "Coagulant demand is set by the colloid surface area and charge of that specific water, not by its turbidity alone. Two waters at the same NTU can need very different doses." },
    { key: "mass", no: "7", item: "Coagulant mass flow", symbol: "M_PAC", unit: "kg/h", expr: "${dose}*${Qin}/1000", formula: "M = C × Q / 1000",
      theory: "mg/L × m³/h = g/h; divide by 1000 for kg/h. This single conversion underlies every chemical dosing calculation in water treatment." },
    { key: "conc", no: "8", item: "Prepared solution strength", symbol: "n", unit: "%", val: 10, input: true },
    { key: "dens", no: "9", item: "Solution density", symbol: "ρ", unit: "kg/L", val: 1.2, input: true },
    { key: "vol", no: "10", item: "Dosing pump duty", symbol: "V_dose", unit: "L/h", expr: "${mass}/(${conc}/100)/${dens}", formula: "V = M / (n/100) / ρ",
      theory: "Convert the active mass to a solution mass by dividing by the strength, then to a volume by dividing by density. Pumps are selected on volume, so this conversion is where a dosing system is sized." },
    { key: "store", no: "11", item: "Storage time", symbol: "t_s", unit: "h", val: 10, input: true, note: "8–12 h working stock." },
    { key: "tank", no: "12", item: "Solution tank volume", symbol: "V_tank", unit: "m³", expr: "${vol}*${store}/1000", formula: "V_tank = V_dose × t_s / 1000" },
  ],

  clarifier: (r, p) => [
    ...feedRows(r),
    { section: "Surface loading governs performance" },
    { key: "rise", no: "2", item: "Surface loading rate", symbol: "v_s", unit: "m³/m²·h", val: n(p, "riseRate", 6), input: true,
      note: "Lamella 4–9; conventional 1–2.5.",
      theory: "A particle is captured when its settling velocity exceeds the upward water velocity. That upward velocity is flow divided by area, so only the area matters — a deeper tank at the same area does not settle better. This is the single most misunderstood point in clarifier design." },
    { key: "area", no: "3", item: "Total settling area", symbol: "A", unit: "m²", expr: "${Qin}/${rise}", formula: "A = Q_in / v_s",
      theory: "Rearranged from the definition of surface loading rate. Inclined plates multiply the effective area within the same plan area, which is why a lamella unit is so much smaller for the same duty." },
    { key: "trains", no: "4", item: "Number of trains", symbol: "N", unit: "-", val: n(p, "trains", 2), input: true,
      note: "2 × 50 % lets one be taken out for maintenance without stopping the plant." },
    { key: "aunit", no: "5", item: "Area per train", symbol: "A_unit", unit: "m²", expr: "${area}/${trains}", formula: "A_unit = A / N" },
    { section: "Solids and sludge" },
    { key: "ssin", no: "6", item: "Inlet suspended solids", symbol: "SS_in", unit: "mg/L", val: r.inlet.c.TSS, input: true },
    { key: "rem", no: "7", item: "Solids removal", symbol: "η", unit: "%", val: n(p, "tssRemoval", 90), input: true, note: "85–95 % with good coagulation." },
    { key: "ds", no: "8", item: "Dry solids produced", symbol: "M_DS", unit: "kg/h", expr: "${ssin}*${Qin}*${rem}/100/1000", formula: "M_DS = SS_in × Q × η / 100 / 1000",
      theory: "A mass balance on solids: what enters and is removed must leave as sludge. Coagulant hydroxide adds to this, typically 0.4–0.5 kg per kg of coagulant dosed." },
    { key: "bd", no: "9", item: "Sludge blowdown", symbol: "f_sl", unit: "% of feed", val: n(p, "sludgeFlowPct", 2), input: true },
    { key: "qsl", no: "10", item: "Sludge flow", symbol: "Q_sl", unit: "m³/h", expr: "${Qin}*${bd}/100", formula: "Q_sl = Q_in × f_sl / 100" },
    { key: "sludgeconc", no: "11", item: "Sludge concentration achieved", symbol: "C_sl", unit: "mg/L", expr: "${ds}*1000/${qsl}", formula: "C_sl = M_DS × 1000 / Q_sl",
      note: "Check this is physically reasonable — above about 3 % (30,000 mg/L) a gravity clarifier will not thicken further." },
  ],

  mmf: (r, p) => [
    ...feedRows(r),
    { section: "Filtration area" },
    { key: "rate", no: "2", item: "Filtration rate", symbol: "v_f", unit: "m/h", val: n(p, "filtrationRate", 10), input: true,
      note: "8–12 m/h for potable duty.",
      theory: "Filtration rate is the superficial velocity through the bed: flow divided by area. Higher rates drive particles deeper into the bed, so capture depends on the ratio of bed depth to grain size, not on the rate alone." },
    { key: "area", no: "3", item: "Total filtration area", symbol: "A", unit: "m²", expr: "${Qin}/${rate}", formula: "A = Q_in / v_f" },
    { key: "standby", no: "4", item: "Standby units", symbol: "N_sb", unit: "-", val: n(p, "standby", 1), input: true },
    { key: "duty", no: "5", item: "Duty units", symbol: "N_d", unit: "-", expr: "MAX(2,ROUNDUP(${area}/12,0))", formula: "N_d = max(2, ⌈A / 12⌉)",
      note: "12 m² per vessel is a practical maximum for a pressure filter that can be transported." },
    { key: "aunit", no: "6", item: "Area per unit", symbol: "A_u", unit: "m²", expr: "${area}/${duty}", formula: "A_u = A / N_d" },
    { key: "diam", no: "7", item: "Vessel diameter", symbol: "D", unit: "m", expr: "(4*${aunit}/PI())^0.5", formula: "D = √(4A_u / π)" },
    { key: "ratebw", no: "8", item: "Rate with one unit in backwash", symbol: "v_bw", unit: "m/h", expr: "${Qin}/(${aunit}*(${duty}-1))", formula: "v_bw = Q_in / (A_u × (N_d − 1))",
      note: "This is the case that must still meet the limit. If it does not, quality drops every time you backwash.",
      theory: "The classic filter sizing error: sizing on all units in service, then discovering the rate exceeds the limit whenever one is being washed." },
    { section: "Backwash" },
    { key: "bwpct", no: "9", item: "Backwash water", symbol: "f_bw", unit: "% of feed", val: n(p, "backwashPct", 3), input: true, note: "2–4 % of throughput." },
    { key: "qbw", no: "10", item: "Backwash flow", symbol: "Q_bw", unit: "m³/h", expr: "${Qin}*${bwpct}/100", formula: "Q_bw = Q_in × f_bw / 100",
      note: "Recovering this to the head of the works is usually the cheapest way to raise overall plant recovery." },
    { key: "bwrate", no: "11", item: "Backwash rate", symbol: "v_r", unit: "m/h", val: 40, input: true,
      note: "35–50 m/h, enough to fluidise the bed by 20–30 %.",
      theory: "Backwash must expand the bed so grains can move against each other. Too little and it does not clean; too much and media is carried out of the vessel." },
    { key: "qbwinst", no: "12", item: "Instantaneous backwash flow", symbol: "Q_r", unit: "m³/h", expr: "${aunit}*${bwrate}", formula: "Q_r = A_u × v_r",
      note: "This sizes the backwash pump, not the average figure above." },
  ],

  acf: (r, p) => [
    ...feedRows(r),
    { section: "Contact time is what matters" },
    { key: "rate", no: "2", item: "Filtration rate", symbol: "v_f", unit: "m/h", val: n(p, "filtrationRate", 10), input: true },
    { key: "depth", no: "3", item: "Bed depth", symbol: "h", unit: "m", val: n(p, "bedDepth", 1.5), input: true },
    { key: "ebct", no: "4", item: "Empty bed contact time", symbol: "EBCT", unit: "min", expr: "${depth}/${rate}*60", formula: "EBCT = h / v_f × 60",
      note: "6–10 min for dechlorination; 15–30 min for organics.",
      theory: "EBCT is the time water would take to pass through the bed volume if the media were not there. Chlorine destruction on carbon is fast and catalytic; organics adsorption is slow and capacity-limited, which is why the two duties need very different contact times." },
    { key: "area", no: "5", item: "Filtration area", symbol: "A", unit: "m²", expr: "${Qin}/${rate}", formula: "A = Q_in / v_f" },
    { key: "vol", no: "6", item: "Carbon volume", symbol: "V_c", unit: "m³", expr: "${area}*${depth}", formula: "V_c = A × h" },
    { key: "dens", no: "7", item: "Carbon bulk density", symbol: "ρ_c", unit: "kg/m³", val: 480, input: true },
    { key: "mass", no: "8", item: "Carbon charge", symbol: "M_c", unit: "kg", expr: "${vol}*${dens}", formula: "M_c = V_c × ρ_c" },
  ],

  uf: (r, p) => [
    ...feedRows(r),
    { section: "Membrane area from flux" },
    { key: "rec", no: "2", item: "Net recovery", symbol: "η", unit: "%", val: n(p, "recovery", 95), input: true,
      note: "90–96 %. Losses are backwash and chemically enhanced backwash." },
    { key: "Qp", no: "3", item: "Filtrate flow", symbol: "Q_p", unit: "m³/h", expr: "${Qin}*${rec}/100", formula: "Q_p = Q_in × η / 100" },
    { key: "flux", no: "4", item: "Design flux", symbol: "J", unit: "LMH", val: n(p, "flux", 65), input: true,
      note: "50–75 LMH on clarified surface water. Derate for high turbidity.",
      theory: "Flux is permeate flow per unit membrane area, in litres per m² per hour. It is the single most important membrane design decision: raise it and the cake compacts faster than backwash can remove it, so trans-membrane pressure climbs and cleaning frequency rises until the plant cannot keep up." },
    { key: "area", no: "5", item: "Membrane area required", symbol: "S", unit: "m²", expr: "${Qp}*1000/${flux}", formula: "S = Q_p × 1000 / J",
      theory: "Unit conversion: m³/h × 1000 gives L/h, divided by LMH gives m². Every membrane sizing calculation is this one line." },
    { key: "amod", no: "6", item: "Area per module", symbol: "S_1", unit: "m²", val: n(p, "moduleArea", 60), input: true, note: "From the membrane data sheet." },
    { key: "ncalc", no: "7", item: "Modules required (calculated)", symbol: "N_calc", unit: "-", expr: "${area}/${amod}", formula: "N_calc = S / S_1" },
    { key: "duty", no: "8", item: "Duty trains", symbol: "N_t", unit: "-", val: n(p, "dutyTrains", 4), input: true },
    { key: "sb", no: "9", item: "Standby trains", symbol: "N_sb", unit: "-", val: n(p, "standbyTrains", 1), input: true,
      note: "A standby train lets backwash and CIP happen without derating the plant." },
    { key: "npt", no: "10", item: "Modules per train", symbol: "N_1", unit: "-", expr: "ROUNDUP(${ncalc}/${duty},0)", formula: "N_1 = ⌈N_calc / N_t⌉" },
    { key: "ntot", no: "11", item: "Modules installed", symbol: "N_2", unit: "-", expr: "${npt}*(${duty}+${sb})", formula: "N_2 = N_1 × (N_t + N_sb)" },
    { key: "jrun", no: "12", item: "Actual operating flux", symbol: "J_run", unit: "LMH", expr: "${Qp}*1000/(${npt}*${duty}*${amod})", formula: "J_run = Q_p × 1000 / (N_1 × N_t × S_1)",
      note: "Check this against the design flux. Rounding up the module count always lowers the actual flux, which is the safe direction." },
    { section: "Backwash" },
    { key: "bwflux", no: "13", item: "Backwash flux", symbol: "J_bw", unit: "LMH", val: 100, input: true, note: "100–150 LMH." },
    { key: "qbw", no: "14", item: "Backwash flow per train", symbol: "Q_bw", unit: "m³/h", expr: "${bwflux}*${npt}*${amod}/1000", formula: "Q_bw = J_bw × N_1 × S_1 / 1000" },
    { key: "tbw", no: "15", item: "Backwash duration", symbol: "t_1", unit: "s", val: 60, input: true, note: "15–90 s." },
    { key: "vbw", no: "16", item: "Volume per backwash", symbol: "V_bw", unit: "m³/event", expr: "${qbw}*${tbw}/3600", formula: "V_bw = Q_bw × t_1 / 3600" },
  ],

  ro: roBuilder(75, 18, "Brackish"),
  swro: roBuilder(45, 14, "Seawater / high pressure"),
  nf: roBuilder(77, 20, "Nanofiltration"),

  edi: (r, p) => [
    ...feedRows(r),
    { section: "Feed must be inside the EDI limits" },
    { key: "hard", no: "2", item: "Feed hardness", symbol: "H_f", unit: "mg/L CaCO₃", val: hardnessAsCaCO3(r.inlet),
      note: "Must be below the limit in the next row. This is the number that governs whether a second RO pass is needed." },
    { key: "hlim", no: "3", item: "Manufacturer hardness limit", symbol: "H_lim", unit: "mg/L CaCO₃", val: n(p, "hardnessLimit", 1), input: true,
      theory: "Hardness precipitates inside the stack in the alkaline regions next to the membrane, and the fouling is largely irreversible. It is the principal way EDI modules are destroyed, which is why the limit is treated as absolute rather than as a target." },
    { key: "check", no: "4", item: "Margin on hardness limit", symbol: "H_lim / H_f", unit: "×", expr: "${hlim}/${hard}", formula: "margin = H_lim / H_f",
      note: "Below 1.0 the EDI is outside its specification. Add a second RO pass or a softener upstream." },
    { section: "Sizing" },
    { key: "rec", no: "5", item: "Recovery", symbol: "η", unit: "%", val: n(p, "recovery", 95), input: true, note: "90–95 %. Concentrate is normally recycled to the RO feed." },
    { key: "Qp", no: "6", item: "Product flow", symbol: "Q_p", unit: "m³/h", expr: "${Qin}*${rec}/100", formula: "Q_p = Q_in × η / 100" },
    { key: "cap", no: "7", item: "Capacity per module", symbol: "q_1", unit: "m³/h", val: n(p, "moduleCapacity", 7), input: true, note: "From the module data sheet." },
    { key: "nmod", no: "8", item: "Modules required", symbol: "N", unit: "-", expr: "ROUNDUP(${Qp}/${cap},0)", formula: "N = ⌈Q_p / q_1⌉" },
    { key: "skids", no: "9", item: "Parallel skids", symbol: "N_s", unit: "-", val: n(p, "trains", 2), input: true },
    { section: "Power" },
    { key: "sec", no: "10", item: "Specific DC energy", symbol: "e", unit: "kWh/m³", val: n(p, "specificEnergy", 0.15), input: true,
      note: "0.1–0.3 kWh/m³, rising with the ionic load being removed." },
    { key: "kw", no: "11", item: "DC power", symbol: "P", unit: "kW", expr: "${sec}*${Qp}", formula: "P = e × Q_p" },
  ],

  aao: (r, p) => [
    ...feedRows(r),
    { section: "Load, not flow, sizes a biological reactor" },
    { key: "bod", no: "2", item: "Inlet BOD", symbol: "S_0", unit: "mg/L", val: r.inlet.c.BOD, input: true },
    { key: "tn", no: "3", item: "Inlet total nitrogen", symbol: "TN_0", unit: "mg/L", val: r.inlet.c.TN, input: true },
    { key: "nh4", no: "4", item: "Inlet ammonia", symbol: "N_0", unit: "mg/L", val: r.inlet.c.NH4, input: true },
    { key: "load", no: "5", item: "BOD load", symbol: "L", unit: "kg/d", expr: "${bod}*${Qin}*24/1000", formula: "L = S_0 × Q × 24 / 1000",
      theory: "A reactor is sized on the mass of substrate it must oxidise per day, not on the flow. Two plants at the same flow and different strength need very different volumes." },
    { key: "ratio", no: "6", item: "BOD : TN ratio", symbol: "S_0/TN_0", unit: "-", expr: "${bod}/${tn}", formula: "ratio = S_0 / TN_0",
      note: "Below about 4 there is not enough carbon to denitrify and external carbon must be purchased.",
      theory: "Denitrification consumes organic carbon as the electron donor while nitrate is the electron acceptor. Roughly 4 kg of BOD is needed per kg of nitrate-nitrogen reduced, so the influent ratio decides whether nitrogen removal is achievable for free." },
    { section: "Volume" },
    { key: "hrt", no: "7", item: "Total retention time", symbol: "t", unit: "h", val: n(p, "hrtH", 14), input: true, note: "10–20 h, split roughly 1 : 2 : 5 anaerobic : anoxic : aerobic." },
    { key: "vol", no: "8", item: "Reactor volume", symbol: "V", unit: "m³", expr: "${Qin}*${hrt}", formula: "V = Q × t" },
    { key: "mlss", no: "9", item: "MLSS", symbol: "X", unit: "mg/L", val: n(p, "mlss", 4000), input: true, note: "3000–5000 mg/L for conventional activated sludge." },
    { key: "fm", no: "10", item: "F/M ratio", symbol: "F/M", unit: "kgBOD/kgMLSS·d", expr: "${load}/(${vol}*${mlss}/1000)", formula: "F/M = L / (V × X / 1000)",
      note: "0.1–0.25 is normal. Above 0.3 the sludge tends to bulk and the clarifier becomes the bottleneck.",
      theory: "Food to microorganism ratio is the substrate load per unit of biomass. It sets which organisms dominate: too high favours filamentous bacteria that settle badly, too low wastes volume and energy on endogenous respiration." },
    { section: "Oxygen and power" },
    { key: "o2c", no: "11", item: "Oxygen for carbon", symbol: "O_C", unit: "kgO₂/h", expr: "${load}/24*1.2", formula: "O_C = L / 24 × 1.2",
      theory: "About 1.2 kg of oxygen is consumed per kg of BOD oxidised, allowing for the fraction converted to biomass rather than to CO₂." },
    { key: "o2n", no: "12", item: "Oxygen for nitrification", symbol: "O_N", unit: "kgO₂/h", expr: "${nh4}*${Qin}/1000*${nrem}/100*4.57", formula: "O_N = N_0 × Q / 1000 × η_N / 100 × 4.57",
      theory: "Stoichiometric: oxidising ammonia to nitrate needs 4.57 kg O₂ per kg N. On a nitrogen-rich wastewater this term often exceeds the carbon demand and dominates the aeration bill." },
    { key: "nrem", no: "13", item: "Ammonia removal", symbol: "η_N", unit: "%", val: n(p, "nh4Removal", 97), input: true },
    { key: "o2", no: "14", item: "Total oxygen demand", symbol: "O_T", unit: "kgO₂/h", expr: "${o2c}+${o2n}", formula: "O_T = O_C + O_N" },
    { key: "aeff", no: "15", item: "Aeration efficiency", symbol: "AE", unit: "kgO₂/kWh", val: n(p, "aeUp", 2), input: true, note: "1.5–2.5 for fine bubble diffusers in a deep tank." },
    { key: "kw", no: "16", item: "Aeration power", symbol: "P", unit: "kW", expr: "${o2}/${aeff}", formula: "P = O_T / AE" },
    { section: "Sludge" },
    { key: "yield", no: "17", item: "Observed sludge yield", symbol: "Y", unit: "kgVSS/kgBOD", val: n(p, "yieldCoef", 0.45), input: true, note: "0.4–0.6, falling at long sludge age because of endogenous decay." },
    { key: "was", no: "18", item: "Waste sludge production", symbol: "P_X", unit: "kg/d", expr: "${load}*${yield}", formula: "P_X = L × Y" },
    { key: "srt", no: "19", item: "Sludge age", symbol: "SRT", unit: "d", val: n(p, "srtD", 15), input: true,
      note: "Design on the MINIMUM wastewater temperature, not the average.",
      theory: "Nitrifiers double slowly, and much more slowly when cold. If the sludge age is shorter than their doubling time they are washed out of the system and ammonia passes straight through, which is why nitrification fails in the cold months rather than on average." },
  ],

  thickener: (r, p) => [
    ...feedRows(r),
    { key: "ss", no: "2", item: "Inlet solids", symbol: "C_0", unit: "mg/L", val: r.inlet.c.TSS, input: true },
    { key: "ds", no: "3", item: "Dry solids load", symbol: "M", unit: "kg/d", expr: "${ss}*${Qin}*24/1000", formula: "M = C_0 × Q × 24 / 1000" },
    { key: "load", no: "4", item: "Solids loading rate", symbol: "SLR", unit: "kg/m²·d", val: n(p, "loading", 60), input: true, note: "40–80; lower for light biological sludge." },
    { key: "area", no: "5", item: "Thickener area", symbol: "A", unit: "m²", expr: "${ds}/${load}", formula: "A = M / SLR",
      theory: "Gravity thickening is limited by the rate at which solids can pass through the sludge blanket, which is an area-based flux — the same principle as clarification, applied to the solids rather than the water." },
    { key: "sup", no: "6", item: "Supernatant recovered", symbol: "f_s", unit: "% of feed", val: n(p, "supernatantPct", 50), input: true,
      note: "Returning this to the head of the works is one of the cheapest recovery levers available." },
    { key: "qsup", no: "7", item: "Supernatant flow", symbol: "Q_s", unit: "m³/h", expr: "${Qin}*${sup}/100", formula: "Q_s = Q_in × f_s / 100" },
  ],

  dewatering: (r, p) => [
    ...feedRows(r),
    { key: "ss", no: "2", item: "Inlet solids", symbol: "C_0", unit: "mg/L", val: r.inlet.c.TSS, input: true },
    { key: "ds", no: "3", item: "Dry solids load", symbol: "M", unit: "kg/h", expr: "${ss}*${Qin}/1000", formula: "M = C_0 × Q / 1000" },
    { key: "cap", no: "4", item: "Solids capture", symbol: "η", unit: "%", val: n(p, "solidsCapture", 96), input: true },
    { key: "cake", no: "5", item: "Cake dryness", symbol: "w", unit: "% DS", val: n(p, "cakeDryness", 30), input: true, note: "Filter press 25–35 %; centrifuge 18–25 %." },
    { key: "mcake", no: "6", item: "Cake mass", symbol: "M_cake", unit: "kg/h", expr: "${ds}*${cap}/100/(${cake}/100)", formula: "M_cake = M × η / w",
      theory: "The captured dry solids are a fraction w of the cake mass, so the wet cake is the dry solids divided by that fraction. Raising cake dryness from 20 to 30 % cuts the mass to be transported by a third." },
    { key: "poly", no: "7", item: "Polymer dose", symbol: "d_p", unit: "kg/t DS", val: n(p, "polymerDose", 4), input: true, note: "3–6 kg/t; confirm by test." },
    { key: "mpoly", no: "8", item: "Polymer consumption", symbol: "M_p", unit: "kg/h", expr: "${ds}/1000*${poly}", formula: "M_p = M / 1000 × d_p" },
  ],

  mvr: (r, p) => [
    ...feedRows(r),
    { key: "evap", no: "2", item: "Water evaporated", symbol: "f_e", unit: "% of feed", val: n(p, "waterEvapPct", 70), input: true },
    { key: "Qd", no: "3", item: "Distillate flow", symbol: "Q_d", unit: "m³/h", expr: "${Qin}*${evap}/100", formula: "Q_d = Q_in × f_e / 100" },
    { key: "sec", no: "4", item: "Specific energy", symbol: "e", unit: "kWh/m³ evaporated", val: n(p, "specificEnergy", 25), input: true,
      note: "15–40 kWh/m³ depending on compression ratio.",
      theory: "In mechanical vapour recompression the latent heat is reused: the compressor raises the vapour's saturation temperature so it can condense against the boiling liquid. Only the compression work is paid for, which is why MVR uses a fraction of a once-through evaporator — but still an order of magnitude more than a membrane." },
    { key: "kw", no: "5", item: "Compressor power", symbol: "P", unit: "kW", expr: "${sec}*${Qd}", formula: "P = e × Q_d" },
    { key: "cmp", no: "6", item: "Compare with RO", symbol: "-", unit: "kWh/m³", val: 4,
      note: "RO removes water at roughly 3–5 kWh/m³. Always concentrate as far as possible by membrane before evaporating." },
  ],

  pump: (r, p) => [
    ...feedRows(r),
    { key: "head", no: "2", item: "Total head", symbol: "H", unit: "m", val: n(p, "headM", 30), input: true, note: "Static lift plus friction plus the pressure required downstream." },
    { key: "eff", no: "3", item: "Pump efficiency", symbol: "η", unit: "-", val: n(p, "pumpEff", 0.72), input: true, note: "0.65–0.80; large pumps at the top of the band." },
    { key: "kw", no: "4", item: "Shaft power", symbol: "P", unit: "kW", expr: "1000*9.81*(${Qin}/3600)*${head}/${eff}/1000", formula: "P = ρ g Q H / η",
      theory: "Hydraulic power is the rate of work done on the fluid: density × gravity × volumetric flow × head. Dividing by efficiency gives shaft power. Note the inverse relationship with efficiency — a pump at 0.55 instead of 0.75 uses 36 % more energy for the same duty, every hour for twenty years." },
    { key: "std", no: "5", item: "Standby units", symbol: "N_sb", unit: "-", val: n(p, "standby", 1), input: true },
  ],
};

function roBuilder(defRec: number, defFlux: number, label: string): Builder {
  return (r, p) => [
    ...feedRows(r),
    { section: `${label} membrane sizing` },
    { key: "rec", no: "2", item: "Recovery", symbol: "η", unit: "%", val: n(p, "recovery", defRec), input: true,
      note: label === "Seawater / high pressure" ? "35–50 %, limited by osmotic pressure." : "70–85 %, limited by scaling in the concentrate.",
      theory: "Recovery is permeate divided by feed. What limits it depends on the salinity: on brackish water the first salt to reach saturation in the concentrate, on seawater the osmotic pressure itself." },
    { key: "Qp", no: "3", item: "Permeate flow", symbol: "Q_p", unit: "m³/h", expr: "${Qin}*${rec}/100", formula: "Q_p = Q_in × η / 100" },
    { key: "Qc", no: "4", item: "Concentrate flow", symbol: "Q_c", unit: "m³/h", expr: "${Qin}-${Qp}", formula: "Q_c = Q_in − Q_p" },
    { key: "cf", no: "5", item: "Concentration factor", symbol: "CF", unit: "×", expr: "1/(1-${rec}/100)", formula: "CF = 1 / (1 − η)",
      theory: "A mass balance on salt: everything rejected leaves in a smaller volume. At 75 % recovery the concentrate is four times the feed concentration, which is what drives scaling." },
    { key: "lm", no: "6", item: "Log-mean concentration factor", symbol: "LM", unit: "×", expr: "LN(1/(1-${rec}/100))/(${rec}/100)", formula: "LM = ln(1/(1−η)) / η",
      note: "This is why permeate quality falls as recovery rises, even though the membrane has not changed.",
      theory: "The membrane does not see the feed concentration; it sees a concentration rising along the pressure vessel from feed to brine. The log-mean is the correct average for an exponential rise, and it is the factor most often left out of a hand calculation — which is why hand estimates of permeate quality come out optimistic." },
    { key: "flux", no: "7", item: "Design flux", symbol: "J", unit: "LMH", val: n(p, "flux", defFlux), input: true,
      note: label === "Seawater / high pressure" ? "12–17 LMH; polarisation is severe at high salinity." : "15–20 LMH on surface water with UF pre-treatment." },
    { key: "area", no: "8", item: "Membrane area required", symbol: "S", unit: "m²", expr: "${Qp}*1000/${flux}", formula: "S = Q_p × 1000 / J" },
    { key: "ael", no: "9", item: "Area per element", symbol: "S_1", unit: "m²", val: n(p, "elementArea", 37.2), input: true, note: "37.2 m² for a standard 8040 element." },
    { key: "nel", no: "10", item: "Elements required", symbol: "N_e", unit: "-", expr: "ROUNDUP(${area}/${ael},0)", formula: "N_e = ⌈S / S_1⌉" },
    { key: "epv", no: "11", item: "Elements per vessel", symbol: "n_v", unit: "-", val: n(p, "elementsPerVessel", 6), input: true, note: "6 is standard; 7 gives a longer flow path." },
    { key: "npv", no: "12", item: "Pressure vessels", symbol: "N_v", unit: "-", expr: "ROUNDUP(${nel}/${epv},0)", formula: "N_v = ⌈N_e / n_v⌉" },
    { key: "jrun", no: "13", item: "Actual flux", symbol: "J_run", unit: "LMH", expr: "${Qp}*1000/(${npv}*${epv}*${ael})", formula: "J_run = Q_p × 1000 / (N_v × n_v × S_1)" },
    { section: "Pressure and power" },
    { key: "tds", no: "14", item: "Feed TDS", symbol: "C_f", unit: "mg/L", val: r.inlet.c.TDS, input: true },
    { key: "osm", no: "15", item: "Feed osmotic pressure", symbol: "π_f", unit: "bar", expr: "${tds}/1000*0.78", formula: "π ≈ TDS / 1000 × 0.78",
      theory: "Van 't Hoff: osmotic pressure is proportional to the molar concentration of dissolved species. For a mixed natural water, 1000 mg/L gives roughly 0.78 bar at 25 °C. Seawater at 35,000 mg/L is therefore about 27 bar before any driving force is applied." },
    { key: "osmc", no: "16", item: "Concentrate osmotic pressure", symbol: "π_c", unit: "bar", expr: "${osm}*${cf}", formula: "π_c = π_f × CF" },
    { key: "ndp", no: "17", item: "Net driving pressure", symbol: "NDP", unit: "bar", val: 2.5, input: true, note: "The excess over osmotic pressure that actually produces flow." },
    { key: "press", no: "18", item: "Feed pressure required", symbol: "p", unit: "bar", expr: "(${osm}+${osmc})/2+${ndp}+1.5", formula: "p = (π_f + π_c)/2 + NDP + Δp_loss",
      theory: "The pump must overcome the average osmotic pressure along the vessel, provide the net driving pressure, and cover friction losses. This is why recovery and pressure are coupled: pushing recovery up raises the concentrate osmotic pressure and therefore the pressure needed." },
    { key: "peff", no: "19", item: "High pressure pump efficiency", symbol: "η_p", unit: "-", val: n(p, "pumpEff", 0.75), input: true },
    { key: "kw", no: "20", item: "Pump shaft power", symbol: "P", unit: "kW", expr: "1000*9.81*(${Qin}/3600)*(${press}*10.2)/${peff}/1000", formula: "P = ρ g Q (p × 10.2) / η_p",
      note: "10.2 converts bar to metres of head." },
    { key: "sec", no: "21", item: "Specific energy", symbol: "e", unit: "kWh/m³ permeate", expr: "${kw}/${Qp}", formula: "e = P / Q_p",
      note: "The number to compare designs on. Add an energy recovery device on seawater duty and this roughly halves." },
    { section: "Scaling check" },
    { key: "hardf", no: "22", item: "Feed hardness", symbol: "H_f", unit: "mg/L CaCO₃", val: hardnessAsCaCO3(r.inlet), input: true },
    { key: "hardc", no: "23", item: "Concentrate hardness", symbol: "H_c", unit: "mg/L CaCO₃", expr: "${hardf}*${cf}", formula: "H_c = H_f × CF",
      note: "Above roughly 900 mg/L as CaCO₃ a competent antiscalant is essential, and a full scaling projection should be run in the membrane supplier's software." },
  ];
}

export function calcRowsFor(r: NodeResult, p: Params): CalcRow[] {
  const b = BUILDERS[r.type] ?? ADVANCED_BUILDERS[r.type];
  if (b) return b(r, p);
  // Generic fallback: at minimum document the hydraulic duty and what leaves.
  const rows: CalcRow[] = [...feedRows(r)];
  let i = 2;
  for (const [port, st] of Object.entries(r.outlets)) {
    rows.push({
      key: `out${i}`, no: String(i), item: `Outlet flow — ${port}`, symbol: `Q_${port}`, unit: "m³/h",
      val: (st as Stream).flow,
      note: "Taken from the simulation; no sizing recipe is written for this unit type yet.",
    });
    i++;
  }
  return rows;
}

/** Tank-type units share one recipe. */
for (const t of ["rawtank", "eqtank", "producttank"]) {
  BUILDERS[t] = tankRows(t === "rawtank" ? 12 : t === "eqtank" ? 8 : 8);
}
export { BUILDERS };
