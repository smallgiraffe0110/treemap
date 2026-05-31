export interface Property {
  id: string;
  address: string;
  lat: number;
  lng: number;
  ownerName: string;
  neighborhood: string;
  treeCount: number;
  ndviScore: number;          // 0-100, lower = more stressed canopy
  stormProximityMiles: number;
  urgencyScore: number;       // 0-100, higher = hotter lead
  zipCode: string;
  city: string;
  mailReady: boolean;
}

export interface FemaDeclaration {
  id: string;
  declarationDate: string;
  designatedArea: string;     // county name
  incidentType: string;
  title: string;
}

export interface MailLabel {
  ownerName: string;
  address: string;
  city: string;
  state: string;
  zip: string;
}

export type Neighborhood =
  | "Jamaica Plain"
  | "Roslindale"
  | "West Roxbury"
  | "Hyde Park"
  | "Dorchester"
  | "Mattapan"
  | "Brighton"
  | "Allston";

// ─── Agent types ─────────────────────────────────────────────

export type AgentName = "canopy" | "outreach" | "impact" | "notify" | "voice";

export type AgentStatus = "running" | "success" | "error";

export interface AgentTrace {
  id: string;
  agent: AgentName;
  op: string;
  status: AgentStatus;
  startedAt: number;       // epoch ms
  endedAt?: number;
  durationMs?: number;
  inputSummary: string;    // short user-readable
  outputSummary?: string;
  tokensIn?: number;
  tokensOut?: number;
  costUsd?: number;
  error?: string;
  weaveUrl?: string;       // link to W&B Weave trace (when configured)
  model?: string;
  provider?: "anthropic" | "coreweave" | "gemini";
}

export interface CanopyResult {
  ndviScore: number;
  damageClass: "fallen" | "leaning" | "thinning" | "healthy";
  confidence: number;     // 0-1
  rationale: string;
  newUrgencyScore: number;
}

export interface OutreachCopy {
  greeting: string;
  body: string;            // 2-3 sentence personalized hook
  cta: string;
  signature: string;
}

export interface ImpactReport {
  countyRankings: Array<{ county: string; affectedCount: number; severity: number; reason: string }>;
  summary: string;
  hottestPropertyIds: string[];
}

export interface NotifyResult {
  sent: number;
  previewed: number;
  preview: Array<{ to: string; subject: string; body: string }>;
  realSend: boolean;
}

export interface VoiceResult {
  status: "queued" | "preview" | "error";
  callSid?: string;
  to: string;
  spokenText: string;
  realCall: boolean;
}

export const NEIGHBORHOODS: Neighborhood[] = [
  "Jamaica Plain",
  "Roslindale",
  "West Roxbury",
  "Hyde Park",
  "Dorchester",
  "Mattapan",
  "Brighton",
  "Allston",
];
