"use client";

import { useEffect, useState } from "react";
import { useWeatherStore } from "@/stores/weatherStore";
import type { DailyForecast } from "@/lib/weather/forecast";

interface ForecastWidgetProps {
  lat: number;
  lng: number;
  propertyId: string;
}

function dayLabel(dateStr: string, index: number): string {
  if (index === 0) return "Today";
  if (index === 1) return "Tomorrow";
  const d = new Date(`${dateStr}T12:00:00`);
  return d.toLocaleDateString("en-US", { weekday: "short" });
}

function SkeletonDay() {
  return (
    <div className="flex flex-1 flex-col items-center gap-1.5 rounded border border-[var(--border)] bg-[var(--panel-2)] p-2">
      <div className="h-3 w-10 animate-pulse rounded bg-[var(--border)]" />
      <div className="h-6 w-6 animate-pulse rounded bg-[var(--border)]" />
      <div className="h-3 w-12 animate-pulse rounded bg-[var(--border)]" />
      <div className="h-2.5 w-10 animate-pulse rounded bg-[var(--border)]" />
    </div>
  );
}

export function ForecastWidget({ lat, lng, propertyId }: ForecastWidgetProps) {
  const days = useWeatherStore((s) => s.forecastByProperty[propertyId]);
  const setForecast = useWeatherStore((s) => s.setForecast);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/weather/forecast?lat=${lat}&lng=${lng}`);
        if (!res.ok) throw new Error(`status ${res.status}`);
        const data = (await res.json()) as { days: DailyForecast[] };
        if (cancelled) return;
        setForecast(propertyId, data.days ?? []);
      } catch (e) {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : "failed");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [lat, lng, propertyId, setForecast]);

  return (
    <div className="mt-4">
      <div className="mb-2 flex items-center gap-2">
        <span className="font-display text-[10px] uppercase tracking-[0.18em] text-[var(--text-dim)]">
          3-Day Forecast
        </span>
        <span className="h-px flex-1 bg-[var(--border)]" />
      </div>

      {loading && !days && (
        <div className="flex gap-2">
          <SkeletonDay />
          <SkeletonDay />
          <SkeletonDay />
        </div>
      )}

      {error && !days && (
        <div className="text-[10px] text-[var(--text-dim)]">Forecast unavailable</div>
      )}

      {days && days.length > 0 && (
        <div className="flex gap-2">
          {days.slice(0, 3).map((d, i) => (
            <div
              key={d.date}
              className="flex flex-1 flex-col items-center gap-1 rounded border border-[var(--border)] bg-[var(--panel-2)] p-2"
            >
              <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-dim)]">
                {dayLabel(d.date, i)}
              </span>
              <span className="text-2xl leading-none" title={d.label}>
                {d.icon}
              </span>
              <span className="font-mono text-[11px] text-[var(--text)]">
                <span className="font-semibold">{Math.round(d.tempMax)}°</span>
                <span className="text-[var(--text-dim)]"> / {Math.round(d.tempMin)}°</span>
              </span>
              <span className="font-mono text-[9px] text-[var(--text-dim)]">
                {Math.round(d.windGustMax)} mph
              </span>
            </div>
          ))}
        </div>
      )}

      {days && days.length === 0 && !loading && (
        <div className="text-[10px] text-[var(--text-dim)]">Forecast unavailable</div>
      )}
    </div>
  );
}
