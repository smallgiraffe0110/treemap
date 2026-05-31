"use client";

import { useState, useRef } from "react";
import { useLeadStore } from "@/stores/leadStore";
import { useWeatherStore } from "@/stores/weatherStore";
import { useAgentStore } from "@/stores/agentStore";

type DemoState = "idle" | "running" | "done";

interface DemoStep {
  label: string;
  ms: number;
  run: () => void | Promise<void>;
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

const STEPS: DemoStep[] = [
  {
    label: "Reset to Boston",
    ms: 1200,
    run: () =>
      useLeadStore.getState().setFlyTo({ lng: -71.1, lat: 42.31, zoom: 11.2 }),
  },
  {
    label: "Toggle storm radar",
    ms: 800,
    run: () => {
      const w = useWeatherStore.getState();
      if (!w.showRadar) w.toggleRadar();
    },
  },
  {
    label: "Select 34 hot leads",
    ms: 1500,
    run: () => useLeadStore.getState().selectAllHot(),
  },
  {
    label: "Fly to Jamaica Plain",
    ms: 1800,
    run: () =>
      useLeadStore
        .getState()
        .setFlyTo({ lng: -71.114, lat: 42.31, zoom: 13.5 }),
  },
  {
    label: "Open top hot lead",
    ms: 1500,
    run: () => {
      const props = useLeadStore.getState().properties;
      const hottest = [...props].sort(
        (a, b) => b.urgencyScore - a.urgencyScore,
      )[0];
      if (hottest) {
        useLeadStore.getState().setActiveProperty(hottest.id);
        useLeadStore.getState().setFlyTo({
          lng: hottest.lng,
          lat: hottest.lat,
          zoom: 15,
          id: hottest.id,
        });
      }
    },
  },
  {
    label: "Stream AI outreach",
    ms: 4000,
    run: async () => {
      const id = useLeadStore.getState().activePropertyId;
      if (!id) return;
      try {
        const res = await fetch("/api/agents/outreach", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ propertyId: id, useStorm: true }),
        });
        if (!res.body) return;
        const reader = res.body.getReader();
        const dec = new TextDecoder();
        let buf = "";
        let full = "";
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buf += dec.decode(value, { stream: true });
          const lines = buf.split("\n");
          buf = lines.pop() ?? "";
          for (const ln of lines) {
            if (!ln.startsWith("data:")) continue;
            const payload = ln.slice(5).trim();
            try {
              const j = JSON.parse(payload);
              if (j.chunk) {
                full += j.chunk;
                useAgentStore.getState().appendStream(id, j.chunk);
              }
              if (j.done) useAgentStore.getState().setOutreach(id, j.done.full);
            } catch {
              /* ignore */
            }
          }
        }
      } catch {
        /* swallow; ticker will continue */
      }
    },
  },
  {
    label: "Notify Suffolk owners",
    ms: 2500,
    run: () =>
      fetch("/api/agents/notify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ declarationId: "tree-destroyer-2026" }),
      }).catch(() => undefined),
  },
  {
    label: "Run impact analyst",
    ms: 2000,
    run: () =>
      fetch("/api/agents/impact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      }).catch(() => undefined),
  },
];

export function DemoController() {
  const [state, setState] = useState<DemoState>("idle");
  const [stepIndex, setStepIndex] = useState(0);
  const [currentLabel, setCurrentLabel] = useState<string>("");
  const cancelRef = useRef(false);

  const total = STEPS.length;
  const progress = state === "done" ? 1 : stepIndex / total;

  async function runDemo() {
    cancelRef.current = false;
    setState("running");
    setStepIndex(0);
    setCurrentLabel(STEPS[0]?.label ?? "");

    for (let i = 0; i < STEPS.length; i++) {
      if (cancelRef.current) {
        setState("idle");
        setCurrentLabel("");
        setStepIndex(0);
        return;
      }
      const step = STEPS[i];
      setStepIndex(i);
      setCurrentLabel(step.label);
      try {
        await step.run();
      } catch {
        /* never let one error kill the demo */
      }
      await sleep(step.ms);
    }
    setStepIndex(total);
    setState("done");
    setCurrentLabel("");
  }

  function handleClick() {
    if (state === "running") {
      cancelRef.current = true;
      return;
    }
    if (state === "done") {
      setState("idle");
      setStepIndex(0);
      setCurrentLabel("");
      // brief tick before restart so React commits idle first
      requestAnimationFrame(() => {
        void runDemo();
      });
      return;
    }
    void runDemo();
  }

  const icon = state === "running" ? "⏸" : state === "done" ? "✓" : "▶";
  const label =
    state === "running"
      ? `Demo running… (step ${Math.min(stepIndex + 1, total)}/${total})`
      : state === "done"
        ? "Demo complete · Play again?"
        : "Play demo";

  return (
    <div className="fixed top-20 left-4 z-40 flex flex-col items-start gap-1.5 pointer-events-none">
      <button
        type="button"
        onClick={handleClick}
        className="pointer-events-auto inline-flex items-center gap-2 rounded-full px-5 py-2.5 font-display text-[14px] font-semibold text-white bg-gradient-to-b from-emerald-700 to-emerald-900 shadow-[0_0_24px_-4px_rgba(239,68,68,0.55)] ring-1 ring-emerald-500/40 hover:from-emerald-600 hover:to-emerald-800 active:scale-[0.98] transition"
        aria-label={label}
      >
        <span className="text-[13px] leading-none" aria-hidden>
          {icon}
        </span>
        <span>{label}</span>
      </button>

      <div
        className="pointer-events-none h-[1.5px] w-44 overflow-hidden rounded-full bg-white/10"
        aria-hidden
      >
        <div
          className="h-full bg-emerald-400 transition-[width] duration-300 ease-out"
          style={{ width: `${Math.round(progress * 100)}%` }}
        />
      </div>

      <div
        className={`pointer-events-none font-mono text-[11px] text-white/55 transition-opacity duration-300 ${
          currentLabel ? "opacity-100" : "opacity-0"
        }`}
      >
        {currentLabel || " "}
      </div>
    </div>
  );
}
