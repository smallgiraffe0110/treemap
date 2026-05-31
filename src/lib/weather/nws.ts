import type { Feature, FeatureCollection, Polygon, MultiPolygon } from "geojson";

export interface NWSAlertProps {
  event: string;
  headline: string;
  severity: "Extreme" | "Severe" | "Moderate" | "Minor" | "Unknown";
  urgency: "Immediate" | "Expected" | "Future" | "Past" | "Unknown";
  effective: string;
  expires: string;
  areaDesc: string;
}

export type NWSAlertFeature = Feature<Polygon | MultiPolygon, NWSAlertProps>;

interface RawAlertProps {
  event?: string;
  headline?: string;
  severity?: string;
  urgency?: string;
  effective?: string;
  expires?: string;
  areaDesc?: string;
}

type RawAlertFeature = Feature<Polygon | MultiPolygon | null, RawAlertProps>;

const NWS_ENDPOINT = "https://api.weather.gov/alerts/active?area=MA";

function normalizeSeverity(s: string | undefined): NWSAlertProps["severity"] {
  switch (s) {
    case "Extreme":
    case "Severe":
    case "Moderate":
    case "Minor":
      return s;
    default:
      return "Unknown";
  }
}

function normalizeUrgency(u: string | undefined): NWSAlertProps["urgency"] {
  switch (u) {
    case "Immediate":
    case "Expected":
    case "Future":
    case "Past":
      return u;
    default:
      return "Unknown";
  }
}

export async function fetchMaActiveAlerts(): Promise<NWSAlertFeature[]> {
  try {
    const res = await fetch(NWS_ENDPOINT, {
      headers: {
        "User-Agent": "treemap-demo (contact@treemap.app)",
        Accept: "application/geo+json",
      },
      next: { revalidate: 600 },
    });

    if (!res.ok) {
      console.error(`[nws] alerts request failed: ${res.status} ${res.statusText}`);
      return [];
    }

    const data = (await res.json()) as FeatureCollection<
      Polygon | MultiPolygon | null,
      RawAlertProps
    >;
    const features = data.features ?? [];

    const mapped: NWSAlertFeature[] = [];
    for (const f of features as RawAlertFeature[]) {
      if (!f.geometry) continue;
      if (f.geometry.type !== "Polygon" && f.geometry.type !== "MultiPolygon") continue;
      const props = f.properties ?? {};
      mapped.push({
        type: "Feature",
        geometry: f.geometry,
        properties: {
          event: props.event ?? "Alert",
          headline: props.headline ?? "",
          severity: normalizeSeverity(props.severity),
          urgency: normalizeUrgency(props.urgency),
          effective: props.effective ?? "",
          expires: props.expires ?? "",
          areaDesc: props.areaDesc ?? "",
        },
      });
    }
    return mapped;
  } catch (err) {
    console.error("[nws] fetch error", err);
    return [];
  }
}
