import "server-only";
import { neon } from "@neondatabase/serverless";
import { Project, ProjectSummary, RunSummary } from "../store/types";

/**
 * Server-side Postgres access.
 *
 * The whole module is defensive by design: if DATABASE_URL is absent the app
 * must still work, falling back to browser storage. Nothing here may throw at
 * import time, because that would take the whole deployment down over a missing
 * environment variable.
 */

export function isConfigured(): boolean {
  return !!process.env.DATABASE_URL && process.env.DATABASE_URL.startsWith("post");
}

function sql() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  return neon(url);
}

let schemaReady = false;

/**
 * Creates the schema on first use. Doing it here rather than in a migration
 * step means there is nothing for the user to run by hand after deploying.
 */
export async function ensureSchema(): Promise<void> {
  if (schemaReady) return;
  const q = sql();
  await q`
    create table if not exists projects (
      id                text primary key,
      name              text not null default '',
      client            text not null default '',
      location          text not null default '',
      kind              text not null default 'WTP',
      status            text not null default 'data-collection',
      capacity_note     text not null default '',
      marketing_contact text not null default '',
      notes             text not null default '',
      created_at        timestamptz not null default now(),
      updated_at        timestamptz not null default now(),
      runs              jsonb not null default '[]'::jsonb,
      share_token       text unique
    )
  `;
  await q`create index if not exists projects_updated_at_idx on projects (updated_at desc)`;
  await q`create index if not exists projects_share_token_idx on projects (share_token)`;
  // The site-visit checklist was added to the project after this table was
  // first created, and nobody added a column for it. Every Prepare answer
  // given in cloud mode was accepted, shown as "Saved to project", and then
  // dropped on the way to the database — the page kept its own copy, so the
  // loss only appeared on the next reload. Added in place so an existing
  // database gains the column on its next request without a manual migration.
  await q`alter table projects add column if not exists prepare jsonb`;
  schemaReady = true;
}

type Row = {
  id: string; name: string; client: string; location: string; kind: string;
  status: string; capacity_note: string; marketing_contact: string; notes: string;
  created_at: Date | string; updated_at: Date | string; runs: unknown; share_token: string | null;
  prepare?: unknown;
};

function toProject(r: Row): Project {
  return {
    id: r.id,
    name: r.name,
    client: r.client,
    location: r.location,
    kind: r.kind as Project["kind"],
    status: r.status as Project["status"],
    capacityNote: r.capacity_note,
    marketingContact: r.marketing_contact,
    notes: r.notes,
    createdAt: new Date(r.created_at).toISOString(),
    updatedAt: new Date(r.updated_at).toISOString(),
    runs: (Array.isArray(r.runs) ? r.runs : []) as Project["runs"],
    prepare: (r.prepare && typeof r.prepare === "object" ? r.prepare : undefined) as Project["prepare"],
    shareToken: r.share_token ?? undefined,
  };
}

export async function listProjectsDb(): Promise<Project[]> {
  await ensureSchema();
  const q = sql();
  const rows = (await q`select * from projects order by updated_at desc`) as unknown as Row[];
  return rows.map(toProject);
}

/**
 * The project list, without the work inside it.
 *
 * Each saved run carries its whole flowsheet and its whole simulation result —
 * every stream, every unit's sizing, every warning — and a single project with
 * a handful of runs is half a megabyte. Listing projects used to select all of
 * it, send it to the function, and send it on to the browser, to draw cards
 * that show a name, a status and three numbers. The summary is built inside the
 * database so the bulk never leaves it.
 */
export async function listProjectSummariesDb(): Promise<ProjectSummary[]> {
  await ensureSchema();
  const q = sql();
  const rows = (await q`
    select id, name, client, location, kind, status, capacity_note, marketing_contact,
           notes, created_at, updated_at, share_token,
           coalesce((
             select jsonb_agg(jsonb_build_object(
               'id', r->'id',
               'name', r->'name',
               'createdAt', r->'createdAt',
               'verdict', r->'verdict',
               'recoveryPct', coalesce(r->'result'->'summary'->'recoveryPct', '0'::jsonb),
               'secKWhPerM3', coalesce(r->'result'->'summary'->'secKWhPerM3', '0'::jsonb),
               'productFlow', coalesce(r->'result'->'summary'->'productFlow', '0'::jsonb)
             ) order by ord)
             from jsonb_array_elements(runs) with ordinality as t(r, ord)
           ), '[]'::jsonb) as runs
      from projects
     order by updated_at desc
  `) as unknown as Row[];
  return rows.map((r) => ({
    ...toProject(r),
    runs: (Array.isArray(r.runs) ? r.runs : []) as RunSummary[],
    prepare: undefined,
  })) as ProjectSummary[];
}

export async function getProjectDb(id: string): Promise<Project | null> {
  await ensureSchema();
  const q = sql();
  const rows = (await q`select * from projects where id = ${id}`) as unknown as Row[];
  return rows[0] ? toProject(rows[0]) : null;
}

export async function getProjectByTokenDb(token: string): Promise<Project | null> {
  await ensureSchema();
  const q = sql();
  const rows = (await q`select * from projects where share_token = ${token}`) as unknown as Row[];
  return rows[0] ? toProject(rows[0]) : null;
}

export async function saveProjectDb(p: Project): Promise<Project> {
  await ensureSchema();
  const q = sql();
  const runs = JSON.stringify(p.runs ?? []);
  // A save that does not carry a checklist must not erase one already stored.
  // Only an explicit record — which a reset still is, with empty answers —
  // replaces what is there.
  const prepare = p.prepare ? JSON.stringify(p.prepare) : null;
  const rows = (await q`
    insert into projects (
      id, name, client, location, kind, status, capacity_note,
      marketing_contact, notes, created_at, updated_at, runs, share_token, prepare
    ) values (
      ${p.id}, ${p.name}, ${p.client}, ${p.location}, ${p.kind}, ${p.status}, ${p.capacityNote},
      ${p.marketingContact}, ${p.notes}, ${p.createdAt}, now(), ${runs}::jsonb, ${p.shareToken ?? null},
      ${prepare}::jsonb
    )
    on conflict (id) do update set
      name = excluded.name,
      client = excluded.client,
      location = excluded.location,
      kind = excluded.kind,
      status = excluded.status,
      capacity_note = excluded.capacity_note,
      marketing_contact = excluded.marketing_contact,
      notes = excluded.notes,
      updated_at = now(),
      runs = excluded.runs,
      share_token = coalesce(excluded.share_token, projects.share_token),
      prepare = coalesce(excluded.prepare, projects.prepare)
    returning *
  `) as unknown as Row[];
  return toProject(rows[0]);
}

export async function deleteProjectDb(id: string): Promise<void> {
  await ensureSchema();
  const q = sql();
  await q`delete from projects where id = ${id}`;
}

export async function setShareTokenDb(id: string, token: string | null): Promise<void> {
  await ensureSchema();
  const q = sql();
  await q`update projects set share_token = ${token}, updated_at = now() where id = ${id}`;
}

/** Connectivity probe used by /api/health. */
export async function ping(): Promise<{ ok: boolean; error?: string; projects?: number }> {
  try {
    await ensureSchema();
    const q = sql();
    const rows = (await q`select count(*)::int as n from projects`) as unknown as { n: number }[];
    return { ok: true, projects: rows[0]?.n ?? 0 };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}
