import { Agent, ProjectProfile, TaskType } from "./types";

interface PromptInput {
  taskType: TaskType;
  agent: Agent;
  profile: ProjectProfile;
  roughDetails: string;
}

const taskTypeGuidance: Record<TaskType, string> = {
  "New Project":
    "Scaffold a small project with clear MVP boundaries, stack-aligned setup, and a practical definition of done.",
  "New Feature":
    "Implement one focused feature with explicit acceptance criteria and clear validation steps.",
  "Fix Bug":
    "Identify root cause first, apply the minimal safe fix, avoid unrelated edits, and explain how to verify.",
  "Polish UI":
    "Improve visual quality with mobile-first UX, spacing, touch targets, and responsive layout without logic changes.",
  Refactor:
    "Refactor for structure and maintainability with strict boundaries while preserving current behavior.",
  "Add Test":
    "Add tests around existing logic/components without changing behavior, prioritizing confidence and coverage.",
  "Fix Build":
    "Resolve build, type, and lint failures only; do not introduce features or broad refactors.",
  "Review PR":
    "Perform strict review for correctness, edge cases, complexity, security, performance, mobile UX, and unnecessary changes.",
  "Write README":
    "Create or improve README covering setup, scripts, usage, env vars, and deployment notes.",
  "Deploy Check":
    "Inspect deployment readiness including env vars, build scripts, routing, Vercel compatibility, and likely failure points."
};

export function buildTaskTitle(taskType: TaskType, roughDetails: string): string {
  const firstLine = roughDetails.split("\n").find((line) => line.trim().length > 0) ?? "";
  const compact = firstLine.replace(/\.$/, "").trim();
  return compact ? `${taskType}: ${compact.slice(0, 60)}` : `${taskType} Task`;
}

export function generatePrompt({ taskType, agent, profile, roughDetails }: PromptInput): string {
  const title = buildTaskTitle(taskType, roughDetails);

  return `Task title:
${title}

Goal:
${taskTypeGuidance[taskType]}

Project context:
- Project: ${profile.projectName}
- Repo URL: ${profile.repoUrl?.trim() || "Not provided"}
- Tech stack: ${profile.techStack || "Not provided"}
- Project rules/notes: ${profile.rulesNotes || "Not provided"}
- Target agent: ${agent}

Scope:
- Task type: ${taskType}
- Use the rough request below as source-of-truth intent.
- Produce focused, minimal changes that match requested scope.

Constraints:
- Do not add auth.
- Do not add a database.
- Do not add external APIs unless explicitly requested.
- Avoid unrelated refactors or drive-by edits.
- Keep solution mobile-friendly when UI is involved.

Acceptance criteria:
- The result directly solves the user intent in the rough request.
- Changes remain scoped to this task type.
- Code is clear and production-ready for v1 expectations.

Testing/build instructions:
- Run relevant tests for touched code.
- Run lint/type-check/build steps for confidence.
- Share exact verification steps and outcomes.

Files likely involved, if applicable:
- Identify the files you expect to touch before implementing.
- Call out any new files that must be added.

What not to change:
- Do not change unrelated features or architecture.
- Do not rewrite working areas unless required by this task.
- Do not alter deployment setup unless this task requires it.

Final response requirements for the agent:
- Summarize what changed and why.
- List files touched.
- Provide test/build commands run and results.
- Mention trade-offs, follow-ups, or risks.

Rough request details:
${roughDetails.trim() || "(No details provided)"}`;
}
