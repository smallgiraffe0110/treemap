// Outreach agent — generates personalized direct-mail copy.
// Exposes both a one-shot (non-streaming) and an async generator (streaming) API.

import type { FemaDeclaration, Property } from "@/types";
import { call, callStream } from "./client";
import { outreachSystem, outreachUser } from "./prompts";
import {
  completeStreamTrace,
  emitStreamTrace,
  withTrace,
} from "./weave";

export async function writeOutreach(
  p: Property,
  decl: FemaDeclaration | null,
): Promise<{ traceId: string; result: string }> {
  return withTrace(
    {
      agent: "outreach",
      op: "writeOutreach",
      inputSummary: `${p.ownerName} — ${p.address}`,
    },
    async () => {
      const res = await call({
        system: outreachSystem(),
        user: outreachUser(p, decl),
        maxTokens: 500,
        temperature: 0.7,
      });
      return {
        result: res.text.trim(),
        summary: res.text.split("\n").find((l) => l.trim()) ?? "",
        tokensIn: res.tokensIn,
        tokensOut: res.tokensOut,
        model: res.model,
        provider: res.provider,
      };
    },
  );
}

export interface StreamChunk {
  chunk?: string;
  done?: { traceId: string; full: string };
}

export async function* streamOutreach(
  p: Property,
  decl: FemaDeclaration | null,
): AsyncGenerator<StreamChunk, void, void> {
  const trace = emitStreamTrace({
    agent: "outreach",
    op: "streamOutreach",
    inputSummary: `${p.ownerName} — ${p.address}`,
  });

  let full = "";
  try {
    const stream = callStream({
      system: outreachSystem(),
      user: outreachUser(p, decl),
      maxTokens: 500,
      temperature: 0.7,
    });
    // Drain the generator and capture the final return value (tokens/model/provider).
    let finalResult: Awaited<ReturnType<typeof call>> | undefined;
    while (true) {
      const step = await stream.next();
      if (step.done) {
        finalResult = step.value;
        break;
      }
      full += step.value;
      yield { chunk: step.value };
    }
    completeStreamTrace(trace.id, {
      status: "success",
      outputSummary: full.split("\n").find((l) => l.trim()) ?? "",
      tokensIn: finalResult?.tokensIn,
      tokensOut: finalResult?.tokensOut,
      model: finalResult?.model,
      provider: finalResult?.provider,
    });
    yield { done: { traceId: trace.id, full } };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    completeStreamTrace(trace.id, { status: "error", error: message });
    throw err;
  }
}
