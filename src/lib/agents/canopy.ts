// Canopy agent — scores a single property's tree-canopy damage post-storm.

import type { CanopyResult, Property } from "@/types";
import { call } from "./client";
import { canopySystem, canopyUser } from "./prompts";
import { withTrace } from "./weave";

function parseJsonish<T>(raw: string): T {
  let s = raw.trim();
  // Strip ```json ... ``` or ``` ... ``` fences if a model added them anyway.
  if (s.startsWith("```")) {
    s = s.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "");
  }
  // Some models prepend a single explanatory line; isolate the JSON object.
  const first = s.indexOf("{");
  const last = s.lastIndexOf("}");
  if (first > 0 && last > first) s = s.slice(first, last + 1);
  return JSON.parse(s) as T;
}

function clamp01_100(n: number): number {
  if (Number.isNaN(n)) return 0;
  return Math.max(0, Math.min(100, n));
}

interface CanopyRaw {
  ndviScore: number;
  damageClass: CanopyResult["damageClass"];
  confidence: number;
  rationale: string;
}

export async function scoreCanopy(
  p: Property,
): Promise<{ traceId: string; result: CanopyResult }> {
  return withTrace(
    { agent: "canopy", op: "scoreCanopy", inputSummary: p.address },
    async () => {
      const res = await call({
        system: canopySystem(),
        user: canopyUser(p, "Tree Destroyer"),
        json: true,
        maxTokens: 400,
        temperature: 0.2,
      });
      const parsed = parseJsonish<CanopyRaw>(res.text);
      // Blend revised canopy health with storm proximity into a 0-100 urgency.
      const newUrgency = clamp01_100(
        Math.round(
          ((100 - parsed.ndviScore) * 0.4 +
            Math.max(0, 10 - p.stormProximityMiles) * 6) *
            10,
        ) / 10,
      );
      const result: CanopyResult = {
        ndviScore: clamp01_100(parsed.ndviScore),
        damageClass: parsed.damageClass,
        confidence: Math.max(0, Math.min(1, parsed.confidence)),
        rationale: parsed.rationale,
        newUrgencyScore: newUrgency,
      };
      return {
        result,
        summary: `${result.damageClass} (${result.ndviScore} NDVI, ${(result.confidence * 100).toFixed(0)}% conf)`,
        tokensIn: res.tokensIn,
        tokensOut: res.tokensOut,
        model: res.model,
        provider: res.provider,
      };
    },
  );
}
