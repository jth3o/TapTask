import { Agent, TaskType } from "./types";

export const PAGE_TYPES = ["landing_page", "dashboard", "tool_screen", "onboarding", "pricing", "other"] as const;
export type PageType = (typeof PAGE_TYPES)[number];

export const PAGE_TYPE_LABELS: Record<PageType, string> = {
  landing_page: "Landing Page",
  dashboard: "Dashboard",
  tool_screen: "Tool Screen",
  onboarding: "Onboarding",
  pricing: "Pricing",
  other: "Other",
};

export const LAUNCH_READINESS_VALUES = ["public_launch", "soft_launch", "fix_before_launch", "do_not_show"] as const;
export type LaunchReadiness = (typeof LAUNCH_READINESS_VALUES)[number];

export const LAUNCH_READINESS_LABELS: Record<LaunchReadiness, string> = {
  public_launch: "Ready for Public Launch",
  soft_launch: "Soft Launch OK",
  fix_before_launch: "Fix Before Launch",
  do_not_show: "Do Not Show Yet",
};

export const LAUNCH_READINESS_COLORS: Record<LaunchReadiness, string> = {
  public_launch: "bg-emerald-100 text-emerald-700",
  soft_launch: "bg-blue-100 text-blue-700",
  fix_before_launch: "bg-amber-100 text-amber-700",
  do_not_show: "bg-red-100 text-red-700",
};

export interface RecommendedChange {
  title: string;
  description: string;
  taskType: TaskType;
  suggestedAgent: Agent;
}

export interface WebsiteReview {
  pageType: PageType;
  targetUser: string;
  pageGoal: string;
  url: string;
  notes: string;
  // scores 0-100
  productPresentationScore: number;
  firstGlanceClarityScore: number;
  visualHierarchyScore: number;
  ctaStrengthScore: number;
  trustScore: number;
  perceivedValueScore: number;
  mobileUsabilityScore: number;
  demoReadinessScore: number;
  // verdicts
  overallVerdict: string;
  strongestPart: string;
  weakestPart: string;
  prioritizedIssues: string[];
  recommendedChanges: RecommendedChange[];
  launchReadiness: LaunchReadiness;
}

export interface ReviewRequest {
  pageType: PageType;
  targetUser: string;
  pageGoal: string;
  url: string;
  notes: string;
}

export interface ReviewResponse {
  review?: WebsiteReview;
  error?: string;
}
