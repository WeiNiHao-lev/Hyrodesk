import { Flowsheet, SimulationResult } from "../engine/types";
import { OptimizerReport } from "../engine/optimizer";

/**
 * Shared project types. Deliberately free of "use client" so both the browser
 * storage adapter and the server-side Postgres adapter can import them.
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

/**
 * A site visit's answers, held with the project rather than in the browser.
 *
 * Previously the Prepare checklist wrote to one localStorage key shared by
 * every project, so opening a second project silently showed the first one's
 * answers. Answers belong to the site they were collected at.
 */
export interface PrepareRecord {
  /** Greenfield / brownfield / expansion, as chosen on the Prepare page. */
  condition: string;
  /** Which type guide is in use: WTP, WWTP, desalination, ... */
  type: string;
  checked: Record<string, boolean>;
  notes: Record<string, string>;
  updatedAt: string;
  /** Free text: who was met, when, and anything the checklist did not ask. */
  visitLog?: string;
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
  /** Site visit preparation and the answers collected there. */
  prepare?: PrepareRecord;
  /** Present when the project has a read-only share link. */
  shareToken?: string;
}

export type StorageMode = "cloud" | "local";

export interface HealthReport {
  storage: StorageMode;
  configured: boolean;
  ok: boolean;
  projects?: number;
  error?: string;
}

export function newId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
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
