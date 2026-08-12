"use client";

import { Handle, Position, NodeProps } from "@xyflow/react";
import { outletsOf, UNIT_BY_TYPE } from "@/lib/engine/units";
import { Params, UnitCategory } from "@/lib/engine/types";

export const CATEGORY_STYLE: Record<UnitCategory, { bg: string; ring: string; text: string; dot: string }> = {
  intake:       { bg: "bg-sky-50",     ring: "ring-sky-200",     text: "text-sky-800",     dot: "bg-sky-400" },
  pretreatment: { bg: "bg-cyan-50",    ring: "ring-cyan-200",    text: "text-cyan-800",    dot: "bg-cyan-400" },
  membrane:     { bg: "bg-amber-50",   ring: "ring-amber-200",   text: "text-amber-800",   dot: "bg-amber-400" },
  ionexchange:  { bg: "bg-violet-50",  ring: "ring-violet-200",  text: "text-violet-800",  dot: "bg-violet-400" },
  biological:   { bg: "bg-emerald-50", ring: "ring-emerald-200", text: "text-emerald-800", dot: "bg-emerald-400" },
  oxidation:    { bg: "bg-fuchsia-50", ring: "ring-fuchsia-200", text: "text-fuchsia-800", dot: "bg-fuchsia-400" },
  thermal:      { bg: "bg-orange-50",  ring: "ring-orange-200",  text: "text-orange-800",  dot: "bg-orange-400" },
  sludge:       { bg: "bg-stone-100",  ring: "ring-stone-300",   text: "text-stone-700",   dot: "bg-stone-400" },
  storage:      { bg: "bg-teal-50",    ring: "ring-teal-200",    text: "text-teal-800",    dot: "bg-teal-400" },
  transport:    { bg: "bg-slate-50",   ring: "ring-slate-200",   text: "text-slate-700",   dot: "bg-slate-400" },
  network:      { bg: "bg-rose-50",    ring: "ring-rose-200",    text: "text-rose-800",    dot: "bg-rose-400" },
};

export interface UnitNodeData extends Record<string, unknown> {
  label: string;
  unitType: string;
  params?: Params;
  flow?: number;
  tds?: number;
  selected?: boolean;
}

export function UnitNode({ data, selected }: NodeProps) {
  const d = data as UnitNodeData;
  const model = UNIT_BY_TYPE[d.unitType];
  if (!model) return null;
  const style = CATEGORY_STYLE[model.category];
  // Read through outletsOf: a tank set to two draw-off lines must show two.
  const outs = outletsOf(d.unitType, d.params ?? {});

  return (
    <div
      className={`min-w-[168px] rounded-xl border bg-white/95 px-3 py-2.5 shadow-sm ring-1 transition ${
        selected
          ? "border-aqua-500 ring-aqua-300 shadow-md"
          : `border-transparent ${style.ring}`
      }`}
    >
      {model.inlets > 0 && (
        <Handle type="target" id="in" position={Position.Left} style={{ top: "50%" }} />
      )}

      <div className="flex items-center gap-1.5">
        <span className={`h-2 w-2 shrink-0 rounded-full ${style.dot}`} />
        <span className={`text-[0.58rem] font-bold uppercase tracking-wider ${style.text}`}>
          {model.short}
        </span>
      </div>
      <div className="mt-0.5 text-[0.82rem] font-semibold leading-tight text-ink-900">
        {d.label}
      </div>

      {d.flow != null && (
        <div className="mt-1.5 flex items-baseline gap-1 border-t border-ink-900/6 pt-1.5">
          <span className="stat text-[0.78rem] font-bold text-aqua-700">
            {d.flow.toFixed(d.flow < 10 ? 2 : 1)}
          </span>
          <span className="text-[0.6rem] font-medium text-ink-500">m³/h</span>
          {d.tds != null && d.tds > 0 && (
            <span className="ml-auto text-[0.6rem] font-medium text-ink-500">
              {d.tds >= 1000 ? `${(d.tds / 1000).toFixed(1)} g/L` : `${d.tds.toFixed(1)} mg/L`}
            </span>
          )}
        </div>
      )}

      {outs.map((o, i) => (
        <Handle
          key={o}
          type="source"
          id={o}
          position={Position.Right}
          style={{ top: `${((i + 1) / (outs.length + 1)) * 100}%` }}
        />
      ))}

      {outs.length > 1 && (
        <div className="pointer-events-none absolute -right-1 top-0 h-full">
          {outs.map((o, i) => (
            <span
              key={o}
              className="absolute whitespace-nowrap text-[0.5rem] font-semibold text-ink-500"
              style={{ top: `calc(${((i + 1) / (outs.length + 1)) * 100}% - 14px)`, left: 8 }}
            >
              {o}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
