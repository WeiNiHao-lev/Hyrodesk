"use client";

import Link from "next/link";
import { useStudy } from "@/lib/store/useStudy";
import { ResultsView } from "@/components/ResultsView";
import { Workflow, Sparkles } from "lucide-react";

export default function ResultsPage() {
  const { flowsheet, result, studyName, reliability, optimizerReport } = useStudy();

  if (!result) {
    return (
      <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col items-center justify-center px-4 py-16 text-center">
        <span className="grid h-12 w-12 place-items-center rounded-xl bg-aqua-50">
          <Workflow className="h-6 w-6 text-aqua-600" />
        </span>
        <h1 className="mt-4 text-[1.2rem] font-bold text-ink-900">No results yet</h1>
        <p className="mt-2 max-w-md text-[0.85rem] leading-relaxed text-ink-500">
          Build or load a flowsheet in the simulator and run it. The results appear here and can be
          saved to a project or exported as a pre-approval report.
        </p>
        <Link href="/simulate" className="btn btn-primary mt-5">
          <Workflow className="h-4 w-4" /> Open the simulator
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-[1500px] px-4 py-6 sm:px-6">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <span className="chip bg-aqua-100 text-aqua-700">Current study</span>
          <h1 className="mt-1.5 text-[1.4rem] font-bold tracking-tight text-ink-900">
            {studyName}
          </h1>
          <p className="text-[0.78rem] text-ink-500">
            {flowsheet.feed.name} · {flowsheet.nodes.length} blocks · {flowsheet.edges.length} connections
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <div className="text-[0.55rem] font-bold uppercase tracking-wider text-ink-300">
              Reliability score
            </div>
            <div className="stat text-[1.3rem] font-bold text-mint-700">
              {reliability.toFixed(0)}
              <span className="text-[0.65rem] font-semibold text-ink-500"> / 100</span>
            </div>
          </div>
          <Link href="/simulate" className="btn btn-ghost">
            <Workflow className="h-3.5 w-3.5" /> Back to canvas
          </Link>
        </div>
      </div>

      {optimizerReport && optimizerReport.changes.length > 0 && (
        <div className="card mb-4 border-l-4 border-l-mint-500 p-4">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-mint-500" />
            <h3 className="text-[0.85rem] font-bold text-ink-900">
              Optimiser applied {optimizerReport.changes.length} change
              {optimizerReport.changes.length > 1 ? "s" : ""}
            </h3>
          </div>
          <ul className="mt-2 space-y-1">
            {optimizerReport.changes.map((c, i) => (
              <li key={i} className="text-[0.75rem] text-ink-700">
                <span className="font-semibold">{c.nodeLabel}</span> · {c.param}:{" "}
                <span className="text-ink-500 line-through">{c.from}</span> →{" "}
                <span className="font-bold text-mint-700">{c.to}</span>
                <span className="block text-[0.68rem] text-ink-500">{c.reason}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <ResultsView flowsheet={flowsheet} result={result} studyName={studyName} />
    </div>
  );
}
