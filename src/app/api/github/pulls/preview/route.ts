import { NextResponse } from "next/server";
import { getPullRequestPreviewUrl, validateRepoFullName } from "@/lib/github";
import { withAuth } from "@/lib/requireAuth";

export const dynamic = "force-dynamic";

export const GET = withAuth(async (request: Request) => {
  try {
    const { searchParams } = new URL(request.url);
    const repoFullName = searchParams.get("repoFullName");
    const headBranch = searchParams.get("headBranch");

    if (!validateRepoFullName(repoFullName)) {
      return NextResponse.json({ error: "Choose a valid repository." }, { status: 400 });
    }

    if (!headBranch?.trim()) {
      return NextResponse.json({ error: "Head branch is required." }, { status: 400 });
    }

    const previewUrl = await getPullRequestPreviewUrl(repoFullName, headBranch);
    return NextResponse.json({ previewUrl });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to load preview URL." },
      { status: 500 }
    );
  }
});