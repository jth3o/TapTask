import { AGENT_OPTIONS, Agent } from "@/lib/types";

interface AgentSelectorProps {
  value: Agent;
  onChange: (value: Agent) => void;
}

export function AgentSelector({ value, onChange }: AgentSelectorProps) {
  return (
    <div className="grid grid-cols-4 gap-1.5">
      {AGENT_OPTIONS.map((agent) => (
        <button
          key={agent.value}
          type="button"
          onClick={() => onChange(agent.value)}
          className={`min-h-10 rounded-xl border py-2 text-center text-sm font-semibold transition-colors ${
            value === agent.value
              ? "border-brand bg-blue-50 text-brand"
              : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
          }`}
        >
          {agent.label}
        </button>
      ))}
    </div>
  );
}
