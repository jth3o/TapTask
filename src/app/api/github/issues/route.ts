import { NextResponse } from "next/server";
import { createIssue, validateRepoFullName } from "@/lib/github";
import { withAuth } from "@/lib/requireAuth";

interface CreateIssueBody {
  repoFullName?: unknown;
  title?: unknown;
  body?: unknown;
}

export const POST = withAuth(async (request: Request) => {
  try {
    const payload = (await request.json()) as CreateIssueBody;

    if (!validateRepoFullName(payload.repoFullName)) {
      return NextResponse.json({ error: "Choose a valid repository before creating an issue." }, { status: 400 });
    }

    if (typeof payload.title !== "string" || !payload.title.trim()) {
      return NextResponse.json({ error: "Issue title is required." }, { status: 400 });
    }

    if (typeof payload.body !== "string" || !payload.body.trim()) {
      return NextResponse.json({ error: "Issue body is required." }, { status: 400 });
    }

    const issue = await createIssue(payload.repoFullName, payload.title.trim(), payload.body.trim());
    return NextResponse.json({ issue });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to create GitHub issue." },
      { status: 500 }
    );
  }
});