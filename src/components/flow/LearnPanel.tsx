"use client";

import { useStudy } from "@/lib/store/useStudy";
import { UNIT_BY_TYPE } from "@/lib/engine/units";
import { knowledgeFor } from "@/lib/engine/knowledge";
import {
  BookOpen, CheckCircle2, XCircle, Lightbulb, Gauge, AlertTriangle, ArrowRight, ArrowLeft,
} from "lucide-react";

export function LearnPanel() {
  const { flowsheet, selectedId } = useStudy();
  const node = flowsheet.nodes.find((n) => n.id === selectedId) ?? null;
  const model = node ? UNIT_BY_TYPE[node.type] : null;
  const k = node ? knowledgeFor(node.type) : undefined;

  if (!node || !model) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 p-6 text-center">
        <BookOpen className="h-5 w-5 text-ink-300" />
        <p className="text-[0.8rem] font-semibold text-ink-700">Select a block to read about it</p>
        <p className="max-w-[210px] text-[0.72rem] leading-relaxed text-ink-500">
          Each block explains what is physically happening, when to choose it, when to refuse it,
          which numbers are normal and why, and what goes wrong in service.
        </p>
      </div>
    );
  }

  if (!k) {
    return (
      <div className="p-4">
        <p className="text-[0.78rem] font-semibold text-ink-900">{model.label}</p>
        <p className="mt-1 text-[0.74rem] leading-relaxed text-ink-500">{model.description}</p>
        <p className="mt-3 rounded-lg bg-ink-900/[0.03] px-3 py-2 text-[0.7rem] text-ink-500">
          No extended notes written for this block yet.
        </p>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col overflow-y-auto">
      <div className="border-b border-ink-900/8 bg-gradient-to-b from-aqua-50 to-transparent p-3">
        <span className="text-[0.58rem] font-bold uppercase tracking-wider text-aqua-700">
          {model.short}
        </span>
        <h3 className="mt-0.5 text-[0.92rem] font-bold leading-tight text-ink-900">{model.label}</h3>
      </div>

      <div className="space-y-4 p-3">
        <Section icon={Lightbulb} title="How it works" tone="aqua">
          <p className="text-[0.74rem] leading-relaxed text-ink-700">{k.principle}</p>
        </Section>

        <Section icon={CheckCircle2} title="When to use it" tone="mint">
          <ul className="space-y-1.5">
            {k.whenToUse.map((t, i) => (
              <li key={i} className="flex gap-1.5 text-[0.73rem] leading-relaxed text-ink-700">
                <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-mint-500" />
                {t}
              </li>
            ))}
          </ul>
        </Section>

        <Section icon={XCircle} title="When NOT to use it" tone="coral">
          <ul className="space-y-1.5">
            {k.whenNotToUse.map((t, i) => (
              <li key={i} className="flex gap-1.5 text-[0.73rem] leading-relaxed text-ink-700">
                <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-coral-500" />
                {t}
              </li>
            ))}
          </ul>
          <p className="mt-2 text-[0.66rem] italic leading-snug text-ink-500">
            Knowing where a process fails is what separates selecting it from defaulting to it.
          </p>
        </Section>

        {k.designRules.length > 0 && (
          <Section icon={BookOpen} title="Design rules" tone="violet">
            <div className="space-y-2.5">
              {k.designRules.map((r, i) => (
                <div key={i} className="rounded-lg border border-ink-900/8 bg-white p-2.5">
                  <p className="text-[0.74rem] font-semibold leading-snug text-ink-900">{r.rule}</p>
                  <p className="mt-1 text-[0.69rem] leading-relaxed text-ink-500">
                    <span className="font-semibold text-violet-700">Why: </span>
                    {r.why}
                  </p>
                </div>
              ))}
            </div>
          </Section>
        )}

        {k.keyNumbers.length > 0 && (
          <Section icon={Gauge} title="Numbers that matter" tone="sun">
            <div className="space-y-2">
              {k.keyNumbers.map((n, i) => (
                <div key={i} className="rounded-lg bg-sun-100/50 p-2">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-[0.72rem] font-semibold text-ink-900">{n.param}</span>
                    <span className="stat shrink-0 text-[0.72rem] font-bold text-sun-700">
                      {n.typical}
                    </span>
                  </div>
                  <p className="mt-0.5 text-[0.66rem] leading-snug text-ink-500">{n.why}</p>
                </div>
              ))}
            </div>
          </Section>
        )}

        {k.failureModes.length > 0 && (
          <Section icon={AlertTriangle} title="What goes wrong" tone="coral">
            <div className="space-y-2">
              {k.failureModes.map((m, i) => (
                <div key={i} className="rounded-lg border border-coral-100 bg-white p-2.5">
                  <p className="text-[0.73rem] font-bold text-coral-700">{m.mode}</p>
                  <p className="mt-0.5 text-[0.68rem] leading-snug text-ink-700">
                    <span className="font-semibold">Symptom: </span>{m.symptom}
                  </p>
                  <p className="mt-0.5 text-[0.68rem] leading-snug text-ink-700">
                    <span className="font-semibold text-mint-700">Prevention: </span>{m.prevention}
                  </p>
                </div>
              ))}
            </div>
          </Section>
        )}

        {(k.upstream || k.downstream) && (
          <div className="rounded-xl bg-ink-900/[0.03] p-3">
            <div className="mb-1.5 text-[0.6rem] font-bold uppercase tracking-wider text-ink-500">
              Where it sits
            </div>
            {k.upstream && (
              <p className="flex gap-1.5 text-[0.7rem] leading-snug text-ink-700">
                <ArrowLeft className="mt-0.5 h-3 w-3 shrink-0 text-ink-300" />
                <span><span className="font-semibold">Upstream: </span>{k.upstream}</span>
              </p>
            )}
            {k.downstream && (
              <p className="mt-1 flex gap-1.5 text-[0.7rem] leading-snug text-ink-700">
                <ArrowRight className="mt-0.5 h-3 w-3 shrink-0 text-ink-300" />
                <span><span className="font-semibold">Downstream: </span>{k.downstream}</span>
              </p>
            )}
          </div>
        )}

        {k.ccepcNote && (
          <div className="rounded-xl bg-mint-100/60 p-3">
            <div className="mb-1 text-[0.6rem] font-bold uppercase tracking-wider text-mint-700">
              CCEPC experience
            </div>
            <p className="text-[0.72rem] leading-relaxed text-ink-700">{k.ccepcNote}</p>
          </div>
        )}
      </div>
    </div>
  );
}

function Section({
  icon: Icon, title, tone, children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  tone: "aqua" | "mint" | "coral" | "violet" | "sun";
  children: React.ReactNode;
}) {
  const color = {
    aqua: "text-aqua-700", mint: "text-mint-700", coral: "text-coral-700",
    violet: "text-violet-700", sun: "text-sun-700",
  }[tone];
  return (
    <div>
      <div className={`mb-1.5 flex items-center gap-1.5 ${color}`}>
        <Icon className="h-3.5 w-3.5" />
        <span className="text-[0.62rem] font-bold uppercase tracking-wider">{title}</span>
      </div>
      {children}
    </div>
  );
}
