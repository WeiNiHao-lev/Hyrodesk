"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getProject, saveProject, StudyRun } from "@/lib/store/db";
import { useStudy } from "@/lib/store/useStudy";
import { useWorkspace } from "@/components/workspace/WorkspaceContext";
import { ResultsView } from "@/components/ResultsView";
import { InlineName } from "@/components/InlineName";
import { Workflow, Trash2, Save, ChevronRight } from "lucide-react";

const VERDICT_TONE: Record<string, string> = {
  feasible: "bg-mint-100 text-mint-700",
  conditional: "bg-sun-100 text-sun-700",
  "not-feasible": "bg-coral-100 text-coral-700",
};
const VERDICT_LABEL: Record<string, string> = {
  feasible: "Feasible",
  conditional: "Conditional",
  "not-feasible": "Not feasible",
};

/** Every run saved to this project, and the results of the one selected. */
export default function ProjectRuns() {
  const { id, base, project, reload } = useWorkspace();
  const router = useRouter();
  const { setFlowsheet, setStudyName, run } = useStudy();
  const [activeId, setActiveId] = useState<string | null>(null);

  // A run saved from the Simulate tab should be here when you arrive.
  useEffect(() => { void reload(); }, [reload]);

  if (!project) return <div className="p-10 text-center text-[0.85rem] text-ink-500">Loading runs…</div>;

  const activeRun: StudyRun | null =
    project.runs.find((r) => r.id === activeId) ?? project.runs[0] ?? null;

  const openInSimulator = (r: StudyRun) => {
    setFlowsheet(JSON.parse(JSON.stringify(r.flowsheet)));
    setStudyName(r.name);
    run();
    router.push(`${base}/simulate`);
  };

  const renameRun = async (runId: string, name: string) => {
    // Fresh copy, for the same reason as deleting: another tab may have saved
    // a run since this list was loaded.
    const fresh = await getProject(id);
    if (!fresh) return;
    await saveProject({ ...fresh, runs: fresh.runs.map((r) => (r.id === runId ? { ...r, name } : r)) });
    await reload();
  };

  const deleteRun = async (runId: string) => {
    if (!confirm("Delete this run?")) return;
    // Fresh copy, so a run saved elsewhere in the meantime is not lost with it.
    const fresh = await getProject(id);
    if (!fresh) return;
    await saveProject({ ...fresh, runs: fresh.runs.filter((r) => r.id !== runId) });
    setActiveId(null);
    await reload();
  };

  if (project.runs.length === 0) {
    return (
      <div className="mx-auto flex max-w-xl flex-col items-center gap-2 px-4 py-20 text-center">
        <Save className="h-8 w-8 text-ink-300" />
        <h2 className="text-[1rem] font-bold text-ink-900">No runs saved yet</h2>
        <p className="text-[0.8rem] text-ink-500">
          Draw a flowsheet in the Simulate tab, run it, and use Save to project. Every saved run
          appears here with its flowsheet and results.
        </p>
        <Link href={`${base}/simulate`} className="btn btn-primary mt-2">
          <Workflow className="h-4 w-4" /> Open the canvas
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-[1500px] px-4 py-5 sm:px-6">
      <div className="grid gap-4 lg:grid-cols-[300px_1fr]">
        <div className="space-y-2">
          {project.runs.map((r) => (
            <div
              key={r.id}
              role="button"
              tabIndex={0}
              onClick={() => setActiveId(r.id)}
              onKeyDown={(e) => { if (e.key === "Enter" && e.target === e.currentTarget) setActiveId(r.id); }}
              className={`card cursor-pointer p-3 transition ${activeRun?.id === r.id ? "ring-2 ring-aqua-400" : "hover:shadow-md"}`}
            >
              <div className="flex items-start justify-between gap-2">
                <InlineName
                  value={r.name}
                  onSave={(n) => renameRun(r.id, n)}
                  className="text-[0.82rem] font-semibold text-ink-900"
                  title="Rename this run"
                />
                <ChevronRight className="mt-0.5 h-3.5 w-3.5 shrink-0 text-ink-300" />
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-1.5">
                {r.verdict && <span className={`chip ${VERDICT_TONE[r.verdict]}`}>{VERDICT_LABEL[r.verdict]}</span>}
                <span className="chip bg-aqua-50 text-aqua-700">{r.result.summary.recoveryPct.toFixed(1)} % rec.</span>
                <span className="chip bg-aqua-50 text-aqua-700">{r.result.summary.productFlow.toFixed(0)} m³/h</span>
              </div>
              <div className="mt-1.5 text-[0.65rem] text-ink-500">{new Date(r.createdAt).toLocaleString("en-GB")}</div>
              <button
                className="mt-2 inline-flex items-center gap-1 text-[0.7rem] font-semibold text-aqua-700 hover:underline"
                onClick={(e) => { e.stopPropagation(); openInSimulator(r); }}
              >
                <Workflow className="h-3 w-3" /> Open in simulator
              </button>
            </div>
          ))}
        </div>

        <div className="min-w-0">
          {activeRun && (
            <>
              <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <h2 className="flex text-[1.05rem] font-bold text-ink-900">
                    <InlineName
                      key={activeRun.id}
                      value={activeRun.name}
                      onSave={(n) => renameRun(activeRun.id, n)}
                      className="text-[1.05rem] font-bold text-ink-900"
                      title="Rename this run"
                    />
                  </h2>
                  {activeRun.engineerNote && (
                    <p className="mt-0.5 max-w-3xl text-[0.75rem] leading-relaxed text-ink-500">{activeRun.engineerNote}</p>
                  )}
                </div>
                <div className="flex gap-2">
                  <button className="btn btn-primary" onClick={() => openInSimulator(activeRun)}>
                    <Workflow className="h-3.5 w-3.5" /> Open in simulator
                  </button>
                  <button className="btn btn-danger" onClick={() => deleteRun(activeRun.id)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
              <ResultsView
                flowsheet={activeRun.flowsheet}
                result={activeRun.result}
                studyName={`${project.name} — ${activeRun.name}`}
              />
            </>
          )}
        </div>
      </div>
    </div>
  );
}
