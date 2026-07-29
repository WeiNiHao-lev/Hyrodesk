"use client";

import { useState } from "react";
import { CATEGORY_LABELS, UNIT_MODELS } from "@/lib/engine/units";
import { STANDARDS } from "@/lib/engine/templates";
import { UnitCategory } from "@/lib/engine/types";
import { CATEGORY_STYLE } from "@/components/flow/UnitNode";
import { Search, BookOpen, ScrollText } from "lucide-react";

export default function LibraryPage() {
  const [q, setQ] = useState("");
  const [tab, setTab] = useState<"units" | "standards">("units");
  const term = q.trim().toLowerCase();

  const filtered = UNIT_MODELS.filter(
    (m) =>
      !term ||
      m.label.toLowerCase().includes(term) ||
      m.short.toLowerCase().includes(term) ||
      m.description.toLowerCase().includes(term),
  );

  const cats = [...new Set(filtered.map((m) => m.category))] as UnitCategory[];

  return (
    <div className="mx-auto w-full max-w-[1200px] px-4 py-6 sm:px-6">
      <div className="mb-4">
        <h1 className="text-[1.4rem] font-bold tracking-tight text-ink-900">Library</h1>
        <p className="text-[0.8rem] text-ink-500">
          What each block models, which parameters drive it, and how far CCEPC has deployed it.
        </p>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="flex rounded-lg border border-ink-900/10 bg-white p-0.5">
          {(
            [
              ["units", "Unit operations", BookOpen],
              ["standards", "Design standards", ScrollText],
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
        {tab === "units" && (
          <div className="relative min-w-[220px] flex-1">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-300" />
            <input
              className="field pl-8"
              placeholder="Search unit operations…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
        )}
      </div>

      {tab === "units" &&
        cats.map((cat) => {
          const st = CATEGORY_STYLE[cat];
          return (
            <div key={cat} className="mb-6">
              <div className="mb-2 flex items-center gap-2">
                <span className={`h-2 w-2 rounded-full ${st.dot}`} />
                <h2 className="text-[0.95rem] font-bold text-ink-900">{CATEGORY_LABELS[cat]}</h2>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                {filtered
                  .filter((m) => m.category === cat)
                  .map((m) => (
                    <div key={m.type} className="card p-4">
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="text-[0.92rem] font-bold text-ink-900">{m.label}</h3>
                        <span className={`chip shrink-0 ${st.bg} ${st.text}`}>{m.short}</span>
                      </div>
                      <p className="mt-1.5 text-[0.76rem] leading-relaxed text-ink-500">
                        {m.description}
                      </p>
                      <div className="mt-2.5 flex items-center gap-2">
                        <span className="text-[0.6rem] font-semibold uppercase tracking-wider text-ink-300">
                          CCEPC maturity
                        </span>
                        <div className="flex gap-0.5">
                          {[1, 2, 3, 4, 5].map((i) => (
                            <span key={i}
                              className={`h-1.5 w-4 rounded-sm ${i <= m.ccepcMaturity ? "bg-mint-500" : "bg-ink-900/10"}`} />
                          ))}
                        </div>
                      </div>
                      <div className="mt-2.5 flex flex-wrap gap-1">
                        {m.outlets.length > 0 && (
                          <span className="chip bg-ink-900/5 text-ink-500">
                            outlets: {m.outlets.join(", ")}
                          </span>
                        )}
                        <span className="chip bg-ink-900/5 text-ink-500">
                          {m.params.length} parameter{m.params.length === 1 ? "" : "s"}
                        </span>
                      </div>
                      {m.params.length > 0 && (
                        <details className="mt-2.5">
                          <summary className="cursor-pointer text-[0.72rem] font-semibold text-aqua-700">
                            Show parameters
                          </summary>
                          <table className="data mt-2">
                            <thead>
                              <tr><th>Parameter</th><th>Unit</th><th className="num">Default</th></tr>
                            </thead>
                            <tbody>
                              {m.params.map((p) => (
                                <tr key={p.key}>
                                  <td>{p.label}</td>
                                  <td className="text-ink-500">{p.unit ?? "—"}</td>
                                  <td className="num">{String(m.defaults[p.key] ?? "—")}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </details>
                      )}
                    </div>
                  ))}
              </div>
            </div>
          );
        })}

      {tab === "standards" && (
        <div className="grid gap-3 md:grid-cols-2">
          {STANDARDS.map((s) => (
            <div key={s.key} className="card p-4">
              <h3 className="text-[0.92rem] font-bold text-ink-900">{s.name}</h3>
              <p className="mt-1 text-[0.75rem] text-ink-500">{s.scope}</p>
              {s.limits.length > 0 ? (
                <table className="data mt-3">
                  <thead><tr><th>Parameter</th><th>Limit</th></tr></thead>
                  <tbody>
                    {s.limits.map((l) => (
                      <tr key={l.param}><td>{l.param}</td><td className="font-semibold">{l.limit}</td></tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <p className="mt-3 rounded-lg bg-ink-900/[0.03] px-3 py-2 text-[0.72rem] text-ink-500">
                  Limits are declared per project on the Design basis tab.
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
