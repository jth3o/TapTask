import { Agent, ProjectProfile, TaskMode, TaskType } from "./types";

interface PromptInput {
  taskType: TaskType;
  taskMode: TaskMode;
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
    "Identify the root cause first. Apply the minimal safe fix. Avoid touching unrelated code. Explain how to verify the fix.",
  "Polish UI":
    "Improve visual quality: spacing, touch targets, responsive layout, and mobile-first UX. No logic or data-flow changes.",
  Refactor:
    "Improve structure and maintainability within strict boundaries. Preserve all current behavior and public interfaces.",
  "Add Test":
    "Add tests around existing logic and components without changing behavior. Prioritize coverage of critical paths.",
  "Fix Build":
    "Resolve build, type-check, and lint failures only. Do not introduce features, refactors, or unrelated changes.",
  "Review PR":
    "Review for correctness, edge cases, complexity, security, performance, mobile UX, and unnecessary scope.",
  "Write README":
    "Write or improve the README: setup, available scripts, usage, env vars, and deployment notes.",
  "Deploy Check":
    "Check deployment readiness: env vars, build scripts, routing, platform compatibility, and likely failure points.",
};

const taskModeConstraints: Record<TaskMode, string[]> = {
  "Safe Patch": [
    "Fix only the named bug or error — nothing else.",
    "No new features, no refactors, no architecture changes.",
    "If the fix requires broader changes, stop and explain why.",
  ],
  "Legacy Context": [
    "Small implementation work is allowed.",
    "Preserve all existing architecture, naming conventions, and public interfaces.",
    "Use only scripts that already exist in package.json.",
    "Prefer targeted edits over rewrites.",
  ],
  "Normal Feature": [
    "Implement one focused feature as described.",
    "Avoid touching unrelated code, rewrites, or architecture shifts.",
    "Stay within the stated scope.",
  ],
  "Experimental Branch": [
    "Broader changes are allowed on this branch.",
    "Label all experimental changes clearly in comments and the response.",
    "Do not auto-merge. This branch must be reviewed before it touches main.",
  ],
};

function buildPreflightBlock(): string {
  return `━━━ PREFLIGHT — DO THIS BEFORE EDITING ━━━━━━━━━━━━━━━━━━━━━━━━━

1. Inspect the repository file structure.
2. Open package.json and list every available script.
3. Read the relevant files before modifying them.
4. Identify existing types, components, utilities, routes, and naming patterns.
5. State the smallest set of files you expect to change.
6. Do not assume a framework — confirm from the repo structure.
7. Do not assume npm run build or npm run dev exist. Use only available scripts.
8. If the task cannot be completed safely, stop and explain the blocker.`;
}

function buildLegacyContextBlock(): string {
  return `━━━ LEGACY CONTEXT — REPO IS SOURCE OF TRUTH ━━━━━━━━━━━━━━━━━━━

Before making changes:
- Use only types that already exist — read them before importing.
- Use only components that already exist — read them before creating new ones.
- Use only utilities that already exist — read them before adding helpers.
- Follow the repo's current architecture and naming style exactly.
- Preserve all existing public interfaces.
- Prefer small patches over rewrites.

Do not:
- Rewrite or restructure the app.
- Rename exported types, components, or functions unless the task requires it.
- Invent new project structure or add new directories without cause.
- Add npm scripts to satisfy checks — use only what exists.
- Add packages unless clearly necessary and explained.
- Delete legacy code unless the task explicitly asks for it and you explain why.

If something is missing:
- Search for an existing equivalent first.
- If none exists, add the smallest compatible addition.
- Explain what you added and why no existing equivalent was usable.`;
}

export function buildTaskTitle(taskType: TaskType, roughDetails: string): string {
  const firstLine = roughDetails.split("\n").find((line) => line.trim().length > 0) ?? "";
  const compact = firstLine.replace(/\.$/, "").trim();
  return compact ? `${taskType}: ${compact.slice(0, 60)}` : `${taskType} Task`;
}

export function generatePrompt({ taskType, taskMode, agent, profile, roughDetails }: PromptInput): string {
  const title = buildTaskTitle(taskType, roughDetails);
  const includeLegacyBlocks = taskMode === "Safe Patch" || taskMode === "Legacy Context";
  const constraints = taskModeConstraints[taskMode].map((c) => `- ${c}`).join("\n");

  const projectLines = [
    `Project : ${profile.projectName}`,
    `Repo    : ${profile.repoUrl?.trim() || "Not provided"}`,
    `Stack   : ${profile.techStack || "Not provided"}`,
    `Notes   : ${profile.rulesNotes || "Not provided"}`,
    `Agent   : ${agent}`,
  ].join("\n");

  const sections: string[] = [];

  sections.push(`${title}
Mode: ${taskMode}  ·  Type: ${taskType}  ·  Agent: ${agent}`);

  sections.push(`━━━ YOUR REQUEST ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

${roughDetails.trim() || "(No details provided)"}`);

  sections.push(`━━━ PROJECT ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

${projectLines}`);

  sections.push(`━━━ GOAL ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

${taskTypeGuidance[taskType]}`);

  if (includeLegacyBlocks) {
    sections.push(buildPreflightBlock());
    sections.push(buildLegacyContextBlock());
  }

  sections.push(`━━━ MODE CONSTRAINTS (${taskMode}) ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

${constraints}`);

  sections.push(`━━━ ACCEPTANCE CRITERIA ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

- Directly solves the stated request.
- Changes are scoped to this task type — no wider.
- No unrelated files, features, or architecture touched.
- Code is clear and production-ready.`);

  sections.push(`━━━ VERIFICATION ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

- Run \`npm run\` (no arguments) to see available scripts.
- Run the relevant checks: lint, type-check, test, build — whichever exist.
- If a script does not exist, say so. Do not add it.
- Report exact commands run and their output.`);

  sections.push(`━━━ RESPONSE FORMAT ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. What changed and why.
2. All files touched (list).
3. Verification commands run and their results.
4. Trade-offs, risks, or suggested follow-ups.`);

  return sections.join("\n\n");
}
