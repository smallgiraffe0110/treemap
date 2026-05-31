"use client";
import { create } from "zustand";
import type { FemaDeclaration } from "@/types";

interface AlertState {
  femaDeclarations: FemaDeclaration[];
  activeCountyFilter: string | null;
  loading: boolean;
  error: string | null;
  setDeclarations: (d: FemaDeclaration[]) => void;
  setCountyFilter: (county: string | null) => void;
  setLoading: (l: boolean) => void;
  setError: (e: string | null) => void;
}

export const useAlertStore = create<AlertState>((set) => ({
  femaDeclarations: [],
  activeCountyFilter: null,
  loading: false,
  error: null,
  setDeclarations: (d) => set({ femaDeclarations: d }),
  setCountyFilter: (county) => set({ activeCountyFilter: county }),
  setLoading: (l) => set({ loading: l }),
  setError: (e) => set({ error: e }),
}));
