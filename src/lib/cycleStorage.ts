import { IdeaProject } from "./ideaTypes";
import {
  ScopeCycle,
  ScopeCycleStatus,
  CycleDecision,
  EvaluationMethod,
  FeatureIdea,
  FeatureIdeaSource,
  FeatureTriageDecision,
  ScopeImpact,
  EvaluationImpact,
} from "./cycleTypes";

const CYCLES_KEY = "taptask-scope-cycles-v1";
const FEATURE_IDEAS_KEY = "taptask-feature-ideas-v1";

function isClient() {
  return typeof window !== "undefined";
}

function nowIso() {
  return new Date().toISOString();
}

function uuid() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

// ─── Scope cycle storage ──────────────────────────────────────────────────────

export function loadScopeCycles(): ScopeCycle[] {
  if (!isClient()) return [];
  const raw = window.localStorage.getItem(CYCLES_KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw) as ScopeCycle[];
  } catch {
    return [];
  }
}

export function saveScopeCycles(cycles: ScopeCycle[]): void {
  if (!isClient()) return;
  window.localStorage.setItem(CYCLES_KEY, JSON.stringify(cycles));
}

export function getCyclesForProject(projectId: string): ScopeCycle[] {
  return loadScopeCycles().filter((c) => c.projectId === projectId);
}

export function getActiveCycle(projectId: string): ScopeCycle | null {
  const cycles = getCyclesForProject(projectId);
  return cycles.find((c) => c.status !== "complete") ?? null;
}

export function createInitialScopeCycle(project: IdeaProject): ScopeCycle {
  const now = nowIso();
  const cycle: ScopeCycle = {
    id: uuid(),
    projectId: project.id,
    cycleNumber: 1,
    status: "understand" as ScopeCycleStatus,

    hypothesis: project.targetUser && project.problem && project.mvpDefinition
      ? `If ${project.targetUser} can ${project.mvpDefinition}, they will solve ${project.problem}.`
      : "",
    targetUser: project.targetUser ?? "",
    problem: project.problem ?? "",
    valuePromise: project.mvpDefinition ?? "",
    riskiestAssumption: "",

    smallestUsefulLoop: project.mvpDefinition ?? "",
    currentScope: project.mvpDefinition ?? "",
    handles: [],
    excludes: [],
    edgeCaseParkingLot: [],

    buildArtifact: "",
    buildTaskIds: [],

    evaluationMethod: "" as EvaluationMethod | "",
    successCriteria: [],
    evidenceNotes: [],

    learningSummary: "",
    decision: "undecided" as CycleDecision,
    nextScope: "",

    createdAt: now,
    updatedAt: now,
  };

  const existing = loadScopeCycles();
  saveScopeCycles([...existing, cycle]);
  return cycle;
}

export function updateScopeCycle(
  cycleId: string,
  patch: Partial<Omit<ScopeCycle, "id" | "projectId" | "createdAt">>
): ScopeCycle | null {
  const all = loadScopeCycles();
  const idx = all.findIndex((c) => c.id === cycleId);
  if (idx === -1) return null;
  const updated = { ...all[idx], ...patch, updatedAt: nowIso() };
  all[idx] = updated;
  saveScopeCycles(all);
  return updated;
}

export function completeCycleAndCreateNext(projectId: string): ScopeCycle | null {
  const active = getActiveCycle(projectId);
  if (!active) return null;
  if (!active.learningSummary.trim()) return null;
  if (active.decision === "undecided") return null;
  if (active.decision === "kill") {
    updateScopeCycle(active.id, { status: "complete" });
    return null;
  }

  updateScopeCycle(active.id, { status: "complete" });

  const now = nowIso();
  const next: ScopeCycle = {
    id: uuid(),
    projectId,
    cycleNumber: active.cycleNumber + 1,
    status: "understand" as ScopeCycleStatus,

    hypothesis: active.nextScope
      ? `Building on cycle ${active.cycleNumber}: ${active.nextScope}`
      : active.hypothesis,
    targetUser: active.targetUser,
    problem: active.problem,
    valuePromise: active.valuePromise,
    riskiestAssumption: "",

    smallestUsefulLoop: active.nextScope || "",
    currentScope: active.nextScope || "",
    handles: [],
    excludes: [],
    edgeCaseParkingLot: [],

    buildArtifact: "",
    buildTaskIds: [],

    evaluationMethod: active.evaluationMethod,
    successCriteria: [],
    evidenceNotes: [],

    learningSummary: "",
    decision: "undecided" as CycleDecision,
    nextScope: "",

    createdAt: now,
    updatedAt: now,
  };

  const all = loadScopeCycles();
  saveScopeCycles([...all, next]);
  return next;
}

// ─── Feature idea storage ─────────────────────────────────────────────────────

export function loadFeatureIdeas(): FeatureIdea[] {
  if (!isClient()) return [];
  const raw = window.localStorage.getItem(FEATURE_IDEAS_KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw) as FeatureIdea[];
  } catch {
    return [];
  }
}

export function saveFeatureIdeas(ideas: FeatureIdea[]): void {
  if (!isClient()) return;
  window.localStorage.setItem(FEATURE_IDEAS_KEY, JSON.stringify(ideas));
}

export function getFeatureIdeasForProject(projectId: string): FeatureIdea[] {
  return loadFeatureIdeas().filter((i) => i.projectId === projectId);
}

export function getFeatureIdeasForCycle(cycleId: string): FeatureIdea[] {
  return loadFeatureIdeas().filter((i) => i.cycleId === cycleId);
}

export function createFeatureIdea(
  projectId: string,
  partial: {
    title: string;
    description: string;
    source: FeatureIdeaSource;
    decision: FeatureTriageDecision;
    reason: string;
    requiredForSmallestLoop: boolean;
    basedOnEvidence: boolean;
    scopeImpact: ScopeImpact;
    evaluationImpact: EvaluationImpact;
    cycleId?: string;
    notThisCycleReason?: string;
    supportsHypothesis?: string;
  }
): FeatureIdea {
  const now = nowIso();
  const idea: FeatureIdea = {
    id: uuid(),
    projectId,
    ...partial,
    createdAt: now,
    updatedAt: now,
  };
  const existing = loadFeatureIdeas();
  saveFeatureIdeas([...existing, idea]);
  return idea;
}

export function updateFeatureIdea(
  ideaId: string,
  patch: Partial<Omit<FeatureIdea, "id" | "projectId" | "createdAt">>
): FeatureIdea | null {
  const all = loadFeatureIdeas();
  const idx = all.findIndex((i) => i.id === ideaId);
  if (idx === -1) return null;
  const updated = { ...all[idx], ...patch, updatedAt: nowIso() };
  all[idx] = updated;
  saveFeatureIdeas(all);
  return updated;
}
