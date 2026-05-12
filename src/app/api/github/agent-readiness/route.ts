import { NextResponse } from "next/server";
import { getAgentReadiness, validateRepoFullName } from "@/lib/github";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const repoFullName = searchParams.get("repoFullName");

    if (!validateRepoFullName(repoFullName)) {
      return NextResponse.json({ error: "Choose a valid repository before checking agent readiness." }, { status: 400 });
    }

    const readiness = await getAgentReadiness(repoFullName);
    return NextResponse.json(readiness);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to check agent readiness." },
      { status: 500 }
    );
  }
}
