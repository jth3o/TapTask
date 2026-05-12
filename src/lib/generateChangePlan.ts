import { Agent, ChangePlan, ChangeSize, ImplementationPhase, ProjectType, TaskType } from "./types";
import { taskTypeLabel } from "./generateIssue";

interface PlanInput {
  taskType: TaskType;
  projectType: ProjectType;
  agent: Agent;
  repoFullName: string;
  rawInput: string;
}

interface ProjectTypeContext {
  label: string;
  verifySteps: string[];
  filePatterns: string[];
  riskNotes: string[];
  testApproach: string;
  phaseVerb: string;
}

const projectTypeContext: Record<ProjectType, ProjectTypeContext> = {
  web_page: {
    label: "Web Page",
    verifySteps: [
      "npm run build — must pass with no errors",
      "npm run lint — no new warnings",
      "Open in browser, walk through the page top to bottom",
      "Check mobile layout at 375px viewport",
      "Verify no console errors during smoke test",
      "Confirm all links and CTAs work",
    ],
    filePatterns: ["app/", "components/", "src/", "styles/", "public/"],
    riskNotes: [
      "Check mobile layout at 375px — no overflow or clipped elements",
      "Confirm no console errors on load",
      "Verify all links and buttons work",
    ],
    testApproach: "Run build + lint. Open in browser, scroll through the page. Check mobile at 375px. Confirm no console errors.",
    phaseVerb: "build and preview in browser",
  },
};

function deriveChangeSize(taskType: TaskType, rawInput: string): ChangeSize {
  const len = rawInput.trim().length;
  if (taskType === "review_pr") return "review_fix";
  if (taskType === "deploy_check") return "product_readiness";
  if (taskType === "fix_build") return "tiny_fix";
  if (taskType === "new_feature" && len > 400) return "big_change";
  if (len < 80) return "tiny_fix";
  return "focused_change";
}

function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function buildPhasesForNewProject(ctx: ProjectTypeContext, agent: Agent): ImplementationPhase[] {
  return [
    {
      title: "Phase 1: Scaffold & Config",
      purpose: "Establish project structure, tooling, and core dependencies. Nothing functional yet.",
      acceptanceCriteria: [
        "Repo initializes with no errors",
        "Build toolchain runs (lint, type-check, build all pass)",
        "README has setup instructions",
      ],
      nonGoals: ["No business logic yet", "No UI screens yet"],
      suggestedAgent: agent,
      verificationStep: `Run build toolchain. Verify clean output. ${cap(ctx.phaseVerb)}.`,
    },
    {
      title: "Phase 2: Core Feature",
      purpose: "Implement the primary user-facing functionality with minimal scope.",
      acceptanceCriteria: [
        "Main user path works end-to-end",
        "No hardcoded placeholder data in production path",
        "Passes all existing tests",
      ],
      nonGoals: ["No polish or edge cases yet", "No secondary features"],
      suggestedAgent: agent,
      verificationStep: `${cap(ctx.phaseVerb)}. Walk main user path.`,
    },
    {
      title: "Phase 3: Polish & Verification",
      purpose: "Handle edge cases, improve UX/DX, write tests, and confirm production-readiness.",
      acceptanceCriteria: [
        "Test suite passes",
        "Error paths handled gracefully",
        "No obvious rough edges in main user path",
      ],
      nonGoals: ["Not a full QA pass", "No new features"],
      suggestedAgent: agent,
      verificationStep: `Run full test suite. ${cap(ctx.phaseVerb)}. Verify error paths.`,
    },
  ];
}

function buildPhasesForBigFeature(ctx: ProjectTypeContext, agent: Agent): ImplementationPhase[] {
  return [
    {
      title: "Phase 1: Data & State",
      purpose: "Define types, data models, and state shape needed for the feature. No runtime changes yet.",
      acceptanceCriteria: [
        "Types/interfaces defined and type-check passes",
        "State shape documented or modeled",
        "No runtime behavior changes yet",
      ],
      nonGoals: ["No UI implementation", "No API calls yet"],
      suggestedAgent: agent,
      verificationStep: "Type-check passes. No runtime changes — purely additive types.",
    },
    {
      title: "Phase 2: Core Logic",
      purpose: "Implement the business logic, transformations, and integration points.",
      acceptanceCriteria: [
        "Core logic passes unit tests",
        "Integration points (API, DB, file system) work correctly",
        "No UI wired up yet",
      ],
      nonGoals: ["No UI changes", "No polish"],
      suggestedAgent: agent,
      verificationStep: "Run relevant tests. Verify logic in isolation before wiring UI.",
    },
    {
      title: "Phase 3: Interface Layer",
      purpose: "Wire the logic into the UI, CLI surface, or API endpoint.",
      acceptanceCriteria: [
        "User-facing surface works end-to-end",
        "Matches stated user-facing behavior",
        "No regressions in adjacent features",
      ],
      nonGoals: ["No new features beyond stated scope", "No visual polish beyond functional"],
      suggestedAgent: agent,
      verificationStep: `${cap(ctx.phaseVerb)}. Walk complete user path.`,
    },
    {
      title: "Phase 4: Verification & Cleanup",
      purpose: "Write/update tests, clean up temporary code, confirm acceptance criteria.",
      acceptanceCriteria: [
        "Test suite passes",
        "No leftover debug code or TODOs",
        "All acceptance criteria from the original plan are met",
      ],
      nonGoals: ["No new features", "No large refactors"],
      suggestedAgent: agent,
      verificationStep: `Run full test suite. ${cap(ctx.phaseVerb)}. Walk all acceptance criteria.`,
    },
  ];
}

function buildPhasesForRefactor(ctx: ProjectTypeContext, agent: Agent): ImplementationPhase[] {
  return [
    {
      title: "Phase 1: Map Dependencies",
      purpose: "Identify all call sites, dependencies, and edge cases before touching code.",
      acceptanceCriteria: [
        "Complete list of files/functions that will change",
        "Test coverage assessed for affected areas",
        "Migration plan documented in PR description or comments",
      ],
      nonGoals: ["No code changes yet"],
      suggestedAgent: agent,
      verificationStep: "Review the dependency map. Confirm no hidden callers missed.",
    },
    {
      title: "Phase 2: Refactor Core",
      purpose: "Apply the structural changes to core modules. Behavior must remain identical.",
      acceptanceCriteria: [
        "Core modules refactored",
        "All existing tests still pass",
        "No observable behavior change",
      ],
      nonGoals: ["Do not change behavior", "Do not add features"],
      suggestedAgent: agent,
      verificationStep: "Run full test suite. Diff must show structure changes only.",
    },
    {
      title: "Phase 3: Update Call Sites & Verify",
      purpose: "Update all call sites, clean up old code, and confirm nothing regressed.",
      acceptanceCriteria: [
        "All call sites updated",
        "Old code removed",
        "Full test suite passes",
        `${cap(ctx.phaseVerb)} confirms no regression`,
      ],
      nonGoals: ["No new features", "No further refactors"],
      suggestedAgent: agent,
      verificationStep: `Run full test suite. ${cap(ctx.phaseVerb)}. Verify no regressions.`,
    },
  ];
}

function splitIntoPhases(taskType: TaskType, projectType: ProjectType, agent: Agent): ImplementationPhase[] {
  const ctx = projectTypeContext[projectType];
  if (taskType === "new_feature" && taskType === "new_feature") return buildPhasesForBigFeature(ctx, agent);
  if (taskType === "refactor") return buildPhasesForRefactor(ctx, agent);
  return buildPhasesForBigFeature(ctx, agent);
}

export function generateChangePlan({ taskType, projectType, agent, repoFullName, rawInput }: PlanInput): ChangePlan {
  const changeSize = deriveChangeSize(taskType, rawInput);
  const ctx = projectTypeContext[projectType];

  const firstLine = rawInput.split("\n").find((l) => l.trim()) ?? rawInput.trim();
  const goal = `${taskTypeLabel(taskType)} — ${firstLine.slice(0, 120).replace(/\.$/, "")}`;

  const userFacingBehavior =
    taskType === "fix_bug"
      ? "The reported bug is resolved. User sees correct behavior. No regressions in adjacent flows."
      : taskType === "polish_ui"
      ? "Visual quality improves. Layout is clean at all screen sizes. No logic changes."
      : taskType === "add_test"
      ? "Test suite covers the targeted logic. Existing behavior is unchanged."
      : taskType === "refactor"
      ? "Code structure improves. External behavior is identical. Tests still pass."
      : taskType === "review_pr"
      ? "PR reviewer receives a structured assessment: correctness, risk, edge cases, and recommended action."
      : taskType === "write_readme"
      ? "README is accurate and complete. A new contributor can set up and run the project without asking questions."
      : taskType === "deploy_check"
      ? "Deployment blockers are identified. All critical items have a clear resolution or known owner."
      : "The stated feature or fix is live and working. Users can exercise it without error. Adjacent flows are unaffected.";

  const logicRequirements =
    taskType === "fix_bug"
      ? ["Identify root cause before writing any code", "Minimal change that resolves the issue", "Verify fix does not break adjacent behavior"]
      : taskType === "refactor"
      ? ["Map all call sites before touching code", "Preserve identical observable behavior", "Remove dead code after migration is complete"]
      : taskType === "add_test"
      ? ["Cover primary success path", "Cover at least one failure/edge case", "Do not change implementation code"]
      : ["Implement only what is stated in the raw request", "Handle error states gracefully", "Follow existing patterns in the codebase"];

  const dataStateRequirements =
    taskType === "fix_bug" || taskType === "polish_ui"
      ? ["No new state introduced unless strictly required", "Existing data contracts unchanged"]
      : taskType === "refactor"
      ? ["State shape preserved — no migrations needed", "No changes to external data contracts"]
      : ["New state or data modeled before implementation begins", "Schema or type changes reviewed for breaking impact"];

  const nonGoals = [
    "Do not refactor unrelated code",
    "Do not add features outside the stated scope",
    "Do not change deployment configuration unless this task requires it",
    ...(taskType === "fix_bug" ? ["Do not refactor around the fix"] : []),
    ...(taskType === "polish_ui" ? ["Do not change business logic"] : []),
    ...(taskType === "add_test" ? ["Do not change implementation behavior"] : []),
    ...(taskType === "refactor" ? ["Do not change observable behavior"] : []),
  ];

  const plan: ChangePlan = {
    changeSize,
    goal,
    userFacingBehavior,
    logicRequirements,
    dataStateRequirements,
    filesLikelyAffected: ctx.filePatterns,
    acceptanceCriteria: [
      `Task resolves the stated intent: ${firstLine.slice(0, 80)}`,
      "No regressions in existing functionality",
      ctx.testApproach,
    ],
    testVerificationPlan: ctx.verifySteps,
    nonGoals,
    riskNotes: ctx.riskNotes,
  };

  if (changeSize === "big_change") {
    plan.phases = splitIntoPhases(taskType, projectType, agent);
  }

  return plan;
}

export { projectTypeContext };
export type { ProjectTypeContext };
