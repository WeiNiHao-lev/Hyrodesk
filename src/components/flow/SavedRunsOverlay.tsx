"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getProject, Project, saveProject } from "@/lib/store/db";
import { InlineName } from "@/components/InlineName";
import { useProject } from "@/lib/store/useProject";
import { useStudy } from "@/lib/store/useStudy";
import { FolderOpen, FileText, ArrowRight, X } from "lucide-react";

const VERDICT: Record<string, { label: string; tone: string }> = {
  feasible: { label: "Feasible", tone: "bg-mint-100 text-mint-700" },
  conditional: { label: "Conditional", tone: "bg-sun-100 text-sun-700" },
  "not-feasible": { label: "Not feasible", tone: "bg-coral-100 text-coral-700" },
};

/**
 * What an empty canvas offers when the project already has work in it.
 *
 * Opening Simulate inside a project used to show a blank drawing even when the
 * project held five solved runs, because the canvas shows the working draft and
 * a project that was imported, or whose runs were all saved from another
 * browser, has no draft. The runs were one page away, behind a button on the
 * project page, and nothing on this page said they existed. A blank canvas in a
 * project that has work is a dead end; this turns it into a choice.
 *
 * It fetches the project only when it would be shown, so an ordinary drawing
 * session pays nothing for it.
 */
export function SavedRunsOverlay() {
  const active = useProject((s) => s.active);
  const hydrated = useProject((s) => s.hydrated);
  const empty = useStudy((s) => s.flowsheet.nodes.length === 0);
  const { setFlowsheet, setStudyName, setProjectId, run } = useStudy();
  const [project, setProject] = useState<Project | null>(null);
  const [dismissedFor, setDismissedFor] = useState<string | null>(null);

  const id = active?.id ?? null;
  const wanted = hydrated && !!id && empty && dismissedFor !== id;

  useEffect(() => {
    if (!wanted || !id) return;
    let cancelled = false;
    getProject(id).then((p) => { if (!cancelled) setProject(p ?? null); });
    return () => { cancelled = true; };
  }, [wanted, id]);

  if (!wanted || !project || project.id !== id || project.runs.length === 0) return null;

  // Renamed here because this is where an unhelpful name is first noticed:
  // a list of four "Untitled study" rows is unusable as a choice.
  const rename = async (runId: string, name: string) => {
    const fresh = await getProject(project.id);
    if (!fresh) return;
    const next = { ...fresh, runs: fresh.runs.map((r) => (r.id === runId ? { ...r, name } : r)) };
    await saveProject(next);
    setProject(next);
  };

  const open = (runId: string) => {
    const r = project.runs.find((x) => x.id === runId);
    if (!r) return;
    setFlowsheet(JSON.parse(JSON.stringify(r.flowsheet)));
    setStudyName(r.name);
    setProjectId(project.id);
    run();
  };

  return (
    <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center p-6">
      <div className="card pointer-events-auto w-full max-w-lg p-5 shadow-xl">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-2.5">
            <FolderOpen className="mt-0.5 h-5 w-5 shrink-0 text-violet-600" />
            <div>
              <h3 className="text-[0.95rem] font-bold text-ink-900">
                {project.name || "This project"} has {project.runs.length} saved run{project.runs.length === 1 ? "" : "s"}
              </h3>
              <p className="mt-0.5 text-[0.75rem] text-ink-500">
                Open one to see its flowsheet here, or start a blank drawing.
              </p>
            </div>
          </div>
          <button
            className="btn btn-ghost !p-1"
            title="Start a blank drawing instead"
            onClick={() => setDismissedFor(id)}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-4 max-h-[50vh] space-y-1.5 overflow-y-auto pr-1">
          {project.runs.map((r) => {
            const v = r.verdict ? VERDICT[r.verdict] : null;
            const s = r.result?.summary;
            return (
              <div
                key={r.id}
                role="button"
                tabIndex={0}
                onClick={() => open(r.id)}
                onKeyDown={(e) => { if (e.key === "Enter" && e.target === e.currentTarget) open(r.id); }}
                className="group flex w-full cursor-pointer items-center gap-3 rounded-lg border border-ink-900/8 bg-white px-3 py-2.5 text-left transition hover:border-aqua-300 hover:bg-aqua-50/60"
              >
                <FileText className="h-4 w-4 shrink-0 text-ink-300 group-hover:text-aqua-600" />
                <div className="min-w-0 flex-1">
                  <div className="flex min-w-0">
                    <InlineName
                      value={r.name}
                      onSave={(n) => rename(r.id, n)}
                      className="text-[0.8rem] font-semibold text-ink-900"
                      title="Rename this run"
                    />
                  </div>
                  <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[0.66rem] text-ink-500">
                    {v && <span className={`chip !py-0 ${v.tone}`}>{v.label}</span>}
                    {s && (
                      <span>
                        {s.productFlow.toFixed(0)} m³/h · {s.recoveryPct.toFixed(1)} % rec. · {s.secKWhPerM3.toFixed(2)} kWh/m³
                      </span>
                    )}
                  </div>
                </div>
                <ArrowRight className="h-3.5 w-3.5 shrink-0 text-ink-300 group-hover:text-aqua-600" />
              </div>
            );
          })}
        </div>

        <div className="mt-4 flex items-center justify-between border-t border-ink-900/8 pt-3">
          <Link href={`/projects/${project.id}/runs`} className="text-[0.72rem] font-semibold text-aqua-700 hover:underline">
            See all runs with their results
          </Link>
          <button className="btn btn-ghost !text-[0.72rem]" onClick={() => setDismissedFor(id)}>
            Start blank
          </button>
        </div>
      </div>
    </div>
  );
}
