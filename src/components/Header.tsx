"use client";

import { useState, type FormEvent } from "react";
import { useLeadStore } from "@/stores/leadStore";
import { useAgentStore } from "@/stores/agentStore";
import type { Property } from "@/types";

function haversineDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function nearestProperty(
  lat: number,
  lng: number,
  properties: Property[],
): Property | null {
  if (properties.length === 0) return null;
  let best: Property = properties[0];
  let bestDist = haversineDistance(lat, lng, best.lat, best.lng);
  for (let i = 1; i < properties.length; i++) {
    const p = properties[i];
    const d = haversineDistance(lat, lng, p.lat, p.lng);
    if (d < bestDist) {
      bestDist = d;
      best = p;
    }
  }
  return best;
}

function fuzzyMatchProperty(
  query: string,
  properties: Property[],
): Property | null {
  const q = query.trim().toLowerCase();
  if (!q) return null;
  const tokens = q.split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return null;

  let best: Property | null = null;
  let bestScore = 0;
  let bestLen = Number.POSITIVE_INFINITY;

  for (const p of properties) {
    const combined = `${p.address} ${p.neighborhood}`.toLowerCase();
    let score = 0;
    for (const t of tokens) {
      if (combined.includes(t)) score++;
    }
    if (score === 0) continue;
    if (
      score > bestScore ||
      (score === bestScore && p.address.length < bestLen)
    ) {
      best = p;
      bestScore = score;
      bestLen = p.address.length;
    }
  }
  return best;
}

interface GeocodeResponse {
  results?: Array<{
    geometry?: { location?: { lat: number; lng: number } };
  }>;
  status?: string;
}

export function Header() {
  const properties = useLeadStore((s) => s.properties);
  const selectedCount = useLeadStore((s) => s.selectedIds.size);
  const setActiveProperty = useLeadStore((s) => s.setActiveProperty);
  const setFlyTo = useLeadStore((s) => s.setFlyTo);
  const spend = useAgentStore((s) =>
    s.traces.reduce((sum, t) => sum + (t.costUsd ?? 0), 0),
  );

  const [query, setQuery] = useState("");
  const [error, setError] = useState<string | null>(null);

  function showError(msg: string) {
    setError(msg);
    setTimeout(() => setError((curr) => (curr === msg ? null : curr)), 3000);
  }

  function activate(p: Property) {
    setActiveProperty(p.id);
    setFlyTo({ lng: p.lng, lat: p.lat, zoom: 15, id: p.id });
  }

  async function handleSearch(e?: FormEvent) {
    e?.preventDefault();
    const q = query.trim();
    if (!q) return;

    const key = process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY;
    if (key) {
      try {
        const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(
          q + ", Boston, MA",
        )}&key=${key}`;
        const res = await fetch(url);
        const data = (await res.json()) as GeocodeResponse;
        const loc = data.results?.[0]?.geometry?.location;
        if (loc) {
          const nearest = nearestProperty(loc.lat, loc.lng, properties);
          if (nearest) {
            activate(nearest);
            return;
          }
        }
        showError("No matching property found");
        return;
      } catch {
        // fall through to fuzzy match on error
      }
    }

    const match = fuzzyMatchProperty(q, properties);
    if (match) {
      activate(match);
      return;
    }
    showError("No matching property found");
  }

  return (
    <header className="sticky top-0 z-50 h-14 border-b border-[var(--border)] bg-[var(--panel)]/90 backdrop-blur">
      <style jsx global>{`
        @keyframes spendflash {
          0% {
            color: #22c55e;
          }
          100% {
            color: inherit;
          }
        }
      `}</style>
      <div className="flex h-full items-center justify-between px-4">
        {/* Left: logo + brand */}
        <div className="flex items-center gap-3">
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            aria-hidden="true"
          >
            <path d="M12 2L4 16h16L12 2z" fill="#22c55e" />
            <rect x="10" y="16" width="4" height="5" fill="#22c55e" />
          </svg>
          <span className="font-display text-base font-bold text-[var(--text)]">
            TreeMap
          </span>
        </div>

        {/* Center: search */}
        <form
          onSubmit={handleSearch}
          className="relative mx-4 w-full max-w-[480px]"
        >
          <div className="relative">
            <svg
              className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--text-dim)]"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              onClick={() => handleSearch()}
              role="button"
              aria-label="Search"
            >
              <circle cx="11" cy="11" r="7" />
              <path d="M21 21l-4.3-4.3" />
            </svg>
            <input
              type="text"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                if (error) setError(null);
              }}
              placeholder="Search Boston address (e.g. 14 Centre St, Jamaica Plain)"
              className="h-9 w-full rounded-md border border-[var(--border)] bg-[var(--panel-2)] pl-8 pr-3 text-sm text-[var(--text)] placeholder:text-[var(--text-muted)] focus:border-[var(--accent)] focus:outline-none"
            />
          </div>
          {error && (
            <p className="absolute left-0 top-full mt-1 text-xs text-[var(--accent-red)]">
              {error}
            </p>
          )}
        </form>

        {/* Right: stat chips */}
        <div className="flex items-center gap-2">
          <div
            className={`flex w-24 flex-col items-center rounded bg-[var(--panel-2)] px-3 py-1 ${
              spend === 0 ? "opacity-60" : ""
            }`}
          >
            <span className="text-[10px] uppercase tracking-wide text-[var(--text-dim)]">
              AI Spend
            </span>
            <span
              key={spend}
              className="font-mono text-sm font-bold text-[var(--text)] animate-[spendflash_700ms_ease-out]"
            >
              ${spend.toFixed(4)}
            </span>
          </div>
          <StatChip label="Selected" value={selectedCount} />
        </div>
      </div>
    </header>
  );
}

interface StatChipProps {
  label: string;
  value: number;
}

function StatChip({ label, value }: StatChipProps) {
  return (
    <div className="flex w-20 flex-col items-center rounded bg-[var(--panel-2)] px-3 py-1">
      <span className="text-[10px] uppercase tracking-wide text-[var(--text-dim)]">
        {label}
      </span>
      <span className="text-sm font-bold text-[var(--text)]">{value}</span>
    </div>
  );
}
