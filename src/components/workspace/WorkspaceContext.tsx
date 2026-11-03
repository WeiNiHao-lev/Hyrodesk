"use client";

import {
  createContext, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState,
} from "react";
import { getProject, Project, saveProject } from "@/lib/store/db";
import { useProject } from "@/lib/store/useProject";
import { useStudy } from "@/lib/store/useStudy";

/**
 * The project a workspace page belongs to, taken from the URL.
 *
 * Every page under /projects/[id] reads its project from here, and the id comes
 * from the address rather than from a dropdown. That is the whole of the fix
 * for work landing in the wrong project: there is no selection to get out of
 * step with, because the page cannot be shown without saying which project it
 * is in.
 */
interface Workspace {
  id: string;
  /** Prefix for links inside this project: /projects/{id}. */
  base: string;
  project: Project | null;
  notFound: boolean;
  saving: boolean;
  /** Re-read from storage. Tabs that show runs call it on arrival. */
  reload: () => Promise<void>;
  /** Change project fields. Debounced, and merged into a fresh copy before saving. */
  patch: (fields: Partial<Project>) => void;
}

const Ctx = createContext<Workspace | null>(null);

export function useWorkspace(): Workspace {
  const w = useContext(Ctx);
  if (!w) throw new Error("useWorkspace must be used inside a project workspace");
  return w;
}

/** The workspace, or null on a page outside one. */
export function useOptionalWorkspace(): Workspace | null {
  return useContext(Ctx);
}

export function WorkspaceProvider({ id, children }: { id: string; children: React.ReactNode }) {
  const [project, setProject] = useState<Project | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [saving, setSaving] = useState(false);
  const setActive = useProject((s) => s.setActive);
  const setFromProject = useProject((s) => s.setFromProject);
  const setProjectId = useStudy((s) => s.setProjectId);

  // Before any effect elsewhere runs — in particular before the autosave reads
  // which project is active — say which one this is. Done in a layout effect so
  // the autosave never loads another project's draft into this canvas first.
  useLayoutEffect(() => {
    const cur = useProject.getState().active;
    if (cur?.id !== id) {
      setActive({ id, name: cur?.id === id ? cur.name : "", client: "", kind: "", status: "" });
    }
    setProjectId(id);
  }, [id, setActive, setProjectId]);

  const reload = useCallback(async () => {
    const p = await getProject(id);
    if (!p) { setNotFound(true); return; }
    setNotFound(false);
    setProject(p);
    setFromProject(p);
  }, [id, setFromProject]);

  // First load, with a guard so a quick switch between projects cannot let the
  // slower response land on the wrong page.
  useEffect(() => {
    let cancelled = false;
    getProject(id).then((p) => {
      if (cancelled) return;
      if (!p) { setNotFound(true); return; }
      setNotFound(false);
      setProject(p);
      setFromProject(p);
    });
    return () => { cancelled = true; };
  }, [id, setFromProject]);

  // Field edits are typed a character at a time. Writing each one was a
  // database round trip per keystroke in cloud mode, so they are collected and
  // written once the typing pauses.
  const pending = useRef<Partial<Project>>({});
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flush = useCallback(async () => {
    if (timer.current) { clearTimeout(timer.current); timer.current = null; }
    const fields = pending.current;
    if (Object.keys(fields).length === 0) return;
    pending.current = {};
    setSaving(true);
    // Re-read before writing. Another tab of this workspace may have saved a
    // run or a checklist since this copy was loaded, and writing the stale copy
    // back would erase it. Only the fields actually edited are applied.
    const fresh = (await getProject(id)) ?? null;
    if (fresh) {
      const next = { ...fresh, ...fields };
      await saveProject(next);
      setProject(next);
      setFromProject(next);
    }
    setSaving(false);
  }, [id, setFromProject]);

  const patch = useCallback((fields: Partial<Project>) => {
    pending.current = { ...pending.current, ...fields };
    setProject((p) => (p ? { ...p, ...fields } : p));
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => { void flush(); }, 600);
  }, [flush]);

  useEffect(() => {
    const out = () => { void flush(); };
    window.addEventListener("pagehide", out);
    return () => { window.removeEventListener("pagehide", out); out(); };
  }, [flush]);

  const value = useMemo<Workspace>(() => ({
    id, base: `/projects/${id}`, project, notFound, saving, reload, patch,
  }), [id, project, notFound, saving, reload, patch]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
