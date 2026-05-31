import type { FemaDeclaration } from "@/types";

/**
 * Headline storm for the demo. Always prepended to the FEMA feed.
 * Real-feeling: dated within the last week, MA counties, severe storm classification.
 */
export const TREE_DESTROYER: FemaDeclaration = {
  id: "tree-destroyer-2026",
  declarationDate: "2026-05-28T00:00:00.000Z",
  designatedArea: "Suffolk (County)",
  incidentType: "Severe Storm",
  title: "STORM TREE DESTROYER — DOWNED TREES, POWER OUTAGES, AND CANOPY DAMAGE",
};

export const TREE_DESTROYER_FAMILY: FemaDeclaration[] = [
  TREE_DESTROYER,
  {
    id: "tree-destroyer-norfolk",
    declarationDate: "2026-05-28T00:00:00.000Z",
    designatedArea: "Norfolk (County)",
    incidentType: "Severe Storm",
    title: "STORM TREE DESTROYER — DOWNED TREES, POWER OUTAGES, AND CANOPY DAMAGE",
  },
  {
    id: "tree-destroyer-middlesex",
    declarationDate: "2026-05-28T00:00:00.000Z",
    designatedArea: "Middlesex (County)",
    incidentType: "Severe Storm",
    title: "STORM TREE DESTROYER — DOWNED TREES, POWER OUTAGES, AND CANOPY DAMAGE",
  },
];
