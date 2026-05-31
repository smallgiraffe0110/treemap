"use client";

import { useWeatherStore } from "@/stores/weatherStore";

interface PillProps {
  label: string;
  active: boolean;
  onClick: () => void;
  badge?: number;
}

function Pill({ label, active, onClick, badge }: PillProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex h-[26px] w-[90px] items-center justify-center gap-1 rounded-md bg-black/60 text-[10px] font-semibold uppercase tracking-wider backdrop-blur transition-colors ${
        active
          ? "border border-white/80 text-white"
          : "border border-white/15 text-white/45 hover:border-white/30 hover:text-white/70"
      }`}
      aria-pressed={active}
    >
      <span className="truncate">{label}</span>
      {badge !== undefined && badge > 0 && (
        <span className="ml-0.5 rounded-sm bg-[var(--accent-red)] px-1 text-[9px] font-bold text-white">
          {badge}
        </span>
      )}
    </button>
  );
}

export function WeatherControls() {
  const showRadar = useWeatherStore((s) => s.showRadar);
  const showAlerts = useWeatherStore((s) => s.showAlerts);
  const showServiceArea = useWeatherStore((s) => s.showServiceArea);
  const showNdviHeat = useWeatherStore((s) => s.showNdviHeat);
  const alerts = useWeatherStore((s) => s.alerts);
  const toggleRadar = useWeatherStore((s) => s.toggleRadar);
  const toggleAlerts = useWeatherStore((s) => s.toggleAlerts);
  const toggleServiceArea = useWeatherStore((s) => s.toggleServiceArea);
  const toggleNdviHeat = useWeatherStore((s) => s.toggleNdviHeat);

  return (
    <div className="pointer-events-none absolute right-12 top-3 z-10 flex flex-col items-end gap-1.5">
      {showRadar && (
        <div className="pointer-events-auto flex h-[20px] w-[90px] items-center justify-center gap-1.5 rounded-md bg-black/60 text-[9px] font-bold uppercase tracking-wider text-white/90 backdrop-blur">
          <span className="relative flex h-1.5 w-1.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[var(--accent)] opacity-75" />
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-[var(--accent)]" />
          </span>
          <span>LIVE</span>
        </div>
      )}
      <div className="pointer-events-auto flex flex-col gap-1.5">
        <Pill label="Radar" active={showRadar} onClick={toggleRadar} />
        <Pill
          label="NWS Alerts"
          active={showAlerts}
          onClick={toggleAlerts}
          badge={alerts.length}
        />
        <Pill label="Service Area" active={showServiceArea} onClick={toggleServiceArea} />
        <Pill label="NDVI Heat" active={showNdviHeat} onClick={toggleNdviHeat} />
      </div>
    </div>
  );
}
