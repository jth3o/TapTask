import { Agent } from "@cursor/sdk";
import { NextResponse } from "next/server";
import { findPullRequestForTask, getPullRequest, validateRepoFullName } from "@/lib/github";
import { ActiveTaskStatus } from "@/lib/types";

export const runtime = "nodejs";

type PollBody = {
  repoFullName?: unknown;
  issueNumber?: unknown;
  prNumber?: unknown;
  branch?: unknown;
  startedAt?: unknown;
  runId?: unknown;
  agentId?: unknown;
};

export type PollResult = {
  status: ActiveTaskStatus;
  prFound: boolean;
  prNumber?: number;
  prUrl?: string;
  branch?: string;
  note: string; // human-readable description of what happened — shown in the UI
};

function extractPrNumber(prUrl: string): number | undefined {
  const m = prUrl.match(/\/pull\/(\d+)(?:\/|$)/);
  return m ? parseInt(m[1], 10) : undefined;
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as PollBody;

    if (!validateRepoFullName(body.repoFullName)) {
      return NextResponse.json({ error: "Invalid repository name." }, { status: 400 });
    }
    if (typeof body.issueNumber !== "number" || body.issueNumber < 1) {
      return NextResponse.json({ error: "issueNumber is required." }, { status: 400 });
    }

    const repoFullName = body.repoFullName;
    const issueNumber  = body.issueNumber;
    const knownPrNum   = typeof body.prNumber  === "number" ? body.prNumber  : undefined;
    const branch       = typeof body.branch    === "string" && body.branch    ? body.branch    : undefined;
    const startedAt    = typeof body.startedAt === "string" ? body.startedAt : undefined;
    const runId        = typeof body.runId     === "string" && body.runId     ? body.runId     : undefined;
    const agentId      = typeof body.agentId   === "string" && body.agentId   ? body.agentId   : undefined;

    // ── Strategy 1: known PR number ──────────────────────────────────────────
    if (knownPrNum) {
      const pr = await getPullRequest(repoFullName, knownPrNum);
      if (!pr) return ok("running", false, {}, `PR #${knownPrNum} not found on GitHub.`);
      const status: ActiveTaskStatus = pr.merged ? "merged" : pr.state === "closed" ? "closed" : "pr_open";
      return ok(status, true, { prNumber: pr.number, prUrl: pr.htmlUrl, branch: pr.headBranch },
        `Found PR #${pr.number} directly.`);
    }

    // ── Strategy 2: Cursor SDK run status ────────────────────────────────────
    if (runId && agentId) {
      const apiKey = process.env.CURSOR_API_KEY;
      if (!apiKey) {
        // No API key — skip Cursor check, fall through to GitHub scan
        console.warn("[poll] CURSOR_API_KEY not set, skipping Cursor SDK check.");
      } else {
        let cursorRun: Awaited<ReturnType<typeof Agent.getRun>> | null = null;
        let cursorError = "";
        try {
          cursorRun = await Agent.getRun(runId, { runtime: "cloud", agentId, apiKey });
        } catch (err) {
          cursorError = err instanceof Error ? err.message : String(err);
          console.error("[poll] Agent.getRun failed:", cursorError);
        }

        if (cursorRun) {
          const cs = cursorRun.status; // "running" | "finished" | "error" | "cancelled"
          const gitBranches = cursorRun.git?.branches ?? [];
          const prBranch = gitBranches.find((b) => b.prUrl) ?? gitBranches[0];
          const cursorPrUrl = prBranch?.prUrl;
          const cursorBranch = prBranch?.branch;

          console.log(`[poll] Cursor run ${runId}: status=${cs} prUrl=${cursorPrUrl ?? "none"} branch=${cursorBranch ?? "none"}`);

          if (cursorPrUrl) {
            const prNum = extractPrNumber(cursorPrUrl);
            if (prNum) {
              const pr = await getPullRequest(repoFullName, prNum);
              if (pr) {
                const status: ActiveTaskStatus = pr.merged ? "merged" : pr.state === "closed" ? "closed" : "pr_open";
                return ok(status, true, { prNumber: pr.number, prUrl: pr.htmlUrl, branch: pr.headBranch },
                  `Cursor run ${cs} — PR #${pr.number} found.`);
              }
            }
            // Cursor gave us a URL but GitHub fetch failed — still report it
            return ok("pr_open", true, { prUrl: cursorPrUrl, branch: cursorBranch },
              `Cursor run ${cs} — PR URL from Cursor (couldn't verify on GitHub).`);
          }

          if (cs === "error" || cs === "cancelled") {
            return ok("failed", false, {}, `Cursor run ended with status: ${cs}.`);
          }
          if (cs === "running") {
            return ok("running", false, { branch: cursorBranch },
              `Cursor run is still running${cursorBranch ? ` on branch ${cursorBranch}` : ""}.`);
          }
          // cs === "finished" but no PR URL — Cursor finished without creating a PR
          // Fall through to GitHub scan as last resort
          console.log("[poll] Cursor finished but no prUrl — falling through to GitHub scan.");
        } else if (cursorError) {
          // Cursor SDK failed — fall through to GitHub scan, note the error
          console.log("[poll] Falling through to GitHub scan after Cursor error:", cursorError);
        }
      }
    } else {
      console.log(`[poll] No runId/agentId stored — using GitHub scan. runId=${runId} agentId=${agentId}`);
    }

    // ── Strategy 3: GitHub PR scan ────────────────────────────────────────────
    const pr = await findPullRequestForTask(repoFullName, { issueNumber, branch, startedAt });
    if (!pr) {
      const hint = !runId
        ? "No Cursor run ID stored — redispatch this task to enable Cursor tracking."
        : "No matching PR found on GitHub yet.";
      return ok("running", false, {}, hint);
    }
    const status: ActiveTaskStatus = pr.merged ? "merged" : pr.state === "closed" ? "closed" : "pr_open";
    return ok(status, true, { prNumber: pr.number, prUrl: pr.htmlUrl, branch: pr.headBranch },
      `Found PR #${pr.number} via GitHub scan.`);

  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Poll failed." },
      { status: 500 }
    );
  }
}

function ok(
  status: ActiveTaskStatus,
  prFound: boolean,
  fields: Partial<Pick<PollResult, "prNumber" | "prUrl" | "branch">>,
  note: string,
) {
  return NextResponse.json({ status, prFound, note, ...fields } satisfies PollResult);
}
