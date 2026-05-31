import type { FemaDeclaration } from "@/types";
import { TREE_DESTROYER_FAMILY } from "@/data/featuredStorm";

interface OpenFemaRecord {
  id?: string;
  disasterNumber?: number;
  declarationDate?: string;
  designatedArea?: string;
  incidentType?: string;
  declarationTitle?: string;
}

interface OpenFemaResponse {
  DisasterDeclarationsSummaries?: OpenFemaRecord[];
}

const FEMA_ENDPOINT =
  "https://www.fema.gov/api/open/v2/DisasterDeclarationsSummaries" +
  "?$filter=state%20eq%20%27MA%27%20and%20incidentType%20eq%20%27Severe%20Storm%27" +
  "&$orderby=declarationDate%20desc&$top=20&$format=json";

function fallbackDeclarations(): FemaDeclaration[] {
  const now = Date.now();
  const day = 24 * 60 * 60 * 1000;
  const iso = (offsetDays: number): string =>
    new Date(now - offsetDays * day).toISOString();

  return [
    {
      id: "mock-ma-suffolk",
      declarationDate: iso(14),
      designatedArea: "Suffolk (County)",
      incidentType: "Severe Storm",
      title: "Massachusetts Severe Storms and Flooding",
    },
    {
      id: "mock-ma-norfolk",
      declarationDate: iso(42),
      designatedArea: "Norfolk (County)",
      incidentType: "Severe Storm",
      title: "Massachusetts Severe Winter Storm and Snowstorm",
    },
    {
      id: "mock-ma-middlesex",
      declarationDate: iso(75),
      designatedArea: "Middlesex (County)",
      incidentType: "Severe Storm",
      title: "Massachusetts Severe Storms and Straight-line Winds",
    },
  ];
}

export async function fetchMaStormDeclarations(): Promise<FemaDeclaration[]> {
  try {
    const res = await fetch(FEMA_ENDPOINT, {
      next: { revalidate: 3600 },
    });

    if (!res.ok) {
      console.error(
        `[fema] OpenFEMA request failed: ${res.status} ${res.statusText}`,
      );
      return fallbackDeclarations();
    }

    const data = (await res.json()) as OpenFemaResponse;
    const records = data.DisasterDeclarationsSummaries ?? [];

    if (records.length === 0) {
      return [...TREE_DESTROYER_FAMILY, ...fallbackDeclarations()];
    }

    const mapped: FemaDeclaration[] = records.map((r, idx) => ({
      id:
        r.id ??
        (r.disasterNumber !== undefined
          ? String(r.disasterNumber)
          : `fema-${idx}`),
      declarationDate: r.declarationDate ?? "",
      designatedArea: r.designatedArea ?? "",
      incidentType: r.incidentType ?? "Severe Storm",
      title: r.declarationTitle ?? "",
    }));

    return [...TREE_DESTROYER_FAMILY, ...mapped];
  } catch (err) {
    console.error("[fema] fetch error", err);
    return [...TREE_DESTROYER_FAMILY, ...fallbackDeclarations()];
  }
}
