import { writeFileSync } from "fs";
import { simulate } from "../src/lib/engine/solver";
import { hardnessAsCaCO3, alkalinityAsCaCO3 } from "../src/lib/engine/stream";
import { TEMPLATES } from "../src/lib/engine/templates";
import { Flowsheet } from "../src/lib/engine/types";

/** Swap the RO block for NF, so the "why not nanofiltration" answer is measured. */
function withMembrane(type: string, share: number): Flowsheet {
  const fs = JSON.parse(JSON.stringify(
    TEMPLATES.find((t) => t.key === "wtp-sagara-split")!.make())) as Flowsheet;
  for (const nd of fs.nodes) {
    if (nd.type === "ro" || nd.type === "nf") nd.type = type;
    if (nd.type === "rawtank" && nd.params.outletCount === 2) nd.params.split2 = share;
  }
  return fs;
}
const round = (v: number, dp = 1) => Math.round(v * 10 ** dp) / 10 ** dp;

const cases = [
  { label: "RO air payau", type: "ro" },
  { label: "Nanofiltrasi", type: "nf" },
].map((c) => {
  // Find the share each technology needs to reach TDS 300.
  let share = 5, prod = null as ReturnType<typeof pick> | null;
  for (let s = 5; s <= 75; s += 0.5) {
    const r = simulate(withMembrane(c.type, s));
    const p = r.productStreams[0]?.stream;
    if (!p) break;
    share = s; prod = pick(p, r);
    if (p.c.TDS <= 300) break;
  }
  return { ...c, share: round(share, 1), ...prod! };
});

function pick(p: { c: Record<string, number>; pH: number }, r: ReturnType<typeof simulate>) {
  const s = r.summary;
  return {
    TDS: round(p.c.TDS, 1),
    hardness: round(hardnessAsCaCO3(p as never), 0),
    alkalinity: round(alkalinityAsCaCO3(p as never), 0),
    Na: round(p.c.Na, 1), Cl: round(p.c.Cl, 1), SO4: round(p.c.SO4, 1),
    Ca: round(p.c.Ca, 1), Mg: round(p.c.Mg, 1),
    power_kW: round(s.totalPowerKW, 1),
    sec: round(s.secKWhPerM3, 3),
    recovery: round(s.recoveryPct, 1),
  };
}

/* Lime softening, by hand — the model has no unit that does exactly this. */
const alk0 = 130;                         // mg/L as CaCO3, assumption A1
const needTDS = 65;                       // 365 -> 300
const perMeq = 20.04 + 61.02;             // Ca + HCO3 removed per meq, mg/L
const meqNeeded = needTDS / perMeq;
const lime = {
  meqNeeded: round(meqNeeded, 2),
  limeDose_mgL: round(meqNeeded * 37.05, 1),          // Ca(OH)2 half-equivalent
  lime_kgd: round(meqNeeded * 37.05 * 205 * 24 / 1000, 0),
  // Each meq precipitated makes 2 meq of CaCO3: the water's Ca and the lime's.
  sludge_kgd: round(meqNeeded * 2 * 50.04 * 205 * 24 / 1000, 0),
  alkLeft: round(alk0 - meqNeeded * 50, 0),
  existingSludge_kgd: 157,
};

const out = { generated: new Date().toISOString(), membraneCases: cases, limeSoftening: lime };
writeFileSync("scripts/out/sagara-alt.json", JSON.stringify(out, null, 2));
for (const c of cases) {
  console.log(`${c.label}: porsi ${c.share}%  TDS ${c.TDS}  kesadahan ${c.hardness}  alkalinitas ${c.alkalinity}`);
  console.log(`   Na ${c.Na}  Cl ${c.Cl}  SO4 ${c.SO4}  Ca ${c.Ca}  Mg ${c.Mg}   SEC ${c.sec}  recovery ${c.recovery}%`);
}
console.log("\nPelunakan kapur:", JSON.stringify(lime));
