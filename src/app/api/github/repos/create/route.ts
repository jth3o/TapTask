import { NextResponse } from "next/server";
import { createRepo, scaffoldRepo } from "@/lib/github";
import { getStarterFiles, TEMPLATE_LABELS } from "@/lib/starterTemplates";
import { ProjectType } from "@/lib/types";
import { withAuth } from "@/lib/requireAuth";

interface CreateRepoRequest {
  projectName: string;
  description: string;
  projectType: ProjectType;
  visibility: "private" | "public";
}

interface CreateRepoApiResponse {
  fullName: string;
  htmlUrl: string;
  defaultBranch: string;
  cloneUrl: string;
  commitSha: string;
  templateLabel: string;
  fileCount: number;
  error?: string;
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 100) || "new-project";
}

export const POST = withAuth(async (request: Request) => {
  let body: CreateRepoRequest;
  try {
    body = (await request.json()) as CreateRepoRequest;
  } catch {
    return NextResponse.json({ error: "Invalid request body." } as CreateRepoApiResponse, { status: 400 });
  }

  const { projectName, description, projectType, visibility } = body;

  if (!projectName?.trim()) {
    return NextResponse.json({ error: "Project name is required." } as CreateRepoApiResponse, { status: 400 });
  }

  const repoName = slugify(projectName.trim());
  const files = getStarterFiles(projectType, projectName.trim(), description);

  try {
    // Step 1: create the empty repo
    const repo = await createRepo({
      name: repoName,
      description: description || projectName,
      private: visibility === "private",
    });

    // Step 2: scaffold all starter files in a single commit
    const { commitSha } = await scaffoldRepo({
      fullName: repo.fullName,
      files,
      commitMessage: `Initial commit: TapTask scaffold (${TEMPLATE_LABELS[projectType]})`,
      branch: "main",
    });

    return NextResponse.json({
      fullName: repo.fullName,
      htmlUrl: repo.htmlUrl,
      defaultBranch: "main",
      cloneUrl: repo.cloneUrl,
      commitSha,
      templateLabel: TEMPLATE_LABELS[projectType],
      fileCount: files.length,
    } as CreateRepoApiResponse);
  } catch (err) {
    let message = err instanceof Error ? err.message : "Repo creation failed.";
    // Help the user understand the most common 422 cause
    if (message.includes("422") || message.toLowerCase().includes("already exists") || message.toLowerCase().includes("name already")) {
      message = `A repo named "${repoName}" already exists on your GitHub account. Try a different name.`;
    }
    return NextResponse.json({ error: message } as CreateRepoApiResponse, { status: 500 });
  }
});