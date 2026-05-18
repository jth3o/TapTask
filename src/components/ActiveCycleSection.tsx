"use client";

import { useState, useRef } from "react";
import { IdeaProject, Feature, Goal, TaskPrefill, GenerateAction, GenerateResponse } from "@/lib/ideaTypes";
import {
  ProjectCycle,
  CycleDecision,
  CycleType,
  CYCLE_STAGE_LABELS,
  CYCLE_TYPE_LABELS,
  CYCLE_DECISION_LABELS,
  nextStage,
} from "@/lib/projectCycleTypes";
import {
  getActiveProjectCycle,
  getCompletedProjectCycles,
  createInitialCycle,
  updateProjectCycle,
  createNextCycle,
} from "@/lib/projectCycleStorage";
import { FeaturesSection } from "./FeaturesSection";

interface Props {
  project: IdeaProject;
  features: Feature[];
  onFeaturesChange: (features: Feature[]) => void;
  goals: Goal[];
  onGoalsChange: (goals: Goal[]) => void;
  onSendToBuild: (prefill: TaskPrefill) => void;
  onCycleChange?: () => void;
}

const TEXTAREA_CLASS =
  "w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand resize-none";
const INPUT_CLASS =
  "w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand";
const SELECT_CLASS =
  "w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand bg-white";

function Field({ label, helper, children, onGenerate, generating }: {
  label: string;
  helper?: string;
  children: React.ReactNode;
  onGenerate?: () => void;
  generating?: boolean;
}) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <label className="block text-xs font-semibold text-slate-500">{label}</label>
        {onGenerate && (
          <button
            type="button"
            onClick={onGenerate}
            disabled={generating}
            className="shrink-0 rounded-lg border border-slate-200 bg-white px-2 py-0.5 text-[10px] font-semibold text-slate-500 hover:border-slate-300 hover:bg-slate-50 disabled:opacity-50"
          >
            {generating ? "…" : "✦ Generate"}
          </button>
        )}
      </div>
      {helper && <p className="text-xs text-slate-400">{helper}</p>}
      {children}
    </div>
  );
}

function PastCycles({ projectId }: { projectId: string }) {
  const [open, setOpen] = useState(false);
  const completed = getCompletedProjectCycles(projectId);
  if (completed.length === 0) return null;
  return (
    <div className="border-t border-slate-100 pt-3">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between text-left text-xs font-semibold text-slate-500"
      >
        Past cycles ({completed.length})
        <span className="text-slate-400">{open ? "▲" : "▼"}</span>
      </button>
      {open && (
        <div className="mt-2 space-y-2">
          {[...completed].reverse().map((c) => (
            <div key={c.id} className="rounded-lg border border-slate-100 bg-slate-50 p-3 space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-600">
                  #{c.cycleNumber} — {c.title}
                </span>
                <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-semibold text-slate-500">
                  {CYCLE_DECISION_LABELS[c.decision]}
                </span>
              </div>
              {c.goal && <p className="text-xs text-slate-500">{c.goal}</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function ActiveCycleSection({
  project,
  features,
  onFeaturesChange,
  goals,
  onGoalsChange,
  onSendToBuild,
  onCycleChange,
}: Props) {
  const [cycle, setCycle] = useState<ProjectCycle | null>(() => getActiveProjectCycle(project.id));
  const [creating, setCreating] = useState(false);
  const [generating, setGenerating] = useState<GenerateAction | null>(null);
  const [genError, setGenError] = useState("");
  const titleRef = useRef<HTMLInputElement>(null);
  const goalRef = useRef<HTMLTextAreaElement>(null);
  const logicRef = useRef<HTMLTextAreaElement>(null);
  const evalRef = useRef<HTMLInputElement>(null);

  const save = (patch: Partial<Omit<ProjectCycle, "id" | "projectId" | "createdAt">>) => {
    if (!cycle) return;
    const updated = updateProjectCycle(cycle.id, patch);
    if (updated) setCycle(updated);
  };

  const generate = async (action: GenerateAction, apply: (text: string) => void) => {
    if (!cycle) return;
    setGenerating(action);
    setGenError("");
    try {
      const cycleContext = {
        cycleNumber: cycle.cycleNumber,
        title: cycle.title,
        goal: cycle.goal,
        logicSummary: cycle.logicSummary,
        evaluationSignal: cycle.evaluationSignal,
      };
      const res = await fetch("/api/ideas/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, project, cycleContext }),
      });
      const data = (await res.json()) as GenerateResponse;
      if (data.error) { setGenError(data.error); return; }
      if (typeof data.result === "string" && data.result) {
        apply(data.result);
      }
    } catch {
      setGenError("Generation failed.");
    } finally {
      setGenerating(null);
    }
  };

  const handleCreate = () => {
    setCreating(true);
    const created = createInitialCycle(project.id, {
      title: "Cycle 1",
      goal: project.problem ? `Validate: ${project.problem}` : "",
    });
    setCycle(created);
    onCycleChange?.();
    setCreating(false);
  };

  const handleAdvanceStage = () => {
    if (!cycle) return;
    const next = nextStage(cycle.stage);
    if (!next) return;
    save({ stage: next });
  };

  const handleComplete = () => {
    if (!cycle || cycle.decision === "undecided") return;
    save({ stage: "learn" });
  };

  const handleCreateNext = () => {
    if (!cycle || cycle.stage !== "learn" || cycle.decision === "undecided" || cycle.decision === "kill") return;
    const next = createNextCycle(cycle);
    setCycle(next);
    onCycleChange?.();
  };

  const cycleGoals = cycle ? goals.filter((g) => g.cycleId === cycle.id) : [];
  const cycleFeatures = cycle
    ? features.filter((f) => {
        if (!f.goalId) return false;
        return cycleGoals.some((g) => g.id === f.goalId);
      })
    : [];

  const handleCycleGoalsChange = (updated: Goal[]) => {
    const otherGoals = goals.filter((g) => g.cycleId !== cycle?.id);
    onGoalsChange([...otherGoals, ...updated.filter((g) => g.cycleId === cycle?.id)]);
  };

  const handleCycleFeaturesChange = (updated: Feature[]) => {
    const cycleFeatureIds = new Set(cycleFeatures.map((f) => f.id));
    const otherFeatures = features.filter((f) => !cycleFeatureIds.has(f.id));
    onFeaturesChange([...otherFeatures, ...updated]);
  };

  if (!cycle) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
        <div>
          <h3 className="text-sm font-semibold text-slate-800">Active Cycle</h3>
          <p className="mt-1 text-xs text-slate-500">
            A cycle is a focused learning loop — one hypothesis, one build, one evaluation.
          </p>
        </div>
        <button
          type="button"
          onClick={handleCreate}
          disabled={creating}
          className="w-full rounded-xl bg-brand py-2 text-sm font-semibold text-white disabled:opacity-50"
        >
          {creating ? "Creating…" : "Start first cycle"}
        </button>
      </div>
    );
  }

  const isLearning = cycle.stage === "learn";
  const isDecided = cycle.decision !== "undecided";
  const canCreateNext = isLearning && isDecided && cycle.decision !== "kill";

  const cycleContext = {
    cycleNumber: cycle.cycleNumber,
    title: cycle.title,
    goal: cycle.goal,
    logicSummary: cycle.logicSummary,
    evaluationSignal: cycle.evaluationSignal,
  };

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-sm font-semibold text-slate-800">Cycle #{cycle.cycleNumber}</h3>
            <span className="rounded-full bg-blue-50 px-2 py-0.5 text-xs font-semibold text-blue-700">
              {CYCLE_STAGE_LABELS[cycle.stage]}
            </span>
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-500">
              {CYCLE_TYPE_LABELS[cycle.type]}
            </span>
          </div>
          <div className="mt-1 flex items-center gap-2">
            <input
              key={cycle.id + "-title"}
              ref={titleRef}
              type="text"
              defaultValue={cycle.title}
              onBlur={(e) => save({ title: e.target.value })}
              placeholder="Cycle title…"
              className="flex-1 text-sm text-slate-600 bg-transparent border-none outline-none placeholder-slate-300"
            />
            <button
              type="button"
              disabled={generating === "cycle_title"}
              onClick={() => generate("cycle_title", (text) => {
                save({ title: text });
                if (titleRef.current) titleRef.current.value = text;
              })}
              className="shrink-0 rounded-lg border border-slate-200 bg-white px-2 py-0.5 text-[10px] font-semibold text-slate-500 hover:border-slate-300 hover:bg-slate-50 disabled:opacity-50"
            >
              {generating === "cycle_title" ? "…" : "✦"}
            </button>
          </div>
        </div>
      </div>

      {/* Core fields */}
      <div key={cycle.id} className="space-y-3">
        <Field label="Cycle type">
          <select
            value={cycle.type}
            onChange={(e) => save({ type: e.target.value as CycleType })}
            className={SELECT_CLASS}
          >
            {(Object.keys(CYCLE_TYPE_LABELS) as CycleType[]).map((t) => (
              <option key={t} value={t}>{CYCLE_TYPE_LABELS[t]}</option>
            ))}
          </select>
        </Field>

        <Field
          label="Cycle goal"
          helper="What does success look like at the end of this cycle?"
          onGenerate={() => generate("cycle_goal", (text) => {
            save({ goal: text });
            if (goalRef.current) goalRef.current.value = text;
          })}
          generating={generating === "cycle_goal"}
        >
          <textarea
            ref={goalRef}
            rows={2}
            defaultValue={cycle.goal}
            onBlur={(e) => save({ goal: e.target.value })}
            placeholder="By the end of this cycle, we will know whether…"
            className={TEXTAREA_CLASS}
          />
        </Field>

        <Field
          label="What to build"
          helper="Logic and data first. Minimum needed to evaluate."
          onGenerate={() => generate("cycle_logic", (text) => {
            save({ logicSummary: text });
            if (logicRef.current) logicRef.current.value = text;
          })}
          generating={generating === "cycle_logic"}
        >
          <textarea
            ref={logicRef}
            rows={2}
            defaultValue={cycle.logicSummary}
            onBlur={(e) => save({ logicSummary: e.target.value })}
            placeholder="Build only: …"
            className={TEXTAREA_CLASS}
          />
        </Field>

        <Field
          label="Evaluation signal"
          helper="How will you know if the cycle goal is met?"
          onGenerate={() => generate("cycle_evaluation", (text) => {
            save({ evaluationSignal: text });
            if (evalRef.current) evalRef.current.value = text;
          })}
          generating={generating === "cycle_evaluation"}
        >
          <input
            ref={evalRef}
            type="text"
            defaultValue={cycle.evaluationSignal}
            onBlur={(e) => save({ evaluationSignal: e.target.value })}
            placeholder="e.g. 3 users complete the flow, conversion > 20%"
            className={INPUT_CLASS}
          />
        </Field>

        <Field label="Evidence notes">
          <textarea
            rows={2}
            defaultValue={cycle.evidenceNotes}
            onBlur={(e) => save({ evidenceNotes: e.target.value })}
            placeholder="What have you observed so far?"
            className={TEXTAREA_CLASS}
          />
        </Field>

        <Field label="Decision">
          <select
            value={cycle.decision}
            onChange={(e) => save({ decision: e.target.value as CycleDecision })}
            className={SELECT_CLASS}
          >
            {(Object.keys(CYCLE_DECISION_LABELS) as CycleDecision[]).map((d) => (
              <option key={d} value={d}>{CYCLE_DECISION_LABELS[d]}</option>
            ))}
          </select>
        </Field>
      </div>

      {genError && (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">{genError}</p>
      )}

      {/* Stage advance button */}
      {!isLearning && (
        <button
          type="button"
          onClick={handleAdvanceStage}
          className="w-full rounded-xl border border-slate-200 py-2 text-sm font-semibold text-slate-700 active:bg-slate-50"
        >
          Advance to {CYCLE_STAGE_LABELS[nextStage(cycle.stage) ?? cycle.stage]} →
        </button>
      )}

      {/* Complete / create-next buttons */}
      {isLearning && !isDecided && (
        <p className="text-center text-xs text-slate-400">Choose a decision above to complete this cycle.</p>
      )}
      {isLearning && isDecided && (
        <>
          {canCreateNext ? (
            <button
              type="button"
              onClick={handleCreateNext}
              className="w-full rounded-xl bg-brand py-2 text-sm font-semibold text-white active:opacity-90"
            >
              Start next cycle →
            </button>
          ) : (
            <p className="text-center text-xs text-slate-400">Cycle ended — no next cycle will be created.</p>
          )}
        </>
      )}

      {/* Task groups / features */}
      <div className="border-t border-slate-100 pt-4">
        <FeaturesSection
          project={project}
          features={cycleFeatures}
          onFeaturesChange={handleCycleFeaturesChange}
          goals={cycleGoals}
          onGoalsChange={handleCycleGoalsChange}
          onSendToBuild={onSendToBuild}
          cycleId={cycle.id}
          cycleContext={cycleContext}
        />
      </div>

      <PastCycles projectId={project.id} />
    </div>
  );
}
