import { NextResponse } from "next/server";
import { listTraces } from "@/lib/agents";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({ traces: listTraces(50) });
}
