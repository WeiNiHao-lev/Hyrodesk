import { Component, FeedSpec, Stream } from "./types";
import {
  alkalinityAsCaCO3, hardnessAsCaCO3, ionicBalanceErrorPct, makeStream, tdsFromIons,
} from "./stream";

/* ================================================================ FEED VALIDATION */

export type Severity = "fail" | "warn" | "info" | "pass";

export interface Finding {
  severity: Severity;
  title: string;
  /** What the numbers actually are. */
  detail: string;
  /** What it means and what to do about it. */
  action: string;
  /** Short teaching note: why this check exists at all. */
  why?: string;
}

const TONE: Record<Severity, number> = { fail: 0, warn: 1, info: 2, pass: 3 };

/**
 * Runs the checks a competent engineer performs before trusting a laboratory
 * sheet. Every one of these caught a real error in the South Sumatra methanol
 * project data, which is why they are here rather than in a checklist someone
 * has to remember.
 */
export function validateFeed(feed: FeedSpec): Finding[] {
  const f: Finding[] = [];
  const s = makeStream(feed.flow, feed.c, { T: feed.T, pH: feed.pH });
  const tdsIons = tdsFromIons(s);
  const tdsEntered = feed.c.TDS ?? 0;
  const hard = hardnessAsCaCO3(s);
  const alk = alkalinityAsCaCO3(s);
  const ionErr = ionicBalanceErrorPct(s);
  const cond = feed.conductivityUScm ?? 0;

  /* --- 1. ionic balance ------------------------------------------------- */
  const anyIons = tdsIons > 0;
  if (anyIons) {
    const abs = Math.abs(ionErr);
    if (abs > 5) {
      f.push({
        severity: abs > 15 ? "fail" : "warn",
        title: "Ionic balance error outside tolerance",
        detail: `Balance error is ${ionErr >= 0 ? "+" : ""}${ionErr.toFixed(1)} % against an acceptable ±5 %.`,
        action:
          ionErr > 0
            ? "Cations exceed anions, so an anion is missing or understated. Check chloride first — it is the ion most often left off a laboratory sheet."
            : "Anions exceed cations, so a cation is missing or understated. Check sodium and potassium.",
        why:
          "Water must be electrically neutral. If the analysis does not balance it is not internally valid, and every quantity derived from the anion set — scaling indices, corrosion assessment, cooling water saturation — inherits that error.",
      });
    } else {
      f.push({
        severity: "pass",
        title: "Ionic balance within tolerance",
        detail: `Balance error ${ionErr >= 0 ? "+" : ""}${ionErr.toFixed(1)} %, inside ±5 %.`,
        action: "No action required.",
      });
    }
  }

  /* --- 2. chloride missing ---------------------------------------------- */
  if (anyIons && (feed.c.Cl ?? 0) === 0) {
    f.push({
      severity: "fail",
      title: "Chloride not analysed",
      detail: "Chloride is zero while other ions are present.",
      action:
        "Request a chloride determination. Without it the anion balance cannot close, and RO scaling projections, material selection and cooling water indices are all unreliable.",
      why: "Chloride is usually one of the two largest anions. Omitting it is the single most common defect in a water analysis.",
    });
  }

  /* --- 3. TDS consistency with the ions --------------------------------- */
  if (tdsEntered > 0 && tdsIons > 0) {
    const ratio = tdsEntered / tdsIons;
    if (ratio < 0.5 || ratio > 2) {
      f.push({
        severity: "fail",
        title: "Entered TDS contradicts the sum of ions",
        detail: `TDS entered ${tdsEntered.toFixed(1)} mg/L, but the listed ions already sum to ${tdsIons.toFixed(1)} mg/L.`,
        action:
          ratio < 0.5
            ? "The TDS figure is too low to be physically possible. Reject it and use the ion sum, or obtain a repeat analysis."
            : "The TDS figure is far above the ion sum, so a major ion is missing from the analysis.",
        why:
          "TDS is the sum of everything dissolved. It cannot be less than the ions you have already measured — that is arithmetic, not chemistry.",
      });
    }
  }

  /* --- 4. TDS versus conductivity --------------------------------------- */
  if (cond > 0) {
    const lo = cond * 0.55;
    const hi = cond * 0.9;
    const reference = tdsEntered > 0 ? tdsEntered : tdsIons;
    if (reference > 0 && (reference < lo * 0.7 || reference > hi * 1.3)) {
      f.push({
        severity: "warn",
        title: "TDS inconsistent with conductivity",
        detail: `Conductivity ${cond.toFixed(0)} µS/cm implies TDS of roughly ${lo.toFixed(0)}–${hi.toFixed(0)} mg/L; the analysis gives ${reference.toFixed(0)} mg/L.`,
        action: "Confirm both figures with the laboratory. One of them is wrong.",
        why:
          "For natural fresh water at 25 °C, 1 µS/cm corresponds to roughly 0.55–0.90 mg/L of dissolved solids (GB/T 1576 Annex C.1.4.2). A result far outside that window is not credible.",
      });
    }
  } else {
    f.push({
      severity: "info",
      title: "Conductivity not entered",
      detail: "No conductivity value provided.",
      action: "Add it if the laboratory reported one — it is the quickest independent cross-check on the TDS figure.",
    });
  }

  /* --- 5. carbonate at low pH ------------------------------------------- */
  if ((feed.c.CO3 ?? 0) > 1 && feed.pH < 8.3) {
    f.push({
      severity: "fail",
      title: "Carbonate reported below pH 8.3",
      detail: `${(feed.c.CO3 ?? 0).toFixed(1)} mg/L of carbonate reported at pH ${feed.pH.toFixed(1)}.`,
      action: "Reject the carbonate figure. Move that alkalinity to bicarbonate or request a repeat analysis.",
      why:
        "Below about pH 8.3 essentially all inorganic carbon exists as dissolved CO₂ and bicarbonate. A significant carbonate concentration at pH 6–7 is chemically impossible.",
    });
  }

  /* --- 6. hardness character and its process consequence ---------------- */
  if (hard > 0) {
    const nonCarb = Math.max(0, hard - alk);
    const frac = nonCarb / hard;
    if (frac > 0.6) {
      f.push({
        severity: "info",
        title: "Hardness is predominantly non-carbonate",
        detail: `Total hardness ${hard.toFixed(1)} mg/L CaCO₃, alkalinity ${alk.toFixed(1)} mg/L CaCO₃, so ${(frac * 100).toFixed(0)} % is non-carbonate (permanent).`,
        action:
          "Rule out lime softening. Use membrane treatment or ion exchange for hardness removal on this water.",
        why:
          "Lime softening precipitates carbonate hardness only. Where the majority is non-carbonate, lime would leave most of the hardness untouched — this is a process-selection consequence, not a detail.",
      });
    }
  }

  /* --- 7. silica plausibility ------------------------------------------- */
  const si = feed.c.SiO2 ?? 0;
  if (si > 0 && si < 1 && tdsIons > 50) {
    f.push({
      severity: "warn",
      title: "Silica implausibly low",
      detail: `Silica reported as ${si} mg/L.`,
      action: "Request a repeat silica determination before finalising any ion exchange or EDI sizing.",
      why:
        "Tropical surface waters typically carry 10–30 mg/L of silica. A value three orders of magnitude below that is far more likely to be a units or transcription error than a real result. Silica governs mixed-bed run length and EDI current demand.",
    });
  } else if (si === 0) {
    f.push({
      severity: "warn",
      title: "Silica not analysed",
      detail: "No silica value entered.",
      action: "Request it. Silica is the parameter that most often limits ion exchange run length and RO recovery.",
    });
  }

  /* --- 8. missing parameters -------------------------------------------- */
  const missing: string[] = [];
  if (feed.turbidityNTU === 0) missing.push("turbidity (NTU)");
  if ((feed.c.TOC ?? 0) === 0) missing.push("TOC");
  if ((feed.c.TSS ?? 0) === 0) missing.push("TSS");
  if (missing.length > 0) {
    f.push({
      severity: "warn",
      title: "Parameters missing from the analysis",
      detail: `Not provided: ${missing.join(", ")}.`,
      action:
        "Obtain them before sizing. Turbidity governs clarifier and filter design; TOC governs carbon sizing and membrane organic fouling.",
      why:
        "TSS is not a substitute for turbidity — clarifiers and filters are designed on turbidity, and the relationship between the two is water-specific.",
    });
  }

  /* --- 9. single sample warning ----------------------------------------- */
  f.push({
    severity: "info",
    title: "Seasonal variation",
    detail: "This tool works from a single set of values.",
    action:
      "Confirm whether the analysis is wet season, dry season or an average. Design the clarifier and filters on the wet-season turbidity peak, not on the mean.",
    why:
      "For a surface water intake, peak turbidity is the binding design case. A plant sized on the annual average will pass solids for several months of every year.",
  });

  return f.sort((a, b) => TONE[a.severity] - TONE[b.severity]);
}

/* ================================================================ COMPLIANCE */

export interface StructuredLimit {
  label: string;
  /** Component key, or a derived metric name. */
  key: Component | "hardness" | "alkalinity" | "conductivity" | "turbidity" | "pH";
  op: "<=" | ">=" | "range";
  value: number;
  max?: number;
  unit: string;
  /** True where the limit is met by equipment outside the WTP battery limit. */
  outsideScope?: boolean;
  note?: string;
}

export const STANDARD_LIMITS: Record<string, StructuredLimit[]> = {
  gbt1576: [
    { label: "Turbidity", key: "turbidity", op: "<=", value: 5.0, unit: "FTU" },
    { label: "Total hardness", key: "hardness", op: "<=", value: 0.25, unit: "mg/L CaCO₃" },
    { label: "Conductivity (25 °C)", key: "conductivity", op: "<=", value: 80.0, unit: "µS/cm" },
    { label: "Iron", key: "Fe", op: "<=", value: 0.1, unit: "mg/L" },
    { label: "Oil", key: "Oil", op: "<=", value: 2.0, unit: "mg/L" },
    {
      label: "pH (25 °C)", key: "pH", op: "range", value: 8.5, max: 10.5, unit: "-",
      outsideScope: true, note: "Achieved by boiler-island conditioning, not by the WTP.",
    },
  ],
  gbt12145: [
    { label: "Conductivity", key: "conductivity", op: "<=", value: 0.3, unit: "µS/cm" },
    { label: "Silica", key: "SiO2", op: "<=", value: 0.02, unit: "mg/L" },
    { label: "Iron", key: "Fe", op: "<=", value: 0.02, unit: "mg/L" },
    { label: "TOC", key: "TOC", op: "<=", value: 0.2, unit: "mg/L" },
    { label: "Total hardness", key: "hardness", op: "<=", value: 0.1, unit: "mg/L CaCO₃" },
  ],
  permenkes: [
    { label: "Turbidity", key: "turbidity", op: "<=", value: 3.0, unit: "NTU" },
    { label: "TDS", key: "TDS", op: "<=", value: 500, unit: "mg/L" },
    { label: "pH", key: "pH", op: "range", value: 6.5, max: 8.5, unit: "-" },
    { label: "Iron", key: "Fe", op: "<=", value: 0.3, unit: "mg/L" },
    { label: "Manganese", key: "Mn", op: "<=", value: 0.4, unit: "mg/L" },
    { label: "Nitrate", key: "NO3", op: "<=", value: 50, unit: "mg/L" },
    { label: "Total hardness", key: "hardness", op: "<=", value: 500, unit: "mg/L CaCO₃" },
  ],
  permenlhk: [
    { label: "COD", key: "COD", op: "<=", value: 100, unit: "mg/L" },
    { label: "BOD", key: "BOD", op: "<=", value: 50, unit: "mg/L" },
    { label: "TSS", key: "TSS", op: "<=", value: 100, unit: "mg/L" },
    { label: "Ammonia", key: "NH4", op: "<=", value: 10, unit: "mg/L" },
    { label: "Total nitrogen", key: "TN", op: "<=", value: 20, unit: "mg/L" },
    { label: "Total phosphorus", key: "TP", op: "<=", value: 2, unit: "mg/L" },
    { label: "Oil and grease", key: "Oil", op: "<=", value: 10, unit: "mg/L" },
    { label: "pH", key: "pH", op: "range", value: 6.0, max: 9.0, unit: "-" },
  ],
  cooling: [
    { label: "Turbidity", key: "turbidity", op: "<=", value: 5.0, unit: "NTU" },
    { label: "Total hardness", key: "hardness", op: "<=", value: 250, unit: "mg/L CaCO₃" },
    { label: "Oil", key: "Oil", op: "<=", value: 1.0, unit: "mg/L" },
    { label: "Silica", key: "SiO2", op: "<=", value: 150, unit: "mg/L" },
  ],
};

export interface ComplianceRow {
  label: string;
  limitText: string;
  actual: number;
  actualText: string;
  pass: boolean;
  marginText: string;
  outsideScope?: boolean;
  note?: string;
}

function metricOf(s: Stream, key: StructuredLimit["key"]): number {
  switch (key) {
    case "hardness": return hardnessAsCaCO3(s);
    case "alkalinity": return alkalinityAsCaCO3(s);
    // TDS/0.65 is the inverse of the conversion used to derive TDS from conductivity.
    case "conductivity": return Math.max(s.c.TDS, tdsFromIons(s)) / 0.65;
    case "turbidity": return s.extras.turbidityNTU;
    case "pH": return s.pH;
    default: return s.c[key as Component] ?? 0;
  }
}

export function checkCompliance(s: Stream, standardKey: string): ComplianceRow[] {
  const limits = STANDARD_LIMITS[standardKey];
  if (!limits) return [];
  return limits.map((l) => {
    const actual = metricOf(s, l.key);
    let pass: boolean;
    let limitText: string;
    let marginText: string;
    if (l.op === "range") {
      pass = actual >= l.value && actual <= (l.max ?? Infinity);
      limitText = `${l.value} – ${l.max} ${l.unit}`;
      marginText = pass ? "within range" : actual < l.value ? "below range" : "above range";
    } else if (l.op === "<=") {
      pass = actual <= l.value;
      limitText = `≤ ${l.value} ${l.unit}`;
      const ratio = actual > 0 ? l.value / actual : Infinity;
      marginText = pass
        ? ratio > 1000 ? "> 1000 × margin" : `${ratio.toFixed(ratio < 10 ? 1 : 0)} × margin`
        : `${(actual / l.value).toFixed(1)} × over limit`;
    } else {
      pass = actual >= l.value;
      limitText = `≥ ${l.value} ${l.unit}`;
      marginText = pass ? "met" : "below limit";
    }
    return {
      label: l.label,
      limitText,
      actual,
      actualText: fmtNum(actual),
      pass,
      marginText,
      outsideScope: l.outsideScope,
      note: l.note,
    };
  });
}

function fmtNum(v: number): string {
  if (!Number.isFinite(v)) return "-";
  if (v === 0) return "0";
  if (v >= 1000) return v.toFixed(0);
  if (v >= 10) return v.toFixed(1);
  if (v >= 1) return v.toFixed(2);
  if (v >= 0.001) return v.toFixed(4);
  return v.toExponential(1);
}

/* ================================================================ PROCESS ADVISOR */

export interface Recommendation {
  step: string;
  reason: string;
  /** Alternatives considered and why they were not chosen. */
  alternative?: string;
}

export interface AdvisorResult {
  target: string;
  train: Recommendation[];
  cautions: string[];
}

export const ADVISOR_TARGETS = [
  { key: "demin", label: "Demineralised water (boiler feed)" },
  { key: "potable", label: "Potable water" },
  { key: "cooling", label: "Cooling tower make-up" },
  { key: "process", label: "General process / service water" },
  { key: "reuse", label: "Wastewater treatment for discharge or reuse" },
  { key: "desal", label: "Desalination / brine concentration" },
] as const;

/**
 * Rule-based process selection guidance. It reads the feed the same way an
 * experienced engineer does — what is actually in this water, and what does
 * that force me to do — and shows the reasoning, not just the answer.
 */
export function adviseProcess(feed: FeedSpec, target: string): AdvisorResult {
  const s = makeStream(feed.flow, feed.c, { T: feed.T, pH: feed.pH });
  const hard = hardnessAsCaCO3(s);
  const alk = alkalinityAsCaCO3(s);
  const nonCarb = Math.max(0, hard - alk);
  const tds = Math.max(feed.c.TDS ?? 0, tdsFromIons(s));
  const turb = feed.turbidityNTU;
  const tss = feed.c.TSS ?? 0;
  const bod = feed.c.BOD ?? 0;
  const cod = feed.c.COD ?? 0;
  const tn = feed.c.TN ?? 0;
  const oil = feed.c.Oil ?? 0;
  const toc = feed.c.TOC ?? 0;

  const train: Recommendation[] = [];
  const cautions: string[] = [];

  const isWastewater = target === "reuse" || bod > 50 || cod > 150;
  const isSaline = tds > 5000;

  /* ---------- intake and buffering ---------- */
  train.push({
    step: "Intake, screening and buffer storage",
    reason: `Feed is ${feed.name}. A buffer of 8–24 h damps quality swings and lets coarse silt settle before the plant sees it.`,
  });

  /* ---------- wastewater route ---------- */
  if (isWastewater) {
    train.push({
      step: "Equalisation tank",
      reason: `BOD ${bod.toFixed(0)} mg/L and COD ${cod.toFixed(0)} mg/L. Biology cannot tolerate surges in flow or load, so equalisation comes before any reactor.`,
    });
    if (oil > 20) {
      train.push({
        step: "Oil removal (DAF or API separator)",
        reason: `Oil at ${oil.toFixed(0)} mg/L will coat the biomass and blind membranes downstream.`,
        alternative: "A clarifier will not remove free oil — it floats rather than settles.",
      });
    }
    const bodTn = tn > 0 ? bod / tn : Infinity;
    train.push({
      step: cod > 3000 ? "A/O biological treatment (acclimatised)" : "AAO or MSBR biological treatment",
      reason:
        cod > 3000
          ? `COD ${cod.toFixed(0)} mg/L is high-strength. This needs long retention and an acclimatised biomass, not a municipal design.`
          : `BOD ${bod.toFixed(0)} and TN ${tn.toFixed(0)} mg/L call for combined carbon and nutrient removal.`,
    });
    if (tn > 10 && bodTn < 4) {
      cautions.push(
        `BOD:TN ratio is ${bodTn.toFixed(1)}, below the 4:1 needed to drive denitrification. Budget for an external carbon source — this is a recurring operating cost that does not appear on a process diagram.`,
      );
    }
    train.push({
      step: "Secondary clarification",
      reason: "Separates the biomass from the treated water and returns it to the reactor.",
    });
    if (tn > 15) {
      train.push({
        step: "Denitrification filter",
        reason: `TN of ${tn.toFixed(0)} mg/L will not reach a tight discharge limit on secondary treatment alone.`,
      });
    }
    train.push({
      step: "Disinfection",
      reason: "Required before discharge or reuse.",
    });
    if (target === "reuse") {
      train.push({
        step: "Ultrafiltration then RO",
        reason: "Reuse to process quality needs a physical barrier plus desalination of the accumulated salts.",
      });
    }
    train.push({
      step: "Sludge thickening and dewatering",
      reason: "Biological treatment produces waste sludge continuously. Return the supernatant and filtrate to the head of the works.",
    });
    return { target, train, cautions };
  }

  /* ---------- clean water route: solids ---------- */
  if (turb > 5 || tss > 10) {
    train.push({
      step: "Coagulation and flocculation",
      reason: `Turbidity ${turb.toFixed(0)} NTU and TSS ${tss.toFixed(0)} mg/L. Colloids will not settle without charge neutralisation.`,
    });
    if (alk < 50) {
      cautions.push(
        `Alkalinity is only ${alk.toFixed(0)} mg/L as CaCO₃. Coagulant will depress the pH and caustic dosing will be needed to hold the coagulation window — a real and often underestimated operating cost.`,
      );
    }
    const algal = target === "desal" || isSaline;
    train.push({
      step: algal ? "Sedimentation followed by dissolved air flotation" : "Lamella clarifier",
      reason: algal
        ? "Seawater carries algae and light organics that float rather than settle; DAF catches what sedimentation leaves."
        : "Inclined-plate settling gives the required area in a small footprint.",
      alternative: algal ? undefined : "DAF would be preferred if the solids were light or oily.",
    });
  }

  /* ---------- filtration ---------- */
  const needsMembrane = target === "demin" || target === "desal" || tds > 1000;
  if (needsMembrane) {
    train.push({
      step: "Ultrafiltration",
      reason:
        "RO recovery can only be relied upon behind a dependable SDI below 3. UF is an absolute barrier, so it holds that regardless of upstream fluctuation.",
      alternative:
        "Multimedia filtration is cheaper but cannot guarantee SDI when the feed varies — acceptable only on a stable source or a tight budget.",
    });
  } else {
    train.push({
      step: "Multimedia filtration",
      reason: "Polishes the clarified water. Sufficient where no membrane follows.",
    });
  }

  /* ---------- target specific ---------- */
  if (target === "potable") {
    train.push({ step: "Activated carbon", reason: "Taste, odour and organics removal." });
    train.push({ step: "Disinfection with a residual", reason: "Required for distribution; chlorine leaves a residual, UV does not." });
    if (hard > 500) cautions.push(`Hardness ${hard.toFixed(0)} mg/L as CaCO₃ exceeds the usual potable guideline — consider partial softening.`);
    return { target, train, cautions };
  }

  if (target === "cooling") {
    if (hard > 250) {
      cautions.push(
        `Hardness ${hard.toFixed(0)} mg/L as CaCO₃ will limit achievable cycles of concentration. Expect antiscalant and probably acid dosing; side-stream softening may be needed for higher cycles.`,
      );
    }
    train.push({
      step: "Direct to cooling tower basin",
      reason: "Cooling make-up needs clarity and biological control, not desalination. Conditioning is the cooling water package's responsibility.",
    });
    return { target, train, cautions };
  }

  if (target === "process") {
    train.push({ step: "Direct to service water storage", reason: "Filtered water is sufficient for general service duty." });
    return { target, train, cautions };
  }

  /* ---------- desalination / demin ---------- */
  train.push({
    step: "Activated carbon and cartridge filtration",
    reason: "Removes free chlorine, which destroys polyamide membranes irreversibly, and gives a final particulate guard.",
  });

  if (target === "desal" || isSaline) {
    if (nonCarb / Math.max(hard, 1) > 0.5 || hard > 500) {
      train.push({
        step: "Nanofiltration for salt separation",
        reason:
          "NF rejects calcium, magnesium and sulphate while passing sodium and chloride. Removing the scale formers first is what lets the downstream RO reach a high concentration factor.",
      });
    }
    train.push({
      step: "High-pressure RO with energy recovery",
      reason: `Feed TDS around ${tds.toFixed(0)} mg/L. At seawater salinity the concentrate carries most of the pressure energy, so an energy recovery device typically halves specific energy consumption.`,
    });
    cautions.push("Recovery on seawater RO is limited to about 35–50 % by osmotic pressure, not by scaling.");
    return { target, train, cautions };
  }

  /* ---------- demineralisation ---------- */
  train.push({
    step: "Reverse osmosis, pass 1",
    reason: `Removes hardness, TDS, silica and organics in one step. Feed hardness is ${hard.toFixed(1)} mg/L as CaCO₃ and TDS about ${tds.toFixed(0)} mg/L.`,
  });

  // The decisive rule: can single-pass permeate feed an EDI?
  const p1Hardness = hard * 0.005 * 2.012; // 99.5 % divalent rejection at 80 % recovery
  if (p1Hardness > 1.0) {
    train.push({
      step: "Interstage caustic dosing and RO pass 2",
      reason:
        `Single-pass permeate hardness would be about ${p1Hardness.toFixed(2)} mg/L as CaCO₃, above the 1.0 mg/L that EDI tolerates. ` +
        "A second pass brings it to roughly 0.02 mg/L. Caustic between the passes converts CO₂ to bicarbonate so the second pass rejects it.",
      alternative:
        "A sodium softener ahead of the RO would also protect the EDI, but reintroduces salt regeneration and a brine stream — which is what EDI was chosen to avoid.",
    });
    cautions.push(
      `The second RO pass is driven by feed hardness of ${hard.toFixed(0)} mg/L as CaCO₃. If a fresh analysis shows lower hardness, the second pass can be deleted — check this before finalising the cost.`,
    );
  } else {
    train.push({
      step: "EDI (single-pass RO is sufficient)",
      reason: `Single-pass permeate hardness of about ${p1Hardness.toFixed(2)} mg/L as CaCO₃ is inside the EDI limit, so a second pass is not required.`,
    });
  }

  train.push({
    step: "Electrodeionisation",
    reason:
      "Continuous electrical regeneration: no acid or caustic, no regenerant effluent, no neutralisation pit, and no drift in product quality between regenerations.",
    alternative:
      "A mixed bed costs less to build but needs acid and caustic handling, a neutralisation pit, and its product quality drifts through the run.",
  });

  if (toc > 2) {
    cautions.push(`TOC of ${toc.toFixed(1)} mg/L will foul both RO and EDI. Confirm the carbon filter sizing on a measured value, not an assumed one.`);
  }
  cautions.push(
    "Dissolved oxygen and pH are NOT met by this plant. Neither RO nor EDI removes a dissolved gas, and EDI product is neutral. Both are achieved by the deaerator and conditioning dosing in the boiler island — confirm whose scope that is.",
  );

  return { target, train, cautions };
}
