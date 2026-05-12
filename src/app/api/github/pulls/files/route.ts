import { NextResponse } from "next/server";
import { getPullRequestFiles, validateRepoFullName } from "@/lib/github";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const repoFullName = searchParams.get("repoFullName");
    const pullNumberRaw = searchParams.get("pullNumber");
    const pullNumber = pullNumberRaw ? parseInt(pullNumberRaw, 10) : NaN;

    if (!validateRepoFullName(repoFullName)) {
      return NextResponse.json({ error: "Choose a valid repository." }, { status: 400 });
    }

    if (!Number.isInteger(pullNumber) || pullNumber < 1) {
      return NextResponse.json({ error: "Pull request number is invalid." }, { status: 400 });
    }

    const files = await getPullRequestFiles(repoFullName, pullNumber);
    return NextResponse.json({ files });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to load PR files." },
      { status: 500 }
    );
  }
}
