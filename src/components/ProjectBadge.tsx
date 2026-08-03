"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useProject } from "@/lib/store/useProject";
import { useStudy } from "@/lib/store/useStudy";
import { listProjects, Project, STATUS_LABEL } from "@/lib/store/db";
import { FolderKanban, ChevronDown, X, ExternalLink, Check } from "lucide-react";

/**
 * Which project you are working inside, shown on every page.
 *
 * The simulator, the results, the advisor and the checklist are all views onto
 * one project's work, and nothing on screen used to say which. Saving a
 * flowsheet to the wrong project is a worse failure than not saving it, so the
 * context is made permanent rather than implied by how you navigated here.
 */
export function ProjectBadge() {
  const { active, hydrated, hydrate, setFromProject, clear } = useProject();
  const setProjectId = useStudy((s) => s.setProjectId);
  const [open, setOpen] = useState(false);
  const [projects, setProjects] = useState<Project[] | null>(null);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => { hydrate(); }, [hydrate]);

  // Keep the study store's project id in step with the bar, so a save lands
  // where the header says it will.
  useEffect(() => { setProjectId(active?.id ?? null); }, [active, setProjectId]);

  useEffect(() => {
    if (!open || projects) return;
    listProjects().then(setProjects);
  }, [open, projects]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  if (!hydrated) return <div className="h-7 w-40" />;

  return (
    <div className="relative" ref={box}>
      <button
        onClick={() => { setOpen(!open); setProjects(null); }}
        className={`flex max-w-[19rem] items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[0.76rem] font-semibold transition ${
          active
            ? "bg-violet-100 text-violet-800 hover:bg-violet-200"
            : "bg-ink-900/[0.04] text-ink-500 hover:bg-ink-900/[0.08]"
        }`}
        title={active ? `Working inside: ${active.name}` : "No project selected — work will not be filed anywhere"}
      >
        <FolderKanban className="h-3.5 w-3.5 shrink-0" strokeWidth={2.2} />
        <span className="truncate">
          {active ? active.name : "No project"}
        </span>
        {active?.client && (
          <span className="hidden shrink-0 text-[0.68rem] font-medium opacity-70 lg:inline">
            · {active.client}
          </span>
        )}
        <ChevronDown className="h-3 w-3 shrink-0 opacity-60" />
      </button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-1.5 w-[22rem] overflow-hidden rounded-xl border border-ink-900/10 bg-white shadow-xl">
          {active && (
            <div className="border-b border-ink-900/8 bg-violet-50/60 px-3 py-2.5">
              <div className="text-[0.6rem] font-bold uppercase tracking-wider text-violet-700">
                Currently working inside
              </div>
              <div className="mt-0.5 truncate text-[0.85rem] font-bold text-ink-900">{active.name}</div>
              <div className="text-[0.7rem] text-ink-500">
                {[active.client, active.kind, STATUS_LABEL[active.status as keyof typeof STATUS_LABEL] ?? active.status]
                  .filter(Boolean).join(" · ")}
              </div>
              <div className="mt-2 flex gap-1.5">
                <Link
                  href={`/projects/${active.id}`}
                  onClick={() => setOpen(false)}
                  className="btn btn-ghost !px-2 !py-1 !text-[0.7rem]"
                >
                  <ExternalLink className="h-3 w-3" /> Open project
                </Link>
                <button
                  className="btn btn-ghost !px-2 !py-1 !text-[0.7rem]"
                  onClick={() => { clear(); setOpen(false); }}
                >
                  <X className="h-3 w-3" /> Leave
                </button>
              </div>
            </div>
          )}

          <div className="max-h-[18rem] overflow-y-auto p-1.5">
            <div className="px-1.5 py-1 text-[0.6rem] font-bold uppercase tracking-wider text-ink-300">
              Switch to
            </div>
            {projects === null && (
              <p className="px-2 py-3 text-[0.74rem] text-ink-300">Loading…</p>
            )}
            {projects?.length === 0 && (
              <p className="px-2 py-3 text-[0.74rem] leading-snug text-ink-500">
                No projects yet. Create one from the Projects page, then everything you do here
                is filed against it.
              </p>
            )}
            {projects?.map((p) => (
              <button
                key={p.id}
                onClick={() => { setFromProject(p); setOpen(false); }}
                className="flex w-full items-start gap-2 rounded-lg px-2 py-1.5 text-left transition hover:bg-ink-900/[0.04]"
              >
                <span className="mt-0.5 w-3.5 shrink-0">
                  {active?.id === p.id && <Check className="h-3.5 w-3.5 text-violet-700" />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[0.78rem] font-semibold text-ink-900">
                    {p.name || "Untitled project"}
                  </span>
                  <span className="block truncate text-[0.68rem] text-ink-500">
                    {[p.client, p.kind, `${p.runs.length} run${p.runs.length === 1 ? "" : "s"}`]
                      .filter(Boolean).join(" · ")}
                  </span>
                </span>
              </button>
            ))}
          </div>

          <div className="border-t border-ink-900/8 px-3 py-2">
            <Link
              href="/projects"
              onClick={() => setOpen(false)}
              className="text-[0.72rem] font-semibold text-aqua-700 hover:underline"
            >
              Manage all projects →
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
