"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useLeadStore } from "@/stores/leadStore";
import { useWeatherStore } from "@/stores/weatherStore";

interface Command {
  id: string;
  label: string;
  hint: string;
  run: () => void | Promise<void>;
}

const COMMANDS: Command[] = [
  {
    id: "impact",
    label: "Run Storm Impact Analyst",
    hint: "AI",
    run: async () => {
      await fetch("/api/agents/impact", {
        method: "POST",
        body: "{}",
        headers: { "content-type": "application/json" },
      });
    },
  },
  {
    id: "notify-suf",
    label: "Notify Suffolk County owners (Tree Destroyer)",
    hint: "AI",
    run: async () => {
      await fetch("/api/agents/notify", {
        method: "POST",
        body: JSON.stringify({ declarationId: "tree-destroyer-2026" }),
        headers: { "content-type": "application/json" },
      });
    },
  },
  {
    id: "notify-nor",
    label: "Notify Norfolk County owners (Tree Destroyer)",
    hint: "AI",
    run: async () => {
      await fetch("/api/agents/notify", {
        method: "POST",
        body: JSON.stringify({ declarationId: "tree-destroyer-norfolk" }),
        headers: { "content-type": "application/json" },
      });
    },
  },
  {
    id: "reset",
    label: "Reset map view to Boston",
    hint: "Map",
    run: () =>
      useLeadStore.getState().setFlyTo({ lng: -71.1, lat: 42.31, zoom: 11.2 }),
  },
  {
    id: "fly-jp",
    label: "Fly to Jamaica Plain",
    hint: "Map",
    run: () =>
      useLeadStore.getState().setFlyTo({ lng: -71.114, lat: 42.31, zoom: 13.5 }),
  },
  {
    id: "fly-dor",
    label: "Fly to Dorchester",
    hint: "Map",
    run: () =>
      useLeadStore.getState().setFlyTo({ lng: -71.07, lat: 42.302, zoom: 13.5 }),
  },
  {
    id: "select-hot",
    label: "Select all hot leads",
    hint: "Leads",
    run: () => useLeadStore.getState().selectAllHot(),
  },
  {
    id: "clear-sel",
    label: "Clear selection",
    hint: "Leads",
    run: () => useLeadStore.getState().clearSelection(),
  },
  {
    id: "radar",
    label: "Toggle weather radar",
    hint: "Weather",
    run: () => useWeatherStore.getState().toggleRadar(),
  },
  {
    id: "alerts",
    label: "Toggle NWS alerts overlay",
    hint: "Weather",
    run: () => useWeatherStore.getState().toggleAlerts(),
  },
  {
    id: "service",
    label: "Toggle service area overlay",
    hint: "Weather",
    run: () => useWeatherStore.getState().toggleServiceArea(),
  },
];

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [highlight, setHighlight] = useState(0);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return COMMANDS;
    return COMMANDS.filter((c) => c.label.toLowerCase().includes(q));
  }, [query]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
        return;
      }
      if (e.key === "Escape" && open) {
        e.preventDefault();
        setOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  useEffect(() => {
    if (open) {
      setQuery("");
      setHighlight(0);
      const id = window.setTimeout(() => inputRef.current?.focus(), 0);
      return () => window.clearTimeout(id);
    }
  }, [open]);

  useEffect(() => {
    if (highlight >= filtered.length) setHighlight(0);
  }, [filtered.length, highlight]);

  if (!open) return null;

  const runCommand = async (cmd: Command) => {
    setOpen(false);
    try {
      await cmd.run();
    } catch {
      // swallow demo errors
    }
  };

  const onKeyDownModal = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlight((h) => (filtered.length ? (h + 1) % filtered.length : 0));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlight((h) =>
        filtered.length ? (h - 1 + filtered.length) % filtered.length : 0
      );
    } else if (e.key === "Enter") {
      e.preventDefault();
      const cmd = filtered[highlight];
      if (cmd) void runCommand(cmd);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[90] flex items-start justify-center bg-black/60 backdrop-blur pt-[18vh]"
      onClick={() => setOpen(false)}
    >
      <div
        className="w-[480px] max-w-[92vw] max-h-[60vh] flex flex-col bg-[var(--panel)] rounded-xl border border-[var(--border)] shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={onKeyDownModal}
      >
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setHighlight(0);
          }}
          placeholder="Type a command…"
          className="h-11 px-4 bg-transparent text-[var(--text)] placeholder:text-[var(--text-secondary)] font-display outline-none border-b border-[var(--border)]"
          spellCheck={false}
          autoComplete="off"
        />

        <div className="flex-1 overflow-y-auto py-1">
          {filtered.length === 0 ? (
            <div className="py-8 text-center text-[var(--text-secondary)] text-sm">
              No matching command
            </div>
          ) : (
            filtered.map((cmd, i) => {
              const active = i === highlight;
              return (
                <button
                  key={cmd.id}
                  type="button"
                  onMouseEnter={() => setHighlight(i)}
                  onClick={() => void runCommand(cmd)}
                  className={`w-full h-9 flex items-center justify-between pl-3 pr-3 text-left text-sm border-l-2 transition-colors ${
                    active
                      ? "bg-[var(--panel-2)] border-[var(--accent)] text-[var(--text)]"
                      : "border-transparent text-[var(--text)] hover:bg-[var(--panel-2)]"
                  }`}
                >
                  <span className="truncate">{cmd.label}</span>
                  <span className="ml-3 shrink-0 text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-[var(--panel-2)] text-[var(--text-secondary)] border border-[var(--border)]">
                    {cmd.hint}
                  </span>
                </button>
              );
            })
          )}
        </div>

        <div className="border-t border-[var(--border)] px-3 py-2 text-[10px] text-[var(--text-secondary)] flex items-center gap-3">
          <span>↑↓ navigate</span>
          <span>·</span>
          <span>⏎ run</span>
          <span>·</span>
          <span>⎋ close</span>
          <span>·</span>
          <span>⌘K toggle</span>
        </div>
      </div>
    </div>
  );
}
