"use client";

import { get, set, del, keys } from "idb-keyval";
import { Flowsheet, SimulationResult } from "../engine/types";
import { OptimizerReport } from "../engine/optimizer";

/**
 * Persistence layer.
 *
 * v1 stores everything in the browser via IndexedDB, which needs no account,
 * no environment variable and no server. The interface below is deliberately
 * narrow so a Postgres adapter can be dropped in later without touching the UI:
 * implement the same five functions against an API route and swap the import.
 */

export type ProjectStatus =
  | "lead"
  | "data-collection"
  | "simulation"
  | "pre-approval"
  | "approved"
  | "rejected"
  | "on-hold";

export const STATUS_LABEL: Record<ProjectStatus, string> = {
  lead: "Lead",
  "data-collection": "Data collection",
  simulation: "Simulation",
  "pre-approval": "Pre-approval review",
  approved: "Approved",
  rejected: "Not feasible",
  "on-hold": "On hold",
};

export const STATUS_TONE: Record<ProjectStatus, string> = {
  lead: "bg-slate-100 text-slate-700 ring-slate-200",
  "data-collection": "bg-amber-100 text-amber-800 ring-amber-200",
  simulation: "bg-sky-100 text-sky-800 ring-sky-200",
  "pre-approval": "bg-violet-100 text-violet-800 ring-violet-200",
  approved: "bg-emerald-100 text-emerald-800 ring-emerald-200",
  rejected: "bg-rose-100 text-rose-800 ring-rose-200",
  "on-hold": "bg-stone-100 text-stone-700 ring-stone-200",
};

export type ProjectKind =
  | "WTP"
  | "WWTP"
  | "Desalination"
  | "Demineralisation"
  | "ZLD / MLD"
  | "Reuse";

export interface StudyRun {
  id: string;
  name: string;
  createdAt: string;
  flowsheet: Flowsheet;
  result: SimulationResult;
  optimizerReport?: OptimizerReport;
  verdict?: "feasible" | "conditional" | "not-feasible";
  engineerNote?: string;
}

export interface Project {
  id: string;
  name: string;
  client: string;
  location: string;
  kind: ProjectKind;
  status: ProjectStatus;
  capacityNote: string;
  marketingContact: string;
  createdAt: string;
  updatedAt: string;
  notes: string;
  runs: StudyRun[];
}

const PREFIX = "wtpsim:project:";

export function newId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export async function listProjects(): Promise<Project[]> {
  const all = await keys();
  const ids = all.filter((k): k is string => typeof k === "string" && k.startsWith(PREFIX));
  const rows = await Promise.all(ids.map((k) => get<Project>(k)));
  return rows
    .filter((r): r is Project => !!r)
    .sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
}

export async function getProject(id: string): Promise<Project | undefined> {
  return get<Project>(PREFIX + id);
}

export async function saveProject(p: Project): Promise<void> {
  p.updatedAt = new Date().toISOString();
  await set(PREFIX + p.id, p);
}

export async function deleteProject(id: string): Promise<void> {
  await del(PREFIX + id);
}

export function emptyProject(): Project {
  const now = new Date().toISOString();
  return {
    id: newId(),
    name: "",
    client: "",
    location: "",
    kind: "WTP",
    status: "data-collection",
    capacityNote: "",
    marketingContact: "",
    createdAt: now,
    updatedAt: now,
    notes: "",
    runs: [],
  };
}

/* ------------------------------------------------------------ export / import */

export async function exportAll(): Promise<string> {
  const projects = await listProjects();
  return JSON.stringify({ version: 1, exportedAt: new Date().toISOString(), projects }, null, 2);
}

export async function importAll(json: string): Promise<number> {
  const data = JSON.parse(json) as { projects?: Project[] };
  if (!data.projects || !Array.isArray(data.projects)) {
    throw new Error("File does not contain a project list.");
  }
  for (const p of data.projects) {
    if (!p.id) p.id = newId();
    await set(PREFIX + p.id, p);
  }
  return data.projects.length;
}

export function downloadText(filename: string, text: string, mime = "application/json") {
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function downloadBlob(filename: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
