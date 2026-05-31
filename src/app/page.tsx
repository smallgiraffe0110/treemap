"use client";

import { useEffect, useState, useCallback } from "react";
import dynamic from "next/dynamic";
import { Header } from "@/components/Header";
import { LeadDetailPanel } from "@/components/panels/LeadDetailPanel";
import { PriorityLeadsPanel } from "@/components/panels/PriorityLeadsPanel";
import { StormAlertsPanel } from "@/components/panels/StormAlertsPanel";
import { MailExportPanel } from "@/components/panels/MailExportPanel";
import { AIActivityPanel } from "@/components/panels/AIActivityPanel";
import { WeatherControls } from "@/components/WeatherControls";
import { CommandPalette } from "@/components/CommandPalette";
import { KeyboardShortcutsOverlay } from "@/components/KeyboardShortcutsOverlay";
import { StormIntroOverlay } from "@/components/StormIntroOverlay";
import { DemoController } from "@/components/DemoController";
import { LiveTicker } from "@/components/LiveTicker";
import { SoundEffects, SoundToggle } from "@/components/SoundEffects";
import { ScreenRecorder } from "@/components/ScreenRecorder";
import { CrewDispatchPanel } from "@/components/CrewDispatchPanel";
import { useLeadStore } from "@/stores/leadStore";
import { BOSTON_PROPERTIES } from "@/data/bostonProperties";

const WorldMap = dynamic(
  () => import("@/components/WorldMap").then((m) => ({ default: m.WorldMap })),
  { ssr: false, loading: () => <div className="absolute inset-0 bg-[var(--bg)]" /> }
);

type PanelKey = "alerts" | "leads" | "detail" | "mail" | "ai";

const DEFAULT_ORDER: PanelKey[] = ["alerts", "leads", "detail", "mail", "ai"];
const STORAGE_KEY = "treemap_panel_order_v1";
const HEIGHT_KEY = "treemap_panel_height_v1";
const MIN_PANEL_PX = 160;
const MAX_PANEL_PX_RATIO = 0.85; // up to 85% of window height
const DEFAULT_PANEL_PX = 360;

const PANEL_LABELS: Record<PanelKey, string> = {
  alerts: "Storm Alerts",
  leads: "Priority Leads",
  detail: "Lead Detail",
  mail: "Mail Export",
  ai: "AI Activity",
};

function renderPanel(key: PanelKey) {
  switch (key) {
    case "alerts": return <StormAlertsPanel />;
    case "leads": return <PriorityLeadsPanel />;
    case "detail": return <LeadDetailPanel />;
    case "mail": return <MailExportPanel />;
    case "ai": return <AIActivityPanel />;
  }
}

export default function Page() {
  const setProperties = useLeadStore((s) => s.setProperties);
  const propertiesLength = useLeadStore((s) => s.properties.length);

  const [order, setOrder] = useState<PanelKey[]>(DEFAULT_ORDER);
  const [dragging, setDragging] = useState<PanelKey | null>(null);
  const [overKey, setOverKey] = useState<PanelKey | null>(null);
  const [panelHeight, setPanelHeight] = useState<number>(DEFAULT_PANEL_PX);
  const [resizing, setResizing] = useState(false);

  useEffect(() => {
    if (propertiesLength === 0) {
      setProperties(BOSTON_PROPERTIES);
    }
  }, [propertiesLength, setProperties]);

  // Load saved order + height
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as PanelKey[];
        if (
          Array.isArray(parsed) &&
          parsed.length === DEFAULT_ORDER.length &&
          DEFAULT_ORDER.every((k) => parsed.includes(k))
        ) {
          setOrder(parsed);
        }
      }
    } catch { /* ignore */ }
    try {
      const h = Number(localStorage.getItem(HEIGHT_KEY));
      if (Number.isFinite(h) && h >= MIN_PANEL_PX) setPanelHeight(h);
    } catch { /* ignore */ }
  }, []);

  // Resize drag — mouse-move/up listeners attached only while resizing.
  useEffect(() => {
    if (!resizing) return;
    const onMove = (e: MouseEvent) => {
      const next = Math.max(
        MIN_PANEL_PX,
        Math.min(window.innerHeight * MAX_PANEL_PX_RATIO, window.innerHeight - e.clientY),
      );
      setPanelHeight(next);
    };
    const onUp = () => {
      setResizing(false);
      try { localStorage.setItem(HEIGHT_KEY, String(panelHeight)); } catch { /* ignore */ }
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    document.body.style.cursor = "row-resize";
    document.body.style.userSelect = "none";
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, [resizing, panelHeight]);

  const persist = useCallback((next: PanelKey[]) => {
    setOrder(next);
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch { /* ignore */ }
  }, []);

  const handleDragStart = (k: PanelKey) => (e: React.DragEvent) => {
    setDragging(k);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", k);
  };
  const handleDragOver = (k: PanelKey) => (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (overKey !== k) setOverKey(k);
  };
  const handleDrop = (target: PanelKey) => (e: React.DragEvent) => {
    e.preventDefault();
    const src = (e.dataTransfer.getData("text/plain") as PanelKey) || dragging;
    if (!src || src === target) {
      setDragging(null); setOverKey(null); return;
    }
    const next = [...order];
    const srcIdx = next.indexOf(src);
    const tgtIdx = next.indexOf(target);
    next.splice(srcIdx, 1);
    next.splice(tgtIdx, 0, src);
    persist(next);
    setDragging(null); setOverKey(null);
  };
  const handleDragEnd = () => { setDragging(null); setOverKey(null); };

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-[var(--bg)] text-[var(--text)]">
      <Header />

      <main className="relative flex-1 overflow-hidden flex flex-col">
        {/* Top half: map */}
        <div className="relative flex-1 min-h-0 border-b border-[var(--border)]">
          <WorldMap />
          <WeatherControls />
          <LiveTicker />
        </div>

        {/* Resize handle (Cursor-style) */}
        <div
          onMouseDown={() => setResizing(true)}
          onDoubleClick={() => { setPanelHeight(DEFAULT_PANEL_PX); try { localStorage.removeItem(HEIGHT_KEY); } catch { /* ignore */ } }}
          title="Drag to resize · Double-click to reset"
          className={
            "h-[6px] -my-[3px] z-30 cursor-row-resize group relative flex items-center justify-center select-none " +
            (resizing ? "bg-[var(--accent)]" : "bg-transparent hover:bg-[var(--accent)]/40 transition-colors")
          }
        >
          <div className="h-[2px] w-12 rounded-full bg-[var(--border-hi)] group-hover:bg-[var(--accent)] transition-colors" />
        </div>

        {/* Bottom: drag-orderable 5-column panel grid */}
        <div
          style={{ height: `${panelHeight}px` }}
          className="grid grid-cols-5 gap-3 p-3 min-h-0 bg-[var(--bg)]">
          {order.map((key) => {
            const isDragging = dragging === key;
            const isOver = overKey === key && dragging !== key;
            return (
              <div
                key={key}
                draggable
                onDragStart={handleDragStart(key)}
                onDragOver={handleDragOver(key)}
                onDrop={handleDrop(key)}
                onDragEnd={handleDragEnd}
                onDragLeave={() => setOverKey(null)}
                title={`Drag to reorder · ${PANEL_LABELS[key]}`}
                className={
                  "min-h-0 overflow-hidden relative transition-all duration-150 " +
                  (isDragging ? "opacity-40 scale-[0.98] " : "") +
                  (isOver ? "ring-2 ring-[var(--accent)] ring-offset-2 ring-offset-[var(--bg)] rounded-lg " : "")
                }
              >
                {renderPanel(key)}
              </div>
            );
          })}
        </div>
      </main>

      <CommandPalette />
      <KeyboardShortcutsOverlay />
      <StormIntroOverlay />
      <DemoController />
      <SoundEffects />
      <SoundToggle />
      <ScreenRecorder />
      <CrewDispatchPanel />
    </div>
  );
}
