import { Agent, TaskType, TASK_TYPE_OPTIONS } from "./types";

type IssueInput = {
  taskId?: string;
  repoFullName: string;
  taskType: TaskType;
  agent: Agent;
  rawInput: string;
};

const taskTypeDetails: Record<TaskType, { titlePrefix: string; goal: string; criteria: string[] }> = {
  new_feature: {
    titlePrefix: "New Feature",
    goal: "Implement one small feature that directly matches the request.",
    criteria: [
      "The requested feature is available in the smallest useful form.",
      "Expected behavior is clear in the implementation or UI."
    ]
  },
  fix_bug: {
    titlePrefix: "Fix Bug",
    goal: "Identify the likely root cause and make the smallest fix that resolves it.",
    criteria: [
      "The likely root cause is addressed with a minimal change.",
      "Validation steps explain how the bug was reproduced or checked."
    ]
  },
  polish_ui: {
    titlePrefix: "Polish UI",
    goal: "Improve layout, spacing, responsiveness, tap targets, mobile usability, and visual clarity without changing business logic.",
    criteria: [
      "The affected UI is cleaner and easier to use on mobile.",
      "Business logic and data flow are unchanged."
    ]
  },
  fix_build: {
    titlePrefix: "Fix Build",
    goal: "Fix only build, type, or lint errors without adding product features.",
    criteria: [
      "The exact failing build command is run and passes, or any remaining failure is explained.",
      "No feature work is included."
    ]
  },
  refactor: {
    titlePrefix: "Refactor",
    goal: "Preserve behavior while improving structure within strict boundaries.",
    criteria: [
      "Behavior remains the same for users.",
      "The refactor is limited to the requested area and avoids unrelated rewrites."
    ]
  },
  add_test: {
    titlePrefix: "Add Test",
    goal: "Add focused tests for existing behavior without changing product behavior.",
    criteria: [
      "Focused tests cover the requested behavior or regression.",
      "Product behavior is unchanged except where test setup requires harmless fixtures."
    ]
  },
  review_pr: {
    titlePrefix: "Review PR",
    goal: "Review the requested PR or change for bugs, edge cases, complexity, security, performance, mobile UX, and unnecessary changes.",
    criteria: [
      "The review identifies concrete risks with file or code references where possible.",
      "The output separates must-fix issues from suggestions."
    ]
  },
  write_readme: {
    titlePrefix: "Write README",
    goal: "Document setup, scripts, environment variables, usage, deployment notes, and known limits.",
    criteria: [
      "The README explains local setup and common scripts.",
      "Environment variables, usage, deployment notes, and known limitations are covered."
    ]
  },
  deploy_check: {
    titlePrefix: "Deploy Check",
    goal: "Check deployment readiness, build scripts, environment variables, routing, and likely Vercel issues.",
    criteria: [
      "Deployment blockers or likely Vercel issues are identified and fixed when in scope.",
      "Required environment variables and build commands are documented."
    ]
  }
};

export const CLAUDE_DISPATCH_COMMENT =
  "@claude implement the GitHub issue above by editing the repository code. Create a new branch, commit the changes, and open a pull request against the default branch. Do not merge. If you cannot create the branch, commit, or pull request, reply with the exact blocker.";

export const CLAUDE_TEST_DISPATCH_COMMENT =
  "@claude reply to confirm you can see this issue. Do not edit code and do not open a PR.";

export const CODEX_PR_REVIEW_COMMENT = "@codex review";

export function taskTypeLabel(taskType: TaskType) {
  return TASK_TYPE_OPTIONS.find((option) => option.value === taskType)?.label ?? taskType;
}

export function buildIssueTitle(taskType: TaskType, rawInput: string) {
  const firstLine = rawInput.split("\n").find((line) => line.trim().length > 0)?.trim() ?? "";
  const compact = firstLine.replace(/\.$/, "").slice(0, 72);
  return compact ? `${taskTypeDetails[taskType].titlePrefix}: ${compact}` : `${taskTypeDetails[taskType].titlePrefix} Task`;
}

export function generateIssueBody({ taskId, repoFullName, taskType, rawInput }: IssueInput) {
  const details = taskTypeDetails[taskType];
  const shortTask = rawInput.trim() || "No task description provided.";
  const criteria = [...details.criteria, "The app builds without TypeScript errors.", "The changed behavior can be manually tested."]
    .map((criterion) => `- ${criterion}`)
    .join("\n");

  return `## Task
${shortTask}

## Task Type
${taskTypeLabel(taskType)}

## Goal
${details.goal}

## Repo Context
Repository: ${repoFullName}

## TapTask Tracking
Task ID: ${taskId ?? "Not assigned"}
Expected output: Pull request referencing this issue.

## Scope
Make the smallest useful change that satisfies the task.

## Constraints
- Keep the change focused.
- Do not rewrite unrelated files.
- Do not add new packages unless clearly necessary.
- Do not merge the PR.
- Do not change environment variables unless the task specifically requires it.
- Preserve existing behavior outside the requested change.

## Acceptance Criteria
${criteria}

## Testing / Build Instructions
Run the existing checks if available:
- npm run build
- npm run lint
- npm test, if tests exist

## What Not To Change
- Do not auto-merge.
- Do not perform unrelated refactors.
- Do not change deployment settings unless asked.
- Do not change auth, database, or payment logic unless explicitly part of the task.

## Agent Instructions
Open a new branch, implement the smallest working change, and open a PR. Include a summary of files changed and testing performed.`;
}

export function generateAgentPrompt(input: IssueInput) {
  const issueTitle = buildIssueTitle(input.taskType, input.rawInput);
  const issueBody = generateIssueBody(input);

  return `Issue title:
${issueTitle}

Issue body:
${issueBody}

Agent target:
${input.agent === "claude" ? "Claude dispatch is automatic through the issue comment." : `${input.agent} should use this prompt manually for v1.`}`;
}

export function generateCursorTaskPrompt(input: IssueInput & { issueUrl?: string }) {
  return `Use Cursor Background Agents or Cursor web/mobile to work on this GitHub task.

Repository: ${input.repoFullName}
Issue: ${input.issueUrl ?? "Issue URL not available yet"}
Task type: ${taskTypeLabel(input.taskType)}

Request:
${input.rawInput.trim()}

Instructions:
- Create a new branch.
- Keep the change focused.
- Open a pull request.
- Do not merge.
- Include testing notes in the PR.`;
}

export function generateCursorSdkPrompt(input: IssueInput & {
  issueNumber: number;
  issueTitle: string;
  issueUrl: string;
  issueBody: string;
  defaultBranch: string;
}) {
  return `You are working on GitHub repo: ${input.repoFullName}

GitHub Issue:
#${input.issueNumber} ${input.issueTitle}
${input.issueUrl}

Task:
${input.issueBody}

Task Type:
${taskTypeLabel(input.taskType)}

Instructions:
- Clone/open the selected repo.
- Create a new branch for this task.
- Make the smallest working change.
- Do not merge.
- Do not push to main.
- Open a pull request against the default branch (${input.defaultBranch}).
- Reference the issue in the PR body using: Closes #${input.issueNumber}.
- Follow AGENTS.md or repo instructions if present.
- Do not rewrite unrelated files.
- Do not add packages unless necessary.
- Run npm run build if available.
- If blocked, comment with the exact blocker.
- Final result should be a PR I can pull and test later.
- Summarize files changed and testing performed in the PR.`;
}

export function generateCodexImplementationCommand(input: { issueNumber?: number; issueUrl?: string }) {
  const target = input.issueNumber ? `issue #${input.issueNumber}` : input.issueUrl ?? "the linked GitHub issue";
  return `@codex implement ${target}. Create a new branch and open a pull request. Do not merge.`;
}

export function generateClaudeConnectionTestIssue(repoFullName: string) {
  return {
    title: "TapTask Claude Connection Test",
    body: `## TapTask Claude Connection Test
This issue tests whether Claude Code GitHub Action can see TapTask-created issues in ${repoFullName}.

Expected behavior:
- Claude replies to the issue comment.
- Claude does not edit code.
- Claude does not open a PR.`
  };
}

// ─── Follow-up and recovery generators ──────────────────────────────────────

export type FollowUpAction =
  | "fix_build"
  | "make_smaller_diff"
  | "polish_ui"
  | "add_readme"
  | "explain_changes"
  | "create_followup"
  | "start_over";

export type FollowUpContext = {
  repoFullName: string;
  pullNumber: number;
  pullTitle: string;
  pullUrl: string;
  headBranch: string;
};

type FollowUpIssue = {
  title: string;
  body: string;
  taskType: TaskType;
};

const prRef = (ctx: FollowUpContext) =>
  `PR #${ctx.pullNumber}: ${ctx.pullTitle}\n${ctx.pullUrl}`;

export function generateFollowUpIssue(action: FollowUpAction, ctx: FollowUpContext): FollowUpIssue {
  switch (action) {
    case "fix_build":
      return {
        taskType: "fix_build",
        title: `Fix Build: Resolve errors introduced in PR #${ctx.pullNumber}`,
        body: `## Task
Fix any build, type-check, or lint errors introduced by the recent PR.

## Context
${prRef(ctx)}

## Goal
${taskTypeDetails.fix_build.goal}

## Scope
- Fix only errors introduced by the PR above.
- Do not add features or refactor unrelated code.
- Run the existing build checks and report results.

## Constraints
- Do not merge the PR.
- Do not rewrite unrelated files.
- Keep the fix minimal.

## Acceptance Criteria
- The build passes without errors.
- No new test failures.

## Agent Instructions
Open a new branch from the head of ${ctx.headBranch}, fix the errors, and open a PR.`
      };

    case "make_smaller_diff":
      return {
        taskType: "refactor",
        title: `Refactor: Reduce scope of PR #${ctx.pullNumber} — make smallest safe change`,
        body: `## Task
Redo the work from the PR below with a much smaller, more focused diff.

## Context
${prRef(ctx)}

## Goal
Implement only the essential change. Remove anything speculative, unrelated, or unnecessary.

## Instructions
- Start from the default branch (do NOT base off ${ctx.headBranch}).
- Identify the single most important change the PR was trying to make.
- Implement that change with the smallest possible diff.
- Preserve existing architecture, naming, and public interfaces.
- Remove any unrelated file changes, refactors, or added packages.
- Explain why each changed file is necessary.

## Constraints
- Do not reuse branch: ${ctx.headBranch}
- Do not merge the PR.
- Preserve existing behavior outside the targeted change.

## Acceptance Criteria
- The diff is smaller and more focused than the original PR.
- No unrelated files are touched.
- The app builds without errors.

## Agent Instructions
Open a new branch from main, implement the minimal change, and open a PR.`
      };

    case "polish_ui":
      return {
        taskType: "polish_ui",
        title: `Polish UI: Improve visual quality after PR #${ctx.pullNumber}`,
        body: `## Task
Polish the UI changes introduced in the recent PR.

## Context
${prRef(ctx)}

## Goal
${taskTypeDetails.polish_ui.goal}

## Scope
- Focus on the UI areas touched by the PR above.
- Improve spacing, typography, touch targets, and mobile layout.
- Do not change business logic or data flow.

## Acceptance Criteria
${taskTypeDetails.polish_ui.criteria.map((c) => `- ${c}`).join("\n")}

## Agent Instructions
Open a new branch, make targeted visual improvements, and open a PR.`
      };

    case "add_readme":
      return {
        taskType: "write_readme",
        title: `Write README: Document changes from PR #${ctx.pullNumber}`,
        body: `## Task
Create or update the README to document the changes made in the recent PR.

## Context
${prRef(ctx)}

## Goal
${taskTypeDetails.write_readme.goal}

## Scope
- Document any new features, scripts, environment variables, or setup steps introduced by the PR.
- Update existing sections if they are now out of date.
- Keep the README accurate and concise.

## Acceptance Criteria
${taskTypeDetails.write_readme.criteria.map((c) => `- ${c}`).join("\n")}

## Agent Instructions
Open a new branch, update the README, and open a PR.`
      };

    case "explain_changes":
      return {
        taskType: "review_pr",
        title: `Review PR: Explain changes in PR #${ctx.pullNumber}`,
        body: `## Task
Explain what was changed in the PR and why.

## Context
${prRef(ctx)}

## Goal
Provide a clear, file-by-file summary of what the PR changed, why each change was made, and any risks or follow-ups to be aware of.

## Output format
- List every changed file with a one-sentence explanation.
- Summarize the overall intent of the PR.
- Note any risks, side effects, or suggested follow-ups.

## Agent Instructions
Review the PR diff and post a detailed explanation as a comment on the PR.`
      };

    case "create_followup":
      return {
        taskType: "new_feature",
        title: `New Feature: Follow up on PR #${ctx.pullNumber} — ${ctx.pullTitle.slice(0, 50)}`,
        body: `## Task
Implement a follow-up improvement based on the recent PR.

## Context
${prRef(ctx)}

## Goal
Build on the work from the PR above with one small, focused follow-up improvement.

## Scope
- Implement one concrete next step.
- Do not rewrite what the previous PR already completed.
- Keep the change minimal and scoped.

## Constraints
- Do not merge the PR.
- Do not rewrite unrelated files.

## Acceptance Criteria
- The follow-up improvement is implemented and testable.
- The app builds without errors.

## Agent Instructions
Open a new branch from main, implement the follow-up, and open a PR.`
      };

    case "start_over":
      return {
        taskType: "new_feature",
        title: `New Feature: Start over from main — ${ctx.pullTitle.slice(0, 50)}`,
        body: `## Task
Restart this task from scratch using a fresh branch from main. The previous PR was rejected.

## Context
Rejected PR: ${prRef(ctx)}

## ⚠️ Warning
Previous PR was rejected. Start from the default branch.
Do not reuse the bad branch. Make a smaller, legacy-safe change.

## Instructions
- Do NOT start from branch: ${ctx.headBranch}
- Do NOT base off the rejected PR.
- Checkout main (or the default branch) and create a new branch.
- Re-read the existing codebase before making any changes.
- Implement the smallest possible working change.
- Preserve existing architecture, naming, and public interfaces.
- Explain why each changed file is necessary.

## Constraints
- Do not merge the PR.
- Do not rewrite unrelated code.
- Do not add packages unless clearly necessary.

## Acceptance Criteria
- A new PR is opened from a fresh branch (not ${ctx.headBranch}).
- The diff is minimal and focused.
- The app builds without errors.

## Agent Instructions
Open a new branch from main, implement the minimal change, and open a PR. Reference this issue.`
      };
  }
}

export const REDUCE_DIFF_COMMENT =
  "This PR is too broad. Please revise this PR to make the smallest possible change, preserve existing architecture, avoid unrelated files, and explain why each changed file is necessary.";

export const EXPLAIN_CHANGES_COMMENT =
  "@claude please explain what was changed in this PR and why, file by file. Summarize the overall intent and note any risks or follow-ups.";

export function generateClaudeSetupIssue(repoFullName: string) {
  return {
    title: "Set up Claude Code GitHub Action for TapTask dispatch",
    body: `## Goal
Install and configure Claude Code GitHub Action for this repository so TapTask @claude dispatch comments can trigger coding work.

## Repo
${repoFullName}

## Why this is needed
TapTask can create GitHub issues, but no AI agent will code until Claude Code GitHub Action is installed and configured. TapTask does not run Claude itself.

## Setup Checklist
- [ ] Add Claude Code GitHub Action workflow under .github/workflows/.
- [ ] Add the required Anthropic API key secret, usually ANTHROPIC_API_KEY.
- [ ] Give workflow permissions:
  - contents: write
  - pull-requests: write
  - issues: write
  - id-token: write
- [ ] Confirm the workflow listens to issue_comment or the correct Claude trigger event.
- [ ] Test by manually commenting @claude on an issue.
- [ ] Confirm Claude opens a PR.

## Acceptance Criteria
- A Claude workflow exists at one of the expected paths:
  - .github/workflows/claude.yml
  - .github/workflows/claude.yaml
  - .github/workflows/claude-code.yml
  - .github/workflows/claude-code.yaml
- A test issue comment with @claude starts the workflow.
- Claude opens PRs instead of merging directly.

## Notes
Do not create the workflow automatically from TapTask v1. This setup issue is only guidance for configuring the repository.`
  };
}
