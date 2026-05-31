// Prompt templates for every agent. Kept as functions so we can interpolate
// dataset context. All system prompts are tight, voice-controlled, and
// demo-worthy (no AI clichés).

import type { FemaDeclaration, Property } from "@/types";

export function canopySystem(): string {
  return [
    "You are an arborist AI analyzing satellite imagery and on-the-ground signals",
    "to score residential tree canopy health after major storms in Greater Boston.",
    "You are precise, calibrated, and avoid hedging.",
    "Output strict JSON matching the requested schema. No prose.",
  ].join(" ");
}

export function canopyUser(p: Property, stormName: string): string {
  return [
    `Property: ${p.address}, ${p.neighborhood}, ${p.city} ${p.zipCode}.`,
    `Tree count on lot: ${p.treeCount}.`,
    `Current NDVI score: ${p.ndviScore} (0=dead canopy, 100=lush).`,
    `Distance to "${stormName}" storm cell: ${p.stormProximityMiles} miles.`,
    `Existing urgency score: ${p.urgencyScore}.`,
    ``,
    `Analyze this property's canopy. Return JSON with keys:`,
    `  "ndviScore": integer 0-100 (your revised estimate after storm),`,
    `  "damageClass": one of "fallen" | "leaning" | "thinning" | "healthy",`,
    `  "confidence": float 0-1,`,
    `  "rationale": one sentence (max 140 chars) tying the call to specifics.`,
  ].join("\n");
}

export function outreachSystem(): string {
  return [
    "You write warm, concise direct-mail copy from a Boston tree service company",
    "to homeowners whose properties may have suffered storm damage.",
    "Voice: friendly local pro — like a neighbor who happens to climb trees for a living.",
    "Hard rules: no AI clichés ('delve', 'robust', 'navigate', 'leverage', 'in today's world'),",
    "no exclamation marks beyond one in the CTA, no emoji, no all-caps.",
    "Reference the actual street and storm by name when given.",
    "Output four labeled sections separated by blank lines: GREETING, BODY, CTA, SIGNATURE.",
  ].join(" ");
}

export function outreachUser(
  p: Property,
  decl: FemaDeclaration | null,
): string {
  const stormLine = decl
    ? `A recent FEMA-declared storm hit ${decl.designatedArea} on ${decl.declarationDate.slice(0, 10)} — "${decl.title}".`
    : `No specific storm referenced — speak generally about recent New England weather.`;
  return [
    `Owner: ${p.ownerName}`,
    `Address: ${p.address}, ${p.neighborhood}, ${p.city} ${p.zipCode}`,
    `Trees on lot: ${p.treeCount}. NDVI canopy health: ${p.ndviScore}/100.`,
    stormLine,
    ``,
    `Write the four sections. BODY must be 2-3 sentences and must mention their street by name.`,
    `CTA: a single soft sentence inviting a free 15-minute walkthrough.`,
    `SIGNATURE: a single line ending with "— TreeMap Boston".`,
  ].join("\n");
}

export function impactSystem(): string {
  return [
    "You analyze storm impact across Greater Boston neighborhoods using FEMA",
    "declarations plus a list of monitored properties.",
    "Be specific and decisive. Output strict JSON only.",
  ].join(" ");
}

export function impactUser(
  decls: FemaDeclaration[],
  properties: Property[],
): string {
  // Summarize the property dataset to keep the prompt compact.
  const byHood = new Map<string, { count: number; topUrgency: number }>();
  for (const p of properties) {
    const cur = byHood.get(p.neighborhood) ?? { count: 0, topUrgency: 0 };
    cur.count += 1;
    cur.topUrgency = Math.max(cur.topUrgency, p.urgencyScore);
    byHood.set(p.neighborhood, cur);
  }
  const hoodLines = Array.from(byHood.entries())
    .map(
      ([n, v]) => `  - ${n}: ${v.count} properties, peak urgency ${v.topUrgency.toFixed(1)}`,
    )
    .join("\n");

  const worst = [...properties]
    .sort((a, b) => b.urgencyScore - a.urgencyScore)
    .slice(0, 8)
    .map(
      (p) =>
        `  - ${p.id} ${p.address} (${p.neighborhood}) urgency=${p.urgencyScore.toFixed(1)}`,
    )
    .join("\n");

  const declLines = decls
    .slice(0, 8)
    .map(
      (d) =>
        `  - ${d.id} ${d.designatedArea} ${d.declarationDate.slice(0, 10)} — ${d.title}`,
    )
    .join("\n");

  return [
    `FEMA declarations:`,
    declLines || "  (none)",
    ``,
    `Property dataset by neighborhood:`,
    hoodLines,
    ``,
    `Highest-urgency properties:`,
    worst,
    ``,
    `Return JSON with keys:`,
    `  "countyRankings": array of { "county": string, "affectedCount": int, "severity": 0-100, "reason": one sentence }`,
    `    — rank 3-5 counties from worst to least.`,
    `  "summary": one paragraph (max 4 sentences) framing the operational picture.`,
    `  "hottestPropertyIds": array of exactly 5 property ids from the list above, ordered worst first.`,
  ].join("\n");
}
