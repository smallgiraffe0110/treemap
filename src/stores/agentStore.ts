"use client";
import { create } from "zustand";
import type { AgentTrace, AgentName, CanopyResult } from "@/types";

interface AgentState {
  traces: AgentTrace[];
  streaming: Record<string, string>;             // streamId -> partial text
  activeStreamId: string | null;
  canopyOverrides: Record<string, CanopyResult>; // propertyId -> AI-rescored result
  outreachByProperty: Record<string, string>;    // propertyId -> finished copy

  pushTrace: (t: AgentTrace) => void;
  updateTrace: (id: string, patch: Partial<AgentTrace>) => void;
  appendStream: (id: string, chunk: string) => void;
  setActiveStream: (id: string | null) => void;
  setCanopyOverride: (propertyId: string, r: CanopyResult) => void;
  setOutreach: (propertyId: string, copy: string) => void;
  countByAgent: () => Record<AgentName, number>;
  totalCostUsd: () => number;
  clear: () => void;
}

export const useAgentStore = create<AgentState>((set, get) => ({
  traces: [],
  streaming: {},
  activeStreamId: null,
  canopyOverrides: {},
  outreachByProperty: {},

  pushTrace: (t) =>
    set((s) => ({ traces: [t, ...s.traces].slice(0, 100) })),
  updateTrace: (id, patch) =>
    set((s) => ({
      traces: s.traces.map((t) => (t.id === id ? { ...t, ...patch } : t)),
    })),
  appendStream: (id, chunk) =>
    set((s) => ({ streaming: { ...s.streaming, [id]: (s.streaming[id] ?? "") + chunk } })),
  setActiveStream: (id) => set({ activeStreamId: id }),
  setCanopyOverride: (propertyId, r) =>
    set((s) => ({ canopyOverrides: { ...s.canopyOverrides, [propertyId]: r } })),
  setOutreach: (propertyId, copy) =>
    set((s) => ({ outreachByProperty: { ...s.outreachByProperty, [propertyId]: copy } })),
  countByAgent: () => {
    const counts: Record<AgentName, number> = { canopy: 0, outreach: 0, impact: 0, notify: 0, voice: 0 };
    for (const t of get().traces) counts[t.agent]++;
    return counts;
  },
  totalCostUsd: () => get().traces.reduce((s, t) => s + (t.costUsd ?? 0), 0),
  clear: () => set({ traces: [], streaming: {}, activeStreamId: null }),
}));
