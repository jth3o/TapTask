import { Agent } from "@cursor/sdk";
import { NextResponse } from "next/server";
import { getRepo, getPullRequest, validateRepoFullName } from "@/lib/github";
import { CursorRunInfo } from "@/lib/types";

export const runtime = "nodejs";

type FixConflictsBody = {
  repoFullName?: unknown;
  prNumber?: unknown;
  branch?: unknown;
  issueNumber?: unknown;
};

export type FixConflictsResult = {
  cursorRun: CursorRunInfo;
};

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as FixConflictsBody;

    if (!validateRepoFullName(body.repoFullName)) {
      return NextResponse.json({ error: "Invalid repository name." }, { status: 400 });
    }
    if (typeof body.prNumber !== "number") {
      return NextResponse.json({ error: "prNumber is required." }, { status: 400 });
    }

    const repoFullName = body.repoFullName;
    const prNumber = body.prNumber;

    const apiKey = process.env.CURSOR_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "CURSOR_API_KEY is not configured." }, { status: 500 });
    }

    const [pr, repo] = await Promise.all([
      getPullRequest(repoFullName, prNumber),
      getRepo(repoFullName),
    ]);

    if (!pr) {
      return NextResponse.json({ error: `PR #${prNumber} not found.` }, { status: 404 });
    }

    const headBranch = pr.headBranch;
    const baseBranch = pr.baseBranch;
    const prUrl = pr.htmlUrl;

    const prompt = `The pull request branch "${headBranch}" has merge conflicts with "${baseBranch}".

PR: ${prUrl}

Please resolve the merge conflicts:
1. You are already on the repository. Switch to branch: ${headBranch}
2. Merge ${baseBranch} into ${headBranch}
3. Resolve all conflicts — when in doubt, keep the PR's intent and incorporate any new changes from ${baseBranch}
4. Commit with message: "Resolve merge conflicts with ${baseBranch}"
5. Push the updated branch

Do NOT open a new PR. The existing PR at ${prUrl} will update automatically once you push.`;

    const cursorAgent = await Agent.create({
      apiKey,
      name: `TapTask Fix Conflicts: PR #${prNumber}`,
      cloud: {
        repos: [{ url: repo.htmlUrl, startingRef: headBranch }],
        autoCreatePR: false,
      },
    });

    const run = await cursorAgent.send(prompt);

    const cursorRun: CursorRunInfo = {
      runId: run.id,
      agentId: run.agentId,
      status: run.status,
      events: ["Cursor conflict-resolution run started."],
      branch: headBranch,
    };

    return NextResponse.json({ cursorRun } satisfies FixConflictsResult);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to start conflict resolution." },
      { status: 500 }
    );
  }
}
