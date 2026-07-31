"use client";

import { useState } from "react";
import { useStudy } from "@/lib/store/useStudy";
import { Component, FeedSpec, SourceType } from "@/lib/engine/types";
import { FEED_PRESETS, STANDARDS } from "@/lib/engine/templates";
import {
  caMgToHardness, FieldSpec, profileFor, SOURCE_PROFILES,
} from "@/lib/engine/feedprofiles";
import { alkalinityAsCaCO3, hardnessAsCaCO3, ionicBalanceErrorPct, tdsFromIons } from "@/lib/engine/stream";
import { feedStream } from "@/lib/engine/solver";
import { NumInput } from "@/components/NumInput";
import { Plus, X, AlertTriangle, RotateCcw, Info, Beaker, ShieldCheck } from "lucide-react";
import { TRACE_PARAMETERS } from "@/lib/engine/compliance";

export function FeedPanel() {
  const { flowsheet, setFeed, applyFeedPreset, resetFeed } = useStudy();
  const f = flowsheet.feed;
  const prof = profileFor(f.sourceType);
  const [onlyCommon, setOnlyCommon] = useState(false);

  // Derived values are computed from the same conversion the solver uses, so
  // what is shown here is exactly what the balance will see.
  const probe = feedStream({ ...f, flow: 1 });
  const ionErr = ionicBalanceErrorPct(probe);
  const hard = hardnessAsCaCO3(probe);
  const alk = alkalinityAsCaCO3(probe);
  const tdsIons = tdsFromIons(probe);

  const set = (k: Component, v: number | undefined) => {
    const c = { ...f.c };
    if (v == null) delete c[k];
    else c[k] = v;
    setFeed({ c });
  };

  const visible = (list: FieldSpec[]) => (onlyCommon ? list.filter((x) => x.common) : list);

  return (
    <div className="flex h-full flex-col">
      <div className="space-y-2 border-b border-ink-900/8 p-3">
        <div>
          <label className="label">Water source</label>
          <select
            className="field mt-1"
            value={f.sourceType ?? "river"}
            onChange={(e) => setFeed({ sourceType: e.target.value as SourceType })}
          >
            {SOURCE_PROFILES.map((p) => (
              <option key={p.key} value={p.key}>{p.label}</option>
            ))}
          </select>
          <p className="mt-1.5 text-[0.66rem] leading-snug text-ink-500">{prof.blurb}</p>
        </div>
        <div className="flex gap-2">
          <select
            className="field !text-[0.75rem]"
            value=""
            onChange={(e) => e.target.value && applyFeedPreset(e.target.value)}
          >
            <option value="">Load preset…</option>
            {FEED_PRESETS.map((p) => (
              <option key={p.key} value={p.key}>{p.label}</option>
            ))}
          </select>
          <button
            className="btn btn-ghost shrink-0 !px-2 !text-[0.7rem]"
            title="Clear every analysis value, keeping the source type"
            onClick={() => {
              if (confirm("Clear every water quality value? The source type and name are kept.")) resetFeed();
            }}
          >
            <RotateCcw className="h-3 w-3" /> Reset all
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-3">
        <div className="space-y-2.5">
          <div>
            <label className="label">Source name</label>
            <input
              className="field mt-1"
              value={f.name}
              placeholder="e.g. Poto Island seawater"
              onChange={(e) => setFeed({ name: e.target.value })}
            />
          </div>
          <div className="grid grid-cols-3 gap-2">
            <Num label="Temp." unit="°C" value={f.T} onChange={(v) => setFeed({ T: v ?? 25 })} />
            <Num label="pH" unit="-" value={f.pH} onChange={(v) => setFeed({ pH: v ?? 7 })} />
            <Num label="Cond." unit="µS/cm" value={f.conductivityUScm}
              onChange={(v) => setFeed({ conductivityUScm: v })} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            {prof.showTurbidity && (
              <Num label="Turbidity" unit="NTU" value={f.turbidityNTU}
                onChange={(v) => setFeed({ turbidityNTU: v })} />
            )}
            {prof.showColiform && (
              <Num label="Coliform" unit="/100mL" value={f.coliform}
                onChange={(v) => setFeed({ coliform: v })} />
            )}
          </div>
          {!prof.showTurbidity && (
            <p className="rounded-lg bg-ink-900/[0.03] px-2 py-1.5 text-[0.64rem] leading-snug text-ink-500">
              Turbidity is not normally reported for this source, so it is hidden. Suspended solids
              carry the equivalent information here.
            </p>
          )}
        </div>

        {/* --- as reported in Indonesia: CaCO3 entry --- */}
        {prof.useCaCO3Entry && (
          <div className="mt-4 rounded-xl border border-aqua-200 bg-aqua-50/60 p-2.5">
            <div className="mb-1.5 flex items-center gap-1.5">
              <Beaker className="h-3.5 w-3.5 text-aqua-700" />
              <span className="text-[0.6rem] font-bold uppercase tracking-wider text-aqua-700">
                As reported by the laboratory
              </span>
            </div>
            <p className="mb-2 text-[0.64rem] leading-snug text-ink-500">
              Indonesian laboratories normally give total alkalinity and total hardness directly as
              CaCO₃ rather than splitting them into ions. Enter them here and the conversion is done
              for you.
            </p>
            <div className="grid grid-cols-2 gap-2">
              <Num label="Total alkalinity" unit="mg/L CaCO₃" value={f.alkalinityAsCaCO3}
                onChange={(v) => setFeed({ alkalinityAsCaCO3: v })} />
              <Num label="Total hardness" unit="mg/L CaCO₃" value={f.hardnessAsCaCO3}
                onChange={(v) => setFeed({ hardnessAsCaCO3: v })} />
            </div>
            {f.hardnessAsCaCO3 != null && f.hardnessAsCaCO3 > 0 && !f.c.Ca && (
              <p className="mt-1.5 rounded-md bg-sun-100 px-2 py-1 text-[0.62rem] leading-snug text-sun-700">
                Calcium not given, so a typical 70:30 calcium to magnesium split is assumed. Enter
                calcium if you have it — magnesium will then follow by difference.
              </p>
            )}
          </div>
        )}

        {/* --- parameter groups --- */}
        <div className="mt-4 flex items-center justify-between">
          <span className="text-[0.6rem] font-bold uppercase tracking-wider text-ink-500">
            Analysis
          </span>
          <label className="flex cursor-pointer items-center gap-1.5">
            <input type="checkbox" className="h-3 w-3 accent-aqua-500"
              checked={onlyCommon} onChange={(e) => setOnlyCommon(e.target.checked)} />
            <span className="text-[0.64rem] text-ink-500">Common only</span>
          </label>
        </div>

        <Group title="Cations" fields={visible(prof.cations)} f={f} set={set} />
        <Group title="Anions" fields={visible(prof.anions)} f={f} set={set} />
        <Group title="Aggregates" fields={visible(prof.aggregates)} f={f} set={set} />

        <TraceGroup f={f} setFeed={setFeed} />

        {/* --- what Indonesian labs typically return --- */}
        <div className="mt-4 rounded-xl bg-sun-100/50 p-2.5">
          <div className="mb-1 flex items-center gap-1.5">
            <Info className="h-3.5 w-3.5 text-sun-700" />
            <span className="text-[0.6rem] font-bold uppercase tracking-wider text-sun-700">
              Typical Indonesian standard set
            </span>
          </div>
          <p className="text-[0.66rem] leading-snug text-ink-700">
            {prof.typicalIndonesianSet.join(" · ")}
          </p>
          <p className="mt-1.5 text-[0.64rem] leading-relaxed text-ink-500">{prof.gapWarning}</p>
        </div>

        {/* --- derived --- */}
        <div className="mt-3 rounded-xl bg-aqua-50 p-3">
          <div className="mb-2 text-[0.6rem] font-bold uppercase tracking-wider text-aqua-700">
            Derived from what you entered
          </div>
          <dl className="space-y-1 text-[0.7rem]">
            <Row k="Total hardness" v={hard > 0 ? `${hard.toFixed(1)} mg/L CaCO₃` : "—"} />
            <Row k="Alkalinity" v={alk > 0 ? `${alk.toFixed(1)} mg/L CaCO₃` : "—"} />
            <Row k="Non-carbonate hardness" v={hard > 0 ? `${Math.max(0, hard - alk).toFixed(1)} mg/L CaCO₃` : "—"} />
            <Row k="Ca + Mg as CaCO₃" v={f.c.Ca || f.c.Mg ? `${caMgToHardness(f.c.Ca ?? 0, f.c.Mg ?? 0).toFixed(1)}` : "—"} />
            <Row k="TDS from ions" v={tdsIons > 0 ? `${tdsIons.toFixed(0)} mg/L` : "—"} />
            <Row k="TDS entered" v={f.c.TDS != null ? `${f.c.TDS.toFixed(0)} mg/L` : "not entered"} />
            <Row k="Ionic balance" v={tdsIons > 0 ? `${ionErr >= 0 ? "+" : ""}${ionErr.toFixed(1)} %` : "—"} />
          </dl>
          {tdsIons > 0 && Math.abs(ionErr) > 5 && (
            <p className="mt-2 flex gap-1.5 rounded-lg bg-sun-100 px-2 py-1.5 text-[0.64rem] leading-snug text-sun-700">
              <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
              Ionic balance outside ±5 %. Check the Advisor for the full diagnosis.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Compliance markers. Kept visually separate from the analysis groups above
 * because they are a different kind of number: they never enter the water
 * balance, they decide whether the effluent is lawful and whether a biological
 * stage will work. Collapsed by default so a drinking-water study is not asked
 * about dioxins.
 */
function TraceGroup({
  f, setFeed,
}: { f: FeedSpec; setFeed: (p: Partial<FeedSpec>) => void }) {
  const entered = Object.keys(f.trace ?? {}).length;
  const [open, setOpen] = useState(entered > 0);

  const set = (key: string, v: number | undefined) => {
    const trace = { ...(f.trace ?? {}) };
    if (v == null) delete trace[key];
    else trace[key] = v;
    setFeed({ trace });
  };

  const groups = ["Heavy metals", "Inorganic", "Organic micropollutants"] as const;

  return (
    <div className="mt-4 rounded-xl border border-violet-200 bg-violet-50/50 p-2.5">
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center gap-1.5 text-left"
      >
        <ShieldCheck className="h-3.5 w-3.5 text-violet-700" />
        <span className="text-[0.6rem] font-bold uppercase tracking-wider text-violet-700">
          Compliance markers
        </span>
        {entered > 0 && (
          <span className="chip bg-violet-100 text-[0.6rem] text-violet-700">{entered} entered</span>
        )}
        <span className="ml-auto text-[0.64rem] text-ink-500">{open ? "Hide" : "Show"}</span>
      </button>

      {open && (
        <>
          <p className="mb-2 mt-1.5 text-[0.64rem] leading-snug text-ink-500">
            These do not enter the water balance — at a few mg/L they change no flow and no
            pressure. They are here because mercury and cadmium are two of the seven parameters
            Permen LHK P.59/2016 regulates, and because cyanide, sulphide and phenol decide whether
            a biological stage works at all. Carried end to end using train-level removals, then
            checked against the standard on the Results page.
          </p>
          {groups.map((g) => {
            const items = TRACE_PARAMETERS.filter((t) => t.group === g);
            if (items.length === 0) return null;
            return (
              <div key={g} className="mt-2">
                <div className="mb-1 text-[0.6rem] font-semibold uppercase tracking-wide text-ink-500">
                  {g}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {items.map((t) => (
                    <Num
                      key={t.key}
                      label={t.label}
                      unit={t.unit}
                      value={f.trace?.[t.key]}
                      onChange={(v) => set(t.key, v)}
                      title={t.why}
                    />
                  ))}
                </div>
              </div>
            );
          })}
          <p className="mt-2 text-[0.62rem] leading-snug text-ink-300">
            Leave blank what was not measured. Blank means not analysed, which is not the same as
            zero, and the Results page says so rather than assuming compliance.
          </p>
        </>
      )}
    </div>
  );
}

function Group({
  title, fields, f, set,
}: {
  title: string;
  fields: FieldSpec[];
  f: FeedSpec;
  set: (k: Component, v: number | undefined) => void;
}) {
  if (fields.length === 0) return null;
  return (
    <div className="mt-3">
      <div className="mb-1.5 text-[0.6rem] font-bold uppercase tracking-wider text-ink-500">
        {title} <span className="font-medium normal-case text-ink-300">mg/L</span>
      </div>
      <div className="grid grid-cols-3 gap-1.5">
        {fields.map((fs) => (
          <div key={fs.key}>
            <label className="text-[0.62rem] font-semibold text-ink-700">{fs.label ?? fs.key}</label>
            <NumInput
              className="!px-1.5 !py-1 !text-[0.72rem]"
              value={f.c[fs.key]}
              onChange={(v) => set(fs.key, v)}
              ariaLabel={fs.key}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

export function BasisPanel() {
  const { flowsheet, setBasis, setFeed, studyName, setStudyName } = useStudy();
  const bs = flowsheet.basis;
  const std = STANDARDS.find((s) => s.key === bs.standard);
  const productDriven = (bs.designMode ?? "product-driven") === "product-driven";

  return (
    <div className="flex h-full flex-col overflow-y-auto p-3">
      <div className="space-y-2.5">
        <div>
          <label className="label">Study name</label>
          <input className="field mt-1" value={studyName} onChange={(e) => setStudyName(e.target.value)} />
        </div>

        {/* --- design mode --- */}
        <div className="rounded-xl border border-aqua-200 bg-aqua-50/60 p-2.5">
          <div className="mb-1.5 text-[0.6rem] font-bold uppercase tracking-wider text-aqua-700">
            How the plant is sized
          </div>
          <div className="grid grid-cols-2 gap-1.5">
            <button
              onClick={() => setBasis({ designMode: "product-driven" })}
              className={`rounded-lg border px-2 py-1.5 text-[0.7rem] font-semibold transition ${
                productDriven ? "border-aqua-500 bg-white text-aqua-700" : "border-ink-900/10 bg-white/60 text-ink-500"
              }`}
            >
              From product
            </button>
            <button
              onClick={() => setBasis({ designMode: "feed-driven" })}
              className={`rounded-lg border px-2 py-1.5 text-[0.7rem] font-semibold transition ${
                !productDriven ? "border-aqua-500 bg-white text-aqua-700" : "border-ink-900/10 bg-white/60 text-ink-500"
              }`}
            >
              From intake
            </button>
          </div>
          {productDriven ? (
            <>
              <div className="mt-2">
                <label className="text-[0.66rem] font-semibold text-ink-700">
                  Target product flow
                  <span className="ml-1 text-[0.58rem] font-medium text-ink-300">m³/h</span>
                </label>
                <NumInput
                  className="mt-0.5 !py-1 !text-[0.78rem]"
                  value={bs.targetProductFlow}
                  onChange={(v) => setBasis({ targetProductFlow: v })}
                  placeholder="e.g. 187.2"
                />
              </div>
              <p className="mt-1.5 text-[0.63rem] leading-relaxed text-ink-500">
                The intake is solved backwards from this, through every recovery, backwash and reject
                on the flowsheet. This is how design actually works — the intake is a consequence, not
                a choice. The feed flow shown on the Feed tab becomes a result.
              </p>
            </>
          ) : (
            <>
              <div className="mt-2">
                <label className="text-[0.66rem] font-semibold text-ink-700">
                  Fixed intake flow
                  <span className="ml-1 text-[0.58rem] font-medium text-ink-300">m³/h</span>
                </label>
                <NumInput
                  className="mt-0.5 !py-1 !text-[0.78rem]"
                  value={flowsheet.feed.flow > 0 ? flowsheet.feed.flow : undefined}
                  onChange={(v) => setFeed({ flow: v ?? 0 })}
                />
              </div>
              <p className="mt-1.5 text-[0.63rem] leading-relaxed text-ink-500">
                Use this only when the intake is genuinely fixed — an existing pump station, or a
                licensed abstraction limit. Otherwise size from the product.
              </p>
            </>
          )}
        </div>

        <div>
          <label className="label">Design standard</label>
          <select className="field mt-1" value={bs.standard}
            onChange={(e) => setBasis({ standard: e.target.value })}>
            {STANDARDS.map((s) => <option key={s.key} value={s.key}>{s.name}</option>)}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Num label="Operating hours" unit="h/y" value={bs.operatingHoursPerYear}
            onChange={(v) => setBasis({ operatingHoursPerYear: v ?? 8000 })} />
          <Num label="Design margin" unit="%" value={bs.designMarginPct}
            onChange={(v) => setBasis({ designMarginPct: v ?? 10 })} />
        </div>
        <Num label="Electricity price" unit="USD/kWh" value={bs.electricityUSDPerKWh}
          onChange={(v) => setBasis({ electricityUSDPerKWh: v ?? 0.09 })} />
      </div>

      {std && std.limits.length > 0 && (
        <div className="mt-4 rounded-xl bg-mint-100/60 p-3">
          <div className="mb-1 text-[0.6rem] font-bold uppercase tracking-wider text-mint-700">
            {std.name}
          </div>
          <p className="mb-2 text-[0.65rem] leading-snug text-ink-500">{std.scope}</p>
          <dl className="space-y-1 text-[0.7rem]">
            {std.limits.map((l) => <Row key={l.param} k={l.param} v={l.limit} />)}
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
          Anything the study depends on that is not a block parameter — intake depth, seasonal
          turbidity, permit limits, client-specified product quality.
        </p>
        <div className="space-y-1.5">
          {bs.extra.map((row, i) => (
            <div key={i} className="flex gap-1.5">
              <input className="field !py-1 !text-[0.72rem]" placeholder="Parameter" value={row.key}
                onChange={(e) => {
                  const next = [...bs.extra];
                  next[i] = { ...next[i], key: e.target.value };
                  setBasis({ extra: next });
                }} />
              <input className="field !py-1 !text-[0.72rem]" placeholder="Value" value={row.value}
                onChange={(e) => {
                  const next = [...bs.extra];
                  next[i] = { ...next[i], value: e.target.value };
                  setBasis({ extra: next });
                }} />
              <button className="btn btn-ghost !px-1.5 !py-1"
                onClick={() => setBasis({ extra: bs.extra.filter((_, j) => j !== i) })}>
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

function Num({
  label, unit, value, onChange, title,
}: {
  label: string; unit?: string; value: number | undefined;
  onChange: (v: number | undefined) => void; title?: string;
}) {
  return (
    <div>
      <div className="flex items-baseline justify-between gap-1">
        <label className="text-[0.66rem] font-semibold text-ink-700" title={title}>{label}</label>
        {unit && <span className="text-[0.58rem] text-ink-300">{unit}</span>}
      </div>
      <NumInput className="mt-0.5 !py-1 !text-[0.75rem]" value={value} onChange={onChange} />
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
