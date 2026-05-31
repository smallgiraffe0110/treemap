import { NextResponse } from "next/server";
import { analyzeImpact } from "@/lib/agents";
import { BOSTON_PROPERTIES } from "@/data/bostonProperties";
import { TREE_DESTROYER_FAMILY } from "@/data/featuredStorm";
import { fetchMaStormDeclarations } from "@/lib/fema";

export const runtime = "nodejs";

export async function POST() {
  try {
    const live = await fetchMaStormDeclarations();
    const decls = [...TREE_DESTROYER_FAMILY, ...live];
    const { traceId, result } = await analyzeImpact(decls, BOSTON_PROPERTIES);
    return NextResponse.json({ traceId, result });
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
