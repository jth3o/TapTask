import { NextResponse } from "next/server";
import { listOpenPullRequests, listAllPullRequests, validateRepoFullName } from "@/lib/github";
import { withAuth } from "@/lib/requireAuth";

export const dynamic = "force-dynamic";

export const GET = withAuth(async (request: Request) => {
  try {
    const { searchParams } = new URL(request.url);
    const repoFullName = searchParams.get("repoFullName");
    const state = searchParams.get("state") ?? "open";

    if (!validateRepoFullName(repoFullName)) {
      return NextResponse.json({ error: "Choose a valid repository before loading pull requests." }, { status: 400 });
    }

    const pulls = state === "all" ? await listAllPullRequests(repoFullName) : await listOpenPullRequests(repoFullName);
    return NextResponse.json({ pulls });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to load open pull requests." },
      { status: 500 }
    );
  }
});