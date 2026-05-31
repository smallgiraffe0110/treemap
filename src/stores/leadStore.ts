"use client";
import { create } from "zustand";
import type { Property } from "@/types";

interface LeadState {
  properties: Property[];
  selectedIds: Set<string>;
  filterNeighborhood: string | null;
  filterMinUrgency: number;
  hoveredId: string | null;
  activePropertyId: string | null;
  flyToTarget: { lng: number; lat: number; zoom?: number; id?: string } | null;

  setProperties: (p: Property[]) => void;
  toggleSelected: (id: string) => void;
  setSelected: (id: string, on: boolean) => void;
  selectAllHot: () => void;
  clearSelection: () => void;
  setFilter: (neighborhood: string | null, minUrgency: number) => void;
  setHovered: (id: string | null) => void;
  setActiveProperty: (id: string | null) => void;
  setFlyTo: (t: LeadState["flyToTarget"]) => void;
}

export const useLeadStore = create<LeadState>((set, get) => ({
  properties: [],
  selectedIds: new Set<string>(),
  filterNeighborhood: null,
  filterMinUrgency: 0,
  hoveredId: null,
  activePropertyId: null,
  flyToTarget: null,

  setProperties: (p) => set({ properties: p }),
  toggleSelected: (id) => {
    const next = new Set(get().selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    set({ selectedIds: next });
  },
  setSelected: (id, on) => {
    const next = new Set(get().selectedIds);
    if (on) next.add(id);
    else next.delete(id);
    set({ selectedIds: next });
  },
  selectAllHot: () => {
    const hot = get().properties.filter((p) => p.urgencyScore > 70).map((p) => p.id);
    set({ selectedIds: new Set(hot) });
  },
  clearSelection: () => set({ selectedIds: new Set() }),
  setFilter: (neighborhood, minUrgency) =>
    set({ filterNeighborhood: neighborhood, filterMinUrgency: minUrgency }),
  setHovered: (id) => set({ hoveredId: id }),
  setActiveProperty: (id) => set({ activePropertyId: id }),
  setFlyTo: (t) => set({ flyToTarget: t }),
}));
