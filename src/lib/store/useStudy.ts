"use client";

import { create } from "zustand";
import { Flowsheet, FlowNode, Params, SimulationResult } from "../engine/types";
import { simulate, simulateForProduct } from "../engine/solver";
import { defaultParams, UNIT_BY_TYPE } from "../engine/units";
import { DEFAULT_GOALS, optimise, OptimizerGoals, OptimizerReport, reliabilityScore } from "../engine/optimizer";
import { FEED_PRESETS, TEMPLATES } from "../engine/templates";

let counter = 0;
const nid = (t: string) => `${t}-${Date.now().toString(36)}-${(counter++).toString(36)}`;

interface StudyState {
  flowsheet: Flowsheet;
  selectedId: string | null;
  result: SimulationResult | null;
  optimizerReport: OptimizerReport | null;
  reliability: number;
  projectId: string | null;
  studyName: string;
  dirty: boolean;

  setFlowsheet: (fs: Flowsheet) => void;
  loadTemplate: (key: string) => void;
  setStudyName: (s: string) => void;
  setProjectId: (id: string | null) => void;

  addNode: (type: string, position: { x: number; y: number }) => void;
  removeNode: (id: string) => void;
  updateNodePosition: (id: string, position: { x: number; y: number }) => void;
  updateNodeParams: (id: string, params: Params) => void;
  renameNode: (id: string, label: string) => void;
  select: (id: string | null) => void;

  connect: (source: string, sourceHandle: string, target: string) => void;
  removeEdge: (id: string) => void;

  setFeed: (patch: Partial<Flowsheet["feed"]>) => void;
  applyFeedPreset: (key: string) => void;
  resetFeed: () => void;
  setBasis: (patch: Partial<Flowsheet["basis"]>) => void;

  run: () => void;
  runOptimizer: (goals?: OptimizerGoals) => void;
}

const initial = TEMPLATES.find((t) => t.key === "demin-ro-edi")!.make();

export const useStudy = create<StudyState>((set, get) => ({
  flowsheet: initial,
  selectedId: null,
  result: null,
  optimizerReport: null,
  reliability: 0,
  projectId: null,
  studyName: "Untitled study",
  dirty: true,

  setFlowsheet: (fs) => set({ flowsheet: fs, dirty: true, result: null }),

  loadTemplate: (key) => {
    const t = TEMPLATES.find((x) => x.key === key);
    if (!t) return;
    set({
      flowsheet: t.make(),
      selectedId: null,
      result: null,
      optimizerReport: null,
      studyName: t.name,
      dirty: true,
    });
  },

  setStudyName: (s) => set({ studyName: s }),
  setProjectId: (id) => set({ projectId: id }),

  addNode: (type, position) => {
    const model = UNIT_BY_TYPE[type];
    if (!model) return;
    const fs = get().flowsheet;
    const count = fs.nodes.filter((x) => x.type === type).length;
    const node: FlowNode = {
      id: nid(type),
      type,
      label: count > 0 ? `${model.label} ${count + 1}` : model.label,
      position,
      params: defaultParams(type),
    };
    set({
      flowsheet: { ...fs, nodes: [...fs.nodes, node] },
      selectedId: node.id,
      dirty: true,
    });
  },

  removeNode: (id) => {
    const fs = get().flowsheet;
    set({
      flowsheet: {
        ...fs,
        nodes: fs.nodes.filter((x) => x.id !== id),
        edges: fs.edges.filter((e) => e.source !== id && e.target !== id),
      },
      selectedId: get().selectedId === id ? null : get().selectedId,
      dirty: true,
    });
  },

  updateNodePosition: (id, position) => {
    const fs = get().flowsheet;
    set({
      flowsheet: {
        ...fs,
        nodes: fs.nodes.map((x) => (x.id === id ? { ...x, position } : x)),
      },
    });
  },

  updateNodeParams: (id, params) => {
    const fs = get().flowsheet;
    set({
      flowsheet: {
        ...fs,
        nodes: fs.nodes.map((x) => (x.id === id ? { ...x, params } : x)),
      },
      dirty: true,
    });
  },

  renameNode: (id, label) => {
    const fs = get().flowsheet;
    set({
      flowsheet: {
        ...fs,
        nodes: fs.nodes.map((x) => (x.id === id ? { ...x, label } : x)),
      },
      dirty: true,
    });
  },

  select: (id) => set({ selectedId: id }),

  connect: (source, sourceHandle, target) => {
    const fs = get().flowsheet;
    if (source === target) return;
    const exists = fs.edges.some(
      (e) => e.source === source && e.sourceHandle === sourceHandle && e.target === target,
    );
    if (exists) return;
    // One outlet port feeds one destination: replace any previous link.
    const cleaned = fs.edges.filter(
      (e) => !(e.source === source && e.sourceHandle === sourceHandle),
    );
    set({
      flowsheet: {
        ...fs,
        edges: [
          ...cleaned,
          {
            id: `e-${source}-${sourceHandle}-${target}-${Date.now().toString(36)}`,
            source,
            sourceHandle,
            target,
            targetHandle: "in",
          },
        ],
      },
      dirty: true,
    });
  },

  removeEdge: (id) => {
    const fs = get().flowsheet;
    set({ flowsheet: { ...fs, edges: fs.edges.filter((e) => e.id !== id) }, dirty: true });
  },

  setFeed: (patch) => {
    const fs = get().flowsheet;
    set({ flowsheet: { ...fs, feed: { ...fs.feed, ...patch } }, dirty: true });
  },

  applyFeedPreset: (key) => {
    const p = FEED_PRESETS.find((x) => x.key === key);
    if (!p) return;
    const fs = get().flowsheet;
    set({ flowsheet: { ...fs, feed: JSON.parse(JSON.stringify(p.spec)) }, dirty: true });
  },

  resetFeed: () => {
    const fs = get().flowsheet;
    // Clear every analysis value but keep what identifies the water, so the
    // engineer does not have to re-select the source after clearing a preset.
    set({
      flowsheet: {
        ...fs,
        feed: {
          name: fs.feed.name,
          sourceType: fs.feed.sourceType,
          flow: fs.feed.flow,
          T: 25,
          pH: 7,
          c: {},
          turbidityNTU: undefined,
          coliform: undefined,
          conductivityUScm: undefined,
          alkalinityAsCaCO3: undefined,
          hardnessAsCaCO3: undefined,
        },
      },
      dirty: true,
    });
  },

  setBasis: (patch) => {
    const fs = get().flowsheet;
    set({ flowsheet: { ...fs, basis: { ...fs.basis, ...patch } }, dirty: true });
  },

  run: () => {
    const fs = get().flowsheet;
    const mode = fs.basis.designMode ?? "product-driven";
    const target = fs.basis.targetProductFlow;

    if (mode === "product-driven" && target != null && target > 0) {
      // Size backwards from the demand: the intake is the answer, not the input.
      const solved = simulateForProduct(fs, target);
      set({
        flowsheet: solved.flowsheet,
        result: solved.result,
        reliability: reliabilityScore(solved.flowsheet, solved.result),
        dirty: false,
      });
      return;
    }
    const result = simulate(fs);
    set({ result, reliability: reliabilityScore(fs, result), dirty: false });
  },

  runOptimizer: (goals = DEFAULT_GOALS) => {
    const fs = get().flowsheet;
    const { flowsheet, report } = optimise(fs, goals);
    const result = simulate(flowsheet);
    set({
      flowsheet,
      result,
      optimizerReport: report,
      reliability: report.reliabilityScore,
      dirty: false,
    });
  },
}));
