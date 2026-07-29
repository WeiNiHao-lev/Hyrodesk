"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Ask, AskGroup, BRING_LIST, DIRECTOR_PREP, DOCUMENTS, PRESENTATION_STRUCTURE,
  SITE_CONDITIONS, TYPE_GUIDES, UNIVERSAL,
} from "@/lib/engine/sitevisit";
import { downloadText } from "@/lib/store/db";
import {
  ClipboardList, Backpack, HelpCircle, Eye, FileText, Scale, Presentation,
  Check, Copy, Download, AlertTriangle, ChevronDown, RotateCcw,
} from "lucide-react";

type Tab = "bring" | "ask" | "observe" | "docs" | "regs" | "director";
const STORAGE_KEY = "wtpsim:prepare:v1";

interface Saved {
  checked: Record<string, boolean>;
  notes: Record<string, string>;
  condition: string;
  type: string;
}

export default function PreparePage() {
  const [condition, setCondition] = useState("brownfield");
  const [type, setType] = useState("wwtp-industrial");
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [tab, setTab] = useState<Tab>("ask");
  const [loaded, setLoaded] = useState(false);
  const [copied, setCopied] = useState(false);

  // Reading localStorage has to happen after mount: it does not exist during
  // server rendering, and seeding state from it directly would desynchronise
  // hydration. This is the one legitimate case for setting state in an effect.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const s = JSON.parse(raw) as Saved;
        setChecked(s.checked ?? {});
        setNotes(s.notes ?? {});
        if (s.condition) setCondition(s.condition);
        if (s.type) setType(s.type);
      }
    } catch { /* ignore corrupt state */ }
    setLoaded(true);
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */

  useEffect(() => {
    if (!loaded) return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ checked, notes, condition, type } as Saved));
  }, [checked, notes, condition, type, loaded]);

  const cond = SITE_CONDITIONS.find((c) => c.key === condition)!;
  const guide = TYPE_GUIDES.find((t) => t.key === type)!;

  const allGroups: AskGroup[] = useMemo(
    () => [...UNIVERSAL, ...cond.groups, ...guide.groups],
    [cond, guide],
  );
  const allAsks = useMemo(() => allGroups.flatMap((g) => g.items), [allGroups]);
  const observations = cond.observations;

  const total = allAsks.length + observations.length + DOCUMENTS.length;
  const done =
    allAsks.filter((a) => checked[a.id]).length +
    observations.filter((o) => checked[o.id]).length +
    DOCUMENTS.filter((d) => checked[d.id]).length;
  const pct = total > 0 ? (done / total) * 100 : 0;

  const criticalMissing = allAsks.filter((a) => a.critical && !checked[a.id]);

  const toggle = (id: string) => setChecked((c) => ({ ...c, [id]: !c[id] }));

  const buildRequestText = () => {
    const lines: string[] = [];
    lines.push(`DATA REQUEST — ${cond.label} / ${guide.label}`);
    lines.push(`Generated ${new Date().toLocaleDateString("en-GB")}`);
    lines.push("");
    lines.push("DOCUMENTS REQUESTED");
    DOCUMENTS.forEach((d, i) => {
      lines.push(`${i + 1}. ${d.doc}${d.critical ? "  [essential]" : ""}`);
    });
    lines.push("");
    lines.push("INFORMATION STILL OUTSTANDING");
    const open = allAsks.filter((a) => !checked[a.id]);
    open.forEach((a, i) => lines.push(`${i + 1}. ${a.q}${a.critical ? "  [essential]" : ""}`));
    lines.push("");
    lines.push(`${open.length} of ${allAsks.length} questions still open.`);
    return lines.join("\n");
  };

  const reset = () => {
    if (!confirm("Clear every tick and note on this checklist?")) return;
    setChecked({});
    setNotes({});
  };

  return (
    <div className="mx-auto w-full max-w-[1200px] px-4 py-6 sm:px-6">
      <div className="mb-4">
        <h1 className="text-[1.4rem] font-bold tracking-tight text-ink-900">Site visit & pre-approval preparation</h1>
        <p className="text-[0.8rem] text-ink-500">
          What to understand before you go, what to ask and measure while you are there, and what
          you must be able to answer when you present. Every item states why it matters.
        </p>
      </div>

      {/* selectors + progress */}
      <div className="card mb-4 p-4">
        <div className="grid gap-3 md:grid-cols-2">
          <div>
            <label className="label">Site condition</label>
            <select className="field mt-1" value={condition} onChange={(e) => setCondition(e.target.value)}>
              {SITE_CONDITIONS.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
            </select>
            <p className="mt-1.5 text-[0.7rem] leading-snug text-ink-500">{cond.summary}</p>
          </div>
          <div>
            <label className="label">Project type</label>
            <select className="field mt-1" value={type} onChange={(e) => setType(e.target.value)}>
              {TYPE_GUIDES.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
            </select>
            <p className="mt-1.5 text-[0.7rem] leading-snug text-ink-500">{guide.summary}</p>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <div className="min-w-[200px] flex-1">
            <div className="mb-1 flex items-baseline justify-between">
              <span className="text-[0.68rem] font-semibold text-ink-700">Preparation progress</span>
              <span className="stat text-[0.78rem] font-bold text-aqua-700">{done} / {total}</span>
            </div>
            <div className="h-2.5 overflow-hidden rounded-full bg-ink-900/8">
              <div
                className={`h-full rounded-full transition-all ${pct >= 80 ? "bg-mint-500" : pct >= 40 ? "bg-aqua-500" : "bg-sun-500"}`}
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
          <button className="btn btn-ghost" onClick={reset}>
            <RotateCcw className="h-3.5 w-3.5" /> Reset
          </button>
          <button
            className="btn btn-ghost"
            onClick={() => {
              navigator.clipboard.writeText(buildRequestText());
              setCopied(true);
              setTimeout(() => setCopied(false), 1800);
            }}
          >
            {copied ? <Check className="h-3.5 w-3.5 text-mint-700" /> : <Copy className="h-3.5 w-3.5" />}
            {copied ? "Copied" : "Copy data request"}
          </button>
          <button
            className="btn btn-primary"
            onClick={() => downloadText(`data-request-${condition}-${type}.txt`, buildRequestText(), "text/plain")}
          >
            <Download className="h-3.5 w-3.5" /> Download request
          </button>
        </div>

        {criticalMissing.length > 0 && (
          <div className="mt-3 rounded-lg bg-coral-100/60 px-3 py-2.5">
            <div className="flex items-center gap-1.5 text-coral-700">
              <AlertTriangle className="h-3.5 w-3.5" />
              <span className="text-[0.72rem] font-bold">
                {criticalMissing.length} essential item{criticalMissing.length > 1 ? "s" : ""} still open
              </span>
            </div>
            <p className="mt-1 text-[0.7rem] leading-snug text-ink-700">
              These are the ones a design cannot proceed without. Close them before the study is
              presented, or state explicitly in the report that they are open.
            </p>
          </div>
        )}
      </div>

      {/* tabs */}
      <div className="mb-4 flex flex-wrap gap-1 rounded-lg border border-ink-900/10 bg-white p-1">
        {(
          [
            ["ask", "Questions to ask", HelpCircle, allAsks.length],
            ["observe", "Observe & measure", Eye, observations.length],
            ["docs", "Documents", FileText, DOCUMENTS.length],
            ["regs", "Regulations", Scale, guide.regulations.length],
            ["bring", "What to bring", Backpack, BRING_LIST.length],
            ["director", "Present to director", Presentation, DIRECTOR_PREP.length],
          ] as [Tab, string, React.ComponentType<{ className?: string }>, number][]
        ).map(([k, lbl, Icon, n]) => (
          <button
            key={k}
            onClick={() => setTab(k)}
            className={`flex items-center gap-1.5 rounded-md px-3 py-2 text-[0.76rem] font-semibold transition ${
              tab === k ? "bg-aqua-100 text-aqua-700" : "text-ink-500 hover:bg-ink-900/[0.03] hover:text-ink-900"
            }`}
          >
            <Icon className="h-3.5 w-3.5" />
            {lbl}
            <span className="rounded-full bg-white/70 px-1.5 text-[0.6rem]">{n}</span>
          </button>
        ))}
      </div>

      {/* ------------------------------------------------------------- ask */}
      {tab === "ask" && (
        <div className="space-y-5">
          {allGroups.map((g) => {
            const gDone = g.items.filter((i) => checked[i.id]).length;
            return (
              <div key={g.id}>
                <div className="mb-2 flex flex-wrap items-baseline gap-2">
                  <h2 className="text-[1rem] font-bold text-ink-900">{g.title}</h2>
                  <span className={`chip ${gDone === g.items.length ? "bg-mint-100 text-mint-700" : "bg-ink-900/5 text-ink-500"}`}>
                    {gDone} / {g.items.length}
                  </span>
                </div>
                {g.intro && (
                  <p className="mb-2.5 max-w-3xl text-[0.76rem] leading-relaxed text-ink-500">{g.intro}</p>
                )}
                <div className="space-y-2">
                  {g.items.map((a) => (
                    <AskCard
                      key={a.id}
                      a={a}
                      checked={!!checked[a.id]}
                      note={notes[a.id] ?? ""}
                      onToggle={() => toggle(a.id)}
                      onNote={(v) => setNotes((n) => ({ ...n, [a.id]: v }))}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ------------------------------------------------------------- observe */}
      {tab === "observe" && (
        <div className="space-y-2">
          <p className="card mb-3 p-4 text-[0.78rem] leading-relaxed text-ink-700">
            What to physically do while you are on site. These are the items that cannot be obtained
            afterwards by email — if you leave without them, you go back.
          </p>
          {observations.map((o) => (
            <label key={o.id} className="card flex cursor-pointer gap-3 p-3.5">
              <input type="checkbox" className="mt-0.5 h-4 w-4 shrink-0 accent-aqua-500"
                checked={!!checked[o.id]} onChange={() => toggle(o.id)} />
              <div className="min-w-0 flex-1">
                <p className={`text-[0.85rem] font-bold ${checked[o.id] ? "text-ink-300 line-through" : "text-ink-900"}`}>
                  {o.what}
                </p>
                <p className="mt-1 text-[0.74rem] leading-relaxed text-ink-700">
                  <span className="font-semibold">How: </span>{o.how}
                </p>
                <p className="mt-1 text-[0.71rem] leading-relaxed text-ink-500">
                  <span className="font-semibold text-aqua-700">Why: </span>{o.why}
                </p>
              </div>
            </label>
          ))}
        </div>
      )}

      {/* ------------------------------------------------------------- docs */}
      {tab === "docs" && (
        <div className="space-y-2">
          <p className="card mb-3 p-4 text-[0.78rem] leading-relaxed text-ink-700">
            Request these formally, in writing, with a deadline. Use the download button above to
            send the list to the marketing manager or directly to the client.
          </p>
          {DOCUMENTS.map((d) => (
            <label key={d.id} className="card flex cursor-pointer gap-3 p-3.5">
              <input type="checkbox" className="mt-0.5 h-4 w-4 shrink-0 accent-aqua-500"
                checked={!!checked[d.id]} onChange={() => toggle(d.id)} />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-baseline gap-2">
                  <p className={`text-[0.84rem] font-semibold ${checked[d.id] ? "text-ink-300 line-through" : "text-ink-900"}`}>
                    {d.doc}
                  </p>
                  {d.critical && <span className="chip bg-coral-100 text-coral-700">Essential</span>}
                </div>
                <p className="mt-1 text-[0.72rem] leading-relaxed text-ink-500">{d.why}</p>
              </div>
            </label>
          ))}
        </div>
      )}

      {/* ------------------------------------------------------------- regs */}
      {tab === "regs" && (
        <div className="space-y-3">
          <div className="card border-l-4 border-l-sun-500 p-4">
            <div className="flex items-center gap-1.5 text-sun-700">
              <AlertTriangle className="h-4 w-4" />
              <span className="text-[0.8rem] font-bold">Read this before quoting any limit</span>
            </div>
            <p className="mt-1.5 text-[0.76rem] leading-relaxed text-ink-700">
              Indonesian environmental regulation was substantially reorganised under PP No. 22/2021,
              and older instruments are still widely cited. The figures below are indicative only,
              to tell you what order of magnitude to expect. <strong>Always work from the client&apos;s
              own environmental permit</strong> — permit conditions are frequently stricter than the
              national standard, and it is the permit the regulator enforces.
            </p>
          </div>
          {guide.regulations.map((r) => (
            <div key={r.name} className="card p-4">
              <h3 className="text-[0.92rem] font-bold text-ink-900">{r.name}</h3>
              <p className="mt-1 text-[0.76rem] text-ink-700">
                <span className="font-semibold">Governs: </span>{r.governs}
              </p>
              <p className="mt-1.5 rounded-lg bg-sun-100/50 px-2.5 py-1.5 text-[0.72rem] leading-relaxed text-sun-700">
                {r.note}
              </p>
              {r.indicative && (
                <table className="data mt-2.5">
                  <thead><tr><th>Parameter</th><th>Indicative value</th></tr></thead>
                  <tbody>
                    {r.indicative.map((i) => (
                      <tr key={i.param}><td>{i.param}</td><td className="font-semibold">{i.value}</td></tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          ))}
        </div>
      )}

      {/* ------------------------------------------------------------- bring */}
      {tab === "bring" && (
        <div className="space-y-2">
          {BRING_LIST.map((b) => (
            <label key={b.item} className="card flex cursor-pointer gap-3 p-3.5">
              <input type="checkbox" className="mt-0.5 h-4 w-4 shrink-0 accent-aqua-500"
                checked={!!checked[`bring-${b.item}`]} onChange={() => toggle(`bring-${b.item}`)} />
              <div className="min-w-0 flex-1">
                <p className={`text-[0.84rem] font-semibold ${checked[`bring-${b.item}`] ? "text-ink-300 line-through" : "text-ink-900"}`}>
                  {b.item}
                </p>
                <p className="mt-0.5 text-[0.72rem] leading-relaxed text-ink-500">{b.why}</p>
              </div>
            </label>
          ))}
        </div>
      )}

      {/* ------------------------------------------------------------- director */}
      {tab === "director" && (
        <div className="space-y-5">
          <div>
            <h2 className="mb-2 text-[1rem] font-bold text-ink-900">How to structure the presentation</h2>
            <ol className="space-y-1.5">
              {PRESENTATION_STRUCTURE.map((s, i) => (
                <li key={s.step} className="card flex gap-3 p-3">
                  <span className="grid h-6 w-6 shrink-0 place-items-center rounded-lg bg-aqua-100 text-[0.68rem] font-bold text-aqua-700">
                    {i + 1}
                  </span>
                  <div>
                    <p className="text-[0.82rem] font-bold text-ink-900">{s.step}</p>
                    <p className="mt-0.5 text-[0.73rem] leading-relaxed text-ink-500">{s.detail}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>

          <div>
            <h2 className="mb-2 text-[1rem] font-bold text-ink-900">
              Questions the director will ask — and how to be ready
            </h2>
            <div className="space-y-2">
              {DIRECTOR_PREP.map((d, i) => (
                <details key={i} className="card group p-3.5">
                  <summary className="flex cursor-pointer items-start gap-2 list-none">
                    <ChevronDown className="mt-0.5 h-4 w-4 shrink-0 text-ink-300 transition group-open:rotate-180" />
                    <span className="text-[0.85rem] font-bold text-ink-900">&ldquo;{d.q}&rdquo;</span>
                  </summary>
                  <div className="mt-2 pl-6">
                    <p className="text-[0.74rem] leading-relaxed text-ink-700">
                      <span className="font-semibold text-aqua-700">Why he asks: </span>{d.why}
                    </p>
                    <p className="mt-1.5 rounded-lg bg-mint-100/50 px-2.5 py-2 text-[0.74rem] leading-relaxed text-ink-700">
                      <span className="font-semibold text-mint-700">Be ready with: </span>{d.how}
                    </p>
                  </div>
                </details>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function AskCard({
  a, checked, note, onToggle, onNote,
}: { a: Ask; checked: boolean; note: string; onToggle: () => void; onNote: (v: string) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div className={`card p-3.5 ${a.critical && !checked ? "border-l-4 border-l-coral-500" : ""}`}>
      <div className="flex gap-3">
        <input type="checkbox" className="mt-1 h-4 w-4 shrink-0 accent-aqua-500" checked={checked} onChange={onToggle} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-2">
            <p className={`text-[0.85rem] font-semibold leading-snug ${checked ? "text-ink-300 line-through" : "text-ink-900"}`}>
              {a.q}
            </p>
            {a.critical && <span className="chip bg-coral-100 text-coral-700">Essential</span>}
          </div>
          <p className="mt-1 text-[0.73rem] leading-relaxed text-ink-500">
            <span className="font-semibold text-aqua-700">Why: </span>{a.why}
          </p>

          <button
            className="mt-1.5 text-[0.68rem] font-semibold text-aqua-700 hover:underline"
            onClick={() => setOpen((o) => !o)}
          >
            {open ? "Hide detail" : "More detail & record the answer"}
          </button>

          {open && (
            <div className="mt-2 space-y-1.5">
              {a.good && (
                <p className="rounded-lg bg-mint-100/50 px-2.5 py-1.5 text-[0.71rem] leading-relaxed text-ink-700">
                  <span className="font-semibold text-mint-700">A complete answer looks like: </span>{a.good}
                </p>
              )}
              {a.redFlag && (
                <p className="rounded-lg bg-coral-100/50 px-2.5 py-1.5 text-[0.71rem] leading-relaxed text-ink-700">
                  <span className="font-semibold text-coral-700">Warning sign: </span>{a.redFlag}
                </p>
              )}
              {a.unlocks && (
                <p className="rounded-lg bg-aqua-50 px-2.5 py-1.5 text-[0.71rem] leading-relaxed text-ink-700">
                  <span className="font-semibold text-aqua-700">This unlocks: </span>{a.unlocks}
                </p>
              )}
              <textarea
                className="field min-h-[54px] resize-y !text-[0.74rem]"
                placeholder="Record the answer here…"
                value={note}
                onChange={(e) => onNote(e.target.value)}
              />
            </div>
          )}
          {!open && note && (
            <p className="mt-1.5 rounded-lg bg-ink-900/[0.03] px-2.5 py-1.5 text-[0.71rem] italic text-ink-700">
              {note}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

export { ClipboardList };
