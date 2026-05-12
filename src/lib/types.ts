export const PROJECT_TYPES = ["web_page"] as const;

export type ProjectType = "web_page";

export const PROJECT_TYPE_LABELS: Record<ProjectType, string> = {
  web_page: "Web Page",
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

export type Agent = "claude" | "cursor" | "codex" | "manual";
export type PreferredAgent = Exclude<Agent, "manual">;
export type CodexDispatchMode = "issue_implementation" | "pr_review";

export type TaskType =
  | "new_feature"
  | "fix_bug"
  | "polish_ui"
  | "fix_build"
  | "refactor"
  | "add_test"
  | "review_pr"
  | "write_readme"
  | "deploy_check";

export type ReadinessConfidence = "none" | "low" | "medium" | "high";

export type DispatchStatus =
  | "not_sent"
  | "issue_created"
  | "cursor_run_started"
  | "cursor_running"
  | "agent_not_connected"
  | "sent_to_claude"
  | "waiting_for_pr"
  | "pr_opened"
  | "future_integration"
  | "needs_attention"
  | "dispatch_failed";

export const TASK_TYPE_OPTIONS: { value: TaskType; label: string }[] = [
  { value: "new_feature", label: "New Feature" },
  { value: "fix_bug", label: "Fix Bug" },
  { value: "polish_ui", label: "Polish UI" },
  { value: "fix_build", label: "Fix Build" },
  { value: "refactor", label: "Refactor" },
  { value: "add_test", label: "Add Test" },
  { value: "review_pr", label: "Review PR" },
  { value: "write_readme", label: "Write README" },
  { value: "deploy_check", label: "Deploy Check" }
];

export const AGENT_OPTIONS: { value: Agent; label: string; description: string }[] = [
  { value: "claude", label: "Claude", description: "Creates an issue and dispatches @claude automatically." },
  { value: "cursor", label: "Cursor", description: "Creates an issue and starts a Cursor SDK run." },
  { value: "codex", label: "Codex / ChatGPT", description: "Creates an issue or comments @codex review when enabled." },
  { value: "manual", label: "Manual", description: "Creates an issue for human follow-up." }
];

export type AgentConnectionSettings = {
  codexEnabled: boolean;
  cursorEnabled: boolean;
  preferredAgent: PreferredAgent;
  cursorOpenUrl?: string;
  codexDispatchMode: CodexDispatchMode;
  cursorAutoCreatePR: boolean;
};

export type GitHubRepo = {
  id: number;
  name: string;
  fullName: string;
  owner: string;
  private: boolean;
  htmlUrl: string;
  defaultBranch: string;
  updatedAt: string;
};

export type ProjectProfile = {
  id: string;
  projectName: string;
  repoUrl?: string;
};

export type CursorRunInfo = {
  runId?: string;
  agentId?: string;
  status: "not_started" | "running" | "finished" | "error" | "cancelled" | "failed";
  events: string[];
  prUrl?: string;
  branch?: string;
};

export type GitHubPullRequest = {
  number: number;
  nodeId: string;
  title: string;
  body?: string;
  htmlUrl: string;
  headBranch: string;
  baseBranch: string;
  headSha: string;
  state: string;
  draft: boolean;
  merged: boolean;
  updatedAt: string;
  userLogin: string;
};

export type GitHubPullRequestFile = {
  filename: string;
  status: "added" | "modified" | "removed" | "renamed" | "copied";
  additions: number;
  deletions: number;
  changes: number;
};

export type AgentReadiness = {
  claude: {
    connected: boolean;
    workflowFound: boolean;
    workflowPath?: string;
    confidence: ReadinessConfidence;
    notes: string[];
  };
  cursor: {
    connected: false;
    confidence: "none";
    notes: string[];
  };
  codex: {
    connected: false;
    confidence: "none";
    notes: string[];
  };
};

export type ActiveTaskStatus = "running" | "pr_open" | "merged" | "failed" | "closed";

export type CIStatus = "pending" | "success" | "failure" | "none";

export type ActiveTask = {
  id: string;
  repoFullName: string;
  issueNumber: number;
  issueUrl: string;
  issueTitle: string;
  prNumber?: number;
  prUrl?: string;
  branch?: string;
  runId?: string;
  agentId?: string;
  status: ActiveTaskStatus;
  prIsDraft?: boolean;
  ciStatus?: CIStatus;
  ciUrl?: string;
  startedAt: string;
  updatedAt: string;
  seen: boolean;
  mergeError?: string;
  lastNote?: string;
};

export type SentTask = {
  id: string;
  repoFullName: string;
  taskType: TaskType;
  agent: Agent;
  rawInput: string;
  issueTitle: string;
  issueBody: string;
  issueCreated: boolean;
  issueNumber?: number;
  issueUrl?: string;
  dispatchAttempted: boolean;
  dispatchStatus: DispatchStatus;
  cursorRun?: CursorRunInfo;
  cursorRunId?: string;
  readinessAtSend?: AgentReadiness;
  message?: string;
  createdAt: string;
};

export type SendTaskResponse = {
  taskId: string;
  issueCreated: boolean;
  issueNumber?: number;
  issueUrl?: string;
  issueTitle?: string;
  issueBody?: string;
  dispatchAttempted: boolean;
  dispatchStatus: DispatchStatus;
  dispatchError?: string;
  cursorRun?: CursorRunInfo;
  readinessAtSend?: AgentReadiness;
  message: string;
  agentPrompt: string;
  cursorOpenUrl?: string;
  codexCommand?: string;
};

export const STATUS_LABELS: Record<DispatchStatus, string> = {
  not_sent: "Not Sent",
  issue_created: "Issue Created",
  cursor_run_started: "Cursor Run Started",
  cursor_running: "Cursor Running",
  agent_not_connected: "Agent Not Connected",
  sent_to_claude: "Sent to Claude",
  waiting_for_pr: "Waiting for PR",
  pr_opened: "PR Opened",
  future_integration: "Future Integration",
  needs_attention: "Needs Attention",
  dispatch_failed: "Dispatch Failed"
};
