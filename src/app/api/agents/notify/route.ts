import { NextResponse } from "next/server";
import { notifyOwners } from "@/lib/agents";
import { BOSTON_PROPERTIES } from "@/data/bostonProperties";
import { TREE_DESTROYER_FAMILY } from "@/data/featuredStorm";
import { fetchMaStormDeclarations } from "@/lib/fema";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as {
    declarationId?: string;
    neighborhoods?: string[];
  };
  if (!body.declarationId) {
    return NextResponse.json({ error: "declarationId required" }, { status: 400 });
  }
  let decl = TREE_DESTROYER_FAMILY.find((d) => d.id === body.declarationId);
  if (!decl) {
    const live = await fetchMaStormDeclarations();
    decl = live.find((d) => d.id === body.declarationId);
  }
  if (!decl) {
    return NextResponse.json({ error: "declaration not found" }, { status: 404 });
  }
  const neighborhoods = body.neighborhoods?.length ? new Set(body.neighborhoods) : null;
  const filtered = neighborhoods
    ? BOSTON_PROPERTIES.filter((p) => neighborhoods.has(p.neighborhood))
    : BOSTON_PROPERTIES;
  const ranked = [...filtered].sort((a, b) => b.urgencyScore - a.urgencyScore).slice(0, 10);
  try {
    const { traceId, result } = await notifyOwners(decl, ranked);
    return NextResponse.json({ traceId, result });
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
