import { NextResponse } from "next/server";
import { createIssue, createIssueComment, validateRepoFullName } from "@/lib/github";
import {
  CLAUDE_DISPATCH_COMMENT,
  EXPLAIN_CHANGES_COMMENT,
  REDUCE_DIFF_COMMENT,
  FollowUpAction,
  FollowUpContext,
  generateFollowUpIssue,
  generateCursorTaskPrompt
} from "@/lib/generateIssue";

type FollowUpBody = {
  repoFullName?: unknown;
  pullNumber?: unknown;
  pullTitle?: unknown;
  pullUrl?: unknown;
  headBranch?: unknown;
  action?: unknown;
};

const VALID_ACTIONS = new Set<FollowUpAction>([
  "fix_build",
  "make_smaller_diff",
  "polish_ui",
  "add_readme",
  "explain_changes",
  "create_followup",
  "start_over"
]);

function isFollowUpAction(value: unknown): value is FollowUpAction {
  return typeof value === "string" && VALID_ACTIONS.has(value as FollowUpAction);
}

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as FollowUpBody;

    if (!validateRepoFullName(payload.repoFullName)) {
      return NextResponse.json({ error: "Choose a valid repository." }, { status: 400 });
    }

    if (typeof payload.pullNumber !== "number" || !Number.isInteger(payload.pullNumber) || payload.pullNumber < 1) {
      return NextResponse.json({ error: "Pull request number is invalid." }, { status: 400 });
    }

    if (!isFollowUpAction(payload.action)) {
      return NextResponse.json({ error: "Invalid follow-up action." }, { status: 400 });
    }

    const ctx: FollowUpContext = {
      repoFullName: payload.repoFullName,
      pullNumber: payload.pullNumber,
      pullTitle: typeof payload.pullTitle === "string" ? payload.pullTitle : `PR #${payload.pullNumber}`,
      pullUrl: typeof payload.pullUrl === "string" ? payload.pullUrl : "",
      headBranch: typeof payload.headBranch === "string" ? payload.headBranch : ""
    };

    // Comment-only actions (no issue created)
    if (payload.action === "explain_changes") {
      await createIssueComment(ctx.repoFullName, ctx.pullNumber, EXPLAIN_CHANGES_COMMENT);
      return NextResponse.json({
        type: "comment",
        commentPosted: true,
        message: "Explanation requested. @claude will reply on the PR."
      });
    }

    const { title, body, taskType } = generateFollowUpIssue(payload.action, ctx);
    const taskId = crypto.randomUUID();
    const issueBodyWithId = body + `\n\n---\nTask ID: ${taskId}`;

    const issue = await createIssue(ctx.repoFullName, title, issueBodyWithId);

    // Auto-dispatch to Claude if it's connected (best-effort — dispatch comment triggers GitHub Action)
    let dispatched = false;
    try {
      await createIssueComment(ctx.repoFullName, issue.number, CLAUDE_DISPATCH_COMMENT);
      dispatched = true;
    } catch {
      // Claude not connected — that's fine, issue is still created
    }

    const cursorPrompt = generateCursorTaskPrompt({
      taskId,
      repoFullName: ctx.repoFullName,
      taskType,
      agent: "cursor",
      rawInput: title,
      issueUrl: issue.htmlUrl
    });

    return NextResponse.json({
      type: "issue",
      issueNumber: issue.number,
      issueUrl: issue.htmlUrl,
      issueTitle: issue.title,
      dispatched,
      cursorPrompt,
      message: dispatched
        ? `Issue #${issue.number} created and sent to Claude.`
        : `Issue #${issue.number} created. Copy the Cursor prompt to dispatch manually.`
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to create follow-up." },
      { status: 500 }
    );
  }
}

export { REDUCE_DIFF_COMMENT };
