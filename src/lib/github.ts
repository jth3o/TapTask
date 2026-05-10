import { AgentReadiness, GitHubPullRequest, GitHubPullRequestFile, GitHubRepo } from "./types";

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
  head: { ref: string; sha: string };
  base: { ref: string };
  merged: boolean;
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
      const payload = (await response.json()) as { message?: string; errors?: { message?: string; field?: string; code?: string }[] };
      const parts: string[] = [];
      if (payload.message) parts.push(payload.message);
      if (payload.errors?.length) {
        payload.errors.forEach((e) => {
          if (e.message) parts.push(e.message);
          else if (e.field && e.code) parts.push(`${e.field}: ${e.code}`);
        });
      }
      detail = parts.length ? ` ${parts.join(" | ")}` : "";
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
    headSha: pull.head.sha,
    baseBranch: pull.base.ref,
    state: pull.state,
    draft: pull.draft,
    merged: pull.merged ?? false,
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

interface GitHubPullFileResponse {
  filename: string;
  status: string;
  additions: number;
  deletions: number;
  changes: number;
}

export async function getPullRequestFiles(repoFullName: string, pullNumber: number): Promise<GitHubPullRequestFile[]> {
  if (!validateRepoFullName(repoFullName)) {
    throw new Error("Choose a valid repository before loading PR files.");
  }

  const files = await githubFetch<GitHubPullFileResponse[]>(
    `/repos/${repoFullName}/pulls/${pullNumber}/files?per_page=100`
  );

  return files.map((file) => ({
    filename: file.filename,
    status: (["added", "modified", "removed", "renamed", "copied"].includes(file.status)
      ? file.status
      : "modified") as GitHubPullRequestFile["status"],
    additions: file.additions,
    deletions: file.deletions,
    changes: file.changes
  }));
}

interface GitHubMergeResponse {
  sha: string;
  merged: boolean;
  message: string;
}

export async function mergePullRequest(
  repoFullName: string,
  pullNumber: number,
  commitTitle?: string
): Promise<{ merged: boolean; sha: string; message: string }> {
  if (!validateRepoFullName(repoFullName)) {
    throw new Error("Choose a valid repository before merging.");
  }

  const result = await githubFetch<GitHubMergeResponse>(`/repos/${repoFullName}/pulls/${pullNumber}/merge`, {
    method: "PUT",
    body: JSON.stringify({ commit_title: commitTitle, merge_method: "squash" })
  });

  return { merged: result.merged, sha: result.sha, message: result.message };
}

interface GitHubDeploymentResponse {
  id: number;
  environment: string;
}

interface GitHubDeploymentStatusResponse {
  state: string;
  environment_url?: string;
}

export async function closePullRequest(repoFullName: string, pullNumber: number): Promise<void> {
  if (!validateRepoFullName(repoFullName)) {
    throw new Error("Choose a valid repository before closing a PR.");
  }

  await githubFetch(`/repos/${repoFullName}/pulls/${pullNumber}`, {
    method: "PATCH",
    body: JSON.stringify({ state: "closed" })
  });
}

// ─── Repo creation + scaffolding ─────────────────────────────────────────────

interface CreateRepoResponse {
  id: number;
  full_name: string;
  html_url: string;
  default_branch: string;
  clone_url: string;
}

interface CreateBlobResponse { sha: string }
interface CreateTreeResponse { sha: string }
interface CreateCommitResponse { sha: string }
interface GetRefResponse { object: { sha: string } }
interface GetCommitResponse { tree: { sha: string } }

export async function createRepo(params: {
  name: string;
  description: string;
  private: boolean;
}): Promise<{ fullName: string; htmlUrl: string; defaultBranch: string; cloneUrl: string }> {
  const repo = await githubFetch<CreateRepoResponse>("/user/repos", {
    method: "POST",
    body: JSON.stringify({
      name: params.name,
      description: params.description,
      private: params.private,
      // auto_init:true creates the initial commit so the Git Data API is usable immediately
      auto_init: true,
    }),
  });
  return {
    fullName: repo.full_name,
    htmlUrl: repo.html_url,
    defaultBranch: repo.default_branch || "main",
    cloneUrl: repo.clone_url,
  };
}

export async function scaffoldRepo(params: {
  fullName: string;
  files: { path: string; content: string }[];
  commitMessage: string;
  branch: string;
}): Promise<{ commitSha: string }> {
  const [owner, repo] = params.fullName.split("/");

  // Get the initial commit SHA that auto_init created
  const ref = await githubFetch<GetRefResponse>(
    `/repos/${owner}/${repo}/git/refs/heads/${params.branch}`
  );
  const parentSha = ref.object.sha;

  // Get that commit's tree SHA so we can build on top of it
  const initialCommit = await githubFetch<GetCommitResponse>(
    `/repos/${owner}/${repo}/git/commits/${parentSha}`
  );
  const baseTreeSha = initialCommit.tree.sha;

  // Create a blob for every file
  const blobs = await Promise.all(
    params.files.map((f) =>
      githubFetch<CreateBlobResponse>(`/repos/${owner}/${repo}/git/blobs`, {
        method: "POST",
        body: JSON.stringify({
          content: Buffer.from(f.content, "utf8").toString("base64"),
          encoding: "base64",
        }),
      })
    )
  );

  // Create tree on top of the initial tree
  const tree = await githubFetch<CreateTreeResponse>(`/repos/${owner}/${repo}/git/trees`, {
    method: "POST",
    body: JSON.stringify({
      base_tree: baseTreeSha,
      tree: params.files.map((f, i) => ({
        path: f.path,
        mode: "100644",
        type: "blob",
        sha: blobs[i].sha,
      })),
    }),
  });

  // Create commit with the initial commit as parent
  const commit = await githubFetch<CreateCommitResponse>(`/repos/${owner}/${repo}/git/commits`, {
    method: "POST",
    body: JSON.stringify({
      message: params.commitMessage,
      tree: tree.sha,
      parents: [parentSha],
    }),
  });

  // Update the branch ref to point to our new commit
  await githubFetch(`/repos/${owner}/${repo}/git/refs/heads/${params.branch}`, {
    method: "PATCH",
    body: JSON.stringify({ sha: commit.sha, force: false }),
  });

  return { commitSha: commit.sha };
}

export async function getPullRequestPreviewUrl(repoFullName: string, headBranch: string): Promise<string | null> {
  if (!validateRepoFullName(repoFullName)) return null;

  try {
    const deployments = await githubFetch<GitHubDeploymentResponse[]>(
      `/repos/${repoFullName}/deployments?ref=${encodeURIComponent(headBranch)}&per_page=5`
    );

    if (!deployments.length) return null;

    const statuses = await githubFetch<GitHubDeploymentStatusResponse[]>(
      `/repos/${repoFullName}/deployments/${deployments[0].id}/statuses?per_page=5`
    );

    const success = statuses.find((s) => s.state === "success" && s.environment_url);
    return success?.environment_url ?? null;
  } catch {
    return null;
  }
}
