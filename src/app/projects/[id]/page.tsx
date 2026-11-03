"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  createShareLink, health, ProjectStatus, revokeShareLink, STATUS_LABEL, STATUS_TONE,
} from "@/lib/store/db";
import { useWorkspace } from "@/components/workspace/WorkspaceContext";
import {
  Workflow, Share2, Copy, Check, XCircle, ClipboardList, History, ArrowRight,
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

/** The project itself: who it is for, where it stands, and what has been done. */
export default function ProjectOverview() {
  const { base, project, saving, patch, reload } = useWorkspace();
  const [cloud, setCloud] = useState(false);
  // The link follows the stored token, except just after it is created or
  // revoked here, when the local answer is newer than the stored copy.
  const [shareOverride, setShareOverride] = useState<string | null | undefined>(undefined);
  const [copied, setCopied] = useState(false);
  const [sharing, setSharing] = useState(false);

  // Runs may have been saved from the Simulate tab since this was loaded.
  useEffect(() => { void reload(); }, [reload]);
  useEffect(() => { health().then((h) => setCloud(h.storage === "cloud" && h.ok)); }, []);
  if (!project) return <div className="p-10 text-center text-[0.85rem] text-ink-500">Loading the project…</div>;

  const shareUrl = shareOverride !== undefined
    ? shareOverride
    : project.shareToken ? `${window.location.origin}/share/${project.shareToken}` : null;
  const latest = project.runs[0];
  const prep = project.prepare;
  const answered = prep ? Object.values(prep.checked ?? {}).filter(Boolean).length : 0;

  return (
    <div className="mx-auto w-full max-w-[1200px] px-4 py-5 sm:px-6">
      <div className="card p-4 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <label className="label">Project name</label>
            <input
              className="mt-0.5 w-full border-0 bg-transparent p-0 text-[1.3rem] font-bold tracking-tight text-ink-900 outline-none"
              value={project.name}
              onChange={(e) => patch({ name: e.target.value })}
            />
            <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
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
            {cloud && (
              <button
                className="btn btn-ghost"
                disabled={sharing}
                onClick={async () => {
                  setSharing(true);
                  try {
                    if (shareUrl) {
                      await revokeShareLink(project.id);
                      setShareOverride(null);
                    } else {
                      const t = await createShareLink(project.id);
                      setShareOverride(`${window.location.origin}/share/${t}`);
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
          </div>
        )}

        <div className="mt-3">
          <label className="label">Notes</label>
          <textarea
            className="field mt-1 min-h-[110px] resize-y"
            value={project.notes}
            placeholder="What the client asked for, what data is still missing, who is chasing it."
            onChange={(e) => patch({ notes: e.target.value })}
          />
        </div>
      </div>

      {/* where the work stands */}
      <div className="mt-4 grid gap-3 md:grid-cols-3">
        <Link href={`${base}/prepare`} className="card group p-4 transition hover:shadow-md">
          <div className="flex items-center gap-2 text-[0.8rem] font-bold text-ink-900">
            <ClipboardList className="h-4 w-4 text-violet-600" /> Site visit
          </div>
          <p className="mt-1.5 text-[0.75rem] text-ink-500">
            {prep ? `${answered} item${answered === 1 ? "" : "s"} answered` : "Not started"}
          </p>
          <span className="mt-2 inline-flex items-center gap-1 text-[0.72rem] font-semibold text-aqua-700 group-hover:underline">
            Open checklist <ArrowRight className="h-3 w-3" />
          </span>
        </Link>

        <Link href={`${base}/simulate`} className="card group p-4 transition hover:shadow-md">
          <div className="flex items-center gap-2 text-[0.8rem] font-bold text-ink-900">
            <Workflow className="h-4 w-4 text-aqua-600" /> Simulation
          </div>
          <p className="mt-1.5 text-[0.75rem] text-ink-500">
            {project.runs.length === 0 ? "No runs saved yet" : `${project.runs.length} run${project.runs.length === 1 ? "" : "s"} saved`}
          </p>
          <span className="mt-2 inline-flex items-center gap-1 text-[0.72rem] font-semibold text-aqua-700 group-hover:underline">
            Open the canvas <ArrowRight className="h-3 w-3" />
          </span>
        </Link>

        <Link href={`${base}/runs`} className="card group p-4 transition hover:shadow-md">
          <div className="flex items-center gap-2 text-[0.8rem] font-bold text-ink-900">
            <History className="h-4 w-4 text-mint-600" /> Latest run
          </div>
          {latest ? (
            <>
              <p className="mt-1.5 truncate text-[0.75rem] font-semibold text-ink-700">{latest.name}</p>
              <div className="mt-1 flex flex-wrap gap-1.5">
                {latest.verdict && <span className={`chip ${VERDICT_TONE[latest.verdict]}`}>{VERDICT_LABEL[latest.verdict]}</span>}
                <span className="chip bg-aqua-50 text-aqua-700">{latest.result.summary.productFlow.toFixed(0)} m³/h</span>
                <span className="chip bg-aqua-50 text-aqua-700">{latest.result.summary.recoveryPct.toFixed(1)} %</span>
              </div>
            </>
          ) : (
            <p className="mt-1.5 text-[0.75rem] text-ink-500">Nothing saved yet</p>
          )}
          <span className="mt-2 inline-flex items-center gap-1 text-[0.72rem] font-semibold text-aqua-700 group-hover:underline">
            All runs <ArrowRight className="h-3 w-3" />
          </span>
        </Link>
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
