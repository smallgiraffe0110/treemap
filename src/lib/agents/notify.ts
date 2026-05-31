// Notify agent — generates and (optionally) sends outreach emails to a batch of owners.
// Defaults to preview-only; real sends gate on ENABLE_REAL_EMAIL=1 + RESEND_API_KEY.

import { Resend } from "resend";
import type { FemaDeclaration, NotifyResult, Property } from "@/types";
import { call } from "./client";
import { outreachSystem, outreachUser } from "./prompts";
import { withTrace } from "./weave";

const MAX_OWNERS = 10;

function ownerEmail(name: string): string {
  const cleaned = name
    .toLowerCase()
    .replace(/[^a-z\s'-]/g, "")
    .trim()
    .replace(/[\s'-]+/g, ".");
  return `${cleaned || "owner"}@example.com`;
}

function deriveSubject(body: string, p: Property): string {
  const first = body.split("\n").find((l) => l.trim() && !/^GREETING/i.test(l));
  if (first && first.length < 80) return first.trim();
  return `Quick check on the trees at ${p.address}`;
}

interface OwnerEmail {
  to: string;
  subject: string;
  body: string;
}

async function draftEmail(
  p: Property,
  decl: FemaDeclaration,
): Promise<OwnerEmail> {
  const res = await call({
    system: outreachSystem(),
    user: outreachUser(p, decl),
    maxTokens: 400,
    temperature: 0.7,
  });
  const body = res.text.trim();
  return {
    to: process.env.NOTIFY_TEST_TO ?? ownerEmail(p.ownerName),
    subject: deriveSubject(body, p),
    body,
  };
}

export async function notifyOwners(
  decl: FemaDeclaration,
  properties: Property[],
): Promise<{ traceId: string; result: NotifyResult }> {
  const batch = properties.slice(0, MAX_OWNERS);
  const realSend =
    process.env.ENABLE_REAL_EMAIL === "1" && Boolean(process.env.RESEND_API_KEY);

  return withTrace(
    {
      agent: "notify",
      op: "notifyOwners",
      inputSummary: `${decl.designatedArea} — ${batch.length} owners`,
    },
    async () => {
      const drafts = await Promise.all(batch.map((p) => draftEmail(p, decl)));

      let sent = 0;
      let previewed = 0;
      const preview: OwnerEmail[] = [];

      if (realSend) {
        const resend = new Resend(process.env.RESEND_API_KEY);
        const from = process.env.NOTIFY_FROM || "onboarding@resend.dev";
        for (const email of drafts) {
          try {
            await resend.emails.send({
              from,
              to: email.to,
              subject: email.subject,
              text: email.body,
            });
            sent += 1;
          } catch (err) {
            // Soft-fail: surface as preview so the UI can still show the draft.
            console.warn(`[notify] resend send failed`, err);
            previewed += 1;
            preview.push(email);
          }
        }
      } else {
        previewed = drafts.length;
        preview.push(...drafts);
      }

      const result: NotifyResult = { sent, previewed, preview, realSend };
      return {
        result,
        summary: `${sent} sent / ${previewed} preview`,
      };
    },
  );
}
