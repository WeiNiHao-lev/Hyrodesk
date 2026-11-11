# Format flowsheet HydroDesk

Satu flowsheet adalah satu objek JSON. `hd template <key>` dan `hd run <projectId> <i>` menghasilkan contoh
lengkap. Sumber kebenarannya `src/lib/engine/types.ts` di repo.

```jsonc
{
  "nodes": [
    { "id": "n0-feed", "type": "feedsource", "label": "Seawater (Batam)",
      "position": { "x": 0, "y": 200 }, "params": {} },
    { "id": "n1-intake", "type": "intake", "label": "Intake + Screening",
      "position": { "x": 260, "y": 200 }, "params": { "cl2Dose": 0, "headM": 25 } }
    // ...
  ],
  "edges": [
    { "id": "e0", "source": "n0-feed", "sourceHandle": "out", "target": "n1-intake", "targetHandle": "in" }
  ],
  "feed": { /* FeedSpec, lihat di bawah */ },
  "basis": {
    "standard": "dc-s",               // baku mutu utama produk (hd catalog standards)
    "productSpecKey": "process",
    "designMode": "product-driven",   // atau "feed-driven"
    "targetProductFlow": 1080,        // m3/jam, dipakai bila product-driven
    "operatingHoursPerYear": 8400,
    "designMarginPct": 10,
    "electricityUSDPerKWh": 0.09,
    "extra": []
  }
}
```

## Node

- `id` unik di flowsheet; `type` dari `hd catalog units`; `label` bebas (bahasa Inggris, singkat, < ~22
  karakter supaya blok tidak melebar).
- `params`: cukup isi yang berbeda dari default. Default dan nama parameter: `hd unit <type>`. Server mengisi
  sisanya dengan default.
- `position`: kiri → kanan, x bertambah ~260 per tahap; aliran samping di y + ~230.

## Edge

- `sourceHandle` = nama outlet unit sumber (lihat kolom outlets di `hd catalog units`), misalnya `out`,
  `sludge`, `backwash`, `flush`, `permeate`, `concentrate`, `a`/`b` (splitter), `out1`/`out2` (tangki dengan
  `outletCount` 2).
- `targetHandle` selalu `"in"`. Satu inlet boleh menerima banyak edge: alirannya dicampur.
- Recycle (misalnya konsentrat pass 2 kembali ke depan cartridge) boleh; solver mengiterasinya.

## Terminal

| type | arti |
|---|---|
| `feedsource` | titik masuk air baku; analisis air ada di `feed` |
| `product` | produk; dihitung sebagai produk (param `name`: demin, potable, process, …) |
| `outfall` | efluen olahan yang dibuang (WWTP); juga dihitung sebagai PRODUK |
| `waste` | semua buangan: brine/reject, lumpur, backwash (param `name`: reject, sludge, backwash, regen, loss) |

## FeedSpec (`feed`)

```jsonc
{
  "name": "Seawater (Batam)",
  "sourceType": "seawater",           // seawater | brackish | river | groundwater | municipal | ww-domestic | ww-industrial | leachate
  "flow": 1930,                       // m3/jam (hasil hitungan bila product-driven)
  "T": 30, "pH": 7.78,
  "c": {                              // mg/L; yang tidak dianalisis JANGAN diisi 0, biarkan tidak ada
    "Na": 10582, "Mg": 1260, "Ca": 404, "K": 392, "Sr": 7.8,
    "Cl": 18994, "SO4": 2662, "HCO3": 131.5, "F": 1.72, "NH4": 0.46,
    "TDS": 34528, "TSS": 100, "COD": 79.9
  },
  "turbidityNTU": 15,                 // opsional
  "coliform": 1000,                   // opsional, per 100 mL
  "conductivityUScm": 51000,          // opsional, hanya kalau TERUKUR
  "alkalinityAsCaCO3": 130,           // opsional, dikonversi ke HCO3
  "hardnessAsCaCO3": 200              // opsional
}
```

Komponen yang dikenal: ion `Na K Ca Mg NH4 Cl SO4 HCO3 CO3 NO3 F SiO2 Fe Mn Ba Sr`, agregat
`TDS TSS BOD COD TOC TN TP Oil`. NH4 adalah ion amonium (bukan NH3-N), NO3 adalah ion nitrat (bukan NO3-N).

## Unit yang sering dipakai

- Pretreatment: `intake`, `coagfloc` (PAC), `clarifier`, `daf`, `mmf`, `selfclean`, `uf`, `cartridge`, `acf`.
- Membran: `swro` (air laut), `ro` (brackish, juga untuk pass kedua), `nf`, `edi`, `dtro`, `tuf`, `suf`.
  Parameter penting: `recovery`, `flux`, `erd` + `erdEffPct`, `feedPressureBar` (0 = taksiran),
  `antiscalantDose`, `smbsDose`, `passageFactor` (1,6 ≈ 30 °C + membran 3 tahun).
- Kimia: `phadjust` (NaOH/kapur/asam ke `targetPH`), `remin` (remineralisasi: `hardnessAdd`, `targetPH`,
  `co2ExcessPct`, `method` lime|calcite), `disinfection`, `limesoft`, `chemsoft`, `softener`.
- Biologi: `aao`, `mbbr`, `mbr`, `aombr`, `msbr`, `anaerobic`, `baf`.
- Lumpur: `thickener`, `bwsettle`, `dewatering`.
- Jaringan: `splitter` (`fractionA` % ke outlet a), tangki `rawtank`/`eqtank`/`producttank` (`hrtH`,
  `outletCount`, `split2`…), `pump`.

## Contoh pola

- **Bypass sebagian ke pass kedua:** `swro.permeate → splitter`; `a → phadjust (NaOH pH 10) → ro`;
  `b → remin`; `ro.permeate → remin`; `ro.concentrate → cartridge` (recycle).
- **Backwash ke drainase lalu ke laut:** `mmf.backwash`, `selfclean.flush`, `uf.backwash → eqtank ("Drainage pit")
  → waste ("Discharge to sea")`; `swro.concentrate → waste` yang sama.
