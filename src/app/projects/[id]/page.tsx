"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  createShareLink, getProject, health, Project, ProjectStatus, revokeShareLink,
  saveProject, STATUS_LABEL, STATUS_TONE, StudyRun,
} from "@/lib/store/db";
import { useStudy } from "@/lib/store/useStudy";
import { ResultsView } from "@/components/ResultsView";
import {
  ArrowLeft, Workflow, Trash2, Save, ChevronRight, Share2, Copy, Check, XCircle,
} from "lucide-react";

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

export default function ProjectDetail() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [project, setProject] = useState<Project | null>(null);
  const [activeRun, setActiveRun] = useState<StudyRun | null>(null);
  const [saving, setSaving] = useState(false);
  const [cloud, setCloud] = useState(false);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [sharing, setSharing] = useState(false);
  const { setFlowsheet, setStudyName, setProjectId, run } = useStudy();

  useEffect(() => {
    getProject(id).then((p) => {
      if (!p) return;
      setProject(p);
      setActiveRun(p.runs[0] ?? null);
      if (p.shareToken) setShareUrl(`${window.location.origin}/share/${p.shareToken}`);
    });
    health().then((h) => setCloud(h.storage === "cloud" && h.ok));
  }, [id]);

  if (!project) {
    return (
      <div className="mx-auto w-full max-w-3xl px-4 py-16 text-center">
        <p className="text-[0.9rem] text-ink-500">Project not found.</p>
        <Link href="/projects" className="btn btn-ghost mt-4">
          <ArrowLeft className="h-3.5 w-3.5" /> Back to projects
        </Link>
      </div>
    );
  }

  const patch = async (p: Partial<Project>) => {
    const next = { ...project, ...p };
    setProject(next);
    setSaving(true);
    await saveProject(next);
    setSaving(false);
  };

  const openInSimulator = (r: StudyRun) => {
    setFlowsheet(JSON.parse(JSON.stringify(r.flowsheet)));
    setStudyName(r.name);
    setProjectId(project.id);
    run();
    router.push("/simulate");
  };

  const deleteRun = async (runId: string) => {
    if (!confirm("Delete this run?")) return;
    const next = { ...project, runs: project.runs.filter((r) => r.id !== runId) };
    setProject(next);
    setActiveRun(next.runs[0] ?? null);
    await saveProject(next);
  };

  return (
    <div className="mx-auto w-full max-w-[1500px] px-4 py-6 sm:px-6">
      <Link href="/projects" className="mb-3 inline-flex items-center gap-1 text-[0.75rem] font-semibold text-ink-500 hover:text-ink-900">
        <ArrowLeft className="h-3.5 w-3.5" /> All projects
      </Link>

      {/* header */}
      <div className="card p-4 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <input
              className="w-full border-0 bg-transparent p-0 text-[1.4rem] font-bold tracking-tight text-ink-900 outline-none"
              value={project.name}
              onChange={(e) => patch({ name: e.target.value })}
            />
            <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              <Inline label="Client" value={project.client} onChange={(v) => patch({ client: v })} />
              <Inline label="Location" value={project.location} onChange={(v) => patch({ location: v })} />
              <Inline label="Capacity" value={project.capacityNote} onChange={(v) => patch({ capacityNote: v })} />
              <Inline label="Marketing" value={project.marketingContact} onChange={(v) => patch({ marketingContact: v })} />
            </div>
          </div>
          <div className="flex flex-col items-end gap-2">
            <select
              className={`field !w-auto font-semibold ${STATUS_TONE[project.status]}`}
              value={project.status}
              onChange={(e) => patch({ status: e.target.value as ProjectStatus })}
            >
              {Object.entries(STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
            <span className="text-[0.65rem] text-ink-300">
              {saving ? "Saving…" : `Updated ${new Date(project.updatedAt).toLocaleString("en-GB")}`}
            </span>
            <div className="flex gap-2">
              {cloud && (
                <button
                  className="btn btn-ghost"
                  disabled={sharing}
                  onClick={async () => {
                    setSharing(true);
                    try {
                      if (shareUrl) {
                        await revokeShareLink(project.id);
                        setShareUrl(null);
                      } else {
                        const t = await createShareLink(project.id);
                        setShareUrl(`${window.location.origin}/share/${t}`);
                      }
                    } catch (e) {
                      alert((e as Error).message);
                    }
                    setSharing(false);
                  }}
                >
                  {shareUrl ? <XCircle className="h-3.5 w-3.5" /> : <Share2 className="h-3.5 w-3.5" />}
                  {shareUrl ? "Revoke link" : "Share link"}
                </button>
              )}
              <Link href={`/simulate?project=${project.id}&new=1`} className="btn btn-primary">
                <Workflow className="h-3.5 w-3.5" /> New study
              </Link>
            </div>
          </div>
        </div>

        {shareUrl && (
          <div className="mt-3 rounded-xl bg-mint-100/60 p-3">
            <div className="flex items-center gap-1.5">
              <Share2 className="h-3.5 w-3.5 text-mint-700" />
              <span className="text-[0.62rem] font-bold uppercase tracking-wider text-mint-700">
                Read-only link — anyone with it can view this project
              </span>
            </div>
            <div className="mt-1.5 flex gap-2">
              <input className="field font-mono !text-[0.72rem]" value={shareUrl} readOnly onFocus={(e) => e.currentTarget.select()} />
              <button
                className="btn btn-ghost shrink-0"
                onClick={() => {
                  navigator.clipboard.writeText(shareUrl);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 1800);
                }}
              >
                {copied ? <Check className="h-3.5 w-3.5 text-mint-700" /> : <Copy className="h-3.5 w-3.5" />}
                {copied ? "Copied" : "Copy"}
              </button>
            </div>
            <p className="mt-1.5 text-[0.66rem] leading-snug text-ink-500">
              Send this to the engineering director — no account needed, and the link cannot be used
              to change anything. Revoke it at any time and it stops working immediately.
            </p>
          </div>
        )}

        <div className="mt-3">
          <label className="label">Notes</label>
          <textarea
            className="field mt-1 min-h-[60px] resize-y"
            value={project.notes}
            placeholder="What the client asked for, what data is still missing, who is chasing it."
            onChange={(e) => patch({ notes: e.target.value })}
          />
        </div>
      </div>

      {/* runs */}
      <div className="mt-5 grid gap-4 lg:grid-cols-[300px_1fr]">
        <div>
          <h2 className="mb-2 text-[0.9rem] font-bold text-ink-900">
            Saved runs ({project.runs.length})
          </h2>
          <div className="space-y-2">
            {project.runs.map((r) => (
              <button
                key={r.id}
                onClick={() => setActiveRun(r)}
                className={`card w-full p-3 text-left transition ${
                  activeRun?.id === r.id ? "ring-2 ring-aqua-400" : "hover:shadow-md"
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="min-w-0 flex-1 truncate text-[0.82rem] font-semibold text-ink-900">
                    {r.name}
                  </span>
                  <ChevronRight className="h-3.5 w-3.5 shrink-0 text-ink-300" />
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-1.5">
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
                {r.engineerNote && (
                  <p className="mt-1.5 line-clamp-2 text-[0.68rem] leading-snug text-ink-500">
                    {r.engineerNote}
                  </p>
                )}
              </button>
            ))}
            {project.runs.length === 0 && (
              <p className="card px-3 py-8 text-center text-[0.78rem] text-ink-300">
                No runs saved yet.
              </p>
            )}
          </div>
        </div>

        <div className="min-w-0">
          {activeRun ? (
            <>
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 className="text-[1.05rem] font-bold text-ink-900">{activeRun.name}</h2>
                  {activeRun.engineerNote && (
                    <p className="mt-0.5 max-w-2xl text-[0.75rem] leading-relaxed text-ink-500">
                      {activeRun.engineerNote}
                    </p>
                  )}
                </div>
                <div className="flex gap-2">
                  <button className="btn btn-ghost" onClick={() => openInSimulator(activeRun)}>
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
          ) : (
            <div className="card flex flex-col items-center gap-2 px-4 py-16 text-center">
              <Save className="h-7 w-7 text-ink-300" />
              <h3 className="text-[0.92rem] font-bold text-ink-900">No run selected</h3>
              <p className="max-w-sm text-[0.8rem] text-ink-500">
                Run a simulation and save it to this project, or select an existing run on the left.
              </p>
              <Link href={`/simulate?project=${project.id}&new=1`} className="btn btn-primary mt-2">
                <Workflow className="h-4 w-4" /> Start a study
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Inline({
  label, value, onChange,
}: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="label">{label}</label>
      <input
        className="field mt-0.5 !py-1 !text-[0.78rem]"
        value={value}
        placeholder="—"
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}
