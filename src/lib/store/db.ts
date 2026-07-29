"use client";

import { get, set, del, keys } from "idb-keyval";
import {
  emptyProject, HealthReport, newId, Project, StorageMode,
} from "./types";

export * from "./types";

/**
 * Persistence layer with two interchangeable backends.
 *
 * If the deployment has DATABASE_URL set, everything goes to Postgres through
 * the API routes, so projects are visible from any device and can be shared
 * read-only with a link. If it is not set, everything falls back to IndexedDB
 * in this browser and the app keeps working with no configuration at all.
 *
 * The mode is decided once, by asking the server, and cached for the session.
 */

const PREFIX = "wtpsim:project:";
let modePromise: Promise<StorageMode> | null = null;
let cachedHealth: HealthReport | null = null;

export async function health(): Promise<HealthReport> {
  if (cachedHealth) return cachedHealth;
  try {
    const r = await fetch("/api/health", { cache: "no-store" });
    cachedHealth = (await r.json()) as HealthReport;
  } catch {
    cachedHealth = { storage: "local", configured: false, ok: true, error: "Health endpoint unreachable" };
  }
  return cachedHealth;
}

export function resetHealthCache() {
  cachedHealth = null;
  modePromise = null;
}

async function mode(): Promise<StorageMode> {
  if (!modePromise) modePromise = health().then((h) => (h.storage === "cloud" && h.ok ? "cloud" : "local"));
  return modePromise;
}

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const r = await fetch(path, {
    ...init,
    cache: "no-store",
    headers: { "content-type": "application/json", ...(init?.headers ?? {}) },
  });
  if (!r.ok) throw new Error(`${init?.method ?? "GET"} ${path} failed: ${r.status}`);
  return (await r.json()) as T;
}

/* ------------------------------------------------------------------ local */

async function listLocal(): Promise<Project[]> {
  const all = await keys();
  const ids = all.filter((k): k is string => typeof k === "string" && k.startsWith(PREFIX));
  const rows = await Promise.all(ids.map((k) => get<Project>(k)));
  return rows
    .filter((r): r is Project => !!r)
    .sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
}

/* ------------------------------------------------------------------ public */

export async function listProjects(): Promise<Project[]> {
  if ((await mode()) === "cloud") {
    try {
      return await api<Project[]>("/api/projects");
    } catch {
      return listLocal();
    }
  }
  return listLocal();
}

export async function getProject(id: string): Promise<Project | undefined> {
  if ((await mode()) === "cloud") {
    try {
      return await api<Project>(`/api/projects/${encodeURIComponent(id)}`);
    } catch {
      return get<Project>(PREFIX + id);
    }
  }
  return get<Project>(PREFIX + id);
}

export async function saveProject(p: Project): Promise<void> {
  p.updatedAt = new Date().toISOString();
  if ((await mode()) === "cloud") {
    await api<Project>("/api/projects", { method: "POST", body: JSON.stringify(p) });
    return;
  }
  await set(PREFIX + p.id, p);
}

export async function deleteProject(id: string): Promise<void> {
  if ((await mode()) === "cloud") {
    await api<{ ok: boolean }>(`/api/projects/${encodeURIComponent(id)}`, { method: "DELETE" });
    return;
  }
  await del(PREFIX + id);
}

/** Creates (or returns) a read-only share link. Cloud storage only. */
export async function createShareLink(id: string): Promise<string> {
  const { token } = await api<{ token: string }>(
    `/api/projects/${encodeURIComponent(id)}/share`, { method: "POST" },
  );
  return token;
}

export async function revokeShareLink(id: string): Promise<void> {
  await api<{ ok: boolean }>(`/api/projects/${encodeURIComponent(id)}/share`, { method: "DELETE" });
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
    await saveProject(p);
  }
  return data.projects.length;
}

/** Copies everything in this browser up to the cloud database. */
export async function migrateLocalToCloud(): Promise<number> {
  const h = await health();
  if (h.storage !== "cloud" || !h.ok) throw new Error("Cloud storage is not available.");
  const local = await listLocal();
  for (const p of local) {
    await api<Project>("/api/projects", { method: "POST", body: JSON.stringify(p) });
  }
  return local.length;
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

export { emptyProject };
