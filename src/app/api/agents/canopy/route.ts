import { NextResponse } from "next/server";
import { scoreCanopy } from "@/lib/agents";
import { BOSTON_PROPERTIES } from "@/data/bostonProperties";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { propertyId?: string };
  const id = body.propertyId;
  if (!id) {
    return NextResponse.json({ error: "propertyId required" }, { status: 400 });
  }
  const property = BOSTON_PROPERTIES.find((p) => p.id === id);
  if (!property) {
    return NextResponse.json({ error: "property not found" }, { status: 404 });
  }
  try {
    const { traceId, result } = await scoreCanopy(property);
    return NextResponse.json({ traceId, result });
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
