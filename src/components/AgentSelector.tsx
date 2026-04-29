import { AGENT_OPTIONS, Agent } from "@/lib/types";

interface AgentSelectorProps {
  value: Agent;
  onChange: (value: Agent) => void;
}

export function AgentSelector({ value, onChange }: AgentSelectorProps) {
  return (
    <div className="grid grid-cols-2 gap-2">
      {AGENT_OPTIONS.map((agent) => (
        <button
          key={agent.value}
          type="button"
          onClick={() => onChange(agent.value)}
          className={`min-h-[4.5rem] rounded-xl border px-4 py-3 text-left transition ${
            value === agent.value ? "border-brand bg-blue-50 text-brand" : "border-slate-200 bg-white text-slate-700"
          }`}
        >
          <span className="block text-sm font-semibold">{agent.label}</span>
          <span className="mt-1 block text-xs text-slate-500">{agent.description}</span>
        </button>
      ))}
    </div>
  );
}
