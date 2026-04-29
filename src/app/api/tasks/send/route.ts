import { NextResponse } from "next/server";
import { createIssue, createIssueComment, getAgentReadiness, validateRepoFullName } from "@/lib/github";
import {
  buildIssueTitle,
  CLAUDE_DISPATCH_COMMENT,
  generateAgentPrompt,
  generateCodexImplementationCommand,
  generateCursorTaskPrompt,
  generateIssueBody
} from "@/lib/generateIssue";
import { Agent, AGENT_OPTIONS, CodexDispatchMode, TaskType, TASK_TYPE_OPTIONS } from "@/lib/types";

type SendTaskBody = {
  repoFullName?: unknown;
  taskType?: unknown;
  agent?: unknown;
  rawInput?: unknown;
  allowIssueOnly?: unknown;
  codexEnabled?: unknown;
  codexDispatchMode?: unknown;
  cursorEnabled?: unknown;
  cursorOpenUrl?: unknown;
};

const taskTypes = new Set(TASK_TYPE_OPTIONS.map((option) => option.value));
const agents = new Set(AGENT_OPTIONS.map((option) => option.value));

function isTaskType(value: unknown): value is TaskType {
  return typeof value === "string" && taskTypes.has(value as TaskType);
}

function isAgent(value: unknown): value is Agent {
  return typeof value === "string" && agents.has(value as Agent);
}

function codexDispatchMode(value: unknown): CodexDispatchMode {
  return value === "pr_review" ? "pr_review" : "issue_implementation";
}

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as SendTaskBody;

    if (!validateRepoFullName(payload.repoFullName)) {
      return NextResponse.json({ error: "Choose a valid repository before sending a task." }, { status: 400 });
    }

    if (!isTaskType(payload.taskType)) {
      return NextResponse.json({ error: "Choose a valid task type." }, { status: 400 });
    }

    if (!isAgent(payload.agent)) {
      return NextResponse.json({ error: "Choose a valid agent." }, { status: 400 });
    }

    if (typeof payload.rawInput !== "string" || !payload.rawInput.trim()) {
      return NextResponse.json({ error: "Describe the task before sending it." }, { status: 400 });
    }

    const input = {
      taskId: crypto.randomUUID(),
      repoFullName: payload.repoFullName,
      taskType: payload.taskType,
      agent: payload.agent,
      rawInput: payload.rawInput.trim()
    };
    const issueTitle = buildIssueTitle(input.taskType, input.rawInput);
    const issueBody = generateIssueBody(input);
    const agentPrompt = generateAgentPrompt(input);

    if (input.agent === "codex") {
      const issue = await createIssue(input.repoFullName, issueTitle, issueBody);
      const codexCommand = generateCodexImplementationCommand({ issueNumber: issue.number, issueUrl: issue.htmlUrl });
      const codexPrompt = `${agentPrompt}

Codex command:
${codexCommand}`;
      const enabled = payload.codexEnabled === true;
      const mode = codexDispatchMode(payload.codexDispatchMode);

      return NextResponse.json({
        taskId: input.taskId,
        issueCreated: true,
        issueNumber: issue.number,
        issueUrl: issue.htmlUrl,
        issueTitle: issue.title,
        issueBody,
        dispatchAttempted: false,
        dispatchStatus: enabled ? "issue_created" : "future_integration",
        message: enabled
          ? mode === "pr_review"
            ? "Issue created. Codex PR Review mode comments @codex review from an open PR card."
            : "Issue created. Copy the Codex implementation command to use with ChatGPT/Codex."
          : "Issue created. Codex is not marked enabled in Agent Connections.",
        agentPrompt: codexPrompt,
        codexCommand
      });
    }

    if (input.agent === "cursor") {
      const issue = await createIssue(input.repoFullName, issueTitle, issueBody);
      const cursorOpenUrl = typeof payload.cursorOpenUrl === "string" && payload.cursorOpenUrl.trim()
        ? payload.cursorOpenUrl.trim()
        : "https://cursor.com/agents";
      const cursorPrompt = generateCursorTaskPrompt({ ...input, issueUrl: issue.htmlUrl });

      return NextResponse.json({
        taskId: input.taskId,
        issueCreated: true,
        issueNumber: issue.number,
        issueUrl: issue.htmlUrl,
        issueTitle: issue.title,
        issueBody,
        dispatchAttempted: false,
        dispatchStatus: payload.cursorEnabled === true ? "issue_created" : "future_integration",
        message: payload.cursorEnabled === true
          ? "Issue created. Copy the Cursor task and open Cursor to continue."
          : "Issue created. Cursor is semi-automatic in TapTask v1; copy the task into Cursor.",
        agentPrompt: cursorPrompt,
        cursorOpenUrl
      });
    }

    if (input.agent === "manual") {
      const issue = await createIssue(input.repoFullName, issueTitle, issueBody);

      return NextResponse.json({
        taskId: input.taskId,
        issueCreated: true,
        issueNumber: issue.number,
        issueUrl: issue.htmlUrl,
        issueTitle: issue.title,
        issueBody,
        dispatchAttempted: false,
        dispatchStatus: "issue_created",
        message: "Issue created only.",
        agentPrompt
      });
    }

    const readiness = await getAgentReadiness(input.repoFullName);

    if (!readiness.claude.connected) {
      if (payload.allowIssueOnly !== true) {
        return NextResponse.json(
          {
            taskId: input.taskId,
            issueCreated: false,
            dispatchAttempted: false,
            dispatchStatus: "agent_not_connected",
            readinessAtSend: readiness,
            message: "Claude is not connected for this repo. Enable issue-only send to create a GitHub issue without dispatch.",
            agentPrompt
          },
          { status: 409 }
        );
      }

      const issue = await createIssue(input.repoFullName, issueTitle, issueBody);

      return NextResponse.json({
        taskId: input.taskId,
        issueCreated: true,
        issueNumber: issue.number,
        issueUrl: issue.htmlUrl,
        issueTitle: issue.title,
        issueBody,
        dispatchAttempted: false,
        dispatchStatus: "agent_not_connected",
        readinessAtSend: readiness,
        message: "Issue created only — Claude is not connected for this repo.",
        agentPrompt
      });
    }

    const issue = await createIssue(input.repoFullName, issueTitle, issueBody);

    try {
      await createIssueComment(input.repoFullName, issue.number, CLAUDE_DISPATCH_COMMENT);

      return NextResponse.json({
        taskId: input.taskId,
        issueCreated: true,
        issueNumber: issue.number,
        issueUrl: issue.htmlUrl,
        issueTitle: issue.title,
        issueBody,
        dispatchAttempted: true,
        dispatchStatus: "sent_to_claude",
        readinessAtSend: readiness,
        message: "Sent to Claude.",
        agentPrompt
      });
    } catch (error) {
      return NextResponse.json({
        taskId: input.taskId,
        issueCreated: true,
        issueNumber: issue.number,
        issueUrl: issue.htmlUrl,
        issueTitle: issue.title,
        issueBody,
        dispatchAttempted: true,
        dispatchStatus: "dispatch_failed",
        readinessAtSend: readiness,
        message: "Issue created, but Claude dispatch failed.",
        dispatchError: error instanceof Error ? error.message : "Unable to send the Claude dispatch comment.",
        agentPrompt
      });
    }
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to send task." },
      { status: 500 }
    );
  }
}
