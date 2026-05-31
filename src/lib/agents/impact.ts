// Impact agent — single-shot county-level storm impact analysis.

import type { FemaDeclaration, ImpactReport, Property } from "@/types";
import { call } from "./client";
import { impactSystem, impactUser } from "./prompts";
import { withTrace } from "./weave";

function parseJsonish<T>(raw: string): T {
  let s = raw.trim();
  if (s.startsWith("```")) {
    s = s.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "");
  }
  const first = s.indexOf("{");
  const last = s.lastIndexOf("}");
  if (first > 0 && last > first) s = s.slice(first, last + 1);
  return JSON.parse(s) as T;
}

export async function analyzeImpact(
  decls: FemaDeclaration[],
  properties: Property[],
): Promise<{ traceId: string; result: ImpactReport }> {
  return withTrace(
    {
      agent: "impact",
      op: "analyzeImpact",
      inputSummary: `${decls.length} declarations, ${properties.length} properties`,
    },
    async () => {
      const res = await call({
        system: impactSystem(),
        user: impactUser(decls, properties),
        json: true,
        maxTokens: 900,
        temperature: 0.3,
      });
      const parsed = parseJsonish<ImpactReport>(res.text);
      const result: ImpactReport = {
        countyRankings: Array.isArray(parsed.countyRankings)
          ? parsed.countyRankings
          : [],
        summary: parsed.summary ?? "",
        hottestPropertyIds: Array.isArray(parsed.hottestPropertyIds)
          ? parsed.hottestPropertyIds.slice(0, 5)
          : [],
      };
      const top = result.countyRankings[0];
      return {
        result,
        summary: top
          ? `worst: ${top.county} (severity ${top.severity})`
          : "impact report",
        tokensIn: res.tokensIn,
        tokensOut: res.tokensOut,
        model: res.model,
        provider: res.provider,
      };
    },
  );
}
