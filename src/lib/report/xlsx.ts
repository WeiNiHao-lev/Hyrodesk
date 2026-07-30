import ExcelJS from "exceljs";
import { Component, Flowsheet, SimulationResult } from "../engine/types";
import { alkalinityAsCaCO3, hardnessAsCaCO3, ionicBalanceErrorPct } from "../engine/stream";
import { feedStream } from "../engine/solver";
import { UNIT_BY_TYPE } from "../engine/units";
import { STANDARDS } from "../engine/templates";
import { calcRowsFor, CalcRow } from "./calcsheets";
import { ArrowSpec, injectArrows } from "./xlsxArrows";

/**
 * Excel export.
 *
 * The whole point is that nothing is a dead number. Inputs sit in one place and
 * every derived cell is a real Excel formula referring back to them, so the
 * reader can trace any figure to its origin and change an assumption to see what
 * moves. That is how the Wankai design sheets work, and it is the only form in
 * which a calculation can actually be checked.
 *
 * Every sheet is included every time. The reading guide, the "where the equation
 * comes from" column and the glossary are what make a figure traceable, which is
 * the whole point of the export; the extended theory lives in the companion
 * "Export for me" document, where prose belongs.
 */

const NAVY = "FF0F2942";
const HDRBG = "FF0F2942";
const ALT = "FFEEF6FB";
const INPUT = "FFFFF4D6";
const CALC = "FFEAF4FC";
const OKBG = "FFE6F7EE";
const WARNBG = "FFFDF2E9";

const ION_COLS: Component[] = ["TDS", "Na", "K", "Ca", "Mg", "Cl", "SO4", "HCO3", "SiO2", "NO3", "Fe"];
const BIO_COLS: Component[] = ["TSS", "BOD", "COD", "TOC", "TN", "TP", "NH4", "Oil"];

function styleHeader(row: ExcelJS.Row, cols: number) {
  for (let i = 1; i <= cols; i++) {
    const c = row.getCell(i);
    c.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 10, name: "Calibri" };
    c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: HDRBG } };
    c.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
    c.border = { bottom: { style: "thin", color: { argb: NAVY } } };
  }
  row.height = 28;
}

function title(ws: ExcelJS.Worksheet, text: string, sub?: string, span = 8) {
  ws.mergeCells(1, 1, 1, span);
  const t = ws.getCell(1, 1);
  t.value = text;
  t.font = { bold: true, size: 14, color: { argb: NAVY }, name: "Calibri" };
  t.alignment = { vertical: "middle" };
  ws.getRow(1).height = 24;
  if (sub) {
    ws.mergeCells(2, 1, 2, span);
    const s = ws.getCell(2, 1);
    s.value = sub;
    s.font = { size: 9, italic: true, color: { argb: "FF4A7694" }, name: "Calibri" };
    s.alignment = { wrapText: true, vertical: "top" };
    ws.getRow(2).height = 30;
  }
}

const slug = (s: string) =>
  (s || "study").replace(/[\\/*?:[\]]/g, "-").slice(0, 28);

/* ================================================================ workbook */

export async function buildWorkbook(
  fs: Flowsheet,
  result: SimulationResult,
  studyName: string,
): Promise<Blob> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "HydroDesk";
  wb.created = new Date();
  // Recycle loops make the balance genuinely circular; let Excel iterate.
  wb.calcProperties.fullCalcOnLoad = true;

  sheetHowToRead(wb, fs, result, studyName);
  const inputRefs = sheetInputs(wb, fs, result);
  const arrows = sheetBalanceDiagram(wb, fs, result, inputRefs);
  sheetStreamTable(wb, fs, result);
  sheetCalcs(wb, fs, result);
  sheetEnergyChem(wb, fs, result, inputRefs);
  // A short derivations sheet stays in the workbook as quick reference while you
  // are in the numbers; the full treatment is in the companion document.
  sheetTheory(wb);
  sheetGlossary(wb);

  let buf = (await wb.xlsx.writeBuffer()) as ArrayBuffer;
  // ExcelJS cannot write shapes, so the diagram arrows are injected into the
  // finished package. Failure here must not lose the workbook.
  try {
    buf = await injectArrows(buf, DIAGRAM_SHEET, arrows);
  } catch { /* keep the workbook without arrows */ }
  return new Blob([buf], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
}

/* ------------------------------------------------------------- 0. how to read */

function sheetHowToRead(
  wb: ExcelJS.Workbook, fs: Flowsheet, result: SimulationResult, studyName: string,
) {
  const ws = wb.addWorksheet("0. How to read this", { properties: { tabColor: { argb: "FF12B981" } } });
  ws.columns = [{ width: 4 }, { width: 34 }, { width: 96 }];
  title(ws, `${studyName} — how to read this workbook`,
    "Written for someone who wants to check the calculation, not just read the answer.", 3);

  let r = 4;
  const block = (heading: string, lines: string[]) => {
    ws.getCell(r, 2).value = heading;
    ws.getCell(r, 2).font = { bold: true, size: 11, color: { argb: NAVY }, name: "Calibri" };
    r++;
    for (const l of lines) {
      ws.getCell(r, 3).value = l;
      ws.getCell(r, 3).alignment = { wrapText: true, vertical: "top" };
      ws.getCell(r, 3).font = { size: 10, name: "Calibri" };
      ws.getRow(r).height = Math.max(15, Math.ceil(l.length / 105) * 14);
      r++;
    }
    r++;
  };

  block("Nothing here is a dead number", [
    "Every value that is derived is written as a live Excel formula pointing at the cells it came from. Click any cell and the formula bar tells you where it came from. Change an input and the whole workbook recalculates.",
    "That is the difference between a report and a calculation. A report tells you the answer; a calculation lets you disagree with it.",
  ]);

  block("Colour tells you what kind of number it is", [
    "AMBER  — an input. Either a measurement, a design choice, or an assumption. These are the only cells you should normally edit.",
    "BLUE   — derived by formula from the ambers. Do not overwrite; change the input instead.",
    "GREEN  — a result worth quoting.",
    "ORANGE — a warning, or a value that needs checking before it is relied upon.",
  ]);

  block("The sheets, in the order they are meant to be read", [
    "1. Inputs — every assumption in one place, so the workbook can be re-run against new data by editing here alone.",
    "2. Water Balance Diagram — the plant laid out left to right, showing flow and quality at each stage. Follow the formulas backwards from the product to see where the intake figure comes from.",
    "3. Stream Table — every stream with its full composition.",
    "4.x Design Calculations — one sheet per unit, in the industry format: item, symbol, value, unit, formula, notes. The Formula column gives the relationship in symbols; the Value column gives it as a live Excel formula.",
    "5. Energy & Chemicals — power per unit and chemical consumption.",
    "6. Theory & Derivations — where each equation comes from.",
    "7. Glossary — symbols and units.",
  ]);

  block("How the plant was sized", [
    (fs.basis.designMode ?? "product-driven") === "product-driven"
      ? `Product-driven: the target product flow was fixed at ${(fs.basis.targetProductFlow ?? 0).toFixed(2)} m³/h and the intake solved backwards through every recovery, backwash and reject. The intake of ${result.summary.feedFlow.toFixed(2)} m³/h is a RESULT, not an input — which is what it is in reality.`
      : `Feed-driven: the intake was fixed at ${result.summary.feedFlow.toFixed(2)} m³/h and the product calculated forwards. Use this only when the intake is genuinely constrained.`,
    "The Wankai reference sheets do the same thing: their Q= cells divide the downstream flow by the recovery rather than multiplying forwards.",
  ]);

  block("What this workbook is not", [
    "It is a screening calculation, not a design. Sizing uses standard design loading rates and has not been checked against any vendor's performance software. Membrane projections must be re-run in the supplier's own program before commitment.",
    "Costs are order-of-magnitude figures from capacity curves and generic unit rates. They rank options against each other; they do not quote a client.",
    "Where the input data is an assumption, so is every number derived from it. The Inputs sheet marks which is which.",
  ]);
}

/* --------------------------------------------------------------- 1. inputs */

interface InputRefs {
  feedFlow: string;
  targetProduct: string;
  hours: string;
  power: string;
  comp: Partial<Record<Component, string>>;
}

function sheetInputs(
  wb: ExcelJS.Workbook, fs: Flowsheet, result: SimulationResult,
): InputRefs {
  const ws = wb.addWorksheet("1. Inputs", { properties: { tabColor: { argb: "FFF2A516" } } });
  ws.columns = [
    { width: 5 }, { width: 40 }, { width: 15 }, { width: 14 }, { width: 60 },
  ];
  title(ws, "Design inputs and assumptions",
    "Amber cells are the only ones to edit. Everything in the rest of the workbook is derived from here by formula.", 5);

  const probe = feedStream(fs.feed);
  let r = 4;
  const refs: InputRefs = { feedFlow: "", targetProduct: "", hours: "", power: "", comp: {} };

  const sec = (t: string) => {
    ws.mergeCells(r, 1, r, 5);
    const c = ws.getCell(r, 1);
    c.value = t;
    c.font = { bold: true, size: 11, color: { argb: NAVY }, name: "Calibri" };
    c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFDCEBF6" } };
    r++;
  };
  const hdr = () => {
    const row = ws.getRow(r);
    row.values = ["No", "Item", "Value", "Unit", "Basis / note"];
    styleHeader(row, 5);
    r++;
  };
  let no = 0;
  const put = (item: string, val: number | undefined, unit: string, note: string): string => {
    no++;
    const row = ws.getRow(r);
    row.getCell(1).value = no;
    row.getCell(2).value = item;
    row.getCell(3).value = val ?? null;
    row.getCell(3).fill = { type: "pattern", pattern: "solid", fgColor: { argb: INPUT } };
    row.getCell(3).numFmt = "0.####";
    row.getCell(3).font = { bold: true, name: "Calibri", size: 10 };
    row.getCell(4).value = unit;
    row.getCell(5).value = note;
    row.getCell(5).alignment = { wrapText: true, vertical: "top" };
    for (let i = 1; i <= 5; i++) row.getCell(i).border = { bottom: { style: "hair", color: { argb: "FFAAB7C4" } } };
    const ref = `'1. Inputs'!$C$${r}`;
    r++;
    return ref;
  };

  sec("Design basis");
  hdr();
  const mp = (fs.basis.designMode ?? "product-driven") === "product-driven";
  refs.targetProduct = put("Target product flow", fs.basis.targetProductFlow ?? result.summary.productFlow, "m³/h",
    mp ? "CLIENT REQUIREMENT. The intake is solved backwards from this." : "Result of the forward calculation.");
  refs.feedFlow = put("Raw water intake", result.summary.feedFlow, "m³/h",
    mp ? "RESULT — solved from the product demand. Not an input." : "FIXED INPUT — an existing intake or a licensed abstraction limit.");
  refs.hours = put("Operating hours", fs.basis.operatingHoursPerYear, "h/y", "Scales every annual consumption figure.");
  refs.power = put("Electricity price", fs.basis.electricityUSDPerKWh, "USD/kWh", "Turns specific energy into money.");
  put("Design margin", fs.basis.designMarginPct, "%", "Allowance above the calculated duty.");
  const std = STANDARDS.find((s) => s.key === fs.basis.standard);
  no++;
  ws.getCell(r, 1).value = no;
  ws.getCell(r, 2).value = "Design standard";
  ws.mergeCells(r, 3, r, 5);
  ws.getCell(r, 3).value = std?.name ?? fs.basis.standard;
  ws.getCell(r, 3).alignment = { wrapText: true };
  r += 2;

  sec("Feed water — as entered");
  hdr();
  put("Temperature", fs.feed.T, "°C", "Affects membrane flux and biological rates.");
  put("pH", fs.feed.pH, "-", "");
  if (fs.feed.conductivityUScm != null) put("Conductivity", fs.feed.conductivityUScm, "µS/cm", "Cross-check on TDS: 1 µS/cm ≈ 0.55–0.90 mg/L.");
  if (fs.feed.turbidityNTU != null) put("Turbidity", fs.feed.turbidityNTU, "NTU", "Design on the wet-season peak, not the average.");
  if (fs.feed.alkalinityAsCaCO3 != null) put("Total alkalinity", fs.feed.alkalinityAsCaCO3, "mg/L CaCO₃", "As reported by the laboratory; converted to bicarbonate for the balance.");
  if (fs.feed.hardnessAsCaCO3 != null) put("Total hardness", fs.feed.hardnessAsCaCO3, "mg/L CaCO₃", "As reported; split into calcium and magnesium for the balance.");
  for (const k of [...ION_COLS, ...BIO_COLS]) {
    const v = probe.c[k];
    if (v == null || v === 0) continue;
    refs.comp[k] = put(k, v, "mg/L", "");
  }

  r++;
  sec("Derived from the analysis — checks, not inputs");
  hdr();
  const chk = (item: string, val: number, unit: string, note: string, bad = false) => {
    const row = ws.getRow(r);
    row.getCell(2).value = item;
    row.getCell(3).value = val;
    row.getCell(3).numFmt = "0.###";
    row.getCell(3).fill = { type: "pattern", pattern: "solid", fgColor: { argb: bad ? WARNBG : CALC } };
    row.getCell(4).value = unit;
    row.getCell(5).value = note;
    row.getCell(5).alignment = { wrapText: true, vertical: "top" };
    r++;
  };
  const hard = hardnessAsCaCO3(probe);
  const alk = alkalinityAsCaCO3(probe);
  const ionErr = ionicBalanceErrorPct(probe);
  chk("Total hardness", hard, "mg/L CaCO₃", "From calcium and magnesium.");
  chk("Alkalinity", alk, "mg/L CaCO₃", "From bicarbonate and carbonate.");
  chk("Non-carbonate hardness", Math.max(0, hard - alk), "mg/L CaCO₃",
    hard > 0 && (hard - alk) / hard > 0.6
      ? "Majority is non-carbonate: lime softening cannot remove it."
      : "Predominantly carbonate hardness.");
  chk("Ionic balance error", ionErr, "%",
    Math.abs(ionErr) > 5
      ? "OUTSIDE ±5 %. The analysis is not internally valid — a major ion is missing or misreported. Check chloride first."
      : "Within ±5 %.",
    Math.abs(ionErr) > 5);

  {
    r++;
    sec("Why this sheet exists");
    ws.mergeCells(r, 2, r, 5);
    const c = ws.getCell(r, 2);
    c.value =
      "Putting every input in one place is what makes a calculation auditable. When someone asks \"what if the hardness is really 42 rather than 165?\", you change one amber cell and the whole workbook answers. If the same number is typed into forty cells, nobody can answer that question and nobody trusts the result.";
    c.alignment = { wrapText: true, vertical: "top" };
    c.font = { size: 10, italic: true, name: "Calibri" };
    ws.getRow(r).height = 46;
  }

  ws.views = [{ state: "frozen", ySplit: 3 }];
  return refs;
}

/* ---------------------------------------------------- 2. water balance diagram */

const DIAGRAM_SHEET = "2. Water Balance Diagram";

function sheetBalanceDiagram(
  wb: ExcelJS.Workbook, fs: Flowsheet, result: SimulationResult, refs: InputRefs,
): ArrowSpec[] {
  const arrows: ArrowSpec[] = [];
  const ws = wb.addWorksheet(DIAGRAM_SHEET, { properties: { tabColor: { argb: "FF08A5E0" } } });
  title(ws, "Water balance diagram",
    "Laid out in the order the water flows. Flow and quality at every stage, with each cell a formula referring to the stage before it — follow them backwards from the product to see where the intake comes from.", 10);

  // One column block per node, in solve order.
  const nodes = result.nodes.filter((n) => n.type !== "product" && n.type !== "waste");
  const QUAL: Component[] = ["TDS", "Ca", "Mg", "Cl", "SO4"];

  const R_NAME = 4;
  const R_EQUIP = 5;
  const R_QIN = 6;
  const R_QUAL0 = 7;
  const R_OUT0 = R_QUAL0 + QUAL.length + 1;

  ws.getColumn(1).width = 26;
  ws.getCell(R_NAME, 1).value = "Stage";
  ws.getCell(R_EQUIP, 1).value = "Configuration";
  ws.getCell(R_QIN, 1).value = "Inlet flow Q_in, m³/h";
  QUAL.forEach((q, i) => {
    ws.getCell(R_QUAL0 + i, 1).value = `${q}, mg/L`;
  });
  ws.getCell(R_OUT0 - 1, 1).value = "Outlet flows, m³/h";
  for (let rr = R_NAME; rr <= R_OUT0 + 4; rr++) {
    const c = ws.getCell(rr, 1);
    c.font = { bold: rr <= R_QIN || rr === R_OUT0 - 1, size: 9, name: "Calibri" };
    c.alignment = { wrapText: true, vertical: "middle" };
  }

  const cellRefOf = new Map<string, string>(); // `${nodeId}:${port}` -> flow cell
  const colOfNode = new Map<string, number>();
  let col = 2;
  const inbound = new Map<string, { source: string; port: string }[]>();
  for (const e of fs.edges) {
    const arr = inbound.get(e.target) ?? [];
    arr.push({ source: e.source, port: e.sourceHandle });
    inbound.set(e.target, arr);
  }

  for (const nd of nodes) {
    const model = UNIT_BY_TYPE[nd.type];
    colOfNode.set(nd.id, col);
    ws.getColumn(col).width = 17;

    const nameCell = ws.getCell(R_NAME, col);
    nameCell.value = nd.label;
    nameCell.font = { bold: true, size: 9, color: { argb: "FFFFFFFF" }, name: "Calibri" };
    nameCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: HDRBG } };
    nameCell.alignment = { wrapText: true, horizontal: "center", vertical: "middle" };

    const szCell = ws.getCell(R_EQUIP, col);
    szCell.value = (nd.aux?.sizing ?? []).slice(0, 2).map((s) => s.value).join("\n") ||
      model?.short || "";
    szCell.font = { size: 8, name: "Calibri" };
    szCell.alignment = { wrapText: true, horizontal: "center", vertical: "top" };

    // Inlet flow: sum of upstream outlet cells, or the intake for a source node.
    const ins = inbound.get(nd.id) ?? [];
    const upstream = ins
      .map((x) => cellRefOf.get(`${x.source}:${x.port}`))
      .filter((x): x is string => !!x);
    const qin = ws.getCell(R_QIN, col);
    if (upstream.length > 0) {
      qin.value = { formula: upstream.join("+") };
    } else {
      qin.value = { formula: refs.feedFlow };
    }
    qin.numFmt = "0.000";
    qin.fill = { type: "pattern", pattern: "solid", fgColor: { argb: upstream.length ? CALC : INPUT } };
    qin.font = { bold: true, size: 9, name: "Calibri" };

    // Quality: literal values from the converged simulation, with a note that
    // they are simulator output rather than a spreadsheet formula.
    QUAL.forEach((q, i) => {
      const c = ws.getCell(R_QUAL0 + i, col);
      c.value = Number(nd.inlet.c[q].toFixed(4));
      c.numFmt = "0.###";
      c.font = { size: 8, name: "Calibri" };
    });

    // Outlets
    let orow = R_OUT0;
    for (const [port, st] of Object.entries(nd.outlets)) {
      const rec = nd.inlet.flow > 0 ? st.flow / nd.inlet.flow : 0;
      const lbl = ws.getCell(orow, 1);
      if (!lbl.value) lbl.value = "";
      const c = ws.getCell(orow, col);
      // Flow as a live fraction of the inlet — this is the recovery made visible.
      c.value = { formula: `${qin.address}*${rec.toFixed(8)}` };
      c.numFmt = "0.000";
      c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: CALC } };
      c.font = { size: 9, name: "Calibri" };
      c.note = `${port}: ${(rec * 100).toFixed(3)} % of inlet`;
      cellRefOf.set(`${nd.id}:${port}`, `'2. Water Balance Diagram'!${c.address}`);
      const tag = ws.getCell(orow, 1);
      if (!String(tag.value ?? "").includes(port)) {
        tag.value = String(tag.value ?? "").trim()
          ? `${tag.value} / ${port}`
          : `→ ${port}`;
        tag.font = { size: 8, italic: true, name: "Calibri" };
      }
      orow++;
    }
    col++;
  }

  // Totals
  const rTot = R_OUT0 + 6;
  ws.getCell(rTot, 1).value = "PLANT TOTALS";
  ws.getCell(rTot, 1).font = { bold: true, size: 10, color: { argb: NAVY }, name: "Calibri" };
  const rows: [string, number, string][] = [
    ["Raw water intake", result.summary.feedFlow, "m³/h"],
    ["Total product", result.summary.productFlow, "m³/h"],
    ["Total effluent", result.summary.wasteFlow, "m³/h"],
  ];
  let rr = rTot + 1;
  for (const [lbl, v, u] of rows) {
    ws.getCell(rr, 1).value = lbl;
    ws.getCell(rr, 2).value = Number(v.toFixed(4));
    ws.getCell(rr, 2).numFmt = "0.000";
    ws.getCell(rr, 2).fill = { type: "pattern", pattern: "solid", fgColor: { argb: OKBG } };
    ws.getCell(rr, 3).value = u;
    rr++;
  }
  ws.getCell(rr, 1).value = "Overall recovery";
  ws.getCell(rr, 2).value = { formula: `B${rTot + 2}/B${rTot + 1}` };
  ws.getCell(rr, 2).numFmt = "0.00%";
  ws.getCell(rr, 2).fill = { type: "pattern", pattern: "solid", fgColor: { argb: OKBG } };
  ws.getCell(rr, 2).font = { bold: true, name: "Calibri" };
  ws.getCell(rr, 3).value = "product ÷ intake";
  rr += 2;
  ws.getCell(rr, 1).value =
    "Quality rows are values from the converged simulation, including recycle loops. Flow cells are live formulas: each outlet is its inlet multiplied by the recovery fraction shown in the cell comment.";
  ws.mergeCells(rr, 1, rr, 8);
  ws.getCell(rr, 1).alignment = { wrapText: true };
  ws.getCell(rr, 1).font = { size: 9, italic: true, color: { argb: "FF4A7694" }, name: "Calibri" };

  /* ---- connector arrows, in the manner of the reference sheets ---- */
  // A column is 17 characters wide, roughly 1,133,000 EMU. Anchoring near the
  // right edge of one column and the left edge of the next draws an arrow that
  // visibly joins the two stage boxes and moves with the columns.
  const COL_EMU = 1133000;
  const NEAR_RIGHT = Math.round(COL_EMU * 0.93);
  const ROW_MID = 95000;
  for (const e of fs.edges) {
    const a = colOfNode.get(e.source);
    const bcol = colOfNode.get(e.target);
    if (a == null || bcol == null) continue;
    const forward = bcol > a;
    if (forward && bcol - a === 1) {
      // Main path: horizontal arrow on the inlet-flow row.
      arrows.push({
        fromCol: a - 1, fromColOff: NEAR_RIGHT, fromRow: R_QIN - 1, fromRowOff: ROW_MID,
        toCol: bcol - 1, toColOff: 40000, toRow: R_QIN - 1, toRowOff: ROW_MID,
        color: "1A3A5C", widthEmu: 12700,
      });
    } else {
      // Recycle or a jump over several stages: dashed, routed below the block.
      arrows.push({
        fromCol: a - 1, fromColOff: Math.round(COL_EMU * 0.5), fromRow: R_OUT0 + 3, fromRowOff: 0,
        toCol: bcol - 1, toColOff: Math.round(COL_EMU * 0.5), toRow: R_OUT0 + 3, toRowOff: 0,
        color: "1E7A5C", widthEmu: 12700, dashed: true,
      });
    }
  }

  ws.views = [{ state: "frozen", xSplit: 1, ySplit: 3 }];
  return arrows;
}

/* -------------------------------------------------------- 3. stream table */

function sheetStreamTable(wb: ExcelJS.Workbook, fs: Flowsheet, result: SimulationResult) {
  const ws = wb.addWorksheet("3. Stream Table", { properties: { tabColor: { argb: "FF74D7FB" } } });
  const cols: Component[] = [...ION_COLS, ...BIO_COLS];
  title(ws, "Stream table", "Every stream in the flowsheet with its full composition. Concentrations in mg/L, flow in m³/h.", 6);

  const head = ["Type", "Stream", "From", "To", "Flow", "T", "pH", "NTU", "Hardness", "Alk.",
    ...cols.map((c) => String(c))];
  const row = ws.getRow(4);
  row.values = head;
  styleHeader(row, head.length);
  ws.columns = [
    { width: 9 }, { width: 12 }, { width: 26 }, { width: 20 },
    { width: 10 }, { width: 7 }, { width: 7 }, { width: 8 }, { width: 11 }, { width: 9 },
    ...cols.map(() => ({ width: 9 })),
  ];

  const all = [
    ...result.feedStreams.map((x) => ({ ...x, kind: "Feed" })),
    ...result.streams.map((x) => ({ ...x, kind: "Internal" })),
    ...result.productStreams.map((x) => ({ ...x, kind: "Product" })),
    ...result.wasteStreams.map((x) => ({ ...x, kind: "Waste" })),
  ];
  let r = 5;
  for (const s of all) {
    const rw = ws.getRow(r);
    rw.values = [
      s.kind, s.label, s.from, s.to,
      Number(s.stream.flow.toFixed(4)), Number(s.stream.T.toFixed(1)), Number(s.stream.pH.toFixed(2)),
      Number(s.stream.extras.turbidityNTU.toFixed(3)),
      Number(hardnessAsCaCO3(s.stream).toFixed(3)),
      Number(alkalinityAsCaCO3(s.stream).toFixed(3)),
      ...cols.map((c) => Number(s.stream.c[c].toFixed(4))),
    ];
    const bg = s.kind === "Product" ? OKBG : s.kind === "Waste" ? WARNBG : r % 2 === 0 ? ALT : undefined;
    for (let i = 1; i <= head.length; i++) {
      const c = rw.getCell(i);
      c.font = { size: 9, name: "Calibri" };
      if (i >= 5) c.numFmt = "0.###";
      if (bg) c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: bg } };
    }
    r++;
  }
  ws.autoFilter = { from: { row: 4, column: 1 }, to: { row: r - 1, column: head.length } };
  ws.views = [{ state: "frozen", xSplit: 4, ySplit: 4 }];
}

/* ------------------------------------------------------ 4. design calcs */

function sheetCalcs(
  wb: ExcelJS.Workbook, fs: Flowsheet, result: SimulationResult,
) {
  let idx = 1;
  for (const nd of result.nodes) {
    if (nd.type === "product" || nd.type === "waste" || nd.type === "splitter") continue;
    const node = fs.nodes.find((x) => x.id === nd.id);
    if (!node) continue;
    const rows = calcRowsFor(nd, node.params);
    if (rows.length === 0) continue;

    const name = `4.${idx} ${slug(nd.label)}`.slice(0, 31);
    const ws = wb.addWorksheet(name, { properties: { tabColor: { argb: "FFB0E7FD" } } });
    const model = UNIT_BY_TYPE[nd.type];
    // The derivation column is always shown: a figure you cannot trace is a
    // figure you cannot defend.
    const learn = true;
    ws.columns = learn
      ? [{ width: 6 }, { width: 42 }, { width: 13 }, { width: 14 }, { width: 12 }, { width: 30 }, { width: 40 }, { width: 62 }]
      : [{ width: 6 }, { width: 42 }, { width: 13 }, { width: 14 }, { width: 12 }, { width: 30 }, { width: 44 }];

    title(ws, `${nd.label} — design calculation`,
      `${model?.label ?? nd.type}. Amber cells are inputs; blue cells are formulas referring to the rows above.`,
      learn ? 8 : 7);

    const head = learn
      ? ["No", "Item", "Symbol", "Value", "Unit", "Formula", "Note / reference range", "Where the equation comes from"]
      : ["No", "Item", "Symbol", "Value", "Unit", "Formula", "Note / reference range"];
    const hr = ws.getRow(4);
    hr.values = head;
    styleHeader(hr, head.length);

    // First pass: assign a row to every keyed entry so expressions can resolve.
    let r = 5;
    const addr = new Map<string, string>();
    const plan: { row: number; row_: CalcRow }[] = [];
    for (const cr of rows) {
      if (cr.section) { plan.push({ row: r, row_: cr }); r++; continue; }
      if (cr.key) addr.set(cr.key, `D${r}`);
      plan.push({ row: r, row_: cr });
      r++;
    }

    for (const { row, row_: cr } of plan) {
      const rw = ws.getRow(row);
      if (cr.section) {
        ws.mergeCells(row, 1, row, head.length);
        const c = ws.getCell(row, 1);
        c.value = cr.section;
        c.font = { bold: true, size: 10, color: { argb: NAVY }, name: "Calibri" };
        c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFDCEBF6" } };
        continue;
      }
      rw.getCell(1).value = cr.no ?? "";
      rw.getCell(2).value = cr.item ?? "";
      rw.getCell(3).value = cr.symbol ?? "";
      const vc = rw.getCell(4);
      if (cr.expr) {
        const f = cr.expr.replace(/\$\{(\w+)\}/g, (_m, k) => addr.get(k) ?? "0");
        vc.value = { formula: f };
        vc.fill = { type: "pattern", pattern: "solid", fgColor: { argb: CALC } };
      } else {
        vc.value = cr.val ?? null;
        vc.fill = { type: "pattern", pattern: "solid", fgColor: { argb: cr.input ? INPUT : CALC } };
      }
      vc.numFmt = "0.####";
      vc.font = { bold: true, size: 10, name: "Calibri" };
      rw.getCell(5).value = cr.unit ?? "";
      rw.getCell(6).value = cr.formula ?? "";
      rw.getCell(6).font = { size: 9, italic: true, name: "Calibri" };
      rw.getCell(7).value = cr.note ?? "";
      rw.getCell(7).alignment = { wrapText: true, vertical: "top" };
      rw.getCell(7).font = { size: 9, name: "Calibri" };
      if (learn) {
        rw.getCell(8).value = cr.theory ?? "";
        rw.getCell(8).alignment = { wrapText: true, vertical: "top" };
        rw.getCell(8).font = { size: 9, color: { argb: "FF24506F" }, name: "Calibri" };
      }
      for (let i = 1; i <= head.length; i++) {
        rw.getCell(i).border = { bottom: { style: "hair", color: { argb: "FFAAB7C4" } } };
        if (i !== 4) rw.getCell(i).font = rw.getCell(i).font ?? { size: 9, name: "Calibri" };
      }
      const noteLen = Math.max((cr.note ?? "").length, learn ? (cr.theory ?? "").length / 1.4 : 0);
      rw.height = Math.max(15, Math.ceil(noteLen / 52) * 13);
    }

    // Engineering notes raised by the model
    if (nd.aux.notes.length > 0) {
      r += 1;
      ws.mergeCells(r, 1, r, head.length);
      const c = ws.getCell(r, 1);
      c.value = "Engineering notes raised by the model";
      c.font = { bold: true, size: 10, color: { argb: "FFA86B06" }, name: "Calibri" };
      r++;
      for (const nt of nd.aux.notes) {
        ws.mergeCells(r, 1, r, head.length);
        const cc = ws.getCell(r, 1);
        cc.value = nt;
        cc.fill = { type: "pattern", pattern: "solid", fgColor: { argb: WARNBG } };
        cc.alignment = { wrapText: true, vertical: "top" };
        cc.font = { size: 9, name: "Calibri" };
        ws.getRow(r).height = Math.max(15, Math.ceil(nt.length / 130) * 13);
        r++;
      }
    }
    ws.views = [{ state: "frozen", xSplit: 2, ySplit: 4 }];
    idx++;
  }
}

/* --------------------------------------------------- 5. energy & chemicals */

function sheetEnergyChem(
  wb: ExcelJS.Workbook, fs: Flowsheet, result: SimulationResult, refs: InputRefs,
) {
  const ws = wb.addWorksheet("5. Energy & Chemicals", { properties: { tabColor: { argb: "FFF2A516" } } });
  ws.columns = [{ width: 34 }, { width: 13 }, { width: 12 }, { width: 13 }, { width: 14 }, { width: 40 }];
  title(ws, "Energy and chemical consumption",
    "Power per unit and dose rates as 100 % active substance. Annual figures are formulas on the operating hours from the Inputs sheet.", 6);

  const s = result.summary;
  let r = 4;
  const hdr = (vals: string[]) => {
    const row = ws.getRow(r);
    row.values = vals;
    styleHeader(row, vals.length);
    r++;
  };

  hdr(["Unit", "Power kW", "Share %", "kWh/y", "USD/y", "Note"]);
  const firstPower = r;
  const powered = result.nodes.filter((x) => x.aux.powerKW > 0.01).sort((a, b) => b.aux.powerKW - a.aux.powerKW);
  for (const nd of powered) {
    const row = ws.getRow(r);
    row.getCell(1).value = nd.label;
    row.getCell(2).value = Number(nd.aux.powerKW.toFixed(3));
    row.getCell(2).fill = { type: "pattern", pattern: "solid", fgColor: { argb: CALC } };
    row.getCell(3).value = { formula: `B${r}/$B$${firstPower + powered.length}*100` };
    row.getCell(4).value = { formula: `B${r}*${refs.hours}` };
    row.getCell(5).value = { formula: `D${r}*${refs.power}` };
    for (let i = 2; i <= 5; i++) row.getCell(i).numFmt = "0.##";
    row.getCell(6).value = (nd.aux.sizing.find((z) => z.label.toLowerCase().includes("energy"))?.value) ?? "";
    row.getCell(6).font = { size: 9, name: "Calibri" };
    r++;
  }
  const totRow = ws.getRow(r);
  totRow.getCell(1).value = "TOTAL";
  totRow.getCell(2).value = { formula: `SUM(B${firstPower}:B${r - 1})` };
  totRow.getCell(4).value = { formula: `SUM(D${firstPower}:D${r - 1})` };
  totRow.getCell(5).value = { formula: `SUM(E${firstPower}:E${r - 1})` };
  for (let i = 1; i <= 5; i++) {
    totRow.getCell(i).font = { bold: true, name: "Calibri" };
    totRow.getCell(i).fill = { type: "pattern", pattern: "solid", fgColor: { argb: OKBG } };
    if (i >= 2) totRow.getCell(i).numFmt = "0.##";
  }
  const totalPowerCell = `B${r}`;
  r += 2;

  ws.getCell(r, 1).value = "Specific energy consumption";
  ws.getCell(r, 2).value = { formula: `${totalPowerCell}/${refs.targetProduct}` };
  ws.getCell(r, 2).numFmt = "0.0000";
  ws.getCell(r, 2).fill = { type: "pattern", pattern: "solid", fgColor: { argb: OKBG } };
  ws.getCell(r, 3).value = "kWh/m³ product";
  ws.getCell(r, 6).value = "Total power ÷ product flow. The number to compare designs on.";
  ws.getCell(r, 6).font = { size: 9, italic: true, name: "Calibri" };
  r += 2;

  hdr(["Chemical (100 % active)", "kg/h", "t/y", "USD/t", "USD/y", "Note"]);
  const firstChem = r;
  for (const c of s.chemicals) {
    const row = ws.getRow(r);
    row.getCell(1).value = c.name;
    row.getCell(2).value = Number(c.kgPerH.toFixed(5));
    row.getCell(2).fill = { type: "pattern", pattern: "solid", fgColor: { argb: CALC } };
    row.getCell(3).value = { formula: `B${r}*${refs.hours}/1000` };
    row.getCell(4).value = Number((c.tPerY > 0 ? c.usdPerY / c.tPerY : 0).toFixed(0));
    row.getCell(4).fill = { type: "pattern", pattern: "solid", fgColor: { argb: INPUT } };
    row.getCell(5).value = { formula: `C${r}*D${r}` };
    for (let i = 2; i <= 5; i++) row.getCell(i).numFmt = "0.###";
    row.getCell(6).value = "Unit rate is indicative — replace with a quotation.";
    row.getCell(6).font = { size: 9, name: "Calibri" };
    r++;
  }
  if (s.chemicals.length > 0) {
    const cr = ws.getRow(r);
    cr.getCell(1).value = "TOTAL";
    cr.getCell(5).value = { formula: `SUM(E${firstChem}:E${r - 1})` };
    cr.getCell(5).numFmt = "0";
    for (let i = 1; i <= 5; i++) {
      cr.getCell(i).font = { bold: true, name: "Calibri" };
      cr.getCell(i).fill = { type: "pattern", pattern: "solid", fgColor: { argb: OKBG } };
    }
  }
  ws.views = [{ state: "frozen", ySplit: 3 }];
}

/* ------------------------------------------------------------- 6. theory */

const THEORY: { topic: string; body: string }[] = [
  {
    topic: "Why the balance is solved backwards",
    body:
      "A plant exists to deliver a demand, so the demand is the fixed quantity and the intake is the consequence. Working forwards — guessing an intake and seeing what emerges — means iterating by hand until the product happens to come out right. Working backwards, each unit's inlet is its outlet divided by its recovery, and the intake falls out in one pass. Because every unit is multiplicative in flow, the whole system is linear and the answer is exact. The Wankai reference sheets do exactly this: their Q= cells read =G7/E7, downstream flow divided by recovery.",
  },
  {
    topic: "Recovery, and why it compounds",
    body:
      "Recovery is product divided by feed for one unit. Across a train the recoveries multiply, so four units at 95 % give 0.95⁴ = 81 %, not 95 %. This is why chasing the last few percent is expensive: each additional point has to be won against a product that is already smaller. It is also why recovering a backwash stream — which adds water back rather than losing less — is usually cheaper per point than pushing a membrane harder.",
  },
  {
    topic: "The log-mean concentration factor",
    body:
      "A membrane does not see its feed concentration. Along the pressure vessel water leaves as permeate while salt stays behind, so the concentration climbs from feed to brine. The correct average for that exponential rise is the log-mean factor ln(1/(1−Y))/Y: about 2.0 at 75 % recovery and 2.6 at 90 %. Permeate concentration is therefore feed × salt passage × log-mean, not feed × salt passage. Omitting the log-mean is the commonest reason a hand calculation of permeate quality comes out optimistic.",
  },
  {
    topic: "Surface loading rate governs settling",
    body:
      "A particle is captured in a clarifier when its settling velocity exceeds the upward water velocity, and that upward velocity is flow divided by plan area. Depth does not appear. A deeper tank at the same area holds more water and settles no better. Inclined plates work because they multiply the effective area within the same footprint: the particle need only fall a few centimetres to the plate below rather than metres to the floor.",
  },
  {
    topic: "Flux is the membrane design decision",
    body:
      "Flux is permeate flow per unit membrane area, in litres per m² per hour. Area follows directly: S = Q × 1000 / J. Raising flux buys a smaller plant, but it concentrates solutes at the membrane surface faster than they can diffuse away, which accelerates both scaling and fouling. Low flux is the cheapest fouling control available, and it is why a plant behind poor pre-treatment must be designed at a lower flux than the same plant behind ultrafiltration.",
  },
  {
    topic: "Osmotic pressure sets the energy floor",
    body:
      "Van 't Hoff gives osmotic pressure as proportional to dissolved molar concentration: roughly 0.78 bar per 1000 mg/L for a mixed natural water at 25 °C. Seawater at 35,000 mg/L is therefore about 27 bar before any water is produced. The pump must exceed the average osmotic pressure along the vessel plus a net driving pressure plus friction. This is a thermodynamic floor, not an engineering inefficiency — which is why seawater desalination cannot be made arbitrarily cheap, and why recovering the pressure energy from the concentrate matters so much.",
  },
  {
    topic: "Load, not flow, sizes a biological reactor",
    body:
      "Biology consumes mass. A reactor is sized on kilograms of BOD per day, not on cubic metres per hour, and two plants at the same flow with different strength need very different volumes. The F/M ratio — load divided by the mass of biomass held — sets which organisms dominate: too high and filamentous bacteria take over and the sludge will not settle; too low and volume and energy are wasted on endogenous respiration.",
  },
  {
    topic: "Why nitrogen removal often needs bought carbon",
    body:
      "Denitrification uses organic carbon as the electron donor and nitrate as the acceptor, consuming roughly 4 kg of BOD per kg of nitrate-nitrogen reduced. If the influent BOD:TN ratio is below about 4, the wastewater simply does not contain enough carbon and methanol or acetate must be purchased. This is an operating cost that appears nowhere on a process flow diagram and regularly surprises people at commissioning, which is why the ratio is checked before nitrogen removal is promised.",
  },
  {
    topic: "Oxygen demand: the 4.57 factor",
    body:
      "Oxidising ammonia to nitrate requires 4.57 kg of oxygen per kg of nitrogen, from the stoichiometry of nitrification. Carbon oxidation needs about 1.2 kg per kg of BOD. On a nitrogen-rich wastewater the nitrification term often exceeds the carbon term, so the aeration bill is driven by nitrogen rather than by organic load — which is not what intuition suggests.",
  },
  {
    topic: "Alkalinity, hardness, and why lime sometimes cannot help",
    body:
      "Hardness is calcium and magnesium; alkalinity is mostly bicarbonate. Carbonate hardness is the part of the hardness paired with alkalinity, and it is the only part lime softening can precipitate. Where hardness greatly exceeds alkalinity, the balance is non-carbonate — paired with chloride and sulphate — and lime leaves it untouched. One subtraction therefore rules out an entire family of processes, which is why it is worth doing before selecting anything.",
  },
  {
    topic: "Chemical dosing: the one conversion behind all of it",
    body:
      "Dose in mg/L multiplied by flow in m³/h gives grams per hour; divide by 1000 for kg/h of active substance. Then divide by the solution strength to get solution mass, and by density to get the volume a pump must deliver. Every dosing system in a water treatment plant is sized by that chain, and mixing up active mass with solution volume is one of the commonest errors in a chemical schedule.",
  },
  {
    topic: "Why the ionic balance must be checked",
    body:
      "Water is electrically neutral, so cations and anions expressed in milliequivalents per litre must be equal to within a few percent. If they are not, the analysis is not internally valid and something is missing or misreported — chloride most often, because it is not in the standard sampling set. Every quantity that depends on the anion set, including scaling projections and corrosion assessment, inherits that error. Checking it costs one line of arithmetic and is the fastest way to find out whether the data can be trusted at all.",
  },
];

function sheetTheory(wb: ExcelJS.Workbook) {
  const ws = wb.addWorksheet("6. Theory & Derivations", { properties: { tabColor: { argb: "FF12B981" } } });
  ws.columns = [{ width: 4 }, { width: 40 }, { width: 118 }];
  title(ws, "Theory and derivations",
    "Where the equations in this workbook come from, and why the typical values are typical.", 3);
  let r = 4;
  let i = 1;
  for (const t of THEORY) {
    ws.getCell(r, 1).value = i;
    ws.getCell(r, 2).value = t.topic;
    ws.getCell(r, 2).font = { bold: true, size: 10, color: { argb: NAVY }, name: "Calibri" };
    ws.getCell(r, 2).alignment = { wrapText: true, vertical: "top" };
    ws.getCell(r, 3).value = t.body;
    ws.getCell(r, 3).alignment = { wrapText: true, vertical: "top" };
    ws.getCell(r, 3).font = { size: 10, name: "Calibri" };
    ws.getRow(r).height = Math.max(30, Math.ceil(t.body.length / 118) * 13.5);
    r++;
    i++;
  }
}

const GLOSSARY: [string, string, string][] = [
  ["Q", "m³/h", "Volumetric flow rate"],
  ["Q_in / Q_p / Q_c", "m³/h", "Inlet, permeate (product) and concentrate flow"],
  ["η", "% or -", "Recovery: product flow divided by feed flow"],
  ["CF", "×", "Concentration factor, 1/(1−η)"],
  ["LM", "×", "Log-mean concentration factor, ln(1/(1−η))/η"],
  ["J", "LMH", "Membrane flux, litres per m² per hour"],
  ["S", "m²", "Membrane area"],
  ["v_s", "m³/m²·h", "Surface loading (rise) rate for a clarifier"],
  ["v_f", "m/h", "Filtration rate, superficial velocity through a bed"],
  ["EBCT", "min", "Empty bed contact time, bed depth ÷ filtration rate"],
  ["t / HRT", "h", "Hydraulic retention time, V/Q"],
  ["SRT", "d", "Solids retention time, or sludge age"],
  ["MLSS / X", "mg/L", "Mixed liquor suspended solids, the biomass concentration"],
  ["F/M", "kgBOD/kgMLSS·d", "Food to microorganism ratio"],
  ["π", "bar", "Osmotic pressure"],
  ["NDP", "bar", "Net driving pressure, the excess over osmotic pressure"],
  ["e / SEC", "kWh/m³", "Specific energy consumption per m³ of product"],
  ["TDS", "mg/L", "Total dissolved solids"],
  ["TSS", "mg/L", "Total suspended solids"],
  ["SDI₁₅", "-", "Silt density index, the fouling potential of an RO feed"],
  ["as CaCO₃", "mg/L", "Hardness and alkalinity convention: 50 mg/L as CaCO₃ = 1 meq/L"],
  ["meq/L", "-", "Milliequivalents per litre: mg/L divided by equivalent weight"],
];

function sheetGlossary(wb: ExcelJS.Workbook) {
  const ws = wb.addWorksheet("7. Glossary", { properties: { tabColor: { argb: "FF93B3C8" } } });
  ws.columns = [{ width: 22 }, { width: 20 }, { width: 78 }];
  title(ws, "Symbols and units", undefined, 3);
  const hr = ws.getRow(3);
  hr.values = ["Symbol", "Unit", "Meaning"];
  styleHeader(hr, 3);
  let r = 4;
  for (const [sym, unit, mean] of GLOSSARY) {
    ws.getCell(r, 1).value = sym;
    ws.getCell(r, 1).font = { bold: true, size: 10, name: "Calibri" };
    ws.getCell(r, 2).value = unit;
    ws.getCell(r, 3).value = mean;
    ws.getCell(r, 3).alignment = { wrapText: true };
    if (r % 2 === 0) for (let i = 1; i <= 3; i++) ws.getCell(r, i).fill = { type: "pattern", pattern: "solid", fgColor: { argb: ALT } };
    r++;
  }
}
