import { readFileSync, writeFileSync } from "fs";
import {
  AlignmentType, BorderStyle, Document, HeadingLevel, Packer, Paragraph,
  ShadingType, Table, TableCell, TableRow, TextRun, WidthType,
} from "docx";

/**
 * WTP Sagara — Teori, Perhitungan, dan Alasan Pemilihan Proses.
 *
 * Dokumen belajar. Dimulai dari apa yang ada di dalam air dan mengapa itu
 * menentukan segalanya, lalu enam alat hitung yang dipakai berulang di seluruh
 * desain, baru kemudian penerapannya ke Sagara. Perhitungan tiap unit diambil
 * langsung dari mesin simulasi supaya dokumen ini tidak bisa berbeda dari model.
 */

type Json = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
const d: Json = JSON.parse(readFileSync("scripts/out/sagara.json", "utf8"));
const A: Json = JSON.parse(readFileSync("scripts/out/sagara-alt.json", "utf8"));
const NFC = A.membraneCases.find((c: Json) => c.type === "nf");
const ROC = A.membraneCases.find((c: Json) => c.type === "ro");
const LIME = A.limeSoftening;
const G = d.design;
const U = (label: string) => G.units.find((x: Json) => x.label.startsWith(label));

const NAVY = "0F2942", ALT = "EEF6FB", OK = "D8F7E9", WARN = "FEF3D4", TEAL = "0E7C5A", GREY = "5A6B7B";
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
const PART = (t: string, sub: string) => [
  new Paragraph({ pageBreakBefore: true, spacing: { before: 2200, after: 60 }, alignment: AlignmentType.CENTER,
    children: [new TextRun({ text: t, bold: true, size: 40, color: NAVY, font: "Calibri" })] }),
  new Paragraph({ spacing: { after: 200 }, alignment: AlignmentType.CENTER,
    children: [new TextRun({ text: sub, size: 22, color: TEAL, font: "Calibri", italics: true })] }),
];
/** Persamaan, ditampilkan sebagai baris tersendiri agar mudah dihafal. */
const EQ = (t: string) => new Paragraph({
  spacing: { before: 100, after: 120 }, alignment: AlignmentType.CENTER,
  children: [new TextRun({ text: t, size: 22, color: NAVY, font: "Consolas" })] });
const bullet = (t: string) => new Paragraph({ bullet: { level: 0 }, spacing: { after: 75, line: 272 },
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

/** Perhitungan berjalan: rumus, lalu angka disubstitusikan, lalu hasilnya. */
function calc(rows: [string, string, string][]) {
  return table(["Yang dihitung", "Rumus dan substitusinya", "Hasil"],
    rows.map(([a, b, c]) => [{ v: a, b: true }, b, { v: c, b: true }]),
    [2400, 5000, 2000], [2]);
}

const f = (v: number, dp = 1) => {
  if (v == null || !Number.isFinite(v)) return "—";
  const r = Math.round(v * 10 ** dp) / 10 ** dp;
  const [i, dec] = String(Math.abs(r)).split(".");
  return `${r < 0 ? "-" : ""}${i.replace(/\B(?=(\d{3})+(?!\d))/g, ".")}${dec ? "," + dec : ""}`;
};
const sz = (label: string, re: RegExp): string => {
  const u = U(label);
  const s = u?.sizing.find((x: Json) => re.test(x.label));
  return s ? s.value : "—";
};

const body: (Paragraph | Table)[] = [];

/* ================================================================= sampul */
body.push(
  new Paragraph({ spacing: { before: 1300, after: 60 }, alignment: AlignmentType.CENTER,
    children: [new TextRun({ text: "TEORI, PERHITUNGAN, DAN", bold: true, size: 40, color: NAVY, font: "Calibri" })] }),
  new Paragraph({ spacing: { after: 200 }, alignment: AlignmentType.CENTER,
    children: [new TextRun({ text: "ALASAN PEMILIHAN PROSES", bold: true, size: 40, color: NAVY, font: "Calibri" })] }),
  new Paragraph({ spacing: { after: 160 }, alignment: AlignmentType.CENTER,
    children: [new TextRun({ text: "WTP Sagara — 50 L/detik ke Kawasan Industri SIER, Surabaya", size: 24, color: TEAL, font: "Calibri" })] }),
  new Paragraph({ spacing: { after: 420 }, alignment: AlignmentType.CENTER,
    children: [new TextRun({ text: "Dari dasar teori sampai perhitungan unit demi unit", size: 20, color: GREY, font: "Calibri", italics: true })] }),
  table(["Bagian", "Isi"], [
    ["I — Dasar Teori", "Apa yang ada di dalam air, mengapa koloid tidak mengendap, bagaimana memisahkannya, dan apa itu membran"],
    ["II — Alat Hitung", "Enam persamaan yang dipakai berulang di seluruh desain, lengkap dengan penurunannya"],
    ["III — Sepuluh Keputusan", "Penerapan teori ke Sagara: apa yang dipilih, apa yang kalah, dan mengapa"],
    ["IV — Perhitungan Unit", "Setiap unit dihitung dari rumus, disubstitusikan, sampai hasilnya"],
    ["V — Penguasaan", "Pertanyaan yang akan diajukan, jawabannya, dan angka yang harus dihafal"],
  ], [2400, 7000]),
  spacer(),
  box("Untuk siapa dokumen ini", [
    "Untuk orang yang sudah punya dasar teknik dan teori, tetapi belum terbiasa dengan implementasi dan desain. Jadi tidak ada yang dilewati, tetapi juga tidak ada yang diceramahkan.",
    "Urutannya sengaja: teori dulu, alat hitung, baru penerapan. Kalau langsung ke penerapan, angkanya cuma bisa dihafal. Kalau teorinya dulu, angkanya bisa diturunkan ulang saat ditanya.",
    "Semua perhitungan unit di Bagian IV dihasilkan langsung oleh mesin simulasi dari basis desain yang sama, sehingga dokumen ini dan modelnya tidak mungkin berbeda.",
  ], ALT, NAVY),
);

/* ============================================================== BAGIAN I */
body.push(...PART("BAGIAN I", "Dasar Teori"));

body.push(H1("1  Apa yang Ada di Dalam Air"));
body.push(P(
  "Semua keputusan pengolahan air berakar pada satu pertanyaan: apa yang mau disingkirkan, dan seberapa besar ukurannya. Jawabannya menentukan mekanisme mana yang mungkin dan mana yang mustahil.",
));
body.push(P("Isi air dapat dibagi menjadi tiga golongan menurut ukuran:"));
body.push(table(["Golongan", "Ukuran", "Contoh", "Cara menyisihkannya"], [
  ["Tersuspensi", "> 1 µm", "Pasir, lempung kasar, sel alga", "Mengendap atau mengapung sendiri, atau disaring"],
  ["Koloid", "1 nm – 1 µm", "Lempung halus, bahan humat, bakteri", "TIDAK mengendap sendiri. Harus digumpalkan dulu"],
  [{ v: "Terlarut", bg: WARN }, { v: "< 1 nm", bg: WARN }, { v: "Garam: Na⁺, Ca²⁺, Cl⁻, SO₄²⁻", bg: WARN },
    { v: "Hanya membran, penukar ion, atau pengendapan kimia", bg: WARN }],
], [1700, 1500, 2800, 3400]));
body.push(spacer());
body.push(P(
  "Baris ketiga itulah yang menentukan seluruh desain Sagara. Kekeruhan diukur dari hamburan cahaya oleh partikel — dan ion terlarut tidak menghamburkan cahaya sama sekali. Air bisa jernih sempurna, 0,1 NTU, dan tetap mengandung 365 mg/L padatan terlarut.",
));
body.push(box("Konsekuensi yang harus dikuasai", [
  "Koagulasi, flokulasi, sedimentasi, flotasi, dan filtrasi semuanya bekerja pada golongan pertama dan kedua. Tidak satu pun menyentuh golongan ketiga.",
  "Karena itu instalasi pengolahan air konvensional lengkap sekalipun akan mengeluarkan air dengan TDS yang sama persis dengan air bakunya — bahkan sedikit lebih tinggi, karena koagulan dan asam yang didosis menambah ion terlarut.",
  "Kalau spesifikasi menuntut penurunan TDS, harus ada satu unit yang bekerja pada golongan ketiga. Tidak ada jalan lain.",
], OK, "0E7C5A"));

body.push(H1("2  Mengapa Koloid Tidak Mengendap Sendiri"));
body.push(P(
  "Partikel yang lebih berat dari air seharusnya turun. Kenyataannya lempung halus bisa menggantung berhari-hari. Ada dua sebab, dan keduanya harus dilawan.",
));
body.push(H3("Sebab pertama: partikel terlalu kecil untuk gravitasi"));
body.push(P(
  "Kecepatan jatuh sebuah partikel di air diberikan hukum Stokes:",
));
body.push(EQ("v = g · (ρp − ρa) · d² / (18 μ)"));
body.push(P(
  "Yang penting dari rumus itu satu hal: kecepatan sebanding dengan KUADRAT diameter. Partikel 10 µm turun seratus kali lebih cepat daripada partikel 1 µm. Pada ukuran koloid, kecepatan jatuhnya menjadi begitu kecil sehingga gerak Brown — tumbukan acak oleh molekul air — sudah cukup untuk menahannya tetap menggantung.",
));
body.push(H3("Sebab kedua: partikel saling menolak"));
body.push(P(
  "Hampir semua koloid di air alam bermuatan permukaan negatif. Muatan sejenis saling menolak, sehingga partikel tidak pernah cukup dekat untuk saling menempel dan tumbuh. Lapisan ion yang mengelilinginya disebut lapisan ganda listrik, dan potensial di batas gesernya disebut potensial zeta.",
));
body.push(P(
  "Selama tolakan itu lebih kuat daripada gaya tarik Van der Waals, partikel tetap terdispersi selamanya. Menunggu tidak menyelesaikan apa pun.",
));

body.push(H1("3  Koagulasi dan Flokulasi"));
body.push(P(
  "Dua langkah yang sering disebut satu tarikan napas padahal berbeda mekanisme, berbeda waktu, dan berbeda kebutuhan energi. Menukar keduanya adalah kesalahan paling umum di lapangan.",
));
body.push(table(["", "Koagulasi", "Flokulasi"], [
  ["Yang terjadi", "Muatan partikel dinetralkan", "Partikel bertumbukan dan tumbuh jadi flok"],
  ["Waktunya", "Detik — hidrolisis koagulan sangat cepat", "Belasan menit — butuh banyak tumbukan"],
  ["Energi", "TINGGI, G ≈ 700 s⁻¹", "RENDAH dan menurun, G ≈ 70 → 45 → 25 s⁻¹"],
  ["Kalau salah", "Koagulan tidak tersebar, sebagian air tak terolah", "Flok yang sudah tumbuh pecah lagi oleh geseran"],
], [1700, 3800, 3900]));
body.push(spacer());
body.push(P(
  "Nilai G adalah gradien kecepatan, ukuran intensitas pengadukan, satuannya per detik. Pada rapid mix G dibuat tinggi agar koagulan tersebar merata sebelum sempat bereaksi. Pada flokulasi G dibuat rendah dan MENURUN bertahap — inilah yang disebut tapered flocculation. Flok kecil butuh tumbukan sering; flok besar mudah pecah dan butuh ketenangan.",
));
body.push(H3("Mengapa pH menentukan koagulasi"));
body.push(P(
  "Koagulan berbasis aluminium seperti PAC bekerja dengan membentuk Al(OH)₃ yang tidak larut, yang menetralkan muatan sekaligus menjerat partikel. Kelarutan Al(OH)₃ minimum pada pH 6–7. Di luar rentang itu, aluminium larut kembali — pada pH tinggi menjadi ion aluminat Al(OH)₄⁻ — sehingga tidak ada endapan yang terbentuk dan koagulan terbuang percuma.",
));
body.push(P(
  `Air baku Sagara pH 8,5, di luar rentang optimum. Itulah alasan asam sulfat didosis lebih dulu untuk menurunkannya ke 6,9, dan mengapa dosisnya harus dikendalikan umpan-balik: pH waduk berayun harian 7,8–9,2 mengikuti siklus fotosintesis alga.`,
));

body.push(H1("4  Memisahkan Padatan: Mengendap atau Mengapung"));
body.push(P(
  "Setelah flok terbentuk, ia harus dipisahkan dari air. Ada dua arah yang mungkin, dan keduanya memakai hukum Stokes yang sama — hanya tandanya yang berbeda.",
));
body.push(EQ("v = g · (ρp − ρa) · d² / (18 μ)"));
body.push(P(
  "Kalau ρp > ρa, nilai v positif dan partikel TURUN. Itu sedimentasi. Kalau ρp < ρa, nilai v negatif dan partikel NAIK. Itu flotasi.",
));
body.push(H3("Kunci desain: beban permukaan, bukan volume"));
body.push(P(
  "Yang menentukan apakah sebuah partikel tertangkap bukanlah lama tinggalnya di dalam bak, melainkan perbandingan antara debit dan LUAS PERMUKAAN bak:",
));
body.push(EQ("Beban permukaan (m/jam) = Q (m³/jam) ÷ A (m²)"));
body.push(P(
  "Bandingkan angka itu dengan kecepatan jatuh partikel. Kalau beban permukaan lebih kecil daripada kecepatan jatuh, partikel sempat mencapai dasar sebelum terbawa keluar. Perhatikan bahwa kedalaman bak tidak muncul dalam perbandingan itu sama sekali — inilah yang disebut teori bak ideal, dan inilah alasan pelat miring pada lamella clarifier bekerja: ia menambah luas efektif tanpa menambah tapak.",
));
body.push(H3("Mengapa alga menuntut flotasi"));
body.push(P(
  "Banyak alga memiliki vakuola gas untuk mengatur kedalamannya di kolom air. Akibatnya kerapatan flok alga mendekati atau bahkan lebih rendah daripada air. Pada clarifier gravitasi, suku (ρp − ρa) menjadi nol atau negatif — flok tidak turun, ia menggantung atau naik, lalu lolos bersama air jernih menuju filter.",
));
body.push(P(
  "DAF membalik logikanya. Gelembung mikro berdiameter 40–70 µm diinjeksikan dan menempel pada flok, menurunkan kerapatan gabungannya jauh di bawah air. Suku (ρp − ρa) menjadi sangat negatif, dan flok naik cepat untuk diserok. Untuk air beralga, flotasi bukan alternatif dari sedimentasi — ia mekanisme yang benar.",
));

body.push(H1("5  Membran: Satu-satunya Cara Menyentuh yang Terlarut"));
body.push(P(
  "Membran dibedakan menurut ukuran apa yang mampu ditahannya. Urutannya dari yang paling longgar:",
));
body.push(table(["Jenis", "Menahan", "Meloloskan", "Tekanan tipikal"], [
  ["Mikrofiltrasi (MF)", "Partikel > 0,1 µm, bakteri", "Semua yang terlarut", "0,5–2 bar"],
  ["Ultrafiltrasi (UF)", "Koloid, virus, makromolekul", "Semua garam", "1–3 bar"],
  ["Nanofiltrasi (NF)", "Ion divalen: Ca²⁺, Mg²⁺, SO₄²⁻", "Sebagian besar Na⁺ dan Cl⁻", "5–15 bar"],
  [{ v: "Reverse osmosis (RO)", bg: OK }, { v: "Hampir semua ion", bg: OK }, { v: "Air, sedikit gas", bg: OK }, { v: "10–25 bar (air payau)", bg: OK }],
], [2200, 2800, 2600, 1800]));
body.push(spacer());
body.push(H3("Tekanan osmotik: mengapa RO butuh tekanan tinggi"));
body.push(P(
  "Kalau air tawar dan air asin dipisahkan membran semipermeabel, air akan mengalir SENDIRI dari sisi tawar ke sisi asin. Itu osmosis. Tekanan yang harus diberikan untuk menghentikan aliran itu disebut tekanan osmotik, dan dari hukum Van 't Hoff:",
));
body.push(EQ("π ≈ 0,78 bar per 1.000 mg/L TDS"));
body.push(P(
  "Untuk membalik arah aliran — itulah arti reverse osmosis — tekanan yang diberikan harus MELEBIHI tekanan osmotik. Konsekuensinya mutlak: membran tidak dapat menghasilkan setetes air pun di bawah tekanan osmotik umpannya sendiri. Ini bukan soal memilih pompa yang lebih kuat; ini batas termodinamika.",
));
body.push(P(
  "Air Sagara pada 365 mg/L punya tekanan osmotik sekitar 0,28 bar — sangat rendah. Itulah sebabnya RO air payau di sini beroperasi pada tekanan sedang dan energinya wajar, berbeda jauh dari desalinasi air laut pada 35.000 mg/L yang tekanan osmotiknya sekitar 27 bar.",
));
body.push(H3("Dua angka yang sering tertukar: rejeksi dan recovery"));
body.push(table(["", "Rejeksi garam (SRR)", "Recovery"], [
  ["Yang diukur", "Berapa persen GARAM yang ditahan", "Berapa persen AIR yang jadi permeat"],
  ["Rumus", "1 − C_permeat / C_umpan", "Q_permeat / Q_umpan"],
  ["Mengatur", "MUTU air produk", "KUANTITAS air produk"],
  ["Di Sagara", "98,5 % (elemen) · 96,8 % (sistem)", "75 %"],
], [1700, 3900, 3800]));
body.push(spacer());
body.push(P(
  "Keduanya sepenuhnya independen. Sebuah membran bisa punya rejeksi 99,5 % pada recovery 10 % maupun pada 85 %. Tidak ada RO air payau dengan rejeksi 70–85 %; angka di kisaran itu pasti recovery. Yang punya rejeksi 50–70 % terhadap garam monovalen adalah nanofiltrasi.",
));

/* ============================================================= BAGIAN II */
body.push(...PART("BAGIAN II", "Enam Alat Hitung"));
body.push(P(
  "Seluruh desain ini, dan sebenarnya hampir seluruh desain pengolahan air, dibangun dari enam hubungan berikut. Kuasai keenamnya dan sebagian besar angka dapat diturunkan ulang tanpa menghafalnya.",
));

body.push(H1("6  Neraca Massa"));
body.push(P("Yang masuk sama dengan yang keluar. Tidak ada kemungkinan keempat."));
body.push(EQ("Q_masuk = Q_produk + Q_buangan"));
body.push(P(
  "Berlaku juga untuk setiap zat terlarut secara terpisah. Kalau membran menahan 98 % kalsium, kalsium itu tidak hilang — ia sekarang berada di konsentrat pada konsentrasi lebih tinggi. Inilah alasan konsentrat menjadi masalah pembuangan, dan alasan faktor konsentrasi adalah hal pertama yang dihitung pada tahap membran.",
));
body.push(P(
  "Konversi yang mendasari semua perhitungan dosis: mg/L dikali m³/jam menghasilkan g/jam; dibagi 1.000 menjadi kg/jam.",
));
body.push(EQ("kg/jam = mg/L × m³/jam ÷ 1.000"));

body.push(H1("7  Recovery, dan Sifatnya yang Berlipat"));
body.push(P("Recovery satu unit mudah dibaca. Recovery satu rangkaian TIDAK dijumlahkan — ia dikalikan."));
body.push(EQ("R_total = R₁ × R₂ × R₃ × …"));
body.push(P(
  "Empat unit yang masing-masing 95 % menghasilkan 0,95⁴ = 81 %, bukan 95 %. Ini sumber kejutan paling umum saat orang pertama kali mendimensikan pabrik.",
));
body.push(P(
  `Di Sagara: DAF membuang 1 % sebagai float, filter membuang 3,5 % sebagai cuci balik, dan RO membuang 25 % dari sepertiga aliran sebagai konsentrat. Hasil akhirnya recovery pabrik ${f(G.recovery_pct, 2)} % — dari ${f(G.raw_m3h, 0)} m³/jam air baku menjadi ${f(G.product_m3h, 2)} m³/jam produk.`,
));

body.push(H1("8  Beban Permukaan"));
body.push(P("Menentukan luas setiap unit yang bekerja dengan memisahkan partikel dari aliran ke atas atau ke bawah."));
body.push(EQ("A = Q ÷ beban permukaan"));
body.push(table(["Unit", "Beban tipikal", "Perhitungan Sagara"], [
  ["DAF", "8–12 m/jam", `205 ÷ 10 = ${sz("DAF", /Flotation area/i)}`],
  ["Filter dual-media", "8–12 m/jam", `203 ÷ 10 = ${sz("Filter", /filtration area/i)}`],
  ["Lamella clarifier", "3–6 m/jam", "Tidak dipakai — lihat Keputusan 5"],
  ["Pengental lumpur", "0,3–0,7 m/jam", `${sz("Pengental", /Thickener area/i)}`],
], [2200, 2200, 5000]));

body.push(H1("9  Waktu Tinggal Hidraulik (HRT)"));
body.push(P(
  "Menentukan volume setiap unit yang bekerja dengan MENAHAN air selama waktu tertentu — bak reaksi, bak penyangga, tangki penyimpan.",
));
body.push(EQ("V = Q × HRT"));
body.push(P(
  "Yang penting dipahami: HRT dipilih berdasarkan apa yang harus terjadi di dalam bak, bukan diambil dari tabel. Setiap angka HRT punya alasannya sendiri:",
));
body.push(table(["Unit", "HRT", "Volume", "Mengapa selama itu"], [
  ["Rapid mix", "60 detik", sz("Rapid Mix", /Rapid mix volume/i),
    "Hidrolisis koagulan selesai dalam hitungan detik. Waktunya untuk menyebarkan, bukan untuk bereaksi"],
  ["Flokulasi", "18 menit", sz("Rapid Mix", /Flocculation volume/i),
    "Pertumbuhan flok adalah proses tumbukan. Butuh ribuan tumbukan berhasil, dan itu butuh waktu"],
  ["Koreksi pH", `${f((U("Koreksi")?.hrtH ?? 0) * 60, 0)} menit`, sz("Koreksi", /Tank volume/i),
    "Reaksi asam-basa seketika. Waktunya untuk pencampuran dan agar probe pH membaca nilai yang sudah stabil"],
  [{ v: "Tangki air tersaring", bg: OK }, { v: `${f(U("Tangki Air")?.hrtH ?? 0, 1)} jam`, bg: OK },
    { v: sz("Tangki Air", /Working volume/i), bg: OK },
    { v: "Menyangga umpan RO yang harus stabil, sekaligus menyediakan air untuk cuci balik filter tanpa mengganggu produksi", bg: OK }],
  [{ v: "Tangki produk", bg: OK }, { v: `${f(U("Tangki Produk")?.hrtH ?? 0, 1)} jam`, bg: OK },
    { v: sz("Tangki Produk", /Working volume/i), bg: OK },
    { v: "Tempat pencampuran bypass dan permeat, penyangga permintaan industri yang tidak rata, dan waktu kontak untuk klor sisa" }],
], [1900, 1100, 1200, 5200]));
body.push(spacer());
body.push(box("Tiga fungsi tangki produk yang sering dikira satu", [
  "Pertama, PENCAMPURAN. Di sinilah bypass dan permeat bertemu. Tanpa volume yang cukup, TDS produk akan berayun mengikuti ayunan kedua aliran alih-alih keluar sebagai satu angka stabil.",
  "Kedua, PENYANGGA PERMINTAAN. Tenant industri tidak mengambil air dengan laju rata. Tangki 4 jam memungkinkan pabrik berjalan tetap sementara pengambilan naik-turun.",
  "Ketiga, WAKTU KONTAK DESINFEKTAN. Klor butuh waktu untuk bekerja. Volume tangki menyediakan waktu itu tanpa bak kontak terpisah.",
  "Karena itu memperkecil tangki produk dari 750 ke 500 m³ — seperti pada opsi rekayasa nilai — bukan sekadar menghemat beton. Penyangga turun dari 4 jam ke 2,8 jam, dan itu berarti pabrik lebih cepat kehabisan cadangan saat PLN padam.",
], OK, "0E7C5A"));

body.push(H1("10  Faktor Konsentrasi dan Rata-rata Logaritmik"));
body.push(P(
  "Pada membran, air keluar sebagai permeat tetapi garamnya tetap tinggal. Aliran yang tersisa menjadi lebih pekat, dan faktornya:",
));
body.push(EQ("CF = 1 ÷ (1 − Y)"));
body.push(P(
  "Pada recovery 75 %, konsentrat menjadi 1/(1−0,75) = 4 kali lebih pekat daripada umpan. Inilah yang membatasi recovery: pada suatu titik, garam yang paling sulit larut mulai mengendap di permukaan membran.",
));
body.push(P(
  "Tetapi membran tidak melihat konsentrasi umpan maupun konsentrat — ia melihat sesuatu di antaranya, karena konsentrasi naik terus-menerus sepanjang modul. Pendekatan bakunya adalah rata-rata logaritmik:",
));
body.push(EQ("LM = ln(1 / (1 − Y)) ÷ Y"));
body.push(P(
  "Pada Y = 75 %: LM = ln(4) ÷ 0,75 = 1,386 ÷ 0,75 = 1,848. Sehingga konsentrasi permeat menjadi:",
));
body.push(EQ("C_permeat = C_umpan × (1 − R_elemen) × LM"));
body.push(box("Inilah asal perbedaan antara 98,5 % dan 96,8 %", [
  "Substitusikan angka Sagara: 375 × (1 − 0,985) × 1,848 = 10,4 mg/L.",
  "Rejeksi SISTEM yang benar-benar didapat: 1 − 10,4/375 = 97,2 %, bukan 98,5 %.",
  "Jadi 98,5 % adalah rejeksi ELEMEN — sifat membrannya sendiri, yang dikutip vendor. Rejeksi sistem selalu lebih rendah, dan selisihnya persis faktor LM ini.",
  "Kalau kedua angka ini tertukar saat memasukkan data ke perangkat lunak proyeksi, mutu permeat akan meleset sekitar dua kali lipat — ke arah yang paling tidak menguntungkan.",
], WARN, "8A6100"));

body.push(H1("11  Persamaan Pencampuran"));
body.push(P("Alat terakhir, dan yang paling menentukan bentuk desain ini."));
body.push(EQ("C_campuran = (1 − f) × C_bypass + f × C_permeat"));
body.push(P("Dengan f = porsi produk yang berasal dari permeat. Substitusikan angka Sagara:"));
body.push(EQ("C_produk = (1 − f) × 375 + f × 12 = 375 − 363 f"));
body.push(P(
  "Perhatikan bentuknya: LINIER terhadap f. Itu berarti porsi RO adalah tuas yang halus dan dapat disetel sedikit demi sedikit, bukan sakelar hidup-mati. Menyelesaikan untuk C = 300 memberi f = 20,7 %.",
));
body.push(P(
  "Dan perhatikan mana yang mendominasi. Suku pertama membawa 375 mg/L dengan bobot besar; suku kedua membawa 12 mg/L dengan bobot kecil. Memperbaiki permeat dari 17 ke 10 mg/L hanya menggeser produk sekitar 2 mg/L. Inilah alasan kuantitatif mengapa negosiasi rejeksi membran BUKAN hal yang menentukan jumlah train.",
));

/* ============================================================ BAGIAN IV */
body.push(...PART("BAGIAN III", "Perhitungan Unit demi Unit"));
body.push(P(
  "Setiap unit dihitung dari rumus di Bagian II, disubstitusikan dengan angka Sagara, sampai hasilnya. Seluruh angka di bawah ini dihasilkan mesin simulasi, bukan diketik ulang.",
));

body.push(H1("12  Intake dan Pompa Air Baku"));
body.push(calc([
  ["Debit air baku", "Q = 205 m³/jam (turunan dari produk 180 dan recovery)", "205 m³/jam"],
  ["Daya poros pompa", "P = ρ·g·Q·H / η = 1000 × 9,81 × (205/3600) × 30 / 0,75", sz("Intake", /shaft power/i)],
  ["Konfigurasi", "3 × 50 % dengan VFD, 2 operasi + 1 cadangan", sz("Intake", /Intake pumps/i)],
]));

body.push(H1("13  Koreksi pH"));
body.push(calc([
  ["Alkalinitas", "Alk = C_HCO₃ / 61,02 × 50 = 158 / 61,02 × 50", "130 mg/L CaCO₃"],
  ["Ekuivalen dinetralkan", "eq = (Alk/50) × fraksi penurunan pH", sz("Koreksi", /Reagent demand/i)],
  ["Dosis H₂SO₄", "M = eq × (1+kelebihan) × Q × MW/2 / 1000", sz("Koreksi", /Sulphuric/i)],
  ["Volume bak", `V = Q × HRT = 205 × ${f((U("Koreksi")?.hrtH ?? 0), 3)} jam`, sz("Koreksi", /Tank volume/i)],
]));

body.push(H1("14  Koagulasi dan Flokulasi"));
body.push(calc([
  ["Volume rapid mix", "V = Q × t / 60 = 205 × 1 / 60", sz("Rapid Mix", /Rapid mix volume/i)],
  ["Volume flokulasi", "V = Q × t / 60 = 205 × 18 / 60", sz("Rapid Mix", /Flocculation volume/i)],
  ["Massa PAC", "M = C × Q / 1000 = 25 × 205 / 1000", sz("Rapid Mix", /Coagulant mass/i)],
  ["Duti pompa dosing", "V = M / (kekuatan larutan) / ρ", sz("Rapid Mix", /Dosing pump/i)],
]));

body.push(H1("15  DAF"));
body.push(calc([
  ["Luas flotasi", "A = Q / beban = 205 / 10", sz("DAF", /Flotation area/i)],
  ["Resirkulasi jenuh", "Q_r = 10 % × Q, dijenuhkan pada 5–6 bar", sz("DAF", /Saturation recycle/i)],
  ["Lumpur apung", "1,0 % dari debit, membawa padatan tersisih", sz("DAF", /Float/i)],
]));

body.push(H1("16  Filter Dual-Media"));
body.push(calc([
  ["Luas filtrasi total", "A = Q / laju = 203 / 10", sz("Filter", /filtration area/i)],
  ["Jumlah sel", "Termasuk satu sel dalam kondisi cuci balik", sz("Filter", /Units/i)],
  ["Volume media", "A × kedalaman media (antrasit 600 + pasir 400 mm)", sz("Filter", /Media volume/i)],
  ["Air cuci balik", "3,5 % dari debit, dikembalikan ke pengental", sz("Filter", /Backwash/i)],
]));

body.push(H1("17  Tangki Air Tersaring — dua jalur keluar"));
body.push(calc([
  ["Volume kerja", `V = Q × HRT × (1+margin) = ${f(U("Tangki Air")?.inFlow_m3h ?? 0, 1)} × ${f(U("Tangki Air")?.hrtH ?? 0, 1)} × 1,1`,
    sz("Tangki Air", /Working volume/i)],
  ["Jalur 1 — bypass", "67,3 % dari keluaran tangki", `${f(G.tankOutlets.out1, 1)} m³/jam`],
  ["Jalur 2 — umpan RO", "32,7 % dari keluaran tangki", `${f(G.tankOutlets.out2, 1)} m³/jam`],
  ["Pemeriksaan", "Jumlah kedua jalur harus sama dengan masuknya", `${f(G.tankOutlets.out1 + G.tankOutlets.out2, 1)} m³/jam ✓`],
]));

body.push(H1("18  Reverse Osmosis"));
body.push(calc([
  ["Umpan RO", "32,7 % air tersaring", `${f(G.roFeed_m3h, 2)} m³/jam`],
  ["Permeat", "Q_p = Q_umpan × Y = 64,04 × 0,75", `${f(G.roPermeate_m3h, 2)} m³/jam`],
  ["Konsentrat", "Q_c = Q_umpan − Q_p", `${f(G.roConcentrate_m3h, 2)} m³/jam`],
  ["Faktor konsentrasi", "CF = 1/(1−0,75)", "4,0×"],
  ["Faktor log-mean", "LM = ln(4)/0,75", "1,848"],
  ["TDS permeat", "C_p = 365 × (1−0,975) × 1,848", `${f(G.roPermeate_TDS, 1)} mg/L`],
  ["TDS konsentrat", "Dari neraca massa garam", `${f(G.roConcentrate_TDS, 0)} mg/L`],
  ["Susunan", "3 train paralel, tiap train 2 tahap array 4:2 × 6 elemen", "108 elemen"],
]));
body.push(spacer());
body.push(box("Train dan stage: dua sumbu yang berbeda", [
  "TRAIN adalah jalur paralel lengkap — pompa sendiri, vessel sendiri, instrumentasi sendiri. Tiga train berarti air dibagi tiga. Ini soal kapasitas dan cadangan.",
  "STAGE adalah tahap seri di DALAM satu train. Konsentrat tahap 1 menjadi umpan tahap 2. Ini soal recovery.",
  "Array 4:2 berarti tahap 1 punya 4 vessel paralel dan tahap 2 punya 2. Menyempit karena air terus diambil sebagai permeat, sehingga aliran yang tersisa mengecil — kalau jumlah vessel tetap, kecepatan aliran silang turun dan fouling naik.",
  "Jadi susunannya: 3 train paralel, masing-masing 2 tahap seri. (4+2) × 6 elemen = 36 per train, × 3 = 108 elemen.",
], ALT, NAVY));

body.push(H1("19  Tangki Produk dan Pencampuran"));
body.push(calc([
  ["Masukan 1 — bypass", "Dari jalur 1 tangki air tersaring", `${f(G.tankOutlets.out1, 1)} m³/jam @ 365 mg/L`],
  ["Masukan 2 — permeat", "Dari RO", `${f(G.roPermeate_m3h, 1)} m³/jam @ ${f(G.roPermeate_TDS, 1)} mg/L`],
  ["Volume kerja", `V = Q × HRT × 1,1 = ${f(U("Tangki Produk")?.inFlow_m3h ?? 0, 1)} × ${f(U("Tangki Produk")?.hrtH ?? 0, 1)} × 1,1`,
    sz("Tangki Produk", /Working volume/i)],
  ["TDS campuran", "Persamaan pencampuran, Bagian II bab 11", `${f(G.product_TDS, 1)} mg/L`],
]));

body.push(H1("20  Trim pH dan Distribusi"));
body.push(calc([
  ["pH sebelum trim", "Permeat RO asam karena CO₂ menembus membran", "6,37 — GAGAL batas 6,5"],
  ["Dosis NaOH", "Dari ekuivalen yang dibutuhkan × Q", sz("Trim pH", /Caustic/i)],
  ["pH produk", "Setelah trim", `${f(G.product_pH, 2)} ✓`],
  ["Daya pompa distribusi", "P = ρ·g·Q·H/η pada head 45 m", sz("Pompa Distribusi", /shaft power/i)],
]));

body.push(H1("21  Penanganan Lumpur"));
body.push(calc([
  ["Umpan pengental", "Float DAF + cuci balik filter", `${f(U("Pengental")?.inFlow_m3h ?? 0, 2)} m³/jam`],
  ["Luas pengental", "A = Q / beban hidraulik", sz("Pengental", /Thickener area/i)],
  ["Padatan kering", "Dari neraca padatan", sz("Pengental", /Dry solids/i)],
  ["Cake", "Pada 18 % DS", sz("Screw Press", /Cake production/i)],
]));

/* ============================================================= BAGIAN IV */
body.push(...PART("BAGIAN IV", "Penguasaan"));

body.push(H1("22  Ringkasan Sepuluh Keputusan"));
body.push(table(["Keputusan", "Dipilih", "Alasan satu kalimat", "Yang kalah"], [
  ["Perlu penyisih garam?", "Ya", "Konvensional menyisihkan nol TDS; produk keluar 375 vs batas 300", "Konvensional saja"],
  ["Teknologi apa?", "RO air payau", "Satu-satunya yang menurunkan TDS tanpa membuang ion yang membuat air stabil", `NF (gagal di ${f(NFC.TDS, 0)} mg/L), kapur (lumpur +${f(LIME.sludge_kgd, 0)} kg/hari), IX, EDR`],
  ["Semua aliran?", "Sebagian, 32,7 %", "RO membayar per volume, bukan per garam. Penuh = Rp 4.500/m³", "RO penuh"],
  ["Cabang di mana?", "Setelah filter", "Kedua cabang sudah 0,1 NTU; satu pra-olah melayani dua tujuan", "Sebelum filter"],
  ["Endap atau apung?", "DAF", "Flok alga mengapung. 70 m² vs 260 m²", "Sedimentasi"],
  ["Media atau UF?", "Media, bersyarat", "Cukup untuk 1 NTU; SDI ≈ 4 masih harus dibuktikan uji pilot", "UF (+Rp 4 M)"],
  ["Praoksidasi?", "Ya, dosis rendah", "Dosis tinggi memecah sel dan melepas toksin terlarut", "Klorinasi kuat"],
  ["pH berapa?", "6,9, umpan-balik", "Al(OH)₃ paling tak larut pada pH 6–7", "Biarkan 8,5"],
  ["Berapa train?", "Tiga", "Kemarau butuh 34,2 %; dua train tidak sampai", "Dua train"],
  ["Lumpur?", "Diolah di tapak", "Kirim cair = mengangkut 97 % air", "Kirim cair"],
], [1700, 1500, 3400, 2800]));

body.push(H1("23  Pertanyaan yang Akan Diajukan"));
body.push(table(["Pertanyaan", "Jawaban"], ([
  ["Kenapa tidak IPA biasa saja?",
   "Koagulasi dan filtrasi menyisihkan padatan tersuspensi, bukan terlarut. TDS keluar sama dengan masuk — bahkan naik ke 375 karena koagulan dan asam. Kekeruhan 15 ke 1 NTU rutin; TDS-nya yang tidak bisa dikerjakan unit konvensional mana pun."],
  ["Kenapa RO-nya cuma sepertiga?",
   "Yang dibutuhkan cuma penyisihan 18 %. RO membayar energi sebanding volume yang dilewatkan, bukan garam yang disisihkan. RO penuh ±Rp 4.500/m³ terhadap plafon Rp 3.000, dan produknya 12 mg/L — agresif, malah butuh remineralisasi."],
  ["Kenapa bukan nanofiltrasi? Kan lebih hemat energi.",
   `Sudah diuji. NF meloloskan monovalen: bahkan pada porsi 75 % produk hanya turun ke ${f(NFC.TDS, 0)} mg/L, masih gagal. Na keluar ${f(NFC.Na, 1)} dan Cl ${f(NFC.Cl, 1)}, nyaris utuh. Energinya juga lebih boros, ${f(NFC.sec, 3)} vs ${f(ROC.sec, 3)} kWh/m³.`],
  ["Kenapa bukan pelunakan kapur?",
   `Aritmetikanya sanggup dan murah — cuma ${f(LIME.meqNeeded, 2)} meq/L, setara ${f(LIME.lime_kgd, 0)} kg kapur/hari. Yang menggugurkan lumpurnya: setiap meq mengendapkan DUA meq CaCO₃, sehingga padatan naik dari ${f(LIME.existingSludge_kgd, 0)} ke ${f(LIME.existingSludge_kgd + LIME.sludge_kgd, 0)} kg/hari, 3,5 kali lipat.`],
  ["Kenapa DAF, bukan clarifier biasa?",
   "Kalau bebannya lempung, clarifier benar. Tetapi airnya hijau — bebannya sel alga yang mengapung karena vakuola gas. Di clarifier gravitasi ia lolos ke filter dan meracuni membran. DAF memakai sifat itu. Tambahan, 70 m² vs 260 m² di lahan yang sudah 90 % terpakai."],
  ["Berapa train, dan kenapa tiga?",
   "Tiga train paralel, masing-masing dua tahap array 4:2. Train untuk kapasitas dan cadangan; stage untuk recovery. Tiga karena kemarau menuntut porsi RO 34,2 % sementara dua train hanya sampai 26,7 % — spesifikasi TDS gagal di bulan terpanas."],
  ["Rejeksi 98,5 % itu di mana?",
   "Itu rejeksi ELEMEN, yang dikutip vendor. Rejeksi SISTEM dari umpan ke permeat keluar 96,8 %, karena konsentrasi naik sepanjang array — faktor log-mean 1,848 pada recovery 75 %. Dan recovery 75 % itu besaran lain sama sekali: berapa airnya, bukan berapa garamnya."],
  ["Kenapa tangki produk sebesar 750 m³?",
   "Tiga fungsi sekaligus: tempat pencampuran bypass dan permeat, penyangga 4 jam terhadap permintaan tenant yang tidak rata, dan waktu kontak klor. Memperkecilnya ke 500 m³ menurunkan penyangga ke 2,8 jam — itu keputusan ketersediaan, bukan penghematan beton."],
  ["Berapa akurasi CAPEX?",
   "±30–50 %, kelas kelayakan AACE Class 4/5, dari daftar peralatan bukan penawaran vendor. Selisih Rp 53 M dan Rp 44 M masih di dalam derau estimasi ini. Pertanyaan sebenarnya bukan berapa angkanya, tetapi kelas pabrik seperti apa yang dibeli."],
  ["Risiko terbesarnya?",
   "Bukan teknis. Pajak Air Permukaan. Diasumsikan Rp 150/m³; kalau Bapenda menetapkan Rp 500/m³, OPEX jadi Rp 3.133/m³ dan target gagal. Tidak ada desain yang menyelamatkannya — penyelesaiannya administratif dan harus sebelum harga dikunci."],
  ["Apa yang paling bisa menurunkan OPEX?",
   "Titik serah. Pompa distribusi ke SIER menyumbang 29 % tagihan listrik, lebih besar dari RO yang 19 %. Kalau titik serah bisa di pagar pabrik, OPEX turun Rp 197/m³ — lebih besar daripada hampir semua pilihan desain proses."],
  ["Yang belum pasti apa?",
   "SDI umpan RO. Simulasi menunjukkan sekitar 4 terhadap batas 3 pada konfigurasi filter dual-media. Kalau uji pilot membuktikan tidak bisa ditahan di bawah 3 saat bloom, pra-olah harus naik ke UF — CAPEX +Rp 4 miliar. Jauh lebih baik diketahui sekarang."],
] as [string, string][]).map(([q, a]) => [{ v: q, b: true }, a]), [2700, 6700]));

body.push(H1("24  Angka yang Harus Dihafal"));
body.push(table(["Angka", "Artinya"], [
  ["18 %", "Penyisihan TDS yang dibutuhkan. Angka pembuka seluruh argumen"],
  ["375 mg/L", "TDS air tersaring tanpa RO. Bukti konvensional gagal"],
  ["26,7 %", "Porsi produk dari permeat pada titik desain"],
  ["278 mg/L", "TDS produk. Margin 7 % dari batas 300"],
  ["34,2 %", "Porsi yang dibutuhkan saat kemarau. Alasan train ketiga"],
  ["1,848", "Faktor log-mean pada recovery 75 %. Asal beda 98,5 vs 96,8 %"],
  ["87,8 %", "Recovery pabrik — 180 dari 205 m³/jam"],
  ["215 dan 792 m³", "Volume tangki air tersaring (HRT 1 jam) dan tangki produk (HRT 4 jam)"],
  ["Rp 2.734/m³", "OPEX. Margin Rp 266 dari plafon"],
  ["29 % vs 19 %", "Pompa distribusi vs RO dalam tagihan listrik"],
  ["SDI < 3", "Syarat umpan RO. Risiko teknis terbuka terbesar"],
  ["82 %", "Titik impas pemanfaatan kapasitas. Alasan take-or-pay"],
], [2100, 7300]));

body.push(spacer());
body.push(box("Batasan dokumen ini", [
  "Angka proses dihasilkan mesin simulasi HydroDesk; angka CAPEX, OPEX, dan lahan dikutip dari dokumen desain, tidak dihitung ulang.",
  "Seluruh penalaran berlaku sejauh asumsi A1–A16 terkonfirmasi. Yang paling menentukan sekaligus paling belum pasti: A5 (TDS puncak kemarau), A2 (jenis dan kepadatan alga), dan A13 (pajak air).",
  "Angka NF, kapur, dan SDI berasal dari simulasi, bukan pengukuran. Kalau ditanya sumbernya, jawaban yang benar adalah bahwa itu hasil model — dan justru itulah yang menunjukkan uji pilot diperlukan.",
  "Tidak ada satu pun keputusan di sini yang telah divalidasi lewat jar test maupun uji pilot.",
], ALT, NAVY));

const doc = new Document({
  creator: "PT CCEPC Indonesia",
  title: "Teori, Perhitungan, dan Alasan Pemilihan Proses — WTP Sagara",
  styles: { default: { document: { run: { font: "Calibri", size: 20 } } } },
  sections: [{ properties: { page: { margin: { top: 1000, bottom: 1000, left: 1000, right: 1000 } } }, children: body }],
});

void Packer.toBuffer(doc).then((buf) => {
  const out = "scripts/out/WTP Sagara - Teori, Perhitungan & Pemilihan Proses (ID).docx";
  writeFileSync(out, buf);
  console.log(`Wrote ${out}  (${(buf.length / 1024).toFixed(0)} kB)`);
});
