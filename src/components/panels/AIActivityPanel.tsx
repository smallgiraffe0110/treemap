"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useAgentStore } from "@/stores/agentStore";
import type { AgentName, AgentTrace } from "@/types";

const AGENT_COLORS: Record<AgentName, string> = {
  canopy: "var(--accent)",
  outreach: "#3b82f6",
  impact: "var(--accent-amber)",
  notify: "#a855f7",
  voice: "#a855f7",
};

const TIME_FMT = new Intl.DateTimeFormat("en-US", {
  hour12: false,
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
});

function formatTime(ts: number): string {
  return TIME_FMT.format(new Date(ts));
}

function formatDuration(ms: number | undefined): string {
  if (ms === undefined) return "—";
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

function formatTokens(n: number | undefined): string {
  if (n === undefined) return "";
  if (n < 1000) return `${n} tok`;
  return `${(n / 1000).toFixed(1)}k tok`;
}

function formatCost(c: number | undefined): string {
  if (c === undefined) return "";
  if (c < 0.001) return `$${c.toFixed(5)}`;
  return `$${c.toFixed(4)}`;
}

function StatusDot({ status }: { status: AgentTrace["status"] }) {
  if (status === "running") {
    return (
      <span className="relative inline-flex h-2 w-2 shrink-0" aria-label="running">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[var(--accent-amber)] opacity-75" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-[var(--accent-amber)]" />
      </span>
    );
  }
  if (status === "error") {
    return <span className="inline-block h-2 w-2 shrink-0 rounded-full bg-[var(--accent-red)]" aria-label="error" />;
  }
  return <span className="inline-block h-2 w-2 shrink-0 rounded-full bg-[var(--accent)]" aria-label="success" />;
}

function StatusGlyph({ status }: { status: AgentTrace["status"] }) {
  if (status === "running") return <span className="text-[var(--accent-amber)]">⏳</span>;
  if (status === "error") return <span className="text-[var(--accent-red)]">✗</span>;
  return <span className="text-[var(--accent)]">✓</span>;
}

function mergeTraces(local: AgentTrace[], server: AgentTrace[]): AgentTrace[] {
  const map = new Map<string, AgentTrace>();
  for (const t of local) map.set(t.id, t);
  for (const t of server) map.set(t.id, t); // server wins on overlap
  return Array.from(map.values()).sort((a, b) => b.startedAt - a.startedAt);
}

export function AIActivityPanel() {
  const localTraces = useAgentStore((s) => s.traces);
  const [serverTraces, setServerTraces] = useState<AgentTrace[]>([]);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function fetchTraces() {
      if (typeof document !== "undefined" && document.hidden) return;
      abortRef.current?.abort();
      const ctrl = new AbortController();
      abortRef.current = ctrl;
      try {
        const res = await fetch("/api/agents/traces", { signal: ctrl.signal });
        if (!res.ok) return;
        const data: { traces?: AgentTrace[] } = await res.json();
        if (!cancelled) setServerTraces(data.traces ?? []);
      } catch {
        // ignore abort + transient errors
      }
    }

    fetchTraces();
    intervalRef.current = setInterval(fetchTraces, 1500);

    function onVisibility() {
      if (!document.hidden) fetchTraces();
    }
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      cancelled = true;
      if (intervalRef.current) clearInterval(intervalRef.current);
      abortRef.current?.abort();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  const traces = useMemo(() => mergeTraces(localTraces, serverTraces), [localTraces, serverTraces]);

  const counts = useMemo(() => {
    const c: Record<AgentName, number> = { canopy: 0, outreach: 0, impact: 0, notify: 0, voice: 0 };
    for (const t of traces) c[t.agent]++;
    return c;
  }, [traces]);

  return (
    <aside className="relative flex h-full flex-col overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--panel)]">
      <div className="absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-[var(--accent)] via-[#3b82f6] to-[#a855f7]" />

      <div className="border-b border-[var(--border)] px-4 pb-3 pt-4">
        <div className="flex items-baseline justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="relative inline-flex h-2 w-2" aria-hidden="true">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[var(--accent)] opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-[var(--accent)]" />
            </span>
            <h2 className="font-display text-base text-[var(--text)]">AI Activity</h2>
          </div>
          <button
            type="button"
            onClick={() => useAgentStore.getState().clear()}
            className="rounded px-2 py-1 text-[10px] uppercase tracking-wider text-[var(--text-dim)] transition hover:bg-[var(--panel-2)] hover:text-[var(--text)]"
          >
            Clear
          </button>
        </div>
        <p className="mt-1.5 font-mono text-[10px] text-[var(--text-dim)]">
          <span style={{ color: AGENT_COLORS.canopy }}>{counts.canopy} canopy</span>
          <span className="mx-1">·</span>
          <span style={{ color: AGENT_COLORS.outreach }}>{counts.outreach} outreach</span>
          <span className="mx-1">·</span>
          <span style={{ color: AGENT_COLORS.impact }}>{counts.impact} impact</span>
          <span className="mx-1">·</span>
          <span style={{ color: AGENT_COLORS.notify }}>{counts.notify} notify</span>
        </p>
      </div>

      <div className="flex-1 overflow-y-auto">
        {traces.length === 0 ? (
          <div className="p-6 text-center text-xs text-[var(--text-dim)]">
            No agent activity yet — try &lsquo;✨ Generate outreach&rsquo; on a property.
          </div>
        ) : (
          <ul className="divide-y divide-[var(--border)]">
            {traces.map((t) => {
              const color = AGENT_COLORS[t.agent];
              return (
                <li key={t.id} className="px-4 py-2.5 transition hover:bg-[var(--panel-2)]">
                  <div className="flex items-center gap-2 text-[11px]">
                    <StatusDot status={t.status} />
                    <span className="font-mono text-[10px] text-[var(--text-dim)]">{formatTime(t.startedAt)}</span>
                    <span
                      className="font-mono text-[10px] font-semibold uppercase tracking-wider"
                      style={{ color }}
                    >
                      {t.agent}
                    </span>
                    <span className="font-mono text-[10px] text-[var(--text-secondary)]">{t.op}</span>
                    <span className="font-mono text-[10px] text-[var(--text-dim)]">{formatDuration(t.durationMs)}</span>
                    <span className="ml-auto text-[11px]">
                      <StatusGlyph status={t.status} />
                    </span>
                  </div>
                  <div className="mt-1 pl-4 text-[11px] text-[var(--text-secondary)]">
                    <span className="text-[var(--text-dim)]">&ldquo;{t.inputSummary}&rdquo;</span>
                    {t.outputSummary && (
                      <>
                        <span className="mx-1 text-[var(--text-dim)]">→</span>
                        <span className="text-[var(--text)]">&ldquo;{t.outputSummary}&rdquo;</span>
                      </>
                    )}
                    {t.error && (
                      <span className="ml-1 text-[var(--accent-red)]">{t.error}</span>
                    )}
                  </div>
                  {(t.tokensIn !== undefined || t.tokensOut !== undefined || t.costUsd !== undefined || t.weaveUrl) && (
                    <div className="mt-1 flex items-center gap-2 pl-4 font-mono text-[10px] text-[var(--text-dim)]">
                      {t.tokensIn !== undefined && <span>{formatTokens(t.tokensIn)} in</span>}
                      {t.tokensOut !== undefined && <span>{formatTokens(t.tokensOut)} out</span>}
                      {t.costUsd !== undefined && <span>{formatCost(t.costUsd)}</span>}
                      {t.model && <span className="text-[var(--text-secondary)]">{t.model}</span>}
                      {t.weaveUrl && (
                        <a
                          href={t.weaveUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="ml-auto text-[var(--accent)] hover:underline"
                        >
                          view trace ↗
                        </a>
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </aside>
  );
}
