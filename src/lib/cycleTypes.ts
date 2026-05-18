export type ScopeCycleStatus =
  | "understand"
  | "shrink"
  | "build"
  | "evaluate"
  | "learn"
  | "complete";

export type CycleDecision =
  | "undecided"
  | "repeat"
  | "expand"
  | "pivot"
  | "kill"
  | "scale";

export type EvaluationMethod =
  | "personal_use"
  | "demo"
  | "outreach"
  | "landing_page"
  | "usage"
  | "paid_test";

export interface ScopeCycle {
  id: string;
  projectId: string;
  cycleNumber: number;
  status: ScopeCycleStatus;

  hypothesis: string;
  targetUser: string;
  problem: string;
  valuePromise: string;
  riskiestAssumption: string;

  smallestUsefulLoop: string;
  currentScope: string;
  handles: string[];
  excludes: string[];
  edgeCaseParkingLot: string[];

  buildArtifact: string;
  buildTaskIds: string[];

  evaluationMethod: EvaluationMethod | "";
  successCriteria: string[];
  evidenceNotes: string[];

  learningSummary: string;
  decision: CycleDecision;
  nextScope: string;

  createdAt: string;
  updatedAt: string;
}

export type FeatureTriageDecision =
  | "build_now"
  | "park"
  | "evidence_needed"
  | "cut";

export type FeatureIdeaSource =
  | "user_idea"
  | "post_merge_feedback"
  | "market_signal"
  | "user_feedback"
  | "bug"
  | "personal_friction";

export type ScopeImpact =
  | "shrinks_scope"
  | "keeps_scope"
  | "expands_scope";

export type EvaluationImpact =
  | "helps_evaluate"
  | "neutral"
  | "hurts_evaluate";

export interface FeatureIdea {
  id: string;
  projectId: string;
  cycleId?: string;

  title: string;
  description: string;
  source: FeatureIdeaSource;

  decision: FeatureTriageDecision;
  reason: string;

  supportsHypothesis?: string;
  requiredForSmallestLoop: boolean;
  basedOnEvidence: boolean;
  scopeImpact: ScopeImpact;
  evaluationImpact: EvaluationImpact;

  notThisCycleReason?: string;

  createdAt: string;
  updatedAt: string;
}

export const EVALUATION_METHOD_LABELS: Record<EvaluationMethod, string> = {
  personal_use: "Personal use",
  demo: "Demo",
  outreach: "Outreach",
  landing_page: "Landing page",
  usage: "Usage metrics",
  paid_test: "Paid test",
};

export const CYCLE_DECISION_LABELS: Record<CycleDecision, string> = {
  undecided: "Undecided",
  repeat: "Repeat",
  expand: "Expand",
  pivot: "Pivot",
  kill: "Kill",
  scale: "Scale",
};

export const FEATURE_TRIAGE_LABELS: Record<FeatureTriageDecision, string> = {
  build_now: "Build now",
  park: "Park",
  evidence_needed: "Evidence needed",
  cut: "Cut",
};

export const FEATURE_TRIAGE_COLORS: Record<FeatureTriageDecision, string> = {
  build_now: "bg-emerald-100 text-emerald-700",
  park: "bg-slate-100 text-slate-600",
  evidence_needed: "bg-amber-100 text-amber-700",
  cut: "bg-red-50 text-red-500",
};

export const FEATURE_IDEA_SOURCE_LABELS: Record<FeatureIdeaSource, string> = {
  user_idea: "User idea",
  post_merge_feedback: "Post-merge",
  market_signal: "Market signal",
  user_feedback: "User feedback",
  bug: "Bug",
  personal_friction: "Personal friction",
};

export const SCOPE_IMPACT_LABELS: Record<ScopeImpact, string> = {
  shrinks_scope: "Shrinks scope",
  keeps_scope: "Keeps scope",
  expands_scope: "Expands scope",
};

export const EVALUATION_IMPACT_LABELS: Record<EvaluationImpact, string> = {
  helps_evaluate: "Helps evaluate",
  neutral: "Neutral",
  hurts_evaluate: "Hurts evaluate",
};

export const CYCLE_STATUS_LABELS: Record<ScopeCycleStatus, string> = {
  understand: "Understand",
  shrink: "Shrink",
  build: "Build",
  evaluate: "Evaluate",
  learn: "Learn",
  complete: "Complete",
};
