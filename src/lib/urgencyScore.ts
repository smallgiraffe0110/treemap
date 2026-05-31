export function computeUrgencyScore(
  ndviScore: number,
  stormProximityMiles: number,
): number {
  const raw = (100 - ndviScore) * 0.4 + (10 - stormProximityMiles) * 6;
  const clamped = Math.max(0, Math.min(100, raw));
  return Math.round(clamped);
}

export function urgencyTier(score: number): "hot" | "warm" | "cold" {
  if (score > 70) return "hot";
  if (score >= 40) return "warm";
  return "cold";
}

export function urgencyColor(score: number): string {
  const tier = urgencyTier(score);
  if (tier === "hot") return "#dc2626";
  if (tier === "warm") return "#f59e0b";
  return "#3b82f6";
}
