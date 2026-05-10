import { AgentConnectionSettings, GitHubRepo, ProjectType, SentTask } from "./types";

const TASKS_KEY = "taptask-sent-tasks-v1";
const FAVORITE_REPOS_KEY = "taptask-favorite-repos-v1";
const RECENT_REPOS_KEY = "taptask-recent-repos-v1";
const AGENT_SETTINGS_KEY = "taptask-agent-settings-v1";
const REPO_PROJECT_TYPES_KEY = "taptask-repo-project-types-v1";

export const DEFAULT_AGENT_SETTINGS: AgentConnectionSettings = {
  codexEnabled: false,
  cursorEnabled: true,
  preferredAgent: "cursor",
  cursorOpenUrl: "https://cursor.com/agents",
  codexDispatchMode: "issue_implementation",
  cursorAutoCreatePR: false,
};

function isClient() {
  return typeof window !== "undefined";
}

function normalizeSentTasks(value: unknown): SentTask[] {
  if (!Array.isArray(value)) return [];

  return value
    .filter((task) => task && typeof task === "object")
    .map((task) => {
      const maybeTask = task as Partial<SentTask> & {
        title?: string;
        roughDetails?: string;
        generatedPrompt?: string;
      };

      return {
        id: maybeTask.id ?? crypto.randomUUID(),
        repoFullName: maybeTask.repoFullName ?? "",
        taskType: maybeTask.taskType ?? "new_feature",
        agent: maybeTask.agent ?? "manual",
        rawInput: maybeTask.rawInput ?? maybeTask.roughDetails ?? "",
        issueTitle: maybeTask.issueTitle ?? maybeTask.title ?? "Sent Task",
        issueBody: maybeTask.issueBody ?? maybeTask.generatedPrompt ?? "",
        issueCreated: maybeTask.issueCreated ?? Boolean(maybeTask.issueUrl || maybeTask.issueNumber),
        issueNumber: maybeTask.issueNumber,
        issueUrl: maybeTask.issueUrl,
        dispatchAttempted: maybeTask.dispatchAttempted ?? maybeTask.dispatchStatus === "sent_to_claude",
        dispatchStatus: maybeTask.dispatchStatus ?? "issue_created",
        cursorRun: maybeTask.cursorRun,
        cursorRunId: maybeTask.cursorRunId ?? maybeTask.cursorRun?.runId,
        readinessAtSend: maybeTask.readinessAtSend,
        message: maybeTask.message,
        createdAt: maybeTask.createdAt ?? new Date().toISOString()
      } satisfies SentTask;
    });
}

export function loadSentTasks(): SentTask[] {
  if (!isClient()) return [];
  const value = window.localStorage.getItem(TASKS_KEY) ?? window.localStorage.getItem("taptask-saved-tasks-v1");
  if (!value) return [];
  try {
    return normalizeSentTasks(JSON.parse(value));
  } catch {
    return [];
  }
}

export function saveSentTasks(tasks: SentTask[]) {
  if (!isClient()) return;
  window.localStorage.setItem(TASKS_KEY, JSON.stringify(tasks));
}

export function loadFavoriteRepos(): string[] {
  if (!isClient()) return [];
  const value = window.localStorage.getItem(FAVORITE_REPOS_KEY);
  if (!value) return [];
  try {
    return JSON.parse(value) as string[];
  } catch {
    return [];
  }
}

export function saveFavoriteRepos(repoFullNames: string[]) {
  if (!isClient()) return;
  window.localStorage.setItem(FAVORITE_REPOS_KEY, JSON.stringify(repoFullNames));
}

export function loadRecentRepos(): string[] {
  if (!isClient()) return [];
  const value = window.localStorage.getItem(RECENT_REPOS_KEY);
  if (!value) return [];
  try {
    return JSON.parse(value) as string[];
  } catch {
    return [];
  }
}

export function saveRecentRepos(repoFullNames: string[]) {
  if (!isClient()) return;
  window.localStorage.setItem(RECENT_REPOS_KEY, JSON.stringify(repoFullNames));
}

export function rememberRepo(repo: GitHubRepo, current: string[]) {
  return [repo.fullName, ...current.filter((fullName) => fullName !== repo.fullName)].slice(0, 10);
}

export function loadAgentConnectionSettings(): AgentConnectionSettings {
  if (!isClient()) return DEFAULT_AGENT_SETTINGS;
  const value = window.localStorage.getItem(AGENT_SETTINGS_KEY);
  if (!value) return DEFAULT_AGENT_SETTINGS;

  try {
    const parsed = JSON.parse(value) as Partial<AgentConnectionSettings>;
    return {
      codexEnabled: Boolean(parsed.codexEnabled),
      cursorEnabled: Boolean(parsed.cursorEnabled),
      preferredAgent: parsed.preferredAgent === "codex" || parsed.preferredAgent === "cursor" ? parsed.preferredAgent : "claude",
      cursorOpenUrl: typeof parsed.cursorOpenUrl === "string" ? parsed.cursorOpenUrl : DEFAULT_AGENT_SETTINGS.cursorOpenUrl,
      codexDispatchMode: parsed.codexDispatchMode === "pr_review" ? "pr_review" : "issue_implementation",
      cursorAutoCreatePR: typeof parsed.cursorAutoCreatePR === "boolean" ? parsed.cursorAutoCreatePR : false,
    };
  } catch {
    return DEFAULT_AGENT_SETTINGS;
  }
}

export function saveAgentConnectionSettings(settings: AgentConnectionSettings) {
  if (!isClient()) return;
  window.localStorage.setItem(AGENT_SETTINGS_KEY, JSON.stringify(settings));
}

export function loadRepoProjectTypes(): Record<string, ProjectType> {
  if (!isClient()) return {};
  const value = window.localStorage.getItem(REPO_PROJECT_TYPES_KEY);
  if (!value) return {};
  try {
    return JSON.parse(value) as Record<string, ProjectType>;
  } catch {
    return {};
  }
}

export function saveRepoProjectTypes(types: Record<string, ProjectType>) {
  if (!isClient()) return;
  window.localStorage.setItem(REPO_PROJECT_TYPES_KEY, JSON.stringify(types));
}
