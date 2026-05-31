"use client";

import { useEffect, useState } from "react";

interface ShortcutSection {
  title: string;
  items: ReadonlyArray<readonly [string, string]>;
}

const SECTIONS: ReadonlyArray<ShortcutSection> = [
  {
    title: "GENERAL",
    items: [
      ["⌘ K", "Open command palette"],
      ["?", "Toggle this shortcuts overlay"],
      ["⎋", "Dismiss modal / close panel"],
    ],
  },
  {
    title: "MAP",
    items: [
      ["Click pin", "Open lead detail"],
      ["Click cluster", "Zoom into cluster"],
      ["Click neighborhood chip", "Fly to that area"],
    ],
  },
  {
    title: "LEADS",
    items: [
      ["Select all hot leads", "Bulk-select urgency > 70"],
      ["Click property row", "Open + fly to it"],
      ["⌘ A", "Select all (when leads panel focused)"],
    ],
  },
  {
    title: "AI AGENTS",
    items: [
      ["✨ in Lead Detail", "Stream AI outreach copy"],
      ["🔬 in Lead Detail", "Re-score canopy with vision agent"],
      ["📧 in Storm Alert", "Notify all owners in affected county"],
      ["⌘ K → \"impact\"", "Run impact analyst"],
    ],
  },
  {
    title: "DEMO",
    items: [
      ["▶ button (corner)", "Run choreographed demo"],
      ["Drag panel", "Reorder bottom panels"],
      ["Drag handle above panels", "Resize panel area"],
    ],
  },
];

function isEditableTarget(): boolean {
  const el = document.activeElement;
  if (!el) return false;
  const tag = el.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA") return true;
  if (el instanceof HTMLElement && el.isContentEditable) return true;
  return false;
}

export function KeyboardShortcutsOverlay() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "?" && !isEditableTarget()) {
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

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center bg-black/70 backdrop-blur"
      onClick={() => setOpen(false)}
      role="dialog"
      aria-modal="true"
      aria-label="Keyboard shortcuts"
    >
      <div
        className="w-[540px] max-w-[92vw] max-h-[70vh] flex flex-col bg-[var(--panel)] rounded-xl border border-[var(--border)] shadow-2xl p-6 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display text-[18px] text-[var(--text)] leading-none">
            Keyboard Shortcuts
          </h2>
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Close shortcuts"
            className="w-7 h-7 flex items-center justify-center rounded text-[var(--text-secondary)] hover:text-[var(--text)] hover:bg-[var(--panel-2)] transition-colors text-lg leading-none"
          >
            ×
          </button>
        </div>

        <div className="flex-1 overflow-y-auto grid grid-cols-2 gap-x-6 gap-y-5 pr-1">
          {SECTIONS.map((section) => (
            <div key={section.title} className="min-w-0">
              <div className="text-[11px] font-medium uppercase tracking-widest text-[var(--text-dim)] mb-2">
                {section.title}
              </div>
              <div className="flex flex-col">
                {section.items.map(([key, label]) => (
                  <div
                    key={`${section.title}-${key}-${label}`}
                    className="flex items-center gap-3 py-1"
                  >
                    <kbd className="inline-block min-w-[28px] text-center px-2 py-0.5 rounded border border-[var(--border-hi)] bg-[var(--panel-2)] font-mono text-[11px] text-[var(--text)] shrink-0">
                      {key}
                    </kbd>
                    <span className="text-[12px] text-[var(--text)] truncate">
                      {label}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="border-t border-[var(--border)] mt-4 pt-3 text-[10px] text-[var(--text-dim)] flex items-center gap-2">
          <span>Press</span>
          <kbd className="inline-block min-w-[20px] text-center px-1.5 py-0.5 rounded border border-[var(--border-hi)] bg-[var(--panel-2)] font-mono text-[10px] text-[var(--text)]">
            ?
          </kbd>
          <span>anytime to reopen ·</span>
          <kbd className="inline-block min-w-[20px] text-center px-1.5 py-0.5 rounded border border-[var(--border-hi)] bg-[var(--panel-2)] font-mono text-[10px] text-[var(--text)]">
            ⎋
          </kbd>
          <span>to close</span>
        </div>
      </div>
    </div>
  );
}
