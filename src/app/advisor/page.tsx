"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useStudy } from "@/lib/store/useStudy";
import { validateFeed, adviseProcess, ADVISOR_TARGETS, Finding, Severity } from "@/lib/engine/diagnostics";
import { FEED_PRESETS } from "@/lib/engine/templates";
import {
  ShieldCheck, XCircle, AlertTriangle, Info, CheckCircle2, Route, ClipboardList,
  ArrowRight, Workflow, Lightbulb,
} from "lucide-react";

const CHECKLIST: { group: string; items: { q: string; why: string }[] }[] = [
  {
    group: "Demand — ask the client first, before anything else",
    items: [
      { q: "Total product flow, and the breakdown by consumer", why: "A single total tells you nothing about what quality is needed where. Cooling make-up, demineralised water and potable water have completely different trains and costs." },
      { q: "Required quality for each stream, with the governing standard", why: "Only a fraction of a plant usually needs ultra-pure water. Designing the whole flow to the strictest specification is the most expensive mistake available." },
      { q: "Condensate return rate to the boiler", why: "High condensate return can cut the demineralised water demand — and the whole RO train — substantially." },
      { q: "Continuous or with peak factors, and annual operating hours", why: "Sets equipment sizing and every consumption figure." },
    ],
  },
  {
    group: "Raw water — the analysis you actually need",
    items: [
      { q: "Full ionic analysis including chloride", why: "Without chloride the balance cannot close and the scaling projection is unreliable. It is the ion most often omitted." },
      { q: "Turbidity in NTU, wet season and dry season", why: "Clarifiers and filters are designed on the peak, not the average. TSS is not a substitute." },
      { q: "TOC, silica, and conductivity", why: "TOC governs carbon sizing and membrane fouling; silica governs ion exchange run length; conductivity cross-checks the TDS figure." },
      { q: "Date of sampling and who took it", why: "An analysis more than a few years old describes a river that may no longer exist in that form." },
      { q: "For wastewater: BOD, COD, TN, TP, NH₄, oil, and any toxic components", why: "Biological design depends on ratios, not absolute values. BOD:TN below 4:1 means buying carbon." },
    ],
  },
  {
    group: "Scope and site — what moves the cost most",
    items: [
      { q: "Battery limit: is the intake in scope? The effluent outfall? Civil and electrical?", why: "This single answer can move a capital estimate by a factor of two." },
      { q: "Is the deaerator and boiler feed conditioning in your scope or the boiler island's?", why: "Dissolved oxygen and pH are not met by a water treatment plant. If the client assumes otherwise it becomes a dispute at commissioning." },
      { q: "Effluent discharge permit limits and receiving water body", why: "Determines whether direct discharge is possible or whether further treatment is needed." },
      { q: "Raw water abstraction licence and river low-flow data", why: "Security of supply. A plant that cannot abstract in September does not work." },
      { q: "Land available, and whether footprint is constrained", why: "Decides lamella versus conventional clarifier, UF versus media filtration, drying beds versus filter press." },
    ],
  },
];

export default function AdvisorPage() {
  const { flowsheet, setFeed, applyFeedPreset } = useStudy();
  const [target, setTarget] = useState<string>("demin");
  const [tab, setTab] = useState<"validate" | "select" | "checklist">("validate");

  const findings = useMemo(() => validateFeed(flowsheet.feed), [flowsheet.feed]);
  const advice = useMemo(() => adviseProcess(flowsheet.feed, target), [flowsheet.feed, target]);

  const counts = findings.reduce(
    (a, f) => ({ ...a, [f.severity]: (a[f.severity] ?? 0) + 1 }),
    {} as Record<Severity, number>,
  );

  return (
    <div className="mx-auto w-full max-w-[1200px] px-4 py-6 sm:px-6">
      <div className="mb-4">
        <h1 className="text-[1.4rem] font-bold tracking-tight text-ink-900">Advisor</h1>
        <p className="text-[0.8rem] text-ink-500">
          Check the data before you trust it, understand why a train is selected, and know what to
          ask the client before you can simulate anything at all.
        </p>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="flex rounded-lg border border-ink-900/10 bg-white p-0.5">
          {(
            [
              ["validate", "Feed water check", ShieldCheck],
              ["select", "Process selection", Route],
              ["checklist", "Data checklist", ClipboardList],
            ] as const
          ).map(([k, lbl, Icon]) => (
            <button
              key={k}
              onClick={() => setTab(k)}
              className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[0.78rem] font-semibold transition ${
                tab === k ? "bg-aqua-100 text-aqua-700" : "text-ink-500 hover:text-ink-900"
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              {lbl}
            </button>
          ))}
        </div>
        <select
          className="field !w-auto"
          value=""
          onChange={(e) => e.target.value && applyFeedPreset(e.target.value)}
        >
          <option value="">Load a feed preset…</option>
          {FEED_PRESETS.map((p) => (
            <option key={p.key} value={p.key}>{p.label}</option>
          ))}
        </select>
        <Link href="/simulate" className="btn btn-ghost ml-auto">
          <Workflow className="h-3.5 w-3.5" /> Edit feed on the canvas
        </Link>
      </div>

      {/* ---------------------------------------------------------- validate */}
      {tab === "validate" && (
        <>
          <div className="card mb-4 flex flex-wrap items-center gap-4 p-4">
            <div>
              <div className="text-[0.6rem] font-bold uppercase tracking-wider text-ink-300">
                Source
              </div>
              <div className="text-[0.95rem] font-bold text-ink-900">{flowsheet.feed.name}</div>
            </div>
            <div className="ml-auto flex gap-2">
              <Tally n={counts.fail ?? 0} label="must fix" tone="coral" />
              <Tally n={counts.warn ?? 0} label="check" tone="sun" />
              <Tally n={counts.info ?? 0} label="note" tone="aqua" />
              <Tally n={counts.pass ?? 0} label="passed" tone="mint" />
            </div>
          </div>

          <div className="mb-4">
            <label className="label">Measured conductivity (optional but recommended)</label>
            <div className="mt-1 flex max-w-md items-center gap-2">
              <input
                type="number"
                className="field"
                placeholder="µS/cm"
                value={flowsheet.feed.conductivityUScm ?? ""}
                onChange={(e) =>
                  setFeed({ conductivityUScm: e.target.value === "" ? undefined : Number(e.target.value) })
                }
              />
              <span className="shrink-0 text-[0.72rem] text-ink-500">µS/cm</span>
            </div>
            <p className="mt-1 text-[0.68rem] text-ink-500">
              The fastest independent cross-check on a reported TDS figure.
            </p>
          </div>

          <div className="space-y-2.5">
            {findings.map((f, i) => <FindingCard key={i} f={f} />)}
          </div>
        </>
      )}

      {/* ---------------------------------------------------------- select */}
      {tab === "select" && (
        <>
          <div className="card mb-4 p-4">
            <label className="label">What is this water for?</label>
            <div className="mt-2 flex flex-wrap gap-2">
              {ADVISOR_TARGETS.map((t) => (
                <button
                  key={t.key}
                  onClick={() => setTarget(t.key)}
                  className={`rounded-lg border px-3 py-2 text-[0.76rem] font-semibold transition ${
                    target === t.key
                      ? "border-aqua-500 bg-aqua-100 text-aqua-700"
                      : "border-ink-900/10 bg-white text-ink-500 hover:bg-ink-900/[0.03]"
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          <div className="card p-4">
            <div className="mb-3 flex items-center gap-2">
              <Route className="h-4 w-4 text-aqua-600" />
              <h2 className="text-[0.95rem] font-bold text-ink-900">
                Recommended train, and the reasoning behind each step
              </h2>
            </div>
            <ol className="space-y-2.5">
              {advice.train.map((r, i) => (
                <li key={i} className="flex gap-3">
                  <span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-lg bg-aqua-100 text-[0.7rem] font-bold text-aqua-700">
                    {i + 1}
                  </span>
                  <div className="min-w-0 flex-1 rounded-lg border border-ink-900/8 bg-white p-2.5">
                    <p className="text-[0.82rem] font-bold text-ink-900">{r.step}</p>
                    <p className="mt-1 text-[0.73rem] leading-relaxed text-ink-700">{r.reason}</p>
                    {r.alternative && (
                      <p className="mt-1.5 rounded-md bg-ink-900/[0.03] px-2 py-1.5 text-[0.69rem] leading-snug text-ink-500">
                        <span className="font-semibold">Alternative considered: </span>
                        {r.alternative}
                      </p>
                    )}
                  </div>
                </li>
              ))}
            </ol>

            {advice.cautions.length > 0 && (
              <div className="mt-4">
                <div className="mb-1.5 flex items-center gap-1.5 text-sun-700">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  <span className="text-[0.62rem] font-bold uppercase tracking-wider">
                    Watch out for
                  </span>
                </div>
                <div className="space-y-1.5">
                  {advice.cautions.map((c, i) => (
                    <p key={i} className="rounded-lg bg-sun-100/70 px-3 py-2 text-[0.73rem] leading-relaxed text-sun-700">
                      {c}
                    </p>
                  ))}
                </div>
              </div>
            )}

            <div className="mt-4 flex items-center gap-2 rounded-lg bg-aqua-50 px-3 py-2.5">
              <Lightbulb className="h-4 w-4 shrink-0 text-aqua-600" />
              <p className="flex-1 text-[0.72rem] leading-snug text-ink-700">
                This is guidance from rules, not a substitute for judgement. Build it on the canvas
                and let the balance tell you whether it actually works.
              </p>
              <Link href="/simulate" className="btn btn-primary shrink-0 !py-1.5 !text-[0.72rem]">
                Build it <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
          </div>
        </>
      )}

      {/* ---------------------------------------------------------- checklist */}
      {tab === "checklist" && (
        <div className="space-y-4">
          <p className="card p-4 text-[0.8rem] leading-relaxed text-ink-700">
            You cannot simulate your way out of missing data. These are the questions to close with
            the client and the marketing manager <strong>before</strong> a study is worth running —
            and the reason each one matters, so you can explain why you are asking.
          </p>
          {CHECKLIST.map((g) => (
            <div key={g.group} className="card p-4">
              <h2 className="mb-2.5 text-[0.9rem] font-bold text-ink-900">{g.group}</h2>
              <div className="space-y-2">
                {g.items.map((it, i) => (
                  <div key={i} className="rounded-lg border border-ink-900/8 bg-white p-2.5">
                    <p className="text-[0.78rem] font-semibold leading-snug text-ink-900">{it.q}</p>
                    <p className="mt-1 text-[0.7rem] leading-relaxed text-ink-500">
                      <span className="font-semibold text-aqua-700">Why it matters: </span>
                      {it.why}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const SEV: Record<Severity, { icon: React.ComponentType<{ className?: string }>; ring: string; bg: string; text: string; label: string }> = {
  fail: { icon: XCircle, ring: "border-l-coral-500", bg: "bg-coral-100/50", text: "text-coral-700", label: "Must fix" },
  warn: { icon: AlertTriangle, ring: "border-l-sun-500", bg: "bg-sun-100/50", text: "text-sun-700", label: "Check" },
  info: { icon: Info, ring: "border-l-aqua-500", bg: "bg-aqua-50", text: "text-aqua-700", label: "Note" },
  pass: { icon: CheckCircle2, ring: "border-l-mint-500", bg: "bg-mint-100/40", text: "text-mint-700", label: "Passed" },
};

function FindingCard({ f }: { f: Finding }) {
  const s = SEV[f.severity];
  const Icon = s.icon;
  return (
    <div className={`card border-l-4 p-3.5 ${s.ring}`}>
      <div className="flex items-start gap-2.5">
        <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${s.text}`} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-2">
            <h3 className="text-[0.86rem] font-bold text-ink-900">{f.title}</h3>
            <span className={`chip ${s.bg} ${s.text}`}>{s.label}</span>
          </div>
          <p className="mt-1 text-[0.75rem] leading-relaxed text-ink-700">{f.detail}</p>
          <p className="mt-1.5 text-[0.75rem] leading-relaxed text-ink-900">
            <span className="font-semibold">Action: </span>{f.action}
          </p>
          {f.why && (
            <p className="mt-1.5 rounded-lg bg-ink-900/[0.03] px-2.5 py-1.5 text-[0.7rem] leading-relaxed text-ink-500">
              <span className="font-semibold text-ink-700">Why this check exists: </span>{f.why}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function Tally({ n, label, tone }: { n: number; label: string; tone: "coral" | "sun" | "aqua" | "mint" }) {
  const map = {
    coral: "bg-coral-100 text-coral-700",
    sun: "bg-sun-100 text-sun-700",
    aqua: "bg-aqua-100 text-aqua-700",
    mint: "bg-mint-100 text-mint-700",
  };
  return (
    <div className={`rounded-lg px-2.5 py-1.5 text-center ${map[tone]}`}>
      <div className="stat text-[1.1rem] font-bold leading-none">{n}</div>
      <div className="mt-0.5 text-[0.55rem] font-bold uppercase tracking-wider">{label}</div>
    </div>
  );
}
