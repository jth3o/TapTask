"use client";

import { useState, useCallback } from "react";
import { IdeaProject } from "@/lib/ideaTypes";
import {
  ScopeCycle,
  EvaluationMethod,
  CycleDecision,
  EVALUATION_METHOD_LABELS,
  CYCLE_DECISION_LABELS,
  CYCLE_STATUS_LABELS,
} from "@/lib/cycleTypes";
import {
  getActiveCycle,
  createInitialScopeCycle,
  updateScopeCycle,
  completeCycleAndCreateNext,
} from "@/lib/cycleStorage";

interface Props {
  project: IdeaProject;
  onCycleChange?: () => void;
}

function ChipList({
  items,
  onAdd,
  onRemove,
  placeholder,
  chipClass = "bg-slate-100 text-slate-700",
}: {
  items: string[];
  onAdd: (val: string) => void;
  onRemove: (idx: number) => void;
  placeholder: string;
  chipClass?: string;
}) {
  const [draft, setDraft] = useState("");
  const submit = () => {
    const trimmed = draft.trim();
    if (trimmed) {
      onAdd(trimmed);
      setDraft("");
    }
  };
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5">
        {items.map((item, i) => (
          <span
            key={i}
            className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${chipClass}`}
          >
            {item}
            <button
              type="button"
              onClick={() => onRemove(i)}
              className="ml-0.5 text-current opacity-50 hover:opacity-100"
              aria-label="Remove"
            >
              ×
            </button>
          </span>
        ))}
      </div>
      <div className="flex gap-2">
        <input
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), submit())}
          placeholder={placeholder}
          className="flex-1 rounded-lg border border-slate-200 px-3 py-1.5 text-sm outline-none focus:border-brand"
        />
        <button
          type="button"
          onClick={submit}
          className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 active:bg-slate-50"
        >
          Add
        </button>
      </div>
    </div>
  );
}

function Section({
  title,
  children,
  defaultOpen = false,
}: {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border-t border-slate-100 pt-3">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between text-left text-sm font-semibold text-slate-700"
      >
        {title}
        <span className="text-slate-400">{open ? "▲" : "▼"}</span>
      </button>
      {open && <div className="mt-3 space-y-3">{children}</div>}
    </div>
  );
}

function Field({
  label,
  helper,
  children,
}: {
  label: string;
  helper?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1">
      <label className="block text-xs font-semibold text-slate-500">{label}</label>
      {helper && <p className="text-xs text-slate-400">{helper}</p>}
      {children}
    </div>
  );
}

const TEXTAREA_CLASS =
  "w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand resize-none";
const INPUT_CLASS =
  "w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand";
const SELECT_CLASS =
  "w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand bg-white";

export default function ActiveCycleCard({ project, onCycleChange }: Props) {
  const [cycle, setCycle] = useState<ScopeCycle | null>(() =>
    getActiveCycle(project.id)
  );
  const [creating, setCreating] = useState(false);
  const [completing, setCompleting] = useState(false);

  const refresh = useCallback(() => {
    setCycle(getActiveCycle(project.id));
    onCycleChange?.();
  }, [project.id, onCycleChange]);

  const save = useCallback(
    (patch: Partial<Omit<ScopeCycle, "id" | "projectId" | "createdAt">>) => {
      if (!cycle) return;
      const updated = updateScopeCycle(cycle.id, patch);
      if (updated) setCycle(updated);
    },
    [cycle]
  );

  const handleCreate = () => {
    setCreating(true);
    createInitialScopeCycle(project);
    refresh();
    setCreating(false);
  };

  const handleComplete = () => {
    if (!cycle) return;
    if (!cycle.learningSummary.trim() || cycle.decision === "undecided") return;
    setCompleting(true);
    updateScopeCycle(cycle.id, { status: "complete" });
    refresh();
    setCompleting(false);
  };

  const handleCreateNext = () => {
    if (!cycle) return;
    completeCycleAndCreateNext(project.id);
    refresh();
  };

  // Chip helpers
  const addToList = (field: "handles" | "excludes" | "edgeCaseParkingLot" | "successCriteria" | "evidenceNotes") =>
    (val: string) => save({ [field]: [...(cycle?.[field] ?? []), val] });
  const removeFromList = (field: "handles" | "excludes" | "edgeCaseParkingLot" | "successCriteria" | "evidenceNotes") =>
    (idx: number) => {
      const arr = [...(cycle?.[field] ?? [])];
      arr.splice(idx, 1);
      save({ [field]: arr });
    };

  if (!cycle) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
        <div>
          <h3 className="text-sm font-semibold text-slate-800">Active Cycle</h3>
          <p className="mt-1 text-xs text-slate-500">
            A cycle is a focused learning container — not a roadmap step.
          </p>
        </div>
        <button
          type="button"
          onClick={handleCreate}
          disabled={creating}
          className="w-full rounded-xl bg-brand py-2 text-sm font-semibold text-white disabled:opacity-50"
        >
          {creating ? "Creating…" : "Create first cycle"}
        </button>
      </div>
    );
  }

  const isComplete = cycle.status === "complete";
  const canComplete =
    !isComplete &&
    cycle.learningSummary.trim().length > 0 &&
    cycle.decision !== "undecided";
  const canCreateNext = isComplete && cycle.decision !== "kill";

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-slate-800">
            Active Cycle #{cycle.cycleNumber}
          </h3>
          <span className="mt-0.5 inline-block rounded-full bg-blue-50 px-2 py-0.5 text-xs font-semibold text-blue-700">
            {CYCLE_STATUS_LABELS[cycle.status]}
          </span>
        </div>
        {isComplete && (
          <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-700">
            Complete
          </span>
        )}
      </div>

      {/* A — Understand */}
      <Section title="A · Understand" defaultOpen={!isComplete}>
        <Field label="Hypothesis" helper="What do you believe will be true after this cycle?">
          <textarea
            rows={2}
            defaultValue={cycle.hypothesis}
            onBlur={(e) => save({ hypothesis: e.target.value })}
            className={TEXTAREA_CLASS}
            placeholder="If [user] can [do X], they will [get value Y]."
          />
        </Field>
        <Field label="Target user">
          <input
            type="text"
            defaultValue={cycle.targetUser}
            onBlur={(e) => save({ targetUser: e.target.value })}
            className={INPUT_CLASS}
          />
        </Field>
        <Field label="Problem">
          <textarea
            rows={2}
            defaultValue={cycle.problem}
            onBlur={(e) => save({ problem: e.target.value })}
            className={TEXTAREA_CLASS}
          />
        </Field>
        <Field label="Value promise">
          <textarea
            rows={2}
            defaultValue={cycle.valuePromise}
            onBlur={(e) => save({ valuePromise: e.target.value })}
            className={TEXTAREA_CLASS}
          />
        </Field>
        <Field label="Riskiest assumption" helper="What must be true for this cycle to succeed?">
          <textarea
            rows={2}
            defaultValue={cycle.riskiestAssumption}
            onBlur={(e) => save({ riskiestAssumption: e.target.value })}
            className={TEXTAREA_CLASS}
          />
        </Field>
      </Section>

      {/* B — Shrink */}
      <Section title="B · Shrink">
        <Field label="Smallest useful loop" helper="The minimum you need to learn anything meaningful.">
          <textarea
            rows={2}
            defaultValue={cycle.smallestUsefulLoop}
            onBlur={(e) => save({ smallestUsefulLoop: e.target.value })}
            className={TEXTAREA_CLASS}
          />
        </Field>
        <Field label="Current scope">
          <textarea
            rows={2}
            defaultValue={cycle.currentScope}
            onBlur={(e) => save({ currentScope: e.target.value })}
            className={TEXTAREA_CLASS}
          />
        </Field>
        <Field label="Handles">
          <ChipList
            items={cycle.handles}
            onAdd={addToList("handles")}
            onRemove={removeFromList("handles")}
            placeholder="This cycle handles…"
            chipClass="bg-blue-50 text-blue-700"
          />
        </Field>
        <Field label="Excludes" helper="Explicitly out of scope this cycle.">
          <ChipList
            items={cycle.excludes}
            onAdd={addToList("excludes")}
            onRemove={removeFromList("excludes")}
            placeholder="Not this cycle…"
            chipClass="bg-amber-50 text-amber-700"
          />
        </Field>
        <Field label="Edge case parking lot">
          <ChipList
            items={cycle.edgeCaseParkingLot}
            onAdd={addToList("edgeCaseParkingLot")}
            onRemove={removeFromList("edgeCaseParkingLot")}
            placeholder="Park an edge case…"
            chipClass="bg-slate-100 text-slate-500"
          />
        </Field>
      </Section>

      {/* C — Build */}
      <Section title="C · Build">
        <p className="text-xs text-slate-400">Only build what is needed for this cycle.</p>
        <Field label="Build artifact" helper="What will you actually ship?">
          <input
            type="text"
            defaultValue={cycle.buildArtifact}
            onBlur={(e) => save({ buildArtifact: e.target.value })}
            className={INPUT_CLASS}
          />
        </Field>
        {cycle.buildTaskIds.length > 0 && (
          <p className="text-xs text-slate-500">
            {cycle.buildTaskIds.length} build task{cycle.buildTaskIds.length !== 1 ? "s" : ""} linked
          </p>
        )}
      </Section>

      {/* D — Evaluate */}
      <Section title="D · Evaluate">
        <Field label="Evaluation method">
          <select
            value={cycle.evaluationMethod}
            onChange={(e) => save({ evaluationMethod: e.target.value as EvaluationMethod })}
            className={SELECT_CLASS}
          >
            <option value="">Select method…</option>
            {(Object.keys(EVALUATION_METHOD_LABELS) as EvaluationMethod[]).map((m) => (
              <option key={m} value={m}>
                {EVALUATION_METHOD_LABELS[m]}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Success criteria">
          <ChipList
            items={cycle.successCriteria}
            onAdd={addToList("successCriteria")}
            onRemove={removeFromList("successCriteria")}
            placeholder="Success looks like…"
            chipClass="bg-emerald-50 text-emerald-700"
          />
        </Field>
        <Field label="Evidence notes">
          <ChipList
            items={cycle.evidenceNotes}
            onAdd={addToList("evidenceNotes")}
            onRemove={removeFromList("evidenceNotes")}
            placeholder="Add evidence…"
            chipClass="bg-slate-100 text-slate-600"
          />
        </Field>
      </Section>

      {/* E — Learn */}
      <Section title="E · Learn">
        <Field label="Learning summary" helper="What did you actually learn?">
          <textarea
            rows={3}
            defaultValue={cycle.learningSummary}
            onBlur={(e) => save({ learningSummary: e.target.value })}
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
              <option key={d} value={d}>
                {CYCLE_DECISION_LABELS[d]}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Next scope" helper="What will the next cycle focus on?">
          <textarea
            rows={2}
            defaultValue={cycle.nextScope}
            onBlur={(e) => save({ nextScope: e.target.value })}
            className={TEXTAREA_CLASS}
          />
        </Field>
      </Section>

      {/* Actions */}
      <div className="space-y-2 pt-1">
        {!isComplete && (
          <button
            type="button"
            onClick={handleComplete}
            disabled={!canComplete || completing}
            className="w-full rounded-xl border border-slate-200 py-2 text-sm font-semibold text-slate-700 disabled:cursor-not-allowed disabled:opacity-40 active:bg-slate-50"
          >
            {completing ? "Completing…" : "Complete cycle"}
          </button>
        )}
        {isComplete && !canCreateNext && cycle.decision === "kill" && (
          <p className="text-center text-xs text-slate-400">
            Cycle killed — no next cycle will be created.
          </p>
        )}
        {canCreateNext && (
          <button
            type="button"
            onClick={handleCreateNext}
            className="w-full rounded-xl bg-brand py-2 text-sm font-semibold text-white active:opacity-90"
          >
            Create next cycle →
          </button>
        )}
        {!isComplete && !canComplete && (
          <p className="text-center text-xs text-slate-400">
            Fill in learning summary and choose a decision to complete the cycle.
          </p>
        )}
      </div>
    </div>
  );
}
