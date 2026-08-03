"use client";

import { create } from "zustand";
import { Project } from "./types";

/**
 * The project you are currently working inside.
 *
 * Every other page — simulate, results, advisor, library, prepare — is a view
 * onto one project's work, and until now nothing said which. Losing that
 * context is not a cosmetic problem: a flowsheet saved to the wrong project is
 * worse than one not saved at all.
 *
 * Held separately from useStudy because it outlives any single study run, and
 * mirrored into localStorage so a page reload does not silently drop it.
 */

const KEY = "wtpsim:activeProject:v1";

export interface ActiveProject {
  id: string;
  name: string;
  client: string;
  kind: string;
  status: string;
}

interface ProjectState {
  active: ActiveProject | null;
  /** False until the browser value has been read, so the bar does not flicker. */
  hydrated: boolean;
  setActive: (p: ActiveProject | null) => void;
  setFromProject: (p: Project) => void;
  clear: () => void;
  hydrate: () => void;
}

export const useProject = create<ProjectState>((set) => ({
  active: null,
  hydrated: false,

  setActive: (p) => {
    set({ active: p });
    try {
      if (p) localStorage.setItem(KEY, JSON.stringify(p));
      else localStorage.removeItem(KEY);
    } catch { /* private browsing, or storage full */ }
  },

  setFromProject: (p) => {
    const a: ActiveProject = {
      id: p.id, name: p.name || "Untitled project", client: p.client,
      kind: p.kind, status: p.status,
    };
    set({ active: a });
    try { localStorage.setItem(KEY, JSON.stringify(a)); } catch { /* ignore */ }
  },

  clear: () => {
    set({ active: null });
    try { localStorage.removeItem(KEY); } catch { /* ignore */ }
  },

  hydrate: () => {
    try {
      const raw = localStorage.getItem(KEY);
      set({ active: raw ? (JSON.parse(raw) as ActiveProject) : null, hydrated: true });
    } catch {
      set({ hydrated: true });
    }
  },
}));
