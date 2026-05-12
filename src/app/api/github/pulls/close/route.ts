import { NextResponse } from "next/server";
import { closePullRequest, validateRepoFullName } from "@/lib/github";

type CloseBody = {
  repoFullName?: unknown;
  pullNumber?: unknown;
};

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as CloseBody;

    if (!validateRepoFullName(payload.repoFullName)) {
      return NextResponse.json({ error: "Choose a valid repository before closing a PR." }, { status: 400 });
    }

    if (typeof payload.pullNumber !== "number" || !Number.isInteger(payload.pullNumber) || payload.pullNumber < 1) {
      return NextResponse.json({ error: "Pull request number is invalid." }, { status: 400 });
    }

    await closePullRequest(payload.repoFullName, payload.pullNumber);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to close pull request." },
      { status: 500 }
    );
  }
}
