"use client";

import { useState } from "react";
import { Modal } from "./Modal";
import { useStudy } from "@/lib/store/useStudy";
import { DEFAULT_GOALS, OptimizerGoals } from "@/lib/engine/optimizer";
import { Sparkles, ArrowRight, ShieldCheck } from "lucide-react";

export function OptimizerDialog({ onClose }: { onClose: () => void }) {
  const { runOptimizer, optimizerReport } = useStudy();
  const [goals, setGoals] = useState<OptimizerGoals>(DEFAULT_GOALS);
  const [done, setDone] = useState(false);

  const run = () => {
    runOptimizer(goals);
    setDone(true);
  };

  return (
    <Modal
      wide
      title="Optimise for guaranteed performance"
      subtitle="Pulls the flowsheet into the operating envelope CCEPC has actually delivered, rather than to the edge of what is theoretically achievable."
      onClose={onClose}
      footer={
        done ? (
          <button className="btn btn-primary" onClick={onClose}>Close</button>
        ) : (
          <>
            <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
            <button className="btn btn-mint" onClick={run}>
              <Sparkles className="h-3.5 w-3.5" /> Run optimiser
            </button>
          </>
        )
      }
    >
      {!done && (
        <div className="space-y-4">
          <div className="rounded-xl bg-aqua-50 p-3 text-[0.75rem] leading-relaxed text-ink-700">
            <p className="flex gap-2">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-aqua-600" />
              <span>
                The optimiser does not chase the lowest capital or operating cost. It targets a
                configuration whose performance can be <strong>guaranteed</strong>: every parameter
                inside a range CCEPC has operated, redundancy on the units that stop the plant if
                they fail, and enough antiscalant and margin that the guarantee survives a bad day.
              </span>
            </p>
          </div>

          <div>
            <div className="mb-1 flex items-baseline justify-between">
              <label className="text-[0.78rem] font-semibold text-ink-900">
                Minimum overall recovery
              </label>
              <span className="stat text-[0.85rem] font-bold text-aqua-700">
                {goals.minRecoveryPct} %
              </span>
            </div>
            <input
              type="range" min={50} max={98} step={1}
              className="w-full accent-aqua-500"
              value={goals.minRecoveryPct}
              onChange={(e) => setGoals({ ...goals, minRecoveryPct: Number(e.target.value) })}
            />
            <p className="mt-1 text-[0.68rem] text-ink-500">
              Recovery is lifted using the cheapest levers first: thickener supernatant, then UF
              recovery, then membrane recovery — the order that adds the least risk.
            </p>
          </div>

          <div>
            <div className="mb-1 flex items-baseline justify-between">
              <label className="text-[0.78rem] font-semibold text-ink-900">
                Reliability versus cost
              </label>
              <span className="stat text-[0.85rem] font-bold text-mint-700">
                {(goals.reliabilityWeight * 100).toFixed(0)} % reliability
              </span>
            </div>
            <input
              type="range" min={0} max={1} step={0.05}
              className="w-full accent-mint-500"
              value={goals.reliabilityWeight}
              onChange={(e) => setGoals({ ...goals, reliabilityWeight: Number(e.target.value) })}
            />
          </div>

          <label className="flex cursor-pointer items-start gap-2.5 rounded-xl border border-ink-900/8 p-3">
            <input
              type="checkbox" className="mt-0.5 h-4 w-4 accent-aqua-500"
              checked={goals.enforceRedundancy}
              onChange={(e) => setGoals({ ...goals, enforceRedundancy: e.target.checked })}
            />
            <span>
              <span className="block text-[0.78rem] font-semibold text-ink-900">
                Enforce redundancy
              </span>
              <span className="block text-[0.68rem] leading-snug text-ink-500">
                2 × 50 % on every membrane and polishing train, plus a standby UF train. Removes the
                single points of failure that would otherwise stop product water entirely.
              </span>
            </span>
          </label>

          <label className="flex cursor-pointer items-start gap-2.5 rounded-xl border border-ink-900/8 p-3">
            <input
              type="checkbox" className="mt-0.5 h-4 w-4 accent-aqua-500"
              checked={goals.allowRecycleTuning}
              onChange={(e) => setGoals({ ...goals, allowRecycleTuning: e.target.checked })}
            />
            <span>
              <span className="block text-[0.78rem] font-semibold text-ink-900">
                Allow recycle tuning
              </span>
              <span className="block text-[0.68rem] leading-snug text-ink-500">
                Lets the optimiser raise thickener supernatant return, the cheapest way to lift
                overall recovery.
              </span>
            </span>
          </label>
        </div>
      )}

      {done && optimizerReport && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Delta label="Recovery" unit="%"
              before={optimizerReport.before.recoveryPct} after={optimizerReport.after.recoveryPct} higherBetter />
            <Delta label="SEC" unit="kWh/m³" dp={3}
              before={optimizerReport.before.secKWhPerM3} after={optimizerReport.after.secKWhPerM3} />
            <Delta label="OPEX" unit="USD/m³" dp={3}
              before={optimizerReport.before.opexUSDPerM3} after={optimizerReport.after.opexUSDPerM3} />
            <Delta label="Warnings" unit="" dp={0}
              before={optimizerReport.before.warnings} after={optimizerReport.after.warnings} />
          </div>

          <div className="rounded-xl bg-mint-100/60 p-3">
            <div className="flex items-baseline justify-between">
              <span className="text-[0.7rem] font-bold uppercase tracking-wider text-mint-700">
                Reliability score
              </span>
              <span className="stat text-[1.3rem] font-bold text-mint-700">
                {optimizerReport.reliabilityScore.toFixed(0)}
                <span className="text-[0.7rem] font-semibold"> / 100</span>
              </span>
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-white">
              <div
                className="h-full rounded-full bg-gradient-to-r from-mint-500 to-aqua-500 transition-all"
                style={{ width: `${optimizerReport.reliabilityScore}%` }}
              />
            </div>
            <p className="mt-2 text-[0.66rem] leading-snug text-ink-500">
              Built from CCEPC deployment maturity of the selected units, how far each parameter sits
              inside its proven envelope, redundancy, and remaining engineering warnings.
            </p>
          </div>

          {optimizerReport.changes.length > 0 && (
            <div>
              <h3 className="mb-2 text-[0.78rem] font-bold text-ink-900">
                Changes applied ({optimizerReport.changes.length})
              </h3>
              <div className="space-y-1.5">
                {optimizerReport.changes.map((c, i) => (
                  <div key={i} className="rounded-lg border border-ink-900/8 bg-white p-2.5">
                    <div className="flex flex-wrap items-baseline gap-1.5 text-[0.75rem]">
                      <span className="font-semibold text-ink-900">{c.nodeLabel}</span>
                      <span className="text-ink-300">·</span>
                      <span className="font-medium text-ink-700">{c.param}</span>
                      <span className="ml-auto flex items-center gap-1.5 font-mono text-[0.7rem]">
                        <span className="text-ink-500 line-through">{c.from}</span>
                        <ArrowRight className="h-3 w-3 text-mint-500" />
                        <span className="font-bold text-mint-700">{c.to}</span>
                      </span>
                    </div>
                    <p className="mt-1 text-[0.66rem] leading-snug text-ink-500">{c.reason}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {optimizerReport.notes.length > 0 && (
            <div className="space-y-1.5">
              {optimizerReport.notes.map((nt, i) => (
                <p key={i} className="rounded-lg bg-sun-100 px-3 py-2 text-[0.7rem] leading-snug text-sun-700">
                  {nt}
                </p>
              ))}
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}

function Delta({
  label, unit, before, after, dp = 1, higherBetter = false,
}: { label: string; unit: string; before: number; after: number; dp?: number; higherBetter?: boolean }) {
  const diff = after - before;
  const good = higherBetter ? diff >= 0 : diff <= 0;
  return (
    <div className="card-flat p-2.5">
      <div className="text-[0.55rem] font-bold uppercase tracking-wider text-ink-300">{label}</div>
      <div className="stat mt-1 text-[1rem] font-bold text-ink-900">
        {after.toFixed(dp)}
        <span className="ml-0.5 text-[0.55rem] font-medium text-ink-500">{unit}</span>
      </div>
      <div className={`text-[0.62rem] font-semibold ${good ? "text-mint-700" : "text-coral-700"}`}>
        {diff >= 0 ? "+" : ""}{diff.toFixed(dp)} vs before
      </div>
    </div>
  );
}
