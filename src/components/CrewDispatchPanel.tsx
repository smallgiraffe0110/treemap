"use client";

import { useMemo } from "react";
import { CREWS, useCrewStore, type CrewId } from "@/stores/crewStore";
import { useLeadStore } from "@/stores/leadStore";
import type { Property } from "@/types";

const HEADER_OFFSET_PX = 56;
const PANEL_WIDTH_PX = 420;

function routeMiles(props: Property[]): number {
  if (props.length < 2) return 0;
  let total = 0;
  for (let i = 1; i < props.length; i++) {
    const dLat = props[i].lat - props[i - 1].lat;
    const dLng = props[i].lng - props[i - 1].lng;
    total += Math.sqrt(dLat * dLat + dLng * dLng) * 69;
  }
  return total;
}

function urgencyBadge(score: number): { label: string; cls: string } {
  if (score >= 80) return { label: "HOT", cls: "bg-[var(--accent-red)]/20 text-[var(--accent-red)] border-[var(--accent-red)]/40" };
  if (score >= 60) return { label: "WARM", cls: "bg-[var(--accent-amber)]/20 text-[var(--accent-amber)] border-[var(--accent-amber)]/40" };
  return { label: "COOL", cls: "bg-[var(--text-muted)]/20 text-[var(--text-dim)] border-[var(--text-muted)]/40" };
}

export function CrewDispatchPanel() {
  const panelOpen = useCrewStore((s) => s.panelOpen);
  const togglePanel = useCrewStore((s) => s.togglePanel);
  const setPanelOpen = useCrewStore((s) => s.setPanelOpen);
  const assignments = useCrewStore((s) => s.assignments);
  const assign = useCrewStore((s) => s.assign);
  const unassign = useCrewStore((s) => s.unassign);
  const clearAll = useCrewStore((s) => s.clear);
  const autoAssignSelected = useCrewStore((s) => s.autoAssignSelected);

  const properties = useLeadStore((s) => s.properties);

  const propertyById = useMemo(() => {
    const m = new Map<string, Property>();
    for (const p of properties) m.set(p.id, p);
    return m;
  }, [properties]);

  const byCrew = useMemo(() => {
    const map: Record<CrewId, Property[]> = { "truck-1": [], "truck-2": [], "truck-3": [] };
    for (const [propId, crewId] of Object.entries(assignments)) {
      const prop = propertyById.get(propId);
      if (prop) map[crewId].push(prop);
    }
    return map;
  }, [assignments, propertyById]);

  const totalAssigned = Object.keys(assignments).length;

  const handleAutoAssign = () => {
    const selected = Array.from(useLeadStore.getState().selectedIds);
    if (selected.length === 0) return;
    autoAssignSelected(selected);
  };

  return (
    <>
      {/* Edge trigger button (only when closed) */}
      {!panelOpen && (
        <button
          onClick={togglePanel}
          title="Open Crew Dispatch"
          style={{ top: "50%", transform: "translateY(-50%)" }}
          className="fixed right-0 z-30 w-[12px] h-[80px] bg-[var(--panel)] border border-r-0 border-[var(--border)] hover:bg-[var(--panel-2)] hover:border-[var(--accent)] transition-colors rounded-l-md flex items-center justify-center group"
        >
          <span className="text-[10px] font-semibold tracking-[0.18em] text-[var(--text-dim)] group-hover:text-[var(--accent)] [writing-mode:vertical-rl] rotate-180 select-none">
            DISPATCH
          </span>
        </button>
      )}

      {/* Sliding panel */}
      <aside
        aria-hidden={!panelOpen}
        style={{
          top: `${HEADER_OFFSET_PX}px`,
          width: `${PANEL_WIDTH_PX}px`,
          transform: panelOpen ? "translateX(0)" : `translateX(${PANEL_WIDTH_PX}px)`,
        }}
        className="fixed right-0 bottom-0 z-30 bg-[var(--panel)] border-l border-[var(--border)] flex flex-col transition-transform duration-300 ease-out shadow-2xl"
      >
        {/* Header */}
        <div className="flex items-start justify-between px-4 py-3 border-b border-[var(--border)]">
          <div>
            <h2 className="text-base font-semibold text-[var(--text)]">Crew Dispatch</h2>
            <p className="text-xs text-[var(--text-dim)] mt-0.5">
              {totalAssigned} {totalAssigned === 1 ? "property" : "properties"} assigned across 3 crews
            </p>
          </div>
          <button
            onClick={() => setPanelOpen(false)}
            aria-label="Close panel"
            className="text-[var(--text-dim)] hover:text-[var(--text)] text-xl leading-none px-2"
          >
            ×
          </button>
        </div>

        {/* Action row */}
        <div className="flex gap-2 px-4 py-3 border-b border-[var(--border)]">
          <button
            onClick={handleAutoAssign}
            className="flex-1 text-xs font-medium px-3 py-2 rounded-md bg-[var(--accent)]/15 text-[var(--accent)] border border-[var(--accent)]/40 hover:bg-[var(--accent)]/25 transition-colors"
          >
            Auto-assign selected leads
          </button>
          <button
            onClick={clearAll}
            disabled={totalAssigned === 0}
            className="text-xs font-medium px-3 py-2 rounded-md bg-[var(--panel-2)] text-[var(--text-secondary)] border border-[var(--border)] hover:border-[var(--accent-red)] hover:text-[var(--accent-red)] transition-colors disabled:opacity-40 disabled:hover:border-[var(--border)] disabled:hover:text-[var(--text-secondary)]"
          >
            Clear all
          </button>
        </div>

        <p className="px-4 py-2 text-[11px] text-[var(--text-muted)] border-b border-[var(--border)] leading-relaxed">
          Drag properties from the map or selection list here — or use Auto-assign. Click T1/T2/T3 on any card to swap crews.
        </p>

        {/* Crew sections */}
        <div className="flex-1 overflow-y-auto">
          {CREWS.map((crew) => {
            const list = byCrew[crew.id];
            const miles = routeMiles(list);
            return (
              <section key={crew.id} className="border-b border-[var(--border)]">
                <header
                  className="flex items-center justify-between px-4 py-2.5 sticky top-0 z-10 bg-[var(--panel-2)] border-b border-[var(--border)]"
                  style={{ borderLeft: `3px solid ${crew.color}` }}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: crew.color }} />
                    <span className="text-sm font-medium text-[var(--text)] truncate">{crew.name}</span>
                  </div>
                  <div className="flex items-center gap-2 text-[11px] text-[var(--text-dim)] flex-shrink-0">
                    <span>{list.length} {list.length === 1 ? "stop" : "stops"}</span>
                    <span className="text-[var(--text-muted)]">·</span>
                    <span>~{miles.toFixed(1)} mi</span>
                  </div>
                </header>

                <div className="px-3 py-2 min-h-[60px] flex flex-col gap-1.5">
                  {list.length === 0 ? (
                    <p className="text-[11px] text-[var(--text-muted)] italic text-center py-3">
                      No properties assigned
                    </p>
                  ) : (
                    list.map((p) => {
                      const badge = urgencyBadge(p.urgencyScore);
                      return (
                        <div
                          key={p.id}
                          className="rounded-md bg-[var(--panel-2)] border-l-2 border border-[var(--border)] px-2.5 py-2"
                          style={{ borderLeftColor: crew.color }}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0 flex-1">
                              <p className="text-xs font-medium text-[var(--text)] truncate">{p.address}</p>
                              <p className="text-[10px] text-[var(--text-dim)] truncate">{p.neighborhood}</p>
                            </div>
                            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border ${badge.cls} flex-shrink-0`}>
                              {badge.label}
                            </span>
                            <button
                              onClick={() => unassign(p.id)}
                              aria-label={`Unassign ${p.address}`}
                              className="text-[var(--text-muted)] hover:text-[var(--accent-red)] text-sm leading-none flex-shrink-0"
                            >
                              ×
                            </button>
                          </div>
                          <div className="flex gap-1 mt-1.5">
                            {CREWS.map((c, idx) => {
                              const active = c.id === crew.id;
                              return (
                                <button
                                  key={c.id}
                                  onClick={() => assign(p.id, c.id)}
                                  title={c.name}
                                  className="text-[10px] font-semibold flex-1 py-1 rounded border transition-colors"
                                  style={{
                                    borderColor: active ? c.color : "var(--border)",
                                    color: active ? c.color : "var(--text-dim)",
                                    background: active ? `${c.color}22` : "transparent",
                                  }}
                                >
                                  T{idx + 1}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </section>
            );
          })}
        </div>
      </aside>
    </>
  );
}
