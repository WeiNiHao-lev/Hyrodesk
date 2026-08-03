"use client";

import { useState } from "react";
import { PrepareAnalysis, PrepareFinding, Severity } from "@/lib/engine/prepareAnalysis";
import { Ask } from "@/lib/engine/sitevisit";
import { downloadText } from "@/lib/store/db";
import {
  AlertTriangle, CheckCircle2, HelpCircle, Copy, Check, Download, Ruler, ArrowRight,
} from "lucide-react";

const TONE: Record<Severity, { chip: string; bar: string; label: string }> = {
  blocker: { chip: "bg-coral-100 text-coral-700", bar: "border-l-coral-500", label: "Blocker" },
  gap: { chip: "bg-sun-100 text-sun-700", bar: "border-l-sun-500", label: "Gap" },
  check: { chip: "bg-violet-100 text-violet-800", bar: "border-l-violet-400", label: "Check" },
  good: { chip: "bg-mint-100 text-mint-700", bar: "border-l-mint-500", label: "Derived" },
};

/**
 * What the collected answers actually say, and what to do about it.
 *
 * Every finding here comes from a rule in prepareAnalysis.ts — a missing field,
 * a unit mismatch, or an arithmetic contradiction between two answers. Nothing
 * is generated, nothing is guessed, and each card names the rule that produced
 * it so a surprising finding can be traced instead of trusted.
 */
export function FindingsTab({
  analysis, askById, projectName, onJumpToAsk,
}: {
  analysis: PrepareAnalysis;
  askById: Record<string, Ask>;
  projectName?: string;
  onJumpToAsk: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const [filter, setFilter] = useState<Severity | "all">("all");

  const counts = analysis.findings.reduce<Record<string, number>>((a, f) => {
    a[f.severity] = (a[f.severity] ?? 0) + 1;
    return a;
  }, {});

  const shown = filter === "all"
    ? analysis.findings
    : analysis.findings.filter((f) => f.severity === filter);

  const followUpText = () => {
    const lines: string[] = [];
    lines.push(`FOLLOW-UP REQUIRED${projectName ? ` — ${projectName}` : ""}`);
    lines.push(new Date().toLocaleDateString("en-GB"));
    lines.push("");
    lines.push(analysis.verdict);
    lines.push("");
    if (analysis.followUps.length === 0) {
      lines.push("Nothing outstanding.");
    } else {
      analysis.followUps.forEach((f, i) => lines.push(`${i + 1}. ${f}`));
    }
    lines.push("");
    lines.push(`Readiness ${analysis.readiness} % — ${analysis.answered} of ${analysis.total} questions answered, ${analysis.criticalOpen} essential still open.`);
    return lines.join("\n");
  };

  return (
    <div className="space-y-4">
      {/* verdict */}
      <div className={`card border-l-4 p-4 ${
        analysis.verdictTone === "blocker" ? "border-l-coral-500"
          : analysis.verdictTone === "gap" ? "border-l-sun-500" : "border-l-mint-500"
      }`}>
        <div className="flex flex-wrap items-start gap-4">
          <div className="min-w-[180px]">
            <div className="text-[0.6rem] font-bold uppercase tracking-wider text-ink-500">
              Readiness to present
            </div>
            <div className="flex items-baseline gap-1.5">
              <span className={`stat text-[2rem] font-bold leading-tight ${
                analysis.readiness >= 80 ? "text-mint-700"
                  : analysis.readiness >= 50 ? "text-sun-700" : "text-coral-700"
              }`}>
                {analysis.readiness}
              </span>
              <span className="text-[0.8rem] font-semibold text-ink-500">%</span>
            </div>
            <div className="mt-1 h-2 overflow-hidden rounded-full bg-ink-900/8">
              <div
                className={`h-full rounded-full transition-all ${
                  analysis.readiness >= 80 ? "bg-mint-500"
                    : analysis.readiness >= 50 ? "bg-sun-500" : "bg-coral-500"
                }`}
                style={{ width: `${analysis.readiness}%` }}
              />
            </div>
          </div>
          <div className="min-w-[240px] flex-1">
            <p className="text-[0.84rem] font-semibold leading-snug text-ink-900">{analysis.verdict}</p>
            <p className="mt-1.5 text-[0.72rem] leading-relaxed text-ink-500">
              {analysis.answered} of {analysis.total} questions answered · {analysis.recorded} with a
              note written down · {analysis.criticalOpen} essential still open. The score weights the
              essential questions at 55 %, overall coverage at 25 %, and whether an answer was
              actually recorded at 20 %.
            </p>
          </div>
        </div>
      </div>

      {/* actions */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          className="btn btn-ghost"
          onClick={() => {
            navigator.clipboard.writeText(followUpText());
            setCopied(true);
            setTimeout(() => setCopied(false), 1800);
          }}
        >
          {copied ? <Check className="h-3.5 w-3.5 text-mint-700" /> : <Copy className="h-3.5 w-3.5" />}
          {copied ? "Copied" : "Copy follow-up list"}
        </button>
        <button
          className="btn btn-primary"
          onClick={() => downloadText("follow-up.txt", followUpText(), "text/plain")}
        >
          <Download className="h-3.5 w-3.5" /> Download follow-up
        </button>
        <div className="ml-auto flex flex-wrap gap-1">
          {(["all", "blocker", "gap", "check", "good"] as const).map((k) => {
            const n = k === "all" ? analysis.findings.length : counts[k] ?? 0;
            if (k !== "all" && n === 0) return null;
            return (
              <button
                key={k}
                onClick={() => setFilter(k)}
                className={`rounded-md px-2.5 py-1 text-[0.72rem] font-semibold transition ${
                  filter === k ? "bg-ink-900 text-white" : "bg-ink-900/[0.04] text-ink-500 hover:bg-ink-900/[0.08]"
                }`}
              >
                {k === "all" ? "All" : TONE[k].label} {n}
              </button>
            );
          })}
        </div>
      </div>

      {/* findings */}
      {shown.length === 0 ? (
        <div className="card p-8 text-center">
          <CheckCircle2 className="mx-auto h-8 w-8 text-mint-500" />
          <p className="mt-2 text-[0.86rem] font-semibold text-ink-900">Nothing to flag</p>
          <p className="mt-1 text-[0.76rem] text-ink-500">
            No missing essentials and no contradictions between the answers recorded.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {shown.map((f, i) => <FindingCard key={i} f={f} ask={f.askId ? askById[f.askId] : undefined} onJump={onJumpToAsk} />)}
        </div>
      )}

      {/* coverage */}
      <div className="card p-4">
        <h3 className="mb-2 text-[0.86rem] font-bold text-ink-900">Coverage by section</h3>
        <div className="space-y-1.5">
          {analysis.coverage.map((c) => {
            const pct = c.total > 0 ? (c.answered / c.total) * 100 : 0;
            return (
              <div key={c.id} className="flex items-center gap-3">
                <span className="w-[45%] shrink-0 truncate text-[0.74rem] text-ink-700">{c.title}</span>
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-ink-900/8">
                  <div
                    className={`h-full rounded-full ${pct >= 80 ? "bg-mint-500" : pct >= 40 ? "bg-aqua-500" : "bg-sun-500"}`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <span className="stat w-16 shrink-0 text-right text-[0.72rem] text-ink-500">
                  {c.answered}/{c.total}
                </span>
                {c.criticalOpen > 0 && (
                  <span className="chip shrink-0 bg-coral-100 text-[0.62rem] text-coral-700">
                    {c.criticalOpen} essential
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* what the parser read */}
      {analysis.extracted.length > 0 && (
        <div className="card p-4">
          <div className="mb-1 flex items-center gap-1.5">
            <Ruler className="h-3.5 w-3.5 text-ink-500" />
            <h3 className="text-[0.86rem] font-bold text-ink-900">Figures read from your notes</h3>
          </div>
          <p className="mb-2.5 text-[0.72rem] leading-relaxed text-ink-500">
            These are the quantities the consistency checks were run on. They were parsed out of what
            you typed, so read them back — if one is wrong, the finding built on it is wrong too. A
            dot followed by three digits is treated as an Indonesian thousands separator.
          </p>
          <div className="flex flex-wrap gap-1.5">
            {analysis.extracted.map((e, i) => (
              <span key={i} className="chip bg-aqua-50 text-aqua-700">
                {e.label}: <span className="stat font-bold">{e.value.toLocaleString("en-GB")}</span> {e.unit}
              </span>
            ))}
          </div>
        </div>
      )}

      <p className="text-[0.68rem] leading-relaxed text-ink-300">
        This analysis is rule-based and runs entirely in your browser — no model, no network call,
        nothing that can invent a finding. Every card names the rule behind it. That also means it
        only knows what these rules know: it will not spot a problem nobody wrote a check for, and
        an empty findings list is not a guarantee that the data is right.
      </p>
    </div>
  );
}

function FindingCard({ f, ask, onJump }: { f: PrepareFinding; ask?: Ask; onJump: () => void }) {
  const tone = TONE[f.severity];
  const Icon = f.severity === "good" ? CheckCircle2 : f.severity === "check" ? HelpCircle : AlertTriangle;
  return (
    <div className={`card border-l-[3px] p-3.5 ${tone.bar}`}>
      <div className="flex flex-wrap items-start gap-2">
        <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${
          f.severity === "blocker" ? "text-coral-500"
            : f.severity === "gap" ? "text-sun-500"
              : f.severity === "check" ? "text-violet-500" : "text-mint-500"
        }`} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-2">
            <span className="text-[0.84rem] font-semibold leading-snug text-ink-900">{f.title}</span>
            <span className={`chip shrink-0 ${tone.chip}`}>{tone.label}</span>
          </div>
          <p className="mt-1 text-[0.75rem] leading-relaxed text-ink-500">{f.detail}</p>
          {f.action && (
            <p className="mt-1.5 flex gap-1.5 rounded-lg bg-aqua-50 px-2.5 py-1.5 text-[0.73rem] leading-relaxed text-aqua-800">
              <ArrowRight className="mt-0.5 h-3 w-3 shrink-0" />
              <span>{f.action}</span>
            </p>
          )}
          <div className="mt-1.5 flex flex-wrap items-center gap-2">
            <span className="text-[0.62rem] font-medium text-ink-300">rule: {f.rule}</span>
            {ask && (
              <button onClick={onJump} className="text-[0.68rem] font-semibold text-aqua-700 hover:underline">
                Go to the question →
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
