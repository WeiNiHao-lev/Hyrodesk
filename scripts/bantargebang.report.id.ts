import { readFileSync, writeFileSync } from "fs";
import {
  AlignmentType, BorderStyle, Document, HeadingLevel, ImageRun, Packer, Paragraph,
  ShadingType, Table, TableCell, TableRow, TextRun, WidthType,
} from "docx";

/**
 * Bantargebang IPAS 2 — Basis Desain, versi Bahasa Indonesia.
 *
 * Angka diambil dari scripts/out/bantargebang.json, sumber yang sama dengan
 * versi Inggris, sehingga kedua dokumen tidak mungkin berbeda isinya. Format
 * angka mengikuti konvensi Indonesia: titik untuk ribuan, koma untuk desimal.
 */

type Json = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
const d: Json = JSON.parse(readFileSync("scripts/out/bantargebang.json", "utf8"));

const NAVY = "0F2942", ALT = "EEF6FB", OK = "D8F7E9", BAD = "FBDDD8", WARN = "FEF3D4", TEAL = "0E7C5A";

const P = (t: string, o: { b?: boolean; sz?: number; color?: string; it?: boolean; align?: (typeof AlignmentType)[keyof typeof AlignmentType] } = {}) =>
  new Paragraph({
    alignment: o.align, spacing: { after: 130, line: 276 },
    children: [new TextRun({ text: t, bold: o.b, size: o.sz ?? 20, color: o.color, italics: o.it, font: "Calibri" })],
  });
const H1 = (t: string) => new Paragraph({
  heading: HeadingLevel.HEADING_1, spacing: { before: 320, after: 160 },
  children: [new TextRun({ text: t, bold: true, size: 30, color: NAVY, font: "Calibri" })] });
const H2 = (t: string) => new Paragraph({
  heading: HeadingLevel.HEADING_2, spacing: { before: 240, after: 120 },
  children: [new TextRun({ text: t, bold: true, size: 24, color: NAVY, font: "Calibri" })] });
const H3 = (t: string) => new Paragraph({
  spacing: { before: 180, after: 90 },
  children: [new TextRun({ text: t, bold: true, size: 21, color: TEAL, font: "Calibri" })] });
const bullet = (t: string) => new Paragraph({
  bullet: { level: 0 }, spacing: { after: 70, line: 264 },
  children: [new TextRun({ text: t, size: 19, font: "Calibri" })] });
const spacer = () => new Paragraph({ spacing: { after: 120 }, children: [] });

function figure(file: string, caption: string, widthPt = 470) {
  const png = readFileSync(file);
  const w = png.readUInt32BE(16), h = png.readUInt32BE(20);
  return [
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 140, after: 60 },
      children: [new ImageRun({ data: png, type: "png",
        transformation: { width: widthPt, height: Math.round(widthPt * h / w) } })] }),
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 180 },
      children: [new TextRun({ text: caption, size: 17, italics: true, color: "5A6B7B", font: "Calibri" })] }),
  ];
}

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

/** Angka gaya Indonesia: titik ribuan, koma desimal. */
const f = (v: number, dp = 1) => {
  if (v == null || !Number.isFinite(v)) return "—";
  const r = Math.round(v * 10 ** dp) / 10 ** dp;
  const [i, dec] = String(Math.abs(r)).split(".");
  const grouped = i.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `${r < 0 ? "-" : ""}${grouped}${dec ? "," + dec : ""}`;
};

const A = d.caseA, B = d.caseB, C = d.caseC, D = d.caseD, E = d.caseE;
const SITE = d.site.landAvailable_m2;
const K = d.benchmark;
const dtroA = A.units.find((u: Json) => u.type === "dtro");
const osmA = Number(dtroA.sizing.find((s: Json) => /osmotic/i.test(s.label)).value.split(" ")[0]);

const body: (Paragraph | Table)[] = [];

/* ================================================================== sampul */
body.push(
  new Paragraph({ spacing: { before: 1600, after: 60 }, alignment: AlignmentType.CENTER,
    children: [new TextRun({ text: "BASIS DESAIN", bold: true, size: 46, color: NAVY, font: "Calibri" })] }),
  new Paragraph({ spacing: { after: 200 }, alignment: AlignmentType.CENTER,
    children: [new TextRun({ text: "Instalasi Pengolahan Air Lindi — IPAS 2, TPST Bantargebang", size: 26, color: TEAL, font: "Calibri" })] }),
  new Paragraph({ spacing: { after: 500 }, alignment: AlignmentType.CENTER,
    children: [new TextRun({ text: "1.200 m³/hari · lahan 2 ha · fasilitas baru menggantikan instalasi eksisting", size: 20, color: "5A6B7B", font: "Calibri", italics: true })] }),
  table(["Item", "Keterangan"], [
    ["Disusun oleh", "PT CCEPC Environment Protection and Energy Comprehensive Utilization Indonesia"],
    ["Tanggal", new Date(d.generated).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })],
    ["Kapasitas desain", `${f(d.site.capacity_m3d)} m³/hari (${f(d.site.capacity_m3h)} m³/jam)`],
    ["Luas lahan tersedia", `${f(SITE)} m² (2 ha)`],
    ["Lingkup", "Instalasi baru. Fasilitas eksisting disingkirkan, bukan ditingkatkan."],
    ["Baku mutu efluen", "Permen LHK P.59/2016 — air lindi TPA"],
    ["Status", "Basis desain. Bukan untuk konstruksi. Verifikasi laboratorium belum dilakukan."],
  ], [2500, 6900]),
  spacer(),
  callout("Baca ini terlebih dahulu", [
    "Laporan ini disusun di atas analisis air yang tidak dapat dipakai sebagai basis desain. Data tersebut merupakan gabungan lima studi berbeda atas lima TPA berbeda antara tahun 1993 dan 2022, dan dua angkanya mustahil secara fisika.",
    "Instalasi yang digambarkan analisis itu tidak dapat dibangun dengan proses membran apa pun, berapa pun biayanya. Bab 2 menunjukkan alasannya, lengkap dengan perhitungannya.",
    "Karena itu, seluruh isi mulai Bab 3 dijalankan di atas basis desain pengganti. Setiap penggantian dicantumkan beserta alasannya. Tidak ada satu pun yang menggantikan kebutuhan pengambilan sampel di lokasi ini.",
  ], BAD, "9B2C1F"),
);

/* ========================================================== 1 ringkasan */
body.push(new Paragraph({ pageBreakBefore: true, children: [] }), H1("1  Ringkasan Eksekutif"));
body.push(H2("1.1  Tiga temuan, urut menurut konsekuensinya"));

body.push(H3("Pertama: karakterisasinya tidak dapat dipakai, dan instalasi yang digambarkannya tidak dapat dibangun"));
body.push(P(
  `Dimasukkan persis seperti yang ditabelkan, air lindi ini mengandung 280.000 mg/L padatan terlarut — delapan kali air laut. Pada salinitas tersebut, tekanan osmotik umpannya saja sudah ${f(osmA, 0)} bar, dan model meminta tekanan umpan membran 877 bar terhadap rating modul 120 bar. Membran tidak dapat menghasilkan air di bawah tekanan osmotiknya sendiri, jadi ini bukan persoalan menentukan pompa yang lebih kuat. Tidak ada jalur membran untuk air seperti yang dideskripsikan.`,
));
body.push(P(
  `Konsumsi energi spesifik yang menyertainya — ${f(A.sec_kWh_m3, 1)} kWh/m³ berbanding ${f(B.sec_kWh_m3, 1)} untuk rangkaian yang sama pada salinitas yang masuk akal — adalah konsekuensi aritmetika, bukan pilihan desain. Lima kali lipat energi untuk efluen yang sama adalah wujud dari data masukan yang tidak layak begitu ia masuk ke dalam model.`,
));

body.push(H3("Kedua: lahan bukan kendala di lokasi ini"));
body.push(table(
  ["Skenario", "Debit, m³/hari", "Luas proses, m²", "Porsi dari lahan 2 ha"],
  [
    ["B — 1.200 m³/hari, konsentrat dibuang", f(B.feedFlow_m3d), f(B.processArea_m2), `${f(B.processArea_m2 / SITE * 100)} %`],
    ["C — 1.200 m³/hari dengan ZLD", f(C.feedFlow_m3d), f(C.processArea_m2), `${f(C.processArea_m2 / SITE * 100)} %`],
    [{ v: "E — target 2028 setelah capping, 2.100 m³/hari", bg: OK }, { v: f(E.feedFlow_m3d), bg: OK },
      { v: f(E.processArea_m2), bg: OK }, { v: `${f(E.processArea_m2 / SITE * 100)} %`, bg: OK }],
    ["D — target 2028 tanpa mitigasi, 7.000 m³/hari", f(D.feedFlow_m3d), f(D.processArea_m2), `${f(D.processArea_m2 / SITE * 100)} %`],
  ], [3600, 1700, 2100, 2000], [1, 2, 3],
));
body.push(spacer());
body.push(P(
  `Pada kapasitas desain, proses menempati sekitar ${f(C.processArea_m2 / SITE * 100)} % lahan. Bahkan target 2028 sebesar 7.000 m³/hari tanpa mitigasi pun masih muat di separuh lahan. Bangunan bertingkat menghemat lahan, dan di lokasi ini tidak ada lahan yang perlu dihemat.`,
));

body.push(H3("Ketiga: kendalanya adalah lereng sampah, dan itu justru alasan untuk tidak membangun ke atas"));
body.push(P(
  "Lokasi ini berbatasan langsung dengan tumpukan sampah yang sangat tinggi, dan dinding penahan di antaranya sudah lebih dari sekali roboh akibat pergeseran massa sampah. Itulah risiko yang menentukan pada proyek ini, dan sifatnya geoteknik, bukan proses.",
));
body.push(P(
  "Struktur bertingkat nyaris merupakan respons terburuk terhadap tanah yang bergerak. Ia memusatkan beban pada tapak yang kecil, mengubah pergeseran lateral tanah menjadi momen di dasar bangunan, dan menjadikan penurunan diferensial — yang paling tidak ditoleransi oleh struktur penampung air — sebagai persoalan seluruh bangunan, bukan satu tangki. Bila dinding roboh lagi, instalasi rendah kehilangan unit yang terdekat dengan dinding; instalasi bertingkat kehilangan gedungnya.",
));
body.push(callout("Rekomendasi yang mengikutinya", [
  "Bangun rendah dan menyebar, lalu belanjakan kelebihan lahan sebagai jarak dari kaki lereng, bukan untuk memadatkan instalasi.",
  "Buat pondasi terpisah untuk setiap unit, bukan satu raft bersama, dan sambungkan dengan flexible coupling, sehingga pergerakan tanah merusak satu struktur, bukan seluruhnya.",
  "Tempatkan yang mudah dibangun ulang di dekat lereng, dan yang tidak tergantikan — MBR, DTRO, ruang listrik, ruang kontrol — sejauh mungkin darinya.",
  "Lakukan capping permukaan sampah. Capping dilaporkan menurunkan timbulan lindi sekitar 70 %, dan mengurangi infiltrasi ke dalam massa sampah, yang merupakan pendorong tekanan air pori di belakang dinding penahan. Satu tindakan menjawab persoalan debit, lahan, dan lereng sekaligus.",
], OK, "0E7C5A"));

body.push(H2("1.2  Kinerja yang dicapai instalasi"));
body.push(table(
  ["Parameter", "Baku mutu P.59/2016", "Desain ini", "Margin"],
  [
    ["pH", "6 – 9", f(C.compliance.pH.v, 1), "di tengah rentang"],
    ["BOD₅", "≤ 150 mg/L", f(B.compliance.BOD.v, 2), `${f(150 / Math.max(B.compliance.BOD.v, 0.01))}×`],
    ["COD", "≤ 300 mg/L", f(B.compliance.COD.v, 2), `${f(300 / Math.max(B.compliance.COD.v, 0.01))}×`],
    ["TSS", "≤ 100 mg/L", "< 1", "> 100×"],
    [{ v: "Total nitrogen", bg: WARN }, { v: "≤ 60 mg/L", bg: WARN }, { v: f(B.compliance.TN.v, 2), bg: WARN },
      { v: `${f(60 / Math.max(B.compliance.TN.v, 0.01))}×`, bg: WARN }],
  ], [2600, 2300, 2300, 2200], [1, 2, 3],
));
body.push(spacer());
body.push(P(
  "Total nitrogen ditandai karena parameter inilah yang paling lemah perlindungannya terhadap kesalahan. Analisis memberikan amonia tetapi tidak memberikan total nitrogen, sehingga fraksi organiknya tidak diketahui — dan nitrogen organik tidak dapat di-stripping pada rasio udara berapa pun. Bila fraksinya ternyata signifikan, inilah angka yang pertama bergeser.",
));

/* ================================================================ 2 data */
body.push(new Paragraph({ pageBreakBefore: true, children: [] }), H1("2  Data, dan Mengapa Belum Dapat Dipakai"));

body.push(H2("2.1  Apa sebenarnya isi lembar data itu"));
body.push(P(
  "Karakterisasi yang diberikan memuat 35 parameter dari lima sumber literatur terpisah — Gautam dkk. (2020, 2021, 2022), Pavelka dkk. (1993), dan Singa dkk. (2017). Ini bukan analisis satu air. Ini tabel berisi apa yang pernah dilaporkan terkandung dalam beberapa TPA berbeda, di tiga benua, dalam rentang tiga puluh tahun.",
));
body.push(P(
  "Perbedaan itu lebih penting daripada kedengarannya. Neraca ion — uji baku untuk memastikan sebuah analisis valid secara internal — kehilangan maknanya pada data gabungan: tidak ada satu air tunggal yang muatannya harus berjumlah nol. Setiap pemeriksaan silang yang biasanya menangkap kesalahan menjadi tidak tersedia.",
));

body.push(H2("2.2  Temuan validasi otomatis"));
body.push(table(["Tingkat", "Temuan"],
  d.dataDefects.map((x: Json) => [
    { v: ({ fail: "GAGAL", warn: "PERINGATAN", info: "INFO" } as Json)[x.severity] ?? x.severity.toUpperCase(),
      bg: x.severity === "fail" ? BAD : x.severity === "warn" ? WARN : ALT, b: true },
    ({
      "Ionic balance error outside tolerance": "Kesalahan neraca ion di luar toleransi",
      "Entered TDS contradicts the sum of ions": "TDS yang dimasukkan bertentangan dengan jumlah ion",
      "Silica not analysed": "Silika tidak dianalisis",
      "Parameters missing from the analysis": "Ada parameter yang tidak ada dalam analisis",
      "Conductivity not entered": "Konduktivitas tidak dimasukkan",
      "Seasonal variation": "Variasi musiman",
    } as Json)[x.title] ?? x.title,
  ]), [1800, 7600]));

body.push(spacer());
body.push(H2("2.3  Dua angka yang tidak mungkin benar"));
body.push(H3("Padatan terlarut 280.000 mg/L"));
body.push(P(
  "Air lindi TPA matang umumnya dilaporkan antara 5.000 dan 30.000 mg/L. Angka yang ditabelkan kira-kira sepuluh kali batas atas rentang itu dan delapan kali air laut. Kasus A di bawah menjalankan desain pada salinitas tersebut agar konsekuensinya terlihat, bukan sekadar dinyatakan.",
));
body.push(H3("Klorin bebas 130.000 mg/L"));
body.push(P(
  "Klorin bebas tidak mungkin berada pada konsentrasi berarti di dalam air yang mengandung COD 35.000 mg/L; ia akan habis dalam hitungan detik setelah kontak. Nilai tersebut hampir pasti klorida yang salah label. Bahkan dibaca sebagai klorida pun angkanya hampir tujuh kali air laut, dan dari sanalah TDS yang mustahil itu berasal.",
));

body.push(H2("2.4  Kasus A — desain dijalankan pada salinitas yang ditabelkan"));
body.push(P("Rangkaian pada Bab 3 dijalankan tanpa perubahan, hanya dengan salinitas apa adanya. Tahap reverse osmosis melaporkan:"));
body.push(table(["Besaran", "Nilai"], [
  ["Tahap", "2 seri, recovery total 85 %"],
  ["Luas membran", `${f(2261)} m²`],
  ["Modul", "252 × 9 m²"],
  ["Tekanan umpan", "877 bar (estimasi)"],
  ["Tekanan osmotik umpan / konsentrat", `${f(osmA, 0)} / 1.498 bar`],
  ["TDS konsentrat", "1.920 g/L"],
  ["Energi spesifik", `${f(38.23, 2)} kWh/m³ permeat`],
], [4200, 5200], [1]));
body.push(spacer());
body.push(callout("Yang dikatakan model tentang Kasus A", [
  "Estimasi tekanan umpan 877 bar melampaui rating modul 120 bar. Entah recovery-nya terlalu tinggi untuk salinitas ini, atau airnya memang terlalu pekat untuk DTRO sama sekali — periksa TDS umpan sebelum hal lain apa pun.",
  "Tekanan osmotik umpannya saja sudah 228 bar. Membran tidak dapat bekerja di bawah tekanan osmotiknya sendiri, jadi pada salinitas ini jawabannya adalah evaporasi, bukan tekanan yang lebih tinggi.",
], BAD, "9B2C1F"));
body.push(spacer());
body.push(P(
  `Di atas kertas instalasi ini tetap menghasilkan efluen yang memenuhi baku mutu, karena membrannya diminta melakukan yang mustahil, bukan diberi tahu bahwa itu mustahil. Yang berubah adalah energinya: ${f(A.sec_kWh_m3, 2)} kWh/m³ berbanding ${f(B.sec_kWh_m3, 2)} untuk rangkaian identik pada salinitas yang kredibel, dan ${f(A.energy_kWh_d)} kWh/hari berbanding ${f(B.energy_kWh_d)}. Desain yang dibawa maju di atas basis ini akan dihargai lima kali lipat energi sebenarnya, dan tetap tidak akan bekerja.`,
));

body.push(H2("2.5  Penggantian yang dilakukan untuk basis desain"));
body.push(table(["Parameter", "Dilaporkan", "Dipakai di sini", "Alasan"], [
  ["TDS", "280.000 mg/L", "20.000 mg/L",
    "Pada 280.000 mg/L tekanan osmotiknya sekitar 218 bar, di atas rating tekanan semua membran lindi yang dibuat. Instalasi yang digambarkan lembar data itu tidak dapat dibangun lewat jalur membran apa pun. 20.000 mg/L adalah nilai tengah rentang publikasi untuk lindi TPA matang."],
  ["Klorida", "130.000 mg/L, dilabeli klorin bebas (Cl₂)", "6.000 mg/L",
    "Klorin bebas tidak dapat berdampingan dengan COD 35.000 mg/L — ia akan habis dalam hitungan detik. Angka itu adalah klorida yang salah label, dan bahkan sebagai klorida pun hampir tujuh kali air laut."],
  ["Na, K, Ca, Mg, SO₄, HCO₃", "tidak dianalisis", "diasumsikan, diseimbangkan terhadap klorida",
    "Tidak satu pun kation utama muncul di lembar data, sehingga neraca ion tidak dapat dihitung darinya. Set yang dipakai di sini tipikal lindi matang dan netral secara internal; ini asumsi, bukan pengukuran."],
  ["Total nitrogen", "tidak dianalisis; amonia bebas 2.200 mg/L", "TN = 2.200 mg/L sebagai N",
    "Lembar data memberi amonia tetapi tidak total nitrogen, sehingga nitrogen organik tidak diketahui. Menyamakan TN dengan amonia adalah kasus optimistis: nitrogen organik yang ada tidak dapat di-stripping dan akan menaikkan nitrogen efluen akhir."],
], [1500, 1800, 1500, 4600]));
body.push(spacer());
body.push(callout("Ini asumsi, bukan koreksi", [
  "Mengganti angka yang mustahil dengan angka yang masuk akal tidak membuat basis desainnya benar. Itu membuatnya dapat diperdebatkan.",
  "Tidak ada bagian laporan ini yang boleh dikutip ke klien sebagai karakterisasi air lindi Bantargebang. Ini adalah gambaran umum lindi TPA matang, dipakai agar logika prosesnya dapat ditelusuri sementara pengambilan sampel yang sebenarnya diatur.",
  "Program sampling pada Bab 9 bukan formalitas. Itulah pembeda antara dokumen ini sebagai kajian dan sebagai desain.",
], WARN, "8A6100"));

/* ============================================================= 3 proses */
body.push(new Paragraph({ pageBreakBefore: true, children: [] }), H1("3  Desain Proses"));

body.push(H2("3.1  Rangkaian proses, dan alasan setiap tahapnya"));
body.push(table(["Tahap", "Mengapa ada dalam rangkaian"], [
  ["Intake & screen kasar", "Lindi membawa serpihan plastik, serat, dan grit dari massa sampah. Screen melindungi pompa; ia hampir tidak menyisihkan padatan tersuspensi, dan memang bukan itu tujuannya."],
  ["Ekualisasi, 12 jam", "Debit dan kepekatan lindi berayun mengikuti curah hujan. Semua tahap di hilir didosis atau diaerasi terhadap beban terukur, dan beban yang bergerak lebih cepat daripada pengendalinya tidak dapat didosis."],
  ["Koagulasi dan lamella clarifier", "Menyisihkan padatan tersuspensi sebelum peralatan mahal melihatnya, sekaligus sebagian beban organik koloid. Lamella dipilih, bukan sedimentasi horizontal, karena luas pelatnya yang membuatnya ringkas."],
  ["Reaktor anaerobik (UASB)", "Pada COD 35.000 mg/L, di sinilah sebagian besar beban organik seharusnya disisihkan, karena tidak perlu aerasi dan justru menghasilkan metana alih-alih mengonsumsi listrik. Tahap ini muncul di tiga belas dari tujuh belas instalasi lindi yang telah dikerjakan CCEPC, selalu pada posisi ini."],
  ["Dosing alkali ke pH 11", "Mengubah amonium menjadi amonia bebas, satu-satunya bentuk yang dapat di-stripping. Tanpa tahap ini, menara stripping hanya menggerakkan udara dan tidak lebih."],
  ["Ammonia stripping", "Menyisihkan nitrogen yang tidak dapat ditangani biologi, karena karbon untuk denitrifikasinya tidak tersedia. Gas buangnya ditangkap scrubber asam sulfat dan keluar sebagai amonium sulfat."],
  ["Netralisasi ke pH 7", "Wajib sebelum membran. Pada pH tinggi amonia berbentuk gas terlarut dan menembus reverse osmosis nyaris bebas; pada pH netral ia berbentuk ion dan tertahan di atas 95 %."],
  ["MBR", "Memoles sisa beban terurai hayati dan menghasilkan permeat tanpa padatan tersuspensi — umpan terbaik yang dapat diberikan proses biologis kepada membran."],
  ["DTRO, dua tahap", "Modul saluran terbuka inilah yang memungkinkan reverse osmosis pada cairan yang akan menyumbat elemen spiral dalam hitungan jam. Dua tahap mencapai recovery 85 % dengan setiap tahap tetap di dalam amplop tekanan dan scaling-nya sendiri."],
  ["Oksidasi lanjut katalitik", "Menyisihkan warna refraktori sisa yang tidak tersentuh tahap mana pun sebelumnya. Ditempatkan setelah membran secara sengaja: kebutuhan oksidan mengikuti massa bahan organik yang dihancurkan, sehingga unit yang sama di depan membran akan berbiaya operasi sekitar seratus kali lipat."],
  ["Trim pH akhir", "Permeat reverse osmosis bersifat asam — karbon dioksida menembus membran sementara alkalinitas yang akan menyangganya tidak. Baik membran maupun ozon tidak mengembalikannya, sedangkan batas buang adalah pH 6 sampai 9."],
], [2200, 7200]));

body.push(spacer());
body.push(H2("3.2  Kualitas air tahap demi tahap"));
body.push(P("Konsentrasi adalah nilai di inlet setiap tahap, sehingga efek satu unit adalah selisih antara barisnya dan baris di bawahnya.", { sz: 18, it: true }));
body.push(table(
  ["Tahap", "m³/hari", "COD", "BOD", "TN", "NH₄-N", "TSS", "TDS", "pH"],
  B.stages.map((s: Json) => [
    ({
      "Raw Leachate": "Lindi mentah", "Intake & Screen": "Intake & screen", "Equalisation": "Ekualisasi",
      "Coagulation": "Koagulasi", "Lamella Clarifier": "Lamella clarifier", "UASB": "UASB",
      "Alkali Dosing pH 11": "Dosing alkali pH 11", "Ammonia Stripping": "Ammonia stripping",
      "Neutralisation pH 7": "Netralisasi pH 7", "MBR": "MBR", "DTRO 2-stage": "DTRO 2 tahap",
      "Catalytic AOP": "AOP katalitik", "Final pH Trim": "Trim pH akhir", "Outfall to SPARING": "Outfall ke SPARING",
    } as Json)[s.stage] ?? s.stage,
    f(s.flow_m3d), f(s.COD), f(s.BOD), f(s.TN), f(s.NH4_N), f(s.TSS), f(s.TDS), f(s.pH, 1),
  ]), [2000, 900, 900, 800, 800, 800, 800, 900, 600], [1, 2, 3, 4, 5, 6, 7, 8],
));
body.push(spacer());
body.push(P("Semua konsentrasi mg/L kecuali pH. Angka merupakan keluaran model, bukan hasil pengukuran.", { sz: 17, it: true, color: "6B7A88" }));

body.push(H2("3.3  Penanda kepatuhan — yang tidak tercakup tujuh parameter wajib"));
body.push(P(
  "Merkuri dan kadmium adalah dua dari tujuh parameter yang diatur P.59/2016, dan keduanya tidak mempengaruhi neraca air. Keduanya dibawa dari hulu ke hilir memakai penyisihan yang dipublikasikan untuk rangkaian pengolahan utuh, dikreditkan pada barrier terkuat dalam rangkaian.",
));
body.push(table(["Parameter", "Air baku", "Penyisihan", "Efluen", "Baku mutu", "Status"],
  B.trace.slice(0, 10).map((t: Json) => {
    const bg = t.pass === false ? BAD : t.pass === true ? OK : undefined;
    const c = (v: string) => (bg ? { v, bg } : v);
    const nm = ({ Mercury: "Merkuri", Cadmium: "Kadmium", Lead: "Timbal", Arsenic: "Arsen",
      "Chromium, total": "Kromium total", "Chromium VI": "Kromium VI", Nickel: "Nikel", Zinc: "Seng",
      Copper: "Tembaga", Selenium: "Selenium", Cobalt: "Kobalt" } as Json)[t.label] ?? t.label;
    return [c(`${nm} (${t.unit})`), c(f(t.inlet, 4)), c(`${f(t.removalPct, 0)} %`), c(f(t.outlet, 5)),
      c(t.limit != null ? f(t.limit, 4) : "tidak diatur"), c(t.pass == null ? "—" : t.pass ? "Memenuhi" : "GAGAL")];
  }), [2400, 1400, 1400, 1500, 1400, 1300], [1, 2, 3, 4]));

body.push(spacer());
body.push(callout("Dua konsentrasi yang menentukan apakah proses biologisnya bekerja sama sekali", [
  "Sianida pada 6,10 mg/L berada di atas ambang 2,0 mg/L yang menghambat nitrifikasi.",
  "Sulfida pada 28,50 mg/L berada di atas ambang 20,0 mg/L yang menghambat biologi aerobik.",
  "Sianida menghambat bakteri nitrifikasi pada konsentrasi sangat rendah, dan sulfida bersifat toksik langsung terhadap biomassa aerobik sekaligus menimbulkan kebutuhan oksigen tersendiri. Kedua angka berasal dari data gabungan literatur, jadi keduanya mungkin keliru — tetapi bila salah satu benar, MBR tidak akan berkinerja seperti model dan batas amonia akan terlewat, sementara penyisihan karbonnya tetap terlihat sehat.",
  "Kedua parameter ini harus diukur pada air lindi yang sebenarnya sebelum tahap biologis didimensikan. Keduanya uji murah, dan konsekuensi desainnya lebih besar daripada sebagian besar parameter yang sudah dianalisis.",
], WARN, "8A6100"));

/* ========================================================== 4 neraca */
body.push(new Paragraph({ pageBreakBefore: true, children: [] }), H1("4  Neraca, Energi, dan Bahan Habis Pakai"));

body.push(H2("4.1  Neraca air"));
body.push(table(["Kasus", "Umpan, m³/hari", "Produk, m³/hari", "Buangan, m³/hari", "Recovery", "Galat penutupan"], [
  ["B — konsentrat dibuang", f(B.feedFlow_m3d), f(B.productFlow_m3d), f(B.wasteFlow_m3d), `${f(B.recovery_pct, 2)} %`, `${f(B.waterClosure_pct, 4)} %`],
  [{ v: "C — dengan MVR dan kristalisator", bg: OK }, { v: f(C.feedFlow_m3d), bg: OK }, { v: f(C.productFlow_m3d), bg: OK },
    { v: f(C.wasteFlow_m3d), bg: OK }, { v: `${f(C.recovery_pct, 2)} %`, bg: OK }, { v: `${f(C.waterClosure_pct, 4)} %`, bg: OK }],
], [2900, 1500, 1500, 1500, 1100, 900], [1, 2, 3, 4, 5]));
body.push(spacer());
body.push(P(
  `Menambahkan evaporasi dan kristalisasi menaikkan recovery dari ${f(B.recovery_pct, 1)} % menjadi ${f(C.recovery_pct, 1)} % dan menghilangkan konsentrat cair. Biayanya ${f(C.energy_kWh_d - B.energy_kWh_d)} kWh/hari, yaitu ${f((C.energy_kWh_d / B.energy_kWh_d - 1) * 100)} % lebih banyak energi dibanding instalasi tanpanya. Layak tidaknya pertukaran itu sepenuhnya bergantung pada apakah konsentratnya punya tempat pembuangan — dan di sebuah TPA, jawaban jujurnya biasanya tidak ada. Mengembalikannya ke massa sampah hanya mendaur ulang bebannya, dan di lokasi ini menambah air ke lereng yang sudah bermasalah.`,
));

body.push(H2("4.2  Energi"));
body.push(table(["Kasus", "Total, kW", "kWh/hari", "Spesifik, kWh/m³"], [
  ["A — pada salinitas yang ditabelkan", f(A.totalPower_kW), f(A.energy_kWh_d), f(A.sec_kWh_m3, 2)],
  ["B — basis desain", f(B.totalPower_kW), f(B.energy_kWh_d), f(B.sec_kWh_m3, 2)],
  ["C — basis desain dengan ZLD", f(C.totalPower_kW), f(C.energy_kWh_d), f(C.sec_kWh_m3, 2)],
], [3400, 2000, 2000, 2000], [1, 2, 3]));
body.push(spacer());
body.push(P(
  "Tidak ada rencana membangun PLTSa di lokasi ini dan tidak ada rencana menarik daya PLN, sehingga tersisa pembangkitan diesel. Pada tarif tersebut, selisih antara Kasus B dan Kasus C bukan item pembulatan, dan itu satu argumen lagi untuk melakukan capping permukaan sampah sebelum apa pun didimensikan: lindi yang lebih sedikit berarti setiap biaya operasi berkurang serentak.",
));

body.push(H2("4.3  Bahan kimia dan residu"));
const chemNames: Json = {
  "Hydrated lime Ca(OH)2": "Kapur padam Ca(OH)₂", "Sulphuric acid H2SO4": "Asam sulfat H₂SO₄",
  "Oxygen (LOX or PSA)": "Oksigen (LOX atau PSA)", "Poly-aluminium chloride": "Poli-aluminium klorida (PAC)",
  "Citric acid (CIP)": "Asam sitrat (CIP)", "Caustic soda NaOH": "Soda kaustik NaOH",
  "Caustic soda (CIP)": "Soda kaustik (CIP)", Antiscalant: "Antiscalant",
  "Polymer (dewatering)": "Polimer (dewatering)", "Sodium hypochlorite (CIP)": "Natrium hipoklorit (CIP)",
  "Polymer flocculant": "Polimer flokulan", "Sodium hypochlorite (as Cl2)": "Natrium hipoklorit (sebagai Cl₂)",
};
body.push(table(["Bahan", "ton/hari"],
  B.chemicals_t_d.filter((c: Json) => c.t_d > 0.001).map((c: Json) => [chemNames[c.name] ?? c.name, f(c.t_d, 3)]),
  [6400, 3000], [1]));
body.push(spacer());
const lime = B.chemicals_t_d.find((c: Json) => /lime/i.test(c.name))?.t_d ?? 0;
const acid = B.chemicals_t_d.find((c: Json) => /Sulphuric/i.test(c.name))?.t_d ?? 0;
body.push(callout("Biaya operasi ada di bahan kimia, bukan di energi", [
  `Kapur padam ${f(lime, 1)} ton/hari dan asam sulfat ${f(acid, 1)} ton/hari mendominasi seluruh item lain di instalasi ini.`,
  "Keduanya berasal dari amonia. Setiap mol amonium yang harus menjadi amonia bebas mengonsumsi satu mol hidroksida, dan setiap dua mol yang ditangkap scrubber mengonsumsi satu mol asam sulfat. Pada konsentrasi amonia ini, suku tersebut satu orde lebih besar daripada sistem karbonat, dan dosis kaustik yang dihitung dari alkalinitas saja akan kurang beberapa kali lipat.",
  "Pengelola disebutkan tidak sanggup menanggung biaya operasi tinggi. Inilah angka yang menentukannya, dan ini alasan lain mengapa capping — yang menurunkan volume sehingga menurunkan massa seluruh bahan yang didosis — bernilai lebih daripada optimasi proses mana pun yang tersedia di hilir.",
  `Lumpur hasil dewatering keluar sebesar ${f(B.drySolids_t_d, 2)} ton/hari padatan kering, yang memerlukan jalur pembuangan dan armada angkut.`,
], WARN, "8A6100"));

/* ============================================================ 5 lereng */
body.push(new Paragraph({ pageBreakBefore: true, children: [] }), H1("5  Kondisi Lokasi: Lereng Sampah di Sebelahnya"));

body.push(H2("5.1  Yang dilaporkan"));
[
  "Batas instalasi berbatasan langsung dengan tumpukan sampah yang sangat tinggi.",
  "Dinding penahan di antaranya sudah lebih dari sekali roboh akibat pergeseran massa sampah.",
  "Dua dari empat IPAS awal rusak karena pergeseran tersebut, dan hanya IPAS 2 yang dipastikan beroperasi.",
  "Rencananya fasilitas eksisting disingkirkan dan dibangun yang baru, bukan meningkatkan yang ada.",
].forEach((t) => body.push(bullet(t)));
body.push(spacer());
body.push(P(
  "Dinding yang roboh berulang kali tidak roboh karena kebetulan. Entah ia tidak pernah dirancang untuk beban yang dipikulnya, atau bebannya bertambah seiring tumpukan meninggi, atau air di belakangnya tidak pernah didrainase. Biasanya yang ketiga: struktur penahan terhadap massa sampah jenuh setidaknya sama seringnya roboh karena tekanan air pori dibanding karena berat materialnya sendiri, dan drainase di belakang dinding adalah hal paling murah untuk dihilangkan dari sebuah desain.",
));

body.push(H2("5.2  Mengapa instalasi bertingkat merupakan respons yang keliru di sini"));
body.push(table(["Akibat membangun ke atas", "Konsekuensinya pada tanah yang bergerak"], [
  ["Beban terpusat pada tapak kecil", "Tekanan tumpu lebih tinggi, pondasi lebih dalam dan lebih mahal, serta struktur yang perilaku penurunannya bergantung pada profil tanah yang belum diselidiki siapa pun."],
  ["Ketinggian di atas dasar", "Pergeseran lateral tanah berubah menjadi momen di dasar. Struktur rendah dan menyebar menyerap pergeseran yang sama sebagai rotasi kecil tanpa penguatan semacam itu."],
  ["Satu rangka struktur", "Penurunan diferensial menjalar ke seluruh bangunan. Struktur penampung air retak dan bocor akibat pergerakan diferensial, dan tangki retak pada instalasi bertingkat tidak dapat diisolasi dari unit di bawahnya."],
  ["Semua proses dalam satu gedung", "Satu kejadian kegagalan berarti kerugian total. Bila menyebar dan rendah, kejadian yang sama hanya menghabisi unit terdekat dinding dan menyisakan sisanya tetap beroperasi."],
  ["Lahan yang dihemat", `Tidak ada yang dibutuhkan. Proses menempati ${f(C.processArea_m2 / SITE * 100)} % lahan pada kapasitas desain.`],
], [2900, 6500]));

body.push(spacer());
body.push(H2("5.3  Yang sebaiknya dilakukan sebagai gantinya"));
body.push(H3("Belanjakan lahan untuk jarak"));
body.push(P(
  `Proses membutuhkan sekitar ${f(C.processArea_m2)} m². Dengan kelonggaran memadai untuk jalan akses, gudang bahan kimia, area lumpur, gedung listrik dan kontrol, serta drainase, luas terbangun berada pada kisaran 4.000 m² — seperlima lahan. Pada plot 2 ha yang kira-kira persegi, itu menyisakan sekitar 70 m ruang bersih antara instalasi dan batas terdekat dengan tumpukan sampah, apabila tata letaknya memang disusun untuk mencapainya.`,
));
body.push(P(
  "Jarak sempadan adalah satu-satunya mitigasi yang gratis, tidak memerlukan perawatan, tidak dapat dihilangkan lewat value engineering saat konstruksi, dan tetap bekerja walaupun semua mitigasi lain gagal. Di lokasi ini ia tersedia berlimpah dan seharusnya diperlakukan sebagai keputusan desain utama, bukan sebagai ruang sisa.",
));
body.push(...figure("scripts/out/layout-id.png",
  "Gambar 1 — Usulan tata letak. Blok digambar sesuai luas yang dihitung model. Zona penyangga digambar pada skala yang sama dengan instalasi, sehingga perbandingannya bukan sekadar retorika."));

body.push(H3("Pondasi terpisah untuk setiap unit"));
body.push(P(
  "Pondasi terpisah per struktur, dengan flexible coupling pada setiap pipa yang menyeberang di antaranya, membuat pergerakan tanah merusak satu unit alih-alih merambat lewat raft bersama. Biayanya kecil pada tahap desain dan tidak dapat dipasang belakangan.",
));
body.push(H3("Urutkan instalasi menurut apa yang sanggup direlakan"));
body.push(P(
  "Skid membran, MBR, ruang listrik, dan ruang kontrol adalah item yang mahal, waktu pengadaannya panjang, dan paling sulit digantikan. Semuanya ditempatkan di tepi terjauh. Kolam ekualisasi, area lumpur, dan tahap koagulasi adalah pekerjaan sipil yang relatif cepat dibangun ulang, dan dapat menempati tepi yang dekat.",
));
body.push(H3("Pertimbangkan instalasi modular alih-alih monolitik"));
body.push(P(
  "Tahap membran secara alami berbentuk skid, dan pra-olahnya dapat dibangun sebagai tangki baja baut atau GRP di atas tanah alih-alih beton terpendam. Tangki di atas tanah dapat di-level ulang setelah penurunan, diganti satu per satu, dan dipindahkan bila batas lahan harus ditarik mundur. Beton terpendam tidak dapat melakukan satu pun dari itu. Inilah gagasan instalasi ringkas yang layak diambil dari IPAL Krukut — modularitas dan prefabrikasi — dipisahkan dari penumpukannya, yang justru bagian yang tidak cocok untuk lokasi ini.",
));

body.push(H2("5.4  Capping: satu tindakan, tiga persoalan"));
body.push(table(["Yang dilakukan capping", "Mengapa penting di sini"], [
  ["Menurunkan timbulan lindi sekitar 70 %",
    `Target 2028 turun dari 7.000 menjadi sekitar 2.100 m³/hari. Luas proses turun dari ${f(D.processArea_m2)} m² menjadi ${f(E.processArea_m2)} m², dari ${f(D.processArea_m2 / SITE * 100)} % lahan menjadi ${f(E.processArea_m2 / SITE * 100)} %, dan itulah yang mempertahankan jarak sempadan sepanjang masa perluasan.`],
  ["Menurunkan seluruh konsumsi secara proporsional",
    `Energi turun dari ${f(D.energy_kWh_d)} menjadi ${f(E.energy_kWh_d)} kWh/hari. Massa bahan kimia turun dengan rasio yang sama, dan bahan kimia adalah biaya operasi dominan.`],
  ["Mengurangi infiltrasi ke dalam massa sampah",
    "Infiltrasi yang lebih kecil berarti tekanan air pori di belakang dinding penahan lebih rendah, yang merupakan satu dari dua penyebab utama runtuhnya dinding semacam itu. Ini satu-satunya tindakan dalam daftar ini yang memperbaiki stabilitas lerengnya sendiri."],
  ["Mengurangi volume air di dalam tubuh sampah", "Massa sampah yang lebih kering berarti lebih ringan dan lebih stabil."],
], [2700, 6700]));
body.push(spacer());
body.push(P(
  "Capping biasanya disajikan sebagai urusan operasional TPA dan dianggap di luar lingkup kontraktor air. Di lokasi ini, capping adalah keputusan rekayasa dengan daya ungkit tertinggi yang tersedia, dan justru layak diangkat karena tidak ada penjual peralatan pengolahan air yang punya insentif untuk mengangkatnya.",
));

body.push(H2("5.5  Yang harus dipastikan sebelum semua ini didesain"));
body.push(table(["Yang harus dipastikan", "Mengapa desain bergantung padanya"], [
  ["Tinggi, sudut lereng, dan jarak tumpukan sampah dari batas lahan", "Menentukan beban lateral dan jarak luncuran bila muka lereng runtuh. Tanpanya, tidak ada jarak sempadan yang dapat dibenarkan secara numerik."],
  ["Analisis stabilitas lereng dengan faktor keamanan yang dinyatakan, kondisi musim hujan", "Runtuhnya dinding yang sudah terjadi adalah bukti bahwa analisis ini belum pernah dilakukan, atau dilakukan dengan asumsi musim kemarau."],
  ["Apakah tumpukan masih menerima sampah di muka ini, dan sampai ketinggian akhir berapa", "Desain terhadap geometri hari ini adalah desain terhadap beban yang masih bertambah."],
  ["Muka air tanah dan lindi di belakang struktur penahan, serta ada tidaknya drainase", "Tekanan air pori adalah penyebab kegagalan yang lazim dan paling murah diperbaiki."],
  ["Catatan runtuhnya dinding sebelumnya — kapan, sejauh apa, musim apa", "Kegagalan yang mengelompok di musim hujan menunjuk ke air; kegagalan setelah kampanye penimbunan menunjuk ke beban."],
  ["Catatan penurunan atau patok survei pada struktur eksisting", "IPAS eksisting adalah eksperimen berinstrumen yang sudah berjalan bertahun-tahun; datanya mungkin ada."],
  ["Penyelidikan tanah pada tapak instalasi itu sendiri", "Desain pondasi tidak dapat berjalan tanpanya, dan di lokasi yang berbatasan dengan massa sampah, profilnya kecil kemungkinan seragam."],
  ["Ada tidaknya program capping, dan seluas apa", "Menentukan apakah debit 2028 adalah 7.000 atau 2.100 m³/hari, yang mengubah instalasi, kebutuhan lahan, dan biaya operasi."],
], [3400, 6000]));

/* ============================================================ 6 Krukut */
body.push(new Paragraph({ pageBreakBefore: true, children: [] }), H1("6  Soal Bangunan Bertingkat, dan IPAL Krukut"));
body.push(P(
  `IPAL Krukut di Setiabudi, Jakarta Selatan, adalah rujukan yang biasa disebut untuk instalasi pengolahan vertikal di Indonesia, dan memang tepat: ia IPAL bertingkat pertama di Indonesia, beroperasi sejak Agustus 2021, mengolah ${f(K.capacity_m3d)} m³/hari air limbah domestik dengan MBBR, dan melakukannya di atas ${f(K.land_m2)} m² lengkap dengan ruang edukasi dan kafe atap di atas prosesnya.`,
));
body.push(table(["", "IPAL Krukut", "IPAS 2 Bantargebang"], [
  ["Kapasitas", `${f(K.capacity_m3d)} m³/hari`, `${f(d.site.capacity_m3d)} m³/hari`],
  ["Luas lahan", `${f(K.land_m2)} m²`, `${f(SITE)} m²`],
  [{ v: "Lahan tersedia per m³/hari", b: true }, { v: `${f(K.intensity_m2_per_m3d, 2)} m²`, bg: BAD, b: true },
    { v: `${f(SITE / d.site.capacity_m3d, 1)} m²`, bg: OK, b: true }],
  ["Jenis air", "Air limbah domestik", "Air lindi TPA matang"],
  ["Proses", "MBBR, satu tahap biologis", "Sebelas tahap: anaerobik, stripping, membran, oksidasi"],
  ["Kendala penentu", "Lahan, mutlak", "Stabilitas lereng"],
], [2600, 3400, 3400]));
body.push(spacer());
body.push(callout("Rujukan yang tepat untuk persoalan yang berbeda", [
  `Krukut punya ${f(K.intensity_m2_per_m3d, 2)} m² lahan untuk setiap m³/hari yang diolahnya. Bantargebang punya ${f(SITE / d.site.capacity_m3d, 1)} m² — sekitar ${f(SITE / d.site.capacity_m3d / K.intensity_m2_per_m3d, 0)} kali lipat per satuan kapasitas.`,
  "Krukut membangun vertikal karena tidak ada pilihan lain di lahan stasiun pompa seluas 1.200 m² di tengah Jakarta. Itu solusi yang sangat baik untuk persoalan yang tidak dimiliki lokasi ini.",
  "Yang layak diambil darinya adalah keringkasan peralatan dan kesediaan melakukan prefabrikasi — bukan penumpukannya. Penumpukan justru hal yang paling tidak sanggup ditanggung lokasi yang berbatasan dengan lereng tidak stabil.",
], ALT, NAVY));

/* ================================================ 7 tahapan & skalabilitas */
body.push(new Paragraph({ pageBreakBefore: true, children: [] }), H1("7  Tahapan Konstruksi dan Skalabilitas"));

body.push(H2("7.1  Instalasi tidak boleh berhenti selagi digantikan"));
body.push(P(
  "TPST tanpa instalasi pengolahan lindi yang berfungsi tidak boleh beroperasi. Rencananya fasilitas eksisting disingkirkan dan dibangun yang baru, yang berarti instalasi baru harus di-commissioning sebelum yang lama dibongkar, atau instalasi sementara harus disediakan untuk selang waktunya.",
));
body.push(P(
  "Lahan sisa itulah yang memungkinkan pilihan pertama. Membangun instalasi baru di bagian lahan yang belum terpakai, melakukan commissioning, memindahkan aliran, dan baru kemudian membongkar kolam lama menghilangkan kebutuhan instalasi sementara sepenuhnya. Ini alasan kedua untuk tidak mendesain instalasi padat di tapak eksisting: melakukannya justru memaksa entah penghentian operasi atau pemasangan sementara, dan keduanya lebih mahal daripada lahan yang hendak dihemat.",
));

body.push(H2("7.2  Penskalaan ke target 2028"));
body.push(table(["Skenario", "Debit, m³/hari", "Luas proses", "Porsi lahan", "Energi, kWh/hari", "Recovery"], [
  ["Sekarang — Kasus C", f(C.feedFlow_m3d), `${f(C.processArea_m2)} m²`, `${f(C.processArea_m2 / SITE * 100)} %`, f(C.energy_kWh_d), `${f(C.recovery_pct, 1)} %`],
  [{ v: "2028 dengan capping — Kasus E", bg: OK }, { v: f(E.feedFlow_m3d), bg: OK }, { v: `${f(E.processArea_m2)} m²`, bg: OK },
    { v: `${f(E.processArea_m2 / SITE * 100)} %`, bg: OK }, { v: f(E.energy_kWh_d), bg: OK }, { v: `${f(E.recovery_pct, 1)} %`, bg: OK }],
  [{ v: "2028 tanpa capping — Kasus D", bg: WARN }, { v: f(D.feedFlow_m3d), bg: WARN }, { v: `${f(D.processArea_m2)} m²`, bg: WARN },
    { v: `${f(D.processArea_m2 / SITE * 100)} %`, bg: WARN }, { v: f(D.energy_kWh_d), bg: WARN }, { v: `${f(D.recovery_pct, 1)} %`, bg: WARN }],
], [2700, 1400, 1400, 1200, 1500, 1200], [1, 2, 3, 4, 5]));
body.push(spacer());
body.push(P(
  `Bahkan tanpa mitigasi, target 2028 tetap muat: ${f(D.processArea_m2)} m² proses di atas lahan ${f(SITE)} m². Namun pada titik itu luas terbangun beserta jalan dan gedung mendekati tiga perempat plot, dan jarak sempadan dari lereng — satu-satunya mitigasi yang hari ini tidak berbiaya — itulah yang termakan. Pertukaran inilah yang perlu dinyatakan sekarang, selagi tata letaknya masih dapat ditetapkan, bukan pada 2028 ketika sudah tidak bisa.`,
));

/* ======================================================= 8 rekomendasi */
body.push(new Paragraph({ pageBreakBefore: true, children: [] }), H1("8  Rekomendasi"));
body.push(table(["No.", "Rekomendasi"], [
  ["1", "Jangan mendesain instalasi bertingkat. Lahan yang dihematnya tidak dibutuhkan, dan risiko geoteknik yang ditambahkannya adalah risiko penentu di lokasi ini."],
  ["2", "Tetapkan jarak sempadan dari batas tumpukan sampah sebagai kendala desain sebelum tata letak digambar, dan pertahankan sepanjang perluasan 2028."],
  ["3", "Buat pondasi terpisah per unit, sambungkan dengan flexible coupling, dan tempatkan peralatan tak tergantikan di tepi terjauh."],
  ["4", "Bangun instalasi baru di lahan yang belum terpakai dan lakukan commissioning sebelum membongkar yang lama. TPST tidak boleh berhenti."],
  ["5", "Ambil sampel air lindi secara benar. Karakterisasi yang ada tidak dapat menopang sebuah desain, dan dua angkanya mustahil."],
  ["6", "Ukur sianida dan sulfida secara khusus. Keduanya berpotensi menghentikan kerja tahap biologis, dan tidak satu pun termasuk tujuh parameter wajib."],
  ["7", "Angkat opsi capping kepada klien. Capping menurunkan debit sekitar 70 %, menurunkan seluruh biaya operasi secara proporsional, dan merupakan satu-satunya tindakan yang sekaligus memperbaiki stabilitas lereng."],
  ["8", "Pesan analisis stabilitas lereng untuk kondisi musim hujan sebelum menetapkan batas lahan. Runtuhnya dinding berulang adalah buktinya bahwa analisis ini belum ada."],
  ["9", "Perlakukan jalur konsentrat sebagai keputusan, bukan detail. Evaporasi menambah sepertiga energi; mengembalikan konsentrat ke massa sampah menambah air ke lereng yang sudah bermasalah."],
].map(([a, b]) => [{ v: a, b: true }, b]), [700, 8700]));

/* ======================================================== 9 batasan */
body.push(new Paragraph({ pageBreakBefore: true, children: [] }), H1("9  Batasan"));
[
  "Analisis air merupakan gabungan literatur dari lima studi atas lima TPA berbeda antara 1993 dan 2022. Ini bukan karakterisasi air lindi Bantargebang dan tidak boleh dikutip sebagai karakterisasi tersebut.",
  "Padatan terlarut dan klorida telah diganti sebagaimana diuraikan pada Bab 2.5. Kedua penggantian itu adalah asumsi.",
  "Total nitrogen disamakan dengan amonia yang dilaporkan, yang merupakan kasus optimistis. Nitrogen organik tidak dapat di-stripping, sehingga bila ia hadir, nitrogen efluen akan lebih tinggi daripada hasil model.",
  "Sianida, sulfida, dan fenol dibawa sebagai penanda kepatuhan memakai penyisihan tingkat rangkaian yang dipublikasikan untuk rantai pengolahan utuh, bukan penolakan per unit. Angkanya indikatif dan bukan jaminan.",
  "Luas proses diturunkan dari volume terhitung dibagi kedalaman kerja, dengan kelonggaran 45 % untuk akses dan perpipaan. Angka itu menjawab apakah instalasi muat; ia bukan pengganti gambar tata letak.",
  "Biaya investasi merupakan estimasi orde besaran berbasis kurva pangkat dan belum diuji terhadap penawaran vendor mana pun.",
  "Kinerja membran belum dijalankan ulang di perangkat lunak proyeksi pemasok, dan itu harus dilakukan sebelum komitmen apa pun.",
  "Tidak tersedia informasi geoteknik apa pun. Setiap pernyataan mengenai lereng merupakan pertimbangan rekayasa berdasarkan penjelasan lisan, dan Bab 5.5 mendaftar apa yang harus dipastikan agar ia dapat menjadi lebih dari itu.",
  "Fasilitas eksisting belum disurvei. Lingkup pembongkaran, utilitas terpendam, dan kondisi struktur penahan eksisting semuanya belum diketahui.",
  "Tidak ada bagian dari dokumen ini yang telah diverifikasi lewat uji pilot. Pada air lindi refraktori, uji pilot lazimnya adalah pembeda antara sebuah proposal dan sebuah komitmen.",
].forEach((t) => body.push(bullet(t)));

body.push(spacer());
body.push(callout("Status", [
  "Ini adalah basis desain yang disusun untuk menata percakapan rekayasa, bukan sebuah desain. Dokumen ini diterbitkan agar pertanyaan pada Bab 5.5 dan Bab 9 dapat diajukan kepada klien lengkap dengan alasannya.",
  "Angka dihasilkan langsung oleh mesin simulasi HydroDesk dari basis yang dinyatakan. Neraca air tertutup hingga 0,0001 % pada setiap kasus yang disajikan.",
], ALT, NAVY));

/* ================================================================ susun */
const doc = new Document({
  creator: "PT CCEPC Indonesia",
  title: "Basis Desain — IPAL Lindi, IPAS 2 Bantargebang",
  styles: { default: { document: { run: { font: "Calibri", size: 20 } } } },
  sections: [{
    properties: { page: { margin: { top: 1000, bottom: 1000, left: 1000, right: 1000 } } },
    children: body,
  }],
});

void Packer.toBuffer(doc).then((buf) => {
  const out = "scripts/out/Bantargebang IPAS 2 - Basis Desain (ID).docx";
  writeFileSync(out, buf);
  console.log(`Wrote ${out}  (${(buf.length / 1024).toFixed(0)} kB)`);
});
