# TreeMap — 90-second Demo Script

Open `http://localhost:3000` in a Chrome/Edge tab with hardware acceleration on.

## 0:00 — Cold open (5s)
Intro overlay fades in: red glowing **STORM TREE DESTROYER**, "Severe storm declared across Suffolk · Norfolk · Middlesex", live count-up: 342 properties / 78 hot leads / $12,400 estimated route revenue. Pulsing LIVE badge.

> "On May 28, Storm Tree Destroyer ripped through Greater Boston. Within 5 minutes, TreeMap had every damaged property mapped, scored, and ready for outreach."

Click anywhere to dismiss → cinematic 2.8s fly-to Boston.

## 0:05 — Map orient (10s)
Globe spins into Boston. NEXRAD weather radar overlay shows real-time precipitation. Green service-area polygon. 50 pulsing pins colored by urgency (red >70, amber 40–70, green <40), clustered when zoomed out.

Top-left: neighborhood preset chips. Top-right: RADAR / NWS ALERTS / SERVICE AREA toggles + LIVE indicator.

## 0:15 — Storm Alerts panel (10s)
Bottom-left: live FEMA feed. **Storm Tree Destroyer** sits at the top of the Suffolk + Norfolk + Middlesex declarations.

Click **📧 Notify owners** on the Suffolk row →
> "AI agent drafts a personalized email for each of 10 owners in Suffolk, sends via Resend, traces appear live."

Inline toast: `✓ Sent 10 · Previewed 0` (or preview-only if `ENABLE_REAL_EMAIL` unset).

## 0:25 — Priority Leads + Lead Detail (20s)
Click **Select all hot leads** → 34 properties check themselves, mail-export populates.

Click any pin on the map (or row in Priority Leads) → Lead Detail panel slides full.

In Lead Detail, click **🔬 Re-score canopy** →
> "Vision agent re-scores the canopy from satellite imagery. Notice the urgency jumps from 78 to 91 — small green chip 'AI-rescored' appears."

Click **✨ Generate AI outreach** →
> "Claude streams personalized direct mail copy live — references the owner's street, the storm, and the neighborhood. Copy button appears when done."

Below the buttons: a 3-day forecast widget pulled live from Open-Meteo for that property's coordinates.

## 0:45 — Mail Export (15s)
Toggle **Use AI-personalized copy in mail merge** → chips show the AI snippets ready.

Click **Generate Mail Merge** → new tab opens with Avery 5160 print-ready labels using the AI copy.

Click **Export CSV** → instant download of the prospect list.

## 1:00 — AI Activity panel (15s)
Right-most panel: live trace feed showing every agent call.
> "Every model call is wrapped in `@weave.op` — we see canopy, outreach, impact, notify traces with input/output/latency/tokens/cost. In production these ship to Weights & Biases Weave for dashboards, evals, and prompt sweeps."

Counts per agent at the top. Click the trace link → opens the trace in W&B Weave (when `WANDB_API_KEY` configured).

## 1:15 — Command palette (10s)
Press **⌘K** → Linear-style palette pops up. Type "impact" → Enter → runs the storm impact analyst agent. New trace appears in AI Activity within 1.5s.

## 1:25 — Close (5s)
> "TreeMap turns a storm into a printable mailing list and a sent email blast in under 90 seconds. CoreWeave hosts the inference. W&B Weave gives us observability. Ready for prod."

---

## Setup before demo

```bash
cd /Users/hunterearls/treemap
cp .env.example .env.local
# Set at minimum:   ANTHROPIC_API_KEY=sk-ant-...
# Optional for cool: RESEND_API_KEY=...  + ENABLE_REAL_EMAIL=1  + NOTIFY_TEST_TO=you@yourself
# Optional for cool: WANDB_API_KEY=...  WANDB_PROJECT=treemap-agents

npm run dev
open http://localhost:3000
```

If you only have time for one env var: **ANTHROPIC_API_KEY**. Everything else gracefully degrades to previews / mock data.

---

## Talking points / "how it's built"

| Question | Answer |
|----------|--------|
| What's the AI model? | Default Anthropic Claude (`claude-opus-4-7`). One env var swap (`COREWEAVE_BASE_URL` + `COREWEAVE_API_KEY`) routes to a CoreWeave vLLM endpoint serving Llama-3.1-70B for cheaper, faster inference at scale. |
| How do you trace agents? | Every agent function wrapped in `withTrace` — captures input/output/latency/tokens/cost. Ships to W&B Weave via the HTTP API when `WANDB_API_KEY` is set; local in-memory feed always works. |
| Why CoreWeave for prod? | H100 nodes with autoscaling InferenceService. Cheaper than OpenAI/Anthropic at sustained load, full control over model weights, supports vision models (Qwen2-VL) for the canopy scorer. |
| Storm data? | Real FEMA OpenFEMA API (Severe Storm declarations for MA). Real NWS active alerts (api.weather.gov, polygons rendered on map). Real NEXRAD radar tiles (Iowa Mesonet RIDGE2). Real 3-day forecasts (Open-Meteo). |
| Email delivery? | Resend. Free 100/day tier. Preview-only by default; flip `ENABLE_REAL_EMAIL=1` to send. |
| Stack? | Next.js 16 App Router · React 19 · TypeScript strict · Zustand · MapLibre GL 5 (globe projection) · Tailwind 4. |
