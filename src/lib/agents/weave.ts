// In-process trace store with optional W&B Weave shipping.
// Server-side only. The store is bounded so long-running dev servers don't leak.

import type { AgentName, AgentStatus, AgentTrace } from "@/types";

const traces: AgentTrace[] = [];
const MAX = 200;

function genId(): string {
  return `tr_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function truncate(s: string, n = 200): string {
  return s.length > n ? `${s.slice(0, n - 1)}…` : s;
}

function weaveUrlFor(id: string): string {
  const entity = process.env.WANDB_ENTITY || "demo";
  const project = process.env.WANDB_PROJECT || "treemap-agents";
  return `https://wandb.ai/${entity}/${project}/weave/traces/${id}`;
}

// Best-effort, non-blocking ship to W&B. The Weave HTTP API requires
// authenticated trace creation; in production this would be the SDK call.
// We log here and shape the payload so swapping to a real network call is trivial.
function shipToWeave(trace: AgentTrace): void {
  if (!process.env.WANDB_API_KEY) return;
  try {
    // Shape mirrors the Weave SDK call payload — would POST in production.
    const payload = {
      project: process.env.WANDB_PROJECT || "treemap-agents",
      entity: process.env.WANDB_ENTITY || "demo",
      op_name: `${trace.agent}.${trace.op}`,
      trace_id: trace.id,
      status: trace.status,
      started_at: trace.startedAt,
      ended_at: trace.endedAt,
      inputs: { summary: trace.inputSummary },
      outputs: { summary: trace.outputSummary, error: trace.error },
      summary: {
        usage: { input_tokens: trace.tokensIn, output_tokens: trace.tokensOut },
        cost_usd: trace.costUsd,
        model: trace.model,
        provider: trace.provider,
      },
    };
    console.log(`[weave] ship`, JSON.stringify(payload));
  } catch (err) {
    console.warn(`[weave] ship failed`, err);
  }
}

function push(trace: AgentTrace): void {
  traces.unshift(trace);
  if (traces.length > MAX) traces.length = MAX;
}

function replace(trace: AgentTrace): void {
  const idx = traces.findIndex((t) => t.id === trace.id);
  if (idx === -1) push(trace);
  else traces[idx] = trace;
}

export function listTraces(limit = 50): AgentTrace[] {
  return traces.slice(0, limit);
}

export interface WrapMeta {
  agent: AgentName;
  op: string;
  inputSummary: string;
}

export interface WrapPayload<T> {
  result: T;
  summary?: string;
  tokensIn?: number;
  tokensOut?: number;
  costUsd?: number;
  model?: string;
  provider?: "anthropic" | "coreweave" | "gemini";
}

// Rough cost estimate (USD): per-1M-token pricing per provider.
function estimateCost(
  provider: "anthropic" | "coreweave" | "gemini" | undefined,
  inTok?: number,
  outTok?: number,
): number | undefined {
  if (inTok == null && outTok == null) return undefined;
  const i = inTok ?? 0;
  const o = outTok ?? 0;
  if (provider === "anthropic") {
    return (i * 15) / 1_000_000 + (o * 75) / 1_000_000;
  }
  if (provider === "coreweave") {
    return (i * 0.5) / 1_000_000 + (o * 1.5) / 1_000_000;
  }
  if (provider === "gemini") {
    return (i * 0.3) / 1_000_000 + (o * 2.5) / 1_000_000;
  }
  return undefined;
}

export async function withTrace<T>(
  meta: WrapMeta,
  body: (trace: AgentTrace) => Promise<WrapPayload<T>>,
): Promise<{ traceId: string; result: T }> {
  const id = genId();
  const startedAt = Date.now();
  const initial: AgentTrace = {
    id,
    agent: meta.agent,
    op: meta.op,
    status: "running",
    startedAt,
    inputSummary: truncate(meta.inputSummary),
    weaveUrl: weaveUrlFor(id),
  };
  push(initial);

  try {
    const payload = await body(initial);
    const endedAt = Date.now();
    const final: AgentTrace = {
      ...initial,
      status: "success",
      endedAt,
      durationMs: endedAt - startedAt,
      outputSummary: payload.summary ? truncate(payload.summary) : undefined,
      tokensIn: payload.tokensIn,
      tokensOut: payload.tokensOut,
      costUsd:
        payload.costUsd ??
        estimateCost(payload.provider, payload.tokensIn, payload.tokensOut),
      model: payload.model,
      provider: payload.provider,
    };
    replace(final);
    shipToWeave(final);
    return { traceId: id, result: payload.result };
  } catch (err) {
    const endedAt = Date.now();
    const message = err instanceof Error ? err.message : String(err);
    const final: AgentTrace = {
      ...initial,
      status: "error",
      endedAt,
      durationMs: endedAt - startedAt,
      error: truncate(message),
    };
    replace(final);
    shipToWeave(final);
    throw err;
  }
}

export function emitStreamTrace(meta: WrapMeta): AgentTrace {
  const id = genId();
  const trace: AgentTrace = {
    id,
    agent: meta.agent,
    op: meta.op,
    status: "running",
    startedAt: Date.now(),
    inputSummary: truncate(meta.inputSummary),
    weaveUrl: weaveUrlFor(id),
  };
  push(trace);
  return trace;
}

export function completeStreamTrace(
  id: string,
  patch: Partial<AgentTrace>,
): void {
  const idx = traces.findIndex((t) => t.id === id);
  if (idx === -1) return;
  const existing = traces[idx];
  const endedAt = patch.endedAt ?? Date.now();
  const merged: AgentTrace = {
    ...existing,
    ...patch,
    endedAt,
    durationMs: endedAt - existing.startedAt,
    outputSummary: patch.outputSummary
      ? truncate(patch.outputSummary)
      : existing.outputSummary,
    error: patch.error ? truncate(patch.error) : existing.error,
    costUsd:
      patch.costUsd ??
      estimateCost(
        patch.provider ?? existing.provider,
        patch.tokensIn ?? existing.tokensIn,
        patch.tokensOut ?? existing.tokensOut,
      ),
    status: (patch.status ?? "success") as AgentStatus,
  };
  traces[idx] = merged;
  shipToWeave(merged);
}
