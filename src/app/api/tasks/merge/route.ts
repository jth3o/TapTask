import { NextResponse } from "next/server";
import { markPullRequestReady, mergePullRequest, validateRepoFullName } from "@/lib/github";

export const runtime = "nodejs";

type MergeBody = {
  repoFullName?: unknown;
  prNumber?: unknown;
  prTitle?: unknown;
  markReady?: unknown;
};

export type MergeResult = {
  merged: boolean;
  sha?: string;
  error?: string;
};

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as MergeBody;

    if (!validateRepoFullName(body.repoFullName)) {
      return NextResponse.json({ error: "Invalid repository name." }, { status: 400 });
    }
    if (typeof body.prNumber !== "number" || body.prNumber < 1) {
      return NextResponse.json({ error: "prNumber is required." }, { status: 400 });
    }

    const repoFullName = body.repoFullName;
    const prNumber = body.prNumber;
    const commitTitle = typeof body.prTitle === "string" && body.prTitle
      ? `${body.prTitle} (#${prNumber})`
      : undefined;

    if (body.markReady === true) {
      try {
        await markPullRequestReady(repoFullName, prNumber);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to mark PR as ready.";
        return NextResponse.json({ merged: false, error: message } satisfies MergeResult, { status: 422 });
      }
    }

    const result = await mergePullRequest(repoFullName, prNumber, commitTitle);
    console.log(`[merge] PR #${prNumber} merged: ${result.merged} sha=${result.sha}`);

    return NextResponse.json({
      merged: result.merged,
      sha: result.sha,
    } satisfies MergeResult);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Merge failed.";
    console.error(`[merge] Failed:`, message);
    return NextResponse.json({ merged: false, error: message } satisfies MergeResult, { status: 422 });
  }
}
