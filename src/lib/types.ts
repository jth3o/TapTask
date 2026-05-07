export const TASK_TYPES = [
  "New Project",
  "New Feature",
  "Fix Bug",
  "Polish UI",
  "Refactor",
  "Add Test",
  "Fix Build",
  "Review PR",
  "Write README",
  "Deploy Check"
] as const;

export const AGENTS = ["Cursor", "Claude", "Codex", "ChatGPT"] as const;

export type TaskType = (typeof TASK_TYPES)[number];
export type Agent = (typeof AGENTS)[number];

export const PROJECT_TYPES = [
  "web_app",
  "desktop_app",
  "cli_tool",
  "browser_extension",
  "automation_script",
  "api_service",
  "library_package",
  "game_or_visual_tool",
  "other",
] as const;

export type ProjectType = (typeof PROJECT_TYPES)[number];

export const PROJECT_TYPE_LABELS: Record<ProjectType, string> = {
  web_app: "Web App",
  desktop_app: "Desktop App",
  cli_tool: "CLI Tool",
  browser_extension: "Browser Extension",
  automation_script: "Automation Script",
  api_service: "API Service",
  library_package: "Library / Package",
  game_or_visual_tool: "Game / Visual Tool",
  other: "Other",
};

export const CHANGE_SIZES = [
  "tiny_fix",
  "focused_change",
  "big_change",
  "review_fix",
  "local_debug",
  "product_readiness",
] as const;

export type ChangeSize = (typeof CHANGE_SIZES)[number];

export const CHANGE_SIZE_LABELS: Record<ChangeSize, string> = {
  tiny_fix: "Tiny Fix",
  focused_change: "Focused Change",
  big_change: "Big Change",
  review_fix: "Review Fix",
  local_debug: "Local Debug",
  product_readiness: "Product Readiness",
};

export const CHANGE_SIZE_COLORS: Record<ChangeSize, string> = {
  tiny_fix: "bg-green-100 text-green-800",
  focused_change: "bg-blue-100 text-blue-800",
  big_change: "bg-orange-100 text-orange-800",
  review_fix: "bg-purple-100 text-purple-800",
  local_debug: "bg-yellow-100 text-yellow-800",
  product_readiness: "bg-slate-100 text-slate-800",
};

export interface ImplementationPhase {
  title: string;
  purpose: string;
  acceptanceCriteria: string[];
  nonGoals: string[];
  suggestedAgent: string;
  verificationStep: string;
}

export interface ChangePlan {
  changeSize: ChangeSize;
  goal: string;
  userFacingBehavior: string;
  logicRequirements: string[];
  dataStateRequirements: string[];
  filesLikelyAffected: string[];
  acceptanceCriteria: string[];
  testVerificationPlan: string[];
  nonGoals: string[];
  riskNotes: string[];
  phases?: ImplementationPhase[];
}

export interface ProjectProfile {
  id: string;
  projectName: string;
  projectType: ProjectType;
  repoUrl?: string;
  techStack: string;
  rulesNotes: string;
  defaultAgent: Agent;
  createdAt: string;
}

export interface SavedTask {
  id: string;
  title: string;
  taskType: TaskType;
  agent: Agent;
  projectProfileId: string;
  projectName: string;
  roughDetails: string;
  generatedPrompt: string;
  createdAt: string;
}
