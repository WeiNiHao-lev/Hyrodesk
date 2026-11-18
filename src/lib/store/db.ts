"use client";

import { get, set, del, keys } from "idb-keyval";
import { saveFile } from "../savefile";
import {
  emptyProject, HealthReport, newId, Project, ProjectSummary, RunSummary, StorageMode,
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

/** An HTTP error from the API, with the server's own message and status. */
export class ApiError extends Error {
  constructor(public status: number, message: string, public body: Record<string, unknown> = {}) {
    super(message);
  }
}

/** Pages a signed-out visitor may stay on. */
const PUBLIC_PATHS = ["/login", "/setup", "/share"];

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const r = await fetch(path, {
    ...init,
    cache: "no-store",
    headers: { "content-type": "application/json", ...(init?.headers ?? {}) },
  });
  if (!r.ok) {
    const body = (await r.json().catch(() => ({}))) as Record<string, unknown>;
    // Signed out (or the session expired): go and sign in, then come back here.
    if (r.status === 401 && typeof window !== "undefined"
      && !PUBLIC_PATHS.some((x) => window.location.pathname.startsWith(x))) {
      const next = encodeURIComponent(window.location.pathname + window.location.search);
      window.location.assign(body.needsSetup ? "/setup" : `/login?next=${next}`);
    }
    throw new ApiError(r.status, String(body.error ?? `${init?.method ?? "GET"} ${path} failed: ${r.status}`), body);
  }
  return (await r.json()) as T;
}

/**
 * A network failure, as opposed to the server answering with an error. Only
 * this kind falls back to the browser's copy: falling back on a 401 or 403
 * would quietly show stale local data in place of a refusal.
 */
const isNetworkError = (e: unknown) => !(e instanceof ApiError);

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

export async function listProjects(owner?: string): Promise<Project[]> {
  if ((await mode()) === "cloud") {
    try {
      return await api<Project[]>(`/api/projects${owner ? `?owner=${encodeURIComponent(owner)}` : ""}`);
    } catch (e) {
      if (!isNetworkError(e)) throw e;
      return listLocal();
    }
  }
  return listLocal();
}

/** What a card needs from a run, taken from a full one. */
function summariseRun(r: Project["runs"][number]): RunSummary {
  const s = r.result?.summary;
  return {
    id: r.id, name: r.name, createdAt: r.createdAt, verdict: r.verdict,
    recoveryPct: s?.recoveryPct ?? 0,
    secKWhPerM3: s?.secKWhPerM3 ?? 0,
    productFlow: s?.productFlow ?? 0,
  };
}

/**
 * Projects as every list on screen needs them: the names, the statuses and the
 * three numbers on each card. In cloud mode the database builds this itself, so
 * the runs inside never cross the network. Use listProjects only where the
 * runs themselves are wanted — export, and importing a feed from a saved run.
 */
export async function listProjectSummaries(owner?: string): Promise<ProjectSummary[]> {
  if ((await mode()) === "cloud") {
    try {
      return await api<ProjectSummary[]>(`/api/projects?summary=1${owner ? `&owner=${encodeURIComponent(owner)}` : ""}`);
    } catch (e) {
      if (!isNetworkError(e)) throw e;
      /* fall through to the local copy */
    }
  }
  const all = await listLocal();
  return all.map((p) => {
    const { runs, ...rest } = p;
    delete (rest as Partial<Project>).prepare;
    return { ...rest, runs: runs.map(summariseRun) };
  });
}

export async function getProject(id: string): Promise<Project | undefined> {
  if ((await mode()) === "cloud") {
    try {
      return await api<Project>(`/api/projects/${encodeURIComponent(id)}`);
    } catch (e) {
      if (!isNetworkError(e)) return undefined;
      return get<Project>(PREFIX + id);
    }
  }
  return get<Project>(PREFIX + id);
}

export async function saveProject(p: Project): Promise<void> {
  // Opened through someone else's workspace password: readable, never written.
  // The server refuses it too; stopping here gives the reason instead of a 403.
  if (p.access === "viewer") throw new ApiError(403, "This project is view only: it belongs to another account.");
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
    // An imported project is mine, whatever account exported it.
    delete p.access;
    delete p.ownerId;
    delete p.ownerName;
    delete p.shareToken;
    try {
      await saveProject(p);
    } catch (e) {
      // Its id belongs to a project in another account: import it as a copy
      // under a new id rather than refuse it, and never write over theirs.
      if (!(e instanceof ApiError && e.body.conflict)) throw e;
      p.id = newId();
      await saveProject(p);
    }
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

/** Exports go where Settings say: downloads folder, a save dialog, or a chosen folder. */
export function downloadText(filename: string, text: string, mime = "application/json") {
  void saveFile(filename, new Blob([text], { type: mime }));
}

export function downloadBlob(filename: string, blob: Blob) {
  void saveFile(filename, blob);
}

export { emptyProject };
