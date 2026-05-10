import { Agent, ProjectType, TaskType } from "./types";

export const TIMEFRAMES = ["today", "this_week", "this_month", "this_quarter"] as const;
export type Timeframe = (typeof TIMEFRAMES)[number];

export const TIMEFRAME_LABELS: Record<Timeframe, string> = {
  today: "Today",
  this_week: "This Week",
  this_month: "This Month",
  this_quarter: "This Quarter",
};

export const SOURCE_FOCUSES = [
  "tech_news",
  "startup_trends",
  "developer_tools",
  "creator_economy",
  "small_business",
  "education",
  "privacy",
  "user_selected",
] as const;
export type SourceFocus = (typeof SOURCE_FOCUSES)[number];

export const SOURCE_FOCUS_LABELS: Record<SourceFocus, string> = {
  tech_news: "Tech News",
  startup_trends: "Startup Trends",
  developer_tools: "Developer Tools",
  creator_economy: "Creator Economy",
  small_business: "Small Business",
  education: "Education",
  privacy: "Privacy",
  user_selected: "My Selection",
};

export const VERDICTS = [
  "build_now",
  "prototype_next",
  "watch_market",
  "too_big_for_now",
  "skip",
] as const;
export type Verdict = (typeof VERDICTS)[number];

export const VERDICT_LABELS: Record<Verdict, string> = {
  build_now: "Build Now",
  prototype_next: "Prototype Next",
  watch_market: "Watch Market",
  too_big_for_now: "Too Big For Now",
  skip: "Skip",
};

export const VERDICT_COLORS: Record<Verdict, string> = {
  build_now: "bg-emerald-100 text-emerald-700",
  prototype_next: "bg-blue-100 text-blue-700",
  watch_market: "bg-amber-100 text-amber-700",
  too_big_for_now: "bg-orange-100 text-orange-700",
  skip: "bg-slate-100 text-slate-500",
};

export interface MarketSignal {
  id: string;
  signalTitle: string;
  summary: string;
  whatChanged: string;
  affectedUsers: string[];
  painCreated: string;
  currentWorkarounds: string[];
  opportunitySpace: string;
  whyNow: string;
  confidenceLevel: "low" | "medium" | "high";
  sourceLinks: string[];
  sourceDates: string[];
}

export interface OpportunityScores {
  marketMomentum: number;
  painIntensity: number;
  userAccessibility: number;
  mvpSimplicity: number;
  personalAdvantage: number;
  distributionPath: number;
  expansionPotential: number;
  opportunityScore: number;
  buildNowScore: number;
}

export interface OpportunityMap {
  id: string;
  signalId: string;
  userWorkflow: string;
  painPoints: string[];
  productAngles: string[];
  smallestMvp: string;
  whatNotToBuild: string[];
  firstUserTest: string;
  distributionTest: string;
  taptaskFeasibilityNotes: string;
  scores: OpportunityScores;
  verdict: Verdict;
  verdictReason: string;
}

export interface MarketRoadmapItem {
  title: string;
  goal: string;
  acceptanceCriteria: string[];
  nonGoals: string[];
  suggestedProjectType: ProjectType;
  suggestedAgent: Agent;
  verificationPlan: string;
  taskType: TaskType;
}

// ─── API contracts ────────────────────────────────────────────────────────────

export interface ScanRequest {
  arenaName: string;
  targetUserRole: string;
  timeframe: Timeframe;
  sourceFocus: SourceFocus;
  personalConstraints: string;
  personalAdvantage: string;
}

export interface ScanResponse {
  signals?: Omit<MarketSignal, "id">[];
  error?: string;
}

export interface OpportunityRequest {
  signal: MarketSignal;
  personalConstraints: string;
  personalAdvantage: string;
  arenaName: string;
}

export interface OpportunityResponse {
  opportunity?: Omit<OpportunityMap, "id" | "signalId">;
  error?: string;
}

export interface RoadmapRequest {
  signal: MarketSignal;
  opportunity: OpportunityMap;
  arenaName: string;
}

export interface RoadmapResponse {
  items?: MarketRoadmapItem[];
  error?: string;
}
