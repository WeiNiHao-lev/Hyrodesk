import {
  Balance, Component, Flowsheet, NodeResult, ResultSummary, SimulationResult,
  Stream, StreamRow, UnitAux,
} from "./types";
import { UNIT_BY_TYPE } from "./units";
import {
  blendStream, cloneStream, emptyStream, makeStream, mixStreams, streamResidual,
} from "./stream";
import { alkToBicarbonate, hardnessToCaMg } from "./feedprofiles";

const MAX_ITER = 300;
const TOL = 1e-5;

interface EdgeKey {
  id: string;
  source: string;
  sourceHandle: string;
  target: string;
}

/**
 * Order the nodes so that, ignoring recycle (back) edges, every node is visited
 * after its upstream neighbours. Cycles are handled by the outer fixed-point
 * iteration rather than by explicit tearing, which keeps the implementation
 * simple and robust for arbitrary user-drawn flowsheets.
 */
function computeOrder(nodeIds: string[], edges: EdgeKey[]): string[] {
  const out = new Map<string, string[]>();
  const indeg = new Map<string, number>();
  for (const id of nodeIds) {
    out.set(id, []);
    indeg.set(id, 0);
  }
  for (const e of edges) {
    if (!out.has(e.source) || !out.has(e.target)) continue;
    out.get(e.source)!.push(e.target);
    indeg.set(e.target, (indeg.get(e.target) ?? 0) + 1);
  }
  const queue = nodeIds.filter((id) => (indeg.get(id) ?? 0) === 0);
  const order: string[] = [];
  const seen = new Set<string>();
  while (queue.length) {
    const id = queue.shift()!;
    if (seen.has(id)) continue;
    seen.add(id);
    order.push(id);
    for (const t of out.get(id) ?? []) {
      indeg.set(t, (indeg.get(t) ?? 0) - 1);
      if ((indeg.get(t) ?? 0) <= 0 && !seen.has(t)) queue.push(t);
    }
  }
  // Any node still unseen sits on a cycle: append in a stable order.
  for (const id of nodeIds) if (!seen.has(id)) order.push(id);
  return order;
}

export function feedStream(f: Flowsheet["feed"]): Stream {
  const c = { ...f.c };
  // Indonesian laboratories normally report alkalinity as CaCO3 rather than as
  // bicarbonate, and hardness as CaCO3 rather than as calcium and magnesium.
  // Convert here so the balance always works from ions, whichever way it was entered.
  if (f.alkalinityAsCaCO3 != null && f.alkalinityAsCaCO3 > 0 && !c.HCO3) {
    c.HCO3 = alkToBicarbonate(f.alkalinityAsCaCO3);
  }
  if (f.hardnessAsCaCO3 != null && f.hardnessAsCaCO3 > 0 && !c.Mg) {
    const split = hardnessToCaMg(f.hardnessAsCaCO3, c.Ca);
    c.Ca = split.Ca;
    c.Mg = split.Mg;
  }
  return makeStream(f.flow, c, {
    T: f.T, pH: f.pH,
    turbidityNTU: f.turbidityNTU ?? 0,
    coliform: f.coliform ?? 0,
    sdi15: 6,
  });
}

/**
 * Product-driven design: scale the intake until the connected product outlets
 * deliver the requested flow.
 *
 * This is how design actually works — you know the demand and solve backwards
 * for the intake, rather than guessing an intake and seeing what comes out.
 *
 * Every unit model is multiplicative in flow (recovery fractions, split
 * fractions, backwash percentages), so overall product is linear in feed and a
 * single scaling step normally lands exactly. A short iteration is retained to
 * absorb any non-linearity a future model might introduce.
 */
export function simulateForProduct(
  fs: Flowsheet,
  targetProductFlow: number,
  maxIter = 6,
): { flowsheet: Flowsheet; result: SimulationResult; feedFlow: number; achieved: number; converged: boolean } {
  const target = Math.max(targetProductFlow, 1e-6);
  let feed = fs.feed.flow > 0 ? fs.feed.flow : target;
  let trial: Flowsheet = { ...fs, feed: { ...fs.feed, flow: feed } };
  let result = simulate(trial);

  for (let i = 0; i < maxIter; i++) {
    const achieved = result.summary.productFlow;
    if (achieved <= 1e-9) break; // no product outlet connected; nothing to scale toward
    if (Math.abs(achieved - target) / target < 1e-6) break;
    feed = feed * (target / achieved);
    trial = { ...fs, feed: { ...fs.feed, flow: feed } };
    result = simulate(trial);
  }

  const achieved = result.summary.productFlow;
  const converged = achieved > 0 && Math.abs(achieved - target) / target < 1e-4;
  if (achieved <= 1e-9) {
    result.messages.push(
      "Product-driven sizing could not run: no product outlet is connected, so there is nothing to size toward. Add a Product Outlet block and connect it.",
    );
  } else if (!converged) {
    result.messages.push(
      `Product-driven sizing reached ${achieved.toFixed(3)} m³/h against a target of ${target.toFixed(3)} m³/h.`,
    );
  }
  return { flowsheet: trial, result, feedFlow: feed, achieved, converged };
}

export function simulate(fs: Flowsheet): SimulationResult {
  const messages: string[] = [];
  const nodeIds = fs.nodes.map((nd) => nd.id);
  const nodeById = new Map(fs.nodes.map((nd) => [nd.id, nd]));
  const edges: EdgeKey[] = fs.edges.map((e) => ({
    id: e.id, source: e.source, sourceHandle: e.sourceHandle, target: e.target,
  }));

  if (nodeIds.length === 0) {
    return emptyResult(["The flowsheet is empty. Add at least one unit and connect it to a product outlet."]);
  }

  const order = computeOrder(nodeIds, edges);
  const inbound = new Map<string, EdgeKey[]>();
  const outbound = new Map<string, EdgeKey[]>();
  for (const id of nodeIds) {
    inbound.set(id, []);
    outbound.set(id, []);
  }
  for (const e of edges) {
    if (inbound.has(e.target)) inbound.get(e.target)!.push(e);
    if (outbound.has(e.source)) outbound.get(e.source)!.push(e);
  }

  // Nodes with no inbound edge take the plant feed.
  const sourceNodes = nodeIds.filter((id) => (inbound.get(id) ?? []).length === 0);
  if (sourceNodes.length === 0) {
    messages.push("Every unit has an inbound connection, so the feed has nowhere to enter. Leave one unit unconnected on its inlet.");
  }

  const edgeStream = new Map<string, Stream>();
  for (const e of edges) edgeStream.set(e.id, emptyStream());

  const feed = feedStream(fs.feed);
  const perSource = sourceNodes.length > 0 ? feed.flow / sourceNodes.length : 0;

  let iterations = 0;
  let residual = Number.POSITIVE_INFINITY;
  let converged = false;
  let nodeResults: NodeResult[] = [];

  for (let it = 0; it < MAX_ITER; it++) {
    iterations = it + 1;
    let maxRes = 0;
    const results: NodeResult[] = [];

    for (const id of order) {
      const nd = nodeById.get(id)!;
      const model = UNIT_BY_TYPE[nd.type];
      if (!model) continue;

      const ins = (inbound.get(id) ?? []).map((e) => edgeStream.get(e.id)!);
      if (sourceNodes.includes(id)) {
        const f = cloneStream(feed);
        f.flow = perSource;
        ins.push(f);
      }
      const inlet = mixStreams(ins);

      let solved;
      try {
        solved = model.solve(inlet, nd.params);
      } catch {
        solved = { outlets: {}, aux: { powerKW: 0, chemicals: {}, drySolidsKgH: 0, sizing: [], capexUSD: 0, notes: ["Model failed to evaluate."] } as UnitAux };
      }

      results.push({ id, type: nd.type, label: nd.label, inlet, outlets: solved.outlets, aux: solved.aux });

      for (const e of outbound.get(id) ?? []) {
        const next = solved.outlets[e.sourceHandle];
        if (!next) continue;
        const prev = edgeStream.get(e.id)!;
        maxRes = Math.max(maxRes, streamResidual(prev, next));
        // Damping stabilises recycle loops; a light touch keeps convergence fast.
        edgeStream.set(e.id, it === 0 ? cloneStream(next) : blendStream(prev, next, 0.7));
      }
    }

    nodeResults = results;
    residual = maxRes;
    if (maxRes < TOL) {
      converged = true;
      break;
    }
  }

  if (!converged) {
    messages.push(
      `Recycle loops did not fully converge after ${iterations} iterations (residual ${residual.toExponential(2)}). Results are indicative; check for an unstable recycle ratio.`,
    );
  }

  /* ------------------------------------------------------- stream table */
  const labelOf = (id: string) => nodeById.get(id)?.label ?? id;
  const streams: StreamRow[] = edges.map((e, i) => ({
    id: e.id,
    label: `S${i + 1}`,
    from: `${labelOf(e.source)} (${e.sourceHandle})`,
    to: labelOf(e.target),
    stream: edgeStream.get(e.id)!,
  }));

  const feedStreams: StreamRow[] = sourceNodes.map((id, i) => ({
    id: `feed-${id}`,
    label: `F${i + 1}`,
    from: fs.feed.name || "Raw water",
    to: labelOf(id),
    stream: (() => {
      const f = cloneStream(feed);
      f.flow = perSource;
      return f;
    })(),
  }));

  const productStreams: StreamRow[] = [];
  const wasteStreams: StreamRow[] = [];
  for (const r of nodeResults) {
    if (r.type !== "product" && r.type !== "waste") continue;
    const row: StreamRow = {
      id: `sink-${r.id}`,
      label: r.label,
      from: (inbound.get(r.id) ?? []).map((e) => labelOf(e.source)).join(", ") || "-",
      to: r.label,
      stream: r.inlet,
    };
    if (r.type === "product") productStreams.push(row);
    else wasteStreams.push(row);
  }

  const summary = buildSummary(fs, nodeResults, feedStreams, productStreams, wasteStreams, messages);

  return {
    ok: true, converged, iterations, residual, messages,
    nodes: nodeResults, streams, feedStreams, productStreams, wasteStreams, summary,
  };
}

function balanceOf(
  label: string, key: Component,
  feeds: StreamRow[], outs: StreamRow[],
): Balance {
  const inKgH = feeds.reduce((a, r) => a + (r.stream.flow * r.stream.c[key]) / 1000, 0);
  const outKgH = outs.reduce((a, r) => a + (r.stream.flow * r.stream.c[key]) / 1000, 0);
  const denom = Math.max(inKgH, outKgH, 1e-9);
  return { label, inKgH, outKgH, errorPct: ((inKgH - outKgH) / denom) * 100 };
}

function buildSummary(
  fs: Flowsheet,
  nodes: NodeResult[],
  feeds: StreamRow[],
  products: StreamRow[],
  wastes: StreamRow[],
  messages: string[],
): ResultSummary {
  const feedFlow = feeds.reduce((a, r) => a + r.stream.flow, 0);
  const productFlow = products.reduce((a, r) => a + r.stream.flow, 0);
  const wasteFlow = wastes.reduce((a, r) => a + r.stream.flow, 0);
  const recoveryPct = feedFlow > 0 ? (productFlow / feedFlow) * 100 : 0;

  const totalPowerKW = nodes.reduce((a, r) => a + (r.aux.powerKW || 0), 0);
  const secKWhPerM3 = productFlow > 0 ? totalPowerKW / productFlow : 0;

  const chemMap = new Map<string, number>();
  for (const r of nodes) {
    for (const [k, v] of Object.entries(r.aux.chemicals || {})) {
      if (!v || v <= 0) continue;
      chemMap.set(k, (chemMap.get(k) ?? 0) + v);
    }
  }
  const hours = fs.basis.operatingHoursPerYear || 8000;
  const chemPrices: Record<string, number> = {
    "Poly-aluminium chloride": 350, "Polymer flocculant": 3500,
    "Caustic soda (pH correction)": 600, "Caustic soda (softening)": 600,
    "Caustic soda (regeneration)": 600, "Sodium hypochlorite (as Cl2)": 500,
    "Sodium hypochlorite (UF CEB)": 500, "Hydrochloric acid (UF CEB)": 300,
    "Hydrochloric acid (regeneration)": 300, "Sodium metabisulphite": 900,
    Antiscalant: 4500, "Sodium carbonate": 420, "Sodium chloride (regeneration)": 110,
    "Methanol (external carbon)": 480, "External carbon source": 480,
    "Polymer (dewatering)": 3500,
  };
  const chemicals = [...chemMap.entries()]
    .map(([name, kgPerH]) => {
      const tPerY = (kgPerH * hours) / 1000;
      return { name, kgPerH, tPerY, usdPerY: tPerY * (chemPrices[name] ?? 800) };
    })
    .sort((a, b) => b.usdPerY - a.usdPerY);

  const drySolidsKgH = nodes.reduce((a, r) => a + (r.aux.drySolidsKgH || 0), 0);
  const capexUSD = nodes.reduce((a, r) => a + (r.aux.capexUSD || 0), 0);
  const hrtTotalH = nodes.reduce((a, r) => a + (r.aux.hrtH || 0), 0);

  const allOut = [...products, ...wastes];
  const waterBalance: Balance[] = [
    {
      label: "Water (volumetric)",
      inKgH: feedFlow, outKgH: productFlow + wasteFlow,
      errorPct: feedFlow > 0 ? ((feedFlow - productFlow - wasteFlow) / feedFlow) * 100 : 0,
    },
  ];
  const saltKeys: Component[] = ["TDS", "Na", "Ca", "Mg", "Cl", "SO4"];
  const saltBalance = saltKeys.map((k) => balanceOf(k, k, feeds, allOut));
  const bioKeys: Component[] = ["BOD", "COD", "TN", "TP", "TSS"];
  const biologicalBalance = bioKeys.map((k) => balanceOf(k, k, feeds, allOut));

  const powerCost = totalPowerKW * hours * (fs.basis.electricityUSDPerKWh || 0.09);
  const chemCost = chemicals.reduce((a, c) => a + c.usdPerY, 0);
  // Membrane / media replacement and labour taken as a fraction of capital,
  // which is the usual placeholder at this stage of design.
  const replacementCost = capexUSD * 0.04;
  const labour = 40000;
  const opexUSDPerY = powerCost + chemCost + replacementCost + labour;
  const productM3PerY = productFlow * hours;
  const opexUSDPerM3 = productM3PerY > 0 ? opexUSDPerY / productM3PerY : 0;

  // Solver-level messages (non-convergence, unconnected feed) belong with the
  // engineering notes: they are exactly the things the reader must not miss.
  const warnings: string[] = [...messages];
  for (const r of nodes) for (const nt of r.aux.notes || []) warnings.push(`${r.label}: ${nt}`);
  if (products.length === 0) warnings.push("No product outlet is connected, so recovery cannot be computed. Add a Product Outlet block.");
  if (wastes.length === 0 && products.length > 0) warnings.push("No waste outlet is connected. Reject and backwash streams are unaccounted for and the balance will not close.");
  const wb = waterBalance[0];
  if (Math.abs(wb.errorPct) > 0.5) {
    warnings.push(`Water balance does not close (${wb.errorPct.toFixed(2)} %). Some stream is not routed to a product or waste outlet.`);
  }

  return {
    feedFlow, productFlow, wasteFlow, recoveryPct, totalPowerKW, secKWhPerM3,
    chemicals, drySolidsKgH, waterBalance, saltBalance, biologicalBalance,
    capexUSD, opexUSDPerY, opexUSDPerM3, hrtTotalH, warnings,
  };
}

function emptyResult(messages: string[]): SimulationResult {
  return {
    ok: false, converged: false, iterations: 0, residual: 0, messages,
    nodes: [], streams: [], feedStreams: [], productStreams: [], wasteStreams: [],
    summary: {
      feedFlow: 0, productFlow: 0, wasteFlow: 0, recoveryPct: 0,
      totalPowerKW: 0, secKWhPerM3: 0, chemicals: [], drySolidsKgH: 0,
      waterBalance: [], saltBalance: [], biologicalBalance: [],
      capexUSD: 0, opexUSDPerY: 0, opexUSDPerM3: 0, hrtTotalH: 0,
      warnings: messages,
    },
  };
}
