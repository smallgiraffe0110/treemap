"use client";
import { create } from "zustand";

export type CrewId = "truck-1" | "truck-2" | "truck-3";

export const CREWS: { id: CrewId; name: string; color: string }[] = [
  { id: "truck-1", name: "Truck 1 — Mahoney crew", color: "#3b82f6" },
  { id: "truck-2", name: "Truck 2 — Ortega crew",  color: "#a855f7" },
  { id: "truck-3", name: "Truck 3 — Walsh crew",   color: "#ec4899" },
];

interface CrewState {
  assignments: Record<string, CrewId>;  // propertyId -> CrewId
  panelOpen: boolean;
  assign: (propertyId: string, crew: CrewId) => void;
  unassign: (propertyId: string) => void;
  clear: () => void;
  togglePanel: () => void;
  setPanelOpen: (open: boolean) => void;
  autoAssignSelected: (selectedIds: string[]) => void; // round-robin distribute
}

export const useCrewStore = create<CrewState>((set, get) => ({
  assignments: {},
  panelOpen: false,
  assign: (id, crew) => set((s) => ({ assignments: { ...s.assignments, [id]: crew } })),
  unassign: (id) => set((s) => {
    const next = { ...s.assignments };
    delete next[id];
    return { assignments: next };
  }),
  clear: () => set({ assignments: {} }),
  togglePanel: () => set((s) => ({ panelOpen: !s.panelOpen })),
  setPanelOpen: (open) => set({ panelOpen: open }),
  autoAssignSelected: (ids) => {
    const next: Record<string, CrewId> = { ...get().assignments };
    ids.forEach((id, i) => { next[id] = CREWS[i % CREWS.length].id; });
    set({ assignments: next });
  },
}));
