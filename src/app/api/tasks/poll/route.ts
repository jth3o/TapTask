import { Agent } from "@cursor/sdk";
import { NextResponse } from "next/server";
import { findPullRequestForTask, getCIStatus, getIssue, getPullRequest, validateRepoFullName } from "@/lib/github";
import { ActiveTaskStatus, CIStatus } from "@/lib/types";
import { withAuth } from "@/lib/requireAuth";

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
  prIsDraft?: boolean;
  ciStatus?: CIStatus;
  ciUrl?: string;
  note: string;
};

function extractPrNumber(prUrl: string): number | undefined {
  const m = prUrl.match(/\/pull\/(\d+)(?:\/|$)/);
  return m ? parseInt(m[1], 10) : undefined;
}

function ok(
  status: ActiveTaskStatus,
  prFound: boolean,
  fields: Partial<Pick<PollResult, "prNumber" | "prUrl" | "branch" | "prIsDraft" | "ciStatus" | "ciUrl">>,
  note: string,
) {
  return NextResponse.json({ status, prFound, note, ...fields } satisfies PollResult);
}

async function fieldsForPR(repoFullName: string, pr: NonNullable<Awaited<ReturnType<typeof getPullRequest>>>) {
  const ci = pr.draft ? null : await getCIStatus(repoFullName, pr.headSha);
  return {
    prNumber: pr.number,
    prUrl: pr.htmlUrl,
    branch: pr.headBranch,
    prIsDraft: pr.draft || undefined,
    ciStatus: ci?.status,
    ciUrl: ci?.url,
  };
}

export const POST = withAuth(async (request: Request) => {
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

    // ── Strategy 1: known PR number — direct lookup ───────────────────────────
    if (knownPrNum) {
      const pr = await getPullRequest(repoFullName, knownPrNum);
      if (!pr) return ok("failed", false, {}, `PR #${knownPrNum} not found — it may have been deleted or the repo removed.`);
      const status: ActiveTaskStatus = pr.merged ? "merged" : pr.state === "closed" ? "closed" : "pr_open";
      const note = pr.draft ? `PR #${pr.number} is a draft.` : `PR #${pr.number} — ${status}.`;
      return ok(status, true, await fieldsForPR(repoFullName, pr), note);
    }

    // ── Strategy 2: Cursor SDK — ask Cursor directly for run status + PR URL ──
    if (runId && agentId) {
      const apiKey = process.env.CURSOR_API_KEY;
      if (!apiKey) {
        console.warn("[poll] CURSOR_API_KEY not set — skipping Cursor SDK check.");
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
          const cs          = cursorRun.status;
          const gitBranches = cursorRun.git?.branches ?? [];
          const prBranch    = gitBranches.find((b) => b.prUrl) ?? gitBranches[0];
          const cursorPrUrl = prBranch?.prUrl;
          const cursorBranch = prBranch?.branch ?? branch;

          console.log(`[poll] Cursor run ${runId}: status=${cs} branch=${cursorBranch ?? "none"} prUrl=${cursorPrUrl ?? "none"}`);

          // Agent reported a PR URL — verify + return it
          if (cursorPrUrl) {
            const prNum = extractPrNumber(cursorPrUrl);
            if (prNum) {
              const pr = await getPullRequest(repoFullName, prNum);
              if (pr) {
                const status: ActiveTaskStatus = pr.merged ? "merged" : pr.state === "closed" ? "closed" : "pr_open";
                return ok(status, true, await fieldsForPR(repoFullName, pr),
                  pr.draft ? `PR #${pr.number} is a draft.` : `Cursor ${cs} — PR #${pr.number} ready.`);
              }
            }
            // Try extracting prNumber from URL for ciStatus even if getPullRequest failed
            const fallbackPrNum = extractPrNumber(cursorPrUrl);
            return ok("pr_open", true, { prUrl: cursorPrUrl, branch: cursorBranch, prNumber: fallbackPrNum },
              `Cursor ${cs} — PR URL received but couldn't verify on GitHub.`);
          }

          // Cursor failed or was cancelled
          if (cs === "error" || cs === "cancelled") {
            return ok("failed", false, { branch: cursorBranch },
              `Cursor run ended with status: ${cs}.`);
          }

          // For running OR finished — always do a GitHub PR scan first.
          const ghPr = await findPullRequestForTask(repoFullName, {
            issueNumber,
            branch: cursorBranch,
            startedAt,
          });

          if (ghPr) {
            const status: ActiveTaskStatus = ghPr.merged ? "merged" : ghPr.state === "closed" ? "closed" : "pr_open";
            return ok(status, true, await fieldsForPR(repoFullName, ghPr),
              ghPr.draft ? `PR #${ghPr.number} is a draft.` : `Cursor ${cs} — PR #${ghPr.number} found on GitHub.`);
          }

          // No PR found on GitHub yet
          if (cs === "running") {
            return ok("running", false, { branch: cursorBranch },
              `Cursor is running${cursorBranch ? ` on branch "${cursorBranch}"` : ""}. No PR yet.`);
          }

          // cs === "finished" but no PR anywhere — surface branch for manual lookup
          return ok("pr_open", false, { branch: cursorBranch },
            `Cursor finished${cursorBranch ? ` on branch "${cursorBranch}"` : ""} — no PR found automatically. Check GitHub.`);
        }

        // Cursor SDK call failed — fall through with error in note
        if (cursorError) {
          console.log("[poll] Falling through to GitHub scan. Cursor error:", cursorError);
        }
      }
    } else {
      console.log(`[poll] No runId/agentId — GitHub scan only. runId=${runId ?? "none"} agentId=${agentId ?? "none"}`);
    }

    // ── Strategy 3: GitHub PR scan (branch / body / title / time) ────────────
    const pr = await findPullRequestForTask(repoFullName, { issueNumber, branch, startedAt });
    if (!pr) {
      const hasIds = runId && agentId;
      const elapsed = startedAt
        ? Math.floor((Date.now() - new Date(startedAt).getTime()) / 60000)
        : null;
      const elapsedNote = elapsed !== null ? ` (running ${elapsed}m)` : "";

      // Check if the issue was closed without a PR (cancelled / dismissed)
      const issue = await getIssue(repoFullName, issueNumber);
      if (issue?.state === "closed") {
        return ok("closed", false, {}, "Issue was closed without a PR — task cancelled or dismissed.");
      }

      // Timeout: if no PR after 2 hours, the agent is likely stuck
      if (elapsed !== null && elapsed > 120) {
        return ok("failed", false, {},
          `No PR found after ${elapsed}m. The agent may have stalled — check GitHub Actions or redispatch.`);
      }

      return ok("running", false, {},
        hasIds
          ? `SDK check failed — GitHub scan found no PR yet${elapsedNote}. Agent may still be working.`
          : `No runId/agentId — GitHub scan found no PR${elapsedNote}.`);
    }
    const status: ActiveTaskStatus = pr.merged ? "merged" : pr.state === "closed" ? "closed" : "pr_open";
    const ci = status === "pr_open" ? await getCIStatus(repoFullName, pr.headSha) : null;
    return ok(status, true, {
      prNumber: pr.number,
      prUrl: pr.htmlUrl,
      branch: pr.headBranch,
      prIsDraft: pr.draft || undefined,
      ciStatus: ci?.status,
      ciUrl: ci?.url,
    }, `PR #${pr.number} found via GitHub scan.`);

  } catch (error) {
    const msg = error instanceof Error ? error.message : "Poll failed.";
    // Repo deleted or resource not found — mark as failed so the UI reflects it
    if (msg.includes("404") || msg.toLowerCase().includes("not found")) {
      return ok("failed", false, {}, "Repository or resource not found — it may have been deleted.");
    }
    return NextResponse.json({ error: msg }, { status: 500 });
  }
});