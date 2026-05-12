import { NextResponse } from "next/server";
import { listRepos } from "@/lib/github";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const repos = await listRepos();
    return NextResponse.json({ repos });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to load GitHub repositories." },
      { status: 500 }
    );
  }
}
