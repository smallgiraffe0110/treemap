import { NextResponse } from "next/server";
import { fetchMaActiveAlerts } from "@/lib/weather/nws";

export const revalidate = 600;

export async function GET() {
  const features = await fetchMaActiveAlerts();
  return NextResponse.json({ type: "FeatureCollection", features });
}
