# HydroDesk — WTP / WWTP Process Studio

Flowsheet simulation for water treatment, wastewater, desalination and demineralisation, built
to support **pre-approval feasibility studies**: build the train, get a closed water and salt
balance, and export a report draft.

## What it does

- **Drag-and-drop flowsheet** — 33 unit operations across intake, pre-treatment, membrane, ion
  exchange, biological, thermal/ZLD, sludge, storage and transport.
- **Every parameter is editable** — recovery, flux, HRT, SRT, MLSS, filtration rate, dose rate,
  rejection, pump head and efficiency, redundancy. The calculation follows what you set.
- **Full component tracking** — Na, K, Ca, Mg, NH₄, Cl, SO₄, HCO₃, CO₃, NO₃, F, SiO₂, Fe, Mn, Ba,
  Sr plus TDS, TSS, BOD, COD, TOC, TN, TP and oil, carried stream by stream. This is what makes a
  *salt* balance possible, not just a water balance.
- **Recycle loops** — solved by fixed-point iteration with damping, so backwash returns, reject
  recycles and thickener supernatant all converge.
- **Results** — water balance, salt/ion balance, biological balance, stream table, specific energy
  (SEC), power per unit, chemical balance in kg/h and t/y, dry solids, preliminary equipment sizing
  and indicative CAPEX/OPEX.
- **Optimiser** — pulls the flowsheet into an operating envelope that can be guaranteed rather than
  the theoretical optimum: parameters inside proven ranges, redundancy on plant-stopping units,
  recovery lifted using the cheapest levers first.
- **Project tracker** — every run stored with its flowsheet and results, searchable by client,
  location and status.
- **Report export** — pre-approval study as `.docx`, stream table as `.csv`.

## Running locally

```bash
npm install
npm run dev
```

Then open <http://localhost:3000>.

## Engine self-test

```bash
curl http://localhost:3000/api/selftest
```

Runs every built-in template through the solver and reports convergence and balance closure.
Use it as a regression check after touching anything in `src/lib/engine`.

## Where the data lives

Projects and runs are stored in the browser with IndexedDB — no account, no server, no environment
variable. Use **Export all** on the Projects page to back up or move between machines.

The persistence layer in `src/lib/store/db.ts` is deliberately narrow (list / get / save / delete /
export / import). To move to a shared cloud database later, implement those same functions against
an API route and swap the import; nothing in the UI needs to change.

## Calibration notes

NF and RO ion rejections are calibrated against the CCEPC Indonesia Gresik Salt Plant *Water and
Salt Balance Diagram* (Attached Drawing 2-001): at 77 % recovery the NF model reproduces the
reported permeate composition for Na, Ca, Mg, Cl and SO₄. Biological defaults follow the CCEPC
municipal references (Zuoling and Baoxie WWTP, Wuhan) and the Jinshenglan coking wastewater plant.

## Limitations

This is a **screening tool**, not a design tool. Equipment sizing uses standard design loading
rates and has not been checked against vendor performance software; membrane projections must be
re-run in the supplier's own program before any commitment. Costs come from capacity cost curves
and generic unit rates — they are for ranking options, not for quoting a client.

## Stack

Next.js 16 (App Router) · React 19 · TypeScript · Tailwind CSS v4 · @xyflow/react · Zustand ·
idb-keyval · docx
