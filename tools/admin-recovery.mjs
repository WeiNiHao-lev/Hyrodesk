#!/usr/bin/env node
/**
 * HydroDesk account recovery, for the owner of the database.
 *
 * There is no e-mail behind HydroDesk accounts, so a forgotten password is reset
 * by an administrator from the account page. When the administrator is the one
 * who is locked out, the way back is the database itself, which only its owner
 * can reach. This script never connects to anything: it prints SQL to paste into
 * the Neon SQL Editor.
 *
 *   node tools/admin-recovery.mjs                 SQL that lists the accounts
 *   node tools/admin-recovery.mjs reset <user>    asks for a new password (hidden)
 *                                                 and prints the SQL that sets it
 *
 * The password is typed here, hashed here with the same scrypt settings the app
 * uses, and only the hash is printed. It never appears on screen or in a chat.
 */
import { randomBytes, scrypt } from "node:crypto";
import { createInterface } from "node:readline";

const [, , cmd, rawUser] = process.argv;

const LIST = `-- Accounts in this HydroDesk database
select username, display_name, is_admin, created_at,
       (select count(*) from projects p where p.owner_id = u.id) as projects
  from users u order by created_at;`;

if (!cmd) {
  console.log(LIST);
  process.exit(0);
}
if (cmd !== "reset" || !rawUser) {
  console.log("Usage: node tools/admin-recovery.mjs [reset <username>]");
  process.exit(1);
}

const username = String(rawUser).trim().toLowerCase();
if (!/^[a-z0-9._-]{3,32}$/.test(username)) {
  console.error("Usernames are 3-32 characters: letters, digits, dot, dash or underscore.");
  process.exit(1);
}

// One reader for both questions. On a terminal nothing typed is echoed: only
// the prompts are written. From a pipe the two lines are read in turn. Prompts
// go to stderr, so what lands on stdout is the SQL and nothing else, and can be
// copied or redirected whole.
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
  if (done) { console.error("\nNo input. Nothing printed."); process.exit(1); }
  return value;
}

const pw = await ask(`New sign-in password for ${username}: `);
const pw2 = await ask("Repeat it: ");
rl.close();
if (pw !== pw2) { console.error("The two passwords do not match. Nothing printed."); process.exit(1); }
if (pw.length < 8) { console.error("At least 8 characters. Nothing printed."); process.exit(1); }

// Same settings as src/lib/server/auth.ts: scrypt N=16384, r=8, p=1, 64-byte key, 16-byte salt.
const salt = randomBytes(16);
const key = await new Promise((res, rej) => scrypt(pw, salt, 64, { N: 16384, r: 8, p: 1 }, (e, k) => (e ? rej(e) : res(k))));
const hash = `scrypt$16384$8$1$${salt.toString("base64")}$${key.toString("base64")}`;

console.log(`
-- Paste into the Neon SQL Editor of the HydroDesk database and run.
-- 1. Check the account exists (expect one row):
select username, display_name, is_admin from users where username = '${username}';

-- 2. Set the new password, sign the account out everywhere, clear wrong-attempt counts:
update users set pass_hash = '${hash}' where username = '${username}';
delete from sessions where user_id = (select id from users where username = '${username}');
delete from auth_attempts where key = 'login:${username}';
`);
