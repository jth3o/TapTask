import { Agent, ProjectType, TaskType } from "./types";

export const PROJECT_STATUSES = [
  "idea",
  "scoped",
  "build_queue",
  "building",
  "pr_review",
  "mvp_check",
  "soft_launch",
  "learning",
  "continue",
  "pivot",
  "killed",
] as const;

export type ProjectStatus = (typeof PROJECT_STATUSES)[number];

export const PROJECT_STATUS_LABELS: Record<ProjectStatus, string> = {
  idea: "Idea",
  scoped: "Scoped",
  build_queue: "Build Queue",
  building: "Building",
  pr_review: "PR Review",
  mvp_check: "MVP Check",
  soft_launch: "Soft Launch",
  learning: "Learning",
  continue: "Continue",
  pivot: "Pivot",
  killed: "Killed",
};

export const PROJECT_STATUS_COLORS: Record<ProjectStatus, string> = {
  idea: "bg-slate-100 text-slate-600",
  scoped: "bg-blue-100 text-blue-700",
  build_queue: "bg-orange-100 text-orange-700",
  building: "bg-yellow-100 text-yellow-800",
  pr_review: "bg-purple-100 text-purple-700",
  mvp_check: "bg-indigo-100 text-indigo-700",
  soft_launch: "bg-emerald-100 text-emerald-700",
  learning: "bg-cyan-100 text-cyan-700",
  continue: "bg-green-100 text-green-700",
  pivot: "bg-amber-100 text-amber-700",
  killed: "bg-red-100 text-red-600",
};

export interface IdeaProject {
  id: string;
  name: string;
  description: string;
  status: ProjectStatus;
  projectType: ProjectType;
  problem: string;
  targetUser: string;
  mvpDefinition: string;
  assumptions: string[];
  githubRepoUrl: string;
  clarityScore?: {
    score: number;
    feedback: string;
    breakdown?: {
      problemClarity: number;
      userAlignment: number;
      mvpScope: number;
      feasibility: number;
    };
  };
  marketScanId?: string;
  marketArenaName?: string;
  successMetrics?: string[];
  createdAt: string;
  updatedAt: string;
}

export const ROADMAP_ITEM_STATUSES = ["pending", "in_progress", "done", "skipped"] as const;
export type RoadmapItemStatus = (typeof ROADMAP_ITEM_STATUSES)[number];

export const ROADMAP_STATUS_COLORS: Record<RoadmapItemStatus, string> = {
  pending: "bg-slate-100 text-slate-500",
  in_progress: "bg-yellow-100 text-yellow-700",
  done: "bg-emerald-100 text-emerald-700",
  skipped: "bg-red-50 text-red-400",
};

export interface RoadmapItem {
  id: string;
  projectId: string;
  title: string;
  description: string;
  taskType: TaskType;
  acceptanceCriteria: string[];
  nonGoals: string[];
  suggestedAgent: Agent;
  status: RoadmapItemStatus;
}

export const FEATURE_STATUSES = ["backlog", "in_progress", "done", "cut"] as const;
export type FeatureStatus = (typeof FEATURE_STATUSES)[number];

export const FEATURE_STATUS_COLORS: Record<FeatureStatus, string> = {
  backlog:     "bg-slate-100 text-slate-500",
  in_progress: "bg-amber-100 text-amber-700",
  done:        "bg-emerald-100 text-emerald-700",
  cut:         "bg-red-50 text-red-400",
};

export const FEATURE_PRIORITIES = ["must", "should", "could", "wont"] as const;
export type FeaturePriority = (typeof FEATURE_PRIORITIES)[number];

export const FEATURE_PRIORITY_LABELS: Record<FeaturePriority, string> = {
  must:   "Must",
  should: "Should",
  could:  "Could",
  wont:   "Won't",
};

export const FEATURE_PRIORITY_COLORS: Record<FeaturePriority, string> = {
  must:   "bg-red-100 text-red-700",
  should: "bg-orange-100 text-orange-700",
  could:  "bg-blue-100 text-blue-600",
  wont:   "bg-slate-100 text-slate-400",
};

export interface Feature {
  id: string;
  projectId: string;
  parentId: string | null;
  title: string;
  description: string;
  placement: string;
  accessPath: string;
  taskType: TaskType;
  suggestedAgent: Agent;
  acceptanceCriteria: string[];
  nonGoals: string[];
  status: FeatureStatus;
  priority?: FeaturePriority;
  goalId?: string | null;
  prUrl?: string;
  createdAt: string;
  updatedAt: string;
}

export const GOAL_STATUSES = ["not_started", "in_progress", "done"] as const;
export type GoalStatus = (typeof GOAL_STATUSES)[number];
export const GOAL_STATUS_LABELS: Record<GoalStatus, string> = {
  not_started: "Not started",
  in_progress: "In progress",
  done: "Done",
};
export const GOAL_STATUS_COLORS: Record<GoalStatus, string> = {
  not_started: "bg-slate-100 text-slate-500",
  in_progress: "bg-amber-100 text-amber-700",
  done: "bg-emerald-100 text-emerald-700",
};
export interface Goal {
  id: string;
  projectId: string;
  cycleId?: string;
  title: string;
  description?: string;
  status: GoalStatus;
  createdAt: string;
  updatedAt: string;
}
export interface RawGoal {
  title: string;
  description: string;
}

export interface RawFeature {
  parentIndex: number;
  title: string;
  description: string;
  placement: string;
  accessPath: string;
  taskType: string;
  suggestedAgent: string;
  acceptanceCriteria: string[];
  nonGoals: string[];
  priority?: string;
}

export interface TaskPrefill {
  taskType: TaskType;
  rawInput: string;
  agentSuggestion: Agent;
  repoFullName?: string;
  sourceItemId?: string;
}

export type GenerateAction = "target_user" | "mvp" | "assumptions" | "roadmap" | "clarity_score" | "features" | "sub_features" | "add_feature" | "refine_feature" | "success_metrics" | "goals" | "cycle_title" | "cycle_goal" | "cycle_logic" | "cycle_evaluation";

export interface CycleContext {
  cycleNumber: number;
  title: string;
  goal: string;
  logicSummary: string;
  evaluationSignal: string;
}

export interface GenerateRequest {
  action: GenerateAction;
  project: IdeaProject;
  parentFeature?: Pick<Feature, "title" | "description" | "placement">;
  featureToRefine?: Pick<Feature, "title" | "description" | "placement" | "acceptanceCriteria" | "nonGoals">;
  userMessage?: string;
  cycleContext?: CycleContext;
  targetGoal?: Pick<Goal, "title" | "description">;
}

export interface GenerateResponse {
  action?: GenerateAction;
  result?: string | string[] | { score: number; feedback: string } | { acceptanceCriteria: string[]; nonGoals: string[] } | Omit<RoadmapItem, "id" | "projectId" | "status">[] | RawFeature[] | RawGoal[];
  error?: string;
}
