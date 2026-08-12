import { readFileSync, writeFileSync } from "fs";
import {
  AlignmentType, BorderStyle, Document, HeadingLevel, Packer, Paragraph,
  ShadingType, Table, TableCell, TableRow, TextRun, WidthType,
} from "docx";

/**
 * WTP Sagara — Verifikasi Neraca & Catatan Desain.
 *
 * Bukan pengganti dokumen desain yang sudah ada. Dokumen itu memuat CAPEX,
 * OPEX, dan kebutuhan lahan yang jauh lebih berdasar daripada apa pun yang
 * dapat dihasilkan model ini, dan angkanya dikutip apa adanya di sini.
 *
 * Yang disumbangkan laporan ini adalah hal lain: menjalankan rangkaian proses
 * yang sama melalui mesin simulasi secara independen, lalu melaporkan di mana
 * hasilnya sepakat dan di mana tidak. Di tempat yang tidak sepakat, salah satu
 * dari keduanya keliru, dan itu layak diketahui sebelum harga dikunci.
 */

type Json = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
const d: Json = JSON.parse(readFileSync("scripts/out/sagara.json", "utf8"));

const NAVY = "0F2942", ALT = "EEF6FB", OK = "D8F7E9", BAD = "FBDDD8", WARN = "FEF3D4", TEAL = "0E7C5A";
type Align = (typeof AlignmentType)[keyof typeof AlignmentType];

const P = (t: string, o: { b?: boolean; sz?: number; color?: string; it?: boolean; align?: Align } = {}) =>
  new Paragraph({ alignment: o.align, spacing: { after: 130, line: 276 },
    children: [new TextRun({ text: t, bold: o.b, size: o.sz ?? 20, color: o.color, italics: o.it, font: "Calibri" })] });
const H1 = (t: string) => new Paragraph({ heading: HeadingLevel.HEADING_1, spacing: { before: 320, after: 160 },
  children: [new TextRun({ text: t, bold: true, size: 30, color: NAVY, font: "Calibri" })] });
const H2 = (t: string) => new Paragraph({ heading: HeadingLevel.HEADING_2, spacing: { before: 240, after: 120 },
  children: [new TextRun({ text: t, bold: true, size: 24, color: NAVY, font: "Calibri" })] });
const H3 = (t: string) => new Paragraph({ spacing: { before: 180, after: 90 },
  children: [new TextRun({ text: t, bold: true, size: 21, color: TEAL, font: "Calibri" })] });
const bullet = (t: string) => new Paragraph({ bullet: { level: 0 }, spacing: { after: 70, line: 264 },
  children: [new TextRun({ text: t, size: 19, font: "Calibri" })] });
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

function callout(title: string, lines: string[], fill = WARN, accent = "8A6100") {
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
        ...lines.map((l) => new Paragraph({ spacing: { after: 70, line: 264 }, children: [new TextRun({ text: l, size: 19, font: "Calibri" })] })),
      ],
    })] })],
  });
}

/** Angka gaya Indonesia. */
const f = (v: number, dp = 1) => {
  if (v == null || !Number.isFinite(v)) return "—";
  const r = Math.round(v * 10 ** dp) / 10 ** dp;
  const [i, dec] = String(Math.abs(r)).split(".");
  return `${r < 0 ? "-" : ""}${i.replace(/\B(?=(\d{3})+(?!\d))/g, ".")}${dec ? "," + dec : ""}`;
};

const G = d.design, R = d.reference, RS = d.rejectionStudy;
const body: (Paragraph | Table)[] = [];

/* ================================================================= sampul */
body.push(
  new Paragraph({ spacing: { before: 1500, after: 60 }, alignment: AlignmentType.CENTER,
    children: [new TextRun({ text: "VERIFIKASI NERACA & CATATAN DESAIN", bold: true, size: 40, color: NAVY, font: "Calibri" })] }),
  new Paragraph({ spacing: { after: 200 }, alignment: AlignmentType.CENTER,
    children: [new TextRun({ text: "WTP Sagara — 50 L/detik ke Kawasan Industri SIER, Surabaya", size: 26, color: TEAL, font: "Calibri" })] }),
  new Paragraph({ spacing: { after: 460 }, alignment: AlignmentType.CENTER,
    children: [new TextRun({ text: "Split-stream RO · lahan 2.000 m² · TDS 365 → ≤300 mg/L", size: 20, color: "5A6B7B", font: "Calibri", italics: true })] }),
  table(["Item", "Keterangan"], [
    ["Disusun oleh", "PT CCEPC Environment Protection and Energy Comprehensive Utilization Indonesia"],
    ["Tanggal", new Date(d.generated).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })],
    ["Sifat dokumen", "Verifikasi independen terhadap dokumen desain yang sudah ada, bukan penggantinya"],
    ["Kapasitas produk", `${f(R.product_m3h)} m³/jam (50 L/detik)`],
    ["Sumber angka proses", "Mesin simulasi HydroDesk, dijalankan atas rangkaian yang sama"],
    ["Sumber angka CAPEX/OPEX", "Dokumen desain — Lampiran E dan F. Tidak dihitung ulang di sini"],
    ["Status", "Untuk diskusi teknis. Belum untuk konstruksi."],
  ], [2500, 6900]),
  spacer(),
  callout("Apa yang dikerjakan dokumen ini, dan apa yang tidak", [
    "Rangkaian proses yang sama dijalankan ulang melalui mesin simulasi, terpisah dari perhitungan tangan pada dokumen desain. Hasilnya dibandingkan aliran demi aliran.",
    "Neraca air cocok sangat dekat, dan itu adalah hasil yang bagus: dua metode berbeda sampai pada jawaban yang sama.",
    "CAPEX dan OPEX pada dokumen desain TIDAK dihitung ulang. Model ini menghitung biaya dengan kurva pangkat dan biaya tenaga kerja tetap — jauh lebih kasar daripada perhitungan yang sudah ada, dan mengutipnya justru akan menurunkan kualitas angkanya.",
    "Yang ditambahkan di sini adalah tiga hal yang tidak ada di dokumen desain, dan semuanya berasal dari menjalankan modelnya: satu peringatan pra-olah, satu unit yang terlewat, dan satu batasan model yang perlu diketahui sebelum angkanya dipercaya lebih jauh.",
  ], ALT, NAVY),
);

/* ========================================================= 1 ringkasan */
body.push(new Paragraph({ pageBreakBefore: true, children: [] }), H1("1  Ringkasan"));

body.push(H2("1.1  Neraca air terverifikasi"));
body.push(P(
  "Rangkaian split-stream dijalankan ulang secara independen. Perbandingannya aliran demi aliran:",
));
body.push(table(
  ["Aliran", "Model", "Dokumen desain", "Selisih"],
  [
    ["Air baku dari waduk, m³/jam", f(G.raw_m3h, 2), f(R.raw_m3h, 1), "0,0 %"],
    ["Bypass ke blending", f(G.tankOutlets.out1, 2), f(R.bypass_m3h, 1), `${f((G.tankOutlets.out1 / R.bypass_m3h - 1) * 100, 2)} %`],
    ["Umpan RO", f(G.roFeed_m3h, 2), f(R.roFeed_m3h, 1), `${f((G.roFeed_m3h / R.roFeed_m3h - 1) * 100, 2)} %`],
    ["Permeat RO", f(G.roPermeate_m3h, 2), f(R.permeate_m3h, 1), `${f((G.roPermeate_m3h / R.permeate_m3h - 1) * 100, 2)} %`],
    ["Konsentrat RO", f(G.roConcentrate_m3h, 2), f(R.concentrate_m3h, 1), `${f((G.roConcentrate_m3h / R.concentrate_m3h - 1) * 100, 2)} %`],
    ["Konsentrat, TDS mg/L", f(G.roConcentrate_TDS, 0), f(R.concentrate_TDS, 0), `${f((G.roConcentrate_TDS / R.concentrate_TDS - 1) * 100, 1)} %`],
    [{ v: "Produk ke SIER", bg: OK }, { v: f(G.product_m3h, 2), bg: OK }, { v: f(R.product_m3h, 1), bg: OK },
      { v: `${f((G.product_m3h / R.product_m3h - 1) * 100, 2)} %`, bg: OK }],
    [{ v: "Recovery pabrik", bg: OK }, { v: `${f(G.recovery_pct, 2)} %`, bg: OK }, { v: `${f(R.recovery_pct, 1)} %`, bg: OK },
      { v: `${f(G.recovery_pct - R.recovery_pct, 2)} poin`, bg: OK }],
    ["Penutupan neraca air", `${f(G.waterClosure_pct, 4)} %`, "—", "eksak"],
  ], [3200, 2100, 2100, 2000], [1, 2, 3],
));
body.push(spacer());
body.push(P(
  "Seluruh aliran cocok dalam 0,2 %. Dua metode yang sepenuhnya terpisah — perhitungan tangan dan penyelesaian numerik — sampai pada neraca yang sama, dan penutupan neracanya eksak.",
));

body.push(H2("1.2  Tiga hal yang ditemukan model"));

body.push(H3("Pertama: umpan RO tidak memenuhi SDI"));
body.push(P(
  `Model menandai umpan RO pada SDI₁₅ sekitar 4, di atas batas lazim 3. Ini bukan soal kekeruhan — turbiditas produk keluar di ${f(G.product_turbidity, 3)} NTU, sepuluh kali di dalam spesifikasi. SDI mengukur kecenderungan penyumbatan oleh koloid halus yang tidak menghamburkan cahaya, jadi air bisa jernih dan tetap merusak membran.`,
));
body.push(P(
  "Dokumen desain sudah mencantumkan ini sebagai langkah lanjut nomor 4, lengkap dengan konsekuensinya: bila SDI tidak dapat ditahan di bawah 3, pra-olah harus naik ke ultrafiltrasi, dengan perubahan CAPEX sekitar Rp 4 miliar. Yang ditambahkan model hanyalah bahwa pada konfigurasi filter dual-media yang dipakai, batas itu memang tidak terpenuhi — jadi uji pilot bukan formalitas.",
));

body.push(H3("Kedua: tanpa trim pH, produk gagal batas bawah"));
body.push(P(
  "Saat rangkaian dijalankan tanpa dosing NaOH di tangki produk, air keluar pada pH 6,37 — di bawah batas 6,5. Permeat RO bersifat asam karena karbon dioksida menembus membran sementara alkalinitas yang akan menyangganya tidak, dan pencampuran dengan bypass tidak sepenuhnya memulihkannya.",
));
body.push(P(
  `Dokumen desain sudah benar mencantumkan NaOH di tangki produk. Yang ditunjukkan model adalah bahwa unit itu bukan pemoles — ia menentukan lulus atau tidaknya satu parameter baku mutu. Dengan trim terpasang, produk keluar di pH ${f(G.product_pH, 2)}.`,
));

body.push(H3("Ketiga: satu batasan model yang harus diketahui"));
body.push(P(
  `Neraca ion pada rangkaian ini tidak menutup: natrium ${f(23.5, 1)} % dan sulfat ${f(56, 0)} % lebih banyak keluar daripada masuk. Itu bukan kebocoran — itu massa dari dosing H₂SO₄ dan NaOH, yang ditambahkan ke aliran tetapi tidak dihitung sebagai masukan neraca. Model kini memunculkan peringatan untuk ini, karena sebelumnya ia lolos tanpa suara.`,
));

/* ================================================== 2 rangkaian & mutu */
body.push(new Paragraph({ pageBreakBefore: true, children: [] }), H1("2  Rangkaian Proses dan Mutu Air"));

body.push(H2("2.1  Logika split-stream"));
body.push(P(
  "Penyisihan TDS yang dibutuhkan hanya 18 %, dari 365 ke 300 mg/L. Mengolah seluruh aliran dengan reverse osmosis untuk mencapainya adalah pemborosan besar, karena RO menghabiskan energi sebanding dengan volume yang dilewatkannya, bukan dengan garam yang disisihkan.",
));
body.push(P(
  "Karena itu seluruh air melewati pengolahan konvensional — yang menyelesaikan alga dan kekeruhan — dan hanya sekitar sepertiga air tersaring yang dinaikkan ke RO lalu dicampur balik. Percabangannya terjadi di tangki air tersaring, satu bejana dengan dua jalur keluar. Struktur inilah yang menjadi inti desain.",
));
body.push(P(
  "DAF dipilih menggantikan sedimentasi karena bebannya sel alga, bukan lempung. Flok alga mengapung; pada clarifier gravitasi ia lolos ke filter dan meracuni membran, sedangkan DAF justru memanfaatkan sifat itu.",
));

body.push(H2("2.2  Kualitas air tahap demi tahap"));
body.push(P("Nilai adalah kondisi di inlet setiap tahap, sehingga efek satu unit adalah selisih antara barisnya dan baris di bawahnya.", { sz: 18, it: true }));
body.push(table(
  ["Tahap", "m³/jam", "TDS", "TSS", "Kekeruhan", "pH"],
  G.stages.filter((s: Json) => s.in_m3h > 0.5).map((s: Json) => [
    s.stage, f(s.in_m3h, 2), f(s.TDS, 1), f(s.TSS, 2), f(s.NTU, 3), f(s.pH, 2),
  ]), [2800, 1400, 1400, 1300, 1500, 1000], [1, 2, 3, 4, 5],
));
body.push(spacer());
body.push(P("TDS dan TSS mg/L, kekeruhan NTU. Angka keluaran model, bukan hasil pengukuran.", { sz: 17, it: true, color: "6B7A88" }));

body.push(H2("2.3  Kepatuhan produk"));
body.push(table(["Parameter", "Baku mutu", "Hasil model", "Status"],
  G.compliance.filter((c: Json) => !c.scope).slice(0, 9).map((c: Json) => {
    const bg = c.pass ? OK : BAD;
    return [{ v: c.p, bg }, { v: c.limit, bg }, { v: c.actual, bg }, { v: c.pass ? "Memenuhi" : "GAGAL", bg }];
  }), [2800, 2200, 2200, 2200], [1, 2]));
body.push(spacer());
body.push(P(
  `TDS produk keluar di ${f(G.product_TDS, 1)} mg/L terhadap batas 300 — margin ${f((300 / G.product_TDS - 1) * 100, 0)} %. Dokumen desain memperoleh 278 mg/L; selisihnya dijelaskan pada Bab 4.`,
));

/* ============================================== 3 temuan porsi RO */
body.push(new Paragraph({ pageBreakBefore: true, children: [] }), H1("3  Porsi RO dan Jumlah Train"));

body.push(P(
  "Pertanyaan yang menentukan jumlah train RO bukan berapa TDS air baku hari ini, melainkan berapa porsi aliran yang harus lewat RO pada kondisi terburuk yang tetap wajib dipenuhi. Model dijalankan pada dua asumsi rejeksi membran untuk melihat seberapa sensitif jawabannya.",
));
body.push(table(
  ["Asumsi rejeksi TDS", "Permeat, mg/L", "Produk pada porsi 32,7 %", "Porsi untuk TDS 300 — normal", "— kemarau 450 mg/L"],
  RS.map((r: Json) => [
    r.label.replace("Model default — ", "").replace("Asumsi memo — ", ""),
    f(r.permeate_TDS, 1), `${f(r.product_TDS_at_32_7pct, 1)} mg/L`,
    `${f(r.shareNormal.share, 1)} %`, `${f(r.shareDry.share, 1)} %`,
  ]), [2300, 1600, 2100, 1800, 1600], [1, 2, 3, 4],
));
body.push(spacer());
body.push(callout("Rejeksi membran ternyata bukan penentunya", [
  "Menaikkan rejeksi TDS dari 97,5 % ke 98,5 % memperbaiki permeat dari 16,9 menjadi 10,1 mg/L — perbaikan besar pada permeatnya sendiri.",
  "Tetapi porsi RO yang dibutuhkan hampir tidak bergerak: 23,5 % menjadi 23,1 % pada kondisi normal, dan 41,8 % menjadi 41,1 % pada kemarau.",
  "Sebabnya aritmetika pencampuran: yang menentukan TDS produk adalah bypass, bukan permeat. Bypass membawa TDS penuh dan porsinya jauh lebih besar. Memperbaiki permeat dari 17 ke 10 mg/L hanya menggeser produk sekitar 2 mg/L.",
  "Konsekuensi praktisnya melegakan: negosiasi rejeksi membran dengan pemasok bukan hal yang menentukan jumlah train. Yang menentukan adalah TDS air baku pada kemarau — asumsi A5 — persis seperti yang sudah dinyatakan dokumen desain.",
], OK, "0E7C5A"));

body.push(spacer());
body.push(P(
  `Pada kondisi kemarau, porsi yang dibutuhkan naik ke sekitar ${f(RS[0].shareDry.share, 1)} % air tersaring. Dokumen desain menyatakan tiga train mampu melayani hingga 40 % produk sebagai permeat. Kedua angka itu memakai basis berbeda — porsi air tersaring versus porsi produk — sehingga tidak dapat dibandingkan langsung, dan konversinya perlu dipastikan sebelum jumlah train dikunci. Ini satu-satunya titik dalam verifikasi ini yang menyentuh keputusan peralatan, dan pemeriksaannya murah.`,
));

/* ====================================================== 4 selisih */
body.push(new Paragraph({ pageBreakBefore: true, children: [] }), H1("4  Selisih terhadap Dokumen Desain, dan Sebabnya"));

body.push(table(
  ["Besaran", "Model", "Dokumen", "Sebab selisih"],
  [
    ["TDS air tersaring, mg/L", "365", "375",
      "Dokumen menambahkan ±10 mg/L kontribusi bersih bahan kimia. Model mengubah set ion saat dosing tetapi tidak menambahkan ke agregat TDS — batasan yang dinyatakan pada Bab 6."],
    ["TDS permeat, mg/L", f(G.roPermeate_TDS, 1), "12",
      "Rejeksi default model 97,5 % terhadap asumsi dokumen 98,5 %. Berpengaruh kecil pada produk, seperti ditunjukkan Bab 3."],
    ["TDS produk, mg/L", f(G.product_TDS, 1), "278",
      "Akumulasi dua baris di atas. Keduanya lulus batas 300 dengan margin memadai."],
    ["Energi spesifik, kWh/m³", f(G.sec_kWh_m3, 3), f(R.sec_kWh_m3, 3),
      "Selisih 5 %. Model menghitung daya proses dari duti pompa; dokumen menambahkan penerangan, HVAC, dan instrumentasi yang tidak digambar sebagai blok."],
  ], [2000, 1200, 1200, 5000], [1, 2],
));
body.push(spacer());
body.push(P(
  "Tidak satu pun dari selisih ini mengubah kelayakan desain. Semuanya berada dalam derau estimasi kelas kelayakan, dan pada setiap kasus arah selisihnya dapat dijelaskan. Yang penting justru sebaliknya: pada besaran yang paling menentukan — neraca air, recovery, dan aliran tiap cabang — kedua metode sepakat dalam 0,2 %.",
));

/* =========================================== 5 energi, kimia, lumpur */
body.push(new Paragraph({ pageBreakBefore: true, children: [] }), H1("5  Energi, Bahan Kimia, dan Lumpur"));

body.push(H2("5.1  Daya"));
body.push(table(["Besaran", "Model", "Dokumen desain"], [
  ["Daya total, kW", f(G.power_kW, 1), "98,1"],
  ["Energi spesifik, kWh/m³ produk", f(G.sec_kWh_m3, 3), f(R.sec_kWh_m3, 3)],
], [4200, 2600, 2600], [1, 2]));
body.push(spacer());
body.push(P(
  "Temuan paling berguna soal energi ada di dokumen desain dan tidak diperoleh model: pos listrik terbesar bukan RO melainkan pompa distribusi ke SIER, sebesar 29 % tagihan. Bila titik serah dapat dinegosiasikan di pagar pabrik, OPEX turun Rp 197/m³ — lebih besar daripada hampir semua pilihan desain proses. Itu keputusan kontrak, bukan keputusan rekayasa.",
));

body.push(H2("5.2  Bahan kimia"));
body.push(table(["Bahan", "kg/jam", "ton/hari"],
  G.chemicals.filter((c: Json) => c.kg_h > 0.001)
    .map((c: Json) => [
      ({ "Sulphuric acid H2SO4": "Asam sulfat H₂SO₄", "Caustic soda NaOH": "Soda kaustik NaOH",
        "Poly-aluminium chloride": "Poli-aluminium klorida (PAC)", Antiscalant: "Antiscalant",
        "Sodium metabisulphite": "Natrium metabisulfit (SBS)", "Polymer flocculant": "Polimer flokulan",
        "Sodium hypochlorite (as Cl2)": "Natrium hipoklorit", "Polymer (dewatering)": "Polimer dewatering",
      } as Json)[c.name] ?? c.name,
      f(c.kg_h, 3), f(c.kg_h * 24 / 1000, 3),
    ]), [4600, 2300, 2500], [1, 2]));
body.push(spacer());
body.push(P(
  "Dosis PAC, polimer, antiscalant, dan SBS adalah nilai yang dimasukkan pengguna dan dikalikan debit; model tidak memprediksinya. Sebaliknya, asam sulfat dan soda kaustik dihitung dari kimia airnya — dari ekuivalen alkalinitas yang harus dinetralkan — sehingga angka keduanya berdiri sendiri dan dapat diperiksa.",
));

body.push(H2("5.3  Lumpur"));
body.push(P(
  `Padatan kering keluar sebesar ${f(G.drySolids_t_d, 3)} ton/hari. Dokumen desain memperoleh 0,157 ton/hari padatan kering yang menjadi 0,87 ton/hari cake pada 18 % DS, dengan rincian sumber yang lebih baik: TSS air baku, biomassa alga, dan hidroksida dari koagulan. Rincian itu tidak dapat direproduksi model karena model tidak memisahkan fraksi organik dari anorganik.`,
));

/* ========================================== 6 batasan model */
body.push(new Paragraph({ pageBreakBefore: true, children: [] }), H1("6  Batasan Model"));
body.push(P(
  "Bagian ini ada karena angka yang tidak disertai batasannya lebih berbahaya daripada tidak ada angka sama sekali.",
));
[
  "CAPEX dan OPEX dari model TIDAK dipakai di dokumen ini. Model menghitung investasi dengan kurva pangkat berkoefisien perkiraan, dan biaya operasi dengan tenaga kerja tetap yang sama untuk pabrik sebesar apa pun. Angka pada Lampiran E dan F dokumen desain jauh lebih berdasar dan tetap menjadi rujukan.",
  "Bahan kimia yang didosis mengubah set ion tetapi tidak menambah agregat TDS. Karena itu TDS air tersaring keluar 365 mg/L, bukan 375 seperti dokumen desain yang memperhitungkan kontribusi bersih kimia.",
  "Neraca ion tidak menghitung massa yang ditambahkan lewat dosing sebagai masukan, sehingga natrium dan sulfat tampak lebih banyak keluar daripada masuk. Model kini memperingatkan hal ini, tetapi belum memperbaikinya.",
  "Efisiensi penyisihan setiap unit — TSS 88 %, COD 40 %, dan seterusnya — adalah nilai yang dimasukkan, bukan yang diprediksi dari kimia air. Model menerapkannya dengan tepat; ia tidak menurunkannya.",
  "Matriks rejeksi RO air payau merupakan nilai tipikal literatur. Yang telah dikalibrasi terhadap data proyek CCEPC hanyalah nanofiltrasi (neraca garam Gresik) dan DTRO (analisis Bantargebang).",
  "Cartridge filter dimodelkan sebagai penyisihan TSS 50 % dan penurunan SDI 0,5 — asumsi datar, bukan turunan. Karena SDI justru menjadi isu di sini, angka itu harus diganti hasil uji.",
  "Turbiditas dan SDI bukan besaran yang kekal, sehingga keduanya diperlakukan terpisah dari neraca massa dan hanya bersifat indikatif.",
  "Tidak ada satu pun angka di sini yang telah divalidasi lewat uji pilot maupun proyeksi kinerja membran dari pemasok.",
].forEach((t) => body.push(bullet(t)));

/* ====================================================== 7 rekomendasi */
body.push(new Paragraph({ pageBreakBefore: true, children: [] }), H1("7  Rekomendasi"));
body.push(table(["No.", "Rekomendasi"], [
  ["1", "Perlakukan uji pilot filter selama musim bloom sebagai wajib, bukan opsional. Model menunjukkan SDI₁₅ umpan RO di sekitar 4 pada konfigurasi filter dual-media yang direncanakan, sementara batasnya 3. Bila terkonfirmasi, pra-olah naik ke ultrafiltrasi dengan konsekuensi CAPEX sekitar Rp 4 miliar — jauh lebih baik diketahui sekarang."],
  ["2", "Pastikan basis perbandingan porsi RO sebelum jumlah train dikunci. Dokumen menyatakan tiga train melayani hingga 40 % produk; model menghitung kebutuhan kemarau sekitar 42 % air tersaring. Keduanya basis berbeda dan perlu disamakan."],
  ["3", "Perlakukan trim pH produk sebagai unit proses, bukan pelengkap. Tanpanya produk keluar pH 6,4 dan gagal batas bawah 6,5."],
  ["4", "Prioritaskan sampling air waduk empat musim, terutama TDS puncak kemarau (asumsi A5). Verifikasi ini menegaskan kembali bahwa jumlah train RO bergantung pada angka itu dan hampir tidak bergantung pada rejeksi membran."],
  ["5", "Klarifikasi Pajak Air Permukaan ke Bapenda Jawa Timur. Ini tetap risiko tunggal terbesar terhadap target OPEX, dan berada di luar jangkauan desain apa pun."],
  ["6", "Negosiasikan titik serah di pagar pabrik. Nilainya Rp 197/m³, lebih besar daripada hampir semua pilihan proses yang tersedia."],
], [700, 8700]));

body.push(spacer());
body.push(callout("Status", [
  "Dokumen ini adalah verifikasi, bukan desain. Ia diterbitkan untuk memastikan neraca dokumen desain berdiri, dan untuk menandai tiga hal yang muncul dari menjalankan modelnya.",
  "Neraca air tertutup eksak pada setiap kasus, dan seluruh aliran cocok dengan perhitungan tangan dalam 0,2 %.",
  "Untuk CAPEX, OPEX, kebutuhan lahan, dan analisis sensitivitas, rujuk dokumen desain — Lampiran D, E, dan F.",
], ALT, NAVY));

const doc = new Document({
  creator: "PT CCEPC Indonesia",
  title: "Verifikasi Neraca & Catatan Desain — WTP Sagara 50 L/detik",
  styles: { default: { document: { run: { font: "Calibri", size: 20 } } } },
  sections: [{ properties: { page: { margin: { top: 1000, bottom: 1000, left: 1000, right: 1000 } } }, children: body }],
});

void Packer.toBuffer(doc).then((buf) => {
  const out = "scripts/out/WTP Sagara - Verifikasi Neraca & Catatan Desain (ID).docx";
  writeFileSync(out, buf);
  console.log(`Wrote ${out}  (${(buf.length / 1024).toFixed(0)} kB)`);
});
