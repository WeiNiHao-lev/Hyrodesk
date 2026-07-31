"use client";

import { useMemo, useState } from "react";
import { CATEGORY_LABELS, UNIT_MODELS } from "@/lib/engine/units";
import { UnitCategory } from "@/lib/engine/types";
import { CATEGORY_STYLE } from "./UnitNode";
import { Search, GripVertical } from "lucide-react";

const ORDER: UnitCategory[] = [
  "intake", "pretreatment", "membrane", "ionexchange",
  "biological", "oxidation", "thermal", "sludge", "storage", "transport", "network",
];

export function Palette({ onAdd }: { onAdd: (type: string) => void }) {
  const [q, setQ] = useState("");

  const grouped = useMemo(() => {
    const term = q.trim().toLowerCase();
    const map = new Map<UnitCategory, typeof UNIT_MODELS>();
    for (const m of UNIT_MODELS) {
      if (
        term &&
        !m.label.toLowerCase().includes(term) &&
        !m.short.toLowerCase().includes(term) &&
        !m.description.toLowerCase().includes(term)
      )
        continue;
      const arr = map.get(m.category) ?? [];
      arr.push(m);
      map.set(m.category, arr);
    }
    return map;
  }, [q]);

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-ink-900/8 p-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-300" />
          <input
            className="field pl-8 text-[0.8rem]"
            placeholder="Search unit operations…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <p className="mt-2 text-[0.65rem] leading-snug text-ink-500">
          Drag a block onto the canvas, or click to drop it at the centre.
        </p>
      </div>

      <div className="flex-1 overflow-y-auto px-2 py-2">
        {ORDER.map((cat) => {
          const items = grouped.get(cat);
          if (!items || items.length === 0) return null;
          const st = CATEGORY_STYLE[cat];
          return (
            <div key={cat} className="mb-3">
              <div className="mb-1 flex items-center gap-1.5 px-1.5">
                <span className={`h-1.5 w-1.5 rounded-full ${st.dot}`} />
                <span className="text-[0.62rem] font-bold uppercase tracking-wider text-ink-500">
                  {CATEGORY_LABELS[cat]}
                </span>
              </div>
              <div className="space-y-1">
                {items.map((m) => (
                  <button
                    key={m.type}
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.setData("application/hydrodesk-unit", m.type);
                      e.dataTransfer.effectAllowed = "move";
                    }}
                    onClick={() => onAdd(m.type)}
                    title={m.description}
                    className={`group flex w-full items-center gap-2 rounded-lg border border-transparent px-2 py-1.5 text-left transition hover:border-ink-900/10 hover:bg-white ${st.bg}`}
                  >
                    <GripVertical className="h-3 w-3 shrink-0 text-ink-300 group-hover:text-ink-500" />
                    <span className="flex-1 truncate text-[0.76rem] font-semibold text-ink-900">
                      {m.label}
                    </span>
                    <span className={`shrink-0 text-[0.55rem] font-bold uppercase ${st.text}`}>
                      {m.short}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          );
        })}
        {grouped.size === 0 && (
          <p className="px-2 py-6 text-center text-[0.75rem] text-ink-500">
            No unit matches “{q}”.
          </p>
        )}
      </div>
    </div>
  );
}
