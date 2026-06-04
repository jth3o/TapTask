export type CycleStage = "understand" | "build" | "evaluate" | "learn";
export type CycleType = "problem" | "solution" | "scale";
export type CycleDecision = "undecided" | "repeat" | "expand" | "pivot" | "kill" | "scale";

export interface ProjectCycle {
  id: string;
  projectId: string;
  cycleNumber: number;
  title: string;
  type: CycleType;
  stage: CycleStage;
  goal: string;
  logicSummary: string;
  evaluationSignal: string;
  evidenceNotes: string;
  decision: CycleDecision;
  doneWhen: string;
  createdAt: string;
  updatedAt: string;
}

export const CYCLE_STAGE_LABELS: Record<CycleStage, string> = {
  understand: "Understand",
  build: "Build",
  evaluate: "Evaluate",
  learn: "Learn",
};

export const CYCLE_TYPE_LABELS: Record<CycleType, string> = {
  problem: "Problem",
  solution: "Solution",
  scale: "Scale",
};

export const CYCLE_DECISION_LABELS: Record<CycleDecision, string> = {
  undecided: "Undecided",
  repeat: "Repeat",
  expand: "Expand",
  pivot: "Pivot",
  kill: "Kill",
  scale: "Scale",
};

export const STAGE_ORDER: CycleStage[] = ["understand", "build", "evaluate", "learn"];

export function nextStage(current: CycleStage): CycleStage | null {
  const idx = STAGE_ORDER.indexOf(current);
  if (idx === -1 || idx === STAGE_ORDER.length - 1) return null;
  return STAGE_ORDER[idx + 1];
}
