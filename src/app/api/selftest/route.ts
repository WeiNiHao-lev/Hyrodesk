import { NextResponse } from "next/server";
import { FEED_PRESETS, TEMPLATES } from "@/lib/engine/templates";
import { feedStream, simulate, simulateForProduct } from "@/lib/engine/solver";
import { UNIT_BY_TYPE, UNIT_MODELS } from "@/lib/engine/units";
import { knowledgeFor } from "@/lib/engine/knowledge";
import { calcRowsFor } from "@/lib/report/calcsheets";
import { optimise, reliabilityScore, DEFAULT_GOALS } from "@/lib/engine/optimizer";
import { adviseProcess, validateFeed } from "@/lib/engine/diagnostics";
import { FeedSpec, Params, Stream } from "@/lib/engine/types";

/**
 * The raw water analysis from the South Sumatra methanol project, entered
 * exactly as the laboratory reported it. It contains three known defects, so it
 * makes a good regression fixture: the validator must find all three.
 */
const KNOWN_BAD_FEED: FeedSpec = {
  name: "South Sumatra river (2007 lab sheet, as reported)",
  flow: 215, T: 28, pH: 6.5,
  c: {
    Ca: 48.04, Mg: 11.07, NH4: 0.011, Fe: 0.014,
    HCO3: 22.7, CO3: 24.9, SO4: 5.8, NO3: 3.2,
    TDS: 12.1, TSS: 18.9, SiO2: 0.022, BOD: 3.1, COD: 7.3,
  },
  turbidityNTU: 0, coliform: 400, conductivityUScm: 169,
};

/**
 * Self-test endpoint. Runs every built-in template through the solver and
 * reports whether the balances close. Useful for a quick regression check
 * after touching the engine: GET /api/selftest
 */
export async function GET(req: Request) {
  const q = new URL(req.url).searchParams;

  // ?docx=learn returns the "Export for me" report itself, so the prose and the
  // worked calculations can be read rather than only counted.
  if (q.get("docx") === "learn") {
    const { buildLearnReport } = await import("@/lib/report/learnreport");
    const fsDemo = TEMPLATES.find((t) => t.key === "demin-ro-edi")!.make();
    const blob = await buildLearnReport(fsDemo, simulate(fsDemo), "Self test");
    return new NextResponse(await blob.arrayBuffer(), {
      headers: {
        "content-type":
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "content-disposition": `attachment; filename="selftest-learn.docx"`,
        "cache-control": "no-store",
      },
    });
  }

  // ?xlsx=1 returns the generated workbook itself, so the export can be opened
  // and checked rather than only counted.
  if (q.get("xlsx")) {
    const { buildWorkbook } = await import("@/lib/report/xlsx");
    // ?template= picks which flowsheet to render; the recycle-bearing ones are
    // the interesting cases for the injected diagram arrows.
    const key = q.get("template") ?? "demin-ro-edi";
    const tpl = TEMPLATES.find((t) => t.key === key);
    if (!tpl) {
      return NextResponse.json(
        { error: `unknown template '${key}'`, available: TEMPLATES.map((t) => t.key) },
        { status: 400 },
      );
    }
    const fsDemo = tpl.make();
    const blob = await buildWorkbook(fsDemo, simulate(fsDemo), "Self test");
    return new NextResponse(await blob.arrayBuffer(), {
      headers: {
        "content-type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "content-disposition": `attachment; filename="selftest-${key}.xlsx"`,
        "cache-control": "no-store",
      },
    });
  }
  return runChecks();
}

async function runChecks() {
  const out = TEMPLATES.filter((t) => t.key !== "blank").map((t) => {
    const fs = t.make();
    const r = simulate(fs);
    const s = r.summary;
    const opt = optimise(fs, DEFAULT_GOALS);
    return {
      template: t.key,
      name: t.name,
      converged: r.converged,
      iterations: r.iterations,
      residual: Number(r.residual.toExponential(2)),
      nodes: fs.nodes.length,
      edges: fs.edges.length,
      feed_m3h: round(s.feedFlow),
      product_m3h: round(s.productFlow),
      waste_m3h: round(s.wasteFlow),
      recovery_pct: round(s.recoveryPct),
      waterClosure_pct: round(s.waterBalance[0]?.errorPct ?? 0, 4),
      saltClosure: s.saltBalance.map((b) => ({
        c: b.label, in: round(b.inKgH, 3), out: round(b.outKgH, 3), err_pct: round(b.errorPct, 3),
      })),
      power_kW: round(s.totalPowerKW),
      sec_kWh_m3: round(s.secKWhPerM3, 4),
      chemicals: s.chemicals.map((c) => ({ name: c.name, kg_h: round(c.kgPerH, 4) })),
      drySolids_kg_h: round(s.drySolidsKgH, 3),
      capex_USD: Math.round(s.capexUSD),
      opex_USD_m3: round(s.opexUSDPerM3, 4),
      reliability: round(reliabilityScore(fs, r), 1),
      warnings: s.warnings,
      optimiser: {
        changes: opt.report.changes.length,
        recovery_before: round(opt.report.before.recoveryPct),
        recovery_after: round(opt.report.after.recoveryPct),
        reliability_after: round(opt.report.reliabilityScore, 1),
        notes: opt.report.notes,
      },
    };
  });

  const allClosed = out.every((o) => Math.abs(o.waterClosure_pct) < 0.5);
  const allConverged = out.every((o) => o.converged);

  /* --- diagnostics regression against a fixture with known defects --- */
  const findings = validateFeed(KNOWN_BAD_FEED);
  const titles = findings.map((f) => f.title);
  const mustCatch = [
    "Ionic balance error outside tolerance",
    "Chloride not analysed",
    "Entered TDS contradicts the sum of ions",
    "Carbonate reported below pH 8.3",
    "Silica implausibly low",
  ];
  const caught = mustCatch.filter((t) => titles.includes(t));
  const diagnosticsOk = caught.length === mustCatch.length;

  const advice = adviseProcess(FEED_PRESETS[1].spec, "demin");

  /* --- product-driven sizing: the intake must be solved, not guessed --- */
  const pdTests = TEMPLATES.filter((t) => t.key !== "blank").map((t) => {
    const fs = t.make();
    const target = 100; // ask every template for the same product flow
    const solved = simulateForProduct(fs, target);
    const fwd = simulate(fs);
    return {
      template: t.key,
      target_product: target,
      achieved_product: round(solved.achieved, 6),
      solved_intake: round(solved.feedFlow, 4),
      converged: solved.converged,
      error_pct: round(Math.abs(solved.achieved - target) / target * 100, 8),
      // Overall recovery must be identical either way: scaling a linear system
      // cannot change the ratio of product to feed.
      recovery_forward: round(fwd.summary.recoveryPct, 6),
      recovery_reverse: round(solved.result.summary.recoveryPct, 6),
      recovery_matches:
        Math.abs(fwd.summary.recoveryPct - solved.result.summary.recoveryPct) < 1e-6,
    };
  });
  const productDrivenOk = pdTests.every((t) => t.converged && t.recovery_matches);

  /* --- the advanced units, against the Bantargebang stage table --- */
  const leachate = checkLeachateTrain();

  /* --- a unit nobody can learn from or export is only half-added --- */
  const coverage = checkUnitCoverage();

  /* --- Excel export: assert the workbook is built from live formulas --- */
  let xlsx: Record<string, unknown> = { ok: false };
  try {
    const { buildWorkbook } = await import("@/lib/report/xlsx");
    const fsDemo = TEMPLATES.find((t) => t.key === "demin-ro-edi")!.make();
    const resDemo = simulate(fsDemo);
    const blob = await buildWorkbook(fsDemo, resDemo, "Self test");
    const buf = Buffer.from(await blob.arrayBuffer());
    // Count formula cells directly in the sheet XML: a workbook of dead numbers
    // would have none, which is precisely the failure we are guarding against.
    const { default: JSZip } = await import("jszip");
    const zip = await JSZip.loadAsync(buf);
    const sheetNames = Object.keys(zip.files).filter((f) => /^xl\/worksheets\/sheet\d+\.xml$/.test(f));
    let formulas = 0;
    for (const sn of sheetNames) {
      const xml = await zip.file(sn)!.async("string");
      formulas += (xml.match(/<f>/g) ?? []).length;
    }
    const wbXml = await zip.file("xl/workbook.xml")!.async("string");
    const sheetTitles = [...wbXml.matchAll(/name="([^"]+)"/g)].map((m) => m[1]);
    // The diagram arrows are injected as DrawingML after ExcelJS finishes, so
    // check the parts really landed: shapes, the sheet reference, and the
    // content-type override. Any one missing means Excel would repair the file.
    const drawings = Object.keys(zip.files).filter((f) => /^xl\/drawings\/drawing\d+\.xml$/.test(f));
    let connectors = 0;
    for (const dn of drawings) {
      connectors += ((await zip.file(dn)!.async("string")).match(/<xdr:cxnSp/g) ?? []).length;
    }
    const ctXml = await zip.file("[Content_Types].xml")!.async("string");
    let sheetRefsDrawing = 0;
    // CT_Worksheet is an ordered sequence: <drawing> must precede
    // <legacyDrawing> and the other trailing elements, or Excel offers to
    // repair the file. Assert the order rather than only the presence.
    const after = ["legacyDrawing", "legacyDrawingHF", "drawingHF", "picture",
      "oleObjects", "controls", "webPublishItems", "tableParts", "extLst"];
    let orderOk = true;
    for (const sn of sheetNames) {
      const xml2 = await zip.file(sn)!.async("string");
      const at = xml2.search(/<drawing r:id="rId\d+"\s*\/>/);
      if (at < 0) continue;
      sheetRefsDrawing++;
      for (const el of after) {
        const j = xml2.indexOf(`<${el}`);
        if (j >= 0 && j < at) orderOk = false;
      }
    }
    const drawingsDeclared = drawings.every((d) => ctXml.includes(`PartName="/${d}"`));
    xlsx = {
      ok: formulas > 100 && sheetNames.length >= 8
        && connectors > 0 && sheetRefsDrawing === drawings.length
        && drawingsDeclared && orderOk,
      worksheetElementOrderValid: orderOk,
      bytes: buf.length,
      sheets: sheetNames.length,
      sheetTitles,
      formulaCells: formulas,
      drawingParts: drawings.length,
      arrowShapes: connectors,
      sheetsReferencingDrawing: sheetRefsDrawing,
      drawingsDeclaredInContentTypes: drawingsDeclared,
    };
  } catch (e) {
    xlsx = { ok: false, error: (e as Error).message };
  }

  /* --- the diagram must survive on every template, recycles included --- */
  let diagrams: Record<string, unknown> = { ok: false };
  try {
    const { buildWorkbook } = await import("@/lib/report/xlsx");
    const { default: JSZip } = await import("jszip");
    const per: Record<string, {
      arrows: number; dashed: number; drawnEdges: number; edges: number; orderOk: boolean;
    }> = {};
    for (const t of TEMPLATES.filter((x) => x.key !== "blank")) {
      const f = t.make();
      // The diagram gives a column to every unit but not to the product and
      // waste terminals, so only edges between drawn units can carry an arrow.
      const drawn = new Set(
        f.nodes.filter((n) => n.type !== "product" && n.type !== "waste").map((n) => n.id),
      );
      const drawnEdges = f.edges.filter((e) => drawn.has(e.source) && drawn.has(e.target)).length;
      const blob = await buildWorkbook(f, simulate(f), t.name);
      const zip = await JSZip.loadAsync(Buffer.from(await blob.arrayBuffer()));
      let arrows = 0, dashed = 0;
      for (const dn of Object.keys(zip.files).filter((k) => /^xl\/drawings\/drawing\d+\.xml$/.test(k))) {
        const d = await zip.file(dn)!.async("string");
        arrows += (d.match(/<xdr:cxnSp/g) ?? []).length;
        dashed += (d.match(/prstDash val="dash"/g) ?? []).length;
      }
      let orderOk = true;
      for (const sn of Object.keys(zip.files).filter((k) => /^xl\/worksheets\/sheet\d+\.xml$/.test(k))) {
        const x = await zip.file(sn)!.async("string");
        const at = x.search(/<drawing r:id="rId\d+"\s*\/>/);
        if (at < 0) continue;
        for (const el of ["legacyDrawing", "picture", "tableParts", "extLst"]) {
          const j = x.indexOf(`<${el}`);
          if (j >= 0 && j < at) orderOk = false;
        }
      }
      per[t.key] = { arrows, dashed, drawnEdges, edges: f.edges.length, orderOk };
    }
    const vals = Object.values(per);
    diagrams = {
      // One arrow per edge, every package well ordered, and the dashed recycle
      // branch exercised by at least one template.
      ok: vals.every((v) => v.arrows === v.drawnEdges && v.orderOk)
        && vals.some((v) => v.dashed > 0),
      recycleBranchExercised: vals.some((v) => v.dashed > 0),
      perTemplate: per,
    };
  } catch (e) {
    diagrams = { ok: false, error: (e as Error).message };
  }

  /* --- "Export for me": the DOCX must be theory-led, not a table dump --- */
  let docx: Record<string, unknown> = { ok: false };
  try {
    const { buildLearnReport } = await import("@/lib/report/learnreport");
    const fsDemo = TEMPLATES.find((t) => t.key === "demin-ro-edi")!.make();
    const blob = await buildLearnReport(fsDemo, simulate(fsDemo), "Self test");
    const buf = Buffer.from(await blob.arrayBuffer());
    const { default: JSZip } = await import("jszip");
    const zip = await JSZip.loadAsync(buf);
    const xml = await zip.file("word/document.xml")!.async("string");
    // Recover the visible text so the checks are about content, not markup.
    const paras = [...xml.matchAll(/<w:p[ >][\s\S]*?<\/w:p>/g)].map((m) =>
      [...m[0].matchAll(/<w:t[^>]*>([\s\S]*?)<\/w:t>/g)]
        .map((t) => t[1]).join("")
        .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">"),
    );
    const text = paras.join("\n");
    const words = text.split(/\s+/).filter(Boolean).length;
    const tables = (xml.match(/<w:tbl>/g) ?? []).length;
    // Every per-process section must carry the ten explanatory subsections.
    const heads = paras.filter((p) => /^\d+\.\d+ /.test(p.trim()));
    const need = [
      "What this process is, physically",
      "Why it is in this plant",
      "When this process is the right choice",
      "When it is the wrong choice",
      "The parameters you must know, and why",
      "Design rules, and the reasoning behind them",
      "How the size was calculated",
      "Where those equations come from",
      "The resulting equipment",
      "What goes wrong in service, and how to prevent it",
    ];
    const covered = need.filter((n) => text.includes(n));
    // Each unit on the flowsheet must get the full set, not just the first one.
    const perProcess = need.map((n) => paras.filter((p) => p.trim().endsWith(n)).length);
    const processSections = Math.min(...perProcess);
    const uniformCoverage = new Set(perProcess).size === 1 && processSections > 0;
    // A worked calculation is only useful if the substituted line shows real
    // numbers, so require arithmetic-bearing "= value" lines.
    const substituted = paras.filter((p) => /=\s*-?\d+(\.\d+)?\s*(\S+)?$/.test(p.trim())
      && /[×*/+\-]|\d\s*\/\s*\d/.test(p)).length;
    docx = {
      ok: words > 6000 && tables >= 3 && covered.length === need.length
        && uniformCoverage && substituted >= 10,
      bytes: buf.length,
      words,
      paragraphs: paras.length,
      tables,
      numberedSubheadings: heads.length,
      subsectionsCovered: covered.length,
      subsectionsMissing: need.filter((n) => !text.includes(n)),
      processSections,
      uniformCoverage,
      substitutedFormulaLines: substituted,
      // Theory must dominate: prose words per table.
      wordsPerTable: tables ? Math.round(words / tables) : 0,
    };
  } catch (e) {
    docx = { ok: false, error: (e as Error).message };
  }

  return NextResponse.json(
    {
      ok: allClosed && allConverged && diagnosticsOk && productDrivenOk
        && xlsx.ok === true && docx.ok === true && diagrams.ok === true
        && leachate.ok && coverage.ok,
      allConverged, allClosed, diagnosticsOk, productDrivenOk,
      coverage, leachate, xlsx, docx, diagrams,
      productDriven: pdTests,
      diagnostics: {
        fixture: KNOWN_BAD_FEED.name,
        expected: mustCatch,
        caught,
        missed: mustCatch.filter((t) => !titles.includes(t)),
        bySeverity: findings.reduce<Record<string, number>>((a, f) => {
          a[f.severity] = (a[f.severity] ?? 0) + 1;
          return a;
        }, {}),
        allFindings: findings.map((f) => ({ severity: f.severity, title: f.title, detail: f.detail })),
      },
      advisor: {
        target: advice.target,
        steps: advice.train.map((t) => t.step),
        cautions: advice.cautions,
      },
      results: out,
    },
    { headers: { "cache-control": "no-store" } },
  );
}

/**
 * Every unit on the palette has to be learnable and exportable, not merely
 * solvable. A model with no knowledge entry cannot be clicked and studied, and
 * one with no calculation recipe falls back to a bare flow line in the Excel
 * and the report. Both are silent gaps, so they are asserted rather than
 * assumed.
 */
function checkUnitCoverage() {
  const skip = new Set(["splitter", "product", "waste", "pump"]);
  const rows = UNIT_MODELS.filter((m) => !skip.has(m.type)).map((m) => {
    const k = knowledgeFor(m.type);
    // Exercise the recipe on a plausible stream so a broken expression shows up
    // here rather than the first time the engineer presses export.
    const probe = feedStream({
      name: "probe", flow: 100, T: 30, pH: 7.5,
      c: {
        Na: 2000, K: 500, Ca: 200, Mg: 100, NH4: 800, Cl: 3000, SO4: 500,
        HCO3: 2000, NO3: 20, SiO2: 20, Fe: 2, Mn: 1,
        TDS: 9000, TSS: 300, COD: 2000, BOD: 400, TOC: 700, TN: 700, TP: 20, Oil: 30,
      },
    });
    const solved = m.solve(probe, m.defaults);
    const node = {
      id: "probe", type: m.type, label: m.label, params: m.defaults,
      inlet: probe, outlets: solved.outlets, aux: solved.aux,
    } as unknown as Parameters<typeof calcRowsFor>[0];
    let calcRows = 0;
    let calcError: string | null = null;
    try {
      calcRows = calcRowsFor(node, m.defaults).filter((x) => x.item).length;
    } catch (e) {
      calcError = (e as Error).message;
    }
    // A unit that consumes or creates water without saying so is a balance bug.
    const inFlow = probe.flow;
    const outFlow = Object.values(solved.outlets).reduce((a, s) => a + s.flow, 0);
    const closurePct = ((outFlow - inFlow) / inFlow) * 100;
    return {
      type: m.type,
      category: m.category,
      hasKnowledge: !!k,
      designRules: k?.designRules.length ?? 0,
      keyNumbers: k?.keyNumbers.length ?? 0,
      failureModes: k?.failureModes.length ?? 0,
      calcRows,
      calcError,
      waterClosure_pct: round(closurePct, 4),
      notes: solved.aux.notes.length,
    };
  });
  const missingKnowledge = rows.filter((x) => !x.hasKnowledge).map((x) => x.type);
  const noCalcRecipe = rows.filter((x) => x.calcRows < 5).map((x) => x.type);
  const calcErrors = rows.filter((x) => x.calcError).map((x) => `${x.type}: ${x.calcError}`);
  // Units that predate the calculation-recipe layer. They still solve and still
  // appear in the balance, but their sheet in the Excel and their section in the
  // report fall back to a bare flow line, so a reader cannot follow the sizing.
  // Listed rather than tolerated silently; anything newly added must not join it.
  const KNOWN_NO_RECIPE = new Set([
    "intake", "daf", "cartridge", "ceramicmf", "mixedbed", "softener", "degasser",
    "chemsoft", "msbr", "mbbr", "coke-ao", "denitrifilter", "disinfection", "crystalliser",
  ]);
  const missingCalcs = noCalcRecipe.filter((t) => !KNOWN_NO_RECIPE.has(t));
  // Evaporators and crystallisers legitimately remove water as vapour; the rest
  // must close on flow.
  const balanceExempt = new Set(["mvr", "crystalliser"]);
  const balanceBroken = rows
    .filter((x) => !balanceExempt.has(x.type) && Math.abs(x.waterClosure_pct) > 0.01)
    .map((x) => `${x.type}: ${x.waterClosure_pct} %`);
  return {
    ok: missingKnowledge.length === 0 && missingCalcs.length === 0
      && calcErrors.length === 0 && balanceBroken.length === 0,
    unitsChecked: rows.length,
    missingKnowledge, missingCalcs, calcErrors, balanceBroken,
    // Pre-existing gap, reported every run so it does not become invisible.
    knownGapsNoCalcRecipe: noCalcRecipe,
    perUnit: rows,
  };
}

/**
 * Runs the Bantargebang IPAS 2 train through the new advanced units and reports
 * each stage, so the models can be compared against the stage table in the
 * engineering analysis rather than trusted. The reference figures are that
 * analysis's own, and any disagreement is information — either the model is
 * wrong or the hand calculation was.
 */
function checkLeachateTrain() {
  const feed: FeedSpec = {
    name: "Bantargebang IPAS 2 leachate (field data, unverified)",
    flow: 50, // 1200 m3/d
    T: 30,
    pH: 8.6,
    c: {
      // NH4-N 5000 mg/L expressed as the ammonium ion.
      NH4: 5000 * (18.039 / 14.007),
      Na: 3000, K: 1500, Ca: 300, Mg: 200,
      Cl: 4500, SO4: 600, HCO3: 6000,
      COD: 11000, BOD: 350, TN: 5400, TSS: 1200, TDS: 18000,
      TOC: 3500, TP: 25, Oil: 20,
    },
  };

  const st = (label: string, s: Stream) => ({
    stage: label,
    flow: round(s.flow, 2),
    COD: round(s.c.COD),
    BOD: round(s.c.BOD, 1),
    TN: round(s.c.TN),
    TSS: round(s.c.TSS, 1),
    pH: round(s.pH, 1),
    NH4_N: round(s.c.NH4 * (14.007 / 18.039)),
  });

  const run = (type: string, inlet: Stream, over: Params = {}) => {
    const m = UNIT_BY_TYPE[type];
    return m.solve(inlet, { ...m.defaults, ...over });
  };

  const raw = feedStream(feed);
  const stages: ReturnType<typeof st>[] = [st("0. Raw leachate", raw)];
  const chem: Record<string, number> = {};
  let power = 0;
  const addAux = (a: { powerKW: number; chemicals: Record<string, number> }) => {
    power += a.powerKW;
    for (const [k, v] of Object.entries(a.chemicals)) chem[k] = (chem[k] ?? 0) + v;
  };

  const r1 = run("phadjust", raw, { targetPH: 11 });
  addAux(r1.aux);
  stages.push(st("1. Alkali dosing to pH 11", r1.outlets.out));

  const r2 = run("nh3strip", r1.outlets.out, { airRatio: 3000 });
  addAux(r2.aux);
  stages.push(st("2. Ammonia stripping", r2.outlets.out));

  const r3 = run("phadjust", r2.outlets.out, { targetPH: 7 });
  addAux(r3.aux);
  stages.push(st("3. Neutralisation to pH 7", r3.outlets.out));

  const r4 = run("mbr", r3.outlets.out, { codRemoval: 15, bodRemoval: 95, tnRemoval: 25 });
  addAux(r4.aux);
  stages.push(st("4. MBR", r4.outlets.out));

  const r5 = run("dtro", r4.outlets.out, { recovery: 85, stages: 2 });
  addAux(r5.aux);
  stages.push(st("5. DTRO permeate", r5.outlets.permeate));

  const r6 = run("aop", r5.outlets.permeate, { codRemoval: 60, bodIncrease: 0 });
  addAux(r6.aux);
  stages.push(st("6. AOP polishing", r6.outlets.out));

  // Reverse osmosis permeate is acidic: the carbon dioxide passes the membrane
  // and the alkalinity that would buffer it does not. Neither the membrane nor
  // the ozone puts it back, so a final trim is needed to hold pH 6-9. This is
  // the one place the model disagrees with the hand analysis, which assumed the
  // AOP would leave the water at pH 7.
  const r7 = run("phadjust", r6.outlets.out, { targetPH: 7, codCoPrecipPct: 0 });
  addAux(r7.aux);
  stages.push(st("7. Final pH trim", r7.outlets.out));

  // The reference stage table from the Bantargebang analysis.
  const reference = [
    { stage: "1. Alkali dosing to pH 11", COD: 10450, TN: 5400, pH: 11 },
    { stage: "2. Ammonia stripping", COD: 9900, TN: 1000, pH: 11 },
    { stage: "4. MBR", COD: 8400, TN: 750, pH: 7.2 },
    { stage: "5. DTRO permeate", COD: 126, TN: 23, pH: 6.8 },
    { stage: "6. AOP polishing", COD: 50, TN: 23, pH: 7 },
  ];
  const comparison = reference.map((ref) => {
    const got = stages.find((x) => x.stage === ref.stage)!;
    const dev = (a: number, b: number) => (b === 0 ? 0 : round(((a - b) / b) * 100, 1));
    return {
      stage: ref.stage,
      COD_model: got.COD, COD_ref: ref.COD, COD_dev_pct: dev(got.COD, ref.COD),
      TN_model: got.TN, TN_ref: ref.TN, TN_dev_pct: dev(got.TN, ref.TN),
    };
  });

  const final = stages[stages.length - 1];
  // Permen LHK P.59/2016 for landfill leachate.
  const compliance = {
    pH: { value: final.pH, limit: "6-9", pass: final.pH >= 6 && final.pH <= 9 },
    BOD: { value: final.BOD, limit: 150, pass: final.BOD <= 150 },
    COD: { value: final.COD, limit: 300, pass: final.COD <= 300 },
    TSS: { value: final.TSS, limit: 100, pass: final.TSS <= 100 },
    TN: { value: final.TN, limit: 60, pass: final.TN <= 60 },
  };

  return {
    // The models are calibrated, not fitted: 25 % is the deviation the analysis
    // itself declares for its engineering assumptions.
    ok: comparison.every((c) => Math.abs(c.COD_dev_pct) <= 25 && Math.abs(c.TN_dev_pct) <= 25)
      && Object.values(compliance).every((c) => c.pass),
    stages,
    comparison,
    compliance,
    totalPowerKW: round(power, 1),
    specificEnergy_kWh_m3: round(power / 50, 2),
    chemicals_t_per_day: Object.fromEntries(
      Object.entries(chem).map(([k, v]) => [k, round((v * 24) / 1000, 2)]),
    ),
    ammoniumSulphate_t_per_day: round(
      (Number(
        r2.aux.sizing.find((x) => x.label === "Ammonium sulphate produced")?.value.split(" ")[0] ?? 0,
      ) * 24) / 1000, 2),
    notes: [...r1.aux.notes, ...r2.aux.notes, ...r3.aux.notes, ...r4.aux.notes,
      ...r5.aux.notes, ...r6.aux.notes, ...r7.aux.notes],
  };
}

function round(v: number, dp = 2): number {
  if (!Number.isFinite(v)) return 0;
  const f = Math.pow(10, dp);
  return Math.round(v * f) / f;
}
