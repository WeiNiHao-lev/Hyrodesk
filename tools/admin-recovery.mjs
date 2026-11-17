#!/usr/bin/env node
/**
 * HydroDesk account recovery, for the owner of the database.
 *
 * There is no e-mail behind HydroDesk accounts, so a forgotten password is reset
 * by an administrator from the account page. When the administrator is the one
 * who is locked out, the way back is the database itself, which only its owner
 * can reach.
 *
 * Two ways to use it:
 *
 *   Print SQL for the Neon SQL Editor (connects to nothing):
 *     node tools/admin-recovery.mjs                       list the accounts
 *     node tools/admin-recovery.mjs reset <user>          set a new password
 *
 *   Apply it directly, for when the Neon console is out of reach:
 *     node tools/admin-recovery.mjs list --apply
 *     node tools/admin-recovery.mjs reset <user> --apply
 *   asks for the database connection string (the DATABASE_URL of the Vercel
 *   project, under Settings > Environment Variables) without echoing it, or
 *   reads it from HYDRODESK_DATABASE_URL. Needs the repo's node_modules.
 *
 * Passwords and the connection string are typed into this terminal only, never
 * echoed and never printed. Only a scrypt hash, with the app's own settings,
 * ever leaves this machine.
 */
import { randomBytes, scrypt } from "node:crypto";
import { createInterface } from "node:readline";

const args = process.argv.slice(2);
const apply = args.includes("--apply");
const [cmd, rawUser] = args.filter((a) => a !== "--apply");

const LIST = `-- Accounts in this HydroDesk database
select username, display_name, is_admin, created_at,
       (select count(*) from projects p where p.owner_id = u.id) as projects
  from users u order by created_at;`;

const usage = () => {
  console.log("Usage: node tools/admin-recovery.mjs [list | reset <username>] [--apply]");
  process.exit(1);
};

if ((!cmd || cmd === "list") && !apply) { console.log(LIST); process.exit(0); }
if (cmd !== "list" && cmd !== "reset") usage();
if (cmd === "reset" && !rawUser) usage();

const username = cmd === "reset" ? String(rawUser).trim().toLowerCase() : "";
if (cmd === "reset" && !/^[a-z0-9._-]{3,32}$/.test(username)) {
  console.error("Usernames are 3-32 characters: letters, digits, dot, dash or underscore.");
  process.exit(1);
}

// One reader for every question. On a terminal nothing typed is echoed: only
// the prompts are written. From a pipe the lines are read in turn. Prompts go to
// stderr, so what lands on stdout is the SQL or the result and nothing else.
const tty = !!process.stdin.isTTY;
const rl = createInterface({ input: process.stdin, output: process.stderr, terminal: tty });
const prompts = new Set();
if (tty) rl._writeToOutput = (s) => { if (prompts.has(s)) rl.output.write(s); };
const lines = rl[Symbol.asyncIterator]();
async function ask(prompt) {
  prompts.add(prompt);
  rl.output.write(prompt);
  const { value, done } = await lines.next();
  if (tty) rl.output.write("\n");
  if (done) { console.error("\nNo input. Nothing done."); process.exit(1); }
  return value;
}

let connection = "";
if (apply) {
  connection = (process.env.HYDRODESK_DATABASE_URL || await ask("Paste the DATABASE_URL (hidden): ")).trim().replace(/^['"]|['"]$/g, "");
  if (!/^postgres(ql)?:\/\//.test(connection)) {
    rl.close();
    console.error("That does not look like a Postgres connection string (postgresql://...). Nothing done.");
    process.exit(1);
  }
}

let hash = "";
if (cmd === "reset") {
  const pw = await ask(`New sign-in password for ${username}: `);
  const pw2 = await ask("Repeat it: ");
  if (pw !== pw2) { rl.close(); console.error("The two passwords do not match. Nothing done."); process.exit(1); }
  if (pw.length < 8) { rl.close(); console.error("At least 8 characters. Nothing done."); process.exit(1); }
  // Same settings as src/lib/server/auth.ts: scrypt N=16384, r=8, p=1, 64-byte key, 16-byte salt.
  const salt = randomBytes(16);
  const key = await new Promise((res, rej) => scrypt(pw, salt, 64, { N: 16384, r: 8, p: 1 }, (e, k) => (e ? rej(e) : res(k))));
  hash = `scrypt$16384$8$1$${salt.toString("base64")}$${key.toString("base64")}`;
}
rl.close();

if (!apply) {
  console.log(`
-- Paste into the Neon SQL Editor of the HydroDesk database and run.
-- 1. Check the account exists (expect one row):
select username, display_name, is_admin from users where username = '${username}';

-- 2. Set the new password, sign the account out everywhere, clear wrong-attempt counts:
update users set pass_hash = '${hash}' where username = '${username}';
delete from sessions where user_id = (select id from users where username = '${username}');
delete from auth_attempts where key = 'login:${username}';
`);
  process.exit(0);
}

/* --------------------------------------------------------------- --apply */

const { neon } = await import("@neondatabase/serverless");
const sql = neon(connection);
const table = (rows) => {
  if (rows.length === 0) { console.log("(no accounts)"); return; }
  for (const r of rows) {
    console.log(`  ${String(r.username).padEnd(24)} ${String(r.display_name).padEnd(24)} ${r.is_admin ? "admin " : "member"}  ${new Date(r.created_at).toISOString().slice(0, 10)}  ${r.projects} project(s)`);
  }
};
try {
  const accounts = await sql`
    select username, display_name, is_admin, created_at,
           (select count(*)::int from projects p where p.owner_id = u.id) as projects
      from users u order by created_at`;
  console.log("Accounts in this HydroDesk database:");
  table(accounts);
  if (cmd === "list") process.exit(0);

  if (!accounts.some((a) => a.username === username)) {
    console.error(`\nNo account "${username}" here. Nothing changed. Use one of the usernames above.`);
    process.exit(1);
  }
  await sql.transaction([
    sql`update users set pass_hash = ${hash} where username = ${username}`,
    sql`delete from sessions where user_id = (select id from users where username = ${username})`,
    sql`delete from auth_attempts where key = ${`login:${username}`}`,
  ]);
  console.log(`\nDone. "${username}" has the new password, is signed out everywhere, and its wrong-attempt count is cleared.`);
} catch (e) {
  // Never echo the connection string back: report only what went wrong.
  console.error(`Could not reach the database: ${String(e?.message ?? e).replaceAll(connection, "<DATABASE_URL>")}`);
  process.exit(1);
}
