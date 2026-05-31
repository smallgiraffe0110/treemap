import { streamOutreach } from "@/lib/agents";
import { BOSTON_PROPERTIES } from "@/data/bostonProperties";
import { TREE_DESTROYER } from "@/data/featuredStorm";

export const runtime = "nodejs";

export async function POST(req: Request): Promise<Response> {
  const body = (await req.json().catch(() => ({}))) as {
    propertyId?: string;
    useStorm?: boolean;
  };
  const property = body.propertyId
    ? BOSTON_PROPERTIES.find((p) => p.id === body.propertyId)
    : undefined;
  if (!property) {
    return new Response(JSON.stringify({ error: "property not found" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }
  const decl = body.useStorm === false ? null : TREE_DESTROYER;
  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        for await (const event of streamOutreach(property, decl)) {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify(event)}\n\n`),
          );
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : "stream error";
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ error: message })}\n\n`),
        );
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
