"use client";

import Link from "next/link";
import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  deleteProject, emptyProject, exportAll, importAll, listProjectSummaries, Project, ProjectSummary,
  ProjectKind, ProjectStatus, saveProject, STATUS_LABEL, STATUS_TONE, downloadText,
} from "@/lib/store/db";
import { Modal } from "@/components/Modal";
import { StorageBadge } from "@/components/StorageBadge";
import { SharedWorkspace, sharedWorkspaces, useAuth } from "@/lib/store/auth";
import {
  Plus, Download, Upload, Trash2, Search, FolderKanban, ArrowRight, Eye,
} from "lucide-react";
import { useT } from "@/lib/i18n";

const KINDS: ProjectKind[] = ["WTP", "WWTP", "Desalination", "Demineralisation", "ZLD / MLD", "Reuse"];

export default function ProjectsPage() {
  return (
    <Suspense fallback={null}>
      <ProjectsList />
    </Suspense>
  );
}

function ProjectsList() {
  const params = useSearchParams();
  const { cloud, me } = useAuth();
  const t = useT();
  // ?owner= shows another account's workspace, opened with its password.
  const owner = params.get("owner") || undefined;
  const readOnly = !!owner && owner !== me?.id;
  const [shared, setShared] = useState<SharedWorkspace[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [showNew, setShowNew] = useState(false);
  const [draft, setDraft] = useState<Project>(emptyProject());
  const fileRef = useRef<HTMLInputElement>(null);

  const reload = useCallback(() => listProjectSummaries(readOnly ? owner : undefined)
    .then((r) => { setProjects(r); setLoadError(null); })
    .catch((e: Error) => { setProjects([]); setLoadError(e.message); }), [owner, readOnly]);
  useEffect(() => { void reload(); }, [reload]);
  useEffect(() => {
    if (cloud && me) sharedWorkspaces().then(setShared).catch(() => setShared([]));
  }, [cloud, me]);
  const viewing = shared.find((w) => w.id === owner);

  const filtered = projects.filter((p) => {
    if (statusFilter !== "all" && p.status !== statusFilter) return false;
    const t = q.trim().toLowerCase();
    if (!t) return true;
    return [p.name, p.client, p.location, p.kind].some((v) => v.toLowerCase().includes(t));
  });

  const create = async () => {
    const p = { ...draft };
    if (!p.name) p.name = t("Untitled project");
    await saveProject(p);
    setShowNew(false);
    setDraft(emptyProject());
    reload();
  };

  const remove = async (id: string, name: string) => {
    if (!confirm(t("Delete “{name}” and all of its saved runs? This cannot be undone.", { name }))) return;
    await deleteProject(id);
    reload();
  };

  return (
    <div className="mx-auto w-full max-w-[1400px] px-4 py-6 sm:px-6">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[1.4rem] font-bold tracking-tight text-ink-900">
            {readOnly ? t("{name}'s projects", { name: viewing?.displayName ?? t("Teammate") }) : t("Project tracker")}
          </h1>
          <p className="text-[0.8rem] text-ink-500">
            {readOnly
              ? t("View only. Opened with the workspace password its owner gave you; nothing here can be changed or deleted.")
              : t("Every study you run, stored with its flowsheet and results so you can reopen it later.")}
          </p>
        </div>
        {!readOnly && <div className="flex flex-wrap gap-2">
          <button className="btn btn-primary" onClick={() => { setDraft(emptyProject()); setShowNew(true); }}>
            <Plus className="h-3.5 w-3.5" /> {t("New project")}
          </button>
          <button
            className="btn btn-ghost"
            onClick={async () => downloadText(`hydrodesk-backup-${new Date().toISOString().slice(0, 10)}.json`, await exportAll())}
          >
            <Download className="h-3.5 w-3.5" /> {t("Export all")}
          </button>
          <button className="btn btn-ghost" onClick={() => fileRef.current?.click()}>
            <Upload className="h-3.5 w-3.5" /> {t("Import")}
          </button>
          <input
            ref={fileRef} type="file" accept="application/json" className="hidden"
            onChange={async (e) => {
              const f = e.target.files?.[0];
              if (!f) return;
              try {
                const count = await importAll(await f.text());
                alert(t(count === 1 ? "Imported 1 project." : "Imported {n} projects.", { n: count }));
                reload();
              } catch (err) {
                alert(t("Import failed: {msg}", { msg: (err as Error).message }));
              }
              e.target.value = "";
            }}
          />
        </div>}
      </div>

      {cloud && (shared.length > 0 || readOnly) && (
        <div className="mb-3 flex flex-wrap gap-1.5">
          <Link href="/projects" className={`chip !px-3 !py-1 ${!readOnly ? "bg-aqua-100 text-aqua-700" : "bg-ink-900/5 text-ink-500 hover:text-ink-900"}`}>
            {t("My projects")}
          </Link>
          {shared.map((w) => (
            <Link key={w.id} href={`/projects?owner=${encodeURIComponent(w.id)}`}
              className={`chip !px-3 !py-1 ${owner === w.id ? "bg-violet-100 text-violet-700" : "bg-ink-900/5 text-ink-500 hover:text-ink-900"}`}>
              <Eye className="h-3 w-3" /> {w.displayName}
            </Link>
          ))}
          <Link href="/profile/workspaces" className="chip !px-3 !py-1 bg-transparent text-aqua-700 hover:underline">
            {t("Open a teammate's workspace…")}
          </Link>
        </div>
      )}

      {loadError && (
        <div className="mb-4 rounded-lg bg-coral-100 px-3 py-2 text-[0.78rem] text-coral-700">{loadError}</div>
      )}

      <div className="mb-4">
        <StorageBadge full />
      </div>

      <div className="card mb-4 flex flex-wrap items-center gap-2 p-2.5">
        <div className="relative min-w-[200px] flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-300" />
          <input
            className="field !pl-8"
            placeholder={t("Search by project, client, location…")}
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <select className="field !w-auto" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="all">{t("All statuses")}</option>
          {Object.entries(STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{t(v)}</option>)}
        </select>
      </div>

      {filtered.length === 0 ? (
        <div className="card flex flex-col items-center gap-2 px-4 py-16 text-center">
          <FolderKanban className="h-8 w-8 text-ink-300" />
          <h2 className="text-[0.95rem] font-bold text-ink-900">
            {projects.length === 0 ? (readOnly ? t("No projects in this workspace") : t("No projects yet")) : t("Nothing matches that filter")}
          </h2>
          <p className="max-w-md text-[0.8rem] text-ink-500">
            {projects.length === 0
              ? t("Create a project here, or run a simulation and save it — the save dialog can create the project for you.")
              : t("Try clearing the search or status filter.")}
          </p>
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((p) => {
            const last = p.runs[0];
            return (
              <div key={p.id} className="card flex flex-col p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h3 className="truncate text-[0.95rem] font-bold text-ink-900">{p.name || t("Untitled")}</h3>
                    <p className="truncate text-[0.75rem] text-ink-500">
                      {[p.client, p.location].filter(Boolean).join(" · ") || t("No client recorded")}
                    </p>
                  </div>
                  {!readOnly && (
                    <button className="btn btn-danger !px-1.5 !py-1" onClick={() => remove(p.id, p.name)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>

                <div className="mt-2.5 flex flex-wrap gap-1.5">
                  <span className={`chip ring-1 ${STATUS_TONE[p.status]}`}>{t(STATUS_LABEL[p.status])}</span>
                  <span className="chip bg-aqua-50 text-aqua-700">{p.kind}</span>
                  <span className="chip bg-ink-900/5 text-ink-500">
                    {t(p.runs.length === 1 ? "1 run" : "{n} runs", { n: p.runs.length })}
                  </span>
                </div>

                {last && (
                  <dl className="mt-3 grid grid-cols-3 gap-2 rounded-lg bg-aqua-50/70 p-2.5">
                    <Mini k={t("Recovery")} v={`${last.recoveryPct.toFixed(1)}%`} />
                    <Mini k="SEC" v={`${last.secKWhPerM3.toFixed(2)}`} />
                    <Mini k={t("Product")} v={`${last.productFlow.toFixed(0)}`} />
                  </dl>
                )}

                <Link
                  href={`/projects/${p.id}`}
                  className="mt-3 flex items-center gap-1 text-[0.78rem] font-semibold text-aqua-700 hover:underline"
                >
                  {t("Open project")} <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            );
          })}
        </div>
      )}

      {showNew && (
        <Modal
          title={t("New project")}
          subtitle={t("You can also create a project directly from the save dialog after a run.")}
          onClose={() => setShowNew(false)}
          footer={
            <>
              <button className="btn btn-ghost" onClick={() => setShowNew(false)}>{t("Cancel")}</button>
              <button className="btn btn-primary" onClick={create}>{t("Create project")}</button>
            </>
          }
        >
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <Fld label={t("Project name")} value={draft.name} onChange={(v) => setDraft({ ...draft, name: v })} />
              <Fld label={t("Client")} value={draft.client} onChange={(v) => setDraft({ ...draft, client: v })} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Fld label={t("Location")} value={draft.location} onChange={(v) => setDraft({ ...draft, location: v })} />
              <div>
                <label className="label">{t("Type")}</label>
                <select className="field mt-1" value={draft.kind}
                  onChange={(e) => setDraft({ ...draft, kind: e.target.value as ProjectKind })}>
                  {KINDS.map((k) => <option key={k} value={k}>{k}</option>)}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Fld label={t("Marketing contact")} value={draft.marketingContact}
                onChange={(v) => setDraft({ ...draft, marketingContact: v })} />
              <div>
                <label className="label">{t("Status")}</label>
                <select className="field mt-1" value={draft.status}
                  onChange={(e) => setDraft({ ...draft, status: e.target.value as ProjectStatus })}>
                  {Object.entries(STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{t(v)}</option>)}
                </select>
              </div>
            </div>
            <Fld label={t("Capacity note")} value={draft.capacityNote}
              onChange={(v) => setDraft({ ...draft, capacityNote: v })}
              placeholder={t("e.g. 52 L/s product, seawater feed")} />
            <div>
              <label className="label">{t("Notes")}</label>
              <textarea className="field mt-1 min-h-[70px] resize-y" value={draft.notes}
                onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
                placeholder={t("What the client asked for, what data is still missing, who is chasing it.")} />
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

function Fld({
  label, value, onChange, placeholder,
}: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div>
      <label className="label">{label}</label>
      <input className="field mt-1" value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

function Mini({ k, v }: { k: string; v: string }) {
  return (
    <div>
      <dt className="text-[0.55rem] font-bold uppercase tracking-wider text-ink-300">{k}</dt>
      <dd className="stat text-[0.85rem] font-bold text-ink-900">{v}</dd>
    </div>
  );
}
