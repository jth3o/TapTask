import { useState } from "react";
import { ImplementationPhase } from "@/lib/types";

interface BigChangePhasesCardProps {
  phases: ImplementationPhase[];
  onGeneratePhasePrompt: (phaseIndex: number) => void;
}

function PhaseRow({
  phase,
  index,
  onGenerate,
}: {
  phase: ImplementationPhase;
  index: number;
  onGenerate: () => void;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-slate-900 text-[10px] font-bold text-white">
              {index + 1}
            </span>
            <p className="text-sm font-semibold text-slate-900">{phase.title}</p>
          </div>
          <p className="mt-1 pl-7 text-xs text-slate-600">{phase.purpose}</p>
        </div>
      </div>

      {expanded && (
        <div className="mt-3 space-y-3 pl-7">
          <div>
            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">Acceptance criteria</p>
            <ul className="space-y-0.5">
              {phase.acceptanceCriteria.map((c, i) => (
                <li key={i} className="flex gap-2 text-xs text-slate-600">
                  <span className="shrink-0 text-slate-400">–</span>
                  <span>{c}</span>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">Non-goals</p>
            <ul className="space-y-0.5">
              {phase.nonGoals.map((g, i) => (
                <li key={i} className="flex gap-2 text-xs text-slate-600">
                  <span className="shrink-0 text-slate-400">–</span>
                  <span>{g}</span>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">Verification</p>
            <p className="text-xs text-slate-600">{phase.verificationStep}</p>
          </div>
          <div>
            <p className="text-xs text-slate-500">
              Suggested agent: <span className="font-medium text-slate-700">{phase.suggestedAgent}</span>
            </p>
          </div>
        </div>
      )}

      <div className="mt-3 flex gap-2 pl-7">
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="text-xs text-slate-400 hover:text-slate-600"
        >
          {expanded ? "Collapse" : "Details"}
        </button>
        <button
          type="button"
          onClick={onGenerate}
          className="rounded-lg bg-brand px-3 py-1.5 text-xs font-semibold text-white"
        >
          Generate Phase {index + 1} Prompt
        </button>
      </div>
    </div>
  );
}

export function BigChangePhasesCard({ phases, onGeneratePhasePrompt }: BigChangePhasesCardProps) {
  return (
    <section className="space-y-3 rounded-2xl border border-orange-200 bg-white p-4 shadow-sm">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-orange-600">Big Change — Phases</p>
        <p className="mt-1 text-sm text-slate-700">
          Work through each phase in order. Generate a prompt per phase. Do not combine phases.
        </p>
      </div>
      <div className="space-y-2">
        {phases.map((phase, i) => (
          <PhaseRow key={i} phase={phase} index={i} onGenerate={() => onGeneratePhasePrompt(i)} />
        ))}
      </div>
    </section>
  );
}
