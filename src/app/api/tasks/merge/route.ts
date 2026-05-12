import { NextResponse } from "next/server";
import { mergePullRequest, validateRepoFullName } from "@/lib/github";

export const runtime = "nodejs";

type MergeBody = {
  repoFullName?: unknown;
  prNumber?: unknown;
  prTitle?: unknown;
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

    const result = await mergePullRequest(repoFullName, prNumber, commitTitle);

    return NextResponse.json({
      merged: result.merged,
      sha: result.sha,
    } satisfies MergeResult);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Merge failed.";
    return NextResponse.json({ merged: false, error: message } satisfies MergeResult, { status: 422 });
  }
}
