"use client";

import { useMemo, useState } from "react";
import { useLeadStore } from "@/stores/leadStore";
import { NEIGHBORHOODS } from "@/types";
import type { Property } from "@/types";

function urgencyTone(score: number): { color: string; label: string } {
  if (score >= 70) return { color: "var(--accent-red)", label: "HOT" };
  if (score >= 40) return { color: "var(--accent-amber)", label: "WARM" };
  return { color: "var(--accent)", label: "COOL" };
}

export function PriorityLeadsPanel() {
  const properties = useLeadStore((s) => s.properties);
  const selectedIds = useLeadStore((s) => s.selectedIds);
  const activePropertyId = useLeadStore((s) => s.activePropertyId);
  const filterNeighborhood = useLeadStore((s) => s.filterNeighborhood);
  const filterMinUrgency = useLeadStore((s) => s.filterMinUrgency);
  const toggleSelected = useLeadStore((s) => s.toggleSelected);
  const selectAllHot = useLeadStore((s) => s.selectAllHot);
  const clearSelection = useLeadStore((s) => s.clearSelection);
  const setFilter = useLeadStore((s) => s.setFilter);
  const setActiveProperty = useLeadStore((s) => s.setActiveProperty);
  const setFlyTo = useLeadStore((s) => s.setFlyTo);

  const [showAll, setShowAll] = useState(false);

  const hotCount = useMemo(
    () => properties.filter((p) => p.urgencyScore > 70).length,
    [properties],
  );

  const ranked: Property[] = useMemo(() => {
    return properties
      .filter((p) => (filterNeighborhood ? p.neighborhood === filterNeighborhood : true))
      .filter((p) => p.urgencyScore >= filterMinUrgency)
      .sort((a, b) => b.urgencyScore - a.urgencyScore)
      .slice(0, 25);
  }, [properties, filterNeighborhood, filterMinUrgency]);

  const visible = showAll ? ranked : ranked.slice(0, 10);

  return (
    <section className="relative flex h-full flex-col overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--panel)]">
      <div className="absolute inset-x-0 top-0 h-[2px] bg-[var(--accent-amber)]" />

      <div className="border-b border-[var(--border)] px-4 pb-3 pt-4">
        <div className="flex items-baseline justify-between">
          <h2 className="font-display text-base text-[var(--text)]">Priority Leads</h2>
          <div className="flex items-center gap-3 text-[10px] uppercase tracking-wider text-[var(--text-dim)]">
            <span>
              <span className="font-mono text-[var(--text-secondary)]">{selectedIds.size}</span> selected
            </span>
            <span>
              <span className="font-mono text-[var(--accent-red)]">{hotCount}</span> hot
            </span>
          </div>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2">
          <label className="flex flex-col gap-1">
            <span className="text-[10px] uppercase tracking-wider text-[var(--text-dim)]">Neighborhood</span>
            <select
              value={filterNeighborhood ?? ""}
              onChange={(e) => setFilter(e.target.value || null, filterMinUrgency)}
              className="rounded border border-[var(--border)] bg-[var(--panel-2)] px-2 py-1.5 text-xs text-[var(--text)] focus:border-[var(--border-hi)] focus:outline-none"
            >
              <option value="">All</option>
              {NEIGHBORHOODS.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className="flex items-center justify-between text-[10px] uppercase tracking-wider text-[var(--text-dim)]">
              <span>Min urgency</span>
              <span className="font-mono text-[var(--text-secondary)]">{filterMinUrgency}</span>
            </span>
            <input
              type="range"
              min={0}
              max={100}
              value={filterMinUrgency}
              onChange={(e) => setFilter(filterNeighborhood, Number(e.target.value))}
              className="h-7 accent-[var(--accent)]"
            />
          </label>
        </div>

        <div className="mt-3 flex items-center gap-2">
          <button
            type="button"
            onClick={selectAllHot}
            className="rounded border border-[var(--accent-red)] bg-[var(--accent-red)]/10 px-2 py-1 text-[10px] font-medium uppercase tracking-wider text-[var(--accent-red)] transition hover:bg-[var(--accent-red)]/20"
          >
            Select all hot leads
          </button>
          <button
            type="button"
            onClick={clearSelection}
            className="rounded border border-[var(--border)] px-2 py-1 text-[10px] font-medium uppercase tracking-wider text-[var(--text-dim)] transition hover:bg-[var(--panel-2)] hover:text-[var(--text)]"
          >
            Clear
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {ranked.length === 0 ? (
          <div className="p-6 text-center text-xs text-[var(--text-dim)]">No leads match the current filter.</div>
        ) : (
          <ul className="divide-y divide-[var(--border)]">
            {visible.map((p) => {
              const tone = urgencyTone(p.urgencyScore);
              const checked = selectedIds.has(p.id);
              const isActive = activePropertyId === p.id;
              return (
                <li
                  key={p.id}
                  onClick={() => {
                    setActiveProperty(p.id);
                    setFlyTo({ lng: p.lng, lat: p.lat, zoom: 14, id: p.id });
                  }}
                  className={`relative flex cursor-pointer items-center gap-3 px-4 py-2.5 transition hover:bg-[var(--panel-2)] ${
                    isActive ? "bg-[var(--panel-2)]" : ""
                  }`}
                >
                  {isActive && (
                    <span className="absolute inset-y-0 left-0 w-[2px] bg-[var(--accent)]" aria-hidden="true" />
                  )}
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleSelected(p.id)}
                    onClick={(e) => e.stopPropagation()}
                    className="h-3.5 w-3.5 accent-[var(--accent)]"
                    aria-label={`Select ${p.address}`}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-xs text-[var(--text)]">{p.address}</div>
                    <div className="truncate text-[10px] text-[var(--text-dim)]">{p.neighborhood}</div>
                  </div>
                  <span
                    className="font-mono rounded px-1.5 py-0.5 text-[10px] font-semibold"
                    style={{ background: `${tone.color}22`, color: tone.color }}
                  >
                    {p.urgencyScore}
                  </span>
                </li>
              );
            })}
          </ul>
        )}

        {ranked.length > 10 && (
          <button
            type="button"
            onClick={() => setShowAll((v) => !v)}
            className="w-full border-t border-[var(--border)] px-4 py-2 text-[10px] uppercase tracking-wider text-[var(--text-dim)] transition hover:bg-[var(--panel-2)] hover:text-[var(--text)]"
          >
            {showAll ? "Show top 10" : `Show all (${ranked.length})`}
          </button>
        )}
      </div>
    </section>
  );
}
