"use client";
import { create } from "zustand";
import type { NWSAlertFeature } from "@/lib/weather/nws";
import type { DailyForecast } from "@/lib/weather/forecast";

interface WeatherState {
  alerts: NWSAlertFeature[];
  showRadar: boolean;
  showAlerts: boolean;
  showServiceArea: boolean;
  showNdviHeat: boolean;
  forecastByProperty: Record<string, DailyForecast[]>;
  setAlerts: (a: NWSAlertFeature[]) => void;
  toggleRadar: () => void;
  toggleAlerts: () => void;
  toggleServiceArea: () => void;
  toggleNdviHeat: () => void;
  setForecast: (propertyId: string, days: DailyForecast[]) => void;
}

export const useWeatherStore = create<WeatherState>((set) => ({
  alerts: [],
  showRadar: true,
  showAlerts: true,
  showServiceArea: true,
  showNdviHeat: false,
  forecastByProperty: {},
  setAlerts: (alerts) => set({ alerts }),
  toggleRadar: () => set((s) => ({ showRadar: !s.showRadar })),
  toggleAlerts: () => set((s) => ({ showAlerts: !s.showAlerts })),
  toggleServiceArea: () => set((s) => ({ showServiceArea: !s.showServiceArea })),
  toggleNdviHeat: () => set((s) => ({ showNdviHeat: !s.showNdviHeat })),
  setForecast: (propertyId, days) =>
    set((s) => ({ forecastByProperty: { ...s.forecastByProperty, [propertyId]: days } })),
}));
