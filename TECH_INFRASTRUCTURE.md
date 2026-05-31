# TreeMap — Technical Infrastructure

Real-time tree service lead intelligence dashboard for Greater Boston. Forked from PolyWorld (Polymarket viz). Built as a one-shot demo for tree care direct mail prospecting.

---

## 1. Stack

| Layer | Tech | Why |
|-------|------|-----|
| Framework | Next.js 16 (App Router) | SSR + API routes in one repo, edge-deployable |
| Language | TypeScript (strict) | Catch contract drift across stores/panels/agents |
| Runtime | React 19 + Server Components for static shell | Map + panels are client-only; rest is RSC |
| State | Zustand 5 (3 stores) | Tiny, no boilerplate, selectors avoid re-render cascades |
| Map | MapLibre GL JS 5 (globe projection) | Open source, no Mapbox token, supports globe + raster + GeoJSON layers |
| Tiles | CARTO Dark Matter vector style (basemaps.cartocdn.com) | CORS-clean, no key, retina, free |
| Styling | Tailwind CSS 4 + CSS custom properties | Single source of truth for color tokens |
| Bundler | Webpack (dev), Turbopack option | Webpack picked for stability with MapLibre dynamic import |
| Deploy target | Vercel or Cloudflare Workers (standalone output) | `next.config.mjs` sets `output: standalone` |

No SQLite, no auth, no payment, no Polymarket deps. All Polymarket scaffolding from the PolyWorld base was stripped.

---

## 2. Repo layout

```
treemap/
├── src/
│   ├── app/
│   │   ├── layout.tsx              # Root layout, Inter + Inter Tight fonts
│   │   ├── page.tsx                # Dashboard shell (Header + map + 4-col panels)
│   │   ├── globals.css             # Tailwind import + CSS variables (color tokens)
│   │   └── api/
│   │       ├── fema/route.ts       # GET — FEMA OpenFEMA proxy (1h ISR)
│   │       └── export/route.ts     # POST — CSV or Avery 5160 mail merge HTML
│   ├── components/
│   │   ├── Header.tsx              # Logo, address search, SELECTED chip
│   │   ├── WorldMap.tsx            # MapLibre globe + pins + service area
│   │   └── panels/
│   │       ├── StormAlertsPanel.tsx
│   │       ├── PriorityLeadsPanel.tsx
│   │       ├── LeadDetailPanel.tsx
│   │       └── MailExportPanel.tsx
│   ├── stores/
│   │   ├── leadStore.ts            # Properties, selection, filters, active id, flyTo
│   │   └── alertStore.ts           # FEMA declarations, county filter, loading/error
│   ├── data/
│   │   ├── bostonProperties.ts     # 50 seeded properties (30 hot)
│   │   └── maCounties.ts           # Suffolk / Norfolk / Middlesex polygons
│   ├── lib/
│   │   ├── fema.ts                 # OpenFEMA client + mock fallback
│   │   ├── urgencyScore.ts         # (100 - ndvi) * 0.4 + (10 - storm_mi) * 6
│   │   └── mailMerge.ts            # Avery 5160 HTML generator
│   └── types/
│       └── index.ts                # Property, FemaDeclaration, MailLabel, Neighborhood
├── public/
├── next.config.mjs                 # output: standalone
├── tsconfig.json                   # strict, paths @/* → src/*
└── package.json
```

---

## 3. State management

Three Zustand stores. Single source of truth, no prop drilling.

### `leadStore`
```ts
{
  properties: Property[],          // seeded from BOSTON_PROPERTIES
  selectedIds: Set<string>,        // mail list builder
  filterNeighborhood: string|null,
  filterMinUrgency: number,        // 0–100
  hoveredId: string|null,
  activePropertyId: string|null,   // drives LeadDetailPanel + map active ring
  flyToTarget: { lng, lat, zoom?, id? } | null,
}
```

### `alertStore`
```ts
{
  femaDeclarations: FemaDeclaration[],
  activeCountyFilter: string|null,
  loading: boolean,
  error: string|null,
}
```

**Discipline:** read with single-field selectors (`useLeadStore(s => s.properties)`), never destructure the whole store. Call actions via `useLeadStore.getState()` in callbacks to dodge stale closures.

---

## 4. Data flow

```
BOSTON_PROPERTIES (static) ─► leadStore.setProperties() (page.tsx mount)
                                         │
                                         ├─► WorldMap (GeoJSON source, clustered)
                                         ├─► PriorityLeadsPanel (filter + sort + select)
                                         ├─► LeadDetailPanel (active id → property)
                                         └─► MailExportPanel (selected ids → table)

FEMA OpenFEMA API ─► /api/fema (1h cache) ─► alertStore.setDeclarations()
                                                       │
                                                       └─► StormAlertsPanel

User selects properties ─► POST /api/export?format=csv|mailmerge
                                       │
                                       ├─► CSV stream (attachment download)
                                       └─► Avery 5160 HTML (window.open)
```

No DB. All persistence is in-memory + browser. Reload = reset.

---

## 5. Map architecture

**Style:** CARTO Dark Matter vector (`https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json`). Single URL, MapLibre fetches glyphs + sprites + sources.

**Projection:** Globe (`setProjection({ type: 'globe' })`) on MapLibre 5+. Falls back to Mercator on older versions via try/catch.

**Layers (z-order top → bottom):**
1. `properties-active-ring` — pulsing white ring on active pin
2. `properties-selected` — thicker stroke on mail-list pins
3. `properties-label` — address text, minzoom 13
4. `properties-pin` — colored circle (urgency: red/amber/green), zoom-interpolated radius
5. `properties-halo` — blurred color glow under pin
6. `properties-cluster` + count — bubble at zoom <8
7. `ma-counties-outline` — Suffolk/Norfolk/Middlesex
8. `ma-counties-fill` — pulses red when active county filter set
9. `service-area-outline` — crisp green border
10. `service-area-glow` — wide blurred green stroke
11. `service-area-fill` — 10% green tint
12. CARTO basemap

**Pin sizing:** `interpolate(["linear"], ["zoom"], ...)` — bigger at street level, smaller from far. Tree count drives base radius (1–2/3–4/5+ trees).

**Animations:**
- 2.8s cinematic flyTo Boston on first load (`curve: 1.6`)
- County fill pulses red 0.2 → 0.55 opacity over 2s
- Active-pin ring pulses stroke-opacity 0.35 → 0.9 over 1.6s

**Resilience:** `new maplibregl.Map(...)` wrapped in try/catch. WebGL failure renders an inline fallback message instead of crashing the React tree.

**Interactivity:** click pin → `setActiveProperty(id)` + `setFlyTo({lng,lat,zoom:14})`. Click cluster → `getClusterExpansionZoom` + `easeTo`.

---

## 6. API routes

### `GET /api/fema`
- Calls OpenFEMA: `/v2/DisasterDeclarationsSummaries?$filter=state eq 'MA' and incidentType eq 'Severe Storm'&$top=20`
- ISR: `revalidate = 3600` (1h)
- Maps to `FemaDeclaration[]`, returns `{ declarations }`
- Fallback: if FEMA returns empty/error, returns 3 mocked Suffolk/Norfolk/Middlesex declarations from the last 90 days. UI always populates.

### `POST /api/export?format=csv|mailmerge`
- Body: `{ ids: string[] }`
- Looks up properties from `BOSTON_PROPERTIES` by id, preserving selection order
- **CSV path:** headers `Name,Address,City,State,ZIP,UrgencyScore`. CSV-escaped. `Content-Disposition: attachment; filename="treemap_mail_list_YYYY-MM-DD.csv"`.
- **mailmerge path:** `generateMailMergeHTML(labels)` returns a self-contained HTML doc (CSS grid, Avery 5160 3×10 layout, @page letter, owner name bold, "Tree care assessment enclosed" tagline, screen-only alt-row tint, sticky "Print labels" button, padded to multiples of 30 with empty cells). `text/html`. Client opens in new tab.

---

## 7. Styling system

CSS variables in `globals.css`:
```css
--bg #0a0a0a   --panel #111   --panel-2 #161616
--border #2a2a2a   --border-hi #3a3a3a
--text #f0f0f0   --text-secondary #c0c0c0   --text-dim #909090
--accent #22c55e   --accent-amber #f59e0b   --accent-red #ef4444
```

Tailwind 4 with `@import "tailwindcss"`. No `tailwind.config.js`. Classes consume the variables via `bg-[var(--panel)]`.

Two fonts loaded once from Google Fonts in `layout.tsx`:
- **Inter** — body (400/500/600)
- **Inter Tight** — display headings (600/700/800)

Monospace numerals via `font-mono` for urgency scores + counts.

---

## 8. Build & deploy

```bash
npm install
npm run dev         # webpack dev server (HMR)
npm run build       # next build, output: standalone
npm run typecheck   # tsc --noEmit
npm run lint        # eslint
```

**Production:** `output: 'standalone'` produces a self-contained Node.js server in `.next/standalone`. Deploy to:
- **Vercel:** `vercel --prod`. API routes deploy as serverless functions, page is static.
- **Cloudflare Workers:** wrap with OpenNext or `@cloudflare/next-on-pages`.
- **Docker:** copy `.next/standalone` + `.next/static` + `public/`, run `node server.js`.

No runtime DB. No background workers. No env vars required for the demo (FEMA is anonymous, Google Maps key is optional fallback).

**Optional env:**
```
NEXT_PUBLIC_GOOGLE_MAPS_KEY=    # real geocoding in header search
NASA_FIRMS_KEY=                 # active fire data (not yet wired into UI)
```

---

## 9. AI agent extension (planned)

The demo runs entirely on mock data. Production replaces mocks with three model-driven agents.

### 9.1 Agents

| Agent | Inputs | Outputs | Drives |
|-------|--------|---------|--------|
| **Canopy Scorer** | Satellite tile (Mapbox/Google Static) for property bbox + last storm date | `ndviScore`, `damageClass: 'fallen' \| 'leaning' \| 'thinning' \| 'healthy'`, confidence | Replaces mock `ndviScore`; recomputes `urgencyScore` |
| **Outreach Writer** | `Property` + active FEMA declaration | Per-owner copy block (3–4 sentences) for mail merge | Drops into `mailMerge.ts` instead of static tagline |
| **Storm Impact Analyst** | FEMA decls + NOAA NWS alerts + property GeoJSON | Ranked impact report (counties × severity × est. affected props) | Replaces static county pulse with quantitative ranking |

### 9.2 Infra stack

```
┌─────────────────────────────────────────────────────────────┐
│ Next.js (Vercel)                                            │
│   /api/agents/canopy   /api/agents/outreach   /agents/impact│
│        │                       │                      │      │
│        └───────────────────────┴──────────────────────┘      │
│                            │ HTTPS                            │
│                            ▼                                  │
│ Cloudflare Worker (auth, rate-limit, observability shim)     │
│                            │                                  │
│                            ▼                                  │
│ CoreWeave GPU node (gpu-h100-80gb)                           │
│   ┌─────────────────────────────────────────────────────┐    │
│   │ vLLM 0.6.x                                          │    │
│   │   - llama-3.1-70b-instruct  (text generation)       │    │
│   │   - qwen2-vl-72b-instruct   (satellite vision)      │    │
│   │ FastAPI shim — OpenAI-compatible /v1/chat/completions│    │
│   └─────────────────────────────────────────────────────┘    │
│                            │                                  │
│                            ▼ instrumented via weave.op        │
│ Weights & Biases — runs, sweeps, evals                       │
│   ├── Weave  — traces, datasets, LLM-as-judge evals          │
│   └── W&B    — fine-tune runs, prompt sweeps                 │
└─────────────────────────────────────────────────────────────┘
```

### 9.3 CoreWeave deployment sketch

```yaml
# coreweave/vllm.yaml
apiVersion: serving.kserve.io/v1beta1
kind: InferenceService
metadata: { name: treemap-llama }
spec:
  predictor:
    minReplicas: 1
    maxReplicas: 4
    containers:
      - name: vllm
        image: vllm/vllm-openai:v0.6.3
        args:
          - --model=meta-llama/Meta-Llama-3.1-70B-Instruct
          - --tensor-parallel-size=2
          - --max-model-len=8192
        resources:
          limits:
            nvidia.com/gpu: 2
            memory: 160Gi
```

Same pattern for Qwen2-VL (vision model). Front them with a single OpenAI-compatible Cloudflare Worker that signs requests and writes Weave traces.

### 9.4 W&B + Weave integration

Server-side instrumentation lives in `src/instrumentation.ts`:
```ts
import * as weave from "weave";

export function register() {
  weave.init("treemap-agents");
}
```

Each agent client wraps calls:
```ts
// src/lib/agents/outreach.ts
import * as weave from "weave";

export const writeOutreach = weave.op(
  async function writeOutreach(p: Property, decl: FemaDeclaration | null) {
    const res = await fetch(`${COREWEAVE_URL}/v1/chat/completions`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${KEY}` },
      body: JSON.stringify({
        model: "llama-3.1-70b-instruct",
        messages: [
          { role: "system", content: OUTREACH_SYSTEM },
          { role: "user", content: renderOutreachPrompt(p, decl) },
        ],
        temperature: 0.4,
        max_tokens: 240,
      }),
    });
    const json = await res.json();
    return json.choices[0].message.content as string;
  }
);
```

`weave.op` captures input, output, latency, token counts, exceptions. Surfaces in the Weave UI without extra logging.

### 9.5 Eval loop

W&B Weave evals catch regressions before deploy:
- **Outreach quality:** dataset of (property, declaration, golden mail copy). LLM-as-judge scores tone, neighborhood reference, urgency calibration.
- **Canopy scorer:** dataset of (satellite tile, human-labeled NDVI bucket). Classification accuracy.
- **Impact analyst:** dataset of (FEMA + NOAA + properties, golden ranking). Spearman correlation vs ground truth.

CI: `weave evaluate` runs on every PR. Block merge on regression > 2pp.

---

## 10. Observability (no AI yet)

Current demo has none. When agents land:
- **Weave dashboard** — request volume, p50/p95/p99 latency, token spend by agent
- **W&B Sweeps** — prompt/model A/B with downstream proxy metric (mail-merge open rate from a tracking pixel)
- **Vercel Analytics** — front-end TTFB, Core Web Vitals
- **CoreWeave node metrics** — GPU util, OOMs, replica autoscaling events

---

## 11. Security

Demo is read-only and unauthenticated. Production additions:
- API rate limit per IP via Cloudflare Worker (already in the agent path)
- API key auth between Next.js and CoreWeave (W-B-stored, rotated quarterly)
- CSP header in `next.config.mjs` limiting tile + font origins
- CSV export size cap (e.g., 5000 ids per request)
- No PII in Weave traces — owner names hashed before logging

---

## 12. Known limitations

- All property data mocked. Real parcel lookup needs county GIS feeds (Boston, Norfolk, Middlesex assessor APIs vary widely).
- No persistence. Reload clears selection.
- WebGL required — headless / no-GPU clients see the fallback message.
- Only 8 hardcoded neighborhoods. Scale = swap `BOSTON_PROPERTIES` for a paginated API + virtualized list.
- FEMA OpenFEMA returns county names with inconsistent suffixes ("(County)", "(in (P)MSA …)"). The county filter does loose string match.

---

## 13. File-level cheat sheet

| File | Lines | What |
|------|-------|------|
| `src/components/WorldMap.tsx` | ~620 | MapLibre init, all sources/layers, intro flyTo, preset chips, pulses |
| `src/components/Header.tsx` | ~210 | Brand, geocode/fuzzy search, SELECTED chip |
| `src/components/panels/PriorityLeadsPanel.tsx` | ~170 | Filterable urgency-ranked list, hot-leads bulk select |
| `src/components/panels/StormAlertsPanel.tsx` | ~140 | FEMA fetch + county filter |
| `src/components/panels/LeadDetailPanel.tsx` | ~150 | Active property card |
| `src/components/panels/MailExportPanel.tsx` | ~170 | Selection table + CSV/mailmerge download |
| `src/lib/mailMerge.ts` | ~170 | Avery 5160 HTML doc |
| `src/lib/fema.ts` | ~90 | FEMA client + fallback |
| `src/lib/urgencyScore.ts` | ~20 | Score formula + tier + color helpers |
| `src/data/bostonProperties.ts` | (50 entries) | Mock seed |
| `src/data/maCounties.ts` | 3 polygons | County GeoJSON |

---

## 14. To extend

Add an agent in 4 steps:
1. Write `src/lib/agents/<name>.ts` — `weave.op`-wrapped client to CoreWeave.
2. Add `src/app/api/agents/<name>/route.ts` — Next.js API route that calls the client.
3. Add panel UI hook — `useEffect` in panel calls `/api/agents/<name>`, writes result to a store.
4. Add eval dataset + `weave evaluate` script in `evals/<name>.ts`. Run in CI.

Add a data source:
1. Client in `src/lib/<source>.ts` with ISR-friendly fetch + fallback.
2. API route in `src/app/api/<source>/route.ts`.
3. Store update + panel consumption.

Add a panel:
1. New file in `src/components/panels/`. Pure read from stores + actions.
2. Slot into `src/app/page.tsx` grid (currently 4 cols).
