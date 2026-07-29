"use client";

import { useMemo, useState } from "react";
import { Flowsheet, SimulationResult, Component } from "@/lib/engine/types";
import { alkalinityAsCaCO3, hardnessAsCaCO3, tdsFromIons } from "@/lib/engine/stream";
import { downloadText, downloadBlob } from "@/lib/store/db";
import { buildReport } from "@/lib/report/docx";
import { checkCompliance, STANDARD_LIMITS } from "@/lib/engine/diagnostics";
import { STANDARDS } from "@/lib/engine/templates";
import { sweep, sweepCandidates, SweepResult } from "@/lib/engine/sensitivity";
import {
  Droplets, Zap, FlaskConical, Recycle, AlertTriangle, Download, FileText, Sigma, Boxes,
  CheckCircle2, XCircle, TrendingUp,
} from "lucide-react";

const ION_COLS: Component[] = ["TDS", "Na", "Ca", "Mg", "Cl", "SO4", "HCO3", "SiO2"];
const BIO_COLS: Component[] = ["TSS", "BOD", "COD", "TOC", "TN", "TP", "NH4"];

type Tab = "overview" | "streams" | "salt" | "bio" | "energy" | "equipment" | "compliance" | "sensitivity";

export function ResultsView({
  flowsheet, result, studyName,
}: { flowsheet: Flowsheet; result: SimulationResult; studyName: string }) {
  const [tab, setTab] = useState<Tab>("overview");
  const s = result.summary;

  const exportCsv = () => {
    const cols: Component[] = [...ION_COLS, ...BIO_COLS];
    const head = ["Stream", "From", "To", "Flow m3/h", "T C", "pH", "Turbidity NTU", ...cols.map((c) => `${c} mg/L`)];
    const rows = [
      ...result.feedStreams.map((r) => ["FEED " + r.label, r.from, r.to, r, ] as const),
      ...result.streams.map((r) => [r.label, r.from, r.to, r] as const),
      ...result.productStreams.map((r) => ["PRODUCT " + r.label, r.from, r.to, r] as const),
      ...result.wasteStreams.map((r) => ["WASTE " + r.label, r.from, r.to, r] as const),
    ].map(([label, from, to, r]) => [
      label, from, to,
      r.stream.flow.toFixed(3), r.stream.T.toFixed(1), r.stream.pH.toFixed(2),
      r.stream.extras.turbidityNTU.toFixed(3),
      ...cols.map((c) => r.stream.c[c].toFixed(4)),
    ]);
    const csv = [head, ...rows]
      .map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    downloadText(`${slug(studyName)}-streams.csv`, csv, "text/csv");
  };

  const exportDocx = async () => {
    const blob = await buildReport(flowsheet, result, studyName);
    downloadBlob(`${slug(studyName)}-pre-approval-report.docx`, blob);
  };

  return (
    <div className="flex flex-col gap-4">
      {/* KPI strip */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <Kpi icon={Droplets} label="Feed" value={s.feedFlow.toFixed(1)} unit="m³/h" tone="aqua" />
        <Kpi icon={Droplets} label="Product" value={s.productFlow.toFixed(1)} unit="m³/h" tone="aqua" />
        <Kpi icon={Recycle} label="Recovery" value={s.recoveryPct.toFixed(2)} unit="%"
          tone={s.recoveryPct >= 90 ? "mint" : s.recoveryPct >= 75 ? "sun" : "coral"} />
        <Kpi icon={Zap} label="Specific energy" value={s.secKWhPerM3.toFixed(3)} unit="kWh/m³" tone="sun" />
        <Kpi icon={FlaskConical} label="Chemicals" value={s.chemicals.length.toString()} unit="dosed" tone="violet" />
        <Kpi icon={Sigma} label="Effluent" value={s.wasteFlow.toFixed(1)} unit="m³/h" tone="ink" />
      </div>

      {/* actions */}
      <div className="flex flex-wrap items-center gap-2">
        <button className="btn btn-primary" onClick={exportDocx}>
          <FileText className="h-3.5 w-3.5" /> Pre-approval report (.docx)
        </button>
        <button className="btn btn-ghost" onClick={exportCsv}>
          <Download className="h-3.5 w-3.5" /> Stream table (.csv)
        </button>
        <div className="ml-auto flex items-center gap-2 text-[0.7rem] text-ink-500">
          <span className={`chip ${result.converged ? "bg-mint-100 text-mint-700" : "bg-sun-100 text-sun-700"}`}>
            {result.converged ? "Converged" : "Not converged"} · {result.iterations} iterations
          </span>
        </div>
      </div>

      {s.warnings.length > 0 && (
        <div className="card p-4">
          <div className="mb-2 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-sun-500" />
            <h3 className="text-[0.85rem] font-bold text-ink-900">
              Engineering notes ({s.warnings.length})
            </h3>
          </div>
          <ul className="space-y-1.5">
            {s.warnings.map((w, i) => (
              <li key={i} className="rounded-lg bg-sun-100/70 px-3 py-2 text-[0.74rem] leading-snug text-sun-700">
                {w}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* tabs */}
      <div className="card overflow-hidden">
        <div className="flex overflow-x-auto border-b border-ink-900/8">
          {(
            [
              ["overview", "Water balance"],
              ["compliance", "Compliance"],
              ["streams", "Stream table"],
              ["salt", "Salt / ion balance"],
              ["bio", "Biological balance"],
              ["energy", "Energy & chemicals"],
              ["equipment", "Equipment & sizing"],
              ["sensitivity", "Sensitivity"],
            ] as [Tab, string][]
          ).map(([k, lbl]) => (
            <button
              key={k}
              onClick={() => setTab(k)}
              className={`shrink-0 px-4 py-2.5 text-[0.78rem] font-semibold transition ${
                tab === k ? "border-b-2 border-aqua-500 text-aqua-700" : "text-ink-500 hover:text-ink-900"
              }`}
            >
              {lbl}
            </button>
          ))}
        </div>

        <div className="max-h-[560px] overflow-auto p-4">
          {tab === "overview" && <Overview result={result} />}
          {tab === "compliance" && <Compliance result={result} flowsheet={flowsheet} />}
          {tab === "sensitivity" && <Sensitivity flowsheet={flowsheet} />}
          {tab === "streams" && <StreamTable result={result} />}
          {tab === "salt" && <BalanceTable rows={s.saltBalance} title="Dissolved salt load" unit="kg/h" />}
          {tab === "bio" && <BalanceTable rows={s.biologicalBalance} title="Organic and nutrient load" unit="kg/h" />}
          {tab === "energy" && <Energy result={result} flowsheet={flowsheet} />}
          {tab === "equipment" && <Equipment result={result} />}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ panels */

function Overview({ result }: { result: SimulationResult }) {
  const s = result.summary;
  const rows = [
    ...result.feedStreams.map((r) => ({ k: "Feed", label: r.to, flow: r.stream.flow, tone: "aqua" })),
    ...result.productStreams.map((r) => ({ k: "Product", label: r.label, flow: r.stream.flow, tone: "mint" })),
    ...result.wasteStreams.map((r) => ({ k: "Waste", label: r.label, flow: r.stream.flow, tone: "coral" })),
  ];
  const max = Math.max(...rows.map((r) => r.flow), 1);
  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        {rows.map((r, i) => (
          <div key={i} className="flex items-center gap-3">
            <span className="w-16 shrink-0 text-[0.62rem] font-bold uppercase tracking-wider text-ink-300">
              {r.k}
            </span>
            <span className="w-44 shrink-0 truncate text-[0.76rem] font-semibold text-ink-900">
              {r.label}
            </span>
            <div className="h-4 flex-1 overflow-hidden rounded-full bg-ink-900/5">
              <div
                className={`h-full rounded-full ${
                  r.tone === "mint" ? "bg-mint-500" : r.tone === "coral" ? "bg-coral-500" : "bg-aqua-500"
                }`}
                style={{ width: `${(r.flow / max) * 100}%` }}
              />
            </div>
            <span className="stat w-24 shrink-0 text-right text-[0.78rem] font-bold text-ink-900">
              {r.flow.toFixed(2)}
            </span>
            <span className="w-12 shrink-0 text-[0.62rem] text-ink-500">m³/h</span>
          </div>
        ))}
      </div>

      <table className="data">
        <thead>
          <tr>
            <th>Balance</th>
            <th className="num">In</th>
            <th className="num">Out</th>
            <th className="num">Closure error</th>
          </tr>
        </thead>
        <tbody>
          {s.waterBalance.map((b) => (
            <tr key={b.label}>
              <td className="font-semibold">{b.label}</td>
              <td className="num">{b.inKgH.toFixed(3)} m³/h</td>
              <td className="num">{b.outKgH.toFixed(3)} m³/h</td>
              <td className={`num font-semibold ${Math.abs(b.errorPct) < 0.5 ? "text-mint-700" : "text-coral-700"}`}>
                {b.errorPct >= 0 ? "+" : ""}{b.errorPct.toFixed(3)} %
              </td>
            </tr>
          ))}
          <tr>
            <td className="font-semibold">Overall recovery</td>
            <td className="num" colSpan={2}>
              {s.productFlow.toFixed(2)} / {s.feedFlow.toFixed(2)} m³/h
            </td>
            <td className="num font-bold text-aqua-700">{s.recoveryPct.toFixed(2)} %</td>
          </tr>
          <tr>
            <td className="font-semibold">Total hydraulic retention</td>
            <td className="num" colSpan={2}>sum of tank and reactor HRT</td>
            <td className="num font-semibold">{s.hrtTotalH.toFixed(2)} h</td>
          </tr>
          <tr>
            <td className="font-semibold">Dry solids produced</td>
            <td className="num" colSpan={2}>clarifier, biological and softening</td>
            <td className="num font-semibold">{s.drySolidsKgH.toFixed(2)} kg/h</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

function StreamTable({ result }: { result: SimulationResult }) {
  const all = [
    ...result.feedStreams.map((r) => ({ ...r, kind: "Feed" })),
    ...result.streams.map((r) => ({ ...r, kind: "Internal" })),
    ...result.productStreams.map((r) => ({ ...r, kind: "Product" })),
    ...result.wasteStreams.map((r) => ({ ...r, kind: "Waste" })),
  ];
  return (
    <div className="overflow-x-auto">
      <table className="data">
        <thead>
          <tr>
            <th>Type</th><th>Stream</th><th>From</th><th>To</th>
            <th className="num">Flow</th><th className="num">pH</th><th className="num">NTU</th>
            {ION_COLS.map((c) => <th key={c} className="num">{c}</th>)}
            <th className="num">Hardness</th><th className="num">Alk.</th>
          </tr>
        </thead>
        <tbody>
          {all.map((r) => (
            <tr key={r.id}>
              <td>
                <span className={`chip ${
                  r.kind === "Product" ? "bg-mint-100 text-mint-700"
                  : r.kind === "Waste" ? "bg-coral-100 text-coral-700"
                  : r.kind === "Feed" ? "bg-aqua-100 text-aqua-700"
                  : "bg-ink-900/5 text-ink-500"}`}>{r.kind}</span>
              </td>
              <td className="font-semibold">{r.label}</td>
              <td className="text-ink-500">{r.from}</td>
              <td className="text-ink-500">{r.to}</td>
              <td className="num font-semibold">{r.stream.flow.toFixed(2)}</td>
              <td className="num">{r.stream.pH.toFixed(2)}</td>
              <td className="num">{r.stream.extras.turbidityNTU.toFixed(2)}</td>
              {ION_COLS.map((c) => (
                <td key={c} className="num">{fmt(r.stream.c[c])}</td>
              ))}
              <td className="num">{fmt(hardnessAsCaCO3(r.stream))}</td>
              <td className="num">{fmt(alkalinityAsCaCO3(r.stream))}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-2 text-[0.66rem] text-ink-500">
        Concentrations in mg/L. Hardness and alkalinity as mg/L CaCO₃. Flow in m³/h.
      </p>
    </div>
  );
}

function BalanceTable({
  rows, title, unit,
}: { rows: { label: string; inKgH: number; outKgH: number; errorPct: number }[]; title: string; unit: string }) {
  return (
    <div>
      <h3 className="mb-2 text-[0.85rem] font-bold text-ink-900">{title}</h3>
      <table className="data">
        <thead>
          <tr>
            <th>Component</th>
            <th className="num">In ({unit})</th>
            <th className="num">Out ({unit})</th>
            <th className="num">Removed / accumulated</th>
            <th className="num">Closure</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((b) => (
            <tr key={b.label}>
              <td className="font-semibold">{b.label}</td>
              <td className="num">{b.inKgH.toFixed(3)}</td>
              <td className="num">{b.outKgH.toFixed(3)}</td>
              <td className="num">{(b.inKgH - b.outKgH).toFixed(3)}</td>
              <td className={`num font-semibold ${Math.abs(b.errorPct) < 1 ? "text-mint-700" : "text-sun-700"}`}>
                {b.errorPct >= 0 ? "+" : ""}{b.errorPct.toFixed(2)} %
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-2 text-[0.66rem] leading-snug text-ink-500">
        A non-zero closure means load is leaving the flowsheet somewhere other than a product or waste
        outlet — usually a stream left unconnected, or a component genuinely destroyed by a biological
        or precipitation step, which is expected for BOD, COD and nutrients.
      </p>
    </div>
  );
}

function Energy({ result, flowsheet }: { result: SimulationResult; flowsheet: Flowsheet }) {
  const s = result.summary;
  const powered = result.nodes.filter((n) => n.aux.powerKW > 0.01).sort((a, b) => b.aux.powerKW - a.aux.powerKW);
  const maxKW = Math.max(...powered.map((n) => n.aux.powerKW), 1);
  const hours = flowsheet.basis.operatingHoursPerYear;
  return (
    <div className="space-y-5">
      <div>
        <h3 className="mb-2 text-[0.85rem] font-bold text-ink-900">
          Power demand — {s.totalPowerKW.toFixed(1)} kW · {s.secKWhPerM3.toFixed(3)} kWh/m³ of product
        </h3>
        <div className="space-y-1">
          {powered.map((nd) => (
            <div key={nd.id} className="flex items-center gap-3">
              <span className="w-44 shrink-0 truncate text-[0.75rem] font-medium text-ink-900">{nd.label}</span>
              <div className="h-3.5 flex-1 overflow-hidden rounded-full bg-ink-900/5">
                <div className="h-full rounded-full bg-gradient-to-r from-sun-500 to-coral-500"
                  style={{ width: `${(nd.aux.powerKW / maxKW) * 100}%` }} />
              </div>
              <span className="stat w-20 shrink-0 text-right text-[0.76rem] font-bold">
                {nd.aux.powerKW.toFixed(2)}
              </span>
              <span className="w-8 shrink-0 text-[0.62rem] text-ink-500">kW</span>
              <span className="w-12 shrink-0 text-right text-[0.66rem] text-ink-500">
                {((nd.aux.powerKW / Math.max(s.totalPowerKW, 0.001)) * 100).toFixed(0)}%
              </span>
            </div>
          ))}
        </div>
      </div>

      <div>
        <h3 className="mb-2 text-[0.85rem] font-bold text-ink-900">Chemical balance</h3>
        <table className="data">
          <thead>
            <tr>
              <th>Chemical (100 % active)</th>
              <th className="num">kg/h</th>
              <th className="num">t/y</th>
              <th className="num">USD/y</th>
            </tr>
          </thead>
          <tbody>
            {s.chemicals.map((c) => (
              <tr key={c.name}>
                <td className="font-semibold">{c.name}</td>
                <td className="num">{c.kgPerH.toFixed(3)}</td>
                <td className="num">{c.tPerY.toFixed(2)}</td>
                <td className="num">{Math.round(c.usdPerY).toLocaleString()}</td>
              </tr>
            ))}
            {s.chemicals.length === 0 && (
              <tr><td colSpan={4} className="text-center text-ink-300">No chemical dosing configured.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <div>
        <h3 className="mb-2 text-[0.85rem] font-bold text-ink-900">Indicative cost</h3>
        <table className="data">
          <thead>
            <tr><th>Item</th><th className="num">Value</th><th>Basis</th></tr>
          </thead>
          <tbody>
            <tr>
              <td>Power cost</td>
              <td className="num">{Math.round(s.totalPowerKW * hours * flowsheet.basis.electricityUSDPerKWh).toLocaleString()} USD/y</td>
              <td className="text-ink-500">{hours} h/y at {flowsheet.basis.electricityUSDPerKWh} USD/kWh</td>
            </tr>
            <tr>
              <td>Chemical cost</td>
              <td className="num">{Math.round(s.chemicals.reduce((a, c) => a + c.usdPerY, 0)).toLocaleString()} USD/y</td>
              <td className="text-ink-500">indicative unit rates</td>
            </tr>
            <tr>
              <td>Installed equipment (order of magnitude)</td>
              <td className="num">{Math.round(s.capexUSD).toLocaleString()} USD</td>
              <td className="text-ink-500">capacity cost curves — NOT a quotation</td>
            </tr>
            <tr>
              <td className="font-semibold">Total indicative OPEX</td>
              <td className="num font-bold">{Math.round(s.opexUSDPerY).toLocaleString()} USD/y</td>
              <td className="text-ink-500">incl. replacement allowance and labour</td>
            </tr>
            <tr>
              <td className="font-semibold">Specific OPEX</td>
              <td className="num font-bold">{s.opexUSDPerM3.toFixed(3)} USD/m³</td>
              <td className="text-ink-500">per m³ of product water</td>
            </tr>
          </tbody>
        </table>
        <p className="mt-2 text-[0.66rem] leading-snug text-ink-500">
          Costs are order-of-magnitude screening figures from capacity curves and generic unit rates.
          They are for ranking options against each other, not for quoting a client.
        </p>
      </div>
    </div>
  );
}

function Compliance({ result, flowsheet }: { result: SimulationResult; flowsheet: Flowsheet }) {
  const products = result.productStreams;
  const [sel, setSel] = useState(0);
  const [std, setStd] = useState(flowsheet.basis.standard);
  const stream = products[sel]?.stream;
  const rows = stream ? checkCompliance(stream, std) : [];
  const stdInfo = STANDARDS.find((s) => s.key === std);
  const inScope = rows.filter((r) => !r.outsideScope);
  const failed = inScope.filter((r) => !r.pass).length;

  if (products.length === 0) {
    return <p className="py-8 text-center text-[0.8rem] text-ink-300">No product outlet connected.</p>;
  }
  if (!STANDARD_LIMITS[std]) {
    return (
      <div>
        <StdPicker std={std} setStd={setStd} />
        <p className="mt-4 rounded-lg bg-ink-900/[0.03] px-3 py-6 text-center text-[0.8rem] text-ink-500">
          No machine-checkable limits are defined for this standard. Declare the limits on the
          Design basis tab and check them by hand.
        </p>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-end gap-3">
        <div>
          <label className="label">Product stream</label>
          <select className="field mt-1 !w-auto" value={sel} onChange={(e) => setSel(Number(e.target.value))}>
            {products.map((p, i) => (
              <option key={p.id} value={i}>{p.label} — {p.stream.flow.toFixed(2)} m³/h</option>
            ))}
          </select>
        </div>
        <StdPicker std={std} setStd={setStd} />
        <div className={`ml-auto chip ${failed === 0 ? "bg-mint-100 text-mint-700" : "bg-coral-100 text-coral-700"}`}>
          {failed === 0 ? <CheckCircle2 className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
          {failed === 0 ? "All in-scope parameters met" : `${failed} parameter${failed > 1 ? "s" : ""} not met`}
        </div>
      </div>

      {stdInfo && <p className="mb-2 text-[0.7rem] text-ink-500">{stdInfo.scope}</p>}

      <table className="data">
        <thead>
          <tr>
            <th>Parameter</th><th>Limit</th><th className="num">This design</th>
            <th className="num">Margin</th><th>Status</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.label}>
              <td className="font-semibold">{r.label}</td>
              <td>{r.limitText}</td>
              <td className="num">{r.actualText}</td>
              <td className="num text-ink-500">{r.marginText}</td>
              <td>
                {r.outsideScope ? (
                  <span className="chip bg-sun-100 text-sun-700">Outside WTP scope</span>
                ) : r.pass ? (
                  <span className="chip bg-mint-100 text-mint-700">Pass</span>
                ) : (
                  <span className="chip bg-coral-100 text-coral-700">Fail</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {rows.some((r) => r.outsideScope) && (
        <div className="mt-3 rounded-lg bg-sun-100/70 px-3 py-2.5 text-[0.72rem] leading-relaxed text-sun-700">
          <strong>Read the amber rows carefully.</strong> Those parameters are not met by this plant
          and are not meant to be — dissolved oxygen is removed by the deaerator and pH is set by
          conditioning dosing, both in the boiler island. If your proposal implies the WTP alone
          delivers a compliant boiler feed water, that is a scope gap waiting to become a dispute.
        </div>
      )}
    </div>
  );
}

function StdPicker({ std, setStd }: { std: string; setStd: (s: string) => void }) {
  return (
    <div>
      <label className="label">Check against</label>
      <select className="field mt-1 !w-auto" value={std} onChange={(e) => setStd(e.target.value)}>
        {STANDARDS.map((s) => <option key={s.key} value={s.key}>{s.name}</option>)}
      </select>
    </div>
  );
}

function Sensitivity({ flowsheet }: { flowsheet: Flowsheet }) {
  const candidates = useMemo(() => sweepCandidates(flowsheet), [flowsheet]);
  const [idx, setIdx] = useState(0);
  const [res, setRes] = useState<SweepResult | null>(null);
  const [busy, setBusy] = useState(false);
  const c = candidates[idx];

  const run = () => {
    if (!c) return;
    setBusy(true);
    setTimeout(() => {
      setRes(sweep(flowsheet, c.nodeId, c.paramKey, c.min, c.max, 9));
      setBusy(false);
    }, 10);
  };

  if (candidates.length === 0) {
    return <p className="py-8 text-center text-[0.8rem] text-ink-300">No sweepable parameters on this flowsheet.</p>;
  }

  const maxRec = res ? Math.max(...res.points.map((p) => p.recoveryPct), 1) : 1;

  return (
    <div>
      <p className="mb-3 text-[0.75rem] leading-relaxed text-ink-700">
        Sweeps one parameter across its range and re-solves the whole flowsheet at each step. Use it
        to answer <em>&ldquo;how wrong can this assumption be before the design stops working?&rdquo;</em> — the
        question a design review will ask you.
      </p>
      <div className="mb-4 flex flex-wrap items-end gap-2">
        <div className="min-w-[280px] flex-1">
          <label className="label">Parameter to sweep</label>
          <select className="field mt-1" value={idx} onChange={(e) => { setIdx(Number(e.target.value)); setRes(null); }}>
            {candidates.map((x, i) => (
              <option key={`${x.nodeId}-${x.paramKey}`} value={i}>
                {x.nodeLabel} — {x.paramLabel} (now {x.current}{x.unit && ` ${x.unit}`})
              </option>
            ))}
          </select>
        </div>
        <button className="btn btn-primary" onClick={run} disabled={busy}>
          <TrendingUp className="h-3.5 w-3.5" /> {busy ? "Running…" : "Run sweep"}
        </button>
      </div>

      {res && (
        <>
          <div className="mb-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <MiniStat label="Range" value={`${res.points[0].value.toFixed(1)} – ${res.points[res.points.length - 1].value.toFixed(1)}`} unit={res.unit} />
            <MiniStat label="Recovery span" value={`${(Math.max(...res.points.map(p => p.recoveryPct)) - Math.min(...res.points.map(p => p.recoveryPct))).toFixed(2)}`} unit="points" />
            <MiniStat label="d(Recovery)" value={res.dRecovery.toFixed(3)} unit={`%/${res.unit || "unit"}`} />
            <MiniStat label="d(SEC)" value={res.dSec.toFixed(4)} unit={`kWh/m³ per ${res.unit || "unit"}`} />
          </div>

          <table className="data">
            <thead>
              <tr>
                <th className="num">{res.paramLabel} {res.unit && `(${res.unit})`}</th>
                <th>Recovery</th>
                <th className="num">Recovery %</th>
                <th className="num">Product m³/h</th>
                <th className="num">SEC kWh/m³</th>
                <th className="num">OPEX USD/m³</th>
                <th className="num">Reliability</th>
                <th className="num">Notes</th>
              </tr>
            </thead>
            <tbody>
              {res.points.map((p, i) => {
                const isBase = Math.abs(p.value - res.baseValue) < 1e-9;
                return (
                  <tr key={i} style={isBase ? { background: "rgba(214,242,254,0.6)" } : undefined}>
                    <td className="num font-semibold">
                      {p.value.toFixed(2)}{isBase && <span className="ml-1 text-[0.6rem] text-aqua-700">current</span>}
                    </td>
                    <td>
                      <div className="h-2.5 w-24 overflow-hidden rounded-full bg-ink-900/5">
                        <div className={`h-full rounded-full ${p.recoveryPct >= 90 ? "bg-mint-500" : p.recoveryPct >= 75 ? "bg-sun-500" : "bg-coral-500"}`}
                          style={{ width: `${(p.recoveryPct / maxRec) * 100}%` }} />
                      </div>
                    </td>
                    <td className="num font-semibold">{p.recoveryPct.toFixed(2)}</td>
                    <td className="num">{p.productFlow.toFixed(2)}</td>
                    <td className="num">{p.secKWhPerM3.toFixed(3)}</td>
                    <td className="num">{p.opexUSDPerM3.toFixed(3)}</td>
                    <td className="num">{p.reliability.toFixed(0)}</td>
                    <td className="num">{p.warnings > 0 ? <span className="chip bg-sun-100 text-sun-700">{p.warnings}</span> : "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {res.notes.length > 0 && (
            <div className="mt-3 space-y-1.5">
              {res.notes.map((nt, i) => (
                <p key={i} className="rounded-lg bg-sun-100/70 px-3 py-2 text-[0.72rem] leading-snug text-sun-700">{nt}</p>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function MiniStat({ label, value, unit }: { label: string; value: string; unit: string }) {
  return (
    <div className="card-flat p-2.5">
      <div className="text-[0.55rem] font-bold uppercase tracking-wider text-ink-300">{label}</div>
      <div className="stat mt-1 text-[0.95rem] font-bold text-ink-900">{value}</div>
      <div className="text-[0.58rem] text-ink-500">{unit}</div>
    </div>
  );
}

function Equipment({ result }: { result: SimulationResult }) {
  return (
    <div className="space-y-3">
      {result.nodes
        .filter((nd) => nd.aux.sizing.length > 0)
        .map((nd) => (
          <div key={nd.id} className="card-flat p-3">
            <div className="mb-1.5 flex items-baseline justify-between gap-2">
              <h4 className="text-[0.82rem] font-bold text-ink-900">{nd.label}</h4>
              <span className="text-[0.66rem] text-ink-500">
                {nd.aux.capexUSD > 0 && `≈ ${Math.round(nd.aux.capexUSD).toLocaleString()} USD`}
              </span>
            </div>
            <dl className="grid gap-x-6 gap-y-1 sm:grid-cols-2">
              {nd.aux.sizing.map((sz) => (
                <div key={sz.label} className="flex items-baseline justify-between gap-2 text-[0.74rem]">
                  <dt className="truncate text-ink-500">{sz.label}</dt>
                  <dd className="stat shrink-0 font-semibold text-ink-900">{sz.value}</dd>
                </div>
              ))}
            </dl>
          </div>
        ))}
      {result.nodes.every((nd) => nd.aux.sizing.length === 0) && (
        <p className="py-8 text-center text-[0.78rem] text-ink-300">
          <Boxes className="mx-auto mb-2 h-5 w-5" />
          No sizing produced. Run the simulation first.
        </p>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ bits */

function Kpi({
  icon: Icon, label, value, unit, tone,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string; value: string; unit: string;
  tone: "aqua" | "mint" | "sun" | "coral" | "violet" | "ink";
}) {
  const map = {
    aqua: "from-aqua-400/15 to-aqua-500/5 text-aqua-700",
    mint: "from-mint-500/15 to-mint-500/5 text-mint-700",
    sun: "from-sun-500/15 to-sun-500/5 text-sun-700",
    coral: "from-coral-500/15 to-coral-500/5 text-coral-700",
    violet: "from-violet-400/15 to-violet-500/5 text-violet-700",
    ink: "from-ink-500/12 to-ink-500/4 text-ink-700",
  };
  return (
    <div className={`card bg-gradient-to-br p-3 ${map[tone]}`}>
      <div className="flex items-center gap-1.5">
        <Icon className="h-3.5 w-3.5" />
        <span className="text-[0.58rem] font-bold uppercase tracking-wider">{label}</span>
      </div>
      <div className="stat mt-1.5 text-[1.35rem] font-bold leading-none text-ink-900">{value}</div>
      <div className="mt-0.5 text-[0.62rem] font-medium text-ink-500">{unit}</div>
    </div>
  );
}

function fmt(v: number): string {
  if (!Number.isFinite(v)) return "-";
  if (v === 0) return "0";
  if (v >= 10000) return v.toFixed(0);
  if (v >= 100) return v.toFixed(1);
  if (v >= 1) return v.toFixed(2);
  if (v >= 0.01) return v.toFixed(3);
  return v.toExponential(1);
}

function slug(s: string): string {
  return (s || "study").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60);
}
