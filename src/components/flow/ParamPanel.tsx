"use client";

import { useMemo } from "react";
import { useStudy } from "@/lib/store/useStudy";
import { UNIT_BY_TYPE } from "@/lib/engine/units";
import { ParamDef } from "@/lib/engine/types";
import { Trash2, Info, RotateCcw } from "lucide-react";

export function ParamPanel() {
  const { flowsheet, selectedId, updateNodeParams, renameNode, removeNode, result } = useStudy();
  const node = flowsheet.nodes.find((n) => n.id === selectedId) ?? null;
  const model = node ? UNIT_BY_TYPE[node.type] : null;
  const nodeResult = result?.nodes.find((r) => r.id === selectedId);

  const groups = useMemo(() => {
    if (!model) return [];
    const map = new Map<string, ParamDef[]>();
    for (const p of model.params) {
      const g = p.group ?? "Parameters";
      const arr = map.get(g) ?? [];
      arr.push(p);
      map.set(g, arr);
    }
    return [...map.entries()];
  }, [model]);

  if (!node || !model) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 p-6 text-center">
        <Info className="h-5 w-5 text-ink-300" />
        <p className="text-[0.8rem] font-semibold text-ink-700">No block selected</p>
        <p className="max-w-[210px] text-[0.72rem] leading-relaxed text-ink-500">
          Select a block on the canvas to edit its recovery, retention time, flux and every other
          value that feeds the calculation.
        </p>
      </div>
    );
  }

  const setParam = (key: string, value: number | string | boolean) => {
    updateNodeParams(node.id, { ...node.params, [key]: value });
  };

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-ink-900/8 p-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <span className="text-[0.58rem] font-bold uppercase tracking-wider text-aqua-700">
              {model.short}
            </span>
            <input
              className="field mt-1 font-semibold"
              value={node.label}
              onChange={(e) => renameNode(node.id, e.target.value)}
            />
          </div>
          <button
            className="btn btn-danger mt-4 !px-2 !py-1.5"
            onClick={() => removeNode(node.id)}
            title="Delete block"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
        <p className="mt-2 text-[0.68rem] leading-relaxed text-ink-500">{model.description}</p>
        <div className="mt-2 flex items-center gap-1.5">
          <span className="text-[0.6rem] font-semibold text-ink-500">CCEPC maturity</span>
          <div className="flex gap-0.5">
            {[1, 2, 3, 4, 5].map((i) => (
              <span
                key={i}
                className={`h-1.5 w-3 rounded-sm ${
                  i <= model.ccepcMaturity ? "bg-mint-500" : "bg-ink-900/10"
                }`}
              />
            ))}
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-3">
        {groups.map(([group, defs]) => (
          <div key={group} className="mb-4">
            <div className="mb-2 text-[0.6rem] font-bold uppercase tracking-wider text-ink-500">
              {group}
            </div>
            <div className="space-y-2.5">
              {defs.map((p) => {
                const v = node.params[p.key];
                return (
                  <div key={p.key}>
                    <div className="mb-1 flex items-baseline justify-between gap-2">
                      <label className="text-[0.72rem] font-semibold text-ink-700">
                        {p.label}
                      </label>
                      {p.unit && (
                        <span className="shrink-0 text-[0.62rem] font-medium text-ink-300">
                          {p.unit}
                        </span>
                      )}
                    </div>
                    {p.type === "number" && (
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          className="field"
                          value={typeof v === "number" ? v : 0}
                          min={p.min}
                          max={p.max}
                          step={p.step ?? 1}
                          onChange={(e) => setParam(p.key, Number(e.target.value))}
                        />
                        {p.min != null && p.max != null && (
                          <input
                            type="range"
                            className="w-20 accent-aqua-500"
                            value={typeof v === "number" ? v : 0}
                            min={p.min}
                            max={p.max}
                            step={p.step ?? 1}
                            onChange={(e) => setParam(p.key, Number(e.target.value))}
                          />
                        )}
                      </div>
                    )}
                    {p.type === "select" && (
                      <select
                        className="field"
                        value={typeof v === "string" ? v : ""}
                        onChange={(e) => setParam(p.key, e.target.value)}
                      >
                        {(p.options ?? []).map((o) => (
                          <option key={o.value} value={o.value}>
                            {o.label}
                          </option>
                        ))}
                      </select>
                    )}
                    {p.type === "boolean" && (
                      <label className="flex cursor-pointer items-center gap-2">
                        <input
                          type="checkbox"
                          className="h-4 w-4 accent-aqua-500"
                          checked={v === true}
                          onChange={(e) => setParam(p.key, e.target.checked)}
                        />
                        <span className="text-[0.75rem] text-ink-700">
                          {v === true ? "Enabled" : "Disabled"}
                        </span>
                      </label>
                    )}
                    {p.help && (
                      <p className="mt-1 text-[0.62rem] leading-snug text-ink-500">{p.help}</p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}

        <button
          className="btn btn-ghost w-full !text-[0.72rem]"
          onClick={() => updateNodeParams(node.id, { ...model.defaults })}
        >
          <RotateCcw className="h-3 w-3" />
          Reset to defaults
        </button>

        {nodeResult && (
          <div className="mt-4 rounded-xl bg-aqua-50 p-3">
            <div className="mb-2 text-[0.6rem] font-bold uppercase tracking-wider text-aqua-700">
              Calculated
            </div>
            <dl className="space-y-1 text-[0.7rem]">
              <Row k="Inlet flow" v={`${nodeResult.inlet.flow.toFixed(2)} m³/h`} />
              {Object.entries(nodeResult.outlets).map(([name, st]) => (
                <Row key={name} k={`Outlet ${name}`} v={`${st.flow.toFixed(2)} m³/h`} />
              ))}
              {nodeResult.aux.powerKW > 0 && (
                <Row k="Power" v={`${nodeResult.aux.powerKW.toFixed(2)} kW`} />
              )}
              {nodeResult.aux.hrtH != null && nodeResult.aux.hrtH > 0 && (
                <Row k="HRT" v={`${nodeResult.aux.hrtH.toFixed(2)} h`} />
              )}
              {nodeResult.aux.drySolidsKgH > 0 && (
                <Row k="Dry solids" v={`${nodeResult.aux.drySolidsKgH.toFixed(2)} kg/h`} />
              )}
            </dl>
            {nodeResult.aux.sizing.length > 0 && (
              <>
                <div className="mb-1 mt-3 text-[0.6rem] font-bold uppercase tracking-wider text-aqua-700">
                  Sizing
                </div>
                <dl className="space-y-1 text-[0.7rem]">
                  {nodeResult.aux.sizing.map((sz) => (
                    <Row key={sz.label} k={sz.label} v={sz.value} />
                  ))}
                </dl>
              </>
            )}
            {nodeResult.aux.notes.length > 0 && (
              <div className="mt-3 space-y-1.5">
                {nodeResult.aux.notes.map((nt, i) => (
                  <p
                    key={i}
                    className="rounded-lg bg-sun-100 px-2 py-1.5 text-[0.65rem] leading-snug text-sun-700"
                  >
                    {nt}
                  </p>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
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
