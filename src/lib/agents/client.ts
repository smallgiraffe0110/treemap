// Unified LLM client. Provider precedence: CoreWeave > Gemini > Anthropic.
// Server-side only.

import Anthropic from "@anthropic-ai/sdk";

export type Provider = "anthropic" | "coreweave" | "gemini";

export interface ClientConfig {
  provider: Provider;
  model: string;
}

export function resolveProvider(): ClientConfig {
  if (process.env.COREWEAVE_BASE_URL && process.env.COREWEAVE_API_KEY) {
    return {
      provider: "coreweave",
      model:
        process.env.COREWEAVE_MODEL ||
        "meta-llama/Meta-Llama-3.1-70B-Instruct",
    };
  }
  if (process.env.GEMINI_API_KEY) {
    return {
      provider: "gemini",
      model: process.env.GEMINI_MODEL || "gemini-2.5-flash",
    };
  }
  if (process.env.ANTHROPIC_API_KEY) {
    return { provider: "anthropic", model: "claude-opus-4-7" };
  }
  throw new Error(
    "No LLM provider configured — set GEMINI_API_KEY, ANTHROPIC_API_KEY, or COREWEAVE_BASE_URL+COREWEAVE_API_KEY",
  );
}

export interface CallOpts {
  system: string;
  user: string;
  maxTokens?: number;
  temperature?: number;
  json?: boolean;
}

export interface CallResult {
  text: string;
  tokensIn?: number;
  tokensOut?: number;
  model: string;
  provider: Provider;
}

const JSON_NUDGE =
  "\n\nRespond with ONLY a single valid JSON object, no markdown fences, no commentary.";

function estimateTokens(s: string): number {
  return Math.max(1, Math.ceil(s.length / 4));
}

// ─── CoreWeave (OpenAI-compatible) helpers ───────────────────

interface OpenAIChatResponse {
  choices?: Array<{ message?: { content?: string | null } }>;
  usage?: { prompt_tokens?: number; completion_tokens?: number };
}

function cwHeaders(): HeadersInit {
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${process.env.COREWEAVE_API_KEY}`,
  };
}

function cwBody(
  cfg: ClientConfig,
  opts: CallOpts,
  system: string,
  stream: boolean,
): string {
  const body: Record<string, unknown> = {
    model: cfg.model,
    messages: [
      { role: "system", content: system },
      { role: "user", content: opts.user },
    ],
    max_tokens: opts.maxTokens ?? 800,
    temperature: opts.temperature ?? 0.4,
    stream,
  };
  if (opts.json) body.response_format = { type: "json_object" };
  return JSON.stringify(body);
}

// ─── Gemini helpers ──────────────────────────────────────────

interface GeminiPart { text?: string }
interface GeminiCandidate { content?: { parts?: GeminiPart[] } }
interface GeminiResponse {
  candidates?: GeminiCandidate[];
  usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number };
}

function geminiUrl(model: string, stream: boolean): string {
  const method = stream ? "streamGenerateContent" : "generateContent";
  const sse = stream ? "&alt=sse" : "";
  const key = process.env.GEMINI_API_KEY!;
  return `https://generativelanguage.googleapis.com/v1beta/models/${model}:${method}?key=${encodeURIComponent(key)}${sse}`;
}

function geminiBody(opts: CallOpts, system: string): string {
  const body: Record<string, unknown> = {
    systemInstruction: { parts: [{ text: system }] },
    contents: [{ role: "user", parts: [{ text: opts.user }] }],
    generationConfig: {
      temperature: opts.temperature ?? 0.4,
      maxOutputTokens: opts.maxTokens ?? 800,
      // Disable Gemini 2.5 thinking — it consumes output budget and truncates JSON.
      thinkingConfig: { thinkingBudget: 0 },
      ...(opts.json ? { responseMimeType: "application/json" } : {}),
    },
  };
  return JSON.stringify(body);
}

function extractGeminiText(data: GeminiResponse): string {
  const parts = data.candidates?.[0]?.content?.parts ?? [];
  return parts.map((p) => p.text ?? "").join("");
}

// ─── Public API ──────────────────────────────────────────────

export async function call(opts: CallOpts): Promise<CallResult> {
  const cfg = resolveProvider();
  const system = opts.json ? opts.system + JSON_NUDGE : opts.system;
  const maxTokens = opts.maxTokens ?? 800;
  const temperature = opts.temperature ?? 0.4;

  if (cfg.provider === "anthropic") {
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const resp = await client.messages.create({
      model: cfg.model,
      max_tokens: maxTokens,
      temperature,
      system,
      messages: [{ role: "user", content: opts.user }],
    });
    const text = resp.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("");
    return {
      text,
      tokensIn: resp.usage?.input_tokens,
      tokensOut: resp.usage?.output_tokens,
      model: resp.model,
      provider: "anthropic",
    };
  }

  if (cfg.provider === "gemini") {
    const res = await fetch(geminiUrl(cfg.model, false), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: geminiBody({ ...opts, temperature, maxTokens }, system),
    });
    if (!res.ok) throw new Error(`Gemini error ${res.status}: ${await res.text()}`);
    const data = (await res.json()) as GeminiResponse;
    const text = extractGeminiText(data);
    return {
      text,
      tokensIn: data.usageMetadata?.promptTokenCount ?? estimateTokens(system + opts.user),
      tokensOut: data.usageMetadata?.candidatesTokenCount ?? estimateTokens(text),
      model: cfg.model,
      provider: "gemini",
    };
  }

  // CoreWeave / OpenAI-compatible path.
  const res = await fetch(`${process.env.COREWEAVE_BASE_URL}/v1/chat/completions`, {
    method: "POST",
    headers: cwHeaders(),
    body: cwBody(cfg, opts, system, false),
  });
  if (!res.ok) {
    throw new Error(`CoreWeave error ${res.status}: ${await res.text()}`);
  }
  const data = (await res.json()) as OpenAIChatResponse;
  const text = data.choices?.[0]?.message?.content ?? "";
  return {
    text,
    tokensIn: data.usage?.prompt_tokens ?? estimateTokens(system + opts.user),
    tokensOut: data.usage?.completion_tokens ?? estimateTokens(text),
    model: cfg.model,
    provider: "coreweave",
  };
}

export async function* callStream(
  opts: CallOpts,
): AsyncGenerator<string, CallResult, void> {
  const cfg = resolveProvider();
  const system = opts.json ? opts.system + JSON_NUDGE : opts.system;
  const maxTokens = opts.maxTokens ?? 800;
  const temperature = opts.temperature ?? 0.4;

  if (cfg.provider === "anthropic") {
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const stream = client.messages.stream({
      model: cfg.model,
      max_tokens: maxTokens,
      temperature,
      system,
      messages: [{ role: "user", content: opts.user }],
    });
    let full = "";
    for await (const event of stream) {
      if (
        event.type === "content_block_delta" &&
        event.delta.type === "text_delta"
      ) {
        full += event.delta.text;
        yield event.delta.text;
      }
    }
    const finalMsg = await stream.finalMessage();
    return {
      text: full,
      tokensIn: finalMsg.usage?.input_tokens,
      tokensOut: finalMsg.usage?.output_tokens,
      model: finalMsg.model,
      provider: "anthropic",
    };
  }

  if (cfg.provider === "gemini") {
    const res = await fetch(geminiUrl(cfg.model, true), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: geminiBody({ ...opts, temperature, maxTokens }, system),
    });
    if (!res.ok || !res.body) {
      throw new Error(`Gemini stream error ${res.status}: ${!res.body ? "no body" : await res.text()}`);
    }
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let full = "";
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith("data:")) continue;
        const payload = trimmed.slice(5).trim();
        if (!payload || payload === "[DONE]") continue;
        try {
          const parsed = JSON.parse(payload) as GeminiResponse;
          const chunk = extractGeminiText(parsed);
          if (chunk) {
            full += chunk;
            yield chunk;
          }
        } catch {
          // ignore malformed frames
        }
      }
    }
    return {
      text: full,
      tokensIn: estimateTokens(system + opts.user),
      tokensOut: estimateTokens(full),
      model: cfg.model,
      provider: "gemini",
    };
  }

  // CoreWeave SSE streaming.
  const res = await fetch(`${process.env.COREWEAVE_BASE_URL}/v1/chat/completions`, {
    method: "POST",
    headers: cwHeaders(),
    body: cwBody(cfg, opts, system, true),
  });
  if (!res.ok || !res.body) {
    throw new Error(`CoreWeave stream error ${res.status}`);
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let full = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith("data:")) continue;
      const payload = trimmed.slice(5).trim();
      if (payload === "[DONE]") continue;
      try {
        const parsed = JSON.parse(payload) as {
          choices?: Array<{ delta?: { content?: string } }>;
        };
        const chunk = parsed.choices?.[0]?.delta?.content;
        if (chunk) {
          full += chunk;
          yield chunk;
        }
      } catch {
        // ignore malformed keepalive frames
      }
    }
  }
  return {
    text: full,
    tokensIn: estimateTokens(system + opts.user),
    tokensOut: estimateTokens(full),
    model: cfg.model,
    provider: "coreweave",
  };
}
