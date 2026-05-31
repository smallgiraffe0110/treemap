"use client";

import { useEffect, useRef, useState } from "react";

const STORAGE_KEY = "treemap_intro_dismissed";
const AUTO_DISMISS_MS = 4500;
const FADE_OUT_MS = 250;
const COUNT_DURATION_MS = 1500;

function useCountUp(target: number, start: boolean): number {
  const [value, setValue] = useState(0);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (!start) return;
    const startTime = performance.now();
    const tick = (now: number) => {
      const elapsed = now - startTime;
      const t = Math.min(1, elapsed / COUNT_DURATION_MS);
      const eased = 1 - Math.pow(1 - t, 3);
      setValue(Math.round(target * eased));
      if (t < 1) {
        rafRef.current = requestAnimationFrame(tick);
      }
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [target, start]);

  return value;
}

export function StormIntroOverlay() {
  const [visible, setVisible] = useState(true);
  const [mounted, setMounted] = useState(false);
  const [closing, setClosing] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const dismissed = window.localStorage.getItem(STORAGE_KEY);
    if (dismissed) {
      setVisible(false);
      return;
    }
    const id = window.requestAnimationFrame(() => setMounted(true));
    return () => window.cancelAnimationFrame(id);
  }, []);

  const dismiss = () => {
    if (closing) return;
    setClosing(true);
    try {
      window.localStorage.setItem(STORAGE_KEY, "1");
    } catch {
      // ignore storage failure
    }
    window.setTimeout(() => setVisible(false), FADE_OUT_MS);
  };

  useEffect(() => {
    if (!visible || closing) return;
    const id = window.setTimeout(dismiss, AUTO_DISMISS_MS);
    return () => window.clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, closing]);

  const damaged = useCountUp(342, mounted && !closing);
  const hot = useCountUp(78, mounted && !closing);
  const revenue = useCountUp(12400, mounted && !closing);

  if (!visible) return null;

  const opacity = closing ? 0 : mounted ? 1 : 0;

  return (
    <div
      onClick={dismiss}
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/85 backdrop-blur-md cursor-pointer"
      style={{
        opacity,
        transition: `opacity ${closing ? FADE_OUT_MS : 200}ms ease`,
      }}
    >
      <div
        className="relative w-full max-w-[720px] mx-4 p-12 rounded-2xl border border-[var(--border)] bg-[var(--panel)]/90"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="absolute top-4 right-4 flex items-center gap-1.5 px-2 py-1 rounded-full bg-red-500/15 border border-red-500/40">
          <span
            className="inline-block w-1.5 h-1.5 rounded-full bg-red-500"
            style={{ animation: "treemap-pulse 1.2s ease-in-out infinite" }}
          />
          <span className="text-[10px] font-semibold tracking-wider text-red-400">
            LIVE
          </span>
        </div>

        <h1
          className="font-display font-extrabold tracking-tight leading-none"
          style={{
            fontSize: "clamp(2.5rem, 6vw, 4.5rem)",
            color: "#ef4444",
            textShadow:
              "0 0 24px rgba(239,68,68,0.55), 0 0 48px rgba(239,68,68,0.35)",
          }}
        >
          STORM TREE DESTROYER
        </h1>

        <p className="mt-4 text-base text-[var(--text-secondary)]">
          Severe storm declared across Suffolk · Norfolk · Middlesex
        </p>

        <p className="mt-1 text-xs font-mono text-[var(--text-secondary)] opacity-70">
          May 28, 2026 — 03:42 EDT
        </p>

        <div className="mt-8 grid grid-cols-3 gap-6">
          <div>
            <div className="text-3xl font-display font-bold text-[var(--text)] tabular-nums">
              {damaged}
            </div>
            <div className="mt-1 text-[11px] uppercase tracking-wider text-[var(--text-secondary)]">
              Damaged properties detected
            </div>
          </div>
          <div>
            <div className="text-3xl font-display font-bold text-[var(--text)] tabular-nums">
              {hot}
            </div>
            <div className="mt-1 text-[11px] uppercase tracking-wider text-[var(--text-secondary)]">
              Hot leads ready
            </div>
          </div>
          <div>
            <div className="text-3xl font-display font-bold text-[var(--text)] tabular-nums">
              ${revenue.toLocaleString("en-US")}
            </div>
            <div className="mt-1 text-[11px] uppercase tracking-wider text-[var(--text-secondary)]">
              Estimated route revenue
            </div>
          </div>
        </div>

        <div className="mt-10 text-[11px] text-[var(--text-secondary)] opacity-70">
          Tap anywhere to dismiss · Press ⌘K for commands
        </div>
      </div>

      <style>{`
        @keyframes treemap-pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.45; transform: scale(1.4); }
        }
      `}</style>
    </div>
  );
}
