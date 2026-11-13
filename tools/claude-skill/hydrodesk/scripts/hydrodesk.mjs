#!/usr/bin/env node
/**
 * HydroDesk command line, for Claude Code sessions and scripts.
 *
 * Talks to the HydroDesk web app's API with a personal API token. The token is
 * created on this machine by `login`, approved by the user in the browser, and
 * kept in ~/.hydrodesk/config.json. It is never printed.
 *
 * Node 18+, no dependencies. Run `node hydrodesk.mjs help` for the commands.
 */
import { createHash, randomBytes } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir, hostname } from "node:os";
import { dirname, join } from "node:path";

const DEFAULT_URL = "https://hyrodesk-6gi9.vercel.app";
const CONFIG = process.env.HYDRODESK_CONFIG || join(homedir(), ".hydrodesk", "config.json");
const IDR_PER_USD = 16300;

/* ------------------------------------------------------------------ helpers */

function readConfig() {
  try { return JSON.parse(readFileSync(CONFIG, "utf8")); } catch { return {}; }
}
function writeConfig(c) {
  mkdirSync(dirname(CONFIG), { recursive: true });
  writeFileSync(CONFIG, JSON.stringify(c, null, 2));
}
const baseUrl = (c = readConfig()) => (process.env.HYDRODESK_URL || c.url || DEFAULT_URL).replace(/\/+$/, "");
const sha256 = (s) => createHash("sha256").update(s).digest("hex");
const newId = () => `${Date.now().toString(36)}-${randomBytes(4).toString("hex")}`;
const fail = (msg) => { console.error(`ERROR: ${msg}`); process.exit(1); };

function parseArgs(argv) {
  const pos = [];
  const opt = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith("--")) {
      const k = a.slice(2);
      const v = argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[++i] : true;
      opt[k] = v;
    } else pos.push(a);
  }
  return { pos, opt };
}

async function api(path, { method = "GET", body, auth = true } = {}) {
  const c = readConfig();
  const headers = { "content-type": "application/json" };
  if (auth) {
    if (!c.token) fail("Not connected. Run: node hydrodesk.mjs login");
    headers.authorization = `Bearer ${c.token}`;
  }
  let r;
  try {
    r = await fetch(baseUrl(c) + path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  } catch (e) {
    fail(`Cannot reach ${baseUrl(c)}: ${e.message}`);
  }
  const text = await r.text();
  let json;
  try { json = text ? JSON.parse(text) : {}; } catch { json = { error: text.slice(0, 300) }; }
  if (!r.ok) {
    if (r.status === 401) fail("HydroDesk refused the token (revoked or expired). Run: node hydrodesk.mjs login");
    fail(`${method} ${path} -> ${r.status}: ${json.error ?? text.slice(0, 300)}`);
  }
  return json;
}

const readJson = (file) => {
  if (!file) fail("A JSON file is required.");
  try { return JSON.parse(readFileSync(file, "utf8")); } catch (e) { fail(`Cannot read ${file}: ${e.message}`); }
};
const out = (obj, file) => {
  const s = JSON.stringify(obj, null, 2);
  if (file && file !== true) { writeFileSync(file, s); console.log(`Written: ${file}`); } else console.log(s);
};
const f = (v, dp = 1) => (Number.isFinite(v) ? v.toLocaleString("en-US", { maximumFractionDigits: dp, minimumFractionDigits: dp }) : "-");
const pad = (s, n) => String(s).padEnd(n).slice(0, n);

/* ------------------------------------------------------------------ connect */

async function login(opt) {
  const c = readConfig();
  if (opt.url) c.url = String(opt.url);
  const token = `hdt_${randomBytes(32).toString("base64url")}`;
  const label = String(opt.label || `Claude Code on ${hostname()}`);
  const start = await api("/api/cli/start", { method: "POST", body: { tokenHash: sha256(token), label }, auth: false });
  c.pending = { code: start.code, token, label, expiresAt: Date.now() + start.expiresInSeconds * 1000 };
  writeConfig(c);
  console.log("To connect this machine to HydroDesk, open this link while signed in, and approve:");
  console.log(`  ${start.url}`);
  console.log(`  Code: ${start.code}`);
  if (opt["no-wait"]) { console.log("Then run: node hydrodesk.mjs wait"); return; }
  await wait();
}

async function wait() {
  const c = readConfig();
  const p = c.pending;
  if (!p) fail("No pending login. Run: node hydrodesk.mjs login");
  process.stdout.write("Waiting for approval");
  while (Date.now() < p.expiresAt) {
    const s = await api("/api/cli/status", { method: "POST", body: { code: p.code, tokenHash: sha256(p.token) }, auth: false });
    if (s.status === "approved") {
      const n = readConfig();
      n.token = p.token;
      n.label = p.label;
      n.connectedAt = new Date().toISOString();
      delete n.pending;
      writeConfig(n);
      const me = await api("/api/auth/me");
      console.log(`\nConnected as ${me.user.displayName} (${me.user.username}) at ${baseUrl(n)}.`);
      return;
    }
    if (s.status === "expired" || s.status === "unknown") break;
    process.stdout.write(".");
    await new Promise((r) => setTimeout(r, 3000));
  }
  console.log("\nNot approved in time. Run login again.");
  process.exit(2);
}

async function whoami() {
  const c = readConfig();
  if (!c.token) { console.log(`Not connected. HydroDesk: ${baseUrl(c)}`); return; }
  const me = await api("/api/auth/me");
  if (!me.user) fail("Token not accepted. Run login again.");
  console.log(`${me.user.displayName} (${me.user.username}) at ${baseUrl(c)} via "${c.label}".`);
}

async function logout() {
  const c = readConfig();
  if (c.token) await api("/api/tokens?self=1", { method: "DELETE" }).catch(() => {});
  delete c.token; delete c.pending; delete c.label;
  writeConfig(c);
  console.log("Disconnected: token revoked and forgotten.");
}

/* ------------------------------------------------------------------ catalog */

async function catalog(what, opt) {
  const cat = await api("/api/catalog");
  if (opt.json) return out(what ? cat[{ units: "units", templates: "templates", presets: "feedPresets", standards: "standards" }[what]] : cat);
  if (!what || what === "units") {
    console.log("UNITS (type: label [category] in -> outlets)");
    for (const u of cat.units) console.log(`  ${pad(u.type, 14)} ${pad(u.label, 44)} [${u.category}] ${u.inlets} -> ${u.outlets.join(", ") || "(sink)"}${u.outletsDependOnParams ? " *" : ""}`);
    console.log("  * outlets depend on parameters (tank outletCount). Use `unit <type>` for parameters.");
  }
  if (!what || what === "templates") {
    console.log("TEMPLATES");
    for (const t of cat.templates) console.log(`  ${pad(t.key, 22)} ${t.name}`);
  }
  if (!what || what === "presets") {
    console.log("FEED PRESETS");
    for (const p of cat.feedPresets) console.log(`  ${pad(p.key, 22)} ${p.label}`);
  }
  if (!what || what === "standards") {
    console.log("STANDARDS (key: name)");
    for (const s of cat.standards) console.log(`  ${pad(s.key, 22)} ${s.name}${s.checkable ? "" : "  (not machine-checkable)"}`);
  }
}

async function unit(type) {
  const cat = await api("/api/catalog");
  const u = cat.units.find((x) => x.type === type);
  if (!u) fail(`No unit type "${type}". Run: catalog units`);
  console.log(`${u.type} — ${u.label} [${u.category}]\n${u.description}\nInlets: ${u.inlets}   Outlets: ${u.outlets.join(", ") || "(sink)"}`);
  console.log("Parameters (key = default  unit  [range]  — help):");
  for (const p of u.params) {
    const range = p.options ? `{${p.options.join("|")}}` : p.min != null ? `[${p.min}..${p.max}]` : "";
    console.log(`  ${pad(p.key, 18)} = ${pad(JSON.stringify(u.defaults[p.key]), 10)} ${pad(p.unit ?? "", 12)} ${range}${p.help ? `  — ${p.help}` : ""}`);
  }
}

/* ------------------------------------------------------------------ projects */

async function projects(opt) {
  const q = opt.owner ? `&owner=${encodeURIComponent(opt.owner)}` : "";
  const list = await api(`/api/projects?summary=1${q}`);
  if (opt.json) return out(list);
  if (list.length === 0) { console.log("No projects."); return; }
  for (const p of list) console.log(`  ${pad(p.id, 28)} ${pad(p.name, 52)} ${pad(p.status, 15)} ${p.runs.length} run(s)${p.access === "viewer" ? "  [view only]" : ""}`);
}

async function workspaces() {
  const list = await api("/api/workspace/shared");
  if (list.length === 0) { console.log("No other workspaces are open to you."); return; }
  for (const w of list) console.log(`  ${pad(w.id, 18)} ${pad(w.displayName, 30)} ${w.username}  ${w.projects} project(s)  [view only]`);
  console.log("List one with: projects --owner <id>");
}

async function project(id, opt) {
  const p = await api(`/api/projects/${encodeURIComponent(id)}`);
  if (opt.json) return out(p);
  console.log(`${p.name}  (${p.id})${p.access === "viewer" ? `  [view only, owner ${p.ownerName}]` : ""}`);
  console.log(`  ${[p.client, p.location, p.kind, p.status].filter(Boolean).join(" · ")}`);
  if (p.capacityNote) console.log(`  Capacity: ${p.capacityNote}`);
  if (p.notes) console.log(`  Notes: ${p.notes.split("\n").join("\n         ")}`);
  console.log(`  ${baseUrl()}/projects/${p.id}`);
  console.log(`Runs (${p.runs.length}):`);
  p.runs.forEach((r, i) => {
    const s = r.result?.summary ?? {};
    console.log(`  [${i}] ${pad(r.id, 22)} ${pad(r.name, 50)} ${pad(r.verdict ?? "", 13)} ${f(s.productFlow, 0)} m3/h  rec ${f(s.recoveryPct)} %  ${f(s.secKWhPerM3, 2)} kWh/m3`);
  });
}

async function run(projectId, which, opt) {
  const p = await api(`/api/projects/${encodeURIComponent(projectId)}`);
  const r = /^\d+$/.test(which) ? p.runs[Number(which)] : p.runs.find((x) => x.id === which || x.name === which);
  if (!r) fail(`No run "${which}" in ${p.name}.`);
  out(opt.full ? r : r.flowsheet, opt.out);
}

async function newProject(opt) {
  if (!opt.name) fail("--name is required.");
  const now = new Date().toISOString();
  const p = {
    id: newId(), name: String(opt.name), client: String(opt.client ?? ""), location: String(opt.location ?? ""),
    kind: String(opt.kind ?? "WTP"), status: String(opt.status ?? "data-collection"),
    capacityNote: String(opt.capacity ?? ""), marketingContact: String(opt.marketing ?? ""),
    notes: String(opt.notes ?? ""), createdAt: now, updatedAt: now, runs: [],
  };
  const saved = await api("/api/projects", { method: "POST", body: p });
  console.log(`Created ${saved.name}: ${saved.id}\n  ${baseUrl()}/projects/${saved.id}`);
}

/* ------------------------------------------------------------------ simulate */

function summarise(sim, opt = {}) {
  const r = sim.result;
  const s = r.summary;
  console.log(`Converged: ${sim.converged ? "yes" : "NO"}   Feed ${f(sim.flowsheet.feed.flow)} m3/h   Product ${f(s.productFlow)} m3/h   Recovery ${f(s.recoveryPct)} %`);
  console.log(`Power ${f(s.totalPowerKW, 0)} kW   SEC ${f(s.secKWhPerM3, 3)} kWh/m3   OPEX ${f(s.opexUSDPerM3, 3)} USD/m3 (Rp ${f(s.opexUSDPerM3 * IDR_PER_USD, 0)}/m3)`);
  const cx = sim.capex;
  const b = sim.benchmark;
  if (b) {
    // For SWRO plants CCEPC's own reference figures come first; the factored estimate is the cross-check.
    console.log(`CCEPC SWRO benchmark: CAPEX USD ${f(b.capexUSD.low / 1e6, 1)}-${f(b.capexUSD.high / 1e6, 1)} M (Rp ${f(b.capexUSD.low * IDR_PER_USD / 1e9, 0)}-${f(b.capexUSD.high * IDR_PER_USD / 1e9, 0)} miliar; RMB 6,000-7,000 per m3/d, excl. intake/discharge works and piling); OPEX USD 0.60-0.70/m3 (model itemised ${f(b.modelOpexUSDPerM3, 3)})`);
    console.log(`  land ${f(b.landM2.low, 0)} m2; break-even USD ${f(b.breakEvenUSDPerM3.low, 2)}-${f(b.breakEvenUSDPerM3.high, 2)}/m3 (8 %, 20 y); ` +
      b.payback.map((p) => `payback at ${f(p.tariff, 2)}: ${p.years ? `${f(p.years.low, 1)}-${f(p.years.high, 1)} y` : "never"}`).join("; ") +
      `; EPC ${b.epcMonths[0]}-${b.epcMonths[1]} months; supports ~${f(b.supportsMwIt.low, 0)}-${f(b.supportsMwIt.high, 0)} MW IT if used as cooling make-up`);
  }
  console.log(`${b ? "Factored cross-check" : "Indicative CAPEX"}: USD ${f(cx.totalUSD / 1e6, 2)} M (Rp ${f(cx.totalUSD * IDR_PER_USD / 1e9, 1)} miliar), range ${f(cx.lowUSD / 1e6, 1)}-${f(cx.highUSD / 1e6, 1)} M; process equipment USD ${f(cx.equipmentUSD / 1e6, 2)} M; ${f(cx.usdPerM3d, 0)} USD per m3/d`);
  for (const p of r.productStreams) {
    const st = p.stream;
    console.log(`Product "${p.label}": ${f(st.flow)} m3/h, TDS ${f(st.c.TDS)} mg/L, pH ${f(st.pH, 2)}, Cl ${f(st.c.Cl)}, Na ${f(st.c.Na)}, Ca ${f(st.c.Ca)}, HCO3 ${f(st.c.HCO3)}, TSS ${f(st.c.TSS, 2)}, ${f(st.extras.turbidityNTU, 2)} NTU`);
  }
  for (const w of r.wasteStreams.filter((x) => x.stream.flow > 1e-6)) {
    console.log(`Waste "${w.label}": ${f(w.stream.flow)} m3/h, TDS ${f(w.stream.c.TDS, 0)} mg/L, TSS ${f(w.stream.c.TSS, 0)} mg/L`);
  }
  for (const c of sim.compliance) {
    for (const p of c.products) {
      const verify = p.rows.filter((x) => x.notModelled).map((x) => x.label);
      console.log(`Check ${c.standard} on "${p.label}": ${p.failed.length ? `FAILS ${p.rows.filter((x) => p.failed.includes(x.label)).map((x) => `${x.label} ${x.actualText} (limit ${x.limitText})`).join("; ")}` : "all modelled parameters pass"}${verify.length ? `; not modelled, verify: ${verify.join(", ")}` : ""}`);
    }
  }
  for (const d of sim.discharge) {
    console.log(`Discharge "${d.label}": ${d.failed.length ? `FAILS ${d.rows.filter((x) => d.failed.includes(x.label)).map((x) => `${x.label} ${x.actualText} (limit ${x.limitText})`).join("; ")}` : "passes"}`);
  }
  const warn = s.warnings ?? [];
  if (warn.length) {
    console.log(`Warnings (${warn.length}):`);
    for (const w of warn.slice(0, 10)) console.log(`  - ${typeof w === "string" ? w : JSON.stringify(w)}`.slice(0, 260));
  }
  if (!opt.quiet) {
    console.log("Units (label [type]: in -> outlets, kW):");
    for (const n of r.nodes) {
      const outs = Object.entries(n.outlets).map(([k, v]) => `${k} ${f(v.flow)}`).join(", ");
      console.log(`  ${pad(n.label, 36)} [${pad(n.type, 11)}] ${pad(f(n.inlet.flow), 9)} -> ${pad(outs, 44)} ${f(n.aux.powerKW, 0)} kW`);
      for (const note of n.aux.notes ?? []) console.log(`      note: ${note}`.slice(0, 240));
    }
  }
}

async function simulate(file, opt) {
  const flowsheet = readJson(file);
  const body = { flowsheet };
  if (opt.check) body.check = String(opt.check).split(",");
  if (opt.discharge) body.dischargeCheck = String(opt.discharge);
  const sim = await api("/api/simulate", { method: "POST", body });
  if (opt.out) out(sim, opt.out);
  if (opt["save-flowsheet"]) out(sim.flowsheet, opt["save-flowsheet"]);
  if (opt.json && !opt.out) return out(sim);
  summarise(sim, { quiet: !!opt.quiet });
  return sim;
}

async function saveRun(projectId, file, opt) {
  if (!opt.name) fail("--name is required.");
  const flowsheet = readJson(file);
  const body = { flowsheet };
  if (opt.check) body.check = String(opt.check).split(",");
  if (opt.discharge) body.dischargeCheck = String(opt.discharge);
  const sim = await api("/api/simulate", { method: "POST", body });
  const p = await api(`/api/projects/${encodeURIComponent(projectId)}`);
  if (p.access === "viewer") fail(`"${p.name}" belongs to ${p.ownerName}: view only, a run cannot be saved into it.`);
  const anyFail = sim.compliance.some((c) => c.products.some((x) => x.failed.length));
  const verdict = opt.verdict ? String(opt.verdict) : anyFail ? "not-feasible" : "conditional";
  const runId = newId();
  p.runs = [{
    id: runId, name: String(opt.name), createdAt: new Date().toISOString(),
    flowsheet: sim.flowsheet, result: sim.result, verdict, engineerNote: String(opt.note ?? ""),
  }, ...p.runs];
  if (p.status === "data-collection") p.status = "simulation";
  await api("/api/projects", { method: "POST", body: p });
  summarise(sim, { quiet: true });
  console.log(`Saved run "${opt.name}" (${verdict}) to ${p.name}.\n  ${baseUrl()}/projects/${p.id}/runs`);
}

/* ------------------------------------------------------------------ assets */

async function template(key, opt) {
  out(await api(`/api/catalog/template?key=${encodeURIComponent(key)}`), opt.out);
}

async function preset(key, opt) {
  const cat = await api("/api/catalog");
  const p = cat.feedPresets.find((x) => x.key === key);
  if (!p) fail(`No preset "${key}". Run: catalog presets`);
  out(p.spec, opt.out);
}

/* ------------------------------------------------------------------ main */

const HELP = `HydroDesk CLI — config ${CONFIG}
  login [--url URL] [--label NAME] [--no-wait]   connect this machine (approve the link in the browser)
  wait                                           keep waiting for a login started with --no-wait
  whoami | logout
  catalog [units|templates|presets|standards] [--json]
  unit <type>                                    a unit's ports, parameters and defaults
  template <key> [--out file.json]               a template, as a complete flowsheet
  preset <key> [--out file.json]                 a feed water preset (FeedSpec)
  projects [--owner ID] [--json]                 my projects, or a workspace opened to me
  workspaces                                     workspaces opened to me (view only)
  project <id> [--json]                          details and runs
  run <projectId> <index|runId> [--out f] [--full]   a saved run's flowsheet
  new-project --name N [--client C] [--location L] [--kind K] [--capacity T] [--notes T]
  simulate <flowsheet.json> [--check std1,std2] [--discharge std] [--out sim.json] [--save-flowsheet f] [--quiet] [--json]
  save-run <projectId> <flowsheet.json> --name N [--note T] [--verdict feasible|conditional|not-feasible] [--check ..] [--discharge std]`;

const [cmd, ...rest] = process.argv.slice(2);
const { pos, opt } = parseArgs(rest);
const commands = {
  login: () => login(opt), wait, whoami, logout,
  catalog: () => catalog(pos[0], opt), unit: () => unit(pos[0]),
  template: () => template(pos[0], opt), preset: () => preset(pos[0], opt),
  projects: () => projects(opt), workspaces, project: () => project(pos[0], opt),
  run: () => run(pos[0], pos[1], opt), "new-project": () => newProject(opt),
  simulate: () => simulate(pos[0], opt), "save-run": () => saveRun(pos[0], pos[1], opt),
  help: () => console.log(HELP),
};
if (!cmd || !commands[cmd]) { console.log(HELP); process.exit(cmd ? 1 : 0); }
await commands[cmd]();
