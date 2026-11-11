import "server-only";
import { createHash, randomBytes, scrypt as scryptCb, timingSafeEqual } from "crypto";
import { cookies, headers } from "next/headers";
import { db } from "./pg";

/**
 * Accounts, sessions and workspace access, for the cloud deployment.
 *
 * Before this, the cloud database had no notion of who was asking: anyone with
 * the address could list, change and delete every project in it. Now every
 * project belongs to an account, and an account sees only its own work unless
 * another account's owner has opened theirs with a workspace password.
 *
 * Built on the database the app already has and on Node's own crypto, so there
 * is no identity provider to sign up for and nothing to configure: passwords are
 * stored as scrypt hashes, sessions as the SHA-256 of a random token held in an
 * HttpOnly cookie, and wrong-password attempts are counted so a short workspace
 * password cannot be tried from a list.
 */

export const SESSION_COOKIE = "hd_session";
const SESSION_DAYS = 30;

export interface SessionUser {
  id: string;
  username: string;
  displayName: string;
  isAdmin: boolean;
  /** Signed in with an API token (Claude Code, scripts) rather than a browser session. */
  viaToken?: boolean;
  tokenId?: string;
}

export class HttpError extends Error {
  constructor(public status: number, message: string, public extra: Record<string, unknown> = {}) {
    super(message);
  }
}

/* ------------------------------------------------------------------ schema */

let authReady = false;

export async function ensureAuthSchema(): Promise<void> {
  if (authReady) return;
  const q = db();
  await q`
    create table if not exists users (
      id             text primary key,
      username       text not null unique,
      display_name   text not null default '',
      pass_hash      text not null,
      is_admin       boolean not null default false,
      access_hash    text,
      access_version integer not null default 0,
      created_at     timestamptz not null default now()
    )
  `;
  await q`
    create table if not exists sessions (
      token_hash text primary key,
      user_id    text not null references users(id) on delete cascade,
      expires_at timestamptz not null,
      created_at timestamptz not null default now()
    )
  `;
  // A grant records that a viewer once gave the right workspace password. It is
  // only good for the password version it was made under, so changing the
  // password closes every grant at once without touching this table.
  await q`
    create table if not exists workspace_grants (
      viewer_id      text not null references users(id) on delete cascade,
      owner_id       text not null references users(id) on delete cascade,
      access_version integer not null,
      created_at     timestamptz not null default now(),
      primary key (viewer_id, owner_id)
    )
  `;
  await q`
    create table if not exists auth_attempts (
      key          text primary key,
      failures     integer not null default 0,
      window_start timestamptz not null default now()
    )
  `;
  await q`create table if not exists app_settings (key text primary key, value text not null)`;
  // API tokens for Claude Code and scripts. Only the hash is stored; the token
  // itself is generated on the user's machine and never sent anywhere but here.
  await q`
    create table if not exists api_tokens (
      id           text primary key,
      user_id      text not null references users(id) on delete cascade,
      token_hash   text not null unique,
      label        text not null default '',
      created_at   timestamptz not null default now(),
      last_used_at timestamptz
    )
  `;
  // A pending "connect this machine" request: the machine holds the token and
  // sends its hash; a signed-in user approves the short code in the browser.
  await q`
    create table if not exists cli_requests (
      code        text primary key,
      token_hash  text not null,
      label       text not null default '',
      created_at  timestamptz not null default now(),
      expires_at  timestamptz not null,
      approved_by text
    )
  `;
  await q`alter table projects add column if not exists owner_id text`;
  await q`create index if not exists projects_owner_idx on projects (owner_id, updated_at desc)`;
  authReady = true;
}

/* --------------------------------------------------------------- passwords */

const SCRYPT = { N: 16384, r: 8, p: 1, keylen: 64 };

function scrypt(password: string, salt: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scryptCb(password, salt, SCRYPT.keylen, { N: SCRYPT.N, r: SCRYPT.r, p: SCRYPT.p }, (err, key) => {
      if (err) reject(err); else resolve(key);
    });
  });
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await scrypt(password, salt);
  return `scrypt$${SCRYPT.N}$${SCRYPT.r}$${SCRYPT.p}$${salt.toString("base64")}$${key.toString("base64")}`;
}

export async function verifyPassword(password: string, stored: string | null): Promise<boolean> {
  if (!stored) return false;
  const parts = stored.split("$");
  if (parts.length !== 6 || parts[0] !== "scrypt") return false;
  const salt = Buffer.from(parts[4], "base64");
  const expected = Buffer.from(parts[5], "base64");
  const key = await scrypt(password, salt);
  return key.length === expected.length && timingSafeEqual(key, expected);
}

export function validateUsername(u: unknown): string {
  const s = String(u ?? "").trim().toLowerCase();
  if (!/^[a-z0-9._-]{3,32}$/.test(s)) {
    throw new HttpError(400, "Username: 3-32 characters, letters, digits, dot, dash or underscore.");
  }
  return s;
}

export function validatePassword(p: unknown, what = "Password"): string {
  const s = String(p ?? "");
  if (s.length < 8) throw new HttpError(400, `${what} must be at least 8 characters.`);
  if (s.length > 200) throw new HttpError(400, `${what} is too long.`);
  return s;
}

/* ---------------------------------------------------------------- throttle */

const MAX_FAILURES = 8;
const WINDOW_MIN = 15;

/** Refuses the attempt if this key has failed too often in the current window. */
export async function checkThrottle(key: string): Promise<void> {
  const q = db();
  const rows = (await q`
    select failures, extract(epoch from (now() - window_start))::int as age
      from auth_attempts where key = ${key}
  `) as { failures: number; age: number }[];
  const r = rows[0];
  if (r && r.age < WINDOW_MIN * 60 && r.failures >= MAX_FAILURES) {
    const wait = Math.ceil((WINDOW_MIN * 60 - r.age) / 60);
    throw new HttpError(429, `Too many wrong attempts. Try again in ${wait} minute${wait === 1 ? "" : "s"}.`);
  }
}

export async function recordFailure(key: string): Promise<void> {
  const q = db();
  await q`
    insert into auth_attempts (key, failures, window_start) values (${key}, 1, now())
    on conflict (key) do update set
      failures = case when auth_attempts.window_start < now() - make_interval(mins => ${WINDOW_MIN})
                      then 1 else auth_attempts.failures + 1 end,
      window_start = case when auth_attempts.window_start < now() - make_interval(mins => ${WINDOW_MIN})
                          then now() else auth_attempts.window_start end
  `;
}

export async function clearFailures(key: string): Promise<void> {
  const q = db();
  await q`delete from auth_attempts where key = ${key}`;
}

export async function clientIp(): Promise<string> {
  const h = await headers();
  return (h.get("x-forwarded-for") ?? "").split(",")[0].trim() || h.get("x-real-ip") || "unknown";
}

/* ---------------------------------------------------------------- sessions */

const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");

export async function startSession(userId: string): Promise<void> {
  const token = randomBytes(32).toString("base64url");
  const q = db();
  await q`
    insert into sessions (token_hash, user_id, expires_at)
    values (${sha256(token)}, ${userId}, now() + make_interval(days => ${SESSION_DAYS}))
  `;
  // Old sessions are cleared here rather than by a scheduled job.
  await q`delete from sessions where expires_at < now()`;
  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_DAYS * 24 * 3600,
  });
}

export async function endSession(): Promise<void> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (token) {
    const q = db();
    await q`delete from sessions where token_hash = ${sha256(token)}`;
  }
  store.delete(SESSION_COOKIE);
}

export async function currentUser(): Promise<SessionUser | null> {
  await ensureAuthSchema();
  const q = db();
  // An API token in the Authorization header, from Claude Code or a script.
  const auth = (await headers()).get("authorization") ?? "";
  if (auth.toLowerCase().startsWith("bearer ")) {
    const raw = auth.slice(7).trim();
    const rows = (await q`
      select t.id as token_id, u.id, u.username, u.display_name, u.is_admin
        from api_tokens t join users u on u.id = t.user_id
       where t.token_hash = ${sha256(raw)}
    `) as { token_id: string; id: string; username: string; display_name: string; is_admin: boolean }[];
    const r = rows[0];
    if (!r) return null;
    await q`update api_tokens set last_used_at = now() where id = ${r.token_id}`;
    return { id: r.id, username: r.username, displayName: r.display_name, isAdmin: r.is_admin, viaToken: true, tokenId: r.token_id };
  }
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const rows = (await q`
    select u.id, u.username, u.display_name, u.is_admin
      from sessions s join users u on u.id = s.user_id
     where s.token_hash = ${sha256(token)} and s.expires_at > now()
  `) as { id: string; username: string; display_name: string; is_admin: boolean }[];
  const r = rows[0];
  return r ? { id: r.id, username: r.username, displayName: r.display_name, isAdmin: r.is_admin } : null;
}

/**
 * The signed-in user, or a 401 that tells the client whether setup is still to do.
 *
 * An API token is accepted only where a route says so. Reading projects,
 * simulating and saving a run are open to Claude Code; deleting, sharing,
 * passwords, workspace access and administration stay with a person in a
 * browser, so a token on a laptop can never do more damage than overwrite its
 * owner's own runs.
 */
export async function requireUser(opts: { allowToken?: boolean } = {}): Promise<SessionUser> {
  const u = await currentUser();
  if (u && u.viaToken && !opts.allowToken) {
    throw new HttpError(403, "Not available to API tokens. Do this in HydroDesk in the browser.");
  }
  if (u) return u;
  throw new HttpError(401, "Sign in required.", { needsSetup: await needsSetup() });
}

/** sha256 hex of a token, as stored. */
export function tokenHash(raw: string): string {
  return sha256(raw);
}

export async function needsSetup(): Promise<boolean> {
  await ensureAuthSchema();
  const q = db();
  const rows = (await q`select exists(select 1 from users) as any`) as { any: boolean }[];
  return !rows[0]?.any;
}

/* ------------------------------------------------------------------- access */

/** True when the viewer may read the owner's workspace: it is theirs, or they hold a current grant. */
export async function canView(viewerId: string, ownerId: string | null): Promise<boolean> {
  if (!ownerId) return false;
  if (viewerId === ownerId) return true;
  const q = db();
  const rows = (await q`
    select 1 from workspace_grants g join users u on u.id = g.owner_id
     where g.viewer_id = ${viewerId} and g.owner_id = ${ownerId}
       and u.access_hash is not null and g.access_version = u.access_version
  `) as unknown[];
  return rows.length > 0;
}

export function newUserId(): string {
  return `u-${randomBytes(9).toString("base64url")}`;
}

/** Turns any thrown error into a JSON response with the right status. */
export function errorResponse(e: unknown): Response {
  if (e instanceof HttpError) {
    return Response.json({ error: e.message, ...e.extra }, { status: e.status, headers: { "cache-control": "no-store" } });
  }
  return Response.json({ error: (e as Error).message }, { status: 500, headers: { "cache-control": "no-store" } });
}
