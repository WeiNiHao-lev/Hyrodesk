import { Ask, AskGroup, DocRequest } from "./sitevisit";

/**
 * Reads a completed site-visit checklist and says what is wrong with it.
 *
 * Entirely rule-based. No model, no network call, nothing that can invent a
 * finding — every statement below traces to an arithmetic check or a missing
 * field, and every one names the design decision it blocks. That is the point:
 * an analysis you cannot audit is not usable in front of an engineering
 * director, and one that needs a network call is not usable on a site with no
 * signal, which is exactly where a checklist gets filled in.
 *
 * The checks fall into four kinds:
 *
 *   1. Coverage    — what was never asked, weighted by whether it is critical.
 *   2. Quality     — asked and ticked, but the answer recorded is not usable:
 *                    blank, vague, or qualitative where a number is required.
 *   3. Consistency — two answers that cannot both be true. This is where the
 *                    real value is, because a plausible-looking set of numbers
 *                    can still be internally impossible, and nobody notices
 *                    until the design is being defended.
 *   4. Follow-up   — the same findings, rewritten as things to send the client.
 */

export type Severity = "blocker" | "gap" | "check" | "good";

export interface PrepareFinding {
  severity: Severity;
  title: string;
  detail: string;
  /** What to do about it, phrased so it can be sent to the client as-is. */
  action?: string;
  askId?: string;
  /** Which rule produced this, so a surprising finding can be traced. */
  rule: string;
}

export interface GroupCoverage {
  id: string;
  title: string;
  answered: number;
  total: number;
  criticalOpen: number;
}

export interface PrepareAnalysis {
  readiness: number;
  verdict: string;
  verdictTone: "blocker" | "gap" | "good";
  answered: number;
  total: number;
  criticalOpen: number;
  recorded: number;
  coverage: GroupCoverage[];
  findings: PrepareFinding[];
  followUps: string[];
  /** Quantities the parser recognised, so you can see what it read. */
  extracted: { label: string; value: number; unit: string; askId: string }[];
}

/* ------------------------------------------------------------ number parsing */

/**
 * Numbers out of free text, tolerating both Indonesian and English convention.
 *
 * "1.200" is one thousand two hundred in Indonesian and one point two in
 * English. The rule used here: a dot followed by exactly three digits, with no
 * comma anywhere in the token, is a thousands separator. It is a heuristic and
 * it can be wrong, which is why every extracted quantity is shown back to the
 * reader rather than used silently.
 */
export function numbersIn(text: string): number[] {
  const out: number[] = [];
  const re = /-?\d[\d.,]*/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const tok = m[0];
    let normalised: string;
    if (tok.includes(",")) {
      // Indonesian: dots group thousands, comma is the decimal point.
      normalised = tok.replace(/\./g, "").replace(",", ".");
    } else if (/^-?\d{1,3}(\.\d{3})+$/.test(tok)) {
      normalised = tok.replace(/\./g, "");
    } else {
      normalised = tok;
    }
    const v = Number(normalised);
    if (Number.isFinite(v)) out.push(v);
  }
  return out;
}

/** Units that signal a question wants a quantity rather than a description. */
const UNIT_HINT = /\b(m3|m³|m2|m²|mg\/l|ppm|ntu|l\/s|lps|kwh|kw\b|bar\b|ha\b|hour|jam|hari|day|%|µs\/cm|us\/cm|°c|degc|meter|metre)\b/i;

const VAGUE = [
  "tidak tahu", "tidak ada data", "belum ada", "belum tahu", "belum diukur",
  "kira-kira", "sekitar", "kurang lebih", "mungkin", "katanya", "sepertinya",
  "unknown", "no data", "not available", "n/a", "tbc", "tbd", "approximately",
  "roughly", "about", "estimated", "guess", "verbal", "lisan",
];

/* ------------------------------------------------- quantity recognition */

interface Quantity {
  key: string;
  label: string;
  unit: string;
  /** Matched against the question text, not the answer. */
  match: RegExp;
  /** Plausible range; outside it the reading is questioned, not rejected. */
  plausible?: [number, number];
}

const QUANTITIES: Quantity[] = [
  { key: "flow", label: "Design flow", unit: "m³/d", match: /\b(debit|flow rate|design flow|kapasitas|capacity|m3\/d|m³\/d|l\/s|lps)\b/i },
  { key: "area", label: "Land area", unit: "m²", match: /\b(luas|land area|footprint|lahan|available area|m2|m²|hectare|ha)\b/i },
  { key: "volume", label: "Existing basin volume", unit: "m³", match: /\b(volume)\b/i },
  { key: "hrt", label: "Retention time", unit: "h", match: /\b(hrt|retention time|waktu tinggal|detention)\b/i },
  { key: "tds", label: "TDS", unit: "mg/L", match: /\btds\b/i, plausible: [1, 300000] },
  { key: "cond", label: "Conductivity", unit: "µS/cm", match: /\b(conductivity|konduktivitas|µs\/cm|us\/cm)\b/i, plausible: [1, 200000] },
  { key: "turbidity", label: "Turbidity", unit: "NTU", match: /\b(turbidity|kekeruhan|ntu)\b/i, plausible: [0, 5000] },
  { key: "tss", label: "TSS", unit: "mg/L", match: /\btss\b|suspended solid/i, plausible: [0, 100000] },
  { key: "cod", label: "COD", unit: "mg/L", match: /\bcod\b/i, plausible: [1, 200000] },
  { key: "bod", label: "BOD", unit: "mg/L", match: /\bbod\b/i, plausible: [1, 100000] },
  { key: "tn", label: "Total nitrogen", unit: "mg/L", match: /\b(total nitrogen|tn|n-total|nitrogen total)\b/i, plausible: [0, 20000] },
  { key: "nh3", label: "Ammonia", unit: "mg/L", match: /\b(ammonia|amonia|nh3|nh4|nh3-n)\b/i, plausible: [0, 20000] },
  { key: "ph", label: "pH", unit: "-", match: /\bph\b/i, plausible: [0, 14] },
  { key: "power", label: "Power available", unit: "kW", match: /\b(power|listrik|kva|kw\b|pln)\b/i },
];

interface Reading { q: Quantity; value: number; askId: string; raw: string }

/** Numbers with where they were found, so a value can be tied to a keyword. */
function numbersWithPosition(text: string): { value: number; index: number }[] {
  const out: { value: number; index: number }[] = [];
  const re = /-?\d[\d.,]*/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const parsed = numbersIn(m[0]);
    if (parsed.length > 0) out.push({ value: parsed[0], index: m.index });
  }
  return out;
}

/**
 * One answer often carries several quantities — "TDS 365 mg/L, conductivity
 * 1200 uS/cm" is how an engineer actually writes a note. Each quantity is
 * therefore tied to the number nearest its own keyword within the answer, and a
 * number already claimed by one quantity cannot be claimed by another. Only
 * when no keyword appears in the answer at all does the subject of the question
 * decide what the leading number means.
 */
function extractReadings(asks: Ask[], notes: Record<string, string>): Reading[] {
  const out: Reading[] = [];
  for (const a of asks) {
    const note = (notes[a.id] ?? "").trim();
    if (!note) continue;
    const nums = numbersWithPosition(note);
    if (nums.length === 0) continue;

    const claimed = new Set<number>();
    let matchedInNote = false;
    for (const q of QUANTITIES) {
      const hit = q.match.exec(note);
      if (!hit) continue;
      matchedInNote = true;
      const after = nums.find((x) => !claimed.has(x.index) && x.index >= hit.index);
      const before = [...nums].reverse().find((x) => !claimed.has(x.index) && x.index < hit.index);
      const pick = after ?? before;
      if (!pick) continue;
      claimed.add(pick.index);
      out.push({ q, value: pick.value, askId: a.id, raw: note });
    }
    if (matchedInNote) continue;

    const haystack = `${a.q} ${a.good ?? ""}`;
    for (const q of QUANTITIES) {
      if (!q.match.test(haystack)) continue;
      out.push({ q, value: nums[0].value, askId: a.id, raw: note });
      break;
    }
  }
  return out;
}

/* ---------------------------------------------------------------- analysis */

export function analysePrepare(
  groups: AskGroup[],
  documents: DocRequest[],
  checked: Record<string, boolean>,
  notes: Record<string, string>,
): PrepareAnalysis {
  const asks = groups.flatMap((g) => g.items);
  const findings: PrepareFinding[] = [];

  /* ---- 1. coverage ---- */
  const coverage: GroupCoverage[] = groups.map((g) => ({
    id: g.id,
    title: g.title,
    answered: g.items.filter((a) => checked[a.id]).length,
    total: g.items.length,
    criticalOpen: g.items.filter((a) => a.critical && !checked[a.id]).length,
  }));

  const answered = asks.filter((a) => checked[a.id]).length;
  const recorded = asks.filter((a) => (notes[a.id] ?? "").trim().length > 0).length;
  const criticalAsks = asks.filter((a) => a.critical);
  const criticalOpen = criticalAsks.filter((a) => !checked[a.id]).length;

  for (const a of criticalAsks) {
    if (checked[a.id]) continue;
    findings.push({
      severity: "blocker",
      title: `Not asked: ${a.q}`,
      detail: a.why,
      action: a.unlocks
        ? `Ask before leaving, or in writing afterwards. Without it: ${a.unlocks}`
        : "Ask before leaving, or request it in writing afterwards.",
      askId: a.id,
      rule: "critical-unanswered",
    });
  }

  for (const g of coverage) {
    if (g.total >= 3 && g.answered === 0) {
      findings.push({
        severity: "gap",
        title: `Nothing recorded under "${g.title}"`,
        detail: `All ${g.total} questions in this group are still open. A group left entirely blank usually means it was forgotten rather than judged irrelevant.`,
        action: `Review the ${g.total} questions under ${g.title} and decide, item by item, whether each is genuinely not applicable.`,
        rule: "group-empty",
      });
    }
  }

  /* ---- 2. answer quality ---- */
  for (const a of asks) {
    if (!checked[a.id]) continue;
    const note = (notes[a.id] ?? "").trim();

    if (note.length === 0) {
      findings.push({
        severity: "gap",
        title: `Ticked but nothing written down: ${a.q}`,
        detail: "The question is marked as asked and no answer was recorded. In two weeks nobody will remember what was said, and a verbal answer that cannot be quoted cannot be defended in a design review.",
        action: "Write down what you were told, even if it was vague — including who said it.",
        askId: a.id,
        rule: "ticked-no-note",
      });
      continue;
    }

    const wantsNumber = UNIT_HINT.test(`${a.q} ${a.good ?? ""}`);
    const hasNumber = numbersIn(note).length > 0;
    if (wantsNumber && !hasNumber) {
      findings.push({
        severity: "check",
        title: `Qualitative answer to a quantitative question: ${a.q}`,
        detail: `The expected answer carries a unit${a.good ? ` — ${a.good}` : ""} — but no figure was recorded. A description cannot be put into a mass balance.`,
        action: "Go back for the number, or state explicitly in the report that it is an assumption.",
        askId: a.id,
        rule: "no-number",
      });
    }

    const low = note.toLowerCase();
    const vague = VAGUE.find((v) => low.includes(v));
    if (vague) {
      findings.push({
        severity: "check",
        title: `Answer is an estimate: ${a.q}`,
        detail: `The note contains "${vague}", so this is a recollection rather than a reading. Recollections are usually round numbers and usually optimistic.`,
        action: "Ask for the document, the log sheet or the SCADA trend that the figure comes from.",
        askId: a.id,
        rule: "vague-answer",
      });
    }
  }

  /* ---- 3. consistency between answers ---- */
  const readings = extractReadings(asks, notes);
  const by = (k: string) => readings.find((r) => r.q.key === k);

  for (const r of readings) {
    const p = r.q.plausible;
    if (p && (r.value < p[0] || r.value > p[1])) {
      findings.push({
        severity: "check",
        title: `${r.q.label} of ${fmt(r.value)} ${r.q.unit} is outside the plausible range`,
        detail: `Expected roughly ${fmt(p[0])}–${fmt(p[1])} ${r.q.unit}. Either the unit was misread, the figure was mistyped, or this water is unusual enough to be worth confirming.`,
        action: `Confirm the ${r.q.label.toLowerCase()} figure and its unit against the laboratory certificate.`,
        askId: r.askId,
        rule: "range",
      });
    }
  }

  const tds = by("tds");
  const cond = by("cond");
  if (tds && cond && cond.value > 0) {
    const ratio = tds.value / cond.value;
    if (ratio < 0.4 || ratio > 1.0) {
      findings.push({
        severity: "check",
        title: `TDS and conductivity disagree`,
        detail: `TDS ${fmt(tds.value)} mg/L against ${fmt(cond.value)} µS/cm gives ${ratio.toFixed(2)} mg/L per µS/cm. Natural waters sit between 0.55 and 0.90. Outside that band one of the two was measured on a different sample, or one is reported in the wrong unit.`,
        action: "Ask which sample each figure came from, and on what date. If they are from different samples, they cannot be used together.",
        askId: tds.askId,
        rule: "tds-conductivity",
      });
    }
  }

  const bod = by("bod");
  const cod = by("cod");
  if (bod && cod && cod.value > 0) {
    const bc = bod.value / cod.value;
    if (bc < 0.1) {
      findings.push({
        severity: "check",
        title: `BOD:COD of ${bc.toFixed(2)} means the organic load is refractory`,
        detail: "Below about 0.1 the organic matter is not biodegradable, so a biological plant will remove very little of it however it is configured. That changes the process selection entirely — membranes or oxidation rather than more aeration.",
        action: "Confirm the BOD and COD are from the same sample, then plan the train around membranes or advanced oxidation rather than biology.",
        askId: cod.askId,
        rule: "bod-cod-low",
      });
    } else if (bc > 0.8) {
      findings.push({
        severity: "check",
        title: `BOD:COD of ${bc.toFixed(2)} is implausibly high`,
        detail: "COD measures everything BOD does and more, so the ratio cannot approach 1 in a real wastewater. One of the two figures is likely wrong or from a different sample.",
        action: "Re-check both figures against the laboratory certificate.",
        askId: cod.askId,
        rule: "bod-cod-high",
      });
    }
  }

  const turb = by("turbidity");
  const tss = by("tss");
  if (turb && tss && turb.value > 0) {
    const perNtu = tss.value / turb.value;
    if (perNtu < 0.3 || perNtu > 8) {
      findings.push({
        severity: "check",
        title: "Turbidity and suspended solids do not correspond",
        detail: `${fmt(tss.value)} mg/L TSS at ${fmt(turb.value)} NTU is ${perNtu.toFixed(1)} mg/L per NTU. The usual range is 1 to 3. A large departure normally means the two were measured months apart, or in different seasons.`,
        action: "Ask for the sampling dates of both. Reservoir and river solids swing with rainfall, so a dry-season pair tells you nothing about the wet season.",
        askId: turb.askId,
        rule: "turbidity-tss",
      });
    }
  }

  const vol = by("volume");
  const flow = by("flow");
  const hrt = by("hrt");
  if (vol && flow && flow.value > 0) {
    // The flow may be in m3/d or L/s; try both and report the one that lands in
    // a sane range rather than assuming.
    const asPerDay = (vol.value / flow.value) * 24;
    const asLps = vol.value / (flow.value * 3.6);
    const derived = asPerDay > 0.2 && asPerDay < 400 ? asPerDay : asLps;
    if (hrt && hrt.value > 0) {
      const dev = Math.abs(derived - hrt.value) / hrt.value;
      if (dev > 0.35) {
        findings.push({
          severity: "check",
          title: "Stated retention time does not match volume divided by flow",
          detail: `The basin volume and the flow give roughly ${derived.toFixed(1)} h, against the ${fmt(hrt.value)} h that was stated. One of the three numbers is wrong, and on a brownfield site it is usually the volume — the drawing and the basin as built often differ.`,
          action: "Measure the basin yourself, or ask for the as-built drawing rather than the design drawing.",
          askId: vol.askId,
          rule: "hrt-mismatch",
        });
      }
    } else {
      findings.push({
        severity: "good",
        title: `Retention time works out at about ${derived.toFixed(1)} h`,
        detail: "Derived from the basin volume and the flow you recorded. Worth stating explicitly in the report, because it is the number that decides whether an existing basin can be reused.",
        rule: "hrt-derived",
      });
    }
  }

  const area = by("area");
  if (area && flow && flow.value > 0) {
    const perM3d = area.value / flow.value;
    if (perM3d < 0.2) {
      findings.push({
        severity: "check",
        title: `Land is very tight: ${perM3d.toFixed(2)} m² per m³/d`,
        detail: "Below about 0.2 m² per m³/d a conventional layout with horizontal-flow sedimentation will not fit. It can still be done, but only with lamella clarifiers or flotation and a compact filtration step, and there will be no room left for expansion.",
        action: "Confirm whether the area quoted is the gross plot or the net process area, and whether it has to include the chemical store, sludge handling and clear water tank.",
        askId: area.askId,
        rule: "land-tight",
      });
    }
  }

  /* ---- documents ---- */
  const docsOpen = documents.filter((d) => d.critical && !checked[d.id]);
  if (docsOpen.length > 0) {
    findings.push({
      severity: "gap",
      title: `${docsOpen.length} essential document${docsOpen.length > 1 ? "s" : ""} not requested`,
      detail: docsOpen.map((d) => d.doc).join(" · "),
      action: "Send the document request before the meeting is forgotten. Asking a week later reads as unpreparedness; asking on the day reads as thoroughness.",
      rule: "documents-missing",
    });
  }

  /* ---- readiness ---- */
  const criticalScore = criticalAsks.length === 0
    ? 1 : (criticalAsks.length - criticalOpen) / criticalAsks.length;
  const coverScore = asks.length === 0 ? 1 : answered / asks.length;
  const recordScore = answered === 0 ? 0 : recorded / answered;
  const penalty = Math.min(
    0.25,
    findings.filter((f) => f.severity === "check").length * 0.03,
  );
  const readiness = Math.max(
    0,
    Math.round((criticalScore * 0.55 + coverScore * 0.25 + recordScore * 0.20 - penalty) * 100),
  );

  let verdict: string;
  let verdictTone: PrepareAnalysis["verdictTone"];
  if (criticalOpen > 0) {
    verdictTone = "blocker";
    verdict = `${criticalOpen} essential question${criticalOpen > 1 ? "s are" : " is"} still unanswered. Presenting now means being asked one of them and not having it.`;
  } else if (findings.some((f) => f.severity === "gap" || f.severity === "check")) {
    verdictTone = "gap";
    verdict = "Every essential question has an answer, but some of them will not survive being questioned. Close the items below before the review rather than during it.";
  } else {
    verdictTone = "good";
    verdict = "Every essential question is answered and nothing contradicts anything else. This is presentable.";
  }

  /* ---- follow-ups ---- */
  const followUps: string[] = [];
  for (const f of findings) {
    if (f.severity === "good" || !f.action) continue;
    followUps.push(`${f.title} — ${f.action}`);
  }

  const order: Record<Severity, number> = { blocker: 0, gap: 1, check: 2, good: 3 };
  findings.sort((a, b) => order[a.severity] - order[b.severity]);

  return {
    readiness, verdict, verdictTone,
    answered, total: asks.length, criticalOpen, recorded,
    coverage, findings, followUps,
    extracted: readings.map((r) => ({
      label: r.q.label, value: r.value, unit: r.q.unit, askId: r.askId,
    })),
  };
}

function fmt(v: number): string {
  if (!Number.isFinite(v)) return "—";
  if (Math.abs(v) >= 1000) return v.toLocaleString("en-GB", { maximumFractionDigits: 0 });
  if (Math.abs(v) >= 1) return String(Math.round(v * 100) / 100);
  return String(Math.round(v * 10000) / 10000);
}
