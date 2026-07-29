"use client";

import { useStudy } from "@/lib/store/useStudy";
import { COMPONENTS, Component } from "@/lib/engine/types";
import { FEED_PRESETS, STANDARDS } from "@/lib/engine/templates";
import { alkalinityAsCaCO3, hardnessAsCaCO3, ionicBalanceErrorPct, makeStream, tdsFromIons } from "@/lib/engine/stream";
import { Plus, X, AlertTriangle } from "lucide-react";

const GROUPS: { title: string; keys: Component[] }[] = [
  { title: "Cations", keys: ["Na", "K", "Ca", "Mg", "NH4", "Fe", "Mn", "Ba", "Sr"] },
  { title: "Anions", keys: ["Cl", "SO4", "HCO3", "CO3", "NO3", "F"] },
  { title: "Aggregates", keys: ["TDS", "TSS", "SiO2", "BOD", "COD", "TOC", "TN", "TP", "Oil"] },
];

export function FeedPanel() {
  const { flowsheet, setFeed, applyFeedPreset } = useStudy();
  const f = flowsheet.feed;
  const probe = makeStream(f.flow, f.c, { T: f.T, pH: f.pH });
  const ionErr = ionicBalanceErrorPct(probe);
  const hard = hardnessAsCaCO3(probe);
  const alk = alkalinityAsCaCO3(probe);
  const tdsIons = tdsFromIons(probe);

  const set = (k: Component, v: number) =>
    setFeed({ c: { ...f.c, [k]: v } });

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-ink-900/8 p-3">
        <label className="label">Feed preset</label>
        <select
          className="field mt-1"
          value=""
          onChange={(e) => e.target.value && applyFeedPreset(e.target.value)}
        >
          <option value="">Load a preset…</option>
          {FEED_PRESETS.map((p) => (
            <option key={p.key} value={p.key}>{p.label}</option>
          ))}
        </select>
      </div>

      <div className="flex-1 overflow-y-auto p-3">
        <div className="space-y-2.5">
          <div>
            <label className="label">Source name</label>
            <input
              className="field mt-1"
              value={f.name}
              onChange={(e) => setFeed({ name: e.target.value })}
            />
          </div>
          <div className="grid grid-cols-3 gap-2">
            <NumField label="Flow" unit="m³/h" value={f.flow} onChange={(v) => setFeed({ flow: v })} />
            <NumField label="Temp." unit="°C" value={f.T} onChange={(v) => setFeed({ T: v })} />
            <NumField label="pH" unit="-" value={f.pH} step={0.1} onChange={(v) => setFeed({ pH: v })} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <NumField label="Turbidity" unit="NTU" value={f.turbidityNTU} onChange={(v) => setFeed({ turbidityNTU: v })} />
            <NumField label="Coliform" unit="/100mL" value={f.coliform} onChange={(v) => setFeed({ coliform: v })} />
          </div>
        </div>

        {GROUPS.map((g) => (
          <div key={g.title} className="mt-4">
            <div className="mb-1.5 text-[0.6rem] font-bold uppercase tracking-wider text-ink-500">
              {g.title} <span className="font-medium normal-case text-ink-300">mg/L</span>
            </div>
            <div className="grid grid-cols-3 gap-1.5">
              {g.keys.map((k) => (
                <div key={k}>
                  <label className="text-[0.62rem] font-semibold text-ink-700">{k}</label>
                  <input
                    type="number"
                    className="field !px-1.5 !py-1 !text-[0.72rem]"
                    value={f.c[k] ?? 0}
                    step="any"
                    onChange={(e) => set(k, Number(e.target.value))}
                  />
                </div>
              ))}
            </div>
          </div>
        ))}

        <div className="mt-4 rounded-xl bg-aqua-50 p-3">
          <div className="mb-2 text-[0.6rem] font-bold uppercase tracking-wider text-aqua-700">
            Derived & checks
          </div>
          <dl className="space-y-1 text-[0.7rem]">
            <Row k="Total hardness" v={`${hard.toFixed(1)} mg/L CaCO₃`} />
            <Row k="Alkalinity" v={`${alk.toFixed(1)} mg/L CaCO₃`} />
            <Row k="Non-carbonate hardness" v={`${Math.max(0, hard - alk).toFixed(1)} mg/L CaCO₃`} />
            <Row k="TDS from ions" v={`${tdsIons.toFixed(0)} mg/L`} />
            <Row k="TDS entered" v={`${(f.c.TDS ?? 0).toFixed(0)} mg/L`} />
            <Row k="Ionic balance error" v={`${ionErr >= 0 ? "+" : ""}${ionErr.toFixed(1)} %`} />
          </dl>
          {Math.abs(ionErr) > 5 && (
            <p className="mt-2 flex gap-1.5 rounded-lg bg-sun-100 px-2 py-1.5 text-[0.65rem] leading-snug text-sun-700">
              <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
              Ionic balance error exceeds ±5 %. A major ion is probably missing or misreported — check
              chloride first, it is the one most often left out of a lab sheet.
            </p>
          )}
          {hard > 0 && Math.max(0, hard - alk) / hard > 0.6 && (
            <p className="mt-2 rounded-lg bg-aqua-100 px-2 py-1.5 text-[0.65rem] leading-snug text-aqua-700">
              {((Math.max(0, hard - alk) / hard) * 100).toFixed(0)} % of the hardness is
              non-carbonate. Lime softening cannot remove that fraction; membrane or ion exchange
              treatment is required.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

export function BasisPanel() {
  const { flowsheet, setBasis, studyName, setStudyName } = useStudy();
  const bs = flowsheet.basis;
  const std = STANDARDS.find((s) => s.key === bs.standard);

  return (
    <div className="flex h-full flex-col overflow-y-auto p-3">
      <div className="space-y-2.5">
        <div>
          <label className="label">Study name</label>
          <input className="field mt-1" value={studyName} onChange={(e) => setStudyName(e.target.value)} />
        </div>
        <div>
          <label className="label">Design standard</label>
          <select
            className="field mt-1"
            value={bs.standard}
            onChange={(e) => setBasis({ standard: e.target.value })}
          >
            {STANDARDS.map((s) => (
              <option key={s.key} value={s.key}>{s.name}</option>
            ))}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <NumField label="Operating hours" unit="h/y" value={bs.operatingHoursPerYear}
            onChange={(v) => setBasis({ operatingHoursPerYear: v })} />
          <NumField label="Design margin" unit="%" value={bs.designMarginPct}
            onChange={(v) => setBasis({ designMarginPct: v })} />
        </div>
        <NumField label="Electricity price" unit="USD/kWh" step={0.005}
          value={bs.electricityUSDPerKWh} onChange={(v) => setBasis({ electricityUSDPerKWh: v })} />
      </div>

      {std && std.limits.length > 0 && (
        <div className="mt-4 rounded-xl bg-mint-100/60 p-3">
          <div className="mb-1 text-[0.6rem] font-bold uppercase tracking-wider text-mint-700">
            {std.name}
          </div>
          <p className="mb-2 text-[0.65rem] leading-snug text-ink-500">{std.scope}</p>
          <dl className="space-y-1 text-[0.7rem]">
            {std.limits.map((l) => (
              <Row key={l.param} k={l.param} v={l.limit} />
            ))}
          </dl>
        </div>
      )}

      <div className="mt-4">
        <div className="mb-1.5 flex items-center justify-between">
          <span className="label">Additional design parameters</span>
          <button
            className="btn btn-ghost !px-2 !py-1 !text-[0.65rem]"
            onClick={() => setBasis({ extra: [...bs.extra, { key: "", value: "" }] })}
          >
            <Plus className="h-3 w-3" /> Add
          </button>
        </div>
        <p className="mb-2 text-[0.62rem] leading-snug text-ink-500">
          Anything the study depends on that is not a block parameter — site elevation, intake depth,
          seasonal turbidity, permit limits, client-specified product quality.
        </p>
        <div className="space-y-1.5">
          {bs.extra.map((row, i) => (
            <div key={i} className="flex gap-1.5">
              <input
                className="field !py-1 !text-[0.72rem]"
                placeholder="Parameter"
                value={row.key}
                onChange={(e) => {
                  const next = [...bs.extra];
                  next[i] = { ...next[i], key: e.target.value };
                  setBasis({ extra: next });
                }}
              />
              <input
                className="field !py-1 !text-[0.72rem]"
                placeholder="Value"
                value={row.value}
                onChange={(e) => {
                  const next = [...bs.extra];
                  next[i] = { ...next[i], value: e.target.value };
                  setBasis({ extra: next });
                }}
              />
              <button
                className="btn btn-ghost !px-1.5 !py-1"
                onClick={() => setBasis({ extra: bs.extra.filter((_, j) => j !== i) })}
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
          {bs.extra.length === 0 && (
            <p className="rounded-lg border border-dashed border-ink-900/12 px-2 py-3 text-center text-[0.68rem] text-ink-300">
              None recorded
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function NumField({
  label, unit, value, onChange, step = 1,
}: { label: string; unit?: string; value: number; onChange: (v: number) => void; step?: number }) {
  return (
    <div>
      <div className="flex items-baseline justify-between gap-1">
        <label className="text-[0.66rem] font-semibold text-ink-700">{label}</label>
        {unit && <span className="text-[0.58rem] text-ink-300">{unit}</span>}
      </div>
      <input
        type="number"
        className="field mt-0.5 !py-1 !text-[0.75rem]"
        value={value}
        step={step}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <dt className="truncate text-ink-500">{k}</dt>
      <dd className="stat shrink-0 font-semibold text-ink-900">{v}</dd>
    </div>
  );
}

export { COMPONENTS };
