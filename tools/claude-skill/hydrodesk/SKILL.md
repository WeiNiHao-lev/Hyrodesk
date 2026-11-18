---
name: hydrodesk
description: Membaca proyek, membuat dan menjalankan simulasi, mengecek baku mutu, dan menyimpan run ke HydroDesk (simulator WTP/WWTP/SWRO/ZLD tim CCEPC Indonesia di hyrodesk-6gi9.vercel.app) lewat CLI dan API-nya, memakai engine yang sama dengan web. Gunakan skill ini setiap kali pengguna menyebut HydroDesk, "simulasikan di HydroDesk", "buat run/flowsheet", "simpan ke proyek", "cek proyek X di HydroDesk", "bandingkan run", atau meminta simulasi proses pengolahan air (WTP, SWRO, desalinasi, demin, IPAL, lindi, softening, remineralisasi) yang hasilnya harus muncul di HydroDesk, walaupun kata "skill" tidak disebut. Also use for English requests like "run this in HydroDesk", "save a run to my HydroDesk project", "check project X in HydroDesk".
---

# HydroDesk dari Claude Code

HydroDesk adalah simulator proses air tim CCEPC Indonesia R&D. Web: https://hyrodesk-6gi9.vercel.app.
Skill ini memberi akses ke akun HydroDesk **pengguna komputer ini** dari sesi Claude Code mana pun: membaca
proyeknya, mensimulasikan flowsheet di server (engine yang sama dengan web), mengecek baku mutu, dan menyimpan
run sehingga langsung terlihat di web. Setiap anggota tim menghubungkan Claude Code-nya sendiri ke akunnya
sendiri (HydroDesk → Settings → Claude Code).

Semua perintah lewat satu CLI tanpa dependensi:

```
node ~/.claude/skills/hydrodesk/scripts/hydrodesk.mjs <perintah>
```

Di bawah ini ditulis `hd <perintah>` sebagai singkatan. `hd help` menampilkan semua perintah.

**Simulasi berjalan di komputer ini.** `simulate`, `save-run`, dan `workbench` memakai mesin simulasi HydroDesk
yang diunduh otomatis ke `~/.hydrodesk/engine/` (kode yang sama persis dengan web dan server, jadi hasilnya
identik). Server hanya dipakai untuk membaca dan menyimpan proyek, sehingga simulasi tidak membebani kuota
HydroDesk. Versi mesin dicek otomatis (paling lama tiap 10 menit, dan selalu sebelum `save-run`); kalau HydroDesk
diperbarui, mesin baru diunduh sendiri. `hd engine` menampilkan versinya. `--server` memaksa simulasi di server,
hanya untuk keadaan khusus (misalnya membandingkan hasil).

## 1. Koneksi (sekali per komputer)

1. `hd whoami`. Kalau sudah terhubung, lanjut ke langkah 2.
2. Kalau belum: jalankan `hd login --no-wait`. CLI mencetak link `.../connect?code=XXXX-XXXX` dan kodenya.
   Berikan link dan kode itu ke pengguna, minta dia membukanya di browser (dalam keadaan login) dan klik **Approve**
   kalau kodenya sama. Setelah itu jalankan `hd wait`, yang menunggu sampai disetujui (maks. 10 menit).
3. Token tersimpan di `~/.hydrodesk/config.json`. **Jangan pernah membaca, menampilkan, atau menyalin isi file itu**,
   dan jangan meminta password atau token di chat. CLI yang memakainya.
4. Kalau API menjawab token ditolak, ulangi langkah 2. `hd logout` mencabut token mesin ini.

Token ini hanya bisa membaca proyek (miliknya dan workspace yang dibuka untuknya), mensimulasikan, membuat
proyek, dan menyimpan run. Menghapus proyek, membuat link share, mengubah password, membuka workspace orang lain,
dan fungsi admin sengaja tidak bisa lewat token: arahkan pengguna ke web untuk itu.

## 2. Alur kerja

1. **Pahami permintaan dan datanya.** `hd projects`, `hd project <id>` (ringkasan, catatan, daftar run), dan
   `hd workspaces` untuk proyek rekan yang dibuka untuknya (lihat saja).
2. **Mulai dari yang sudah ada, jangan dari nol:**
   - run yang sudah tersimpan: `hd run <projectId> <index> --out fs.json`;
   - template: `hd catalog templates` lalu `hd template <key> --out fs.json`;
   - air baku: `hd catalog presets` lalu `hd preset <key> --out feed.json`, dan masukkan ke `fs.feed`.
3. **Edit flowsheet JSON** (format di `references/flowsheet.md`). Untuk parameter unit, selalu cek dulu
   `hd unit <type>`, karena nama, satuan, dan default-nya ada di sana. Jangan menebak nama parameter.
4. **Simulasikan:** `hd simulate fs.json [--check dc-s,dc-d] [--discharge permenlh11-air-50]`. Baca ringkasannya:
   konvergen, debit, recovery, SEC, OPEX, indicative CAPEX, kualitas produk, hasil cek baku mutu, peringatan,
   dan tabel unit per unit. Ulangi edit dan simulasi sampai masuk akal.
5. **Simpan** setelah hasilnya layak ditunjukkan: `hd save-run <projectId> fs.json --name "..." --note "..."`.
   Proyek baru: `hd new-project --name "..." --client "..." --location "..." --kind Desalination`. CLI mencetak
   link ke halaman Runs. Berikan link itu ke pengguna.
6. **Halaman workbench** (bila diminta untuk workbench atasan / 高端咨询室工作台, atau "versi HTML untuk dipamerkan"):
   `hd workbench fs.json --out hasil.html --title "..." --notes notes.json`. Hasilnya satu file HTML mandiri
   (中 / EN / ID: diagram proses, KPI, kualitas vs baku mutu, benchmark SWRO, catatan per unit, bahan kimia, lalu
   catatan proyek di akhir) yang tidak memuat apa pun dari luar, jadi bisa diunggah ke Showcase Library workbench.
   `notes.json` berisi tahap proyek, kelayakan, data yang masih diperlukan, dan komentar pengguna. **Terjemahkan
   sendiri** komentar dan daftar data itu ke tiga bahasa (zh, en, id) dan isi ketiganya; jangan biarkan kosong:
   ```json
   { "stage": "simulation", "verdict": "conditional",
     "notes": { "source": "id",
       "comments":   { "id": "Owner menawarkan FS ke kita.", "en": "The owner has offered us the FS.", "zh": "业主邀请我们承担可研。" },
       "dataNeeded": { "id": "Data pasang surut\nTarif listrik", "en": "Tide data\nPower tariff", "zh": "潮位资料\n电价" } } }
   ```
   `stage`: lead, data-collection, simulation, pre-approval, approved, on-hold, rejected. `verdict`: feasible,
   conditional, not-feasible. HydroDesk menambahkan sendiri data yang kurang yang bisa ia deteksi (analisis air
   baku, parameter yang harus dibuktikan terpisah); `--no-auto-gaps` mematikannya. Untuk run tersimpan, ambil dulu
   flowsheet-nya dengan `hd run <projectId> <index> --out fs.json`. Unggahnya dilakukan pengguna sendiri.

Untuk studi banyak varian (sapuan parameter, mencari porsi pass kedua, dsb.), jalankan `simulate` berulang
dengan file yang berbeda, lalu simpan hanya varian yang bermakna, masing-masing dengan nama dan catatan yang
jelas. Karena simulasi berjalan di komputer ini, sapuan ratusan variasi pun cepat (milidetik per run) dan tidak
membebani server; tetap simpan hanya run yang bermakna.

## 3. Aturan yang harus dijaga

- **Jujur soal data.** Bedakan angka terukur, asumsi, dan hasil skala. Tulis di `--note` run: dari mana air baku
  berasal, apa yang diasumsikan, dan risiko yang belum terjawab (misalnya boron, ion yang tidak dianalisis).
- **Produk vs buangan.** `product` dan `outfall` dihitung sebagai PRODUK dalam neraca. Brine, lumpur, backwash, dan
  semua yang dibuang memakai `waste`. Kesalahan ini membuat recovery terlihat bagus padahal salah.
- **Tata letak kiri ke kanan.** Port masuk ada di kiri blok dan port keluar di kanan. Susun `position.x`
  bertambah ~260 per tahap, aliran samping (lumpur, buangan) di baris bawah (y + ~230). Hanya recycle yang
  boleh mengalir balik. Mulai dengan blok `feedsource` supaya analisis air baku terlihat di kanvas.
- **Design mode.** Untuk target debit produk, set `basis.designMode: "product-driven"` dan
  `basis.targetProductFlow` (m³/jam); server menghitung debit intake-nya.
- **Baku mutu.** `hd catalog standards`. Grade S/D (`dc-s`, `dc-d`) untuk data centre, `permenkes` air minum,
  `permenlh11-*` efluen domestik, `permen59` lindi. Baris "not modelled" (boron, klor bebas, bakteri) harus
  dibuktikan terpisah, jangan dianggap lulus.
- **Proyek orang lain** (`[view only]`) hanya dibaca. Jangan mencoba menyimpan ke sana; simpan ke proyek pengguna
  sendiri bila perlu salinan.
- **Biaya** di HydroDesk adalah angka screening (CAPEX metode faktor AACE kelas 5, OPEX dengan harga daftar
  CCEPC). Sebut begitu saat melaporkan.
- **SWRO: benchmark CCEPC dulu.** Untuk flowsheet yang berisi blok `swro`, ringkasan simulasi mencetak
  "CCEPC SWRO benchmark": CAPEX RMB 6.000–7.000 per m³/hari (kurs 6,7, tanpa intake/outfall dan tiang pancang),
  OPEX USD 0,60–0,70/m³ (listrik, membran, kimia, tenaga O&M), lahan 0,7 m² per m³/hari, break-even dan payback
  (8 %, 20 tahun), jadwal EPC 12–15 bulan. Laporkan angka benchmark ini sebagai acuan utama CAPEX/OPEX SWRO,
  dan estimasi metode faktor sebagai pembanding.
- **Bahasa.** Jawab dalam bahasa yang dipakai pengguna (Indonesia, English, atau 中文), ringkas; nama unit dan
  parameter di HydroDesk berbahasa Inggris.

## 4. Laporan ke pengguna

Setelah menyimpan run, laporkan: apa yang disimulasikan dan kenapa, angka kunci (produk, recovery, SEC, OPEX,
CAPEX indikatif), hasil cek baku mutu termasuk yang belum dimodelkan, asumsi penting, dan link run-nya. Kalau
hasilnya gagal memenuhi standar, katakan dengan jelas apa yang gagal dan usulan perbaikannya.
