"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Canvas } from "@/components/flow/Canvas";
import { Palette } from "@/components/flow/Palette";
import { ParamPanel } from "@/components/flow/ParamPanel";
import { FeedPanel, BasisPanel } from "@/components/flow/ConfigPanels";
import { LearnPanel } from "@/components/flow/LearnPanel";
import { OptimizerDialog } from "@/components/OptimizerDialog";
import { SaveStudyDialog } from "@/components/SaveStudyDialog";
import { useStudy } from "@/lib/store/useStudy";
import { TEMPLATES } from "@/lib/engine/templates";
import {
  Play, Sparkles, Save, LayoutTemplate, AlertTriangle, CheckCircle2,
  FilePlus, RotateCcw, Eraser,
} from "lucide-react";

type Tab = "block" | "learn" | "feed" | "basis";

export default function SimulatePage() {
  return (
    <Suspense
      fallback={
        <div className="flex flex-1 items-center justify-center text-[0.85rem] text-ink-500">
          Loading the canvas…
        </div>
      }
    >
      <SimulateInner />
    </Suspense>
  );
}

function SimulateInner() {
  const router = useRouter();
  const params = useSearchParams();
  const {
    flowsheet, result, reliability, dirty, run, addNode, loadTemplate, setProjectId,
    newStudy, resetAllParams, clearCanvas,
  } = useStudy();
  const [tab, setTab] = useState<Tab>("block");
  const [showOpt, setShowOpt] = useState(false);
  const [showSave, setShowSave] = useState(false);

  useEffect(() => {
    // A study started from a project must begin blank, not inherit whatever was
    // left in the editor from the last one.
    if (params.get("new") === "1") newStudy();
    const t = params.get("template");
    if (t) loadTemplate(t);
    const pid = params.get("project");
    if (pid) setProjectId(pid);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!result && flowsheet.nodes.length > 0) run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const s = result?.summary;
  const warn = s?.warnings.length ?? 0;

  return (
    <div className="flex h-[calc(100vh-3.5rem)] flex-col">
      {/* toolbar */}
      <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-ink-900/8 bg-white/70 px-4 py-2 backdrop-blur">
        <div className="flex items-center gap-1.5">
          <LayoutTemplate className="h-3.5 w-3.5 text-ink-300" />
          <select
            className="field !w-auto !py-1 !text-[0.75rem]"
            value=""
            onChange={(e) => e.target.value && loadTemplate(e.target.value)}
          >
            <option value="">Load template…</option>
            {TEMPLATES.map((t) => (
              <option key={t.key} value={t.key}>{t.name}</option>
            ))}
          </select>
        </div>

        <button
          className="btn btn-ghost !px-2 !text-[0.72rem]"
          title="Start a completely blank study — no blocks, no feed data"
          onClick={() => {
            if (confirm("Start a new blank study? Any unsaved work is lost.")) newStudy();
          }}
        >
          <FilePlus className="h-3.5 w-3.5" /> New
        </button>

        <div className="h-5 w-px bg-ink-900/10" />

        <button
          className="btn btn-ghost !px-2 !text-[0.72rem]"
          title="Restore every block to its default parameters, keeping the flowsheet"
          onClick={() => {
            if (confirm("Restore every block to its default parameters? The flowsheet layout is kept.")) resetAllParams();
          }}
          disabled={flowsheet.nodes.length === 0}
        >
          <RotateCcw className="h-3.5 w-3.5" /> Reset params
        </button>
        <button
          className="btn btn-ghost !px-2 !text-[0.72rem]"
          title="Remove every block and connection, keeping the feed and design basis"
          onClick={() => {
            if (confirm("Remove every block and connection? The feed water and design basis are kept.")) clearCanvas();
          }}
          disabled={flowsheet.nodes.length === 0}
        >
          <Eraser className="h-3.5 w-3.5" /> Clear canvas
        </button>

        <div className="h-5 w-px bg-ink-900/10" />

        <button className="btn btn-primary" onClick={run}>
          <Play className="h-3.5 w-3.5" /> Run simulation
        </button>
        <button className="btn btn-mint" onClick={() => setShowOpt(true)}>
          <Sparkles className="h-3.5 w-3.5" /> Optimise
        </button>
        <button className="btn btn-ghost" onClick={() => setShowSave(true)} disabled={!result}>
          <Save className="h-3.5 w-3.5" /> Save to project
        </button>

        <div className="ml-auto flex flex-wrap items-center gap-3">
          {dirty && (
            <span className="chip bg-sun-100 text-sun-700">Edited — re-run to update</span>
          )}
          {s && (
            <>
              <Metric label="Feed" value={`${s.feedFlow.toFixed(1)}`} unit="m³/h" />
              <Metric label="Product" value={`${s.productFlow.toFixed(1)}`} unit="m³/h" />
              <Metric
                label="Recovery"
                value={`${s.recoveryPct.toFixed(1)}`}
                unit="%"
                tone={s.recoveryPct >= 90 ? "good" : s.recoveryPct >= 75 ? "warn" : "bad"}
              />
              <Metric label="SEC" value={`${s.secKWhPerM3.toFixed(3)}`} unit="kWh/m³" />
              <Metric
                label="Reliability"
                value={`${reliability.toFixed(0)}`}
                unit="/100"
                tone={reliability >= 75 ? "good" : reliability >= 55 ? "warn" : "bad"}
              />
              <button
                className={`chip ${warn > 0 ? "bg-sun-100 text-sun-700" : "bg-mint-100 text-mint-700"}`}
                onClick={() => router.push("/results")}
              >
                {warn > 0 ? (
                  <><AlertTriangle className="h-3 w-3" /> {warn} note{warn > 1 ? "s" : ""}</>
                ) : (
                  <><CheckCircle2 className="h-3 w-3" /> No warnings</>
                )}
              </button>
            </>
          )}
        </div>
      </div>

      {/* body */}
      <div className="flex min-h-0 flex-1">
        <aside className="hidden w-[248px] shrink-0 border-r border-ink-900/8 bg-white/55 lg:block">
          <Palette onAdd={(t) => addNode(t, { x: 260 + Math.random() * 200, y: 140 + Math.random() * 160 })} />
        </aside>

        <div className="min-w-0 flex-1">
          <Canvas />
        </div>

        <aside className="hidden w-[300px] shrink-0 border-l border-ink-900/8 bg-white/55 xl:flex xl:flex-col">
          <div className="flex shrink-0 border-b border-ink-900/8">
            {(
              [
                ["block", "Block"],
                ["learn", "Learn"],
                ["feed", "Feed"],
                ["basis", "Basis"],
              ] as [Tab, string][]
            ).map(([k, lbl]) => (
              <button
                key={k}
                onClick={() => setTab(k)}
                className={`flex-1 px-2 py-2 text-[0.72rem] font-semibold transition ${
                  tab === k
                    ? "border-b-2 border-aqua-500 text-aqua-700"
                    : "text-ink-500 hover:text-ink-900"
                }`}
              >
                {lbl}
              </button>
            ))}
          </div>
          <div className="min-h-0 flex-1">
            {tab === "block" && <ParamPanel />}
            {tab === "learn" && <LearnPanel />}
            {tab === "feed" && <FeedPanel />}
            {tab === "basis" && <BasisPanel />}
          </div>
        </aside>
      </div>

      {showOpt && <OptimizerDialog onClose={() => setShowOpt(false)} />}
      {showSave && <SaveStudyDialog onClose={() => setShowSave(false)} />}
    </div>
  );
}

function Metric({
  label, value, unit, tone,
}: { label: string; value: string; unit: string; tone?: "good" | "warn" | "bad" }) {
  const color =
    tone === "good" ? "text-mint-700" : tone === "warn" ? "text-sun-700" : tone === "bad" ? "text-coral-700" : "text-ink-900";
  return (
    <div className="flex flex-col leading-none">
      <span className="text-[0.55rem] font-bold uppercase tracking-wider text-ink-300">{label}</span>
      <span className="mt-0.5">
        <span className={`stat text-[0.85rem] font-bold ${color}`}>{value}</span>
        <span className="ml-0.5 text-[0.58rem] font-medium text-ink-500">{unit}</span>
      </span>
    </div>
  );
}
