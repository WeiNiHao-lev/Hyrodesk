import { readFileSync, writeFileSync } from "fs";
import {
  AlignmentType, BorderStyle, Document, HeadingLevel, Packer, Paragraph,
  ShadingType, Table, TableCell, TableRow, TextRun, WidthType,
} from "docx";

/**
 * WTP Sagara — Logika Pemilihan Proses.
 *
 * Ditulis untuk dipelajari, bukan untuk diarsipkan. Setiap keputusan disajikan
 * sebagai pilihan: apa saja alternatifnya, mengapa yang lain kalah untuk AIR
 * INI, dan apa yang harus berubah agar jawabannya berubah. Bagian terakhir
 * menyiapkan pertanyaan yang akan datang dari ruang rapat.
 */

type Json = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
const d: Json = JSON.parse(readFileSync("scripts/out/sagara.json", "utf8"));
const ALT_D: Json = JSON.parse(readFileSync("scripts/out/sagara-alt.json", "utf8"));
const NFC = ALT_D.membraneCases.find((c: Json) => c.type === "nf");
const ROC = ALT_D.membraneCases.find((c: Json) => c.type === "ro");
const LIME = ALT_D.limeSoftening;

const NAVY = "0F2942", ALT = "EEF6FB", OK = "D8F7E9", WARN = "FEF3D4", TEAL = "0E7C5A";
type Align = (typeof AlignmentType)[keyof typeof AlignmentType];

const P = (t: string, o: { b?: boolean; sz?: number; color?: string; it?: boolean; align?: Align } = {}) =>
  new Paragraph({ alignment: o.align, spacing: { after: 140, line: 288 },
    children: [new TextRun({ text: t, bold: o.b, size: o.sz ?? 20, color: o.color, italics: o.it, font: "Calibri" })] });
const H1 = (t: string) => new Paragraph({ heading: HeadingLevel.HEADING_1, spacing: { before: 340, after: 170 },
  children: [new TextRun({ text: t, bold: true, size: 30, color: NAVY, font: "Calibri" })] });
const H2 = (t: string) => new Paragraph({ heading: HeadingLevel.HEADING_2, spacing: { before: 260, after: 120 },
  children: [new TextRun({ text: t, bold: true, size: 24, color: NAVY, font: "Calibri" })] });
const H3 = (t: string) => new Paragraph({ spacing: { before: 190, after: 90 },
  children: [new TextRun({ text: t, bold: true, size: 21, color: TEAL, font: "Calibri" })] });
const spacer = () => new Paragraph({ spacing: { after: 120 }, children: [] });

type Cell = string | { v: string; bg?: string; b?: boolean };
function table(head: string[], rows: Cell[][], widths: number[], numeric: number[] = []) {
  const mk = (c: Cell, i: number, isHead: boolean) => {
    const v = typeof c === "string" ? c : c.v;
    const bg = typeof c === "string" ? undefined : c.bg;
    const bold = isHead || (typeof c === "object" && c.b);
    return new TableCell({
      width: { size: widths[i], type: WidthType.DXA },
      shading: { type: ShadingType.CLEAR, fill: isHead ? NAVY : bg ?? "FFFFFF", color: "auto" },
      margins: { top: 60, bottom: 60, left: 90, right: 90 },
      children: [new Paragraph({ spacing: { after: 0 },
        alignment: numeric.includes(i) && !isHead ? AlignmentType.RIGHT : AlignmentType.LEFT,
        children: [new TextRun({ text: v, bold, size: 17, color: isHead ? "FFFFFF" : undefined, font: "Calibri" })] })],
    });
  };
  return new Table({
    width: { size: widths.reduce((a, b) => a + b, 0), type: WidthType.DXA },
    borders: {
      top: { style: BorderStyle.SINGLE, size: 2, color: "C9D6E2" },
      bottom: { style: BorderStyle.SINGLE, size: 2, color: "C9D6E2" },
      left: { style: BorderStyle.SINGLE, size: 2, color: "C9D6E2" },
      right: { style: BorderStyle.SINGLE, size: 2, color: "C9D6E2" },
      insideHorizontal: { style: BorderStyle.SINGLE, size: 1, color: "DDE6EE" },
      insideVertical: { style: BorderStyle.SINGLE, size: 1, color: "DDE6EE" },
    },
    rows: [
      new TableRow({ tableHeader: true, children: head.map((h, i) => mk(h, i, true)) }),
      ...rows.map((r, ri) => new TableRow({
        children: r.map((c, i) => mk(typeof c === "string" && ri % 2 === 1 ? { v: c, bg: ALT } : c, i, false)) })),
    ],
  });
}

function box(title: string, lines: string[], fill = WARN, accent = "8A6100") {
  return new Table({
    width: { size: 9400, type: WidthType.DXA },
    borders: {
      top: { style: BorderStyle.SINGLE, size: 2, color: fill },
      bottom: { style: BorderStyle.SINGLE, size: 2, color: fill },
      left: { style: BorderStyle.SINGLE, size: 18, color: accent },
      right: { style: BorderStyle.SINGLE, size: 2, color: fill },
      insideHorizontal: { style: BorderStyle.NONE, size: 0, color: fill },
      insideVertical: { style: BorderStyle.NONE, size: 0, color: fill },
    },
    rows: [new TableRow({ children: [new TableCell({
      width: { size: 9400, type: WidthType.DXA },
      shading: { type: ShadingType.CLEAR, fill, color: "auto" },
      margins: { top: 130, bottom: 130, left: 170, right: 150 },
      children: [
        new Paragraph({ spacing: { after: 80 }, children: [new TextRun({ text: title, bold: true, size: 20, color: accent, font: "Calibri" })] }),
        ...lines.map((l) => new Paragraph({ spacing: { after: 75, line: 272 }, children: [new TextRun({ text: l, size: 19, font: "Calibri" })] })),
      ],
    })] })],
  });
}

/** Satu blok keputusan: pilihan, alternatif, dan apa yang membalikkannya. */
function decision(
  no: string, title: string, question: string, chosen: string,
  alternatives: { opt: string; why: string; verdict: "dipilih" | "kalah" | "layak" }[],
  reversal: string,
  numbers: [string, string][] = [],
) {
  const out: (Paragraph | Table)[] = [];
  out.push(H2(`${no}  ${title}`));
  out.push(P(question, { it: true, color: "5A6B7B" }));
  out.push(P(chosen));
  if (numbers.length) {
    out.push(H3("Angka yang mendukungnya"));
    out.push(table(["Besaran", "Nilai dan asalnya"], numbers.map(([a, b]) => [{ v: a, b: true }, b]),
      [2600, 6800]));
    out.push(spacer());
  }
  out.push(table(
    ["Pilihan", "Mengapa menang atau kalah", "Putusan"],
    alternatives.map((a) => {
      const bg = a.verdict === "dipilih" ? OK : a.verdict === "layak" ? WARN : undefined;
      const c = (v: string) => (bg ? { v, bg } : v);
      return [c(a.opt), c(a.why), c(a.verdict === "dipilih" ? "DIPILIH" : a.verdict === "layak" ? "Layak, tidak dipilih" : "Kalah")];
    }), [2100, 5500, 1800],
  ));
  out.push(spacer());
  out.push(box("Apa yang membalikkan keputusan ini", [reversal], ALT, NAVY));
  return out;
}

const RS = d.rejectionStudy;
const f = (v: number, dp = 1) => {
  if (v == null || !Number.isFinite(v)) return "—";
  const r = Math.round(v * 10 ** dp) / 10 ** dp;
  const [i, dec] = String(Math.abs(r)).split(".");
  return `${r < 0 ? "-" : ""}${i.replace(/\B(?=(\d{3})+(?!\d))/g, ".")}${dec ? "," + dec : ""}`;
};

const body: (Paragraph | Table)[] = [];

/* ================================================================ sampul */
body.push(
  new Paragraph({ spacing: { before: 1500, after: 60 }, alignment: AlignmentType.CENTER,
    children: [new TextRun({ text: "LOGIKA PEMILIHAN PROSES", bold: true, size: 44, color: NAVY, font: "Calibri" })] }),
  new Paragraph({ spacing: { after: 200 }, alignment: AlignmentType.CENTER,
    children: [new TextRun({ text: "WTP Sagara — 50 L/detik ke Kawasan Industri SIER", size: 26, color: TEAL, font: "Calibri" })] }),
  new Paragraph({ spacing: { after: 460 }, alignment: AlignmentType.CENTER,
    children: [new TextRun({ text: "Sepuluh keputusan, alternatif yang kalah, dan alasannya", size: 20, color: "5A6B7B", font: "Calibri", italics: true })] }),
  box("Cara membaca dokumen ini", [
    "Ini bukan laporan desain. Angkanya ada di dokumen lain. Yang ada di sini adalah alasannya.",
    "Setiap bab adalah satu keputusan. Formatnya sama: pertanyaannya apa, apa yang dipilih, apa saja alternatifnya, mengapa yang lain kalah UNTUK AIR INI, dan yang terakhir — apa yang harus berubah agar jawabannya berubah.",
    "Bagian terakhir itu yang paling penting untuk dikuasai. Seorang engineer yang hafal keputusan bisa dijatuhkan dengan satu pertanyaan; yang paham syarat batalnya tidak bisa. Kalau ditanya \"kenapa tidak pakai X\", jawaban terkuat selalu berbentuk \"X menang kalau kondisinya begini, dan kondisi itu tidak berlaku di sini karena begini\".",
    "Bab 12 berisi pertanyaan yang kemungkinan besar diajukan, beserta jawabannya.",
  ], ALT, NAVY),
);

/* ============================================================ 1 satu angka */
body.push(new Paragraph({ pageBreakBefore: true, children: [] }), H1("1  Satu Angka yang Menentukan Segalanya"));

body.push(P(
  "Sebelum membahas unit mana pun, ada satu perbandingan yang menentukan bentuk seluruh pabrik:",
));
body.push(table(["Parameter", "Air baku", "Produk", "Yang harus dikerjakan"], [
  ["Kekeruhan", "15 NTU", "≤ 1 NTU", "Turun 93 % — rutin, semua IPA bisa"],
  [{ v: "TDS", bg: WARN }, { v: "365 mg/L", bg: WARN }, { v: "≤ 300 mg/L", bg: WARN }, { v: "Turun 18 % — dan ini yang tidak rutin", bg: WARN }],
], [1800, 1900, 1900, 3800]));
body.push(spacer());

body.push(P(
  "Kekeruhan 15 NTU menjadi 1 NTU adalah pekerjaan sehari-hari instalasi pengolahan air. Koagulasi, pengendapan atau flotasi, lalu filtrasi. Tidak ada yang istimewa.",
));
body.push(P(
  "Yang membuat proyek ini berbeda adalah baris kedua. Koagulasi, sedimentasi, dan filtrasi menyisihkan padatan TERSUSPENSI — partikel yang mengambang. Padatan TERLARUT tidak tersentuh sama sekali oleh ketiganya. Garam yang terlarut melewati clarifier dan filter tanpa berkurang satu miligram pun.",
));
body.push(box("Inilah kalimat yang harus Anda kuasai", [
  "\"Instalasi pengolahan air konvensional menyisihkan padatan tersuspensi, bukan terlarut. Kekeruhan 15 ke 1 NTU itu rutin. Yang menentukan desain di spesifikasi ini adalah TDS 365 ke 300 — dan tidak ada satu pun unit konvensional yang dapat melakukannya.\"",
  "Kalau ada kompetitor menawarkan IPA konvensional untuk spesifikasi ini, penawarannya tidak akan memenuhi TDS. Itu bukan tuduhan; itu fakta proses yang dapat diperiksa siapa pun.",
], OK, "0E7C5A"));

body.push(H2("1.2  Mengapa 18 % itu justru angka yang sulit"));
body.push(P(
  "Anehnya, penyisihan 18 % lebih merepotkan daripada 95 %. Kalau targetnya air demin atau air laut, jawabannya jelas: seluruh aliran lewat membran, selesai. Justru karena yang dibutuhkan hanya sedikit, muncul pertanyaan yang tidak punya jawaban baku — teknologi apa yang efisien untuk menyisihkan sedikit garam saja, dan haruskah seluruh aliran diolah untuk itu?",
));
body.push(P(
  "Seluruh rancangan ini pada dasarnya adalah jawaban atas pertanyaan tersebut.",
));

/* ==================================================== 2 peta keputusan */
body.push(new Paragraph({ pageBreakBefore: true, children: [] }), H1("2  Peta Sepuluh Keputusan"));
body.push(P("Urutannya bukan urutan aliran air, melainkan urutan konsekuensi. Keputusan di atas membatasi yang di bawahnya."));
body.push(table(["No.", "Keputusan", "Yang dipilih", "Konsekuensi kalau salah"], [
  ["1", "Perlukah penyisihan garam sama sekali?", "Ya, wajib", "Gagal spesifikasi TDS — proyek batal"],
  ["2", "Teknologi penyisih garam mana?", "Reverse osmosis", "Air tidak stabil, atau OPEX meledak"],
  ["3", "Seluruh aliran atau sebagian?", "Sebagian (split-stream)", "OPEX Rp 4.500/m³ — jauh di atas plafon"],
  ["4", "Di mana titik percabangannya?", "Setelah filter", "Membran rusak, atau bypass keruh"],
  ["5", "Pengendapan atau flotasi?", "DAF", "Flok alga lolos ke filter dan meracuni membran"],
  ["6", "Filter media atau ultrafiltrasi?", "Media, dengan syarat", "CAPEX +Rp 4 M, atau SDI gagal"],
  ["7", "Praoksidasi — ya, dan seberapa keras?", "Ya, dosis rendah", "Sel alga pecah, toksin terlarut lolos"],
  ["8", "Koreksi pH — ke berapa?", "6,9 sebelum koagulasi", "Koagulan tidak bekerja, dosis membengkak"],
  ["9", "Berapa train RO?", "Tiga", "Kemarau gagal spesifikasi"],
  ["10", "Lumpur — diolah atau dikirim?", "Diolah di tapak", "Biaya angkut cairan sangat mahal"],
], [600, 2900, 2200, 3700]));

/* ============================================== keputusan 1 */
body.push(new Paragraph({ pageBreakBefore: true, children: [] }), H1("3  Keputusan 1–3: Soal Garam"));

body.push(...decision(
  "3.1", "Perlukah penyisihan garam sama sekali?",
  "Pertanyaan: bisakah spesifikasi dipenuhi tanpa menyentuh padatan terlarut?",
  "Tidak bisa. Air baku 365 mg/L, batas 300 mg/L, dan seluruh rangkaian konvensional menyisihkan nol. Bahkan sebaliknya — koagulan dan asam menambah sedikit padatan terlarut, sehingga air tersaring keluar sekitar 375 mg/L, lebih tinggi daripada air bakunya.",
  [
    { opt: "Konvensional saja", why: "Produk keluar 375 mg/L terhadap batas 300. Gagal telak, dan gagalnya bukan karena kurang optimasi melainkan karena prosesnya memang tidak mengerjakan hal itu.", verdict: "kalah" },
    { opt: "Cari sumber air lain", why: "Tidak ada dalam lingkup, dan waduk sudah ditetapkan. Layak ditanyakan sekali kepada klien, tetapi tidak dapat diasumsikan.", verdict: "kalah" },
    { opt: "Negosiasi ulang batas TDS", why: "Bila 300 mg/L berasal dari kebutuhan proses tenant, mungkin dapat digeser. Bila berasal dari baku mutu, tidak. Ini pertanyaan komersial yang layak diajukan sebelum desain dikunci.", verdict: "layak" },
    { opt: "Tambahkan tahap penyisih garam", why: "Satu-satunya jalan teknis yang pasti memenuhi. Seluruh sisa dokumen ini membahas tahap mana.", verdict: "dipilih" },
  ],
  "Kalau tenant SIER ternyata hanya butuh air jernih dan angka 300 mg/L itu warisan dokumen lain, seluruh cabang RO bisa dicabut dan CAPEX turun sekitar Rp 12 miliar. Tanyakan asal angka 300 itu sekali, di awal — ini pertanyaan termurah dengan konsekuensi terbesar dalam proyek ini.",
  [
    ["TDS air baku", "365 mg/L — data diberikan"],
    ["Batas produk", "300 mg/L — spesifikasi"],
    ["Yang harus disisihkan", "65 mg/L, atau 17,8 % dari beban terlarut"],
    ["Penyisihan oleh koagulasi + DAF + filter", "0 mg/L. Ketiganya bekerja pada padatan tersuspensi"],
    ["Kontribusi bersih bahan kimia", "+10 mg/L. PAC dan H₂SO₄ menambah ion terlarut"],
    ["TDS produk tanpa RO", "375 mg/L — 25 % DI ATAS batas, bukan di bawahnya"],
  ],
));

body.push(new Paragraph({ pageBreakBefore: true, children: [] }));
body.push(...decision(
  "3.2", "Teknologi penyisih garam mana?",
  "Pertanyaan: ada lima cara menurunkan padatan terlarut. Mengapa reverse osmosis?",
  "Reverse osmosis air payau. Dua alternatif yang paling sering diusulkan sudah diuji lewat model, dan keduanya kalah dengan angka — bukan dengan pendapat.",
  [
    { opt: "Nanofiltrasi", why: `Diuji langsung: rangkaian yang sama dengan blok NF menggantikan RO. Bahkan pada porsi 75 % air tersaring — batas atas pemindaian — produk hanya turun ke ${f(NFC.TDS, 0)} mg/L, masih GAGAL batas 300. Sebabnya NF meloloskan monovalen: natrium keluar ${f(NFC.Na, 1)} mg/L dan klorida ${f(NFC.Cl, 1)}, hampir sama dengan air baku. Ditambah energinya justru lebih boros (${f(NFC.sec, 3)} vs ${f(ROC.sec, 3)} kWh/m³) dan recovery lebih rendah (${f(NFC.recovery, 1)} vs ${f(ROC.recovery, 1)} %). NF tidak kalah tipis di sini — ia tidak bisa memenuhi spesifikasi pada porsi berapa pun.`, verdict: "kalah" },
    { opt: "Pelunakan kapur", why: `Secara aritmetika sanggup dan tidak mahal: hanya perlu mengendapkan ${f(LIME.meqNeeded, 2)} meq/L kesadahan karbonat, setara kapur ${f(LIME.limeDose_mgL, 1)} mg/L atau ${f(LIME.lime_kgd, 0)} kg/hari. Alkalinitas sisa ${f(LIME.alkLeft, 0)} mg/L sebagai CaCO₃ — masih stabil. Yang menggugurkannya lumpur: setiap meq yang diendapkan menghasilkan DUA meq CaCO₃, yaitu kalsium dari airnya dan kalsium dari kapurnya, sehingga bertambah ${f(LIME.sludge_kgd, 0)} kg/hari di atas ${f(LIME.existingSludge_kgd, 0)} kg/hari yang sudah ada — naik 3,5 kali. Ditambah dua ayunan pH tambahan (naik ke 9,5–10,5 untuk mengendapkan, rekarbonasi turun, lalu turun lagi ke 6,9 untuk koagulasi) pada air yang pH-nya sudah bergerak sendiri karena alga.`, verdict: "kalah" },
    { opt: "Penukar ion", why: "Menukar garam dengan garam, sehingga regeneran sebanding ekuivalen yang disisihkan. Untuk 1,3 meq/L pada 180 m³/jam itu sekitar 234 ekuivalen/jam yang harus diregenerasi terus-menerus, dan efluen regenerasinya bersalinitas tinggi serta butuh izin pembuangan tersendiri. Menukar satu masalah pembuangan dengan masalah yang lebih pekat.", verdict: "kalah" },
    { opt: "Elektrodialisis (EDR)", why: "Justru paling cocok secara prinsip: EDR membayar listrik sebanding garam yang dipindahkan, bukan air yang dilewatkan — persis menguntungkan untuk penyisihan sekecil 18 %. Yang menggugurkannya bukan teknis melainkan komersial: instalasi EDR di Indonesia sangat sedikit, dukungan purnajual tipis, dan CCEPC tidak punya rekam jejaknya. Untuk kontrak pasokan 15 tahun, itu risiko yang tidak sebanding.", verdict: "layak" },
    { opt: "Reverse osmosis air payau", why: `Menahan semua ion secara proporsional, sehingga produk campuran mempertahankan kesadahan ${f(ROC.hardness, 0)} mg/L sebagai CaCO₃ dan alkalinitas ${f(ROC.alkalinity, 0)} — LSI sedikit positif, stabil untuk jaringan distribusi. Merespons kenaikan TDS musiman apa pun bentuk ionnya. Energi ${f(ROC.sec, 3)} kWh/m³ dan recovery ${f(ROC.recovery, 1)} %, keduanya lebih baik daripada NF. Suku cadang dan jasa tersedia di seluruh Indonesia, dan CCEPC punya rekam jejak di Weda Bay, Batam, dan Gresik.`, verdict: "dipilih" },
  ],
  "Kalau kelak diminta air LUNAK — misalnya untuk umpan boiler tenant — jawabannya berbalik: NF atau pelunakan justru menjadi tepat, karena yang diinginkan memang membuang kesadahan. Di sini yang diminta hanyalah TDS lebih rendah dengan air yang tetap stabil, dan itu kebutuhan yang berbeda. Perhatikan bahwa dua alternatif yang kalah, kalah karena membuang ion yang SALAH, bukan karena kurang mampu.",
  [
    ["Yang dibutuhkan", "Turunkan 65 mg/L TDS, pertahankan air tetap stabil"],
    ["NF pada porsi 75 %", `TDS ${f(NFC.TDS, 0)} mg/L — gagal. Na ${f(NFC.Na, 1)}, Cl ${f(NFC.Cl, 1)} nyaris utuh`],
    ["NF — energi & recovery", `${f(NFC.sec, 3)} kWh/m³ · ${f(NFC.recovery, 1)} % — dua-duanya lebih buruk dari RO`],
    ["RO pada porsi 23,5 %", `TDS ${f(ROC.TDS, 0)} mg/L — memenuhi, dengan kesadahan ${f(ROC.hardness, 0)} dan alkalinitas ${f(ROC.alkalinity, 0)}`],
    ["Kapur — dosis", `${f(LIME.meqNeeded, 2)} meq/L, setara ${f(LIME.lime_kgd, 0)} kg Ca(OH)₂/hari — murah`],
    ["Kapur — lumpur", `+${f(LIME.sludge_kgd, 0)} kg/hari di atas ${f(LIME.existingSludge_kgd, 0)} yang ada. Naik 3,5×`],
  ],
));

body.push(new Paragraph({ pageBreakBefore: true, children: [] }));
body.push(...decision(
  "3.3", "Seluruh aliran atau sebagian?",
  "Pertanyaan: RO sudah dipilih. Haruskah semua 180 m³/jam melewatinya?",
  "Sebagian saja — sekitar sepertiga air tersaring naik ke RO, sisanya di-bypass, lalu keduanya dicampur. Ini keputusan tunggal terbesar dalam desain ini.",
  [
    { opt: "RO penuh, 100 % aliran", why: "Menghasilkan air 12 mg/L — jauh melampaui kebutuhan. Energinya sebanding volume yang dilewatkan, bukan garam yang disisihkan, sehingga membayar penuh untuk penyisihan yang cuma perlu 18 %. Perkiraan OPEX Rp 4.500/m³ terhadap plafon Rp 3.000. Lebih buruk lagi: air 12 mg/L bersifat agresif dan justru butuh remineralisasi tambahan — membuat masalah baru setelah membayar mahal.", verdict: "kalah" },
    { opt: "Split-stream", why: "Hanya membayar RO untuk air yang benar-benar perlu diturunkan garamnya. Produk campuran keluar sekitar 278 mg/L dengan alkalinitas ±90 — stabil, tidak agresif, tidak perlu remineralisasi. Porsi RO menjadi tuas yang bisa disetel musiman.", verdict: "dipilih" },
    { opt: "RO penuh dengan recovery sangat tinggi", why: "Menaikkan recovery memang menurunkan buangan, tetapi tidak menurunkan energi per m³ produk secara berarti dan justru menaikkan risiko kerak. Menyelesaikan masalah yang bukan masalahnya.", verdict: "kalah" },
  ],
  "Kalau batas TDS turun jauh — misalnya tenant butuh air proses 50 mg/L — porsi RO naik mendekati 100 % dan split-stream kehilangan maknanya. Sebaliknya kalau TDS air baku ternyata sudah di bawah 300 sepanjang tahun, cabang RO tidak diperlukan sama sekali.",
  [
    ["Aliran ke RO", "64 dari 196 m³/jam air tersaring — 32,7 %"],
    ["Permeat", "48 m³/jam, atau 26,7 % dari produk"],
    ["Bypass", "132 m³/jam — dua pertiga produk tidak pernah menyentuh membran"],
    ["OPEX split-stream", "Rp 2.734/m³ — memenuhi plafon Rp 3.000"],
    ["OPEX RO penuh", "±Rp 4.500/m³ — 50 % di atas plafon"],
    ["Kontribusi RO ke tagihan listrik", "19 %. Pada RO penuh pos ini sendiri jadi ±80 kW"],
    ["TDS produk RO penuh", "12 mg/L — agresif, justru butuh remineralisasi tambahan"],
  ],
));

body.push(spacer());
body.push(box("Aritmetika pencampuran yang perlu Anda hafal", [
  "TDS produk = (1 − f) × TDS air tersaring + f × TDS permeat, dengan f = porsi produk yang berasal dari permeat.",
  "Dengan air tersaring 375 dan permeat 12: TDS produk = 375 − 363 f.",
  "Untuk mencapai 300 dibutuhkan f = 20,7 %. Titik desain dipilih f = 26,7 % agar ada margin, menghasilkan 278 mg/L.",
  "Perhatikan bentuknya: liniernya terhadap f. Itu sebabnya porsi RO menjadi tuas yang halus dan mudah dikendalikan — bukan sakelar hidup-mati.",
], OK, "0E7C5A"));

/* ================================================== 4 pra-olah */
body.push(new Paragraph({ pageBreakBefore: true, children: [] }), H1("4  Keputusan 4–8: Soal Pra-olah"));

body.push(P(
  "Semua keputusan berikut punya satu tujuan bersama yang sering tidak dinyatakan: melindungi membran. Spesifikasi produk hanya menuntut 1 NTU, tetapi RO menuntut SDI₁₅ di bawah 3 — jauh lebih ketat. Pra-olah di sini didimensikan oleh membran, bukan oleh baku mutu produk.",
));

body.push(...decision(
  "4.1", "Di mana titik percabangan bypass?",
  "Pertanyaan: air dibagi dua. Percabangannya di sebelah mana — sebelum atau sesudah filter?",
  "Sesudah filter, di tangki air tersaring. Seluruh air melewati DAF dan filter; percabangan terjadi setelahnya.",
  [
    { opt: "Bercabang sebelum pra-olah", why: "Bypass akan membawa 15 NTU langsung ke produk. Gagal spesifikasi kekeruhan. Tidak dapat dipertimbangkan.", verdict: "kalah" },
    { opt: "Bercabang setelah DAF, sebelum filter", why: "Bypass membawa 2 NTU — masih gagal batas 1 NTU. Dan umpan RO tidak terfilter, SDI-nya buruk.", verdict: "kalah" },
    { opt: "Bercabang setelah filter", why: "Kedua cabang sudah 0,1 NTU. Bypass memenuhi spesifikasi produk apa adanya; umpan RO sudah sebersih yang bisa diberikan rangkaian ini. Satu tahap pra-olah melayani dua tujuan.", verdict: "dipilih" },
    { opt: "Dua jalur pra-olah terpisah", why: "Bisa saja — pra-olah ringan untuk bypass, pra-olah ketat untuk RO. Tetapi menggandakan unit di lahan 2.000 m² yang sudah terpakai 90 %, dan menambah CAPEX untuk menghemat sesuatu yang tidak mahal.", verdict: "kalah" },
  ],
  "Kalau lahan jauh lebih longgar dan biaya filter lebih dominan, dua jalur terpisah bisa lebih murah — bypass hanya perlu memenuhi 1 NTU, sedangkan hanya sepertiga aliran yang perlu SDI < 3. Di sini lahan yang menggugurkannya.",
  [
    ["Kekeruhan sebelum pra-olah", "15 NTU — bypass langsung gagal batas 1 NTU"],
    ["Setelah DAF", "2,0 NTU — masih gagal"],
    ["Setelah filter", "0,10 NTU — memenuhi dengan margin 10×"],
    ["Batas produk", "1 NTU"],
    ["Batas umpan RO", "SDI₁₅ < 3 — jauh lebih ketat daripada baku mutu produk"],
    ["Lahan tersisa untuk jalur kedua", "206 m² dari 2.000. Tidak cukup"],
  ],
));

body.push(new Paragraph({ pageBreakBefore: true, children: [] }));
body.push(...decision(
  "4.2", "Pengendapan atau flotasi?",
  "Pertanyaan: air 15 NTU itu ringan. Mengapa DAF, bukan clarifier gravitasi yang lebih murah?",
  "DAF, dan alasannya bukan kekeruhan melainkan warna hijaunya. Beban di air ini adalah sel alga, bukan lempung.",
  [
    { opt: "Sedimentasi gravitasi", why: "Mengandalkan flok yang lebih berat daripada air. Flok alga TIDAK lebih berat — sel alga mengandung vakuola gas dan cenderung mengapung. Pada clarifier gravitasi, flok alga lolos ke atas dan langsung ke filter, lalu ke membran. Ditambah kebutuhan lahan sekitar 260 m² terhadap 70 m² DAF, di tapak yang sudah 90 % terpakai.", verdict: "kalah" },
    { opt: "DAF", why: "Justru memanfaatkan sifat mengapung itu: gelembung mikro menempel pada flok dan mengangkatnya ke permukaan untuk diserok. Untuk air beralga, flotasi bukan alternatif dari sedimentasi — ia mekanisme yang benar. Bonusnya hemat lahan drastis.", verdict: "dipilih" },
    { opt: "Filtrasi langsung tanpa klarifikasi", why: "Pada 15 NTU secara hidraulik mungkin, tetapi beban alga akan menyumbat filter dalam hitungan jam dan cuci balik menjadi tidak terkendali. Menghemat satu unit dengan mengorbankan yang berikutnya.", verdict: "kalah" },
  ],
  "Kalau ternyata warna hijaunya musiman dan sebagian besar tahun airnya lempung biasa, sedimentasi kembali menjadi kandidat — tetapi unit harus tetap sanggup menangani musim bloom, dan itulah kondisi yang mendimensikan. Klorofil-a dan identifikasi spesies (asumsi A2) yang menjawabnya.",
  [
    ["Lahan DAF", "70 m² — 2 unit x 10,3 m², beban permukaan 10 m/jam"],
    ["Lahan sedimentasi setara", "±260 m² — hampir 4× lipat"],
    ["Lahan tersedia", "2.000 m², sudah terpakai 1.794 m² (90 %)"],
    ["Beban alga", "8 mg/L biomassa dari 32 mg/L total padatan kering — fraksi organik terbesar"],
    ["Klorofil-a", "30 µg/L, kepadatan 20.000–150.000 sel/mL musiman (asumsi A2)"],
    ["Kekeruhan keluar DAF", "2,0 NTU dari 15 NTU masuk"],
  ],
));

body.push(new Paragraph({ pageBreakBefore: true, children: [] }));
body.push(...decision(
  "4.3", "Filter media atau ultrafiltrasi?",
  "Pertanyaan: RO menuntut SDI < 3. Sanggupkah filter dual-media, atau harus UF?",
  "Filter dual-media — dengan catatan tegas. Model menunjukkan SDI umpan RO berada di sekitar 4 pada konfigurasi ini, di atas batas 3. Ini keputusan yang belum tertutup.",
  [
    { opt: "Filter dual-media", why: "Jauh lebih murah, teknologi yang dikenal operator mana pun, dan cukup untuk baku mutu produk 1 NTU dengan margin sepuluh kali. Yang belum terbukti adalah apakah ia sanggup menahan SDI di bawah 3 saat musim bloom.", verdict: "dipilih" },
    { opt: "Ultrafiltrasi", why: "Menjamin SDI di bawah 3 dan menghilangkan risiko ini sepenuhnya. Harganya sekitar Rp 4 miliar CAPEX dan +Rp 120/m³ OPEX. Bukan pilihan yang buruk — hanya belum terbukti perlu.", verdict: "layak" },
    { opt: "Media sekarang, UF disiapkan tempatnya", why: "Kompromi paling rasional: bangun filter media, tetapi sisakan tapak dan koneksi untuk UF, dan buktikan lewat uji pilot selama satu siklus bloom sebelum RFP dikunci.", verdict: "layak" },
  ],
  "Uji pilot yang menjawabnya, dan hanya itu. Kalau SDI₁₅ air tersaring dapat ditahan di bawah 3 selama musim bloom, filter media menang telak. Kalau tidak, UF menjadi keharusan dan angkanya Rp 4 miliar. Perbedaan sebesar itu tidak boleh diputuskan dengan asumsi — dan inilah alasan mengapa uji pilot berada di daftar langkah lanjut.",
  [
    ["SDI umpan RO hasil model", "kira-kira 4,0 — DI ATAS batas"],
    ["Batas SDI₁₅ untuk RO", "3,0"],
    ["Kekeruhan air tersaring", "0,10 NTU — memenuhi baku mutu 10× lipat, tetapi SDI tetap gagal"],
    ["Filter dual-media", "5 sel x 5,1 m², 10 m/jam, antrasit 600 mm + pasir 400 mm"],
    ["Biaya naik ke UF", "CAPEX +Rp 4 miliar, OPEX +Rp 120/m³"],
    ["Yang memutuskan", "Uji pilot satu siklus bloom. Tidak ada jalan lain"],
  ],
));

body.push(new Paragraph({ pageBreakBefore: true, children: [] }));
body.push(...decision(
  "4.4", "Praoksidasi — perlu, dan seberapa keras?",
  "Pertanyaan: klorinasi awal mengendalikan alga dan biofouling. Mengapa dosisnya justru dibatasi?",
  "Ya perlu, tetapi dosisnya sengaja rendah — NaOCl dibatasi sekitar 1,5 mg/L, dengan KMnO₄ sebagai alternatif.",
  [
    { opt: "Tanpa praoksidasi", why: "Biofouling membran pada suhu 30 °C dengan organik alga adalah kombinasi terburuk untuk RO. Frekuensi CIP akan melonjak dan umur membran memendek.", verdict: "kalah" },
    { opt: "Klorinasi dosis tinggi", why: "Inilah jebakannya. Klorin dosis tinggi MEMECAH sel alga (lisis), melepaskan organik intraseluler — dan bila spesiesnya sianobakteri, melepaskan mikrosistin terlarut. DAF dapat menyisihkan sel utuh; ia tidak dapat menyisihkan toksin yang sudah terlarut. Dosis tinggi mengubah masalah yang bisa disaring menjadi masalah yang tidak bisa.", verdict: "kalah" },
    { opt: "Dosis rendah terkendali", why: "Cukup untuk menekan biofouling tanpa memecah sel. Sel tetap utuh dan diangkat DAF sebagai partikel. KMnO₄ sebagai alternatif sekaligus menangani mangan (asumsi A3).", verdict: "dipilih" },
  ],
  "Identifikasi spesies alga yang menjawabnya. Kalau bukan sianobakteri penghasil toksin, kekhawatiran lisis hilang dan dosis boleh dinaikkan. Kalau iya, titik injeksi karbon aktif bubuk wajib disiapkan sejak konstruksi — memasangnya belakangan jauh lebih mahal daripada menyediakan tempatnya sekarang.",
  [
    ["Dosis NaOCl praoksidasi", "Dibatasi 1,5 mg/L — sengaja rendah"],
    ["Dosis NaOCl pascaklorinasi", "12,5 g/m³ untuk sisa klor 0,5 mg/L — di produk, bukan di depan"],
    ["Alternatif", "KMnO₄, sekaligus menangani Mn 0,15 mg/L (asumsi A3)"],
    ["Suhu air", "28–32 °C — menguntungkan RO, merugikan biofouling"],
    ["Frekuensi CIP direncanakan", "4×/tahun per train"],
    ["Kontingensi bloom", "Titik injeksi PAC bubuk 10–20 mg/L, cadangan Rp 26/m³ untuk 60 hari/tahun"],
  ],
));

body.push(new Paragraph({ pageBreakBefore: true, children: [] }));
body.push(...decision(
  "4.5", "Koreksi pH — ke berapa, dan mengapa perlu?",
  "Pertanyaan: air baku pH 8,5 dan itu masih dalam rentang layak. Mengapa diturunkan ke 6,9?",
  "Diturunkan ke 6,9 dengan asam sulfat, sebelum koagulasi, dengan kendali umpan-balik.",
  [
    { opt: "Biarkan pH 8,5", why: "Koagulan berbasis aluminium (PAC) bekerja optimal pada pH 6–7. Pada 8,5, aluminium larut kembali sebagai aluminat, flok tidak terbentuk baik, dan dosis harus dinaikkan berlipat untuk hasil yang lebih buruk. Ini penalti ganda: bahan kimia lebih banyak, hasil lebih jelek.", verdict: "kalah" },
    { opt: "Turunkan ke 6,9 dengan dosis tetap", why: "Arah benar, kendali salah. pH waduk berayun harian 7,8–9,2 karena siklus fotosintesis alga (asumsi A6). Dosis tetap akan meleset setiap hari — kadang kurang, kadang berlebih.", verdict: "kalah" },
    { opt: "Turunkan ke 6,9 dengan kendali umpan-balik", why: "Kendali kaskade pH-debit menyesuaikan dosis mengikuti ayunan harian. Untuk air yang pH-nya bergerak sendiri sepanjang hari, ini keharusan, bukan pilihan.", verdict: "dipilih" },
  ],
  "Kalau jenis koagulan diganti — misalnya garam besi yang optimum pada pH lebih rendah lagi, atau koagulan polimer yang tidak sensitif pH — target pH-nya berubah. Jar test yang menentukan, bukan tabel.",
  [
    ["pH air baku", "8,5, berayun harian 7,8–9,2 karena fotosintesis (asumsi A6)"],
    ["pH optimum PAC", "6–7. Di luar itu aluminium larut kembali sebagai aluminat"],
    ["Target", "6,9"],
    ["Dosis H₂SO₄", "15 g/m³ air baku — Rp 51/m³"],
    ["Dosis PAC", "25 g/m³ — Rp 100/m³, pos kimia terbesar"],
    ["Kendali", "Kaskade pH-debit. Dosis tetap pasti meleset pada air yang pH-nya bergerak sendiri"],
  ],
));

/* ============================================== 5 keputusan RO & hilir */
body.push(new Paragraph({ pageBreakBefore: true, children: [] }), H1("5  Keputusan 9–10: Membran dan Hilir"));

body.push(...decision(
  "5.1", "Berapa train RO?",
  "Pertanyaan: dua train sudah cukup untuk titik desain. Mengapa tiga?",
  "Tiga, dan alasannya bukan redundansi mekanikal melainkan musim kemarau.",
  [
    { opt: "Dua train", why: "Cukup untuk kondisi normal — porsi RO 26,7 % terpenuhi. Tetapi saat TDS air baku naik ke 450 mg/L di kemarau, porsi yang dibutuhkan naik ke sekitar 34 %, dan dua train tidak sampai. Spesifikasi TDS langsung gagal pada bulan terpanas.", verdict: "kalah" },
    { opt: "Dua train besar", why: "Luas membran total sama sehingga kapasitas puncak terjaga. Yang hilang adalah cadangan: saat satu train dibersihkan (CIP 4×/tahun × 8 jam), produksi harus diturunkan 10 % agar TDS tetap di bawah 300.", verdict: "layak" },
    { opt: "Tiga train", why: "Kapasitas puncak kemarau terpenuhi DAN ada cadangan saat CIP. Untuk kontrak pasokan 15 tahun ke tenant industri, satu hari berhenti pasok berbiaya jauh melebihi selisih CAPEX-nya.", verdict: "dipilih" },
  ],
  "Asumsi A5 — TDS puncak kemarau — yang menentukannya sendirian. Kalau sampling setahun menunjukkan TDS tidak pernah melewati 400, dua train cukup dan CAPEX turun Rp 1,1 miliar. Kalau ternyata melewati 500, tiga train pun perlu diperiksa ulang. Inilah alasan sampling empat musim berada di urutan pertama daftar langkah lanjut.",
  [
    ["Porsi RO titik desain", "26,7 % produk — TDS 278 mg/L"],
    ["Porsi minimum untuk 300", "20,7 % — tanpa margin"],
    ["Porsi saat kemarau (TDS 450)", "34,2 % — dua train tidak sampai"],
    ["Kapasitas maksimum 3 train", "40 % — cukup, dengan margin"],
    ["Kapasitas per train", "24 m³/jam permeat, 36 elemen 8 inci"],
    ["Selisih CAPEX 3 vs 2 train", "Rp 1,1 miliar"],
    ["Biaya berhenti pasok", "Jauh melebihi Rp 1,1 miliar untuk kontrak 15 tahun"],
  ],
));

body.push(spacer());
body.push(box("Yang perlu Anda tahu tentang perdebatan rejeksi membran", [
  "Pertanyaan yang mungkin muncul: \"kalau rejeksi membrannya lebih tinggi, apakah train bisa dikurangi?\"",
  `Jawabannya tidak, dan itu sudah diuji. Menaikkan rejeksi TDS dari 97,5 % ke 98,5 % memperbaiki permeat dari ${f(RS[0].permeate_TDS, 1)} menjadi ${f(RS[1].permeate_TDS, 1)} mg/L, tetapi porsi RO yang dibutuhkan hanya bergeser ${f(RS[0].shareDry.share - RS[1].shareDry.share, 1)} poin.`,
  "Sebabnya aritmetika pencampuran di Bab 3.3: yang menentukan TDS produk adalah BYPASS, bukan permeat. Bypass membawa TDS penuh dan porsinya jauh lebih besar. Memperbaiki permeat dari 17 ke 10 mg/L hanya menggeser produk sekitar 2 mg/L.",
  "Ini jawaban yang kuat karena menunjukkan Anda sudah menguji sensitivitasnya, bukan sekadar memilih angka.",
], OK, "0E7C5A"));

body.push(new Paragraph({ pageBreakBefore: true, children: [] }));
body.push(...decision(
  "5.2", "Lumpur — diolah di tapak atau dikirim keluar?",
  "Pertanyaan: lumpurnya hanya 0,87 ton/hari. Perlukah pengental dan screw press?",
  "Diolah di tapak: pengental gravitasi lalu screw press, menghasilkan cake 18 % DS.",
  [
    { opt: "Kirim keluar sebagai cairan", why: "Menghapus dua unit dan membebaskan sekitar 160 m² lahan. Tetapi lumpur cair pada 1–3 % padatan berarti mengangkut 97 % air. Biaya angkut melonjak dan menjadi biaya operasi permanen — menukar CAPEX satu kali dengan OPEX seumur kontrak.", verdict: "kalah" },
    { opt: "Pengental + screw press", why: "Memekatkan ke 18 % DS sehingga volume angkut turun sekitar sepuluh kali. Screw press cocok untuk skala kecil dan berjalan intermiten 8 jam/hari.", verdict: "dipilih" },
    { opt: "Pengental + geobag", why: "Lebih murah CAPEX-nya sekitar Rp 2 miliar dan tidak butuh listrik. Tetapi bergantung cuaca, butuh lahan penjemuran, dan penanganannya manual. Muncul sebagai opsi rekayasa nilai (Opsi C).", verdict: "layak" },
  ],
  "Kalau ada pengolah lumpur pihak ketiga di sekitar SIER dengan tarif rendah untuk lumpur cair, perhitungannya berubah. Untuk 0,87 ton/hari, batas impasnya cukup sensitif terhadap tarif angkut.",
  [
    ["Padatan kering", "157 kg/hari — TSS 98 + alga 39 + Al(OH)₃ 20"],
    ["Cake pada 18 % DS", "0,87 ton/hari"],
    ["Kalau dikirim cair pada 2 % DS", "±7,9 ton/hari — sembilan kali lipat volume angkut"],
    ["Tarif pembuangan", "Rp 350.000/ton cake basah (asumsi A14)"],
    ["Biaya pembuangan", "Rp 71/m³, atau 2,6 % OPEX"],
    ["Lahan dewatering", "160 m². Menghapusnya membebaskan 8 % lahan"],
  ],
));

/* ================================================== 6 yang tidak dipilih */
body.push(new Paragraph({ pageBreakBefore: true, children: [] }), H1("6  Ringkasan: Semua yang Tidak Dipilih"));
body.push(P("Satu tabel untuk dibaca ulang sebelum masuk ruangan."));
body.push(table(["Yang tidak dipilih", "Alasan satu kalimat"], [
  ["IPA konvensional saja", "Tidak menyisihkan padatan terlarut sama sekali — produk 375 mg/L"],
  ["RO seluruh aliran", "Membayar penuh untuk penyisihan 18 %; OPEX ±Rp 4.500/m³ dan produknya agresif"],
  ["Pelunakan kapur", "Membuang justru kalsium dan alkalinitas yang membuat air stabil; lumpur besar; pH naik"],
  ["Nanofiltrasi", "Meloloskan natrium dan klorida — air lunak dan agresif, dan tidak bisa merespons kenaikan TDS kemarau yang monovalen"],
  ["Penukar ion", "Regeneran sebanding ekuivalen yang disisihkan; efluen regenerasi butuh izin tersendiri"],
  ["Elektrodialisis", "Paling cocok secara prinsip, tetapi dukungan purnajual di Indonesia tipis dan CCEPC tanpa rekam jejak"],
  ["Sedimentasi gravitasi", "Flok alga mengapung dan lolos; butuh 260 m² dibanding 70 m²"],
  ["Filtrasi langsung", "Alga menyumbat filter dalam hitungan jam"],
  ["Klorinasi dosis tinggi", "Memecah sel alga dan melepaskan toksin terlarut yang tidak bisa disaring"],
  ["Dosis asam tetap", "pH waduk berayun harian 7,8–9,2; dosis tetap pasti meleset"],
  ["Dua train RO", "Gagal spesifikasi TDS saat kemarau"],
  ["Kirim lumpur cair", "Mengangkut 97 % air; menukar CAPEX satu kali dengan OPEX seumur kontrak"],
], [2900, 6500]));

/* ============================================ 7 pertanyaan direktur */
body.push(new Paragraph({ pageBreakBefore: true, children: [] }), H1("7  Pertanyaan yang Akan Diajukan, dan Jawabannya"));
body.push(P(
  "Disusun menurut kemungkinan munculnya. Jawaban terkuat selalu menyebut angka dan menyatakan syarat batalnya.",
));

const qa: [string, string][] = [
  ["Kenapa tidak IPA biasa saja? Kan cuma 365 ke 300.",
    "Karena koagulasi dan filtrasi menyisihkan padatan tersuspensi, bukan terlarut. Angka TDS keluar sama persis dengan masuk — bahkan naik sedikit ke 375 karena koagulan dan asam. Kekeruhan 15 ke 1 NTU memang rutin; TDS-nya yang tidak bisa dikerjakan unit konvensional mana pun."],
  ["Kenapa RO-nya cuma sepertiga? Kenapa tidak semua?",
    "Karena yang dibutuhkan cuma penyisihan 18 %. RO membayar energi sebanding volume yang dilewatkan, bukan garam yang disisihkan. RO penuh keluar sekitar Rp 4.500/m³ terhadap plafon Rp 3.000, dan produknya 12 mg/L — agresif terhadap pipa, malah butuh remineralisasi. Split-stream keluar 278 mg/L dengan alkalinitas ±90, stabil apa adanya."],
  ["Kenapa DAF? Air 15 NTU itu ringan, clarifier biasa cukup.",
    "Kalau bebannya lempung, benar. Tetapi airnya hijau — bebannya sel alga, dan flok alga mengapung. Di clarifier gravitasi dia lolos ke atas lalu ke filter dan meracuni membran. DAF justru memakai sifat itu. Tambahan lagi DAF 70 m² dibanding sedimentasi 260 m², dan lahan kita 2.000 m² yang sudah 90 % terpakai."],
  ["Berapa akurasi CAPEX-nya?",
    "±30–50 %, kelas kelayakan AACE Class 4/5, dari daftar peralatan bukan penawaran vendor. Untuk keputusan investasi perlu budgetary quote minimal untuk paket RO, DAF, dan genset. Selisih Rp 53 M dan Rp 44 M masih di dalam derau estimasi ini — pertanyaan sebenarnya bukan berapa angkanya, tetapi kelas pabrik seperti apa yang dibeli."],
  ["Kenapa tiga train RO, bukan dua? Kelihatannya berlebihan.",
    "Bukan redundansi. Di kemarau TDS baku naik ke 450 dan porsi RO harus naik ke sekitar 34 %; dua train tidak sampai dan spesifikasi TDS gagal di bulan terpanas. Train ketiga itu kapasitas musiman, bukan cadangan. Yang menentukan angkanya adalah asumsi A5, dan itu asumsi yang paling perlu divalidasi lewat sampling."],
  ["Risiko terbesarnya apa?",
    "Bukan teknis. Pajak Air Permukaan. Kami asumsikan Rp 150/m³; kalau Bapenda Jatim menetapkan nilai perolehan air Rp 500/m³ untuk penjualan komersial, OPEX jadi Rp 3.133/m³ dan target gagal. Tidak ada desain yang bisa menyelamatkannya. Penyelesaiannya administratif dan harus dilakukan sebelum harga dikunci."],
  ["Kalau OPEX-nya meleset, apa penyebab paling mungkin?",
    "Pemanfaatan kapasitas. 44 % biaya bersifat tetap, dan titik impasnya di 82 % pemanfaatan. Di bawah itu target terlewati tanpa satu pun kesalahan teknis. Kontrak dengan SIER wajib punya klausul take-or-pay minimum."],
  ["Apa yang paling bisa menurunkan OPEX?",
    "Bukan proses. Titik serah. Pompa distribusi ke SIER menyumbang 29 % tagihan listrik — pos terbesar, lebih besar dari RO yang cuma 19 %. Kalau titik serah bisa dinegosiasikan di pagar pabrik, OPEX turun Rp 197/m³, lebih besar daripada hampir semua pilihan desain proses yang tersedia."],
  ["Yang belum pasti apa?",
    "SDI umpan RO. Simulasi menunjukkan sekitar 4 terhadap batas 3 pada konfigurasi filter dual-media. Kalau uji pilot membuktikan tidak bisa ditahan di bawah 3 saat musim bloom, pra-olah harus naik ke ultrafiltrasi — CAPEX +Rp 4 miliar dan OPEX +Rp 120/m³. Jauh lebih baik diketahui sekarang daripada setelah kontrak."],
  ["Kenapa nanofiltrasi tidak dipakai? Kan lebih hemat energi.",
    "Benar lebih hemat. Tetapi NF menahan ion divalen dan meloloskan natrium dan klorida, sehingga produknya lunak dan agresif terhadap jaringan. Dan kalau TDS kemarau naik, kenaikannya sebagian besar monovalen — persis yang paling buruk ditahan NF. Teknologi yang tidak bisa merespons kondisi terburuk bukan pilihan untuk kontrak 15 tahun."],
  ["Airnya aman untuk industri? Ada alga dan mungkin toksin.",
    "DAF menyisihkan sel alga utuh, dan RO menahan mikrosistin terlarut kalau ada. Yang kami jaga adalah jangan sampai selnya pecah lebih awal — karena itu dosis praoksidasi dibatasi 1,5 mg/L, bukan dimaksimalkan. Pemantauan mikrosistin mingguan saat musim bloom, dan titik injeksi karbon aktif disiapkan sejak konstruksi sebagai kontingensi."],
  ["Kalau harus turun ke Rp 40 miliar, apa yang dikorbankan?",
    "Rp 9,2 miliar pertama tidak menyentuh proses sama sekali — hanya cara membangun: baja fabrikasi menggantikan beton, SCADA disederhanakan, genset dikecilkan. Rp 4 miliar terakhir yang mengubah unit proses: filter tekan menggantikan filter gravitasi (visibilitas media hilang, risiko mudball naik), RO tiga train jadi dua (cadangan hilang), flokulasi mekanik jadi hidrolik (nilai G tidak bisa disetel padahal kekeruhan berayun 15 ke 80 NTU)."],
];
body.push(table(["Pertanyaan", "Jawaban"], qa.map(([q, a]) => [{ v: q, b: true }, a]), [2900, 6500]));

/* =================================================== 8 angka hafalan */
body.push(new Paragraph({ pageBreakBefore: true, children: [] }), H1("8  Angka yang Harus Dihafal"));
body.push(P("Dua belas angka. Kalau hanya sempat menghafal ini, sudah cukup untuk bertahan di ruangan."));
body.push(table(["Angka", "Artinya"], [
  ["18 %", "Penyisihan TDS yang dibutuhkan — 365 ke 300. Angka pembuka seluruh argumen"],
  ["375 mg/L", "TDS air tersaring tanpa RO. Bukti bahwa konvensional saja gagal"],
  ["26,7 %", "Porsi produk dari permeat pada titik desain"],
  ["278 mg/L", "TDS produk. Margin 7 % dari batas 300"],
  ["34,2 %", "Porsi yang dibutuhkan saat kemarau. Alasan train ketiga"],
  ["87,8 %", "Recovery pabrik — 180 dari 205 m³/jam"],
  ["Rp 2.734/m³", "OPEX. Margin Rp 266 dari plafon Rp 3.000"],
  ["Rp 53 / 44 / 40 M", "CAPEX tiga opsi. Akurasi ±30–50 %"],
  ["29 % vs 19 %", "Pompa distribusi vs RO dalam tagihan listrik. Fakta yang mengejutkan"],
  ["1.794 m²", "Lahan terpakai dari 2.000 m². Tidak ada ruang tumbuh"],
  ["SDI < 3", "Syarat umpan RO. Risiko teknis terbuka terbesar"],
  ["82 %", "Titik impas pemanfaatan kapasitas. Alasan take-or-pay"],
], [2000, 7400]));

body.push(spacer());
body.push(box("Tiga kalimat penutup untuk presentasi", [
  "\"Yang menentukan desain ini bukan kekeruhannya, tapi TDS-nya — dan padatan terlarut tidak tersentuh pengolahan konvensional sama sekali.\"",
  "\"Kami tidak mengolah semua air dengan RO, karena yang dibutuhkan cuma 18 %. Hanya sepertiga yang lewat membran, sisanya di-bypass dan dicampur balik. Itu yang membuat OPEX-nya Rp 2.734, bukan Rp 4.500.\"",
  "\"Yang belum pasti dan harus kami buktikan lewat uji pilot ada satu: SDI umpan RO. Sisanya sudah terkunci dengan asumsi yang terdaftar.\"",
], OK, "0E7C5A"));

body.push(spacer());
body.push(box("Batasan dokumen ini", [
  "Angka proses berasal dari mesin simulasi HydroDesk dan dokumen desain; keduanya sepakat dalam 0,2 % pada seluruh aliran.",
  "CAPEX, OPEX, dan kebutuhan lahan dikutip dari dokumen desain, bukan dihitung ulang.",
  "Seluruh alasan pemilihan proses berlaku sejauh asumsi A1–A16 terkonfirmasi. Yang paling menentukan dan paling belum pasti: A5 (TDS puncak kemarau), A2 (jenis dan kepadatan alga), dan A13 (pajak air).",
  "Tidak ada satu pun keputusan di sini yang telah divalidasi lewat jar test maupun uji pilot.",
], ALT, NAVY));

const doc = new Document({
  creator: "PT CCEPC Indonesia",
  title: "Logika Pemilihan Proses — WTP Sagara 50 L/detik",
  styles: { default: { document: { run: { font: "Calibri", size: 20 } } } },
  sections: [{ properties: { page: { margin: { top: 1000, bottom: 1000, left: 1000, right: 1000 } } }, children: body }],
});

void Packer.toBuffer(doc).then((buf) => {
  const out = "scripts/out/WTP Sagara - Logika Pemilihan Proses (ID).docx";
  writeFileSync(out, buf);
  console.log(`Wrote ${out}  (${(buf.length / 1024).toFixed(0)} kB)`);
});
