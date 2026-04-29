import { TASK_MODES, TaskMode } from "@/lib/types";

interface TaskModeSelectorProps {
  value: TaskMode;
  onChange: (mode: TaskMode) => void;
}

const modeDescriptions: Record<TaskMode, string> = {
  "Safe Patch": "Fix only the named bug. No features, no refactors.",
  "Legacy Context": "Cursor must inspect and preserve existing repo patterns before editing.",
  "Normal Feature": "One focused feature. Avoid unrelated rewrites.",
  "Experimental Branch": "May make broader changes. Use only on disposable branches."
};

export function TaskModeSelector({ value, onChange }: TaskModeSelectorProps) {
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-2">
        {TASK_MODES.map((mode) => (
          <button
            key={mode}
            type="button"
            onClick={() => onChange(mode)}
            className={`min-h-12 rounded-xl border px-4 py-3 text-left text-sm font-medium transition ${
              value === mode
                ? "border-brand bg-blue-50 text-brand"
                : "border-slate-200 bg-white text-slate-700 active:bg-slate-100"
            }`}
          >
            {mode}
          </button>
        ))}
      </div>
      <p className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">
        {modeDescriptions[value]}
      </p>
      {value === "Experimental Branch" && (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
          Warning: May make broader changes. Use only on disposable branches.
        </p>
      )}
    </div>
  );
}
