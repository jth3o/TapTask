import { AgentReadiness, GitHubPullRequest, GitHubRepo } from "./types";

const GITHUB_API = "https://api.github.com";
const REPO_FULL_NAME_PATTERN = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/;
const CLAUDE_WORKFLOW_PATHS = [
  ".github/workflows/claude.yml",
  ".github/workflows/claude.yaml",
  ".github/workflows/claude-code.yml",
  ".github/workflows/claude-code.yaml"
];

interface GitHubRepoResponse {
  id: number;
  name: string;
  full_name: string;
  owner: { login: string };
  private: boolean;
  html_url: string;
  default_branch: string;
  updated_at: string;
}

interface GitHubIssueResponse {
  number: number;
  title: string;
  html_url: string;
}

interface GitHubPullResponse {
  number: number;
  title: string;
  body: string | null;
  html_url: string;
  head: { ref: string };
  base: { ref: string };
  state: string;
  draft: boolean;
  updated_at: string;
  user: { login: string };
}

interface GitHubContentResponse {
  type: string;
  content?: string;
  encoding?: string;
}

export function validateRepoFullName(repoFullName: unknown): repoFullName is string {
  return typeof repoFullName === "string" && REPO_FULL_NAME_PATTERN.test(repoFullName);
}

function getToken() {
  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    throw new Error("GitHub token is not configured. Add GITHUB_TOKEN to .env.local.");
  }
  return token;
}

async function githubRequest(path: string, init?: RequestInit) {
  return fetch(`${GITHUB_API}${path}`, {
    ...init,
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${getToken()}`,
      "Content-Type": "application/json",
      "X-GitHub-Api-Version": "2022-11-28",
      ...init?.headers
    },
    cache: "no-store"
  });
}

async function githubFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await githubRequest(path, init);

  if (!response.ok) {
    let detail = "";
    try {
      const payload = (await response.json()) as { message?: string };
      detail = payload.message ? ` ${payload.message}` : "";
    } catch {
      detail = "";
    }

    const message = response.status === 401 || response.status === 403
      ? `GitHub token does not have permission for this action.${detail}`
      : `GitHub request failed with status ${response.status}.${detail}`;
    throw new Error(message);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}

async function githubGetContent(path: string): Promise<string | null | false> {
  const response = await githubRequest(path);

  if (response.status === 404) {
    return false;
  }

  if (!response.ok) {
    let detail = "";
    try {
      const payload = (await response.json()) as { message?: string };
      detail = payload.message ? ` ${payload.message}` : "";
    } catch {
      detail = "";
    }
    throw new Error(`GitHub request failed with status ${response.status}.${detail}`);
  }

  const payload = (await response.json()) as GitHubContentResponse;

  if (payload.type !== "file" || payload.encoding !== "base64" || !payload.content) {
    return null;
  }

  try {
    return Buffer.from(payload.content.replaceAll("\n", ""), "base64").toString("utf8");
  } catch {
    return null;
  }
}

export async function listRepos(): Promise<GitHubRepo[]> {
  const repos: GitHubRepoResponse[] = [];
  const perPage = 100;

  for (let page = 1; page <= 5; page += 1) {
    const nextPage = await githubFetch<GitHubRepoResponse[]>(
      `/user/repos?per_page=${perPage}&page=${page}&sort=updated&affiliation=owner,collaborator,organization_member`
    );
    repos.push(...nextPage);

    if (nextPage.length < perPage) break;
  }

  return repos.map((repo) => ({
    id: repo.id,
    fullName: repo.full_name,
    name: repo.name,
    owner: repo.owner.login,
    private: repo.private,
    htmlUrl: repo.html_url,
    defaultBranch: repo.default_branch,
    updatedAt: repo.updated_at
  }));
}

export async function getRepo(repoFullName: string): Promise<GitHubRepo> {
  if (!validateRepoFullName(repoFullName)) {
    throw new Error("Choose a valid repository.");
  }

  const repo = await githubFetch<GitHubRepoResponse>(`/repos/${repoFullName}`);

  return {
    id: repo.id,
    fullName: repo.full_name,
    name: repo.name,
    owner: repo.owner.login,
    private: repo.private,
    htmlUrl: repo.html_url,
    defaultBranch: repo.default_branch,
    updatedAt: repo.updated_at
  };
}

export async function createIssue(repoFullName: string, title: string, body: string) {
  if (!validateRepoFullName(repoFullName)) {
    throw new Error("Choose a valid repository before creating an issue.");
  }

  const issue = await githubFetch<GitHubIssueResponse>(`/repos/${repoFullName}/issues`, {
    method: "POST",
    body: JSON.stringify({ title, body })
  });

  return {
    number: issue.number,
    title: issue.title,
    htmlUrl: issue.html_url
  };
}

export async function createIssueComment(repoFullName: string, issueNumber: number, body: string) {
  if (!validateRepoFullName(repoFullName)) {
    throw new Error("Choose a valid repository before commenting.");
  }

  if (!Number.isInteger(issueNumber) || issueNumber < 1) {
    throw new Error("Issue number is invalid.");
  }

  await githubFetch(`/repos/${repoFullName}/issues/${issueNumber}/comments`, {
    method: "POST",
    body: JSON.stringify({ body })
  });
}

export async function listOpenPullRequests(repoFullName: string): Promise<GitHubPullRequest[]> {
  if (!validateRepoFullName(repoFullName)) {
    throw new Error("Choose a valid repository before loading pull requests.");
  }

  const pulls = await githubFetch<GitHubPullResponse[]>(`/repos/${repoFullName}/pulls?state=open&per_page=50&sort=updated&direction=desc`);

  return pulls.map((pull) => ({
    number: pull.number,
    title: pull.title,
    body: pull.body ?? undefined,
    htmlUrl: pull.html_url,
    headBranch: pull.head.ref,
    baseBranch: pull.base.ref,
    state: pull.state,
    draft: pull.draft,
    updatedAt: pull.updated_at,
    userLogin: pull.user.login
  }));
}

export async function getAgentReadiness(repoFullName: string): Promise<AgentReadiness> {
  if (!validateRepoFullName(repoFullName)) {
    throw new Error("Choose a valid repository before checking agent readiness.");
  }

  for (const workflowPath of CLAUDE_WORKFLOW_PATHS) {
    const content = await githubGetContent(`/repos/${repoFullName}/contents/${encodeURIComponent(workflowPath).replaceAll("%2F", "/")}`);

    if (content !== false) {
      const normalizedContent = content?.toLowerCase() ?? "";
      const likelyClaudeWorkflow = ["claude", "anthropic", "claude-code", "anthropics/claude-code-action"].some((token) =>
        normalizedContent.includes(token)
      );
      const confidence = likelyClaudeWorkflow ? "high" : "low";
      const notes = likelyClaudeWorkflow
        ? ["Likely Claude workflow found.", "ANTHROPIC_API_KEY secret cannot be verified from the GitHub API."]
        : ["Workflow file found, but Claude configuration could not be verified.", "ANTHROPIC_API_KEY secret cannot be verified from the GitHub API."];

      return {
        claude: {
          connected: true,
          workflowFound: true,
          workflowPath,
          confidence,
          notes
        },
        cursor: {
          connected: false,
          confidence: "none",
          notes: ["Cursor automatic dispatch is not implemented in TapTask v1."]
        },
        codex: {
          connected: false,
          confidence: "none",
          notes: ["Codex automatic dispatch is not implemented in TapTask v1."]
        }
      };
    }
  }

  return {
    claude: {
      connected: false,
      workflowFound: false,
      confidence: "none",
      notes: [
        "No Claude workflow file found.",
        "TapTask can create issues, but no AI agent will code until a Claude workflow is installed."
      ]
    },
    cursor: {
      connected: false,
      confidence: "none",
      notes: ["Cursor automatic dispatch is not implemented in TapTask v1."]
    },
    codex: {
      connected: false,
      confidence: "none",
      notes: ["Codex automatic dispatch is not implemented in TapTask v1."]
    }
  };
}
