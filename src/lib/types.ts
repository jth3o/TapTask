export const TASK_MODES = [
  "Safe Patch",
  "Legacy Context",
  "Normal Feature",
  "Experimental Branch",
] as const;

export type TaskMode = (typeof TASK_MODES)[number];

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

export interface ProjectProfile {
  id: string;
  projectName: string;
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
  taskMode?: TaskMode;
  agent: Agent;
  projectProfileId: string;
  projectName: string;
  roughDetails: string;
  generatedPrompt: string;
  createdAt: string;
}
