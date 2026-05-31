"use client";

import { useEffect, useRef, useState } from "react";
import { useAgentStore } from "@/stores/agentStore";

const SOUND_OFF_KEY = "treemap_sound_off";

type WebkitWindow = Window & { webkitAudioContext?: typeof AudioContext };

function createCtx(): AudioContext | null {
  try {
    const w = window as WebkitWindow;
    const Ctor = window.AudioContext ?? w.webkitAudioContext;
    if (!Ctor) return null;
    return new Ctor();
  } catch {
    return null;
  }
}

function tone(
  ctx: AudioContext,
  freqs: number[],
  ms: number,
  type: OscillatorType,
  gain: number,
): void {
  const t0 = ctx.currentTime;
  const g = ctx.createGain();
  g.gain.setValueAtTime(gain, t0);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + ms / 1000);
  g.connect(ctx.destination);
  for (const f of freqs) {
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.value = f;
    o.connect(g);
    o.start(t0);
    o.stop(t0 + ms / 1000);
  }
}

function chord(ctx: AudioContext, freqs: number[], ms: number, gain: number): void {
  tone(ctx, freqs, ms, "sine", gain);
}

export function SoundEffects() {
  const ctxRef = useRef<AudioContext | null>(null);
  const seenRef = useRef<Set<string>>(new Set());

  // Lazy-init AudioContext on first user interaction (autoplay policy)
  useEffect(() => {
    const init = () => {
      if (ctxRef.current) return;
      ctxRef.current = createCtx();
    };
    document.addEventListener("click", init, { once: true });
    document.addEventListener("keydown", init, { once: true });
    return () => {
      document.removeEventListener("click", init);
      document.removeEventListener("keydown", init);
    };
  }, []);

  // Pre-seed seenRef from existing traces so we don't play sounds for old ones on mount
  useEffect(() => {
    const t = useAgentStore.getState().traces;
    seenRef.current = new Set(t.map((x) => x.id));
  }, []);

  // Subscribe to trace changes
  useEffect(() => {
    return useAgentStore.subscribe((state) => {
      const off =
        typeof window !== "undefined" && localStorage.getItem(SOUND_OFF_KEY) === "1";
      if (off) return;
      const ctx = ctxRef.current;
      if (!ctx) return;
      for (const trace of state.traces) {
        if (seenRef.current.has(trace.id)) continue;
        seenRef.current.add(trace.id);
        if (trace.status === "error") {
          tone(ctx, [220], 200, "square", 0.04);
        } else if (trace.agent === "notify" && trace.status === "success") {
          chord(ctx, [880, 1320], 600, 0.05);
        } else if (trace.status === "success") {
          chord(ctx, [440, 660], 300, 0.04);
        }
      }
    });
  }, []);

  return null;
}

export function SoundToggle() {
  const [muted, setMuted] = useState(false);

  useEffect(() => {
    try {
      setMuted(localStorage.getItem(SOUND_OFF_KEY) === "1");
    } catch {
      /* ignore */
    }
  }, []);

  const handleClick = () => {
    const next = !muted;
    setMuted(next);
    try {
      localStorage.setItem(SOUND_OFF_KEY, next ? "1" : "0");
    } catch {
      /* ignore */
    }
    // Play a test chime when enabling
    if (!next) {
      const ctx = createCtx();
      if (ctx) chord(ctx, [440, 660], 300, 0.04);
    }
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-label={muted ? "Enable sound" : "Mute sound"}
      title={muted ? "Sound off — click to enable" : "Sound on — click to mute"}
      className="fixed bottom-3 left-3 z-50 w-6 h-6 flex items-center justify-center rounded border border-[var(--border)] bg-[var(--bg)]/80 backdrop-blur text-[var(--text)] hover:text-[var(--accent)] hover:border-[var(--accent)] transition-colors"
    >
      {muted ? (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
          <line x1="23" y1="9" x2="17" y2="15" />
          <line x1="17" y1="9" x2="23" y2="15" />
        </svg>
      ) : (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
          <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
          <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
        </svg>
      )}
    </button>
  );
}
