# 🌳 TreeMap

**Real-time tree service lead intelligence for Greater Boston.**

Forked from [PolyWorld](https://github.com/AmazingAng/PolyWorld). Built for a hackathon to demonstrate agentic AI applied to a concrete operational problem: identifying storm-damaged properties and reaching owners fast.

**Live demo:** https://treemap.hunter-d8a.workers.dev

## What it does

Watches real FEMA + NWS + NEXRAD weather feeds for storms hitting the Greater Boston service area. When a storm lands:

1. **Canopy Scorer agent** — vision/LLM rescores property NDVI from the damage zone
2. **Outreach Writer agent** — streams personalized direct mail copy per owner
3. **Impact Analyst agent** — ranks counties by severity + affected properties
4. **Notify agent** — sends real Resend emails to property owners
5. **Voice agent** — places real Twilio phone calls reading the outreach script

All agent calls instrumented with a Weave-style trace layer (input/output/latency/tokens/cost). Designed for swap-in to W&B Weave + CoreWeave vLLM inference.

## Stack

- **Next.js 16** App Router + React 19 + TypeScript strict
- **MapLibre GL 5** (globe projection) + CARTO dark style
- **Zustand 5** state (5 stores)
- **Tailwind CSS 4**
- **LLM providers (priority order):** CoreWeave (OpenAI-compat vLLM) → Google Gemini 2.5 Flash → Anthropic Claude
- **Data:** FEMA OpenFEMA, api.weather.gov NWS, Iowa Mesonet NEXRAD radar, Open-Meteo forecasts — all keyless, free
- **Email:** Resend
- **Voice:** Twilio
- **Deploy:** Cloudflare Workers (via @opennextjs/cloudflare) or any Node host (Vercel, Fly.io, Docker)

## Quick start

```bash
git clone https://github.com/smallgiraffe0110/treemap
cd treemap
npm install
cp .env.example .env.local
# At minimum, set GEMINI_API_KEY or ANTHROPIC_API_KEY
npm run dev
```

Open http://localhost:3000.

## Deploy

```bash
# Cloudflare Workers
npm run cf:deploy

# Any Node host
npm run build && node .next/standalone/server.js
```

## Architecture

See [TECH_INFRASTRUCTURE.md](./TECH_INFRASTRUCTURE.md) for full stack details and the planned CoreWeave / W&B Weave integration.

See [DEMO_SCRIPT.md](./DEMO_SCRIPT.md) for the 90-second demo walkthrough.

## License

MIT
