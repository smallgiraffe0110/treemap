# Lob Integration Spec

Add Lob (lob.com) as a third direct-mail export path alongside CSV download and Avery 5160 mail-merge. User selects properties in `MailExportPanel`, clicks **Send Postcards**, Lob prints + mails 4x6 postcards. Status synced back via webhook.

## Goals

- One-click postcard send for selected leads — no manual print/stuff/stamp.
- Address verification before send (catch bad addresses, save spend).
- Per-piece cost shown before charge (confirmation modal).
- Test mode default; explicit live-mode toggle.
- Webhook updates each lead with delivery status (`in_transit`, `delivered`, `returned_to_sender`, `failed`).
- No duplicate sends per (propertyId, campaignId) pair.

## Non-goals (v1)

- Letters, self-mailers, checks, or international.
- Per-recipient creative customization beyond merge variables.
- Multi-template A/B testing.
- Recurring campaigns / drip sequences.

## Lob product choice

**Postcards API** — `POST /v1/postcards`. 4x6 default, color, USPS First Class. ~$0.78/piece in volume (current Lob pricing — confirm at integration time).

- Template = HTML stored in Lob dashboard, referenced by `psc_*` template ID. Front + back separate.
- Merge variables: `{{owner_name}}`, `{{address}}`, `{{city}}`, `{{zip}}`, `{{neighborhood}}`, `{{tree_count}}`, `{{ndvi_score}}`, `{{urgency_score}}`.
- US Verifications API (`POST /v1/us_verifications`) pre-flight to reject undeliverable rows.

## Env vars

Add to `.env.example`:

```
# Lob — direct mail API
LOB_API_KEY=                       # test_* or live_*
LOB_POSTCARD_TEMPLATE_FRONT=       # psc_* template id (front)
LOB_POSTCARD_TEMPLATE_BACK=        # psc_* template id (back)
LOB_FROM_NAME=
LOB_FROM_COMPANY=
LOB_FROM_ADDRESS_LINE1=
LOB_FROM_ADDRESS_LINE2=
LOB_FROM_CITY=
LOB_FROM_STATE=
LOB_FROM_ZIP=
LOB_WEBHOOK_SECRET=                # for signature verification
```

`LOB_API_KEY` prefix (`test_` vs `live_`) drives mode. No code toggle — keying decides.

## File layout

```
src/
├── app/api/lob/
│   ├── verify/route.ts        # POST — pre-flight address verify (bulk)
│   ├── send/route.ts          # POST — create postcards
│   ├── quote/route.ts         # GET  — return per-piece + total cost estimate
│   └── webhook/route.ts       # POST — Lob status callbacks
├── lib/lob.ts                 # thin fetch wrapper (auth, retry, types)
├── lib/mailingsStore.ts       # JSONL persistence: .data/mailings.jsonl
└── types/index.ts             # add Mailing, MailingStatus types
```

No SDK dep. Use `fetch` with Basic auth (`Authorization: Basic <base64(API_KEY + ":")>`). Lob's official SDK is heavy and rarely worth the dep cost.

## Types (add to `src/types/index.ts`)

```ts
export type MailingStatus =
  | "queued"
  | "verified"
  | "verification_failed"
  | "sent"
  | "in_transit"
  | "in_local_area"
  | "processed_for_delivery"
  | "delivered"
  | "returned_to_sender"
  | "failed";

export interface Mailing {
  id: string;                     // local uuid
  lobId: string | null;           // psc_*
  propertyId: string;
  campaignId: string;
  status: MailingStatus;
  cost: number | null;            // cents
  expectedDeliveryDate: string | null;
  createdAt: string;
  updatedAt: string;
  errorMessage: string | null;
}
```

## API contracts

### `POST /api/lob/verify`

Request: `{ ids: string[] }`
Response: `{ results: { id: string; deliverable: boolean; reason?: string }[] }`

Looks up each property, calls Lob US Verifications, returns per-id verdict. Used by UI to disable bad rows before quote/send.

### `GET /api/lob/quote?count=<n>`

Response: `{ perPieceCents: number, totalCents: number, currency: "USD" }`

Hardcoded tiered pricing (Lob doesn't expose a price API). Recompute when count changes.

### `POST /api/lob/send`

Request:
```ts
{
  ids: string[];                 // property ids
  campaignId: string;            // user-supplied label, e.g. "2026-05-storm-jp"
  sendDate?: string;             // ISO; omit for immediate
  confirmed: true;               // server rejects if false (forces confirmation modal)
}
```

Behavior:
1. Load properties by id.
2. Reject any id already in `mailings.jsonl` with same `campaignId` (idempotent).
3. Verify addresses (skip ids already verified in last 30 days — cache by hash).
4. For each verified id: `POST /v1/postcards` with merge vars, `metadata.propertyId`, `metadata.campaignId`, `idempotency_key = sha256(propertyId + campaignId)`.
5. Append `Mailing` row per send to `mailings.jsonl`.
6. Return `{ sent: number, failed: number, mailings: Mailing[] }`.

Response status: 200 partial OK (per-row success/fail), 400 on schema error, 402 if Lob returns insufficient funds, 500 otherwise.

### `POST /api/lob/webhook`

Lob posts `postcard.created`, `postcard.rendered_pdf`, `postcard.in_transit`, `postcard.delivered`, `postcard.returned_to_sender`, `postcard.failed`.

1. Verify HMAC: `X-Lob-Signature` header = `sha256(LOB_WEBHOOK_SECRET, raw_body)`. Constant-time compare. Reject 401 on mismatch.
2. Map event → `MailingStatus`.
3. Patch the matching row in `mailings.jsonl` by `lobId`.
4. Return 200 quickly (<3s). Lob retries on non-2xx.

## UI changes — `MailExportPanel.tsx`

Add a third button right of "Generate Mail Merge":

```
[ Export CSV ] [ Generate Mail Merge ] [ Send Postcards via Lob ]
```

`Send Postcards via Lob` opens a modal:

1. **Verify step** — call `/api/lob/verify`, show per-row deliverable badge. Bad rows excluded.
2. **Quote step** — show `count × $perPiece = $total`, mode badge (`TEST` or `LIVE` based on env detection at `/api/lob/quote`).
3. **Confirm step** — text input `campaignId` (default `<yyyy-mm>-<neighborhood>`), optional `sendDate`, big red button `Send N postcards for $X.XX`.
4. **Result step** — sent count, failed count, link to Lob dashboard.

Disable send button when `LOB_API_KEY` missing (detect via `/api/lob/quote` returning 503 + reason).

## Persistence

`.data/mailings.jsonl` — append-only newline-delimited JSON. Add `.data/` to `.gitignore`. Read whole file into memory for dedupe check (file stays small; rotate if it ever exceeds ~10MB).

Reasoning: project has no DB. Avoid adding sqlite for one feature. JSONL is grep-able, dump-able, sufficient for a single-user tool.

## Idempotency

- Lob `idempotency_key` = `sha256(propertyId + campaignId)`. Lob dedupes on its side within 90 days.
- Local pre-check: scan `mailings.jsonl` for same key. Skip with `{ skipped: true, reason: "duplicate" }`.
- Both layers belt-and-suspenders against double-click and accidental retries.

## Address verification cache

`.data/verifications.jsonl` — `{ hash, deliverable, reason, verifiedAt }` keyed by `sha256(line1+city+state+zip)`. TTL 30 days. Skip Lob round-trip on hit. Saves $0.07 / verification at volume.

## Error handling

| Lob error | Behavior |
|-----------|----------|
| `address_undeliverable` | Mark `verification_failed`, skip send, surface in result table |
| `insufficient_funds` | 402 to client, do not partial-send remaining |
| Rate limit (429) | Exponential backoff, max 3 retries, then per-row fail |
| 5xx | One retry, then per-row fail with `errorMessage` |

Per-row failures do not abort the batch — partial success is OK.

## Webhook signature verification

```ts
import { createHmac, timingSafeEqual } from "crypto";

function verifyLobSignature(rawBody: string, header: string, secret: string): boolean {
  const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
  const a = Buffer.from(expected);
  const b = Buffer.from(header);
  return a.length === b.length && timingSafeEqual(a, b);
}
```

Must read raw body before parsing JSON. In Next.js App Router: `await req.text()` first, then `JSON.parse`.

## Test mode

- Lob test keys never bill, never actually mail. Postcards become viewable PDFs in the Lob dashboard.
- UI shows `TEST MODE` banner when `/api/lob/quote` returns `{ mode: "test" }`.
- Webhook events still fire in test mode — useful for end-to-end testing without spend.

## Out-of-scope risks called out

- **PII**: `mailings.jsonl` contains names + addresses. Document in README; recommend `.data/` stay local (already gitignored).
- **Cost runaway**: confirmation modal + per-piece quote + test default. No "send all hot" shortcut.
- **Returns**: returned-to-sender postcards re-flagged on the property card (`mailReady = false` after a return). v2 — optional auto-relisting flow.
- **Template management**: templates live in Lob dashboard. Document template IDs in `.env.example` comments. Drift between dev/prod templates is on the operator.

## Milestone breakdown

1. **M1 — wiring**: env vars, `src/lib/lob.ts`, `quote` route, `verify` route, types. No UI.
2. **M2 — send path**: `send` route, JSONL persistence, idempotency, address verify cache.
3. **M3 — UI**: modal flow in `MailExportPanel`, mode badge, result table.
4. **M4 — webhook**: signature verify, status sync, surface in `LeadDetailPanel` (mailing history section).
5. **M5 — polish**: returned-to-sender → `mailReady = false`, retry button on failed rows.

Each milestone is one PR. M1+M2 mergeable without UI (curl-testable).

## Open questions

- Postcard size — 4x6 (cheapest) or 6x9 (more real estate for storm imagery)? Default 4x6, configurable via env.
- Front-of-card design — static template with merge vars, or generate per-property storm map PNG and upload as front image? PNG-per-property is v2.
- Multi-user — current app is single-operator. If multi-user later, JSONL → sqlite + per-user campaign ownership.
