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
  node_id: string;
  title: string;
  body: string | null;
  html_url: string;
  head: { ref: string; sha: string };
  base: { ref: string };
  merged: boolean;         // present on single-PR endpoint; undefined/false in list responses
  merged_at: string | null; // present in list responses — non-null means merged
  created_at: string;
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
    nodeId: pull.node_id,
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

async function updatePullRequestBranch(repoFullName: string, pullNumber: number, headSha: string): Promise<boolean> {
  try {
    await githubFetch(`/repos/${repoFullName}/pulls/${pullNumber}/update-branch`, {
      method: "PUT",
      body: JSON.stringify({ expected_head_sha: headSha }),
    });
    return true;
  } catch {
    return false;
  }
}

export async function markPullRequestReady(repoFullName: string, pullNumber: number): Promise<void> {
  // The REST PATCH endpoint ignores draft:false — must use GraphQL to convert a draft PR to ready
  const pr = await getPullRequest(repoFullName, pullNumber);
  if (!pr) throw new Error(`PR #${pullNumber} not found.`);
  if (!pr.draft) return; // already ready

  const token = getToken();
  const res = await fetch("https://api.github.com/graphql", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      query: `mutation($id: ID!) {
        markPullRequestReadyForReview(input: { pullRequestId: $id }) {
          pullRequest { isDraft }
        }
      }`,
      variables: { id: pr.nodeId },
    }),
  });

  const json = (await res.json()) as { errors?: { message: string }[] };
  if (json.errors?.length) {
    throw new Error(json.errors.map((e) => e.message).join("; "));
  }
}

function isConflictError(msg: string) {
  return msg.toLowerCase().includes("not mergeable") ||
    msg.toLowerCase().includes("merge conflict") ||
    msg.toLowerCase().includes("merge conflicts");
}

function isMethodDisabled(msg: string) {
  // GitHub returns this specific message when a merge method is turned off in repo settings
  return msg.toLowerCase().includes("merge method not allowed");
}

export async function mergePullRequest(
  repoFullName: string,
  pullNumber: number,
  commitTitle?: string
): Promise<{ merged: boolean; sha: string; message: string }> {
  if (!validateRepoFullName(repoFullName)) {
    throw new Error("Choose a valid repository before merging.");
  }

  const pr = await getPullRequest(repoFullName, pullNumber);

  const doMerge = async (merge_method: "squash" | "merge" | "rebase") => {
    return githubFetch<GitHubMergeResponse>(`/repos/${repoFullName}/pulls/${pullNumber}/merge`, {
      method: "PUT",
      body: JSON.stringify({ commit_title: commitTitle, merge_method }),
    });
  };

  const tryAllMethods = async () => {
    // Try squash → merge → rebase in order; only skip when that specific method is disabled
    for (const method of ["squash", "merge", "rebase"] as const) {
      try {
        return await doMerge(method);
      } catch (err) {
        const msg = err instanceof Error ? err.message : "";
        if (isConflictError(msg)) throw err;
        if (msg.includes("401") || msg.includes("403") || msg.includes("404")) throw err;
        // Only continue to the next method if GitHub explicitly says this method is disabled
        if (isMethodDisabled(msg)) continue;
        // Any other error (branch protection, required reviews, etc.) — surface it directly
        throw err;
      }
    }
    throw new Error("All merge methods are disabled for this repository. Enable at least one in Settings → General → Pull Requests.");
  };

  try {
    const result = await tryAllMethods();
    return { merged: result.merged, sha: result.sha, message: result.message };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "";
    if (!isConflictError(msg)) throw err;

    // Conflicts — try auto-rebase then retry
    if (!pr) throw new Error("Pull Request has merge conflicts. Resolve them on GitHub.");
    const rebased = await updatePullRequestBranch(repoFullName, pullNumber, pr.headSha);
    if (!rebased) {
      throw new Error("Pull Request has merge conflicts that couldn't be resolved automatically. Resolve them on GitHub.");
    }

    await new Promise((r) => setTimeout(r, 3000));

    try {
      const result = await tryAllMethods();
      return { merged: result.merged, sha: result.sha, message: result.message };
    } catch {
      throw new Error("Auto-rebase succeeded but merge still failed. Resolve remaining conflicts on GitHub.");
    }
  }
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

/**
 * Returns true if the branch exists AND has at least one commit.
 * GitHub reports default_branch as "main" even for empty repos where that ref
 * doesn't actually exist yet — Cursor SDK will reject such repos with a
 * validation_error. Use this before dispatching to give a clear early message.
 */
export async function branchHasCommits(repoFullName: string, branch: string): Promise<boolean> {
  try {
    const [owner, repo] = repoFullName.split("/");
    await githubFetch(`/repos/${owner}/${repo}/git/refs/heads/${encodeURIComponent(branch)}`);
    return true;
  } catch {
    return false;
  }
}

export async function getPullRequest(repoFullName: string, pullNumber: number): Promise<GitHubPullRequest | null> {
  if (!validateRepoFullName(repoFullName)) return null;
  try {
    const pull = await githubFetch<GitHubPullResponse>(`/repos/${repoFullName}/pulls/${pullNumber}`);
    return {
      number: pull.number,
      nodeId: pull.node_id,
      title: pull.title,
      body: pull.body ?? undefined,
      htmlUrl: pull.html_url,
      headBranch: pull.head.ref,
      headSha: pull.head.sha,
      baseBranch: pull.base.ref,
      state: pull.state,
      draft: pull.draft,
      // Single-PR endpoint always has the real merged boolean
      merged: pull.merged ?? pull.merged_at != null,
      updatedAt: pull.updated_at,
      userLogin: pull.user.login
    };
  } catch {
    return null;
  }
}


/**
 * Find the PR created by an agent for a specific task.
 *
 * Search order (most → least reliable):
 *   1. Head-branch lookup (exact, if branch name is known)
 *   2. Issue reference in PR body (Closes/Fixes/Resolves #N, or bare #N)
 *   3. Issue reference in PR title
 *   4. Time-based fallback: newest PR created after the task's startedAt
 *      (reliable when branch unknown and agent doesn't follow body conventions)
 */
export async function findPullRequestForTask(
  repoFullName: string,
  params: { issueNumber: number; branch?: string; startedAt?: string }
): Promise<GitHubPullRequest | null> {
  if (!validateRepoFullName(repoFullName)) return null;
  const [owner] = repoFullName.split("/");

  // 1. Branch-based lookup — exact match, most reliable
  if (params.branch) {
    try {
      const byBranch = await githubFetch<GitHubPullResponse[]>(
        `/repos/${repoFullName}/pulls?head=${encodeURIComponent(`${owner}:${params.branch}`)}&state=all&per_page=5`
      );
      if (byBranch.length > 0) {
        return getPullRequest(repoFullName, byBranch[0].number);
      }
    } catch {
      // fall through
    }
  }

  // Fetch recent PRs (open + closed) for the remaining strategies
  let pulls: GitHubPullResponse[] = [];
  try {
    pulls = await githubFetch<GitHubPullResponse[]>(
      `/repos/${repoFullName}/pulls?state=all&per_page=50&sort=created&direction=desc`
    );
  } catch {
    return null;
  }

  const { issueNumber } = params;
  // Matches: "Closes #N", "Fixes #N", "Resolves #N", or any bare "#N"
  const bodyRef = new RegExp(`(?:(?:closes|fixes|resolves)\\s*#${issueNumber}\\b|#${issueNumber}\\b)`, "i");
  const issueUrlSuffix = `/issues/${issueNumber}`;

  // 2. Body scan — Cursor is instructed to write "Closes #N"
  const byBody = pulls.find((p) => {
    if (!p.body) return false;
    return bodyRef.test(p.body) || p.body.includes(issueUrlSuffix);
  });
  if (byBody) return getPullRequest(repoFullName, byBody.number);

  // 3. Title scan — some agents put the issue number in the PR title
  const byTitle = pulls.find((p) => bodyRef.test(p.title));
  if (byTitle) return getPullRequest(repoFullName, byTitle.number);

  // 4. Time-based fallback — any PR created after the task was dispatched
  if (params.startedAt) {
    const startMs = new Date(params.startedAt).getTime();
    const byTime = pulls.find((p) => new Date(p.created_at).getTime() >= startMs);
    if (byTime) return getPullRequest(repoFullName, byTime.number);
  }

  return null;
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

interface GitHubCheckRunsResponse {
  total_count: number;
  check_runs: {
    id: number;
    name: string;
    status: string;
    conclusion: string | null;
    html_url: string;
  }[];
}

interface GitHubCombinedStatusResponse {
  state: string;
  statuses: { state: string }[];
}

export async function getCIStatus(
  repoFullName: string,
  headSha: string
): Promise<{ status: import("./types").CIStatus; url: string }> {
  const checksUrl = `https://github.com/${repoFullName}/commit/${headSha}/checks`;
  if (!validateRepoFullName(repoFullName)) return { status: "none", url: checksUrl };

  try {
    const runs = await githubFetch<GitHubCheckRunsResponse>(
      `/repos/${repoFullName}/commits/${headSha}/check-runs?per_page=100`
    );

    if (runs.total_count > 0) {
      const incomplete = runs.check_runs.some((r) => r.status !== "completed");
      if (incomplete) return { status: "pending", url: checksUrl };

      const failed = runs.check_runs.some(
        (r) => r.conclusion === "failure" || r.conclusion === "timed_out" || r.conclusion === "action_required"
      );
      return { status: failed ? "failure" : "success", url: checksUrl };
    }

    // Legacy commit statuses fallback
    const combined = await githubFetch<GitHubCombinedStatusResponse>(
      `/repos/${repoFullName}/commits/${headSha}/status`
    );
    if (combined.statuses.length === 0) return { status: "none", url: checksUrl };
    if (combined.state === "success") return { status: "success", url: checksUrl };
    if (combined.state === "pending") return { status: "pending", url: checksUrl };
    return { status: "failure", url: checksUrl };
  } catch {
    return { status: "none", url: checksUrl };
  }
}

interface GitHubTreeResponse {
  tree: { path: string; type: string; size?: number }[];
}

export async function getRepoSummaryContext(repoFullName: string): Promise<string> {
  if (!validateRepoFullName(repoFullName)) throw new Error("Invalid repository name.");

  // Fetch README (try common names)
  let readme = "";
  for (const name of ["README.md", "readme.md", "README.txt", "README"]) {
    const content = await githubGetContent(`/repos/${repoFullName}/contents/${name}`);
    if (content) { readme = content; break; }
  }

  // Fetch file tree (top-level + one level deep) to understand structure
  let fileList = "";
  try {
    const defaultBranchRes = await githubFetch<{ default_branch: string }>(`/repos/${repoFullName}`);
    const tree = await githubFetch<GitHubTreeResponse>(
      `/repos/${repoFullName}/git/trees/${defaultBranchRes.default_branch}?recursive=1`
    );
    const files = tree.tree
      .filter((f) => f.type === "blob" && f.path && !f.path.startsWith(".") && !f.path.includes("node_modules") && !f.path.includes("dist/") && !f.path.includes(".lock"))
      .slice(0, 80)
      .map((f) => f.path);
    fileList = files.join("\n");
  } catch { /* best-effort */ }

  // Fetch package.json for tech stack clues
  let packageJson = "";
  const pkg = await githubGetContent(`/repos/${repoFullName}/contents/package.json`);
  if (pkg) {
    try {
      const parsed = JSON.parse(pkg) as { name?: string; description?: string; dependencies?: Record<string, string>; devDependencies?: Record<string, string> };
      const deps = Object.keys({ ...parsed.dependencies, ...parsed.devDependencies }).slice(0, 30).join(", ");
      packageJson = `Name: ${parsed.name ?? ""}\nDescription: ${parsed.description ?? ""}\nDeps: ${deps}`;
    } catch { packageJson = pkg.slice(0, 500); }
  }

  const parts: string[] = [];
  if (readme) parts.push(`README:\n${readme.slice(0, 3000)}`);
  if (packageJson) parts.push(`package.json:\n${packageJson}`);
  if (fileList) parts.push(`File tree:\n${fileList}`);
  return parts.join("\n\n---\n\n");
}
