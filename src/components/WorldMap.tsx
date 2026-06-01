"use client";

import { useEffect, useRef } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { useLeadStore } from "@/stores/leadStore";
import { useAlertStore } from "@/stores/alertStore";
import { useWeatherStore } from "@/stores/weatherStore";
import { BOSTON_PROPERTIES } from "@/data/bostonProperties";
import { MA_COUNTIES as maCountiesGeojson } from "@/data/maCounties";
import type { Property } from "@/types";
import type { FeatureCollection, Feature, Point, Polygon, MultiPolygon, LineString } from "geojson";

const MAP_STYLE = "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json";

// Inline fallback when the remote tile CDN is unreachable (ad blocker, offline, slow link).
// Renders a flat dark canvas — property pins, county outlines, storm tracks still draw on top.
const FALLBACK_STYLE: maplibregl.StyleSpecification = {
  version: 8,
  name: "treemap-offline",
  sources: {},
  layers: [
    {
      id: "background",
      type: "background",
      paint: { "background-color": "#0a0a0a" },
    },
  ],
  glyphs: "https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf",
};

const BOSTON_CENTER: [number, number] = [-71.10, 42.31];
const BOSTON_ZOOM = 11.2;

const SERVICE_AREA: FeatureCollection<Polygon, { name: string }> = {
  type: "FeatureCollection",
  features: [
    {
      type: "Feature",
      properties: { name: "TreeMap Service Area" },
      geometry: {
        type: "Polygon",
        coordinates: [[
          [-71.180, 42.367],
          [-71.140, 42.376],
          [-71.080, 42.378],
          [-71.038, 42.348],
          [-71.025, 42.310],
          [-71.045, 42.268],
          [-71.085, 42.240],
          [-71.135, 42.230],
          [-71.170, 42.250],
          [-71.190, 42.285],
          [-71.190, 42.330],
          [-71.180, 42.367],
        ]],
      },
    },
  ],
};

const NEIGHBORHOOD_PRESETS: { name: string; center: [number, number]; zoom: number }[] = [
  { name: "All Boston", center: BOSTON_CENTER, zoom: BOSTON_ZOOM },
  { name: "Jamaica Plain", center: [-71.114, 42.310], zoom: 13.5 },
  { name: "Roslindale", center: [-71.130, 42.282], zoom: 13.5 },
  { name: "West Roxbury", center: [-71.160, 42.280], zoom: 13.5 },
  { name: "Hyde Park", center: [-71.130, 42.252], zoom: 13.5 },
  { name: "Dorchester", center: [-71.070, 42.302], zoom: 13.5 },
  { name: "Brighton", center: [-71.160, 42.350], zoom: 13.5 },
  { name: "Allston", center: [-71.130, 42.350], zoom: 13.5 },
];

const PROPERTIES_SOURCE = "properties";
const COUNTIES_SOURCE = "ma-counties";
const SERVICE_SOURCE = "service-area";

const SERVICE_FILL_LAYER = "service-area-fill";
const SERVICE_GLOW_LAYER = "service-area-glow";
const SERVICE_OUTLINE_LAYER = "service-area-outline";

const HALO_LAYER = "properties-halo";
const PIN_LAYER = "properties-pin";
const PIN_LABEL_LAYER = "properties-label";
const SELECTED_LAYER = "properties-selected";
const ACTIVE_RING_LAYER = "properties-active-ring";
const CLUSTER_LAYER = "properties-cluster";
const CLUSTER_COUNT_LAYER = "properties-cluster-count";

const COUNTY_FILL_LAYER = "ma-counties-fill";
const COUNTY_OUTLINE_LAYER = "ma-counties-outline";

const ROUTE_SOURCE = "crew-route";
const ROUTE_LINE_LAYER = "crew-route-line";
const ROUTE_GLOW_LAYER = "crew-route-glow";
const ROUTE_NODE_LAYER = "crew-route-nodes";

const NDVI_HEAT_SOURCE = "ndvi-heat-source";
const NDVI_HEAT_FILL_LAYER = "ndvi-heat-fill";
const NDVI_HEAT_OUTLINE_LAYER = "ndvi-heat-outline";

const NDVI_BBOX = { minLng: -71.20, maxLng: -71.02, minLat: 42.22, maxLat: 42.39 };
const NDVI_HEX_SIZE = 0.0045;

const STORM_TRACK_SOURCE = "storm-track";
const STORM_HEAD_SOURCE = "storm-head";
const STORM_TRACK_LAYER = "storm-track-line";
const STORM_TRACK_GLOW_LAYER = "storm-track-glow";
const STORM_HEAD_LAYER = "storm-head-pulse";
const STORM_HEAD_CORE_LAYER = "storm-head-core";

const STORM_TRACK_COORDS: [number, number][] = [
  [-71.30, 42.34],
  [-71.22, 42.33],
  [-71.14, 42.31],
  [-71.07, 42.29],
  [-70.99, 42.27],
  [-70.92, 42.26],
];

type PropertyFeatureProps = {
  id: string;
  address: string;
  ownerName: string;
  neighborhood: string;
  treeCount: number;
  urgencyScore: number;
  ndviScore: number;
  stormProximityMiles: number;
  zipCode: string;
  city: string;
  mailReady: boolean;
};

function propertiesToFeatureCollection(
  properties: Property[],
): FeatureCollection<Point, PropertyFeatureProps> {
  return {
    type: "FeatureCollection",
    features: properties.map<Feature<Point, PropertyFeatureProps>>((p) => ({
      type: "Feature",
      geometry: { type: "Point", coordinates: [p.lng, p.lat] },
      properties: {
        id: p.id,
        address: p.address,
        ownerName: p.ownerName,
        neighborhood: p.neighborhood,
        treeCount: p.treeCount,
        urgencyScore: p.urgencyScore,
        ndviScore: p.ndviScore,
        stormProximityMiles: p.stormProximityMiles,
        zipCode: p.zipCode,
        city: p.city,
        mailReady: p.mailReady,
      },
    })),
  };
}

function buildPinFilter(
  filterNeighborhood: string | null,
  filterMinUrgency: number,
): maplibregl.FilterSpecification {
  const clauses: maplibregl.FilterSpecification[] = [["!", ["has", "point_count"]]];
  if (filterNeighborhood) {
    clauses.push(["==", ["get", "neighborhood"], filterNeighborhood]);
  }
  if (filterMinUrgency > 0) {
    clauses.push([">=", ["get", "urgencyScore"], filterMinUrgency]);
  }
  return ["all", ...clauses] as maplibregl.FilterSpecification;
}

const URGENCY_COLOR_EXPR: maplibregl.ExpressionSpecification = [
  "case",
  [">", ["get", "urgencyScore"], 70],
  "#ef4444",
  [">=", ["get", "urgencyScore"], 40],
  "#f59e0b",
  "#22c55e",
];

const TREE_RADIUS_EXPR: maplibregl.ExpressionSpecification = [
  "interpolate", ["linear"], ["zoom"],
  9, ["case", [">=", ["get", "treeCount"], 5], 7, [">=", ["get", "treeCount"], 3], 5, 4],
  12, ["case", [">=", ["get", "treeCount"], 5], 14, [">=", ["get", "treeCount"], 3], 10, 7],
  15, ["case", [">=", ["get", "treeCount"], 5], 20, [">=", ["get", "treeCount"], 3], 15, 11],
];

const HALO_RADIUS_EXPR: maplibregl.ExpressionSpecification = [
  "interpolate", ["linear"], ["zoom"],
  9, ["case", [">=", ["get", "treeCount"], 5], 14, [">=", ["get", "treeCount"], 3], 11, 9],
  12, ["case", [">=", ["get", "treeCount"], 5], 26, [">=", ["get", "treeCount"], 3], 20, 15],
  15, ["case", [">=", ["get", "treeCount"], 5], 36, [">=", ["get", "treeCount"], 3], 28, 22],
];

function computeRouteCoords(props: Property[]): [number, number][] {
  if (props.length === 0) return [];
  if (props.length === 1) return [[props[0].lng, props[0].lat]];
  // Centroid
  let cx = 0;
  let cy = 0;
  for (const p of props) {
    cx += p.lng;
    cy += p.lat;
  }
  cx /= props.length;
  cy /= props.length;
  // Start from property closest to centroid.
  let startIdx = 0;
  let bestDist = Infinity;
  for (let i = 0; i < props.length; i++) {
    const d = Math.hypot(props[i].lng - cx, props[i].lat - cy);
    if (d < bestDist) {
      bestDist = d;
      startIdx = i;
    }
  }
  const visited = new Set<number>();
  const order: number[] = [startIdx];
  visited.add(startIdx);
  while (order.length < props.length) {
    const last = props[order[order.length - 1]];
    let nextIdx = -1;
    let nextDist = Infinity;
    for (let i = 0; i < props.length; i++) {
      if (visited.has(i)) continue;
      const d = Math.hypot(props[i].lng - last.lng, props[i].lat - last.lat);
      if (d < nextDist) {
        nextDist = d;
        nextIdx = i;
      }
    }
    if (nextIdx === -1) break;
    order.push(nextIdx);
    visited.add(nextIdx);
  }
  return order.map<[number, number]>((i) => [props[i].lng, props[i].lat]);
}

function buildRouteFeatures(
  coords: [number, number][],
): FeatureCollection<LineString | Point, { kind: "line" | "node" }> {
  const features: Feature<LineString | Point, { kind: "line" | "node" }>[] = [];
  if (coords.length >= 2) {
    features.push({
      type: "Feature",
      properties: { kind: "line" },
      geometry: { type: "LineString", coordinates: coords },
    });
  }
  for (const c of coords) {
    features.push({
      type: "Feature",
      properties: { kind: "node" },
      geometry: { type: "Point", coordinates: c },
    });
  }
  return { type: "FeatureCollection", features };
}

function buildHexFeature(
  cx: number,
  cy: number,
  s: number,
  stress: number,
): Feature<Polygon, { stress: number }> {
  const vertices: [number, number][] = [];
  for (let k = 0; k < 6; k++) {
    const ang = (Math.PI / 3) * k;
    vertices.push([cx + s * Math.cos(ang), cy + s * Math.sin(ang)]);
  }
  vertices.push(vertices[0]);
  return {
    type: "Feature",
    properties: { stress },
    geometry: { type: "Polygon", coordinates: [vertices] },
  };
}

function buildNdviHeatFeatures(
  props: Property[],
): FeatureCollection<Polygon, { stress: number }> {
  const s = NDVI_HEX_SIZE;
  const stepX = 1.5 * s;
  const stepY = Math.sqrt(3) * s;
  const offsetY = (Math.sqrt(3) / 2) * s;
  const features: Feature<Polygon, { stress: number }>[] = [];
  let col = 0;
  for (let cx = NDVI_BBOX.minLng; cx <= NDVI_BBOX.maxLng + stepX; cx += stepX) {
    const yOffset = col % 2 === 0 ? 0 : offsetY;
    for (let cy = NDVI_BBOX.minLat + yOffset; cy <= NDVI_BBOX.maxLat + stepY; cy += stepY) {
      // Find props within this hex's circumscribed circle (cheap filter).
      let sum = 0;
      let n = 0;
      for (const p of props) {
        if (Math.hypot(p.lng - cx, p.lat - cy) <= s) {
          sum += 100 - p.ndviScore;
          n++;
        }
      }
      if (n > 0) {
        features.push(buildHexFeature(cx, cy, s, sum / n));
      }
    }
    col++;
  }
  return { type: "FeatureCollection", features };
}

function renderMapFallback(reason?: string): string {
  const subtitle = reason ?? "Your browser blocked WebGL. The dashboard works fully — only the map view is hidden.";
  return `
    <div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;background:radial-gradient(ellipse at center, #1a1a1a 0%, #0a0a0a 70%);font-family:Inter,sans-serif;text-align:center;padding:32px;z-index:1">
      <div style="max-width:520px">
        <div style="font-size:56px;margin-bottom:16px">🌍</div>
        <div style="font-size:20px;font-weight:700;color:#f0f0f0;margin-bottom:12px;letter-spacing:-0.01em">Map can't render</div>
        <div style="font-size:14px;color:#a0a0a0;line-height:1.6;margin-bottom:20px">${subtitle}</div>
        <div style="font-size:12px;color:#6a6a6a;text-align:left;background:rgba(255,255,255,0.04);border:1px solid #2a2a2a;border-radius:8px;padding:14px 16px;line-height:1.7">
          <div style="font-weight:600;color:#22c55e;margin-bottom:6px;letter-spacing:0.04em;text-transform:uppercase;font-size:10px">How to fix</div>
          Chrome &rarr; Settings &rarr; System &rarr; enable<br/><strong style="color:#f0f0f0">"Use hardware acceleration when available"</strong><br/>then restart browser.<br/>Or open <code style="background:#000;padding:1px 5px;border-radius:3px;color:#f59e0b">chrome://gpu</code> to check WebGL status.
        </div>
      </div>
    </div>
  `;
}

export function WorldMap() {
  const mapContainer = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const styleReadyRef = useRef(false);
  const pulseIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const activeRingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const stormAnimRef = useRef<number | null>(null);
  const routeDashIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const properties = useLeadStore((s) => s.properties);
  const selectedIds = useLeadStore((s) => s.selectedIds);
  const filterNeighborhood = useLeadStore((s) => s.filterNeighborhood);
  const filterMinUrgency = useLeadStore((s) => s.filterMinUrgency);
  const activePropertyId = useLeadStore((s) => s.activePropertyId);
  const flyToTarget = useLeadStore((s) => s.flyToTarget);

  const activeCountyFilter = useAlertStore((s) => s.activeCountyFilter);

  // Seed store from bundled data on first mount if empty.
  useEffect(() => {
    const state = useLeadStore.getState();
    if (state.properties.length === 0 && BOSTON_PROPERTIES.length > 0) {
      state.setProperties(BOSTON_PROPERTIES);
    }
  }, []);

  // Initialize map once.
  useEffect(() => {
    if (mapRef.current || !mapContainer.current) return;

    let map: maplibregl.Map;
    try {
      map = new maplibregl.Map({
        container: mapContainer.current,
        style: MAP_STYLE,
        center: [0, 20],
        zoom: 1.2,
        pitch: 0,
        bearing: 0,
        attributionControl: { compact: true },
        dragRotate: false,
        pitchWithRotate: false,
        touchPitch: false,
      });
    } catch (err) {
      console.warn("[WorldMap] WebGL init failed — rendering fallback.", err);
      if (mapContainer.current) {
        mapContainer.current.innerHTML = renderMapFallback();
      }
      return;
    }

    mapRef.current = map;

    // Loading indicator that hides once style loads (or shows fallback if it never does).
    const loadingEl = document.createElement("div");
    loadingEl.id = "treemap-loading";
    loadingEl.style.cssText = "position:absolute;inset:0;display:flex;align-items:center;justify-content:center;background:#0a0a0a;color:#909090;font-family:Inter,sans-serif;font-size:13px;z-index:2;pointer-events:none";
    loadingEl.innerHTML = '<div><div style="font-size:32px;margin-bottom:8px;text-align:center">🌍</div>Loading map…</div>';
    mapContainer.current.appendChild(loadingEl);

    // If tile CDN style doesn't load within 3s (blocked by adblocker, offline, slow CDN),
    // swap to inline FALLBACK_STYLE so map still renders with pins/overlays.
    let swappedToFallback = false;
    const swapToFallback = (reason: string) => {
      if (swappedToFallback || styleReadyRef.current) return;
      swappedToFallback = true;
      console.warn(`[WorldMap] tile style unreachable (${reason}), switching to offline fallback style.`);
      try {
        map.setStyle(FALLBACK_STYLE);
      } catch (err) {
        console.warn("[WorldMap] setStyle(fallback) failed", err);
      }
    };
    const loadTimeout = window.setTimeout(() => swapToFallback("3s timeout"), 3000);
    // Hard timeout: if even the fallback style fails to fire `load`, give up and show the error UI.
    const hardTimeout = window.setTimeout(() => {
      if (!styleReadyRef.current && mapContainer.current && document.getElementById("treemap-loading")) {
        mapContainer.current.innerHTML = renderMapFallback("Map tiles could not load. This usually means WebGL is disabled or your network blocks tile CDNs.");
      }
    }, 8000);

    map.on("error", (e) => {
      const msg = (e as { error?: { message?: string } }).error?.message ?? "";
      console.warn("[WorldMap] maplibre error", msg || e);
      // Style/source fetch failures → swap immediately so we don't sit on a black screen.
      if (/style|source|tiles|fetch|network/i.test(msg)) {
        swapToFallback(msg.slice(0, 80));
      }
    });

    try {
      map.scrollZoom.enable();
      map.dragPan.enable();
      map.touchZoomRotate.disableRotation();
      map.keyboard.disable();
      map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
      map.addControl(new maplibregl.ScaleControl({ unit: "imperial", maxWidth: 120 }), "bottom-left");
    } catch (e) {
      console.warn("[WorldMap] controls init failed", e);
    }

    map.on("load", () => {
      window.clearTimeout(loadTimeout);
      window.clearTimeout(hardTimeout);
      document.getElementById("treemap-loading")?.remove();
      // Globe projection: supported in maplibre-gl >= 5; safe no-op on 4.x.
      const maybeGlobe = map as unknown as {
        setProjection?: (p: { type: string }) => void;
      };
      try {
        maybeGlobe.setProjection?.({ type: "globe" });
      } catch {
        // older versions ignore
      }
      styleReadyRef.current = true;

      const initialProps =
        useLeadStore.getState().properties.length > 0
          ? useLeadStore.getState().properties
          : BOSTON_PROPERTIES;

      // NEXRAD radar source + layer (rendered above basemap, below service area).
      map.addSource("nexrad", {
        type: "raster",
        tiles: [
          "https://mesonet.agron.iastate.edu/cache/tile.py/1.0.0/nexrad-n0q-900913/{z}/{x}/{y}.png",
        ],
        tileSize: 256,
        attribution: "Radar © Iowa State Mesonet / NWS",
      });
      map.addLayer({
        id: "nexrad-radar",
        type: "raster",
        source: "nexrad",
        paint: { "raster-opacity": 0.65 },
        layout: { visibility: "visible" },
      });

      // NWS alerts source (initially empty).
      map.addSource("nws-alerts", {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
      });
      map.addLayer({
        id: "nws-alerts-fill",
        type: "fill",
        source: "nws-alerts",
        paint: {
          "fill-color": [
            "match",
            ["get", "severity"],
            "Extreme", "#dc2626",
            "Severe", "#ef4444",
            "Moderate", "#f59e0b",
            "Minor", "#eab308",
            "#9ca3af",
          ],
          "fill-opacity": 0.25,
        },
      });
      map.addLayer({
        id: "nws-alerts-outline",
        type: "line",
        source: "nws-alerts",
        paint: {
          "line-color": [
            "match",
            ["get", "severity"],
            "Extreme", "#dc2626",
            "Severe", "#ef4444",
            "Moderate", "#f59e0b",
            "#9ca3af",
          ],
          "line-width": 1.5,
          "line-opacity": 0.85,
        },
      });

      // Property source (clustered).
      map.addSource(PROPERTIES_SOURCE, {
        type: "geojson",
        data: propertiesToFeatureCollection(initialProps),
        cluster: true,
        clusterMaxZoom: 8,
        clusterRadius: 50,
      });

      // County source.
      map.addSource(COUNTIES_SOURCE, {
        type: "geojson",
        data: maCountiesGeojson as FeatureCollection<Polygon | MultiPolygon>,
      });

      // Service area source.
      map.addSource(SERVICE_SOURCE, {
        type: "geojson",
        data: SERVICE_AREA,
      });

      // Service area fill (under everything).
      map.addLayer({
        id: SERVICE_FILL_LAYER,
        type: "fill",
        source: SERVICE_SOURCE,
        paint: {
          "fill-color": "#22c55e",
          "fill-opacity": 0.10,
        },
      });

      // Service area outer glow.
      map.addLayer({
        id: SERVICE_GLOW_LAYER,
        type: "line",
        source: SERVICE_SOURCE,
        paint: {
          "line-color": "#22c55e",
          "line-width": 10,
          "line-opacity": 0.18,
          "line-blur": 8,
        },
      });

      // Service area crisp outline.
      map.addLayer({
        id: SERVICE_OUTLINE_LAYER,
        type: "line",
        source: SERVICE_SOURCE,
        paint: {
          "line-color": "#22c55e",
          "line-width": 2,
          "line-opacity": 0.9,
        },
      });

      // NDVI heat hex grid (initially hidden).
      map.addSource(NDVI_HEAT_SOURCE, {
        type: "geojson",
        data: buildNdviHeatFeatures(initialProps),
      });
      map.addLayer({
        id: NDVI_HEAT_FILL_LAYER,
        type: "fill",
        source: NDVI_HEAT_SOURCE,
        layout: { visibility: "none" },
        paint: {
          "fill-color": [
            "interpolate", ["linear"], ["get", "stress"],
            20, "rgba(34,197,94,0.0)",
            40, "rgba(34,197,94,0.20)",
            60, "rgba(245,158,11,0.30)",
            80, "rgba(239,68,68,0.45)",
          ],
          "fill-opacity": 0.9,
        },
      });
      map.addLayer({
        id: NDVI_HEAT_OUTLINE_LAYER,
        type: "line",
        source: NDVI_HEAT_SOURCE,
        layout: { visibility: "none" },
        paint: {
          "line-color": [
            "interpolate", ["linear"], ["get", "stress"],
            20, "rgba(34,197,94,0.4)",
            40, "rgba(34,197,94,0.5)",
            60, "rgba(245,158,11,0.6)",
            80, "rgba(239,68,68,0.7)",
          ],
          "line-width": 0.5,
          "line-opacity": 0.8,
        },
      });

      // Crew route source + layers (initially hidden).
      map.addSource(ROUTE_SOURCE, {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
      });
      map.addLayer({
        id: ROUTE_GLOW_LAYER,
        type: "line",
        source: ROUTE_SOURCE,
        filter: ["==", ["get", "kind"], "line"],
        layout: { visibility: "none", "line-cap": "round", "line-join": "round" },
        paint: {
          "line-color": "#f97316",
          "line-width": 8,
          "line-blur": 6,
          "line-opacity": 0.35,
        },
      });
      map.addLayer({
        id: ROUTE_LINE_LAYER,
        type: "line",
        source: ROUTE_SOURCE,
        filter: ["==", ["get", "kind"], "line"],
        layout: { visibility: "none", "line-cap": "round", "line-join": "round" },
        paint: {
          "line-color": "#fb923c",
          "line-width": 2.5,
          "line-dasharray": [3, 2],
          "line-opacity": 0.95,
        },
      });
      map.addLayer({
        id: ROUTE_NODE_LAYER,
        type: "circle",
        source: ROUTE_SOURCE,
        filter: ["==", ["get", "kind"], "node"],
        layout: { visibility: "none" },
        paint: {
          "circle-color": "#fb923c",
          "circle-radius": 4,
          "circle-stroke-color": "#ffffff",
          "circle-stroke-width": 1,
        },
      });

      // County fill (under pins).
      map.addLayer({
        id: COUNTY_FILL_LAYER,
        type: "fill",
        source: COUNTIES_SOURCE,
        paint: {
          "fill-color": [
            "case",
            ["==", ["get", "name"], ["literal", ""]],
            "rgba(239,68,68,0.18)",
            "rgba(34,197,94,0.0)",
          ],
          "fill-opacity": 1,
        },
      });

      map.addLayer({
        id: COUNTY_OUTLINE_LAYER,
        type: "line",
        source: COUNTIES_SOURCE,
        paint: {
          "line-color": "#22c55e",
          "line-width": 0.5,
          "line-opacity": 0.25,
        },
      });

      // Storm track source (line) + head source (single point that animates)
      map.addSource(STORM_TRACK_SOURCE, {
        type: "geojson",
        data: {
          type: "Feature",
          properties: {},
          geometry: { type: "LineString", coordinates: STORM_TRACK_COORDS },
        },
      });
      map.addSource(STORM_HEAD_SOURCE, {
        type: "geojson",
        data: {
          type: "Feature",
          properties: {},
          geometry: { type: "Point", coordinates: STORM_TRACK_COORDS[0] },
        },
      });

      // Outer glow line
      map.addLayer({
        id: STORM_TRACK_GLOW_LAYER,
        type: "line",
        source: STORM_TRACK_SOURCE,
        paint: {
          "line-color": "#ef4444",
          "line-width": 12,
          "line-blur": 8,
          "line-opacity": 0.25,
        },
        layout: { "line-cap": "round", "line-join": "round" },
      });
      // Crisp dashed line
      map.addLayer({
        id: STORM_TRACK_LAYER,
        type: "line",
        source: STORM_TRACK_SOURCE,
        paint: {
          "line-color": "#ef4444",
          "line-width": 2.5,
          "line-dasharray": [2, 2],
          "line-opacity": 0.9,
        },
        layout: { "line-cap": "round", "line-join": "round" },
      });

      // Head: outer pulsing ring
      map.addLayer({
        id: STORM_HEAD_LAYER,
        type: "circle",
        source: STORM_HEAD_SOURCE,
        paint: {
          "circle-color": "rgba(0,0,0,0)",
          "circle-radius": 18,
          "circle-stroke-color": "#ef4444",
          "circle-stroke-width": 2,
          "circle-stroke-opacity": 0.85,
        },
      });
      // Head: solid core
      map.addLayer({
        id: STORM_HEAD_CORE_LAYER,
        type: "circle",
        source: STORM_HEAD_SOURCE,
        paint: {
          "circle-color": "#ef4444",
          "circle-radius": 6,
          "circle-stroke-color": "#ffffff",
          "circle-stroke-width": 1.5,
        },
      });

      // Animate storm head along the track on a 6s loop using requestAnimationFrame.
      const start = performance.now();
      const TRACK_MS = 6000;

      function interpAlongTrack(t: number): [number, number] {
        if (STORM_TRACK_COORDS.length < 2) return STORM_TRACK_COORDS[0];
        const lengths: number[] = [];
        let total = 0;
        for (let i = 1; i < STORM_TRACK_COORDS.length; i++) {
          const dx = STORM_TRACK_COORDS[i][0] - STORM_TRACK_COORDS[i - 1][0];
          const dy = STORM_TRACK_COORDS[i][1] - STORM_TRACK_COORDS[i - 1][1];
          const d = Math.hypot(dx, dy);
          lengths.push(d);
          total += d;
        }
        const target = t * total;
        let acc = 0;
        for (let i = 0; i < lengths.length; i++) {
          if (acc + lengths[i] >= target) {
            const localT = (target - acc) / lengths[i];
            const a = STORM_TRACK_COORDS[i];
            const b = STORM_TRACK_COORDS[i + 1];
            return [a[0] + (b[0] - a[0]) * localT, a[1] + (b[1] - a[1]) * localT];
          }
          acc += lengths[i];
        }
        return STORM_TRACK_COORDS[STORM_TRACK_COORDS.length - 1];
      }

      function tick(now: number) {
        if (!mapRef.current) return;
        const elapsed = (now - start) % TRACK_MS;
        const t = elapsed / TRACK_MS;
        const [lng, lat] = interpAlongTrack(t);
        const headSrc = mapRef.current.getSource(STORM_HEAD_SOURCE) as
          | maplibregl.GeoJSONSource
          | undefined;
        if (headSrc) {
          headSrc.setData({
            type: "Feature",
            properties: {},
            geometry: { type: "Point", coordinates: [lng, lat] },
          });
        }
        const pulsePhase = (Math.sin((elapsed / 1000) * Math.PI * 2) + 1) / 2;
        try {
          mapRef.current.setPaintProperty(
            STORM_HEAD_LAYER,
            "circle-radius",
            14 + 8 * pulsePhase,
          );
          mapRef.current.setPaintProperty(
            STORM_HEAD_LAYER,
            "circle-stroke-opacity",
            0.4 + 0.5 * (1 - pulsePhase),
          );
        } catch {
          /* layer may not exist during teardown */
        }
        stormAnimRef.current = requestAnimationFrame(tick);
      }
      stormAnimRef.current = requestAnimationFrame(tick);

      // Halo (below pins).
      map.addLayer({
        id: HALO_LAYER,
        type: "circle",
        source: PROPERTIES_SOURCE,
        filter: buildPinFilter(null, 0),
        paint: {
          "circle-color": URGENCY_COLOR_EXPR,
          "circle-radius": HALO_RADIUS_EXPR,
          "circle-blur": 0.85,
          "circle-opacity": 0.55,
        },
      });

      // Pin layer.
      map.addLayer({
        id: PIN_LAYER,
        type: "circle",
        source: PROPERTIES_SOURCE,
        filter: buildPinFilter(null, 0),
        paint: {
          "circle-color": URGENCY_COLOR_EXPR,
          "circle-radius": TREE_RADIUS_EXPR,
          "circle-stroke-color": "#ffffff",
          "circle-stroke-width": 1.5,
          "circle-opacity": 0.95,
        },
      });

      // Selected layer — thicker white stroke for selected pins.
      map.addLayer({
        id: SELECTED_LAYER,
        type: "circle",
        source: PROPERTIES_SOURCE,
        filter: ["all", ["!", ["has", "point_count"]], ["in", ["get", "id"], ["literal", []]]],
        paint: {
          "circle-color": URGENCY_COLOR_EXPR,
          "circle-radius": TREE_RADIUS_EXPR,
          "circle-stroke-color": "#ffffff",
          "circle-stroke-width": 3,
          "circle-opacity": 1,
        },
      });

      // Active ring — pulses around the active property.
      map.addLayer({
        id: ACTIVE_RING_LAYER,
        type: "circle",
        source: PROPERTIES_SOURCE,
        filter: ["all", ["!", ["has", "point_count"]], ["==", ["get", "id"], "___none___"]],
        paint: {
          "circle-color": "rgba(0,0,0,0)",
          "circle-radius": [
            "case",
            [">=", ["get", "treeCount"], 5],
            21,
            [">=", ["get", "treeCount"], 3],
            17,
            14,
          ],
          "circle-stroke-color": "#ffffff",
          "circle-stroke-width": 2,
          "circle-stroke-opacity": 0.85,
        },
      });

      // Labels above pins.
      map.addLayer({
        id: PIN_LABEL_LAYER,
        type: "symbol",
        source: PROPERTIES_SOURCE,
        filter: buildPinFilter(null, 0),
        minzoom: 13,
        layout: {
          "text-field": ["get", "address"],
          "text-size": 10,
          "text-offset": [0, 1.4],
          "text-anchor": "top",
          "text-allow-overlap": false,
        },
        paint: {
          "text-color": "#e5e7eb",
          "text-halo-color": "#0b0f17",
          "text-halo-width": 1.2,
        },
      });

      // Cluster bubbles.
      map.addLayer({
        id: CLUSTER_LAYER,
        type: "circle",
        source: PROPERTIES_SOURCE,
        filter: ["has", "point_count"],
        paint: {
          "circle-color": "rgba(15,23,42,0.85)",
          "circle-radius": [
            "step",
            ["get", "point_count"],
            16,
            10,
            22,
            25,
            28,
          ],
          "circle-stroke-color": "#ffffff",
          "circle-stroke-width": 1.5,
          "circle-opacity": 0.95,
        },
      });

      map.addLayer({
        id: CLUSTER_COUNT_LAYER,
        type: "symbol",
        source: PROPERTIES_SOURCE,
        filter: ["has", "point_count"],
        layout: {
          "text-field": ["get", "point_count_abbreviated"],
          "text-size": 12,
          "text-allow-overlap": true,
        },
        paint: {
          "text-color": "#ffffff",
        },
      });

      // Cursor + click handlers for pins.
      const onPinEnter = () => {
        map.getCanvas().style.cursor = "pointer";
      };
      const onPinLeave = () => {
        map.getCanvas().style.cursor = "";
        useLeadStore.getState().setHovered(null);
      };
      const onPinMove = (
        e: maplibregl.MapMouseEvent & { features?: maplibregl.MapGeoJSONFeature[] },
      ) => {
        const f = e.features?.[0];
        if (!f) return;
        const id = (f.properties as PropertyFeatureProps | undefined)?.id ?? null;
        useLeadStore.getState().setHovered(id);
      };
      const onPinClick = (
        e: maplibregl.MapMouseEvent & { features?: maplibregl.MapGeoJSONFeature[] },
      ) => {
        const f = e.features?.[0];
        if (!f) return;
        const props = f.properties as PropertyFeatureProps | undefined;
        if (!props) return;
        const geom = f.geometry as Point;
        const [lng, lat] = geom.coordinates as [number, number];
        useLeadStore.getState().setActiveProperty(props.id);
        useLeadStore.getState().setFlyTo({ lng, lat, zoom: 14, id: props.id });
      };

      map.on("mouseenter", PIN_LAYER, onPinEnter);
      map.on("mousemove", PIN_LAYER, onPinMove);
      map.on("mouseleave", PIN_LAYER, onPinLeave);
      map.on("click", PIN_LAYER, onPinClick);

      // Cluster click → zoom in.
      map.on("click", CLUSTER_LAYER, (e) => {
        const f = e.features?.[0];
        if (!f) return;
        const clusterId = (f.properties as { cluster_id?: number } | undefined)?.cluster_id;
        const src = map.getSource(PROPERTIES_SOURCE) as maplibregl.GeoJSONSource | undefined;
        if (clusterId === undefined || !src) return;
        src
          .getClusterExpansionZoom(clusterId)
          .then((zoom) => {
            const geom = f.geometry as Point;
            const [lng, lat] = geom.coordinates as [number, number];
            map.easeTo({ center: [lng, lat], zoom });
          })
          .catch(() => {
            /* noop */
          });
      });
      map.on("mouseenter", CLUSTER_LAYER, () => {
        map.getCanvas().style.cursor = "pointer";
      });
      map.on("mouseleave", CLUSTER_LAYER, () => {
        map.getCanvas().style.cursor = "";
      });

      // Intro: globe-spin to Boston with cinematic ease.
      window.setTimeout(() => {
        if (!mapRef.current) return;
        map.flyTo({
          center: BOSTON_CENTER,
          zoom: BOSTON_ZOOM,
          pitch: 0,
          bearing: 0,
          duration: 2800,
          essential: true,
          curve: 1.6,
        });
      }, 500);

      // County pulse — animate the active county opacity.
      let pulseT = 0;
      pulseIntervalRef.current = setInterval(() => {
        if (!styleReadyRef.current || !mapRef.current) return;
        pulseT = (pulseT + 1) % 20;
        const frac = pulseT / 20;
        const opacity = 0.2 + 0.35 * (0.5 - 0.5 * Math.cos(frac * Math.PI * 2));
        const active = useAlertStore.getState().activeCountyFilter;
        try {
          mapRef.current.setPaintProperty(COUNTY_FILL_LAYER, "fill-color", [
            "case",
            ["==", ["get", "name"], active ?? "___none___"],
            `rgba(239,68,68,${opacity.toFixed(3)})`,
            "rgba(34,197,94,0.05)",
          ]);
        } catch {
          /* layer might not exist mid-cleanup */
        }
      }, 100);

      // Active-pin ring pulse.
      let ringT = 0;
      activeRingIntervalRef.current = setInterval(() => {
        if (!styleReadyRef.current || !mapRef.current) return;
        ringT = (ringT + 1) % 20;
        const frac = ringT / 20;
        const opacity = 0.35 + 0.55 * (0.5 - 0.5 * Math.cos(frac * Math.PI * 2));
        try {
          mapRef.current.setPaintProperty(
            ACTIVE_RING_LAYER,
            "circle-stroke-opacity",
            opacity,
          );
        } catch {
          /* noop */
        }
      }, 80);
    });

    return () => {
      styleReadyRef.current = false;
      if (pulseIntervalRef.current) {
        clearInterval(pulseIntervalRef.current);
        pulseIntervalRef.current = null;
      }
      if (activeRingIntervalRef.current) {
        clearInterval(activeRingIntervalRef.current);
        activeRingIntervalRef.current = null;
      }
      if (stormAnimRef.current != null) {
        cancelAnimationFrame(stormAnimRef.current);
        stormAnimRef.current = null;
      }
      if (routeDashIntervalRef.current) {
        clearInterval(routeDashIntervalRef.current);
        routeDashIntervalRef.current = null;
      }
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, []);

  // Push property updates into the source.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !styleReadyRef.current) return;
    const src = map.getSource(PROPERTIES_SOURCE) as maplibregl.GeoJSONSource | undefined;
    if (!src) return;
    const sourceProps = properties.length > 0 ? properties : BOSTON_PROPERTIES;
    const data = propertiesToFeatureCollection(sourceProps);
    src.setData(data);
    const ndviSrc = map.getSource(NDVI_HEAT_SOURCE) as maplibregl.GeoJSONSource | undefined;
    if (ndviSrc) {
      ndviSrc.setData(buildNdviHeatFeatures(sourceProps));
    }
  }, [properties]);

  // React to filter changes.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !styleReadyRef.current) return;
    const filter = buildPinFilter(filterNeighborhood, filterMinUrgency);
    try {
      map.setFilter(HALO_LAYER, filter);
      map.setFilter(PIN_LAYER, filter);
      map.setFilter(PIN_LABEL_LAYER, filter);
    } catch {
      /* noop */
    }
  }, [filterNeighborhood, filterMinUrgency]);

  // React to selection changes.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !styleReadyRef.current) return;
    const ids = Array.from(selectedIds);
    const filter: maplibregl.FilterSpecification = [
      "all",
      ["!", ["has", "point_count"]],
      ["in", ["get", "id"], ["literal", ids]],
    ];
    try {
      map.setFilter(SELECTED_LAYER, filter);
    } catch {
      /* noop */
    }
  }, [selectedIds]);

  // Crew route overlay: compute path + animate marching ants when >1 selected.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !styleReadyRef.current) return;
    const layers = [ROUTE_GLOW_LAYER, ROUTE_LINE_LAYER, ROUTE_NODE_LAYER] as const;
    const setVis = (vis: "visible" | "none") => {
      for (const id of layers) {
        if (map.getLayer(id)) {
          try {
            map.setLayoutProperty(id, "visibility", vis);
          } catch {
            /* noop */
          }
        }
      }
    };
    if (selectedIds.size <= 1) {
      setVis("none");
      if (routeDashIntervalRef.current) {
        clearInterval(routeDashIntervalRef.current);
        routeDashIntervalRef.current = null;
      }
      const src = map.getSource(ROUTE_SOURCE) as maplibregl.GeoJSONSource | undefined;
      if (src) {
        src.setData({ type: "FeatureCollection", features: [] });
      }
      return;
    }
    const propsById = new Map(properties.map((p) => [p.id, p]));
    const selectedProps: Property[] = [];
    for (const id of selectedIds) {
      const p = propsById.get(id);
      if (p) selectedProps.push(p);
    }
    if (selectedProps.length <= 1) {
      setVis("none");
      return;
    }
    const coords = computeRouteCoords(selectedProps);
    const src = map.getSource(ROUTE_SOURCE) as maplibregl.GeoJSONSource | undefined;
    if (src) {
      src.setData(buildRouteFeatures(coords));
    }
    setVis("visible");
    // Marching ants: cycle the dash pattern.
    if (routeDashIntervalRef.current) {
      clearInterval(routeDashIntervalRef.current);
    }
    const dashSeq: [number, number][] = [
      [3, 2],
      [2.5, 2.5],
      [2, 3],
      [1.5, 3.5],
      [1, 4],
      [0.5, 4.5],
      [0, 5],
      [0.5, 4.5],
      [1, 4],
      [1.5, 3.5],
      [2, 3],
      [2.5, 2.5],
    ];
    let step = 0;
    routeDashIntervalRef.current = setInterval(() => {
      if (!mapRef.current || !styleReadyRef.current) return;
      step = (step + 1) % dashSeq.length;
      try {
        mapRef.current.setPaintProperty(
          ROUTE_LINE_LAYER,
          "line-dasharray",
          dashSeq[step] as unknown as maplibregl.ExpressionSpecification,
        );
      } catch {
        /* noop */
      }
    }, 120);
  }, [selectedIds, properties]);

  // React to active property changes.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !styleReadyRef.current) return;
    const filter: maplibregl.FilterSpecification = [
      "all",
      ["!", ["has", "point_count"]],
      ["==", ["get", "id"], activePropertyId ?? "___none___"],
    ];
    try {
      map.setFilter(ACTIVE_RING_LAYER, filter);
    } catch {
      /* noop */
    }
  }, [activePropertyId]);

  // React to county filter changes (outline styling; fill color is driven by the pulse interval).
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !styleReadyRef.current) return;
    try {
      map.setPaintProperty(COUNTY_OUTLINE_LAYER, "line-color", [
        "case",
        ["==", ["get", "name"], activeCountyFilter ?? "___none___"],
        "#ef4444",
        "#22c55e",
      ]);
      map.setPaintProperty(COUNTY_OUTLINE_LAYER, "line-width", [
        "case",
        ["==", ["get", "name"], activeCountyFilter ?? "___none___"],
        2,
        1,
      ]);
      map.setPaintProperty(COUNTY_OUTLINE_LAYER, "line-dasharray", [
        "case",
        ["==", ["get", "name"], activeCountyFilter ?? "___none___"],
        ["literal", [2, 2]],
        ["literal", [1, 0]],
      ] as unknown as maplibregl.ExpressionSpecification);
    } catch {
      /* noop */
    }
  }, [activeCountyFilter]);

  // Weather layer toggles + alerts data sync.
  useEffect(() => {
    const unsub = useWeatherStore.subscribe((state) => {
      const map = mapRef.current;
      if (!map || !styleReadyRef.current) return;
      try {
        if (map.getLayer("nexrad-radar")) {
          map.setLayoutProperty(
            "nexrad-radar",
            "visibility",
            state.showRadar ? "visible" : "none",
          );
        }
        const alertsVis = state.showAlerts ? "visible" : "none";
        if (map.getLayer("nws-alerts-fill")) {
          map.setLayoutProperty("nws-alerts-fill", "visibility", alertsVis);
        }
        if (map.getLayer("nws-alerts-outline")) {
          map.setLayoutProperty("nws-alerts-outline", "visibility", alertsVis);
        }
        const saVis = state.showServiceArea ? "visible" : "none";
        if (map.getLayer(SERVICE_FILL_LAYER)) {
          map.setLayoutProperty(SERVICE_FILL_LAYER, "visibility", saVis);
        }
        if (map.getLayer(SERVICE_GLOW_LAYER)) {
          map.setLayoutProperty(SERVICE_GLOW_LAYER, "visibility", saVis);
        }
        if (map.getLayer(SERVICE_OUTLINE_LAYER)) {
          map.setLayoutProperty(SERVICE_OUTLINE_LAYER, "visibility", saVis);
        }
        const ndviVis = state.showNdviHeat ? "visible" : "none";
        if (map.getLayer(NDVI_HEAT_FILL_LAYER)) {
          map.setLayoutProperty(NDVI_HEAT_FILL_LAYER, "visibility", ndviVis);
        }
        if (map.getLayer(NDVI_HEAT_OUTLINE_LAYER)) {
          map.setLayoutProperty(NDVI_HEAT_OUTLINE_LAYER, "visibility", ndviVis);
        }
        const src = map.getSource("nws-alerts") as maplibregl.GeoJSONSource | undefined;
        if (src) {
          src.setData({ type: "FeatureCollection", features: state.alerts });
        }
      } catch {
        /* mid-cleanup, ignore */
      }
    });

    // Apply current store state once map is ready.
    const applyNow = () => {
      const map = mapRef.current;
      if (!map || !styleReadyRef.current) return;
      const state = useWeatherStore.getState();
      try {
        if (map.getLayer("nexrad-radar")) {
          map.setLayoutProperty(
            "nexrad-radar",
            "visibility",
            state.showRadar ? "visible" : "none",
          );
        }
        const alertsVis = state.showAlerts ? "visible" : "none";
        if (map.getLayer("nws-alerts-fill")) {
          map.setLayoutProperty("nws-alerts-fill", "visibility", alertsVis);
        }
        if (map.getLayer("nws-alerts-outline")) {
          map.setLayoutProperty("nws-alerts-outline", "visibility", alertsVis);
        }
        const saVis = state.showServiceArea ? "visible" : "none";
        if (map.getLayer(SERVICE_FILL_LAYER)) {
          map.setLayoutProperty(SERVICE_FILL_LAYER, "visibility", saVis);
        }
        if (map.getLayer(SERVICE_GLOW_LAYER)) {
          map.setLayoutProperty(SERVICE_GLOW_LAYER, "visibility", saVis);
        }
        if (map.getLayer(SERVICE_OUTLINE_LAYER)) {
          map.setLayoutProperty(SERVICE_OUTLINE_LAYER, "visibility", saVis);
        }
        const ndviVis = state.showNdviHeat ? "visible" : "none";
        if (map.getLayer(NDVI_HEAT_FILL_LAYER)) {
          map.setLayoutProperty(NDVI_HEAT_FILL_LAYER, "visibility", ndviVis);
        }
        if (map.getLayer(NDVI_HEAT_OUTLINE_LAYER)) {
          map.setLayoutProperty(NDVI_HEAT_OUTLINE_LAYER, "visibility", ndviVis);
        }
        const src = map.getSource("nws-alerts") as maplibregl.GeoJSONSource | undefined;
        if (src) {
          src.setData({ type: "FeatureCollection", features: state.alerts });
        }
      } catch {
        /* noop */
      }
    };
    const interval = setInterval(() => {
      if (styleReadyRef.current) {
        applyNow();
        clearInterval(interval);
      }
    }, 100);

    return () => {
      unsub();
      clearInterval(interval);
    };
  }, []);

  // Seed NWS alerts on mount.
  useEffect(() => {
    let cancelled = false;
    async function loadAlerts() {
      try {
        const res = await fetch("/api/weather/alerts");
        if (!res.ok) return;
        const data = (await res.json()) as {
          features: import("@/lib/weather/nws").NWSAlertFeature[];
        };
        if (cancelled) return;
        useWeatherStore.getState().setAlerts(data.features ?? []);
      } catch {
        /* silent */
      }
    }
    loadAlerts();
    return () => {
      cancelled = true;
    };
  }, []);

  // Fly-to subscription.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !flyToTarget) return;
    map.flyTo({
      center: [flyToTarget.lng, flyToTarget.lat],
      zoom: flyToTarget.zoom ?? 14,
      duration: 1200,
      essential: true,
    });
    useLeadStore.getState().setFlyTo(null);
  }, [flyToTarget]);

  const flyToPreset = (center: [number, number], zoom: number) => {
    mapRef.current?.flyTo({ center, zoom, duration: 1400, essential: true, curve: 1.4 });
  };

  return (
    <div className="absolute inset-0">
      <div ref={mapContainer} style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }} />

      {/* Neighborhood preset bar */}
      <div className="absolute left-3 top-3 z-10 flex flex-wrap gap-1.5 max-w-[calc(100%-180px)]">
        {NEIGHBORHOOD_PRESETS.map((p) => (
          <button
            key={p.name}
            onClick={() => flyToPreset(p.center, p.zoom)}
            className="px-2.5 py-1 text-[11px] font-medium rounded-md bg-black/55 hover:bg-black/80 border border-white/10 text-white/90 backdrop-blur transition-colors"
          >
            {p.name}
          </button>
        ))}
      </div>

    </div>
  );
}
