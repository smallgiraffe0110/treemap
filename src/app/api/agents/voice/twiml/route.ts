import { NextRequest } from "next/server";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const text =
    req.nextUrl.searchParams.get("text") ||
    "Hello from TreeMap. We noticed storm damage near your property.";
  // Escape XML
  const safe = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Joanna" language="en-US">${safe}</Say>
  <Pause length="1"/>
  <Say voice="Polly.Joanna" language="en-US">If you'd like a free assessment, press 1 to be contacted. Otherwise, have a great day.</Say>
  <Gather numDigits="1" timeout="6" action="/api/agents/voice/twiml/result"/>
</Response>`;
  return new Response(xml, { headers: { "Content-Type": "text/xml; charset=utf-8" } });
}

export async function POST(req: NextRequest) {
  // Allow POST too (Twilio sometimes uses POST)
  return GET(req);
}
