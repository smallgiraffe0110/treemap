"use client";

import { useEffect, useRef, useState } from "react";
import { useAlertStore } from "@/stores/alertStore";
import { useLeadStore } from "@/stores/leadStore";
import type { FemaDeclaration, NotifyResult } from "@/types";

const DATE_FMT = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
});

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return DATE_FMT.format(d);
}

type ToastState =
  | { kind: "success"; sent: number; previewed: number }
  | { kind: "error"; message: string };

export function StormAlertsPanel() {
  const femaDeclarations = useAlertStore((s) => s.femaDeclarations);
  const activeCountyFilter = useAlertStore((s) => s.activeCountyFilter);
  const loading = useAlertStore((s) => s.loading);
  const error = useAlertStore((s) => s.error);
  const setDeclarations = useAlertStore((s) => s.setDeclarations);
  const setCountyFilter = useAlertStore((s) => s.setCountyFilter);
  const setLoading = useAlertStore((s) => s.setLoading);
  const setError = useAlertStore((s) => s.setError);

  const setFlyTo = useLeadStore((s) => s.setFlyTo);

  const [notifyingId, setNotifyingId] = useState<string | null>(null);
  const [toasts, setToasts] = useState<Record<string, ToastState>>({});
  const timersRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch("/api/fema");
        if (!res.ok) throw new Error(`FEMA fetch failed: ${res.status}`);
        const data: { declarations: FemaDeclaration[] } = await res.json();
        if (!cancelled) setDeclarations(data.declarations ?? []);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load alerts");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [setDeclarations, setLoading, setError]);

  useEffect(() => {
    const timers = timersRef.current;
    return () => {
      for (const id of Object.keys(timers)) clearTimeout(timers[id]);
    };
  }, []);

  function scheduleClearToast(id: string) {
    if (timersRef.current[id]) clearTimeout(timersRef.current[id]);
    timersRef.current[id] = setTimeout(() => {
      setToasts((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
      delete timersRef.current[id];
    }, 5000);
  }

  async function handleNotify(decl: FemaDeclaration) {
    const ok = window.confirm(
      `Send notifications to all owners in ${decl.designatedArea}? Preview mode unless ENABLE_REAL_EMAIL=1.`,
    );
    if (!ok) return;
    setNotifyingId(decl.id);
    try {
      const res = await fetch("/api/agents/notify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ declarationId: decl.id }),
      });
      if (!res.ok) throw new Error(`Notify failed: ${res.status}`);
      const data: { traceId: string; result: NotifyResult } = await res.json();
      setToasts((prev) => ({
        ...prev,
        [decl.id]: { kind: "success", sent: data.result.sent, previewed: data.result.previewed },
      }));
      scheduleClearToast(decl.id);
    } catch (e) {
      setToasts((prev) => ({
        ...prev,
        [decl.id]: { kind: "error", message: e instanceof Error ? e.message : "Notify failed" },
      }));
      scheduleClearToast(decl.id);
    } finally {
      setNotifyingId(null);
    }
  }

  return (
    <section className="relative flex h-full flex-col overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--panel)]">
      <div className="absolute inset-x-0 top-0 h-[2px] bg-[var(--accent-red)]" />

      <div className="border-b border-[var(--border)] px-4 pb-3 pt-4">
        <div className="flex items-baseline justify-between">
          <div className="flex items-center gap-2">
            <h2 className="font-display text-base text-[var(--text)]">Storm Alerts</h2>
            <span className="rounded border border-[var(--accent-red)] bg-[var(--accent-red)]/10 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-[var(--accent-red)]">
              FEMA
            </span>
          </div>
          <span className="font-mono text-[10px] text-[var(--text-dim)]">
            {loading ? "loading…" : `${femaDeclarations.length}`}
          </span>
        </div>
        {activeCountyFilter && (
          <button
            type="button"
            onClick={() => setCountyFilter(null)}
            className="mt-2 text-[10px] uppercase tracking-wider text-[var(--accent-amber)] hover:underline"
          >
            Clear filter: {activeCountyFilter} ×
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto">
        {error && (
          <div className="m-3 rounded border border-[var(--accent-red)] bg-[var(--accent-red)]/10 px-3 py-2 text-xs text-[var(--accent-red)]">
            {error}
          </div>
        )}
        {!loading && !error && femaDeclarations.length === 0 && (
          <div className="p-6 text-center text-xs text-[var(--text-dim)]">No active declarations</div>
        )}
        <ul className="divide-y divide-[var(--border)]">
          {femaDeclarations.map((d) => {
            const isActive = d.designatedArea === activeCountyFilter;
            const toast = toasts[d.id];
            const isNotifying = notifyingId === d.id;
            return (
              <li
                key={d.id}
                className={`relative px-4 py-3 transition ${isActive ? "bg-[var(--panel-2)]" : ""}`}
              >
                {isActive && (
                  <span className="absolute inset-y-0 left-0 w-[2px] bg-[var(--accent-red)]" aria-hidden="true" />
                )}
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-xs font-semibold uppercase tracking-wider text-[var(--text)]">
                    {d.incidentType}
                  </span>
                  <span className="font-mono text-[10px] text-[var(--text-dim)]">
                    {formatDate(d.declarationDate)}
                  </span>
                </div>
                <div className="mt-1 text-sm text-[var(--text-secondary)]">{d.designatedArea}</div>
                <div
                  className="mt-1 overflow-hidden text-[11px] text-[var(--text-dim)]"
                  style={{
                    display: "-webkit-box",
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: "vertical",
                  }}
                >
                  {d.title}
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setCountyFilter(d.designatedArea);
                      setFlyTo({ lng: -71.06, lat: 42.36, zoom: 10 });
                    }}
                    className="text-[10px] uppercase tracking-wider text-[var(--accent)] hover:underline"
                  >
                    View affected properties →
                  </button>
                  <button
                    type="button"
                    onClick={() => handleNotify(d)}
                    disabled={isNotifying}
                    className="rounded border border-[#a855f7] bg-[#a855f7]/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-[#a855f7] transition hover:bg-[#a855f7]/20 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {isNotifying ? "Sending…" : "📧 Notify owners"}
                  </button>
                </div>
                {toast && (
                  <div
                    className={`mt-2 rounded border px-2 py-1 text-[10px] ${
                      toast.kind === "success"
                        ? "border-[var(--accent)] bg-[var(--accent)]/10 text-[var(--accent)]"
                        : "border-[var(--accent-red)] bg-[var(--accent-red)]/10 text-[var(--accent-red)]"
                    }`}
                  >
                    {toast.kind === "success"
                      ? `✓ Sent ${toast.sent} · Previewed ${toast.previewed}`
                      : `✗ ${toast.message}`}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
