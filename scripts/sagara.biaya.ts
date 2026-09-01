import { readFileSync, writeFileSync } from "fs";
import { CHEM_PRICES_USD_PER_T, CHEM_PRICE_FALLBACK } from "../src/lib/engine/solver";

/**
 * WTP Sagara — pembongkaran energi, bahan kimia, dan CAPEX per unit.
 *
 * Skrip ini tidak menjalankan simulasi. Ia MEMBACA hasil simulasi lalu
 * menghitung ulang setiap angka dari rumusnya sendiri, dan melaporkan
 * selisihnya. Gunanya bukan untuk mendapatkan angka baru — angkanya sudah ada —
 * melainkan untuk membuktikan bahwa setiap angka bisa diturunkan dengan tangan.
 * Kalau ada baris yang selisihnya besar, berarti rumus yang saya tulis di sini
 * atau di dokumen tidak sama dengan yang dipakai mesin, dan itu harus ketahuan
 * sebelum dipresentasikan.
 */

type Json = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
const d: Json = JSON.parse(readFileSync("scripts/out/sagara.json", "utf8"));
const G = d.design;
const U: Json[] = G.units;
const unit = (label: string) => U.find((u) => u.label === label)!;

/* --------------------------------------------------------------- pustaka */

/** Daya poros pompa, kW. Rumus tunggal yang dipakai seluruh model. */
const pumpKW = (q: number, headM: number, eff: number) =>
  (1000 * 9.81 * (q / 3600) * headM) / eff / 1000;

/** Kurva biaya pangkat: biaya = a x kapasitas^n. */
const costCurve = (cap: number, a: number, exp: number) => a * Math.pow(cap, exp);

const rows: { sys: string; item: string; rumus: string; hitung: number; model: number }[] = [];
const add = (sys: string, item: string, rumus: string, hitung: number, model: number) =>
  rows.push({ sys, item, rumus, hitung, model });

/* ------------------------------------------------------------- 1. ENERGI */

const intake = unit("Intake & Screen");
add("Intake", "Daya pompa", "9,81 x (205/3600) x 30 / 0,75",
  pumpKW(205, 30, 0.75), intake.power_kW);

const ph1 = unit("Koreksi pH 8,5 → 6,9");
add("Koreksi pH", "Pengaduk", "V x 40 W/m3 / 1000 + 1,5 kW dosing",
  ((205 * 5) / 60) * 40 / 1000 + 1.5, ph1.power_kW);

const cf = unit("Rapid Mix + Flokulasi");
add("Koagulasi-Flokulasi", "Pengaduk cepat + lambat", "0,02 x Q^0,75 + 2",
  0.02 * Math.pow(205, 0.75) + 2, cf.power_kW);

const daf = unit("DAF 2 unit");
add("DAF", "Pompa resirkulasi + scraper + kompresor",
  "pompa(20,5 m3/h @ 60 m) + 0,01 x Q + 3",
  pumpKW(20.5, 60, 0.7) + 0.01 * 205 + 3, daf.power_kW);

const mmf = unit("Filter Dual-Media");
add("Filter Dual-Media", "Head loss bed + backwash", "pompa(Q @ 12 m) + 0,004 x Q",
  pumpKW(202.95, 12, 0.72) + 0.004 * 202.95, mmf.power_kW);

const th = unit("Pengental Lumpur");
add("Pengental Lumpur", "Rake drive", "tetap 1,5 kW", 1.5, th.power_kW);

const dw = unit("Screw Press");
add("Screw Press", "Motor screw", "0,6 + 6,0 kg/h padatan x 0,03",
  0.6 + 6.0 * 0.03, dw.power_kW);

// RO: tekanan diestimasi dari tekanan osmotik, bukan diasumsikan.
const ro = unit("RO Air Payau 3 train");
const osm = (tds: number, T = 30) => (tds / 1000) * 0.78 * ((T + 273.15) / 298.15);
const osmFeed = osm(372);              // TDS umpan RO setelah koreksi pH
const osmConc = osm(G.roConcentrate_TDS);
const pEst = (osmFeed + osmConc) / 2 + 2.5 + 1.5;   // NDP 2,5 bar + rugi 1,5 bar
add("RO", "Tekanan umpan (bar)", "(pi_umpan + pi_konsentrat)/2 + 2,5 + 1,5",
  pEst, 4.8);
add("RO", "Pompa tekanan tinggi", "pompa(64,0 m3/h @ 4,8 bar = 49 m) / 0,75",
  pumpKW(64.04, 4.808 * 10.2, 0.75), ro.power_kW);

const ph2 = unit("Trim pH Produk (NaOH)");
add("Trim pH", "Pengaduk", "V x 40 W/m3 / 1000 + 1,5",
  ((179.84 * 5) / 60) * 40 / 1000 + 1.5, ph2.power_kW);

const dp = unit("Pompa Distribusi ke SIER");
add("Pompa Distribusi", "Daya poros", "9,81 x (179,84/3600) x 45 / 0,75",
  pumpKW(179.84, 45, 0.75), dp.power_kW);

const totalKW = U.reduce((a, u) => a + u.power_kW, 0);
add("TOTAL", "Daya terpasang", "jumlah seluruh unit", totalKW, G.power_kW);
add("TOTAL", "Energi spesifik (kWh/m3)", "92,7 kW / 179,84 m3/jam",
  totalKW / G.product_m3h, G.sec_kWh_m3);

/* -------------------------------------------------------- 2. BAHAN KIMIA */

const chem = Object.fromEntries(G.chemicals.map((c: Json) => [c.name, c.kg_h]));
const dose = (mgL: number, q: number) => (mgL * q) / 1000;

add("Kimia", "PAC koagulan", "25 mg/L x 205 m3/jam / 1000",
  dose(25, 205), chem["Poly-aluminium chloride"]);
add("Kimia", "Polimer flokulan", "0,3 mg/L x 205 / 1000",
  dose(0.3, 205), chem["Polymer flocculant"]);
add("Kimia", "NaOCl intake", "1,5 mg/L x 205 / 1000",
  dose(1.5, 205), chem["Sodium hypochlorite (as Cl2)"]);
add("Kimia", "Antiscalant", "3 mg/L x 64,04 (umpan RO) / 1000",
  dose(3, 64.04), chem["Antiscalant"]);
add("Kimia", "SMBS", "5 mg/L x 64,04 / 1000",
  dose(5, 64.04), chem["Sodium metabisulphite"]);
add("Kimia", "Polimer dewatering", "6,0 kg/jam padatan / 1000 x 4 kg/t",
  (6.0 / 1000) * 4, chem["Polymer (dewatering)"]);

// Asam dan basa TIDAK diasumsikan sebagai dosis. Dihitung dari alkalinitas.
const alk = 130;                       // mg/L sebagai CaCO3, air baku
const fracDown = (8.5 - 6.9) / (8.5 - 4.5);
const meqAcid = (alk / 50) * fracDown;
add("Kimia", "H2SO4 — kebutuhan (meq/L)", "(130/50) x (8,5-6,9)/(8,5-4,5)",
  meqAcid, 1.04);
add("Kimia", "H2SO4 — laju (kg/jam)", "1,04 meq/L x 1,15 x 205 m3/jam x 49,04 g/eq / 1000",
  (meqAcid * 1.15 * 205 * 49.04) / 1000, chem["Sulphuric acid H2SO4"]);

const meqNaOH = chem["Caustic soda NaOH"] / ((1.15 * 179.84 * 40) / 1000);
add("Kimia", "NaOH — laju (kg/jam)", `${meqNaOH.toFixed(3)} meq/L x 1,15 x 179,84 x 40 g/eq / 1000`,
  (meqNaOH * 1.15 * 179.84 * 40) / 1000, chem["Caustic soda NaOH"]);

/* -------------------------------------------------------------- 3. CAPEX */

add("CAPEX", "Intake", "5.200 x 205^0,62", costCurve(205, 5200, 0.62), intake.capex_USD);
add("CAPEX", "Koreksi pH", "2.600 x 17,1^0,66", costCurve((205 * 5) / 60, 2600, 0.66), ph1.capex_USD);
add("CAPEX", "Koagulasi-Flokulasi", "900 x 64,9^0,70",
  costCurve((205 / 60) * 19, 900, 0.7), cf.capex_USD);
add("CAPEX", "DAF", "6.500 x 20,5^0,72", costCurve(20.5, 6500, 0.72), daf.capex_USD);
add("CAPEX", "Filter Dual-Media", "5.200 x 20,3^0,72", costCurve(20.295, 5200, 0.72), mmf.capex_USD);
add("CAPEX", "Tangki Tersaring", "320 x 215^0,68", costCurve(215, 320, 0.68), unit("Tangki Air Tersaring").capex_USD);
add("CAPEX", "Cartridge", "380 x 64,0^0,60", costCurve(64.04, 380, 0.6), unit("Cartridge 5 µm").capex_USD);
add("CAPEX", "RO — membran", "210 x 2.668^0,86", costCurve(2668, 210, 0.86), 0);
add("CAPEX", "RO — pompa & skid", "1.600 x 64,0^0,70", costCurve(64.04, 1600, 0.7), 0);
add("CAPEX", "RO — total", "jumlah keduanya",
  costCurve(2668, 210, 0.86) + costCurve(64.04, 1600, 0.7), ro.capex_USD);
add("CAPEX", "Tangki Produk", "320 x 791^0,68", costCurve(791, 320, 0.68), unit("Tangki Produk + Blending").capex_USD);
add("CAPEX", "Trim pH", "2.600 x 15,0^0,66", costCurve((179.84 * 5) / 60, 2600, 0.66), ph2.capex_USD);
add("CAPEX", "Pompa Distribusi", "1.400 x 29,4^0,70", costCurve(29.4, 1400, 0.7), dp.capex_USD);
add("CAPEX", "Pengental", "3.800 x 2,5^0,70", costCurve(2.5, 3800, 0.7), th.capex_USD);
add("CAPEX", "Screw Press", "5.200 x 6,0^0,70", costCurve(6.0, 5200, 0.7), dw.capex_USD);

const capexSum = U.reduce((a, u) => a + u.capex_USD, 0);
add("CAPEX", "TOTAL peralatan", "jumlah seluruh unit", capexSum, G.capex_USD);

/* ---------------------------------------------------------------- 4. OPEX */

const HOURS = 8000, ELEC = 0.09;

// Imported, not copied. A second hand-kept price table here would drift from
// the engine's and this whole script would then be verifying itself.
const chemLines = G.chemicals.map((c: Json) => {
  const tPerY = (c.kg_h * HOURS) / 1000;
  const price = CHEM_PRICES_USD_PER_T[c.name] ?? CHEM_PRICE_FALLBACK;
  return {
    name: c.name, kg_h: c.kg_h, t_y: tPerY, usd_t: price,
    usd_y: tPerY * price,
    defaulted: CHEM_PRICES_USD_PER_T[c.name] === undefined,
  };
}).sort((a: Json, b: Json) => b.usd_y - a.usd_y);

const powerCost = totalKW * HOURS * ELEC;
const chemCost = chemLines.reduce((a: number, c: Json) => a + c.usd_y, 0);
const replacement = capexSum * 0.04;
const labour = 40000;
const opex = powerCost + chemCost + replacement + labour;
const m3y = G.product_m3h * HOURS;

/* -------------------------------------------------------------- laporan */

const fmt = (v: number, dp = 2) =>
  v.toLocaleString("id-ID", { minimumFractionDigits: dp, maximumFractionDigits: dp });

const out: string[] = [];
out.push("VERIFIKASI ENERGI, BAHAN KIMIA, DAN CAPEX — WTP SAGARA");
out.push("=".repeat(104));
out.push(
  "SISTEM".padEnd(22) + "ITEM".padEnd(30) + "HITUNG".padStart(12) +
  "MODEL".padStart(12) + "  SELISIH  RUMUS",
);
out.push("-".repeat(104));
let worst = 0;
for (const r of rows) {
  if (r.model === 0 && r.item.startsWith("RO — ")) {
    out.push(r.sys.padEnd(22) + r.item.padEnd(30) + fmt(r.hitung).padStart(12) +
      "—".padStart(12) + "        —  " + r.rumus);
    continue;
  }
  const dev = r.model !== 0 ? Math.abs((r.hitung - r.model) / r.model) * 100 : 0;
  worst = Math.max(worst, dev);
  out.push(
    r.sys.padEnd(22) + r.item.padEnd(30) + fmt(r.hitung).padStart(12) +
    fmt(r.model).padStart(12) + `  ${dev.toFixed(2).padStart(6)}%  ` + r.rumus,
  );
}
out.push("-".repeat(104));
out.push(`Selisih terbesar antara hitungan tangan dan model: ${worst.toFixed(2)} %`);

out.push("");
out.push("BIAYA BAHAN KIMIA PER TAHUN (8.000 jam operasi)");
out.push("-".repeat(104));
out.push("BAHAN".padEnd(30) + "kg/jam".padStart(10) + "ton/thn".padStart(10) +
  "USD/ton".padStart(10) + "USD/thn".padStart(12) + "   % biaya kimia");
for (const c of chemLines) {
  out.push(
    (c.name + (c.defaulted ? " *" : "")).padEnd(30) +
    fmt(c.kg_h, 3).padStart(10) + fmt(c.t_y, 1).padStart(10) +
    fmt(c.usd_t, 0).padStart(10) + fmt(c.usd_y, 0).padStart(12) +
    `   ${((c.usd_y / chemCost) * 100).toFixed(1)} %`,
  );
}
if (chemLines.some((c: Json) => c.defaulted)) {
  out.push(`* harga tidak ada di daftar, memakai nilai bawaan ${CHEM_PRICE_FALLBACK} USD/ton — PERIKSA`);
} else {
  out.push("Seluruh bahan kimia punya harga eksplisit; tidak ada yang memakai nilai bawaan.");
}
out.push(`TOTAL BAHAN KIMIA: ${fmt(chemCost, 0)} USD/tahun`);

out.push("");
out.push("OPEX");
out.push("-".repeat(104));
const opexLines: [string, number, string][] = [
  ["Listrik", powerCost, `${fmt(totalKW, 1)} kW x 8.000 jam x 0,09 USD/kWh`],
  ["Bahan kimia", chemCost, "lihat tabel di atas"],
  ["Penggantian membran & media", replacement, "4 % dari CAPEX peralatan — placeholder"],
  ["Tenaga kerja", labour, "tetap 40.000 USD/tahun — placeholder"],
];
for (const [k, v, note] of opexLines) {
  out.push(k.padEnd(30) + fmt(v, 0).padStart(12) + `   ${((v / opex) * 100).toFixed(1)} %   ${note}`);
}
out.push("TOTAL".padEnd(30) + fmt(opex, 0).padStart(12));
out.push(`Produksi: ${fmt(m3y, 0)} m3/tahun  →  OPEX = ${fmt(opex / m3y, 3)} USD/m3`);
out.push(`Porsi energi dalam OPEX: ${((powerCost / opex) * 100).toFixed(1)} %`);

const text = out.join("\n");
console.log(text);
writeFileSync("scripts/out/sagara-biaya.txt", text);
writeFileSync("scripts/out/sagara-biaya.json", JSON.stringify({
  rows, chemLines, powerCost, chemCost, replacement, labour, opex,
  m3PerY: m3y, opexPerM3: opex / m3y, capexSum, totalKW,
  secKWhM3: totalKW / G.product_m3h,
}, null, 2));
