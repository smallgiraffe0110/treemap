import { NextRequest, NextResponse } from "next/server";
import { fetchForecast } from "@/lib/weather/forecast";

export const revalidate = 3600;

export async function GET(req: NextRequest) {
  const lat = Number(req.nextUrl.searchParams.get("lat"));
  const lng = Number(req.nextUrl.searchParams.get("lng"));
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return NextResponse.json({ error: "lat,lng required" }, { status: 400 });
  }
  const days = await fetchForecast(lat, lng);
  return NextResponse.json({ days });
}
