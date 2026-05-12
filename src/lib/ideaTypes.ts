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

export interface TaskPrefill {
  taskType: TaskType;
  rawInput: string;
  agentSuggestion: Agent;
  repoFullName?: string;
  sourceItemId?: string;
}

export type GenerateAction = "target_user" | "mvp" | "assumptions" | "roadmap" | "clarity_score";

export interface GenerateRequest {
  action: GenerateAction;
  project: IdeaProject;
}

export interface GenerateResponse {
  action?: GenerateAction;
  result?: string | string[] | { score: number; feedback: string } | Omit<RoadmapItem, "id" | "projectId" | "status">[];
  error?: string;
}
