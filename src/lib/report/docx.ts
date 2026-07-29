"use client";

import {
  AlignmentType, BorderStyle, Document, HeadingLevel, Packer, Paragraph, ShadingType,
  Table, TableCell, TableRow, TextRun, VerticalAlign, WidthType,
} from "docx";
import { Component, Flowsheet, SimulationResult } from "../engine/types";
import { alkalinityAsCaCO3, hardnessAsCaCO3, ionicBalanceErrorPct } from "../engine/stream";
import { feedStream } from "../engine/solver";
import { UNIT_BY_TYPE } from "../engine/units";
import { STANDARDS } from "../engine/templates";

const NAVY = "0F2942";
const GREY = "4A7694";
const HDR = "0F2942";
const ALT = "EEF6FB";
const WARN = "FEF3D4";
const OK = "D8F7E9";

const P = (t: string, o: { bold?: boolean; size?: number; color?: string; italics?: boolean; align?: (typeof AlignmentType)[keyof typeof AlignmentType]; after?: number } = {}) =>
  new Paragraph({
    alignment: o.align,
    spacing: { after: o.after ?? 120 },
    children: [new TextRun({ text: t, bold: o.bold, size: o.size ?? 20, color: o.color, italics: o.italics, font: "Calibri" })],
  });

const H1 = (t: string) =>
  new Paragraph({
    heading: HeadingLevel.HEADING_1, spacing: { before: 300, after: 140 },
    children: [new TextRun({ text: t, bold: true, size: 28, color: NAVY, font: "Calibri" })],
  });
const H2 = (t: string) =>
  new Paragraph({
    heading: HeadingLevel.HEADING_2, spacing: { before: 220, after: 110 },
    children: [new TextRun({ text: t, bold: true, size: 23, color: NAVY, font: "Calibri" })],
  });

function cell(text: string, w: number, o: { head?: boolean; bg?: string; num?: boolean; size?: number } = {}) {
  return new TableCell({
    width: { size: w, type: WidthType.DXA },
    shading: o.bg ? { type: ShadingType.CLEAR, fill: o.bg, color: "auto" } : undefined,
    verticalAlign: VerticalAlign.CENTER,
    margins: { top: 50, bottom: 50, left: 80, right: 80 },
    children: [
      new Paragraph({
        alignment: o.num ? AlignmentType.RIGHT : o.head ? AlignmentType.CENTER : AlignmentType.LEFT,
        spacing: { after: 0 },
        children: [new TextRun({
          text, bold: o.head, size: o.size ?? 16,
          color: o.head ? "FFFFFF" : undefined, font: "Calibri",
        })],
      }),
    ],
  });
}

function table(headers: string[], rows: (string | { v: string; bg?: string })[][], widths: number[], numCols: number[] = []) {
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
      new TableRow({
        tableHeader: true,
        children: headers.map((h, i) => cell(h, widths[i], { head: true, bg: HDR })),
      }),
      ...rows.map((r, ri) =>
        new TableRow({
          children: r.map((c, i) => {
            const obj = typeof c === "object";
            return cell(obj ? c.v : c, widths[i], {
              bg: obj && c.bg ? c.bg : ri % 2 === 1 ? ALT : undefined,
              num: numCols.includes(i),
            });
          }),
        }),
      ),
    ],
  });
}

const num = (v: number, dp = 2) => (Number.isFinite(v) ? v.toFixed(dp) : "-");

export async function buildReport(
  fs: Flowsheet, result: SimulationResult, studyName: string,
): Promise<Blob> {
  const s = result.summary;
  const std = STANDARDS.find((x) => x.key === fs.basis.standard);
  // Use the same conversion the solver uses, so alkalinity and hardness entered
  // as CaCO3 are reflected in the report exactly as they are in the balance.
  const feedProbe = feedStream(fs.feed);
  const ionErr = ionicBalanceErrorPct(feedProbe);
  const hard = hardnessAsCaCO3(feedProbe);
  const alk = alkalinityAsCaCO3(feedProbe);
  const today = new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" });

  const body: (Paragraph | Table)[] = [];

  /* ---------------------------------------------------------- cover */
  body.push(new Paragraph({ spacing: { after: 1400 }, children: [] }));
  body.push(P("PRE-APPROVAL TECHNICAL STUDY", { align: AlignmentType.CENTER, size: 20, color: GREY }));
  body.push(P(studyName || "Water Treatment Study", { align: AlignmentType.CENTER, size: 40, bold: true, color: NAVY, after: 200 }));
  body.push(P(`${fs.feed.name} — ${num(fs.feed.flow, 1)} m³/h feed`, { align: AlignmentType.CENTER, size: 22, color: GREY, after: 480 }));

  body.push(table(
    ["Item", "Detail"],
    [
      ["Document type", "Pre-approval technical study — for internal review"],
      ["Prepared", today],
      ["Design standard", std?.name ?? fs.basis.standard],
      ["Feed source", fs.feed.name],
      ["Feed flow", `${num(fs.feed.flow, 2)} m³/h`],
      ["Product flow", `${num(s.productFlow, 2)} m³/h`],
      [{ v: "Overall recovery", bg: OK }, { v: `${num(s.recoveryPct, 2)} %`, bg: OK }],
      ["Specific energy", `${num(s.secKWhPerM3, 3)} kWh/m³ of product`],
      ["Operating hours", `${fs.basis.operatingHoursPerYear} h/y`],
      ["Solver status", `${result.converged ? "Converged" : "NOT converged"} in ${result.iterations} iterations`],
    ],
    [2600, 6760],
  ));

  body.push(new Paragraph({ spacing: { after: 300 }, children: [] }));
  body.push(table(
    ["READ THIS FIRST"],
    [
      [{ v: "This is a screening study produced from a process simulation, not a design. Flow rates and equipment sizes follow directly from the parameters entered on the flowsheet; if an input is an assumption, so is every number derived from it. Costs are order-of-magnitude figures from capacity curves and generic unit rates, intended for ranking options, not for quoting a client.", bg: WARN }],
      [{ v: "Section 3 lists every design parameter the study depends on. Section 8 lists every engineering note raised by the models. Both should be read before the result is relied upon.", bg: WARN }],
    ],
    [9360],
  ));

  /* ---------------------------------------------------------- 1 summary */
  body.push(new Paragraph({ pageBreakBefore: true, children: [] }));
  body.push(H1("1  Summary and Recommendation"));
  body.push(P(
    `The flowsheet treats ${num(fs.feed.flow, 1)} m³/h of ${fs.feed.name.toLowerCase()} and delivers ` +
    `${num(s.productFlow, 2)} m³/h of product water at an overall recovery of ${num(s.recoveryPct, 2)} %. ` +
    `Total effluent is ${num(s.wasteFlow, 2)} m³/h. Installed power is ${num(s.totalPowerKW, 1)} kW, ` +
    `equivalent to ${num(s.secKWhPerM3, 3)} kWh per cubic metre of product.`,
  ));

  const verdict =
    s.warnings.length === 0 && s.recoveryPct >= 85
      ? "The configuration is technically sound on the data provided and no model raised an engineering warning."
      : s.warnings.length > 3 || s.recoveryPct < 60
        ? "The configuration carries significant open issues. It should not be presented as feasible until the notes in Section 8 are closed."
        : "The configuration is workable but conditional: the notes in Section 8 must be resolved before it can be guaranteed.";
  body.push(P(verdict, { bold: true }));

  body.push(H2("1.1  Headline figures"));
  body.push(table(
    ["Parameter", "Value", "Note"],
    [
      ["Feed flow", `${num(s.feedFlow, 2)} m³/h`, "From the design basis"],
      ["Product flow", `${num(s.productFlow, 2)} m³/h`, "Sum of all product outlets"],
      ["Effluent flow", `${num(s.wasteFlow, 2)} m³/h`, `${num((s.wasteFlow / Math.max(s.feedFlow, 0.001)) * 100, 2)} % of feed`],
      [{ v: "Overall recovery", bg: OK }, { v: `${num(s.recoveryPct, 2)} %`, bg: OK }, { v: "Product / feed", bg: OK }],
      ["Installed power", `${num(s.totalPowerKW, 1)} kW`, "Sum of all unit demands"],
      ["Specific energy (SEC)", `${num(s.secKWhPerM3, 3)} kWh/m³`, "Per m³ of product"],
      ["Dry solids", `${num(s.drySolidsKgH, 2)} kg/h`, "Clarification, biology and softening"],
      ["Total retention", `${num(s.hrtTotalH, 2)} h`, "Sum of tank and reactor HRT"],
      ["Indicative installed cost", `${Math.round(s.capexUSD).toLocaleString()} USD`, "Order of magnitude only"],
      ["Indicative OPEX", `${Math.round(s.opexUSDPerY).toLocaleString()} USD/y`, `${num(s.opexUSDPerM3, 3)} USD/m³`],
    ],
    [3000, 2600, 3760],
  ));

  /* ---------------------------------------------------------- 2 feed */
  body.push(H1("2  Feed Water Quality"));
  body.push(P(`Source: ${fs.feed.name}. Flow ${num(fs.feed.flow, 2)} m³/h, temperature ${num(fs.feed.T, 1)} °C, pH ${num(fs.feed.pH, 2)}${fs.feed.turbidityNTU != null ? `, turbidity ${num(fs.feed.turbidityNTU, 1)} NTU` : ""}.`));

  const ionRows: (string | { v: string; bg?: string })[][] = [];
  const shown: Component[] = ["Na", "K", "Ca", "Mg", "NH4", "Cl", "SO4", "HCO3", "CO3", "NO3", "SiO2", "Fe", "Mn", "TDS", "TSS", "BOD", "COD", "TOC", "TN", "TP", "Oil"];
  for (const k of shown) {
    const v = fs.feed.c[k];
    if (v == null || v === 0) continue;
    ionRows.push([k, num(v, v < 1 ? 4 : 2), "mg/L"]);
  }
  body.push(table(["Parameter", "Value", "Unit"], ionRows, [3600, 3000, 2760], [1]));

  body.push(H2("2.1  Derived quantities and data validation"));
  body.push(table(
    ["Check", "Result", "Interpretation"],
    [
      ["Total hardness", `${num(hard, 1)} mg/L CaCO₃`, `${num(hard / 50, 3)} mmol/L on the univalent basis`],
      ["Alkalinity", `${num(alk, 1)} mg/L CaCO₃`, "From bicarbonate and carbonate"],
      ["Non-carbonate hardness", `${num(Math.max(0, hard - alk), 1)} mg/L CaCO₃`,
        hard > 0 && (hard - alk) / hard > 0.6
          ? "Majority is non-carbonate: lime softening cannot remove it"
          : "Predominantly carbonate hardness"],
      [
        { v: "Ionic balance error", bg: Math.abs(ionErr) > 5 ? WARN : OK },
        { v: `${ionErr >= 0 ? "+" : ""}${num(ionErr, 1)} %`, bg: Math.abs(ionErr) > 5 ? WARN : OK },
        { v: Math.abs(ionErr) > 5 ? "FAILS the ±5 % tolerance — a major ion is missing or misreported" : "Within the ±5 % tolerance", bg: Math.abs(ionErr) > 5 ? WARN : OK },
      ],
    ],
    [2800, 2400, 4160],
  ));
  if (Math.abs(ionErr) > 5) {
    body.push(P(
      "An analysis that fails its ionic balance is not internally valid. Every quantity that depends on the anion set — " +
      "membrane scaling indices, corrosion assessment and cooling water saturation indices — carries correspondingly low " +
      "confidence. Chloride is the ion most often omitted from a laboratory sheet and should be checked first.",
      { italics: true },
    ));
  }

  /* ---------------------------------------------------------- 3 basis */
  body.push(H1("3  Design Basis and Assumptions"));
  body.push(P("Every value below was entered by the engineer. Anything not confirmed by the client is an assumption, and the results move with it."));
  body.push(table(
    ["Item", "Value"],
    [
      ["Design standard", std?.name ?? fs.basis.standard],
      ["Standard scope", std?.scope ?? "-"],
      ["Operating hours", `${fs.basis.operatingHoursPerYear} h/y`],
      ["Design margin", `${fs.basis.designMarginPct} %`],
      ["Electricity price", `${fs.basis.electricityUSDPerKWh} USD/kWh`],
      ...fs.basis.extra.filter((e) => e.key).map((e) => [e.key, e.value] as string[]),
    ],
    [3600, 5760],
  ));

  if (std && std.limits.length > 0) {
    body.push(H2("3.1  Product specification"));
    body.push(table(["Parameter", "Limit"], std.limits.map((l) => [l.param, l.limit]), [4200, 5160]));
  }

  body.push(H2("3.2  Unit operation parameters"));
  for (const nd of fs.nodes) {
    const model = UNIT_BY_TYPE[nd.type];
    if (!model || model.params.length === 0) continue;
    const rows = model.params
      .map((p) => {
        const v = nd.params[p.key];
        if (v == null) return null;
        return [p.label, String(v), p.unit ?? "-"];
      })
      .filter((r): r is string[] => r !== null);
    if (rows.length === 0) continue;
    body.push(P(`${nd.label} — ${model.label}`, { bold: true, size: 19, after: 60 }));
    body.push(table(["Parameter", "Value", "Unit"], rows, [4200, 2600, 2560], [1]));
    body.push(new Paragraph({ spacing: { after: 120 }, children: [] }));
  }

  /* ---------------------------------------------------------- 4 water balance */
  body.push(new Paragraph({ pageBreakBefore: true, children: [] }));
  body.push(H1("4  Water Balance"));
  body.push(table(
    ["Stream", "Type", "From", "To", "Flow m³/h", "% of feed"],
    [
      ...result.feedStreams.map((r) => [r.label, "Feed", r.from, r.to, num(r.stream.flow, 3), num((r.stream.flow / Math.max(s.feedFlow, 0.001)) * 100, 2)]),
      ...result.productStreams.map((r) => [
        { v: r.label, bg: OK }, { v: "Product", bg: OK }, { v: r.from, bg: OK }, { v: r.to, bg: OK },
        { v: num(r.stream.flow, 3), bg: OK }, { v: num((r.stream.flow / Math.max(s.feedFlow, 0.001)) * 100, 2), bg: OK },
      ]),
      ...result.wasteStreams.map((r) => [r.label, "Waste", r.from, r.to, num(r.stream.flow, 3), num((r.stream.flow / Math.max(s.feedFlow, 0.001)) * 100, 2)]),
    ],
    [1500, 1200, 2200, 2000, 1300, 1160],
    [4, 5],
  ));
  body.push(new Paragraph({ spacing: { after: 140 }, children: [] }));
  body.push(table(
    ["Balance", "In", "Out", "Closure error"],
    s.waterBalance.map((b) => [
      b.label, `${num(b.inKgH, 3)} m³/h`, `${num(b.outKgH, 3)} m³/h`,
      { v: `${b.errorPct >= 0 ? "+" : ""}${num(b.errorPct, 3)} %`, bg: Math.abs(b.errorPct) < 0.5 ? OK : WARN },
    ]),
    [2600, 2200, 2200, 2360],
    [1, 2, 3],
  ));

  /* ---------------------------------------------------------- 5 stream table */
  body.push(new Paragraph({ pageBreakBefore: true, children: [] }));
  body.push(H1("5  Stream Table"));
  const cols: Component[] = ["TDS", "Na", "Ca", "Mg", "Cl", "SO4"];
  const all = [
    ...result.feedStreams.map((r) => ({ ...r, kind: "Feed" })),
    ...result.streams.map((r) => ({ ...r, kind: "Int." })),
    ...result.productStreams.map((r) => ({ ...r, kind: "Prod." })),
    ...result.wasteStreams.map((r) => ({ ...r, kind: "Waste" })),
  ];
  body.push(table(
    ["Stream", "Type", "Flow", "pH", ...cols.map((c) => c)],
    all.map((r) => [
      r.label, r.kind, num(r.stream.flow, 2), num(r.stream.pH, 2),
      ...cols.map((c) => num(r.stream.c[c], r.stream.c[c] < 1 ? 3 : 1)),
    ]),
    [1400, 900, 1000, 700, 900, 900, 900, 900, 900, 860],
    [2, 3, 4, 5, 6, 7, 8, 9],
  ));
  body.push(P("Concentrations in mg/L, flow in m³/h.", { italics: true, size: 16, color: GREY }));

  /* ---------------------------------------------------------- 6 balances */
  body.push(H1("6  Salt, Organic and Nutrient Balances"));
  body.push(H2("6.1  Dissolved salt load"));
  body.push(table(
    ["Component", "In kg/h", "Out kg/h", "Difference", "Closure %"],
    s.saltBalance.map((b) => [b.label, num(b.inKgH, 3), num(b.outKgH, 3), num(b.inKgH - b.outKgH, 3), num(b.errorPct, 2)]),
    [2400, 1800, 1800, 1800, 1560],
    [1, 2, 3, 4],
  ));
  body.push(H2("6.2  Organic and nutrient load"));
  body.push(table(
    ["Component", "In kg/h", "Out kg/h", "Removed", "Closure %"],
    s.biologicalBalance.map((b) => [b.label, num(b.inKgH, 3), num(b.outKgH, 3), num(b.inKgH - b.outKgH, 3), num(b.errorPct, 2)]),
    [2400, 1800, 1800, 1800, 1560],
    [1, 2, 3, 4],
  ));
  body.push(P(
    "A positive difference on BOD, COD, TN or TP is expected: biological and precipitation steps destroy or transfer " +
    "that load rather than passing it to an outlet. A positive difference on a conservative ion such as sodium or " +
    "chloride is not expected and indicates an unconnected stream.",
    { italics: true, size: 16, color: GREY },
  ));

  /* ---------------------------------------------------------- 7 energy */
  body.push(new Paragraph({ pageBreakBefore: true, children: [] }));
  body.push(H1("7  Energy, Chemicals and Equipment"));
  body.push(H2("7.1  Power demand"));
  const powered = result.nodes.filter((x) => x.aux.powerKW > 0.01).sort((a, b) => b.aux.powerKW - a.aux.powerKW);
  body.push(table(
    ["Unit", "Power kW", "Share %"],
    [
      ...powered.map((x) => [x.label, num(x.aux.powerKW, 2), num((x.aux.powerKW / Math.max(s.totalPowerKW, 0.001)) * 100, 1)]),
      [{ v: "TOTAL", bg: OK }, { v: num(s.totalPowerKW, 2), bg: OK }, { v: "100.0", bg: OK }],
    ],
    [4800, 2400, 2160],
    [1, 2],
  ));
  body.push(P(`Specific energy consumption: ${num(s.secKWhPerM3, 3)} kWh per m³ of product water.`, { bold: true }));

  body.push(H2("7.2  Chemical balance"));
  if (s.chemicals.length > 0) {
    body.push(table(
      ["Chemical (100 % active)", "kg/h", "t/y", "Indicative USD/y"],
      s.chemicals.map((c) => [c.name, num(c.kgPerH, 4), num(c.tPerY, 2), Math.round(c.usdPerY).toLocaleString()]),
      [3800, 1800, 1800, 1960],
      [1, 2, 3],
    ));
  } else {
    body.push(P("No chemical dosing is configured on this flowsheet."));
  }

  body.push(H2("7.3  Preliminary equipment sizing"));
  for (const nd of result.nodes) {
    if (nd.aux.sizing.length === 0) continue;
    body.push(P(nd.label, { bold: true, size: 19, after: 60 }));
    body.push(table(["Item", "Value"], nd.aux.sizing.map((z) => [z.label, z.value]), [4200, 5160]));
    body.push(new Paragraph({ spacing: { after: 110 }, children: [] }));
  }

  /* ---------------------------------------------------------- 8 notes */
  body.push(new Paragraph({ pageBreakBefore: true, children: [] }));
  body.push(H1("8  Engineering Notes and Open Items"));
  if (s.warnings.length === 0) {
    body.push(P("No model raised an engineering warning for this configuration."));
  } else {
    body.push(P(`The models raised ${s.warnings.length} note${s.warnings.length > 1 ? "s" : ""}. Each should be closed, or explicitly accepted, before this study is presented as a basis for a proposal.`));
    body.push(table(
      ["#", "Note"],
      s.warnings.map((w, i) => [String(i + 1), { v: w, bg: WARN }]),
      [700, 8660],
    ));
  }

  body.push(H1("9  Limitations"));
  for (const t of [
    "This study is a process simulation, not a design. No hydraulic calculation, plot plan, civil load, electrical load list or control philosophy has been prepared.",
    "Equipment sizing follows standard design loading rates and has not been verified against any vendor's performance software. Membrane projections in particular must be re-run in the selected supplier's program before any commitment.",
    "Costs are order-of-magnitude screening figures derived from capacity cost curves and generic unit rates. They are suitable for ranking options against each other and for nothing else.",
    "The result is only as good as the feed water analysis. Where the analysis is old, incomplete or fails its ionic balance, the flow rates and equipment sizes inherit that uncertainty.",
    "Recovery is computed as the sum of connected product outlets divided by the feed. A stream left unconnected on the flowsheet will not appear in the balance and will overstate recovery.",
  ]) {
    body.push(P("•  " + t, { after: 90 }));
  }

  const doc = new Document({
    creator: "HydroDesk",
    title: studyName || "Pre-approval technical study",
    description: "Generated by HydroDesk process simulation",
    styles: { default: { document: { run: { font: "Calibri", size: 20 } } } },
    sections: [
      {
        properties: {
          page: { size: { width: 11906, height: 16838 }, margin: { top: 1080, right: 1200, bottom: 1080, left: 1200 } },
        },
        children: body,
      },
    ],
  });

  return Packer.toBlob(doc);
}
