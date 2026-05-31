import { NextRequest, NextResponse } from "next/server";
import { BOSTON_PROPERTIES } from "@/data/bostonProperties";
import { generateMailMergeHTML } from "@/lib/mailMerge";
import type { MailLabel, Property } from "@/types";

type ExportFormat = "csv" | "mailmerge";

interface ExportRequestBody {
  ids?: unknown;
}

function parseFormat(req: NextRequest): ExportFormat {
  const raw = req.nextUrl.searchParams.get("format");
  return raw === "mailmerge" ? "mailmerge" : "csv";
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((v) => typeof v === "string");
}

function csvEscape(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function todayStamp(): string {
  const d = new Date();
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function lookupProperties(ids: string[]): Property[] {
  const idSet = new Set(ids);
  const byId = new Map<string, Property>();
  for (const p of BOSTON_PROPERTIES) {
    if (idSet.has(p.id)) byId.set(p.id, p);
  }
  const ordered: Property[] = [];
  for (const id of ids) {
    const found = byId.get(id);
    if (found) ordered.push(found);
  }
  return ordered;
}

function buildCsv(properties: Property[]): string {
  const headers = ["Name", "Address", "City", "State", "ZIP", "UrgencyScore"];
  const lines = [headers.join(",")];
  for (const p of properties) {
    const row = [
      csvEscape(p.ownerName),
      csvEscape(p.address),
      csvEscape(p.city),
      "MA",
      csvEscape(p.zipCode),
      String(p.urgencyScore),
    ];
    lines.push(row.join(","));
  }
  return lines.join("\r\n");
}

function buildLabels(properties: Property[]): MailLabel[] {
  return properties.map((p) => ({
    ownerName: p.ownerName,
    address: p.address,
    city: p.city,
    state: "MA",
    zip: p.zipCode,
  }));
}

export async function POST(req: NextRequest) {
  let body: ExportRequestBody;
  try {
    body = (await req.json()) as ExportRequestBody;
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400 },
    );
  }

  if (!isStringArray(body.ids)) {
    return NextResponse.json(
      { error: "Body must include `ids: string[]`" },
      { status: 400 },
    );
  }

  const properties = lookupProperties(body.ids);
  const format = parseFormat(req);

  if (format === "mailmerge") {
    const html = generateMailMergeHTML(buildLabels(properties));
    return new NextResponse(html, {
      status: 200,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-store",
      },
    });
  }

  const csv = buildCsv(properties);
  const filename = `treemap_mail_list_${todayStamp()}.csv`;
  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}

export function GET() {
  return NextResponse.json(
    { error: "Use POST with { ids: string[] } and ?format=csv|mailmerge" },
    { status: 405 },
  );
}
