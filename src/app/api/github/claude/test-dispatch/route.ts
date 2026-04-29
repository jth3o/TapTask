import { NextResponse } from "next/server";
import { createIssue, createIssueComment, getAgentReadiness, validateRepoFullName } from "@/lib/github";
import { CLAUDE_TEST_DISPATCH_COMMENT, generateClaudeConnectionTestIssue } from "@/lib/generateIssue";

type TestDispatchBody = {
  repoFullName?: unknown;
};

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as TestDispatchBody;

    if (!validateRepoFullName(payload.repoFullName)) {
      return NextResponse.json({ error: "Choose a valid repository before testing Claude dispatch." }, { status: 400 });
    }

    const readiness = await getAgentReadiness(payload.repoFullName);
    const testIssue = generateClaudeConnectionTestIssue(payload.repoFullName);
    const issue = await createIssue(payload.repoFullName, testIssue.title, testIssue.body);

    try {
      await createIssueComment(payload.repoFullName, issue.number, CLAUDE_TEST_DISPATCH_COMMENT);

      return NextResponse.json({
        issueNumber: issue.number,
        issueUrl: issue.htmlUrl,
        issueTitle: issue.title,
        commentPosted: true,
        readiness,
        status: readiness.claude.connected ? "Test dispatch comment posted." : "Test issue created, but Claude is not likely connected."
      });
    } catch (error) {
      return NextResponse.json({
        issueNumber: issue.number,
        issueUrl: issue.htmlUrl,
        issueTitle: issue.title,
        commentPosted: false,
        readiness,
        status: "Test issue created, but the Claude confirmation comment failed.",
        error: error instanceof Error ? error.message : "Unable to post Claude test comment."
      });
    }
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to test Claude dispatch." },
      { status: 500 }
    );
  }
}
