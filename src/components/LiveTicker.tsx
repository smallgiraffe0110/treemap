"use client";

import { useMemo } from "react";
import { useAgentStore } from "@/stores/agentStore";
import type { AgentTrace } from "@/types";

type TickerItem = {
  key: string;
  tag: "AGENT" | "STORM" | "LEAD" | "MAP";
  text: string;
  color: string;
  time?: string;
};

const TAG_COLORS: Record<TickerItem["tag"], string> = {
  AGENT: "#a855f7",
  STORM: "#ef4444",
  LEAD: "#22c55e",
  MAP: "#3b82f6",
};

const STATIC_ITEMS: ReadonlyArray<Omit<TickerItem, "key">> = [
  { tag: "STORM", text: "Tree Destroyer · Suffolk · 78mph gusts recorded 03:42 EDT", color: "#ef4444" },
  { tag: "STORM", text: "NWS Severe Thunderstorm Warning · Norfolk County · valid until 11pm", color: "#ef4444" },
  { tag: "LEAD", text: "34 hot leads identified within service area", color: "#22c55e" },
  { tag: "MAP", text: "NEXRAD radar refreshed · 5 min cadence", color: "#3b82f6" },
  { tag: "STORM", text: "FEMA disaster declarations · 23 active for Massachusetts", color: "#ef4444" },
  { tag: "LEAD", text: "Estimated route revenue: $12,400 · 30-mile radius", color: "#22c55e" },
  { tag: "AGENT", text: "All agents healthy · Gemini 2.5 Flash · 184ms p50", color: "#a855f7" },
];

function formatHHMM(epochMs: number): string {
  const d = new Date(epochMs);
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
}

function traceToItem(t: AgentTrace): TickerItem {
  const dotColor =
    t.status === "success" ? "#22c55e" : t.status === "error" ? "#ef4444" : "#f59e0b";
  const raw = `${t.agent.toUpperCase()} ${t.op} → ${t.outputSummary ?? t.inputSummary}`;
  const text = raw.length > 80 ? `${raw.slice(0, 77)}...` : raw;
  return {
    key: `trace-${t.id}`,
    tag: "AGENT",
    text,
    color: dotColor,
    time: formatHHMM(t.startedAt),
  };
}

function interleave(traces: TickerItem[], statics: TickerItem[]): TickerItem[] {
  if (traces.length === 0) return statics;
  const out: TickerItem[] = [];
  const max = Math.max(traces.length, statics.length);
  for (let i = 0; i < max; i++) {
    if (i < traces.length) out.push(traces[i]);
    if (i < statics.length) out.push(statics[i]);
  }
  return out;
}

export function LiveTicker() {
  const traces = useAgentStore((s) => s.traces);

  const items = useMemo<TickerItem[]>(() => {
    const traceItems = traces.map(traceToItem);
    const staticItems: TickerItem[] = STATIC_ITEMS.map((it, i) => ({
      ...it,
      key: `static-${i}`,
    }));
    return interleave(traceItems, staticItems);
  }, [traces]);

  const doubled = useMemo(
    () => [
      ...items.map((it) => ({ ...it, key: `${it.key}-a` })),
      ...items.map((it) => ({ ...it, key: `${it.key}-b` })),
    ],
    [items]
  );

  return (
    <div className="pointer-events-auto absolute bottom-3 left-1/2 -translate-x-1/2 z-10 h-7 w-[min(720px,calc(100%-1.5rem))] overflow-hidden rounded-full border border-white/10 bg-black/75 backdrop-blur">
      <style jsx global>{`
        @keyframes marquee {
          from { transform: translateX(0); }
          to { transform: translateX(-50%); }
        }
        @keyframes tdot {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
      `}</style>
      <div className="flex h-full items-center [animation:marquee_35s_linear_infinite] hover:[animation-play-state:paused] whitespace-nowrap inline-flex gap-6 pl-6">
        {doubled.map((it) => (
          <div key={it.key} className="flex items-center gap-2 text-[11px] leading-none text-white/90">
            <span
              aria-hidden
              className="inline-block h-1.5 w-1.5 rounded-full [animation:tdot_1.6s_ease-in-out_infinite]"
              style={{ backgroundColor: it.color }}
            />
            {it.time && (
              <span className="font-mono text-white/50 tabular-nums">{it.time}</span>
            )}
            <span
              className="rounded px-1.5 py-0.5 text-[9px] font-semibold tracking-wider"
              style={{ backgroundColor: `${TAG_COLORS[it.tag]}33`, color: TAG_COLORS[it.tag] }}
            >
              {it.tag}
            </span>
            <span className="text-white/85">{it.text}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
