import { withTrace } from "./weave";
import { writeOutreach } from "./outreach";
import type { Property, FemaDeclaration, VoiceResult } from "@/types";

function fakePhoneFromOwner(ownerName: string): string {
  // Deterministic mock E.164 number from owner name. Used only for preview.
  let h = 0;
  for (let i = 0; i < ownerName.length; i++) h = (h * 31 + ownerName.charCodeAt(i)) >>> 0;
  const last4 = String(1000 + (h % 9000));
  return `+1617555${last4}`;
}

export async function callOwner(
  p: Property,
  decl: FemaDeclaration | null,
): Promise<{ traceId: string; result: VoiceResult }> {
  return withTrace(
    { agent: "voice", op: "callOwner", inputSummary: `${p.ownerName} @ ${p.address}` },
    async () => {
      // Generate the spoken script via the existing outreach agent (cached if possible).
      const { result: text } = await writeOutreach(p, decl);
      const spokenText = stripForVoice(text);

      const to = process.env.TWILIO_TEST_TO || fakePhoneFromOwner(p.ownerName);

      const wantReal =
        process.env.ENABLE_REAL_VOICE === "1" &&
        process.env.TWILIO_ACCOUNT_SID &&
        process.env.TWILIO_AUTH_TOKEN &&
        process.env.TWILIO_FROM_PHONE &&
        process.env.NEXT_PUBLIC_BASE_URL;

      if (!wantReal) {
        const res: VoiceResult = { status: "preview", to, spokenText, realCall: false };
        return { result: res, summary: `preview to ${to}` };
      }

      // Lazy-load twilio so Cloudflare Workers builds don't break (twilio is Node-only).
      const twimlUrl = `${process.env.NEXT_PUBLIC_BASE_URL}/api/agents/voice/twiml?text=${encodeURIComponent(spokenText)}`;
      try {
        const twilioMod = await import("twilio").catch(() => null);
        if (!twilioMod) {
          const res: VoiceResult = { status: "error", to, spokenText: "Twilio SDK unavailable in this runtime", realCall: true };
          return { result: res, summary: "twilio sdk unavailable" };
        }
        const twilio = (twilioMod as { default?: typeof import("twilio") }).default ?? twilioMod;
        const client = (twilio as unknown as (sid: string, token: string) => { calls: { create: (opts: { to: string; from: string; url: string }) => Promise<{ sid: string }> } })(
          process.env.TWILIO_ACCOUNT_SID!,
          process.env.TWILIO_AUTH_TOKEN!,
        );
        const call = await client.calls.create({
          to,
          from: process.env.TWILIO_FROM_PHONE!,
          url: twimlUrl,
        });
        const res: VoiceResult = {
          status: "queued",
          callSid: call.sid,
          to,
          spokenText,
          realCall: true,
        };
        return { result: res, summary: `queued ${call.sid}` };
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        const res: VoiceResult = { status: "error", to, spokenText: msg, realCall: true };
        return { result: res, summary: `error: ${msg}` };
      }
    },
  );
}

function stripForVoice(s: string): string {
  // Remove markdown / emojis for clean TTS. Cap length so we don't get a 3min call.
  const clean = s
    .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, "")
    .replace(/[*_`#>]/g, "")
    .replace(/\n{2,}/g, ". ")
    .replace(/\s+/g, " ")
    .trim();
  return clean.length > 600 ? clean.slice(0, 600) + "..." : clean;
}
