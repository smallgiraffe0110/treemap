import { NextResponse } from "next/server";
import { fetchMaStormDeclarations } from "@/lib/fema";

export const revalidate = 3600;

export async function GET() {
  const declarations = await fetchMaStormDeclarations();
  return NextResponse.json({ declarations });
}
