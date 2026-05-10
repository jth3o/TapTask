import { useState } from "react";
import { ChangePlan, CHANGE_SIZE_COLORS, CHANGE_SIZE_LABELS } from "@/lib/types";

interface ChangePlannerCardProps {
  plan: ChangePlan;
  sending: boolean;
  onSend: () => void;
}

function PlanSection({ title, items }: { title: string; items: string[] }) {
  if (items.length === 0) return null;
  return (
    <div>
      <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">{title}</p>
      <ul className="space-y-1">
        {items.map((item, i) => (
          <li key={i} className="flex gap-2 text-sm text-slate-700">
            <span className="mt-0.5 shrink-0 text-slate-400">–</span>
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function ChangePlannerCard({ plan, sending, onSend }: ChangePlannerCardProps) {
  const [expanded, setExpanded] = useState(false);
  const isBigChange = plan.changeSize === "big_change";

  return (
    <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Change Plan</p>
          <p className="mt-1 text-sm font-medium text-slate-900">{plan.goal}</p>
        </div>
        <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${CHANGE_SIZE_COLORS[plan.changeSize]}`}>
          {CHANGE_SIZE_LABELS[plan.changeSize]}
        </span>
      </div>

      <div>
        <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">User-facing behavior</p>
        <p className="text-sm text-slate-700">{plan.userFacingBehavior}</p>
      </div>

      <PlanSection title="Acceptance criteria" items={plan.acceptanceCriteria} />

      {expanded && (
        <>
          <PlanSection title="Logic requirements" items={plan.logicRequirements} />
          <PlanSection title="Data / state requirements" items={plan.dataStateRequirements} />
          <PlanSection title="Files likely affected" items={plan.filesLikelyAffected} />
          <PlanSection title="Test / verification plan" items={plan.testVerificationPlan} />
          <PlanSection title="Non-goals" items={plan.nonGoals} />
          <PlanSection title="Risk notes" items={plan.riskNotes} />
        </>
      )}

      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="text-xs text-slate-400 hover:text-slate-600"
      >
        {expanded ? "Show less" : "Show full plan"}
      </button>

      {isBigChange ? (
        <div className="rounded-xl border border-orange-200 bg-orange-50 p-3">
          <p className="text-sm font-semibold text-orange-800">Big change — split into phases below.</p>
          <p className="mt-1 text-xs text-orange-700">
            Do not send this as one giant task. Work through each phase in order. Send one phase at a time.
          </p>
        </div>
      ) : (
        <button
          type="button"
          onClick={onSend}
          disabled={sending}
          className="min-h-12 w-full rounded-xl bg-brand px-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
        >
          {sending ? "Sending…" : "Send Task"}
        </button>
      )}
    </section>
  );
}
