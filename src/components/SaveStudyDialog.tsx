"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "./Modal";
import { useStudy } from "@/lib/store/useStudy";
import {
  emptyProject, getProject, listProjects, Project, ProjectKind, saveProject, newId, STATUS_LABEL, ProjectStatus,
} from "@/lib/store/db";
import { Save } from "lucide-react";

const KINDS: ProjectKind[] = ["WTP", "WWTP", "Desalination", "Demineralisation", "ZLD / MLD", "Reuse"];

export function SaveStudyDialog({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const { flowsheet, result, optimizerReport, studyName, projectId, setProjectId } = useStudy();
  const [projects, setProjects] = useState<Project[]>([]);
  const [target, setTarget] = useState<string>(projectId ?? "__new__");
  const [verdict, setVerdict] = useState<"feasible" | "conditional" | "not-feasible">("feasible");
  const [note, setNote] = useState("");
  const [draft, setDraft] = useState<Project>(emptyProject());
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    listProjects().then(setProjects);
  }, []);

  useEffect(() => {
    if (!result) return;
    const r = result.summary.recoveryPct;
    const w = result.summary.warnings.length;
    setVerdict(w === 0 && r >= 85 ? "feasible" : w > 3 || r < 60 ? "not-feasible" : "conditional");
  }, [result]);

  const submit = async () => {
    if (!result) return;
    setBusy(true);
    let project: Project;
    if (target === "__new__") {
      project = { ...draft, id: draft.id || newId() };
      if (!project.name) project.name = studyName || "Untitled project";
    } else {
      const found = await getProject(target);
      if (!found) {
        setBusy(false);
        return;
      }
      project = found;
    }
    project.runs = [
      {
        id: newId(),
        name: studyName || "Study",
        createdAt: new Date().toISOString(),
        flowsheet: JSON.parse(JSON.stringify(flowsheet)),
        result: JSON.parse(JSON.stringify(result)),
        optimizerReport: optimizerReport ?? undefined,
        verdict,
        engineerNote: note,
      },
      ...project.runs,
    ];
    if (project.status === "data-collection") project.status = "simulation";
    await saveProject(project);
    setProjectId(project.id);
    setBusy(false);
    onClose();
    router.push(`/projects/${project.id}`);
  };

  return (
    <Modal
      title="Save study to a project"
      subtitle="Every run is stored with its full flowsheet and results, so you can reopen it later."
      onClose={onClose}
      footer={
        <>
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={submit} disabled={busy || !result}>
            <Save className="h-3.5 w-3.5" /> {busy ? "Saving…" : "Save run"}
          </button>
        </>
      }
    >
      <div className="space-y-3.5">
        <div>
          <label className="label">Project</label>
          <select
            className="field mt-1"
            value={target}
            onChange={(e) => setTarget(e.target.value)}
          >
            <option value="__new__">➕ Create a new project</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} — {p.client || "no client"} ({STATUS_LABEL[p.status]})
              </option>
            ))}
          </select>
        </div>

        {target === "__new__" && (
          <div className="space-y-2.5 rounded-xl border border-ink-900/8 bg-white p-3">
            <div className="grid grid-cols-2 gap-2">
              <Field label="Project name" value={draft.name}
                onChange={(v) => setDraft({ ...draft, name: v })} placeholder={studyName} />
              <Field label="Client" value={draft.client}
                onChange={(v) => setDraft({ ...draft, client: v })} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Field label="Location" value={draft.location}
                onChange={(v) => setDraft({ ...draft, location: v })} />
              <div>
                <label className="label">Type</label>
                <select
                  className="field mt-1"
                  value={draft.kind}
                  onChange={(e) => setDraft({ ...draft, kind: e.target.value as ProjectKind })}
                >
                  {KINDS.map((k) => <option key={k} value={k}>{k}</option>)}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Field label="Marketing contact" value={draft.marketingContact}
                onChange={(v) => setDraft({ ...draft, marketingContact: v })} />
              <div>
                <label className="label">Status</label>
                <select
                  className="field mt-1"
                  value={draft.status}
                  onChange={(e) => setDraft({ ...draft, status: e.target.value as ProjectStatus })}
                >
                  {Object.entries(STATUS_LABEL).map(([k, v]) => (
                    <option key={k} value={k}>{v}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        )}

        <div>
          <label className="label">Study name</label>
          <input className="field mt-1" value={studyName} readOnly />
        </div>

        <div>
          <label className="label">Feasibility verdict</label>
          <div className="mt-1.5 grid grid-cols-3 gap-2">
            {([
              ["feasible", "Feasible", "bg-mint-100 text-mint-700 border-mint-500"],
              ["conditional", "Conditional", "bg-sun-100 text-sun-700 border-sun-500"],
              ["not-feasible", "Not feasible", "bg-coral-100 text-coral-700 border-coral-500"],
            ] as const).map(([k, lbl, cls]) => (
              <button
                key={k}
                onClick={() => setVerdict(k)}
                className={`rounded-lg border px-2 py-2 text-[0.74rem] font-semibold transition ${
                  verdict === k ? cls : "border-ink-900/10 bg-white text-ink-500 hover:bg-ink-900/[0.03]"
                }`}
              >
                {lbl}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="label">Engineer note</label>
          <textarea
            className="field mt-1 min-h-[70px] resize-y"
            placeholder="What you would tell the engineering director in two sentences: what is proven, what is assumed, what is still open."
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </div>
      </div>
    </Modal>
  );
}

function Field({
  label, value, onChange, placeholder,
}: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div>
      <label className="label">{label}</label>
      <input
        className="field mt-1"
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}
