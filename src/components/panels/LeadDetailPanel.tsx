"use client";

import { useEffect, useRef, useState } from "react";
import { useAgentStore } from "@/stores/agentStore";
import { useLeadStore } from "@/stores/leadStore";
import { ForecastWidget } from "@/components/ForecastWidget";
import { PropertySatelliteImage } from "@/components/PropertySatelliteImage";
import type { CanopyResult, Property, VoiceResult } from "@/types";

function urgencyTone(score: number): { color: string; label: string } {
  if (score >= 70) return { color: "var(--accent-red)", label: "HOT" };
  if (score >= 40) return { color: "var(--accent-amber)", label: "WARM" };
  return { color: "var(--accent)", label: "COOL" };
}

function ndviTag(score: number): { color: string; label: string } {
  if (score < 40) return { color: "var(--accent-red)", label: "stressed" };
  if (score <= 60) return { color: "var(--accent-amber)", label: "moderate" };
  return { color: "var(--accent)", label: "healthy" };
}

function Stat({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[10px] uppercase tracking-wider text-[var(--text-dim)]">{label}</span>
      <span className="text-sm text-[var(--text)]">{children}</span>
    </div>
  );
}

export function LeadDetailPanel() {
  const activePropertyId = useLeadStore((s) => s.activePropertyId);
  const properties = useLeadStore((s) => s.properties);
  const selectedIds = useLeadStore((s) => s.selectedIds);
  const toggleSelected = useLeadStore((s) => s.toggleSelected);
  const setActiveProperty = useLeadStore((s) => s.setActiveProperty);

  const canopyOverride: CanopyResult | undefined = useAgentStore((s) =>
    activePropertyId ? s.canopyOverrides[activePropertyId] : undefined,
  );
  const streamingText: string = useAgentStore((s) =>
    activePropertyId ? s.streaming[activePropertyId] ?? "" : "",
  );
  const finishedOutreach: string | undefined = useAgentStore((s) =>
    activePropertyId ? s.outreachByProperty[activePropertyId] : undefined,
  );

  const [canopyLoading, setCanopyLoading] = useState(false);
  const [canopyError, setCanopyError] = useState<string | null>(null);
  const [outreachLoading, setOutreachLoading] = useState(false);
  const [outreachError, setOutreachError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [voiceLoading, setVoiceLoading] = useState(false);
  const [voiceChip, setVoiceChip] = useState<VoiceResult | { status: "error"; message: string } | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const voiceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Reset error state when active property changes
  useEffect(() => {
    setCanopyError(null);
    setOutreachError(null);
    setCopied(false);
    setVoiceChip(null);
    if (voiceTimerRef.current) {
      clearTimeout(voiceTimerRef.current);
      voiceTimerRef.current = null;
    }
  }, [activePropertyId]);

  // Clear voice chip timer on unmount
  useEffect(() => {
    return () => {
      if (voiceTimerRef.current) clearTimeout(voiceTimerRef.current);
    };
  }, []);

  // Cleanup any in-flight stream on unmount or property switch
  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, [activePropertyId]);

  const property: Property | undefined = activePropertyId
    ? properties.find((p) => p.id === activePropertyId)
    : undefined;

  if (!property) {
    return (
      <aside className="relative flex h-full flex-col overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--panel)]">
        <div className="absolute inset-x-0 top-0 h-[2px] bg-[var(--border-hi)]" />
        <div className="flex flex-1 items-center justify-center p-6 text-center text-sm text-[var(--text-dim)]">
          Select a property pin to view details
        </div>
      </aside>
    );
  }

  const effectiveUrgency = canopyOverride?.newUrgencyScore ?? property.urgencyScore;
  const tone = urgencyTone(effectiveUrgency);
  const originalTone = urgencyTone(property.urgencyScore);
  const ndvi = ndviTag(canopyOverride?.ndviScore ?? property.ndviScore);
  const isSelected = selectedIds.has(property.id);
  const urgencyChanged = canopyOverride && canopyOverride.newUrgencyScore !== property.urgencyScore;
  const urgencyHigher = canopyOverride && canopyOverride.newUrgencyScore > property.urgencyScore;

  async function handleRescoreCanopy() {
    if (!property) return;
    setCanopyLoading(true);
    setCanopyError(null);
    try {
      const res = await fetch("/api/agents/canopy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ propertyId: property.id }),
      });
      if (!res.ok) throw new Error(`Canopy rescore failed: ${res.status}`);
      const data: { traceId: string; result: CanopyResult } = await res.json();
      useAgentStore.getState().setCanopyOverride(property.id, data.result);
    } catch (e) {
      setCanopyError(e instanceof Error ? e.message : "Canopy rescore failed");
    } finally {
      setCanopyLoading(false);
    }
  }

  async function handleGenerateOutreach() {
    if (!property) return;
    const streamId = property.id;
    setOutreachLoading(true);
    setOutreachError(null);
    setCopied(false);
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    // Reset any previous partial for this stream
    useAgentStore.setState((s) => ({
      streaming: { ...s.streaming, [streamId]: "" },
    }));
    useAgentStore.getState().setActiveStream(streamId);

    try {
      const res = await fetch("/api/agents/outreach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ propertyId: property.id, useStorm: true }),
        signal: ctrl.signal,
      });
      if (!res.ok || !res.body) throw new Error(`Outreach stream failed: ${res.status}`);

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let full = "";
      let done = false;

      while (!done) {
        const chunk = await reader.read();
        done = chunk.done;
        if (chunk.value) buffer += decoder.decode(chunk.value, { stream: true });

        // Parse SSE lines from the buffer
        let nlIdx: number;
        while ((nlIdx = buffer.indexOf("\n")) !== -1) {
          const line = buffer.slice(0, nlIdx).trimEnd();
          buffer = buffer.slice(nlIdx + 1);
          if (!line.startsWith("data:")) continue;
          const payload = line.slice(5).trim();
          if (!payload) continue;
          try {
            const evt: { chunk?: string; done?: { traceId: string; full: string } } = JSON.parse(payload);
            if (typeof evt.chunk === "string") {
              full += evt.chunk;
              useAgentStore.getState().appendStream(streamId, evt.chunk);
            }
            if (evt.done) {
              full = evt.done.full ?? full;
            }
          } catch {
            // skip non-JSON SSE lines
          }
        }
      }

      useAgentStore.getState().setOutreach(streamId, full);
    } catch (e) {
      if ((e as { name?: string }).name === "AbortError") return;
      setOutreachError(e instanceof Error ? e.message : "Outreach stream failed");
    } finally {
      setOutreachLoading(false);
      useAgentStore.getState().setActiveStream(null);
    }
  }

  async function handleCallOwner() {
    if (!property) return;
    setVoiceLoading(true);
    setVoiceChip(null);
    if (voiceTimerRef.current) {
      clearTimeout(voiceTimerRef.current);
      voiceTimerRef.current = null;
    }
    try {
      const res = await fetch("/api/agents/voice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ propertyId: property.id, useStorm: true }),
      });
      if (!res.ok) {
        const errJson = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(errJson.error ?? `Call failed: ${res.status}`);
      }
      const data: { traceId: string; result: VoiceResult } = await res.json();
      setVoiceChip(data.result);
    } catch (e) {
      setVoiceChip({ status: "error", message: e instanceof Error ? e.message : "Call failed" });
    } finally {
      setVoiceLoading(false);
      voiceTimerRef.current = setTimeout(() => setVoiceChip(null), 6000);
    }
  }

  async function handleCopyOutreach() {
    const text = finishedOutreach ?? streamingText;
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // ignore
    }
  }

  const displayText = streamingText || finishedOutreach || "";
  const showOutreachBox = outreachLoading || displayText.length > 0;

  return (
    <aside className="relative flex h-full flex-col overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--panel)]">
      <div className="absolute inset-x-0 top-0 h-[2px]" style={{ background: tone.color }} />
      <div className="flex items-start justify-between gap-3 border-b border-[var(--border)] px-4 pb-3 pt-4">
        <div className="min-w-0">
          <h2 className="font-display truncate text-lg text-[var(--text)]">{property.address}</h2>
          <p className="mt-0.5 text-xs text-[var(--text-dim)]">{property.neighborhood}</p>
        </div>
        <button
          type="button"
          onClick={() => setActiveProperty(null)}
          aria-label="Close detail panel"
          className="rounded p-1 text-[var(--text-dim)] transition hover:bg-[var(--panel-2)] hover:text-[var(--text)]"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M1 1L13 13M13 1L1 13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        <PropertySatelliteImage lat={property.lat} lng={property.lng} zoom={19} className="mb-3" />

        <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-4">
          <Stat label="Owner">{property.ownerName}</Stat>
          <Stat label="Urgency">
            <span className="flex flex-wrap items-baseline gap-2">
              {urgencyChanged ? (
                <>
                  <span className="font-mono text-sm text-[var(--text-dim)] line-through">
                    {property.urgencyScore}
                  </span>
                  <span
                    className="font-mono text-2xl font-bold"
                    style={{ color: urgencyHigher ? "var(--accent-red)" : tone.color }}
                  >
                    {canopyOverride!.newUrgencyScore}
                  </span>
                </>
              ) : (
                <span className="font-mono text-2xl font-semibold" style={{ color: originalTone.color }}>
                  {property.urgencyScore}
                </span>
              )}
              <span
                className="rounded px-1.5 py-0.5 text-[9px] font-semibold tracking-wider"
                style={{ background: `${tone.color}22`, color: tone.color }}
              >
                {tone.label}
              </span>
              {canopyOverride && (
                <span className="rounded border border-[var(--accent)] bg-[var(--accent)]/10 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-[var(--accent)]">
                  AI-rescored
                </span>
              )}
            </span>
            {canopyOverride && (
              <span className="mt-1 block text-[10px] text-[var(--text-dim)]">
                {canopyOverride.damageClass} · {(canopyOverride.confidence * 100).toFixed(0)}% conf
              </span>
            )}
          </Stat>
          <Stat label="Trees">
            <span className="font-mono">{property.treeCount}</span> trees detected
          </Stat>
          <Stat label="NDVI">
            <span className="flex items-baseline gap-2">
              <span className="font-mono text-sm">{canopyOverride?.ndviScore ?? property.ndviScore}</span>
              <span
                className="rounded px-1.5 py-0.5 text-[9px] font-semibold tracking-wider"
                style={{ background: `${ndvi.color}22`, color: ndvi.color }}
              >
                {ndvi.label}
              </span>
            </span>
          </Stat>
          <Stat label="Storm distance">
            <span className="font-mono">{property.stormProximityMiles.toFixed(1)}</span> mi from declaration zone
          </Stat>
          <Stat label="ZIP">
            <span className="font-mono">{property.zipCode}</span>
          </Stat>
        </div>

        <ForecastWidget lat={property.lat} lng={property.lng} propertyId={property.id} />

        {/* AI Agents section */}
        <div className="mt-6">
          <div className="flex items-center gap-2">
            <span className="font-display text-[10px] uppercase tracking-[0.18em] text-[var(--text-dim)]">
              AI Agents
            </span>
            <span className="h-px flex-1 bg-[var(--border)]" />
          </div>

          <div className="mt-3 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={handleRescoreCanopy}
              disabled={canopyLoading}
              className="rounded border border-[var(--accent)] bg-[var(--accent)]/10 px-3 py-2 text-xs font-medium text-[var(--accent)] transition hover:bg-[var(--accent)]/20 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {canopyLoading ? "Scoring…" : "🔬 Re-score canopy"}
            </button>
            <button
              type="button"
              onClick={handleGenerateOutreach}
              disabled={outreachLoading}
              className="rounded border border-[#3b82f6] bg-[#3b82f6]/10 px-3 py-2 text-xs font-medium text-[#3b82f6] transition hover:bg-[#3b82f6]/20 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {outreachLoading ? "Streaming…" : "✨ Generate outreach"}
            </button>
            <button
              type="button"
              onClick={handleCallOwner}
              disabled={voiceLoading}
              className="col-span-2 rounded border border-[#a855f7] bg-[#a855f7]/10 px-3 py-2 text-xs font-medium text-[#a855f7] transition hover:bg-[#a855f7]/20 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {voiceLoading ? (
                <span className="inline-flex items-center gap-2">
                  <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
                  Calling…
                </span>
              ) : (
                "📞 Call Owner"
              )}
            </button>
          </div>

          {voiceChip && voiceChip.status === "queued" && (
            <div className="mt-2 rounded border border-[var(--accent)] bg-[var(--accent)]/10 px-2 py-1.5 text-[11px] text-[var(--accent)]">
              ✓ Call placed to {voiceChip.to}
            </div>
          )}
          {voiceChip && voiceChip.status === "preview" && (
            <div className="mt-2 rounded border border-[var(--accent-amber)] bg-[var(--accent-amber)]/10 px-2 py-1.5 text-[11px] text-[var(--accent-amber)]">
              Preview only — set ENABLE_REAL_VOICE=1
            </div>
          )}
          {voiceChip && voiceChip.status === "error" && (
            <div className="mt-2 rounded border border-[var(--accent-red)] bg-[var(--accent-red)]/10 px-2 py-1.5 text-[11px] text-[var(--accent-red)]">
              {"message" in voiceChip ? voiceChip.message : voiceChip.spokenText}
            </div>
          )}

          {canopyError && (
            <div className="mt-2 rounded border border-[var(--accent-red)] bg-[var(--accent-red)]/10 px-2 py-1.5 text-[11px] text-[var(--accent-red)]">
              {canopyError}
            </div>
          )}
          {outreachError && (
            <div className="mt-2 rounded border border-[var(--accent-red)] bg-[var(--accent-red)]/10 px-2 py-1.5 text-[11px] text-[var(--accent-red)]">
              {outreachError}
            </div>
          )}

          {showOutreachBox && (
            <div className="mt-3">
              <div className="min-h-[140px] max-h-[240px] overflow-y-auto rounded border border-[var(--border)] bg-[var(--panel-2)] p-3 text-[11px] leading-relaxed text-[var(--text-secondary)] whitespace-pre-wrap">
                {displayText}
                {outreachLoading && (
                  <span className="ml-0.5 inline-block animate-pulse text-[var(--accent)]">▋</span>
                )}
              </div>
              {!outreachLoading && displayText.length > 0 && (
                <div className="mt-2 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleCopyOutreach}
                    className="rounded border border-[var(--border)] px-2 py-1 text-[10px] font-medium uppercase tracking-wider text-[var(--text-secondary)] transition hover:bg-[var(--panel-2)] hover:text-[var(--text)]"
                  >
                    {copied ? "Copied ✓" : "Copy"}
                  </button>
                  <span className="font-mono text-[10px] text-[var(--text-dim)]">
                    {displayText.length} chars
                  </span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2 border-t border-[var(--border)] p-3">
        <button
          type="button"
          onClick={() => toggleSelected(property.id)}
          className={`flex-1 rounded border px-3 py-2 text-xs font-medium transition ${
            isSelected
              ? "border-[var(--accent-red)] bg-[var(--accent-red)]/10 text-[var(--accent-red)] hover:bg-[var(--accent-red)]/20"
              : "border-[var(--accent)] bg-[var(--accent)]/10 text-[var(--accent)] hover:bg-[var(--accent)]/20"
          }`}
        >
          {isSelected ? "Remove from mail list" : "Add to mail list"}
        </button>
        <button
          type="button"
          onClick={() => setActiveProperty(null)}
          className="rounded border border-[var(--border)] px-3 py-2 text-xs font-medium text-[var(--text-secondary)] transition hover:bg-[var(--panel-2)] hover:text-[var(--text)]"
        >
          Close
        </button>
      </div>
    </aside>
  );
}
