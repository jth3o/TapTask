import { NextResponse } from "next/server";
import { createIssueComment, validateRepoFullName } from "@/lib/github";

interface CreateCommentBody {
  repoFullName?: unknown;
  issueNumber?: unknown;
  body?: unknown;
}

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as CreateCommentBody;

    if (!validateRepoFullName(payload.repoFullName)) {
      return NextResponse.json({ error: "Choose a valid repository before commenting." }, { status: 400 });
    }

    if (typeof payload.issueNumber !== "number" || !Number.isInteger(payload.issueNumber) || payload.issueNumber < 1) {
      return NextResponse.json({ error: "Issue number is invalid." }, { status: 400 });
    }

    if (typeof payload.body !== "string" || !payload.body.trim()) {
      return NextResponse.json({ error: "Comment body is required." }, { status: 400 });
    }

    await createIssueComment(payload.repoFullName, payload.issueNumber, payload.body.trim());
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to create GitHub issue comment." },
      { status: 500 }
    );
  }
}
