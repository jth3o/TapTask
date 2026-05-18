import { ProjectCycle, CycleDecision, CycleStage, CycleType } from "./projectCycleTypes";

const CYCLES_KEY = "taptask-project-cycles-v1";

function isClient() {
  return typeof window !== "undefined";
}

function nowIso() {
  return new Date().toISOString();
}

export function loadProjectCycles(): ProjectCycle[] {
  if (!isClient()) return [];
  const raw = window.localStorage.getItem(CYCLES_KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw) as ProjectCycle[];
  } catch {
    return [];
  }
}

export function saveProjectCycles(cycles: ProjectCycle[]): void {
  if (!isClient()) return;
  window.localStorage.setItem(CYCLES_KEY, JSON.stringify(cycles));
}

export function getCyclesForProject(projectId: string): ProjectCycle[] {
  return loadProjectCycles().filter((c) => c.projectId === projectId);
}

export function getActiveProjectCycle(projectId: string): ProjectCycle | null {
  return getCyclesForProject(projectId).find((c) => c.stage !== "learn" || c.decision === "undecided") ?? null;
}

export function getCompletedProjectCycles(projectId: string): ProjectCycle[] {
  return getCyclesForProject(projectId).filter(
    (c) => c.stage === "learn" && c.decision !== "undecided"
  );
}

export function createInitialCycle(
  projectId: string,
  overrides: Partial<Pick<ProjectCycle, "title" | "goal" | "type">> = {}
): ProjectCycle {
  const now = nowIso();
  const cycle: ProjectCycle = {
    id: crypto.randomUUID(),
    projectId,
    cycleNumber: 1,
    title: overrides.title ?? "Cycle 1",
    type: overrides.type ?? "problem",
    stage: "understand",
    goal: overrides.goal ?? "",
    logicSummary: "",
    evaluationSignal: "",
    evidenceNotes: "",
    decision: "undecided",
    createdAt: now,
    updatedAt: now,
  };
  const existing = loadProjectCycles();
  saveProjectCycles([...existing, cycle]);
  return cycle;
}

export function updateProjectCycle(
  cycleId: string,
  patch: Partial<Omit<ProjectCycle, "id" | "projectId" | "createdAt">>
): ProjectCycle | null {
  const all = loadProjectCycles();
  const idx = all.findIndex((c) => c.id === cycleId);
  if (idx === -1) return null;
  const updated = { ...all[idx], ...patch, updatedAt: nowIso() };
  all[idx] = updated;
  saveProjectCycles(all);
  return updated;
}

export function completeCycle(
  cycleId: string,
  decision: Exclude<CycleDecision, "undecided">
): ProjectCycle | null {
  return updateProjectCycle(cycleId, { stage: "learn", decision });
}

export function createNextCycle(completed: ProjectCycle): ProjectCycle {
  const now = nowIso();
  const next: ProjectCycle = {
    id: crypto.randomUUID(),
    projectId: completed.projectId,
    cycleNumber: completed.cycleNumber + 1,
    title: `Cycle ${completed.cycleNumber + 1}`,
    type: completed.type,
    stage: "understand",
    goal: "",
    logicSummary: "",
    evaluationSignal: "",
    evidenceNotes: "",
    decision: "undecided",
    createdAt: now,
    updatedAt: now,
  };
  const all = loadProjectCycles();
  saveProjectCycles([...all, next]);
  return next;
}
