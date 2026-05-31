"use client";

import { useMemo, useState } from "react";
import { useAgentStore } from "@/stores/agentStore";
import { useLeadStore } from "@/stores/leadStore";
import type { Property } from "@/types";

function urgencyColor(score: number): string {
  if (score >= 70) return "var(--accent-red)";
  if (score >= 40) return "var(--accent-amber)";
  return "var(--accent)";
}

function today(): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function snippet(text: string, max = 60): string {
  const flat = text.replace(/\s+/g, " ").trim();
  if (flat.length <= max) return flat;
  return `${flat.slice(0, max).trimEnd()}…`;
}

export function MailExportPanel() {
  const properties = useLeadStore((s) => s.properties);
  const selectedIds = useLeadStore((s) => s.selectedIds);
  const clearSelection = useLeadStore((s) => s.clearSelection);
  const outreachByProperty = useAgentStore((s) => s.outreachByProperty);

  const [busy, setBusy] = useState<"csv" | "merge" | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [useAI, setUseAI] = useState(false);

  const selected: Property[] = useMemo(
    () => properties.filter((p) => selectedIds.has(p.id)),
    [properties, selectedIds],
  );

  const ids = useMemo(() => selected.map((p) => p.id), [selected]);

  async function handleCsvExport() {
    if (ids.length === 0) return;
    setBusy("csv");
    setErrorMsg(null);
    try {
      const res = await fetch("/api/export?format=csv", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids }),
      });
      if (!res.ok) throw new Error(`CSV export failed: ${res.status}`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `treemap_mail_list_${today()}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error(e);
      setErrorMsg(e instanceof Error ? e.message : "CSV export failed");
    } finally {
      setBusy(null);
    }
  }

  async function handleMailMerge() {
    if (ids.length === 0) return;
    setBusy("merge");
    setErrorMsg(null);
    try {
      const copies: Record<string, string> = {};
      if (useAI) {
        for (const id of ids) {
          const c = outreachByProperty[id];
          if (c) copies[id] = c;
        }
      }
      const body = useAI ? { ids, useAI: true, copies } : { ids };
      const res = await fetch("/api/export?format=mailmerge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(`Mail merge failed: ${res.status}`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (e) {
      console.error(e);
      setErrorMsg(e instanceof Error ? e.message : "Mail merge failed");
    } finally {
      setBusy(null);
    }
  }

  const isEmpty = selected.length === 0;

  return (
    <section className="relative flex h-full flex-col overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--panel)]">
      <div className="absolute inset-x-0 top-0 h-[2px] bg-[var(--accent)]" />

      <div className="border-b border-[var(--border)] px-4 pb-3 pt-4">
        <div className="flex items-baseline justify-between">
          <h2 className="font-display text-base text-[var(--text)]">Direct Mail Export</h2>
          <span className="text-[10px] uppercase tracking-wider text-[var(--text-dim)]">
            <span className="font-mono text-[var(--text-secondary)]">{selected.length}</span> properties selected
          </span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {isEmpty ? (
          <div className="p-6 text-center text-xs text-[var(--text-dim)]">
            Select properties from the map or Priority Leads to build your mail list.
          </div>
        ) : (
          <table className="w-full border-collapse text-left text-xs">
            <thead className="sticky top-0 bg-[var(--panel)]">
              <tr className="text-[10px] uppercase tracking-wider text-[var(--text-dim)]">
                <th className="border-b border-[var(--border)] px-3 py-2 font-medium">Name</th>
                <th className="border-b border-[var(--border)] px-3 py-2 font-medium">Address</th>
                <th className="border-b border-[var(--border)] px-3 py-2 font-medium">City</th>
                <th className="border-b border-[var(--border)] px-3 py-2 font-medium">ZIP</th>
                <th className="border-b border-[var(--border)] px-3 py-2 text-right font-medium">Urgency</th>
              </tr>
            </thead>
            <tbody>
              {selected.map((p) => (
                <tr key={p.id} className="border-b border-[var(--border)] hover:bg-[var(--panel-2)]">
                  <td className="px-3 py-2 text-[var(--text)]">{p.ownerName}</td>
                  <td className="px-3 py-2 text-[var(--text-secondary)]">{p.address}</td>
                  <td className="px-3 py-2 text-[var(--text-secondary)]">{p.city}</td>
                  <td className="px-3 py-2 font-mono text-[var(--text-secondary)]">{p.zipCode}</td>
                  <td
                    className="px-3 py-2 text-right font-mono font-semibold"
                    style={{ color: urgencyColor(p.urgencyScore) }}
                  >
                    {p.urgencyScore}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {!isEmpty && (
        <div className="border-t border-[var(--border)] px-4 py-3">
          <label className="flex cursor-pointer items-center gap-2 text-[11px] text-[var(--text-secondary)]">
            <input
              type="checkbox"
              checked={useAI}
              onChange={(e) => setUseAI(e.target.checked)}
              className="h-3.5 w-3.5 accent-[#3b82f6]"
            />
            <span>Use AI-personalized copy in mail merge</span>
          </label>
          {useAI && (
            <div className="mt-2 grid grid-cols-1 gap-1.5">
              {selected.map((p) => {
                const copy = outreachByProperty[p.id];
                return (
                  <div
                    key={p.id}
                    className="flex items-center gap-2 rounded border border-[var(--border)] bg-[var(--panel-2)] px-2 py-1.5 text-[10px]"
                  >
                    <span className="w-28 shrink-0 truncate font-mono text-[var(--text-dim)]">{p.address}</span>
                    {copy ? (
                      <span className="truncate text-[#3b82f6]">{snippet(copy)}</span>
                    ) : (
                      <span className="truncate italic text-[var(--text-dim)]">
                        Not generated — click ✨ in Lead Detail
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {errorMsg && (
        <div className="border-t border-[var(--border)] bg-[var(--accent-red)]/10 px-4 py-2 text-[11px] text-[var(--accent-red)]">
          {errorMsg}
        </div>
      )}

      <div className="flex items-center gap-2 border-t border-[var(--border)] p-3">
        <button
          type="button"
          onClick={handleCsvExport}
          disabled={isEmpty || busy !== null}
          className="rounded border border-[var(--accent)] bg-[var(--accent)]/10 px-3 py-2 text-xs font-medium text-[var(--accent)] transition hover:bg-[var(--accent)]/20 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {busy === "csv" ? "Exporting…" : "Export CSV"}
        </button>
        <button
          type="button"
          onClick={handleMailMerge}
          disabled={isEmpty || busy !== null}
          className="rounded border border-[var(--border-hi)] bg-[var(--panel-2)] px-3 py-2 text-xs font-medium text-[var(--text)] transition hover:bg-[var(--border)] disabled:cursor-not-allowed disabled:opacity-40"
        >
          {busy === "merge" ? "Generating…" : "Generate Mail Merge"}
        </button>
        <div className="flex-1" />
        <button
          type="button"
          onClick={clearSelection}
          disabled={isEmpty}
          className="rounded px-2 py-2 text-[10px] uppercase tracking-wider text-[var(--text-dim)] transition hover:text-[var(--text)] disabled:cursor-not-allowed disabled:opacity-40"
        >
          Clear selection
        </button>
      </div>
    </section>
  );
}
