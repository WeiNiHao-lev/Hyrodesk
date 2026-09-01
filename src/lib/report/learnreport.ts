import {
  AlignmentType, BorderStyle, Document, HeadingLevel, Packer, Paragraph, ShadingType,
  Table, TableCell, TableRow, TextRun, VerticalAlign, WidthType, TableOfContents, LevelFormat,
} from "docx";
import { Flowsheet, NodeResult, SimulationResult } from "../engine/types";
import { alkalinityAsCaCO3, hardnessAsCaCO3, ionicBalanceErrorPct, tdsFromIons } from "../engine/stream";
import { feedStream } from "../engine/solver";
import { UNIT_BY_TYPE } from "../engine/units";
import { knowledgeFor } from "../engine/knowledge";
import { calcRowsFor, CalcRow } from "./calcsheets";
import { STANDARDS } from "../engine/templates";
import { validateFeed } from "../engine/diagnostics";

/**
 * The learning report.
 *
 * Written for an engineer who has the theory but has not done the design work:
 * the explanation leads and the numbers follow. Each unit gets what it is, why
 * it is here, why it was chosen over the alternatives, which parameters govern
 * it and why, then the calculation walked through with the actual figures
 * substituted so the arithmetic can be followed rather than trusted.
 */

const NAVY = "0F2942";
const GREY = "4A7694";
const TEAL = "0E7C5A";
const HDR = "0F2942";
const ALT = "EEF6FB";
const WARN = "FEF3D4";
const OKC = "E6F7EE";
const THEORY_BG = "F2F8FC";

const W = 9400;

const P = (t: string, o: {
  bold?: boolean; size?: number; color?: string; italics?: boolean;
  align?: (typeof AlignmentType)[keyof typeof AlignmentType]; after?: number; before?: number;
  indent?: number; numbering?: { reference: string; level: number };
} = {}) =>
  new Paragraph({
    alignment: o.align,
    spacing: { after: o.after ?? 140, before: o.before ?? 0, line: 276 },
    indent: o.indent ? { left: o.indent } : undefined,
    numbering: o.numbering,
    children: [new TextRun({
      text: t, bold: o.bold, size: o.size ?? 21, color: o.color,
      italics: o.italics, font: "Calibri",
    })],
  });

const RUN = (parts: { t: string; b?: boolean; i?: boolean; c?: string }[], after = 140) =>
  new Paragraph({
    spacing: { after, line: 276 },
    children: parts.map((p) => new TextRun({
      text: p.t, bold: p.b, italics: p.i, color: p.c, size: 21, font: "Calibri",
    })),
  });

const H = (t: string, lvl: (typeof HeadingLevel)[keyof typeof HeadingLevel], size: number, before = 280) =>
  new Paragraph({
    heading: lvl, spacing: { before, after: 140 },
    children: [new TextRun({ text: t, bold: true, size, color: NAVY, font: "Calibri" })],
  });
const H1 = (t: string) => H(t, HeadingLevel.HEADING_1, 30, 360);
const H2 = (t: string) => H(t, HeadingLevel.HEADING_2, 25);
const H3 = (t: string) => H(t, HeadingLevel.HEADING_3, 22, 220);

const BUL = (t: string) => P(t, { numbering: { reference: "bul", level: 0 }, after: 80 });

function cell(text: string, w: number, o: { head?: boolean; bg?: string; num?: boolean; bold?: boolean; size?: number } = {}) {
  return new TableCell({
    width: { size: w, type: WidthType.DXA },
    shading: o.bg ? { type: ShadingType.CLEAR, fill: o.bg, color: "auto" } : undefined,
    verticalAlign: VerticalAlign.CENTER,
    margins: { top: 60, bottom: 60, left: 90, right: 90 },
    children: [new Paragraph({
      alignment: o.num ? AlignmentType.RIGHT : o.head ? AlignmentType.CENTER : AlignmentType.LEFT,
      spacing: { after: 0 },
      children: [new TextRun({
        text, bold: o.head || o.bold, size: o.size ?? 17,
        color: o.head ? "FFFFFF" : undefined, font: "Calibri",
      })],
    })],
  });
}

function table(
  headers: string[], rows: (string | { v: string; bg?: string; bold?: boolean })[][],
  widths: number[], numCols: number[] = [],
) {
  return new Table({
    width: { size: widths.reduce((a, b) => a + b, 0), type: WidthType.DXA },
    columnWidths: widths,
    borders: {
      top: { style: BorderStyle.SINGLE, size: 4, color: NAVY },
      bottom: { style: BorderStyle.SINGLE, size: 4, color: NAVY },
      left: { style: BorderStyle.SINGLE, size: 4, color: NAVY },
      right: { style: BorderStyle.SINGLE, size: 4, color: NAVY },
      insideHorizontal: { style: BorderStyle.SINGLE, size: 2, color: "AAB7C4" },
      insideVertical: { style: BorderStyle.SINGLE, size: 2, color: "AAB7C4" },
    },
    rows: [
      new TableRow({ tableHeader: true, children: headers.map((h, i) => cell(h, widths[i], { head: true, bg: HDR })) }),
      ...rows.map((r, ri) => new TableRow({
        children: r.map((c, i) => {
          const obj = typeof c === "object";
          return cell(obj ? c.v : c, widths[i], {
            bg: obj && c.bg ? c.bg : ri % 2 === 1 ? ALT : undefined,
            num: numCols.includes(i), bold: obj ? c.bold : false,
          });
        }),
      })),
    ],
  });
}

/** A shaded call-out used for theory and for warnings. */
function box(title: string, lines: string[], fill = THEORY_BG, accent = TEAL) {
  return new Table({
    width: { size: W, type: WidthType.DXA }, columnWidths: [W],
    borders: {
      top: { style: BorderStyle.SINGLE, size: 3, color: accent },
      bottom: { style: BorderStyle.SINGLE, size: 3, color: accent },
      left: { style: BorderStyle.SINGLE, size: 18, color: accent },
      right: { style: BorderStyle.SINGLE, size: 3, color: accent },
      insideHorizontal: { style: BorderStyle.NONE }, insideVertical: { style: BorderStyle.NONE },
    },
    rows: [new TableRow({ children: [new TableCell({
      width: { size: W, type: WidthType.DXA },
      shading: { type: ShadingType.CLEAR, fill, color: "auto" },
      margins: { top: 130, bottom: 130, left: 170, right: 150 },
      children: [
        new Paragraph({ spacing: { after: 90 }, children: [new TextRun({ text: title, bold: true, size: 20, color: accent, font: "Calibri" })] }),
        ...lines.map((l) => new Paragraph({ spacing: { after: 80, line: 276 }, children: [new TextRun({ text: l, size: 20, font: "Calibri" })] })),
      ],
    })] })],
  });
}

const SP = (n = 160) => new Paragraph({ spacing: { after: n }, children: [] });
const num = (v: number, dp = 2) => (Number.isFinite(v) ? v.toFixed(dp) : "-");

/* ============================================================ front matter */

const FUNDAMENTALS: { h: string; body: string[] }[] = [
  {
    h: "A treatment plant is a sequence of separations",
    body: [
      "Every unit in a water treatment plant does one of three things: it removes something suspended, it removes something dissolved, or it holds water while something else happens. Nothing else. Once you see a flowsheet that way, the logic of the sequence becomes obvious — you cannot remove a dissolved salt until you have removed the suspended solids that would foul the equipment doing it, and you cannot hold water usefully until you know what you are holding it for.",
      "That is why plants are built in the order they are: coarse solids, then fine solids, then colloids, then dissolved matter, then polishing. Each step protects the next. A membrane placed before adequate solids removal is not a bold design; it is a membrane that will be replaced within months.",
    ],
  },
  {
    h: "Everything is a mass balance",
    body: [
      "What goes in comes out. If 100 m³/h enters a unit and 80 m³/h leaves as product, then 20 m³/h leaves somewhere else — as reject, as backwash, as sludge, or as evaporation. There is no fourth possibility. When a balance does not close, a stream has been forgotten, not created or destroyed.",
      "The same applies to each dissolved species. If a membrane rejects 99 % of the calcium entering it, that calcium is now in the concentrate at a higher concentration. It has not gone away. This is why concentrate scaling limits recovery, and why the concentration factor is the first thing to calculate on any membrane stage.",
      "Only biology and precipitation genuinely destroy or transform a component. Organic carbon is oxidised to carbon dioxide; nitrate is reduced to nitrogen gas; calcium is precipitated as a solid. Everywhere else, a component that appears to have vanished from a balance has simply been left unaccounted for.",
    ],
  },
  {
    h: "Recovery, and why it compounds",
    body: [
      "Recovery is the product flow divided by the feed flow. For a single unit it is easy to read off a data sheet. Across a train it multiplies: four units each at 95 % recovery give 0.95⁴ = 81 % overall, not 95 %. This is the single most common source of surprise when someone first sizes a plant.",
      "The consequence is that the last few percentage points of overall recovery are the most expensive. Going from 85 % to 90 % might mean recovering a backwash stream; going from 95 % to 99 % means evaporation, and the cost per cubic metre recovered rises by an order of magnitude.",
      "It also means the cheapest recovery lever is usually not a membrane. Returning a filter backwash or a thickener supernatant adds water back to the front of the plant, whereas pushing a membrane harder only loses less. Adding is more effective than losing less, and it carries far less risk.",
    ],
  },
  {
    h: "Why the design runs backwards",
    body: [
      "A plant exists to satisfy a demand. The demand is therefore the fixed quantity, and the intake is what falls out of it. Working forwards — assuming an intake and seeing what emerges — means iterating by hand until the product happens to land on the requirement.",
      "Working backwards, each unit's inlet is its outlet divided by its recovery, and the intake appears in a single pass. Because every unit is multiplicative in flow, the whole system is linear and the answer is exact rather than approximate.",
      "This is not a modelling convenience; it is how the reference sheets from real projects are built. Their flow cells divide the downstream flow by the recovery rather than multiplying forwards, for exactly this reason.",
    ],
  },
  {
    h: "Concentration, and the units that trip people up",
    body: [
      "Concentrations in water treatment are almost always mg/L, which for dilute solutions is numerically the same as parts per million. Multiply mg/L by m³/h and you get grams per hour; divide by 1000 for kg/h. That single conversion sits behind every chemical dosing calculation and every mass balance in this report.",
      "Hardness and alkalinity are conventionally expressed as mg/L of calcium carbonate, even though no calcium carbonate need be present. It is a common currency that lets calcium and magnesium be added together despite having different atomic weights. The bridge is that 50 mg/L as CaCO₃ equals one milliequivalent per litre.",
      "Milliequivalents matter because chemistry happens by charge, not by mass. Removing one milliequivalent of calcium requires one milliequivalent of exchange capacity regardless of whether that calcium weighs more or less than the magnesium next to it. Whenever a calculation involves ion exchange, softening or an ionic balance, convert to meq/L first — mg/L will mislead you.",
    ],
  },
  {
    h: "Why a water analysis must be checked before it is used",
    body: [
      "Water is electrically neutral, so the sum of cations in meq/L must equal the sum of anions to within a few percent. When it does not, something is missing or misreported and the analysis is not internally valid. Chloride is the usual culprit because it falls outside the standard sampling set in many places.",
      "This matters more than it sounds. Every quantity that depends on the anion set — membrane scaling projections, corrosion assessment, cooling water saturation indices — inherits the error. Checking the balance costs one line of arithmetic and tells you whether the rest of the work is standing on anything.",
      "The other standard checks are equally cheap: total dissolved solids should be consistent with measured conductivity (roughly 0.55 to 0.90 mg/L per µS/cm for natural fresh water), and reported carbonate should be near zero below pH 8.3, because below that pH essentially all inorganic carbon is dissolved CO₂ and bicarbonate.",
    ],
  },
];

/* ============================================================ narrative glue */

function roleOf(nd: NodeResult, fs: Flowsheet, result: SimulationResult): string {
  const model = UNIT_BY_TYPE[nd.type];
  const inbound = fs.edges.filter((e) => e.target === nd.id);
  const outbound = fs.edges.filter((e) => e.source === nd.id);
  const labelOf = (id: string) => fs.nodes.find((x) => x.id === id)?.label ?? id;
  const from = inbound.map((e) => labelOf(e.source));
  const to = outbound.map((e) => `${labelOf(e.target)} (via ${e.sourceHandle})`);
  const share = result.summary.feedFlow > 0
    ? (nd.inlet.flow / result.summary.feedFlow) * 100 : 0;

  const parts: string[] = [];
  parts.push(
    `In this plant, ${nd.label} receives ${num(nd.inlet.flow, 2)} m³/h — ${num(share, 1)} % of the raw water intake — ` +
    (from.length ? `from ${from.join(" and ")}.` : "directly from the raw water feed."),
  );
  if (to.length) parts.push(`It passes water on to ${to.join(", ")}.`);
  const outs = Object.entries(nd.outlets);
  if (outs.length > 1) {
    parts.push(
      "It splits its inlet: " +
      outs.map(([k, s]) => `${num(s.flow, 2)} m³/h as ${k} (${num(nd.inlet.flow > 0 ? (s.flow / nd.inlet.flow) * 100 : 0, 1)} %)`).join(", ") +
      ". Everything that does not leave as product leaves as something you must then deal with, which is why a split is always worth reading carefully.",
    );
  }
  void model;
  return parts.join(" ");
}

/** Walk a calculation, substituting the real numbers so the arithmetic is visible. */
function walkCalc(rows: CalcRow[], vals: Map<string, number>): Paragraph[] {
  const out: Paragraph[] = [];
  for (const cr of rows) {
    if (cr.section || !cr.item) continue;
    if (!cr.expr) continue;
    const sym = cr.formula ?? "";
    const subbed = cr.expr.replace(/\$\{(\w+)\}/g, (_m, k) => {
      const v = vals.get(k);
      return v == null ? k : num(v, 4);
    });
    const res = cr.key ? vals.get(cr.key) : undefined;
    out.push(RUN([
      { t: `${cr.item}  ` , b: true },
      { t: sym ? `${sym}   ` : "", i: true, c: GREY },
      { t: `→  ${subbed.replace(/\*/g, " × ").replace(/\//g, " ÷ ")}  =  ` },
      { t: `${res != null ? num(res, 3) : "?"} ${cr.unit ?? ""}`, b: true, c: TEAL },
    ], 90));
  }
  return out;
}

/** Evaluate the recipe so the walk-through can show real intermediate numbers. */
function evalRows(rows: CalcRow[]): Map<string, number> {
  const vals = new Map<string, number>();
  for (const cr of rows) {
    if (cr.section || !cr.key) continue;
    if (cr.val != null) { vals.set(cr.key, cr.val); continue; }
    if (!cr.expr) continue;
    let js = cr.expr.replace(/\$\{(\w+)\}/g, (_m, k) => String(vals.get(k) ?? 0));
    js = js
      .replace(/\bPI\(\)/g, "Math.PI")
      .replace(/\bLN\(/g, "Math.log(")
      .replace(/\bROUNDUP\(([^,]+),\s*0\)/g, "Math.ceil($1)")
      .replace(/\bMAX\(/g, "Math.max(")
      .replace(/\bMIN\(/g, "Math.min(")
      .replace(/\^/g, "**");
    try {
      const v = Function(`"use strict";return (${js})`)() as number;
      if (Number.isFinite(v)) vals.set(cr.key, v);
    } catch { /* leave unresolved */ }
  }
  return vals;
}

/* ============================================================ builder */

export async function buildLearnReport(
  fs: Flowsheet, result: SimulationResult, studyName: string,
): Promise<Blob> {
  const s = result.summary;
  const probe = feedStream(fs.feed);
  const std = STANDARDS.find((x) => x.key === fs.basis.standard);
  const today = new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" });
  const b: (Paragraph | Table | TableOfContents)[] = [];

  /* ---------------------------------------------------------- cover */
  b.push(SP(1300));
  b.push(P("PROCESS DESIGN — EXPLAINED", { align: AlignmentType.CENTER, size: 20, color: GREY }));
  b.push(P(studyName || "Water Treatment Study", { align: AlignmentType.CENTER, size: 42, bold: true, color: NAVY, after: 160 }));
  b.push(P("Every process in this plant: what it is, why it is here, and how its size was calculated",
    { align: AlignmentType.CENTER, size: 22, color: GREY, after: 500 }));
  b.push(table(["Item", "Detail"], [
    ["Prepared", today],
    ["Feed source", fs.feed.name || "(unnamed)"],
    ["Raw water intake", `${num(s.feedFlow, 2)} m³/h`],
    ["Total product", `${num(s.productFlow, 2)} m³/h`],
    [{ v: "Overall recovery", bg: OKC }, { v: `${num(s.recoveryPct, 2)} %`, bg: OKC }],
    ["Design standard", std?.name ?? fs.basis.standard],
    ["Unit operations described", String(result.nodes.filter((x) => !["product", "waste"].includes(x.type)).length)],
  ], [2600, 6800]));
  b.push(SP(320));
  b.push(box("Who this document is for", [
    "Someone who has the technical background but has not done this particular work: the theory is familiar, the implementation is not. So the explanation leads and the numbers follow.",
    "Each process gets what it physically does, why it appears in this plant, why it was chosen over the alternatives, which parameters govern it and why, and then the sizing calculation walked through with the actual figures substituted — so the arithmetic can be followed rather than trusted.",
    "The tables are deliberately secondary. If you want the numbers alone, the Excel export gives them with live formulas; this document exists to explain where they come from.",
  ]));
  b.push(new Paragraph({ pageBreakBefore: true, children: [] }));

  /* ---------------------------------------------------------- contents */
  b.push(H1("Contents"));
  b.push(new TableOfContents("Contents", { hyperlink: true, headingStyleRange: "1-3" }));
  b.push(P("(In Word: right-click and choose Update Field to fill in the page numbers.)",
    { size: 17, italics: true, color: GREY, before: 200 }));
  b.push(new Paragraph({ pageBreakBefore: true, children: [] }));

  /* ---------------------------------------------------------- 1 fundamentals */
  b.push(H1("1  How to think about a treatment plant"));
  b.push(P(
    "Before any individual process makes sense, six ideas have to be in place. None of them is difficult, but every one of them is a place where an otherwise competent engineer gets a plant wrong the first time.",
  ));
  let i = 1;
  for (const f of FUNDAMENTALS) {
    b.push(H2(`1.${i}  ${f.h}`));
    for (const para of f.body) b.push(P(para));
    i++;
  }

  /* ---------------------------------------------------------- 2 this water */
  b.push(new Paragraph({ pageBreakBefore: true, children: [] }));
  b.push(H1("2  The water this plant has to treat"));
  b.push(P(
    `The feed is ${fs.feed.name || "the raw water"} at ${num(s.feedFlow, 2)} m³/h, ${num(fs.feed.T, 1)} °C, pH ${num(fs.feed.pH, 2)}. ` +
    "Everything downstream follows from this composition, so it is worth reading the numbers below as a description of a problem to be solved rather than as a table to be skipped.",
  ));

  const hard = hardnessAsCaCO3(probe);
  const alk = alkalinityAsCaCO3(probe);
  const nonCarb = Math.max(0, hard - alk);
  const tds = Math.max(probe.c.TDS, tdsFromIons(probe));
  const ionErr = ionicBalanceErrorPct(probe);

  b.push(H2("2.1  What the numbers mean"));
  b.push(table(["Quantity", "Value", "What it tells you"], [
    ["Total dissolved solids", `${num(tds, 1)} mg/L`,
      tds > 20000 ? "Seawater range. Osmotic pressure, not scaling, will limit membrane recovery."
        : tds > 3000 ? "Brackish. Desalination is needed for any demineralised duty."
          : "Fresh. Dissolved load is modest; the challenge is solids and specific ions."],
    ["Total hardness", `${num(hard, 1)} mg/L CaCO₃`,
      hard > 300 ? "Hard water. Scaling will limit membrane recovery and boiler use is impossible without removal."
        : hard > 100 ? "Moderately hard. Removal needed for any boiler feed duty."
          : "Soft. Hardness is not the binding constraint."],
    ["Alkalinity", `${num(alk, 1)} mg/L CaCO₃`,
      alk < 50 ? "LOW. Coagulant will depress pH and caustic dosing will be needed to hold the coagulation window — a real operating cost."
        : "Adequate buffering for coagulation."],
    ["Non-carbonate hardness", `${num(nonCarb, 1)} mg/L CaCO₃`,
      hard > 0 && nonCarb / hard > 0.6
        ? "Majority is non-carbonate. Lime softening removes only the carbonate fraction, so it is ruled out here — this one subtraction eliminates a whole family of processes."
        : "Predominantly carbonate hardness, so lime softening would be effective if chosen."],
    [{ v: "Ionic balance error", bg: Math.abs(ionErr) > 5 ? WARN : OKC },
     { v: `${ionErr >= 0 ? "+" : ""}${num(ionErr, 1)} %`, bg: Math.abs(ionErr) > 5 ? WARN : OKC },
     { v: Math.abs(ionErr) > 5
        ? "FAILS the ±5 % tolerance. The analysis is not internally valid; a major ion is missing or misreported."
        : "Within tolerance. The analysis is internally consistent.", bg: Math.abs(ionErr) > 5 ? WARN : OKC }],
  ], [2500, 1800, 5100]));

  const findings = validateFeed(fs.feed).filter((x) => x.severity === "fail" || x.severity === "warn");
  if (findings.length > 0) {
    b.push(H2("2.2  What is wrong with the data, and why it matters"));
    b.push(P(
      "These are not pedantic objections. Each one changes a number you would otherwise design on, and each is cheap to close if raised now rather than at the review.",
    ));
    for (const f of findings) {
      b.push(H3(f.title));
      b.push(P(f.detail));
      b.push(RUN([{ t: "What to do: ", b: true }, { t: f.action }]));
      if (f.why) b.push(P(f.why, { italics: true, color: GREY, size: 20 }));
    }
  }

  /* ---------------------------------------------------------- 3 the train */
  b.push(new Paragraph({ pageBreakBefore: true, children: [] }));
  b.push(H1("3  The treatment train as a whole"));
  const chain = result.nodes.filter((x) => !["product", "waste", "splitter"].includes(x.type));
  b.push(P(
    "The plant is a sequence of separations, each protecting the next. Read the sequence first; the individual processes make far more sense once the shape of the whole is clear.",
  ));
  b.push(table(["Step", "Process", "Inlet m³/h", "What it removes, and why here"],
    chain.map((nd, idx) => {
      const k = knowledgeFor(nd.type);
      const first = k ? k.principle.split(". ")[0] + "." : (UNIT_BY_TYPE[nd.type]?.description ?? "");
      return [String(idx + 1), nd.label, num(nd.inlet.flow, 2), first];
    }),
    [700, 2200, 1200, 5300], [2]));
  b.push(SP());
  b.push(box("Reading the recovery figure", [
    `This plant takes ${num(s.feedFlow, 2)} m³/h of raw water and delivers ${num(s.productFlow, 2)} m³/h of product: an overall recovery of ${num(s.recoveryPct, 2)} %. The remaining ${num(s.wasteFlow, 2)} m³/h leaves as reject, backwash, sludge and process loss.`,
    `That figure is the product of every individual recovery in the train, which is why it is lower than any single unit's. If it needs to be higher, look first at whether any of the waste streams is clean enough to return to the front of the plant — adding water back is almost always cheaper and less risky than pushing a membrane harder.`,
  ]));

  /* ---------------------------------------------------------- 4 per process */
  let secNo = 4;
  for (const nd of chain) {
    const model = UNIT_BY_TYPE[nd.type];
    const k = knowledgeFor(nd.type);
    const node = fs.nodes.find((x) => x.id === nd.id);
    if (!model || !node) continue;

    b.push(new Paragraph({ pageBreakBefore: true, children: [] }));
    b.push(H1(`${secNo}  ${nd.label}`));
    b.push(P(`${model.label}`, { size: 22, color: GREY, italics: true }));

    /* --- what it is --- */
    b.push(H2(`${secNo}.1  What this process is, physically`));
    b.push(P(k?.principle ?? model.description));

    /* --- why it is here --- */
    b.push(H2(`${secNo}.2  Why it is in this plant`));
    b.push(P(roleOf(nd, fs, result)));
    if (k?.upstream) b.push(RUN([{ t: "What must come before it: ", b: true }, { t: k.upstream }]));
    if (k?.downstream) b.push(RUN([{ t: "What normally follows: ", b: true }, { t: k.downstream }]));

    /* --- when to use / not --- */
    if (k) {
      b.push(H2(`${secNo}.3  When this process is the right choice`));
      for (const t of k.whenToUse) b.push(BUL(t));
      b.push(H2(`${secNo}.4  When it is the wrong choice`));
      b.push(P(
        "This is the more useful list. Knowing where a process fails is what separates selecting it deliberately from defaulting to it because it is familiar.",
        { italics: true, color: GREY, size: 20 },
      ));
      for (const t of k.whenNotToUse) b.push(BUL(t));
    }

    /* --- parameters that govern it --- */
    if (k && k.keyNumbers.length > 0) {
      b.push(H2(`${secNo}.5  The parameters you must know, and why`));
      b.push(P(
        "Each of these has to come from somewhere: a measurement, a vendor data sheet, or a documented assumption. Where it is an assumption, the design is only as good as the assumption.",
      ));
      b.push(table(["Parameter", "Typical range", "Why this is the range it is"],
        k.keyNumbers.map((x) => [x.param, x.typical, x.why]), [2400, 1900, 5100]));
    }

    /* --- design rules --- */
    if (k && k.designRules.length > 0) {
      b.push(H2(`${secNo}.6  Design rules, and the reasoning behind them`));
      for (const r of k.designRules) {
        b.push(RUN([{ t: r.rule, b: true }], 60));
        b.push(P(r.why, { indent: 260, color: "24506F", size: 20 }));
      }
    }

    /* --- the calculation, walked through --- */
    const rows = calcRowsFor(nd, node.params);
    const vals = evalRows(rows);
    const walk = walkCalc(rows, vals);
    b.push(H2(`${secNo}.7  How the size was calculated`));
    if (walk.length > 0) {
      b.push(P(
        "Each line below is the formula, then the same formula with this plant's numbers substituted, then the result. Nothing is hidden; if a figure looks wrong, the line that produced it is here.",
      ));
      b.push(SP(100));
      for (const w of walk) b.push(w);
      b.push(SP(120));
      b.push(P(
        "The Excel export carries these same relationships as live formulas, so an input can be changed and the consequences followed through the whole workbook.",
        { italics: true, color: GREY, size: 20 },
      ));
    } else {
      b.push(P("No sizing recipe is written for this unit type; the flows below come directly from the balance."));
    }

    /* --- theory behind the equations --- */
    const theories = rows.filter((x) => x.theory && x.item);
    if (theories.length > 0) {
      b.push(H2(`${secNo}.8  Where those equations come from`));
      for (const t of theories) {
        b.push(RUN([{ t: `${t.item}${t.symbol ? ` (${t.symbol})` : ""} — `, b: true }, { t: t.theory! }], 110));
      }
    }

    /* --- result and sizing --- */
    if (nd.aux.sizing.length > 0) {
      b.push(H2(`${secNo}.9  The resulting equipment`));
      b.push(table(["Item", "Value"], nd.aux.sizing.map((z) => [z.label, z.value]), [4200, 5200]));
    }

    /* --- failure modes --- */
    if (k && k.failureModes.length > 0) {
      b.push(H2(`${secNo}.10  What goes wrong in service, and how to prevent it`));
      b.push(P(
        "A design that has not considered its own failure modes is not finished. These are the ways this process actually fails on operating plants.",
      ));
      b.push(table(["Failure mode", "What you would see", "Prevention"],
        k.failureModes.map((m) => [{ v: m.mode, bold: true }, m.symptom, m.prevention]),
        [2200, 3400, 3800]));
    }

    /* --- warnings raised --- */
    if (nd.aux.notes.length > 0) {
      b.push(SP(120));
      b.push(box("Notes the model raised for this unit", nd.aux.notes, WARN, "A86B06"));
    }

    if (k?.ccepcNote) {
      b.push(SP(120));
      b.push(box("Delivered experience", [k.ccepcNote], OKC, TEAL));
    }
    secNo++;
  }

  /* ---------------------------------------------------------- results */
  b.push(new Paragraph({ pageBreakBefore: true, children: [] }));
  b.push(H1(`${secNo}  The numbers, collected`));
  b.push(P(
    "These tables exist for reference. If they are all you read, the document has not done its job — the value is in the reasoning above, not here.",
    { italics: true, color: GREY },
  ));

  b.push(H2(`${secNo}.1  Water balance`));
  b.push(table(["Stream", "Type", "Flow m³/h", "% of intake"], [
    ...result.feedStreams.map((r) => [r.to, "Feed", num(r.stream.flow, 3), num(100, 1)]),
    ...result.productStreams.map((r) => [
      { v: r.label, bg: OKC }, { v: "Product", bg: OKC }, { v: num(r.stream.flow, 3), bg: OKC },
      { v: num((r.stream.flow / Math.max(s.feedFlow, 1e-9)) * 100, 2), bg: OKC }]),
    ...result.wasteStreams.map((r) => [r.label, "Waste", num(r.stream.flow, 3),
      num((r.stream.flow / Math.max(s.feedFlow, 1e-9)) * 100, 2)]),
  ], [3400, 1600, 2200, 2200], [2, 3]));

  b.push(H2(`${secNo}.2  Energy`));
  b.push(table(["Unit", "Power kW", "Share %"], [
    ...result.nodes.filter((x) => x.aux.powerKW > 0.01)
      .sort((a, c) => c.aux.powerKW - a.aux.powerKW)
      .map((x) => [x.label, num(x.aux.powerKW, 2),
        num((x.aux.powerKW / Math.max(s.totalPowerKW, 1e-9)) * 100, 1)]),
    [{ v: "TOTAL", bg: OKC }, { v: num(s.totalPowerKW, 2), bg: OKC }, { v: "100.0", bg: OKC }],
  ], [5000, 2200, 2200], [1, 2]));
  b.push(RUN([{ t: "Specific energy consumption: ", b: true },
    { t: `${num(s.secKWhPerM3, 3)} kWh per m³ of product. ` },
    { t: "This is the figure to compare designs on — it is independent of plant size.", i: true }]));

  if (s.chemicals.length > 0) {
    b.push(H2(`${secNo}.3  Chemicals`));
    b.push(table(["Chemical (100 % active)", "kg/h", "t/y"],
      s.chemicals.map((c) => [c.name, num(c.kgPerH, 4), num(c.tPerY, 2)]),
      [5000, 2200, 2200], [1, 2]));
  }

  /* ---------------------------------------------------------- limitations */
  secNo++;
  b.push(H1(`${secNo}  What this document is not`));
  for (const t of [
    "This is a screening calculation, not a design. Sizing uses standard design loading rates and has not been checked against any vendor's performance software.",
    "Membrane projections in particular must be re-run in the selected supplier's own program before any commitment. The equations here are correct in form but a real projection accounts for element-by-element conditions, temperature correction and ageing.",
    "Where an input is an assumption, so is every number derived from it. Section 2 states which is which.",
    "Costs, where given, are order-of-magnitude figures from capacity curves and generic unit rates. They rank options against each other and do nothing else.",
    "The reference ranges quoted throughout are typical industry values. They are a sanity check on a chosen number, not a substitute for a vendor guarantee.",
  ]) b.push(BUL(t));

  const doc = new Document({
    creator: "HydroDesk",
    title: `${studyName} — process design explained`,
    description: "Comprehensive process explanation with worked calculations",
    styles: {
      default: { document: { run: { font: "Calibri", size: 21 } } },
      paragraphStyles: [
        { id: "Heading1", name: "Heading 1", basedOn: "Normal", next: "Normal", quickFormat: true,
          run: { size: 30, bold: true, color: NAVY, font: "Calibri" },
          paragraph: { spacing: { before: 360, after: 140 },
            border: { bottom: { style: BorderStyle.SINGLE, size: 8, color: NAVY, space: 4 } } } },
        { id: "Heading2", name: "Heading 2", basedOn: "Normal", next: "Normal", quickFormat: true,
          run: { size: 25, bold: true, color: NAVY, font: "Calibri" },
          paragraph: { spacing: { before: 280, after: 130 } } },
        { id: "Heading3", name: "Heading 3", basedOn: "Normal", next: "Normal", quickFormat: true,
          run: { size: 22, bold: true, color: "2E5C8A", font: "Calibri" },
          paragraph: { spacing: { before: 220, after: 110 } } },
      ],
    },
    numbering: {
      config: [{
        reference: "bul",
        levels: [{
          level: 0, format: LevelFormat.BULLET, text: "•", alignment: AlignmentType.LEFT,
          style: { paragraph: { indent: { left: 380, hanging: 230 } } },
        }],
      }],
    },
    sections: [{
      properties: { page: { size: { width: 11906, height: 16838 }, margin: { top: 1080, right: 1180, bottom: 1080, left: 1180 } } },
      children: b,
    }],
  });

  return Packer.toBlob(doc);
}
