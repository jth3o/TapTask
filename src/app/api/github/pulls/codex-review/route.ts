import { NextResponse } from "next/server";
import { createIssueComment, validateRepoFullName } from "@/lib/github";
import { CODEX_PR_REVIEW_COMMENT } from "@/lib/generateIssue";

type CodexReviewBody = {
  repoFullName?: unknown;
  pullNumber?: unknown;
};

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as CodexReviewBody;

    if (!validateRepoFullName(payload.repoFullName)) {
      return NextResponse.json({ error: "Choose a valid repository before requesting Codex review." }, { status: 400 });
    }

    if (typeof payload.pullNumber !== "number" || !Number.isInteger(payload.pullNumber) || payload.pullNumber < 1) {
      return NextResponse.json({ error: "Choose a valid pull request before requesting Codex review." }, { status: 400 });
    }

    await createIssueComment(payload.repoFullName, payload.pullNumber, CODEX_PR_REVIEW_COMMENT);
    return NextResponse.json({ ok: true, comment: CODEX_PR_REVIEW_COMMENT });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to request Codex review." },
      { status: 500 }
    );
  }
}
