"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Project, STATUS_LABEL, STATUS_TONE, StudyRun } from "@/lib/store/types";
import { ResultsView } from "@/components/ResultsView";
import { Droplets, Eye, ChevronRight, AlertCircle } from "lucide-react";

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

export default function SharedProject() {
  const { token } = useParams<{ token: string }>();
  const [project, setProject] = useState<Project | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [active, setActive] = useState<StudyRun | null>(null);

  useEffect(() => {
    fetch(`/api/share/${token}`, { cache: "no-store" })
      .then(async (r) => {
        const body = await r.json();
        if (!r.ok) throw new Error(body.error ?? "Could not open this link.");
        return body as Project;
      })
      .then((p) => {
        setProject(p);
        setActive(p.runs[0] ?? null);
      })
      .catch((e) => setError((e as Error).message));
  }, [token]);

  if (error) {
    return (
      <div className="mx-auto flex w-full max-w-lg flex-1 flex-col items-center justify-center px-4 py-20 text-center">
        <AlertCircle className="h-8 w-8 text-coral-500" />
        <h1 className="mt-3 text-[1.1rem] font-bold text-ink-900">Link unavailable</h1>
        <p className="mt-1.5 text-[0.85rem] text-ink-500">{error}</p>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="flex flex-1 items-center justify-center text-[0.85rem] text-ink-500">
        Opening shared study…
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-[1500px] px-4 py-6 sm:px-6">
      <div className="card mb-4 border-l-4 border-l-aqua-500 p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <span className="chip bg-aqua-100 text-aqua-700">
              <Eye className="h-3 w-3" /> Read-only shared study
            </span>
            <h1 className="mt-1.5 text-[1.4rem] font-bold tracking-tight text-ink-900">
              {project.name || "Untitled project"}
            </h1>
            <p className="text-[0.8rem] text-ink-500">
              {[project.client, project.location, project.kind].filter(Boolean).join(" · ")}
            </p>
          </div>
          <div className="flex flex-col items-end gap-1.5">
            <span className={`chip ring-1 ${STATUS_TONE[project.status]}`}>
              {STATUS_LABEL[project.status]}
            </span>
            <span className="text-[0.65rem] text-ink-300">
              Updated {new Date(project.updatedAt).toLocaleString("en-GB")}
            </span>
          </div>
        </div>
        {project.notes && (
          <p className="mt-3 rounded-lg bg-ink-900/[0.03] px-3 py-2 text-[0.78rem] leading-relaxed text-ink-700">
            {project.notes}
          </p>
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
        <div>
          <h2 className="mb-2 text-[0.9rem] font-bold text-ink-900">
            Studies ({project.runs.length})
          </h2>
          <div className="space-y-2">
            {project.runs.map((r) => (
              <button
                key={r.id}
                onClick={() => setActive(r)}
                className={`card w-full p-3 text-left transition ${
                  active?.id === r.id ? "ring-2 ring-aqua-400" : "hover:shadow-md"
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="min-w-0 flex-1 truncate text-[0.82rem] font-semibold text-ink-900">
                    {r.name}
                  </span>
                  <ChevronRight className="h-3.5 w-3.5 shrink-0 text-ink-300" />
                </div>
                <div className="mt-1 flex flex-wrap gap-1.5">
                  {r.verdict && (
                    <span className={`chip ${VERDICT_TONE[r.verdict]}`}>{VERDICT_LABEL[r.verdict]}</span>
                  )}
                  <span className="chip bg-aqua-50 text-aqua-700">
                    {r.result.summary.recoveryPct.toFixed(1)} % rec.
                  </span>
                </div>
                <div className="mt-1.5 text-[0.65rem] text-ink-500">
                  {new Date(r.createdAt).toLocaleString("en-GB")}
                </div>
              </button>
            ))}
            {project.runs.length === 0 && (
              <p className="card px-3 py-8 text-center text-[0.78rem] text-ink-300">
                No studies in this project yet.
              </p>
            )}
          </div>
        </div>

        <div className="min-w-0">
          {active ? (
            <>
              <div className="mb-3">
                <h2 className="text-[1.05rem] font-bold text-ink-900">{active.name}</h2>
                {active.engineerNote && (
                  <p className="mt-0.5 max-w-3xl text-[0.78rem] leading-relaxed text-ink-500">
                    {active.engineerNote}
                  </p>
                )}
              </div>
              <ResultsView
                flowsheet={active.flowsheet}
                result={active.result}
                studyName={`${project.name} — ${active.name}`}
              />
            </>
          ) : (
            <div className="card flex flex-col items-center gap-2 px-4 py-16 text-center">
              <Droplets className="h-7 w-7 text-ink-300" />
              <p className="text-[0.85rem] text-ink-500">Select a study on the left.</p>
            </div>
          )}
        </div>
      </div>

      <p className="mt-6 text-center text-[0.7rem] text-ink-300">
        Shared from HydroDesk. This view is read-only and reflects the study as saved.
      </p>
    </div>
  );
}
