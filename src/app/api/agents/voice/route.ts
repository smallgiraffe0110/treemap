import { NextRequest, NextResponse } from "next/server";
import { BOSTON_PROPERTIES } from "@/data/bostonProperties";
import { TREE_DESTROYER } from "@/data/featuredStorm";
import { callOwner } from "@/lib/agents/voice";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as { propertyId?: string; useStorm?: boolean };
    const p = BOSTON_PROPERTIES.find((x) => x.id === body.propertyId);
    if (!p) return NextResponse.json({ error: "property not found" }, { status: 404 });
    const decl = body.useStorm !== false ? TREE_DESTROYER : null;
    const r = await callOwner(p, decl);
    return NextResponse.json(r);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
