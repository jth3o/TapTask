import { Agent, ChangePlan, ChangeSize, ImplementationPhase, ProjectProfile, ProjectType, TaskType } from "./types";

interface PromptInput {
  taskType: TaskType;
  agent: Agent;
  profile: ProjectProfile;
  roughDetails: string;
}

interface PlanInput extends PromptInput {
  projectType: ProjectType;
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
    "Inspect deployment readiness including env vars, build scripts, routing, platform compatibility, and likely failure points."
};

interface ProjectTypeContext {
  label: string;
  verifySteps: string[];
  filePatterns: string[];
  riskNotes: string[];
  testApproach: string;
  phaseVerb: string;
}

const projectTypeContext: Record<ProjectType, ProjectTypeContext> = {
  web_app: {
    label: "Web App",
    verifySteps: [
      "npm run build — must pass with no errors",
      "npm run lint — no new warnings",
      "npm run type-check — clean",
      "Open in browser, walk through key user path",
      "Check mobile layout at 375px viewport",
      "Verify no console errors during smoke test",
    ],
    filePatterns: ["app/", "components/", "pages/", "src/", "styles/", "public/"],
    riskNotes: [
      "Verify mobile layout at 375px — no overflow or clipped elements",
      "Check network tab for failed requests",
      "Confirm no console errors on initial load",
    ],
    testApproach:
      "Run build + type-check. Load in browser, walk the key user path. Check mobile viewport at 375px. Confirm no console errors.",
    phaseVerb: "build and preview in browser",
  },
  desktop_app: {
    label: "Desktop App",
    verifySteps: [
      "npm run build or cargo build — must pass",
      "Launch app locally (npm start / electron . / cargo run)",
      "Walk through key window interactions",
      "Test on target OS — note any OS-specific edge cases",
      "Verify app packaging does not fail",
    ],
    filePatterns: ["src/main/", "src/renderer/", "electron.js", "src/", "Cargo.toml"],
    riskNotes: [
      "OS-specific path and file separator handling",
      "Window lifecycle events on close/minimize",
      "App packaging size and signing requirements",
    ],
    testApproach:
      "Build and launch locally. Walk through key interactions. Note OS-specific behavior. Verify packaging does not fail.",
    phaseVerb: "build and launch locally",
  },
  cli_tool: {
    label: "CLI Tool",
    verifySteps: [
      "npm link / pip install -e . / cargo install --path .",
      "Run sample command with expected args — check stdout",
      "Run --help and verify output is accurate",
      "Test with missing or invalid args — confirm graceful error",
      "Check exit code on success (0) and failure (non-zero)",
    ],
    filePatterns: ["src/", "bin/", "cli.ts", "index.ts", "commands/", "src/main.rs"],
    riskNotes: [
      "Exit codes must be correct — callers depend on them",
      "stdin/stdout/stderr routing — nothing unexpected on stderr in success path",
      "Behavior with missing/invalid args must be explicit and documented",
    ],
    testApproach:
      "Install locally. Run sample command. Verify expected output and exit code. Test missing-arg and invalid-arg paths.",
    phaseVerb: "install and run from terminal",
  },
  browser_extension: {
    label: "Browser Extension",
    verifySteps: [
      "npm run build — must pass",
      "Load unpacked extension in Chrome (chrome://extensions) or Firefox",
      "Navigate to a real target page and verify extension activates",
      "Check manifest.json permissions — no over-requesting",
      "Verify no console errors in extension background/popup/content contexts",
    ],
    filePatterns: ["manifest.json", "background.js", "content.js", "popup/", "src/"],
    riskNotes: [
      "Manifest v2 vs v3 compatibility — be explicit",
      "Permission scope creep — request only what is needed",
      "Content script injection timing — page load vs DOMContentLoaded",
    ],
    testApproach:
      "Build and load unpacked. Navigate to target page. Verify extension activates and behavior is correct. Check permissions in manifest.",
    phaseVerb: "load unpacked and test in browser",
  },
  automation_script: {
    label: "Automation Script",
    verifySteps: [
      "Run with --dry-run flag if available — verify no writes",
      "Run on test/sample input data",
      "Inspect logs for expected output and error paths",
      "Verify input/output files are correct after real run",
      "Confirm script is idempotent — safe to run twice",
    ],
    filePatterns: ["scripts/", "src/", "config/", "*.sh", "*.py", "*.ts"],
    riskNotes: [
      "Idempotency — can it run twice without corrupting state?",
      "Error handling on missing or malformed input files",
      "Log verbosity — failure paths must be visible in output",
    ],
    testApproach:
      "Run in dry-run mode first. Verify logs. Run on test data. Check output. Confirm idempotent behavior.",
    phaseVerb: "run against test data and inspect output",
  },
  api_service: {
    label: "API Service",
    verifySteps: [
      "npm run dev / cargo run / python -m uvicorn — starts clean",
      "Hit each affected endpoint with curl or Postman",
      "Verify request/response shape matches spec",
      "Check error response format is consistent",
      "Run integration/unit tests — all pass",
    ],
    filePatterns: ["routes/", "controllers/", "handlers/", "middleware/", "src/", "api/"],
    riskNotes: [
      "Error response format must be consistent — clients depend on shape",
      "Auth middleware — verify it is not inadvertently bypassed",
      "Request validation edge cases — empty body, extra fields, wrong types",
    ],
    testApproach:
      "Start service locally. Hit affected endpoints with curl/Postman. Verify response shape and status codes. Run test suite.",
    phaseVerb: "start service and test endpoints",
  },
  library_package: {
    label: "Library / Package",
    verifySteps: [
      "npm run build / tsc — clean output",
      "Run test suite — all pass",
      "npm pack (dry run) — inspect bundle contents",
      "Import in a test project and verify usage example works",
      "Confirm exports match documented API",
    ],
    filePatterns: ["src/", "index.ts", "lib/", "dist/", "types/"],
    riskNotes: [
      "Breaking change in public API — bump semver accordingly",
      "Tree-shaking compatibility — avoid barrel exports if bundle size matters",
      "Peer dependency conflicts — document required versions",
    ],
    testApproach:
      "Run tests. Build. Pack locally, import in a test project, verify usage example works end-to-end.",
    phaseVerb: "build, pack, and test via import",
  },
  game_or_visual_tool: {
    label: "Game / Visual Tool",
    verifySteps: [
      "npm start / python main.py / cargo run — launches clean",
      "Walk through main interaction loop",
      "Verify target frame rate is maintained (no drops)",
      "Check visual output matches intent on different screen sizes",
      "Test input handling edge cases (rapid input, held keys, etc.)",
    ],
    filePatterns: ["src/", "assets/", "scenes/", "entities/", "game.ts", "main.ts"],
    riskNotes: [
      "Performance at target frame rate — profile if uncertain",
      "Input handling edge cases — rapid or simultaneous inputs",
      "Visual regression across different screen sizes or resolutions",
    ],
    testApproach:
      "Launch and run through main interaction loop. Check for frame drops or visual artifacts. Test input edge cases.",
    phaseVerb: "launch and run through the main loop",
  },
  other: {
    label: "Other",
    verifySteps: [
      "Run build if applicable",
      "Execute main entry point",
      "Verify expected output matches intent",
      "Check error paths behave as expected",
    ],
    filePatterns: ["src/", "index.ts", "main.ts"],
    riskNotes: [
      "Verify assumptions about runtime environment",
      "Check for unhandled error states",
    ],
    testApproach: "Run manually and verify expected behavior matches intent.",
    phaseVerb: "run and verify output",
  },
};

function deriveChangeSize(taskType: TaskType, roughDetails: string): ChangeSize {
  const len = roughDetails.trim().length;
  if (taskType === "Review PR") return "review_fix";
  if (taskType === "Deploy Check") return "product_readiness";
  if (taskType === "Fix Build") return "tiny_fix";
  if (taskType === "New Project" || taskType === "Refactor") return "big_change";
  if (taskType === "New Feature" && len > 400) return "big_change";
  if (len < 80) return "tiny_fix";
  return "focused_change";
}

function buildNonGoals(taskType: TaskType): string[] {
  const base = [
    "Do not refactor unrelated code",
    "Do not add features outside the stated scope",
    "Do not change deployment configuration unless this task requires it",
  ];
  if (taskType === "Fix Bug") return ["Do not refactor around the fix", ...base];
  if (taskType === "Polish UI") return ["Do not change business logic", ...base];
  if (taskType === "Add Test") return ["Do not change implementation behavior", ...base];
  if (taskType === "Refactor") return ["Do not change observable behavior", "Do not add features", ...base];
  return base;
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
      verificationStep: `Run build toolchain. Verify clean output. ${ctx.phaseVerb}.`,
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
      verificationStep: `${ctx.phaseVerb.charAt(0).toUpperCase() + ctx.phaseVerb.slice(1)}. Walk main user path.`,
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
      verificationStep: `Run full test suite. ${ctx.phaseVerb.charAt(0).toUpperCase() + ctx.phaseVerb.slice(1)}. Verify error paths.`,
    },
  ];
}

function buildPhasesForBigFeature(ctx: ProjectTypeContext, agent: Agent): ImplementationPhase[] {
  return [
    {
      title: "Phase 1: Data & State",
      purpose: "Define types, data models, and state shape needed for the feature. No UI yet.",
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
      verificationStep: `${ctx.phaseVerb.charAt(0).toUpperCase() + ctx.phaseVerb.slice(1)}. Walk complete user path.`,
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
      verificationStep: `Run full test suite. ${ctx.phaseVerb.charAt(0).toUpperCase() + ctx.phaseVerb.slice(1)}. Walk all acceptance criteria.`,
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
        `${ctx.phaseVerb.charAt(0).toUpperCase() + ctx.phaseVerb.slice(1)} confirms no regression`,
      ],
      nonGoals: ["No new features", "No further refactors"],
      suggestedAgent: agent,
      verificationStep: `Run full test suite. ${ctx.phaseVerb.charAt(0).toUpperCase() + ctx.phaseVerb.slice(1)}. Verify no regressions.`,
    },
  ];
}

function splitIntoPhases(taskType: TaskType, projectType: ProjectType, agent: Agent): ImplementationPhase[] {
  const ctx = projectTypeContext[projectType];
  if (taskType === "New Project") return buildPhasesForNewProject(ctx, agent);
  if (taskType === "Refactor") return buildPhasesForRefactor(ctx, agent);
  return buildPhasesForBigFeature(ctx, agent);
}

export function buildTaskTitle(taskType: TaskType, roughDetails: string): string {
  const firstLine = roughDetails.split("\n").find((line) => line.trim().length > 0) ?? "";
  const compact = firstLine.replace(/\.$/, "").trim();
  return compact ? `${taskType}: ${compact.slice(0, 60)}` : `${taskType} Task`;
}

export function generateChangePlan({ taskType, projectType, agent, profile, roughDetails }: PlanInput): ChangePlan {
  const changeSize = deriveChangeSize(taskType, roughDetails);
  const ctx = projectTypeContext[projectType];
  const guidance = taskTypeGuidance[taskType];

  const firstLine = roughDetails.split("\n").find((l) => l.trim()) ?? roughDetails.trim();
  const goal = `${guidance} — ${firstLine.slice(0, 120).replace(/\.$/, "")}`;

  const userFacingBehavior =
    taskType === "Fix Bug"
      ? `The reported bug is resolved. User sees correct behavior. No regressions in adjacent flows.`
      : taskType === "Polish UI"
      ? `Visual quality improves. Layout is clean at all screen sizes. No logic changes.`
      : taskType === "Add Test"
      ? `Test suite covers the targeted logic. Existing behavior is unchanged.`
      : taskType === "Refactor"
      ? `Code structure improves. External behavior is identical. Tests still pass.`
      : taskType === "Review PR"
      ? `PR reviewer receives a structured assessment: correctness, risk, edge cases, and recommended action.`
      : taskType === "Write README"
      ? `README is accurate and complete. A new contributor can set up and run the project without asking questions.`
      : taskType === "Deploy Check"
      ? `Deployment blockers are identified. All critical items have a clear resolution or known owner.`
      : `The stated feature or fix is live and working. Users can exercise it without error. Adjacent flows are unaffected.`;

  const logicRequirements =
    taskType === "Fix Bug"
      ? ["Identify root cause before writing any code", "Minimal change that resolves the issue", "Verify fix does not break adjacent behavior"]
      : taskType === "Refactor"
      ? ["Map all call sites before touching code", "Preserve identical observable behavior", "Remove dead code after migration is complete"]
      : taskType === "Add Test"
      ? ["Cover primary success path", "Cover at least one failure/edge case", "Do not change implementation code"]
      : ["Implement only what is stated in the rough request", "Handle error states gracefully", "Follow existing patterns in the codebase"];

  const dataStateRequirements =
    taskType === "Fix Bug" || taskType === "Polish UI"
      ? ["No new state introduced unless strictly required", "Existing data contracts unchanged"]
      : taskType === "Refactor"
      ? ["State shape preserved — no migrations needed", "No changes to external data contracts"]
      : ["New state or data modeled before implementation begins", "Schema or type changes reviewed for breaking impact"];

  const acceptanceCriteria = [
    `Task resolves the stated intent: ${firstLine.slice(0, 80)}`,
    "No regressions in existing functionality",
    `${ctx.testApproach}`,
  ];

  const plan: ChangePlan = {
    changeSize,
    goal,
    userFacingBehavior,
    logicRequirements,
    dataStateRequirements,
    filesLikelyAffected: ctx.filePatterns,
    acceptanceCriteria,
    testVerificationPlan: ctx.verifySteps,
    nonGoals: buildNonGoals(taskType),
    riskNotes: ctx.riskNotes,
  };

  if (changeSize === "big_change") {
    plan.phases = splitIntoPhases(taskType, projectType, agent);
  }

  return plan;
}

export function generatePrompt({ taskType, agent, profile, roughDetails }: PromptInput): string {
  const title = buildTaskTitle(taskType, roughDetails);
  const ctx = projectTypeContext[profile.projectType];

  return `Task title:
${title}

Goal:
${taskTypeGuidance[taskType]}

Project context:
- Project: ${profile.projectName}
- Project type: ${ctx.label}
- Repo URL: ${profile.repoUrl?.trim() || "Not provided"}
- Tech stack: ${profile.techStack || "Not provided"}
- Project rules/notes: ${profile.rulesNotes || "Not provided"}
- Target agent: ${agent}

Scope:
- Task type: ${taskType}
- Use the rough request below as source-of-truth intent.
- Produce focused, minimal changes that match requested scope.

Project-type verification expectations (${ctx.label}):
${ctx.verifySteps.map((s) => `- ${s}`).join("\n")}

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

Risk notes for ${ctx.label}:
${ctx.riskNotes.map((r) => `- ${r}`).join("\n")}

Files likely involved, if applicable:
- Common locations: ${ctx.filePatterns.join(", ")}
- Identify the exact files you expect to touch before implementing.
- Call out any new files that must be added.

What not to change:
- Do not change unrelated features or architecture.
- Do not rewrite working areas unless required by this task.
- Do not alter deployment setup unless this task requires it.

Final response requirements for the agent:
- Summarize what changed and why.
- List files touched.
- Provide ${ctx.phaseVerb} verification steps run and results.
- Mention trade-offs, follow-ups, or risks.

Rough request details:
${roughDetails.trim() || "(No details provided)"}`;
}

export function generatePhasePrompt(
  phase: ImplementationPhase,
  profile: ProjectProfile,
  roughDetails: string
): string {
  const ctx = projectTypeContext[profile.projectType];

  return `Task title:
${phase.title}

Phase purpose:
${phase.purpose}

Project context:
- Project: ${profile.projectName}
- Project type: ${ctx.label}
- Repo URL: ${profile.repoUrl?.trim() || "Not provided"}
- Tech stack: ${profile.techStack || "Not provided"}
- Project rules/notes: ${profile.rulesNotes || "Not provided"}
- Suggested agent: ${phase.suggestedAgent}

Acceptance criteria for this phase:
${phase.acceptanceCriteria.map((c) => `- ${c}`).join("\n")}

Non-goals for this phase:
${phase.nonGoals.map((g) => `- ${g}`).join("\n")}

Verification step:
${phase.verificationStep}

What not to change:
- Do not implement work scoped to future phases.
- Do not change unrelated code.

Original request context:
${roughDetails.trim() || "(No details provided)"}`;
}
