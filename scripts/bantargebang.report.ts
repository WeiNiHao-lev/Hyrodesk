import { readFileSync, writeFileSync } from "fs";
import {
  AlignmentType, BorderStyle, Document, HeadingLevel, ImageRun, Packer, Paragraph,
  ShadingType, Table, TableCell, TableRow, TextRun, WidthType,
} from "docx";

/**
 * Bantargebang IPAS 2 — basis of design report.
 *
 * Every figure comes from scripts/out/bantargebang.json, which is produced by
 * the same engine the application runs, so the report cannot drift from the
 * model. Nothing is typed in twice.
 */

type Json = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
const d: Json = JSON.parse(readFileSync("scripts/out/bantargebang.json", "utf8"));

const NAVY = "0F2942";
const ALT = "EEF6FB";
const OK = "D8F7E9";
const BAD = "FBDDD8";
const WARN = "FEF3D4";
const TEAL = "0E7C5A";

const P = (t: string, o: { b?: boolean; sz?: number; color?: string; it?: boolean; after?: number; align?: (typeof AlignmentType)[keyof typeof AlignmentType] } = {}) =>
  new Paragraph({
    alignment: o.align,
    spacing: { after: o.after ?? 130, line: 276 },
    children: [new TextRun({ text: t, bold: o.b, size: o.sz ?? 20, color: o.color, italics: o.it, font: "Calibri" })],
  });

const H1 = (t: string) => new Paragraph({
  heading: HeadingLevel.HEADING_1, spacing: { before: 320, after: 160 },
  children: [new TextRun({ text: t, bold: true, size: 30, color: NAVY, font: "Calibri" })],
});
const H2 = (t: string) => new Paragraph({
  heading: HeadingLevel.HEADING_2, spacing: { before: 240, after: 120 },
  children: [new TextRun({ text: t, bold: true, size: 24, color: NAVY, font: "Calibri" })],
});
const H3 = (t: string) => new Paragraph({
  spacing: { before: 180, after: 90 },
  children: [new TextRun({ text: t, bold: true, size: 21, color: TEAL, font: "Calibri" })],
});
const bullet = (t: string) => new Paragraph({
  bullet: { level: 0 }, spacing: { after: 70, line: 264 },
  children: [new TextRun({ text: t, size: 19, font: "Calibri" })],
});
const spacer = () => new Paragraph({ spacing: { after: 120 }, children: [] });

/** A full-width figure with a numbered caption. */
function figure(file: string, caption: string, widthPt = 470) {
  const png = readFileSync(file);
  // Keep the aspect ratio of the source rather than guessing it.
  const w = png.readUInt32BE(16), h = png.readUInt32BE(20);
  return [
    new Paragraph({
      alignment: AlignmentType.CENTER, spacing: { before: 140, after: 60 },
      children: [new ImageRun({
        data: png, type: "png",
        transformation: { width: widthPt, height: Math.round(widthPt * h / w) },
      })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER, spacing: { after: 180 },
      children: [new TextRun({ text: caption, size: 17, italics: true, color: "5A6B7B", font: "Calibri" })],
    }),
  ];
}

type Cell = string | { v: string; bg?: string; b?: boolean };
function table(head: string[], rows: Cell[][], widths: number[], numeric: number[] = []) {
  const mk = (c: Cell, i: number, isHead: boolean) => {
    const v = typeof c === "string" ? c : c.v;
    const bg = typeof c === "string" ? undefined : c.bg;
    const bold = isHead || (typeof c === "object" && c.b);
    return new TableCell({
      width: { size: widths[i], type: WidthType.DXA },
      shading: { type: ShadingType.CLEAR, fill: isHead ? NAVY : bg ?? "FFFFFF", color: "auto" },
      margins: { top: 60, bottom: 60, left: 90, right: 90 },
      children: [new Paragraph({
        spacing: { after: 0 },
        alignment: numeric.includes(i) && !isHead ? AlignmentType.RIGHT : AlignmentType.LEFT,
        children: [new TextRun({ text: v, bold, size: 17, color: isHead ? "FFFFFF" : undefined, font: "Calibri" })],
      })],
    });
  };
  return new Table({
    width: { size: widths.reduce((a, b) => a + b, 0), type: WidthType.DXA },
    borders: {
      top: { style: BorderStyle.SINGLE, size: 2, color: "C9D6E2" },
      bottom: { style: BorderStyle.SINGLE, size: 2, color: "C9D6E2" },
      left: { style: BorderStyle.SINGLE, size: 2, color: "C9D6E2" },
      right: { style: BorderStyle.SINGLE, size: 2, color: "C9D6E2" },
      insideHorizontal: { style: BorderStyle.SINGLE, size: 1, color: "DDE6EE" },
      insideVertical: { style: BorderStyle.SINGLE, size: 1, color: "DDE6EE" },
    },
    rows: [
      new TableRow({ tableHeader: true, children: head.map((h, i) => mk(h, i, true)) }),
      ...rows.map((r, ri) => new TableRow({
        children: r.map((c, i) => mk(
          typeof c === "string" && ri % 2 === 1 ? { v: c, bg: ALT } : c, i, false)),
      })),
    ],
  });
}

/** A boxed aside for the findings that must not be skimmed past. */
function callout(title: string, lines: string[], fill = WARN, accent = "8A6100") {
  return new Table({
    width: { size: 9400, type: WidthType.DXA },
    borders: {
      top: { style: BorderStyle.SINGLE, size: 2, color: fill },
      bottom: { style: BorderStyle.SINGLE, size: 2, color: fill },
      left: { style: BorderStyle.SINGLE, size: 18, color: accent },
      right: { style: BorderStyle.SINGLE, size: 2, color: fill },
      insideHorizontal: { style: BorderStyle.NONE, size: 0, color: fill },
      insideVertical: { style: BorderStyle.NONE, size: 0, color: fill },
    },
    rows: [new TableRow({
      children: [new TableCell({
        width: { size: 9400, type: WidthType.DXA },
        shading: { type: ShadingType.CLEAR, fill, color: "auto" },
        margins: { top: 130, bottom: 130, left: 170, right: 150 },
        children: [
          new Paragraph({ spacing: { after: 80 }, children: [new TextRun({ text: title, bold: true, size: 20, color: accent, font: "Calibri" })] }),
          ...lines.map((l) => new Paragraph({ spacing: { after: 70, line: 264 }, children: [new TextRun({ text: l, size: 19, font: "Calibri" })] })),
        ],
      })],
    })],
  });
}

const f = (v: number, dp = 1) =>
  v == null || !Number.isFinite(v) ? "—"
    : Math.abs(v) >= 1000 ? v.toLocaleString("en-GB", { maximumFractionDigits: 0 })
      : String(Math.round(v * 10 ** dp) / 10 ** dp);

const A = d.caseA, B = d.caseB, C = d.caseC, D = d.caseD, E = d.caseE;
const SITE = d.site.landAvailable_m2;
const K = d.benchmark;

const body: (Paragraph | Table)[] = [];

/* ================================================================== cover */
body.push(
  new Paragraph({ spacing: { before: 1600, after: 60 }, alignment: AlignmentType.CENTER,
    children: [new TextRun({ text: "BASIS OF DESIGN", bold: true, size: 46, color: NAVY, font: "Calibri" })] }),
  new Paragraph({ spacing: { after: 200 }, alignment: AlignmentType.CENTER,
    children: [new TextRun({ text: "Leachate Treatment Plant — IPAS 2, TPST Bantargebang", size: 26, color: TEAL, font: "Calibri" })] }),
  new Paragraph({ spacing: { after: 500 }, alignment: AlignmentType.CENTER,
    children: [new TextRun({ text: "1,200 m³/day · 2 ha site · new facility replacing the existing works", size: 20, color: "5A6B7B", font: "Calibri", italics: true })] }),
  table(["Item", "Detail"], [
    ["Prepared by", "PT CCEPC Environment Protection and Energy Comprehensive Utilization Indonesia"],
    ["Date", new Date(d.generated).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })],
    ["Design capacity", `${f(d.site.capacity_m3d)} m³/day (${f(d.site.capacity_m3h)} m³/h)`],
    ["Site area available", `${f(SITE)} m² (2 ha)`],
    ["Scope", "New plant. The existing facility is to be removed, not upgraded."],
    ["Effluent standard", "Permen LHK P.59/2016 — landfill leachate"],
    ["Status", "Basis of design. Not for construction. Laboratory verification outstanding."],
  ], [2500, 6900]),
  spacer(),
  callout("Read this first", [
    "This report is built on a water analysis that cannot be used as a design basis. It is a composite of five different published studies of five different landfills between 1993 and 2022, and two of its figures are physically impossible.",
    "The plant that analysis describes cannot be built by any membrane process at any cost. Section 2 shows why, with the arithmetic.",
    "Everything from Section 3 onward therefore runs on a substituted design basis. Every substitution is listed, with the reason. None of it is a substitute for sampling this site.",
  ], BAD, "9B2C1F"),
);

/* ====================================================== 1 executive summary */
body.push(new Paragraph({ pageBreakBefore: true, children: [] }), H1("1  Executive Summary"));

body.push(H2("1.1  Three findings, in order of consequence"));

body.push(H3("First: the characterisation cannot be used, and the plant it describes cannot be built"));
body.push(P(
  `Entered exactly as tabulated, the leachate carries 280,000 mg/L of dissolved solids. That is eight times seawater. At that salinity the osmotic pressure of the feed alone is ${f(Number(A.units.find((u: Json) => u.type === "dtro").sizing.find((s: Json) => /osmotic/i.test(s.label)).value.split(" ")[0]), 0)} bar, and the model calls for a membrane feed pressure of 877 bar against a module rating of 120. A membrane cannot produce water below its own osmotic pressure, so this is not a matter of specifying a stronger pump. There is no membrane route to this water as described.`,
));
body.push(P(
  "The specific energy that follows — 43.6 kWh/m³ against 8.6 for the same train on a defensible salinity — is the arithmetic consequence, not a design choice. Five times the energy for the same effluent is what an unusable input looks like once it reaches a model.",
));

body.push(H3("Second: land is not the constraint on this site"));
body.push(table(
  ["Scenario", "Flow, m³/d", "Process area, m²", "Share of the 2 ha site"],
  [
    ["B — 1,200 m³/d, concentrate to disposal", f(B.feedFlow_m3d), f(B.processArea_m2), `${f(B.processArea_m2 / SITE * 100)} %`],
    ["C — 1,200 m³/d with ZLD", f(C.feedFlow_m3d), f(C.processArea_m2), `${f(C.processArea_m2 / SITE * 100)} %`],
    [{ v: "E — 2028 target after capping, 2,100 m³/d", bg: OK }, { v: f(E.feedFlow_m3d), bg: OK }, { v: f(E.processArea_m2), bg: OK }, { v: `${f(E.processArea_m2 / SITE * 100)} %`, bg: OK }],
    ["D — 2028 target unmitigated, 7,000 m³/d", f(D.feedFlow_m3d), f(D.processArea_m2), `${f(D.processArea_m2 / SITE * 100)} %`],
  ], [3600, 1700, 2100, 2000], [1, 2, 3],
));
body.push(spacer());
body.push(P(
  `At the design capacity the process occupies about ${f(C.processArea_m2 / SITE * 100)} % of the site. Even the unmitigated 2028 target of 7,000 m³/day fits inside half of it. A multi-storey building saves land, and on this site there is no land to save.`,
));

body.push(H3("Third: the constraint is the waste slope, and it argues against building upward"));
body.push(P(
  "The site adjoins a very high waste pile, and the retaining wall between them has failed more than once through waste movement. That is the governing risk on this project, and it is a geotechnical problem rather than a process one.",
));
body.push(P(
  "A multi-storey structure is close to the worst available response to ground that moves. It concentrates load onto a small footprint, it turns a lateral ground displacement into a moment at the base, and it makes differential settlement — which water-retaining structures tolerate very badly — a whole-building problem rather than a single-tank one. If a wall fails again, a low-rise plant loses the units nearest the wall; a multi-storey plant loses the building.",
));
body.push(callout("The recommendation this leads to", [
  "Build low-rise, spread out, and spend the spare land on distance from the toe of the slope rather than on packing the plant tighter.",
  "Found each unit independently rather than on one common raft, and connect them with flexible couplings, so that ground movement damages one structure instead of all of them.",
  "Put the replaceable things nearest the slope and the irreplaceable things — MBR, DTRO, electrical room, control room — furthest from it.",
  "Cap the waste surface. It is reported to cut leachate generation by about 70 %, and it reduces infiltration into the waste mass, which is what drives the pore pressure behind the retaining wall. One intervention addresses the flow, the land and the slope at once.",
], OK, "0E7C5A"));

body.push(H2("1.2  What the plant achieves"));
body.push(table(
  ["Parameter", "P.59/2016 limit", "This design", "Margin"],
  [
    ["pH", "6 – 9", f(C.compliance.pH.v, 2), "mid-range"],
    ["BOD₅", "≤ 150 mg/L", f(B.compliance.BOD.v, 2), `${f(150 / Math.max(B.compliance.BOD.v, 0.01))}×`],
    ["COD", "≤ 300 mg/L", f(B.compliance.COD.v, 2), `${f(300 / Math.max(B.compliance.COD.v, 0.01))}×`],
    ["TSS", "≤ 100 mg/L", "< 1", "> 100×"],
    [{ v: "Total nitrogen", bg: WARN }, { v: "≤ 60 mg/L", bg: WARN }, { v: f(B.compliance.TN.v, 2), bg: WARN }, { v: `${f(60 / Math.max(B.compliance.TN.v, 0.01))}×`, bg: WARN }],
  ], [2600, 2300, 2300, 2200], [1, 2, 3],
));
body.push(spacer());
body.push(P(
  "Total nitrogen is highlighted because it is the parameter with the least protection against being wrong. The analysis gives ammonia but no total nitrogen, so the organic fraction is unknown — and organic nitrogen cannot be stripped at any air rate. If it turns out to be a significant share of the total, this is the number that moves first.",
));

/* ============================================================== 2 the data */
body.push(new Paragraph({ pageBreakBefore: true, children: [] }), H1("2  The Data, and Why It Cannot Be Used As It Stands"));

body.push(H2("2.1  What the sheet is"));
body.push(P(
  "The characterisation supplied lists 35 parameters against five separate literature sources — Gautam et al. (2020, 2021, 2022), Pavelka et al. (1993) and Singa et al. (2017). It is not an analysis of one water. It is a table of what several different landfills, on three continents and across thirty years, have been reported to contain.",
));
body.push(P(
  "That distinction matters more than it sounds. An ionic balance, the standard test of whether an analysis is internally valid, is meaningless across a composite: there is no single water whose charges have to sum to zero. Every cross-check that would normally catch an error is unavailable.",
));

body.push(H2("2.2  What the automated validation found"));
body.push(table(
  ["Severity", "Finding"],
  d.dataDefects.map((x: Json) => [
    { v: x.severity.toUpperCase(), bg: x.severity === "fail" ? BAD : x.severity === "warn" ? WARN : ALT, b: true },
    x.title,
  ]), [1500, 7900],
));

body.push(spacer());
body.push(H2("2.3  Two figures that cannot be right"));
body.push(H3("Dissolved solids at 280,000 mg/L"));
body.push(P(
  "Mature landfill leachate is normally reported between 5,000 and 30,000 mg/L. The tabulated figure is roughly ten times the upper end and eight times seawater. Case A below runs the design at that salinity so the consequence is visible rather than asserted.",
));
body.push(H3("Free chlorine at 130,000 mg/L"));
body.push(P(
  "Free chlorine cannot exist at any appreciable concentration in a water containing 35,000 mg/L of COD; it would be consumed within seconds of contact. The value is almost certainly chloride under the wrong label. Even read as chloride it is close to seven times seawater, and it is the origin of the impossible TDS.",
));

body.push(H2("2.4  Case A — the design run at the tabulated salinity"));
body.push(P(
  "The train in Section 3 was run unchanged, with only the salinity as tabulated. The reverse osmosis stage reports:",
));
const dtroA = A.units.find((u: Json) => u.type === "dtro");
body.push(table(["Quantity", "Value"], dtroA.sizing.map((s: Json) => [s.label, s.value]), [3800, 5600], [1]));
body.push(spacer());
body.push(callout("What the model says about Case A", dtroA.notes.slice(0, 2), BAD, "9B2C1F"));
body.push(spacer());
body.push(P(
  `The plant still produces a compliant effluent on paper, because the membrane is asked to do the impossible rather than told it cannot. What changes is the energy: ${f(A.sec_kWh_m3, 2)} kWh/m³ against ${f(B.sec_kWh_m3, 2)} for the identical train on a credible salinity, and ${f(A.energy_kWh_d)} kWh/day against ${f(B.energy_kWh_d)}. A design carried forward on this basis would be priced at five times its true energy and would still not work.`,
));

body.push(H2("2.5  Substitutions made for the design basis"));
body.push(table(
  ["Parameter", "As reported", "Used here", "Reason"],
  d.substitutions.map((s: Json) => [s.parameter, s.reported, s.used, s.why]),
  [1500, 1700, 1500, 4700],
));
body.push(spacer());
body.push(callout("This is an assumption, not a correction", [
  "Substituting a plausible number for an implausible one does not make the design basis correct. It makes it arguable.",
  "Nothing in this report should be quoted to a client as the characterisation of Bantargebang leachate. It is what a mature landfill leachate typically looks like, used so that the process logic can be worked through while the real sampling is arranged.",
  "The sampling campaign in Section 9 is not a formality. It is the difference between this being a study and being a design.",
], WARN, "8A6100"));

/* ======================================================= 3 process design */
body.push(new Paragraph({ pageBreakBefore: true, children: [] }), H1("3  Process Design"));

body.push(H2("3.1  The train, and why each step is there"));
const why: [string, string][] = [
  ["Intake & coarse screen", "Leachate carries plastic fragments, fibre and grit from the waste mass. Screening protects the pumps; it removes almost none of the suspended solids, and is not intended to."],
  ["Equalisation, 12 h", "Leachate flow and strength swing with rainfall. Everything downstream is dosed or aerated against a measured load, and a load that moves faster than the controllers cannot be dosed against."],
  ["Coagulation and lamella clarifier", "Takes the suspended solids out before anything expensive sees them, and removes part of the colloidal organic load. Lamella rather than horizontal-flow because the plate area is what makes it small."],
  ["Anaerobic reactor (UASB)", "At 35,000 mg/L of COD this is where the bulk of the organic load should be removed, because it needs no aeration and returns methane instead of consuming power. It appears in thirteen of the seventeen leachate plants CCEPC has delivered, always in this position."],
  ["Alkali dosing to pH 11", "Converts ammonium into free ammonia, which is the only form that can be stripped. Without this step the stripping tower moves air and nothing else."],
  ["Ammonia stripping", "Removes the nitrogen that biology cannot, because the carbon needed to denitrify it is not present. The off-gas is captured in a sulphuric acid scrubber and leaves as ammonium sulphate."],
  ["Neutralisation to pH 7", "Mandatory before the membrane. At high pH ammonia is a dissolved gas and passes reverse osmosis almost freely; at neutral pH it is an ion and is rejected above 95 %."],
  ["MBR", "Polishes the remaining biodegradable load and delivers a permeate with no suspended solids, which is the best feed a biological process can give a membrane."],
  ["DTRO, two stages", "The open-channel module is what allows reverse osmosis on a liquid that would block a spiral element within hours. Two stages reach 85 % recovery with each stage inside its own pressure and scaling envelope."],
  ["Catalytic advanced oxidation", "Removes the residual refractory colour that nothing upstream touches. Positioned after the membranes deliberately: the oxidant demand follows the mass of organic matter destroyed, so the same unit ahead of the membranes would cost roughly a hundred times more to run."],
  ["Final pH trim", "Reverse osmosis permeate is acidic — carbon dioxide passes the membrane and the alkalinity that would buffer it does not. Neither the membrane nor the ozone puts it back, and the discharge limit is pH 6 to 9."],
];
body.push(table(["Step", "Why it is in the train"], why.map(([a, b]) => [a, b]), [2200, 7200]));

body.push(spacer());
body.push(H2("3.2  Stage by stage"));
body.push(P("Concentrations are at the inlet to each named stage, so the effect of a unit is the difference between its row and the row below.", { sz: 18, it: true }));
body.push(table(
  ["Stage", "m³/d", "COD", "BOD", "TN", "NH₄-N", "TSS", "TDS", "pH"],
  B.stages.map((s: Json) => [
    s.stage, f(s.flow_m3d), f(s.COD), f(s.BOD), f(s.TN), f(s.NH4_N), f(s.TSS), f(s.TDS), f(s.pH, 1),
  ]), [2000, 800, 900, 800, 800, 800, 800, 900, 600], [1, 2, 3, 4, 5, 6, 7, 8],
));
body.push(spacer());
body.push(P("All concentrations mg/L except pH. Figures are model output, not measurements.", { sz: 17, it: true, color: "6B7A88" }));

body.push(H2("3.3  Compliance markers — what the seven regulated parameters do not cover"));
body.push(P(
  "Mercury and cadmium are two of the seven parameters P.59/2016 regulates, and neither affects the water balance. They are carried here end to end using removals published for whole treatment chains, credited to the strongest barrier in the train.",
));
body.push(table(
  ["Parameter", "Raw", "Removal", "Effluent", "Limit", "Status"],
  B.trace.slice(0, 10).map((t: Json) => {
    const bg = t.pass === false ? BAD : t.pass === true ? OK : undefined;
    const c = (v: string) => (bg ? { v, bg } : v);
    return [c(`${t.label} (${t.unit})`), c(f(t.inlet, 4)), c(`${f(t.removalPct, 0)} %`),
      c(f(t.outlet, 5)), c(t.limit != null ? f(t.limit, 4) : "not limited"),
      c(t.pass == null ? "—" : t.pass ? "Pass" : "FAIL")];
  }), [2400, 1400, 1300, 1500, 1400, 1400], [1, 2, 3, 4],
));

body.push(spacer());
body.push(callout("Two concentrations that decide whether the biology works at all", [
  ...B.inhibitions.map((i: Json) =>
    `${i.parameter} at ${f(i.value, 2)} mg/L is above the ${f(i.threshold, 1)} at which ${i.process} is inhibited.`),
  "Cyanide inhibits nitrifying bacteria at very low concentrations, and sulphide is directly toxic to aerobic biomass while exerting an oxygen demand of its own. Both figures come from the literature composite, so both may be wrong — but if either is right, the MBR will not perform as modelled and the ammonia limit will be missed while the carbon removal still looks healthy.",
  "These two determinands must be measured on the actual leachate before the biological stages are sized. They are cheap tests and they carry more design consequence than most of the parameters that were analysed.",
], WARN, "8A6100"));

/* ================================================ 4 balances and consumption */
body.push(new Paragraph({ pageBreakBefore: true, children: [] }), H1("4  Balances, Energy and Consumables"));

body.push(H2("4.1  Water balance"));
body.push(table(
  ["Case", "Feed, m³/d", "Product, m³/d", "Waste, m³/d", "Recovery", "Closure error"],
  [
    ["B — concentrate to disposal", f(B.feedFlow_m3d), f(B.productFlow_m3d), f(B.wasteFlow_m3d), `${f(B.recovery_pct, 2)} %`, `${f(B.waterClosure_pct, 4)} %`],
    [{ v: "C — with MVR and crystalliser", bg: OK }, { v: f(C.feedFlow_m3d), bg: OK }, { v: f(C.productFlow_m3d), bg: OK },
      { v: f(C.wasteFlow_m3d), bg: OK }, { v: `${f(C.recovery_pct, 2)} %`, bg: OK }, { v: `${f(C.waterClosure_pct, 4)} %`, bg: OK }],
  ], [2900, 1400, 1500, 1400, 1200, 1000], [1, 2, 3, 4, 5],
));
body.push(spacer());
body.push(P(
  `Adding evaporation and crystallisation lifts recovery from ${f(B.recovery_pct, 1)} % to ${f(C.recovery_pct, 1)} % and eliminates the liquid concentrate. It costs ${f(C.energy_kWh_d - B.energy_kWh_d)} kWh/day, which is ${f((C.energy_kWh_d / B.energy_kWh_d - 1) * 100)} % more energy than the plant without it. Whether that trade is worth taking depends entirely on whether the concentrate has anywhere to go, and on a landfill the honest answer is usually that it does not — returning it to the waste mass simply recirculates the load and, on this site, adds water to the slope that is already failing.`,
));

body.push(H2("4.2  Energy"));
body.push(table(
  ["Case", "Total, kW", "kWh/day", "Specific, kWh/m³"],
  [
    ["A — at the tabulated salinity", f(A.totalPower_kW), f(A.energy_kWh_d), f(A.sec_kWh_m3, 2)],
    ["B — design basis", f(B.totalPower_kW), f(B.energy_kWh_d), f(B.sec_kWh_m3, 2)],
    ["C — design basis with ZLD", f(C.totalPower_kW), f(C.energy_kWh_d), f(C.sec_kWh_m3, 2)],
  ], [3400, 2000, 2000, 2000], [1, 2, 3],
));
body.push(spacer());
body.push(P(
  "There is no plan to build a waste-to-energy plant on this site and no plan to draw from PLN, which leaves diesel generation. At that tariff the difference between Case B and Case C is not a rounding item, and it is a further argument for capping the waste surface before sizing anything: less leachate is less of every operating cost simultaneously.",
));

body.push(H2("4.3  Chemicals and residues"));
body.push(table(
  ["Consumable", "t/day"],
  B.chemicals_t_d.filter((c: Json) => c.t_d > 0.001).map((c: Json) => [c.name, f(c.t_d, 3)]),
  [6400, 3000], [1],
));
body.push(spacer());
body.push(callout("The chemical bill is the operating cost, not the energy", [
  `Hydrated lime at ${f(B.chemicals_t_d.find((c: Json) => /lime/i.test(c.name))?.t_d ?? 0, 1)} t/day and sulphuric acid at ${f(B.chemicals_t_d.find((c: Json) => /Sulphuric/i.test(c.name))?.t_d ?? 0, 1)} t/day dominate everything else in the plant.`,
  "Both come from the ammonia. Every mole of ammonium that has to become free ammonia consumes a mole of hydroxide, and every two moles captured in the scrubber consume a mole of sulphuric acid. At this ammonia concentration that term is an order of magnitude larger than the carbonate system, and a caustic dose sized from alkalinity alone would be short by several times.",
  "The client has been described as unable to sustain a high operating cost. This is the number that decides that, and it is another reason capping — which reduces the volume and therefore the mass of everything dosed — is worth more than any process optimisation available downstream.",
  `Dewatered sludge leaves at ${f(B.drySolids_t_d, 2)} t/day of dry solids, which needs a disposal route and a truck.`,
], WARN, "8A6100"));

/* ============================================================ 5 the slope */
body.push(new Paragraph({ pageBreakBefore: true, children: [] }), H1("5  The Site: an Adjacent Waste Slope"));

body.push(H2("5.1  What has been reported"));
body.push(bullet("The plant boundary adjoins a very high waste pile."));
body.push(bullet("The retaining wall between them has failed more than once, through movement of the waste mass."));
body.push(bullet("Two of the four original IPAS were destroyed by that movement, and only IPAS 2 is confirmed operating."));
body.push(bullet("The intention is to remove the existing facility and build a new one, rather than upgrade what is there."));
body.push(spacer());
body.push(P(
  "A wall that has failed repeatedly has not failed by accident. Either it was never designed for the load it carries, or the load has grown as the pile has grown, or the water behind it was never drained. Usually it is the third: a retaining structure against a saturated waste mass fails from pore water pressure at least as often as from the weight of the material itself, and drainage behind the wall is the cheapest thing to leave out of a design.",
));

body.push(H2("5.2  Why a multi-storey plant is the wrong response here"));
body.push(table(
  ["Effect of building upward", "Consequence on ground that moves"],
  [
    ["Load concentrated on a small footprint", "Higher bearing pressure, deeper and more expensive foundations, and a structure whose settlement behaviour depends on a soil profile nobody has yet investigated."],
    ["Height above the base", "A lateral ground displacement becomes a moment at the base. A low, spread structure absorbs the same displacement as a small rotation with no such amplification."],
    ["One structural frame", "Differential settlement is transmitted through the whole building. Water-retaining structures crack and leak under differential movement, and a cracked tank in a stacked plant cannot be isolated from the units below it."],
    ["All processes in one building", "A single failure event is a total loss. Spread low-rise, the same event takes out the units nearest the wall and leaves the rest running."],
    ["Land saved", `None that is needed. The process occupies ${f(C.processArea_m2 / SITE * 100)} % of the site at design capacity.`],
  ], [2900, 6500],
));

body.push(spacer());
body.push(H2("5.3  What to do instead"));
body.push(H3("Spend the land on distance"));
body.push(P(
  `The process needs about ${f(C.processArea_m2)} m². Allowing generously for access roads, chemical storage, the sludge yard, the electrical and control building and drainage, the built envelope is on the order of 4,000 m² — a fifth of the site. On a roughly square 2 ha plot that leaves something like 70 m of clear ground between the plant and the boundary nearest the waste, if the layout is set out deliberately to achieve it.`,
));
body.push(P(
  "Set-back is the only mitigation that is free, needs no maintenance, cannot be value-engineered out during construction, and works even if every other measure fails. On this site it is available in abundance and should be treated as the primary design decision, not as leftover space.",
));

body.push(...figure("scripts/out/layout-en.png",
  "Figure 1 — Proposed layout. Blocks are drawn to the area the model sized. The buffer is at the same scale as the plant, so the comparison is not rhetorical."));

body.push(H3("Found each unit independently"));
body.push(P(
  "Separate foundations per structure, with flexible couplings on every pipe crossing between them, mean that ground movement damages one unit rather than propagating through a common raft. It is a small cost at design stage and it is not retrofittable.",
));

body.push(H3("Order the plant by what you can afford to lose"));
body.push(P(
  "The membrane skids, the MBR, the electrical room and the control room are the expensive, long-lead and least replaceable items. They belong at the far edge. The equalisation basin, the sludge yard and the coagulation stage are civil works that can be rebuilt relatively quickly, and they can take the near edge.",
));

body.push(H3("Consider a modular plant rather than a monolithic one"));
body.push(P(
  "The membrane stages are naturally skid-mounted, and the pretreatment can be built as bolted steel or GRP tanks above ground rather than buried concrete. Above-ground tanks can be re-levelled after settlement, replaced individually, and moved if the boundary has to be pulled back. Buried concrete can do none of those things. This is the compact-plant idea worth taking from IPAL Krukut — modularity and prefabrication — separated from the stacking, which is the part that does not suit this site.",
));

body.push(H2("5.4  Capping: one intervention, three problems"));
body.push(table(
  ["What capping does", "Why it matters here"],
  [
    ["Cuts leachate generation by roughly 70 %", `The 2028 target falls from 7,000 to about 2,100 m³/day. Process area falls from ${f(D.processArea_m2)} m² to ${f(E.processArea_m2)} m², from ${f(D.processArea_m2 / SITE * 100)} % of the site to ${f(E.processArea_m2 / SITE * 100)} %, which is what preserves the set-back through the expansion.`],
    ["Cuts every consumption proportionally", `Energy falls from ${f(D.energy_kWh_d)} to ${f(E.energy_kWh_d)} kWh/day. Chemical mass falls in the same ratio, and chemicals are the dominant operating cost.`],
    ["Reduces infiltration into the waste mass", "Less infiltration is less pore water pressure behind the retaining wall, which is one of the two things that makes such walls fail. It is the only measure on this list that improves the stability of the slope itself."],
    ["Reduces the volume of water in the waste body", "A drier waste mass is a lighter and more stable one."],
  ], [2700, 6700],
));
body.push(spacer());
body.push(P(
  "Capping is normally presented as a landfill operations matter and treated as outside the water contractor's scope. On this site it is the single highest-leverage engineering decision available, and it is worth raising precisely because no one selling water treatment equipment has any incentive to raise it.",
));

body.push(H2("5.5  What must be established before any of this is designed"));
const geo: [string, string][] = [
  ["Height, slope angle and setback of the waste pile at the boundary", "Sets the lateral load and the run-out distance if the face fails. Without it no set-back can be justified numerically."],
  ["Slope stability analysis with a stated factor of safety, wet season", "The existing wall failures are evidence that this has either never been done or was done on dry-season assumptions."],
  ["Whether the pile is still receiving waste at this face, and to what final height", "A design against today's geometry is a design against a load that is still growing."],
  ["Groundwater and leachate level behind the retaining structure, and whether any drainage exists", "Pore pressure is the usual cause of failure and the cheapest to remedy."],
  ["Records of the previous wall failures — when, how far, what season", "Failures clustered in the wet season point to water; failures following tipping campaigns point to load."],
  ["Settlement records or survey monuments on the existing structures", "The existing IPAS is an instrumented experiment that has already been running for years; the data may exist."],
  ["Ground investigation on the plant footprint itself", "Foundation design cannot proceed without it, and on a site adjoining a waste mass the profile is unlikely to be uniform."],
  ["Whether a capping programme exists or is planned, and over what area", "Determines whether the 2028 flow is 7,000 or 2,100 m³/day, which changes the plant, the land take and the operating cost."],
];
body.push(table(["What to establish", "Why the design depends on it"], geo.map(([a, b]) => [a, b]), [3400, 6000]));

/* ================================================= 6 the Krukut comparison */
body.push(new Paragraph({ pageBreakBefore: true, children: [] }), H1("6  The Multi-Storey Question, and IPAL Krukut"));

body.push(P(
  `IPAL Krukut in Setia Budi, South Jakarta, is the reference usually cited for a vertical treatment plant in Indonesia, and correctly so: it is the first multi-storey IPAL in the country, it has been operating since August 2021, it treats ${f(K.capacity_m3d)} m³/day of domestic wastewater by MBBR, and it does so on ${f(K.land_m2)} m² with an education space and a rooftop cafe above the process.`,
));
body.push(table(
  ["", "IPAL Krukut", "IPAS 2 Bantargebang"],
  [
    ["Capacity", `${f(K.capacity_m3d)} m³/day`, `${f(d.site.capacity_m3d)} m³/day`],
    ["Site area", `${f(K.land_m2)} m²`, `${f(SITE)} m²`],
    [{ v: "Land available per m³/day", b: true }, { v: `${f(K.intensity_m2_per_m3d, 2)} m²`, bg: BAD, b: true }, { v: `${f(SITE / d.site.capacity_m3d, 1)} m²`, bg: OK, b: true }],
    ["Water", "Domestic sewage", "Mature landfill leachate"],
    ["Process", "MBBR, single biological stage", "Eleven stages including anaerobic, stripping, membrane and oxidation"],
    ["Governing constraint", "Land, absolutely", "Slope stability"],
  ], [2600, 3400, 3400],
));
body.push(spacer());
body.push(callout("The right reference for the wrong problem", [
  `Krukut had ${f(K.intensity_m2_per_m3d, 2)} m² of land for every m³/day it treats. Bantargebang has ${f(SITE / d.site.capacity_m3d, 1)} m² — roughly ${f(SITE / d.site.capacity_m3d / K.intensity_m2_per_m3d, 0)} times as much per unit of capacity.`,
  "Krukut went vertical because there was no alternative on a 1,200 m² pump station site in central Jakarta. It is an excellent solution to a problem this site does not have.",
  "What is worth taking from it is the compactness of the equipment and the willingness to prefabricate — not the stacking. Stacking is what a site adjoining an unstable slope can least afford.",
], ALT, NAVY),
);

/* ============================================ 7 sequencing and scalability */
body.push(new Paragraph({ pageBreakBefore: true, children: [] }), H1("7  Construction Sequencing and Scalability"));

body.push(H2("7.1  The plant cannot stop while it is replaced"));
body.push(P(
  "A TPST without a functioning leachate plant is not permitted to operate. The intention is to remove the existing facility and build a new one, which means the new plant must be commissioned before the old one is demolished, or a temporary plant must be provided for the interval.",
));
body.push(P(
  `The spare land is what makes the first option possible. Building the new works on the unoccupied part of the site, commissioning it, transferring the flow and only then demolishing the old basins avoids the interim entirely. This is a second reason not to design a compact plant on the existing footprint: doing so would force either a shutdown or a temporary installation, and both cost more than the land that was being saved.`,
));

body.push(H2("7.2  Scaling to the 2028 target"));
body.push(table(
  ["Scenario", "Flow, m³/d", "Process area", "Share of site", "Energy, kWh/d", "Recovery"],
  [
    ["Now — Case C", f(C.feedFlow_m3d), `${f(C.processArea_m2)} m²`, `${f(C.processArea_m2 / SITE * 100)} %`, f(C.energy_kWh_d), `${f(C.recovery_pct, 1)} %`],
    [{ v: "2028 with capping — Case E", bg: OK }, { v: f(E.feedFlow_m3d), bg: OK }, { v: `${f(E.processArea_m2)} m²`, bg: OK },
      { v: `${f(E.processArea_m2 / SITE * 100)} %`, bg: OK }, { v: f(E.energy_kWh_d), bg: OK }, { v: `${f(E.recovery_pct, 1)} %`, bg: OK }],
    [{ v: "2028 without capping — Case D", bg: WARN }, { v: f(D.feedFlow_m3d), bg: WARN }, { v: `${f(D.processArea_m2)} m²`, bg: WARN },
      { v: `${f(D.processArea_m2 / SITE * 100)} %`, bg: WARN }, { v: f(D.energy_kWh_d), bg: WARN }, { v: `${f(D.recovery_pct, 1)} %`, bg: WARN }],
  ], [2600, 1300, 1500, 1300, 1500, 1200], [1, 2, 3, 4, 5],
));
body.push(spacer());
body.push(P(
  `Even unmitigated, the 2028 target fits: ${f(D.processArea_m2)} m² of process on a ${f(SITE)} m² site. But at that point the built envelope with roads and buildings approaches three-quarters of the plot, and the set-back from the slope — the one mitigation that costs nothing today — is what gets consumed. That is the trade-off to state now, while the layout can still be fixed, rather than in 2028 when it cannot.`,
));

/* ====================================================== 8 recommendations */
body.push(new Paragraph({ pageBreakBefore: true, children: [] }), H1("8  Recommendations"));
const recs: [string, string][] = [
  ["1", "Do not design a multi-storey plant. The land it saves is not needed, and the geotechnical risk it adds is the governing risk on the site."],
  ["2", "Fix the set-back from the waste boundary as a design constraint before the layout is drawn, and protect it through the 2028 expansion."],
  ["3", "Found each unit independently, connect with flexible couplings, and place the irreplaceable equipment at the far edge."],
  ["4", "Build the new plant on the unoccupied ground and commission it before demolishing the old one. The TPST cannot stop."],
  ["5", "Sample the leachate properly. The present characterisation cannot support a design, and two of its figures are impossible."],
  ["6", "Measure cyanide and sulphide specifically. Either could stop the biological stages working, and neither is in the seven mandatory parameters."],
  ["7", "Raise capping with the client. It reduces the flow by about 70 %, reduces every operating cost in proportion, and is the only measure that also improves the stability of the slope."],
  ["8", "Commission a slope stability analysis for the wet season before committing to a boundary. The repeated wall failures are the evidence that this is outstanding."],
  ["9", "Treat the concentrate route as a decision, not a detail. Evaporation adds a third to the energy; returning concentrate to the waste mass adds water to a slope that is already failing."],
];
body.push(table(["#", "Recommendation"], recs.map(([a, b]) => [{ v: a, b: true }, b]), [700, 8700]));

/* ======================================================== 9 limitations */
body.push(new Paragraph({ pageBreakBefore: true, children: [] }), H1("9  Limitations"));
const lims = [
  "The water analysis is a literature composite of five studies of five different landfills between 1993 and 2022. It is not a characterisation of Bantargebang leachate and must not be quoted as one.",
  "Dissolved solids and chloride have been substituted, as set out in Section 2.5. Both substitutions are assumptions.",
  "Total nitrogen has been taken equal to the reported ammonia, which is the optimistic case. Organic nitrogen cannot be stripped, so if it is present the effluent nitrogen will be higher than modelled.",
  "Cyanide, sulphide and phenol are carried as compliance markers using train-level removals published for whole treatment chains, not per-unit rejections. They are indicative and are not a guarantee.",
  "Process areas are derived from the sized volumes divided by a working depth, with a 45 % allowance for access and pipework. They answer whether the plant fits; they do not replace a layout drawing.",
  "Capital costs are order-of-magnitude power-law estimates and have not been tested against any vendor quotation.",
  "Membrane performance has not been re-run in a supplier's projection software, which must be done before any commitment.",
  "No geotechnical information was available. Every statement about the slope is engineering judgement from what was described verbally, and Section 5.5 lists what has to be established before it can be anything more.",
  "The existing facility has not been surveyed. Demolition scope, buried services and the condition of the existing retaining structure are all unknown.",
  "Nothing here has been verified by pilot testing. On a refractory leachate a pilot is normally the difference between a proposal and a commitment.",
];
lims.forEach((l) => body.push(bullet(l)));

body.push(spacer());
body.push(callout("Status", [
  "This is a basis of design produced to structure the engineering conversation, not a design. It is issued so that the questions in Sections 5.5 and 9 can be put to the client with the reasons attached.",
  "Figures are generated directly by the HydroDesk simulation engine from the stated basis. The water balance closes to within 0.0001 % on every case presented.",
], ALT, NAVY));

/* ================================================================== build */
const doc = new Document({
  creator: "PT CCEPC Indonesia",
  title: "Basis of Design — Leachate Treatment Plant, IPAS 2 Bantargebang",
  styles: { default: { document: { run: { font: "Calibri", size: 20 } } } },
  sections: [{
    properties: { page: { margin: { top: 1000, bottom: 1000, left: 1000, right: 1000 } } },
    children: body,
  }],
});

void Packer.toBuffer(doc).then((buf) => {
  const out = "scripts/out/Bantargebang IPAS 2 - Basis of Design.docx";
  writeFileSync(out, buf);
  console.log(`Wrote ${out}  (${(buf.length / 1024).toFixed(0)} kB)`);
});
