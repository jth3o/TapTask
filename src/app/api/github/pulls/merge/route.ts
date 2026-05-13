import { NextResponse } from "next/server";
import { mergePullRequest, validateRepoFullName } from "@/lib/github";
import { withAuth } from "@/lib/requireAuth";

type MergeBody = {
  repoFullName?: unknown;
  pullNumber?: unknown;
  commitTitle?: unknown;
};

export const POST = withAuth(async (request: Request) => {
  try {
    const payload = (await request.json()) as MergeBody;

    if (!validateRepoFullName(payload.repoFullName)) {
      return NextResponse.json({ error: "Choose a valid repository before merging." }, { status: 400 });
    }

    if (typeof payload.pullNumber !== "number" || !Number.isInteger(payload.pullNumber) || payload.pullNumber < 1) {
      return NextResponse.json({ error: "Pull request number is invalid." }, { status: 400 });
    }

    const commitTitle =
      typeof payload.commitTitle === "string" && payload.commitTitle.trim()
        ? payload.commitTitle.trim()
        : undefined;

    const result = await mergePullRequest(payload.repoFullName, payload.pullNumber, commitTitle);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to merge pull request." },
      { status: 500 }
    );
  }
});