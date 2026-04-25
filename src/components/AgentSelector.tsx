import { AGENTS, Agent } from "@/lib/types";

interface AgentSelectorProps {
  value: Agent;
  onChange: (value: Agent) => void;
}

export function AgentSelector({ value, onChange }: AgentSelectorProps) {
  return (
    <div className="grid grid-cols-2 gap-2">
      {AGENTS.map((agent) => (
        <button
          key={agent}
          type="button"
          onClick={() => onChange(agent)}
          className={`min-h-12 rounded-xl border px-4 py-3 text-sm font-medium ${
            value === agent ? "border-brand bg-blue-50 text-brand" : "border-slate-200 text-slate-700"
          }`}
        >
          {agent}
        </button>
      ))}
    </div>
  );
}
