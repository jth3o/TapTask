import { Agent } from "@cursor/sdk";
import { NextResponse } from "next/server";
import { createIssue, getRepo, validateRepoFullName } from "@/lib/github";
import { buildIssueTitle, generateCursorSdkPrompt, generateIssueBody } from "@/lib/generateIssue";
import { CursorRunInfo, SendTaskResponse, TaskType, TASK_TYPE_OPTIONS } from "@/lib/types";

export const runtime = "nodejs";

type CursorRunBody = {
  repoFullName?: unknown;
  taskType?: unknown;
  rawInput?: unknown;
};

const taskTypes = new Set(TASK_TYPE_OPTIONS.map((option) => option.value));

function isTaskType(value: unknown): value is TaskType {
  return typeof value === "string" && taskTypes.has(value as TaskType);
}

function getCursorApiKey() {
  const apiKey = process.env.CURSOR_API_KEY;
  if (!apiKey) {
    throw new Error("Cursor API key is not configured. Add CURSOR_API_KEY to .env.local.");
  }
  return apiKey;
}

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as CursorRunBody;

    if (!validateRepoFullName(payload.repoFullName)) {
      return NextResponse.json({ error: "Choose a valid repository before sending to Cursor." }, { status: 400 });
    }

    if (!isTaskType(payload.taskType)) {
      return NextResponse.json({ error: "Choose a valid task type." }, { status: 400 });
    }

    if (typeof payload.rawInput !== "string" || !payload.rawInput.trim()) {
      return NextResponse.json({ error: "Describe the task before sending it to Cursor." }, { status: 400 });
    }

    const taskId = crypto.randomUUID();
    const repo = await getRepo(payload.repoFullName);
    const issueTitle = buildIssueTitle(payload.taskType, payload.rawInput);
    const issueBody = generateIssueBody({
      taskId,
      repoFullName: payload.repoFullName,
      taskType: payload.taskType,
      agent: "cursor",
      rawInput: payload.rawInput.trim()
    });
    const issue = await createIssue(payload.repoFullName, issueTitle, issueBody);
    const cursorPrompt = generateCursorSdkPrompt({
      taskId,
      repoFullName: payload.repoFullName,
      taskType: payload.taskType,
      agent: "cursor",
      rawInput: payload.rawInput.trim(),
      issueNumber: issue.number,
      issueTitle: issue.title,
      issueUrl: issue.htmlUrl,
      issueBody,
      defaultBranch: repo.defaultBranch
    });

    try {
      const cursorAgent = await Agent.create({
        apiKey: getCursorApiKey(),
        name: `TapTask #${issue.number}: ${issue.title}`,
        cloud: {
          repos: [{ url: repo.htmlUrl, startingRef: repo.defaultBranch }],
          autoCreatePR: true
        }
      });
      const run = await cursorAgent.send(cursorPrompt);
      const prUrl = run.git?.branches.find((branch) => branch.prUrl)?.prUrl;
      const cursorRun: CursorRunInfo = {
        runId: run.id,
        agentId: run.agentId,
        status: run.status,
        events: ["Cursor cloud run started."],
        prUrl
      };

      return NextResponse.json({
        taskId,
        issueCreated: true,
        issueNumber: issue.number,
        issueUrl: issue.htmlUrl,
        issueTitle: issue.title,
        issueBody,
        dispatchAttempted: true,
        dispatchStatus: "cursor_run_started",
        message: "Cursor run started.",
        agentPrompt: cursorPrompt,
        cursorRun
      } satisfies SendTaskResponse);
    } catch (error) {
      const cursorRun: CursorRunInfo = {
        status: "failed",
        events: [error instanceof Error ? error.message : "Cursor SDK run failed."]
      };

      return NextResponse.json({
        taskId,
        issueCreated: true,
        issueNumber: issue.number,
        issueUrl: issue.htmlUrl,
        issueTitle: issue.title,
        issueBody,
        dispatchAttempted: true,
        dispatchStatus: "dispatch_failed",
        dispatchError: error instanceof Error ? error.message : "Cursor SDK run failed.",
        message: "Issue created, but Cursor run failed to start.",
        agentPrompt: cursorPrompt,
        cursorRun
      } satisfies SendTaskResponse);
    }
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to start Cursor run." },
      { status: 500 }
    );
  }
}
