import { TASK_TYPE_OPTIONS, TaskType } from "@/lib/types";

interface TaskTypeGridProps {
  value: TaskType;
  onChange: (value: TaskType) => void;
}

export function TaskTypeGrid({ value, onChange }: TaskTypeGridProps) {
  return (
    <div className="-mx-4 overflow-x-auto px-4">
      <div className="flex gap-2 pb-1" style={{ width: "max-content" }}>
        {TASK_TYPE_OPTIONS.map((type) => (
          <button
            key={type.value}
            type="button"
            onClick={() => onChange(type.value)}
            className={`shrink-0 rounded-full border px-4 py-2 text-sm font-medium transition-colors ${
              value === type.value
                ? "border-brand bg-brand text-white"
                : "border-slate-200 bg-white text-slate-700 hover:border-slate-300"
            }`}
          >
            {type.label}
          </button>
        ))}
      </div>
    </div>
  );
}
