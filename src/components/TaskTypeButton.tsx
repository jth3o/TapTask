import { TaskType } from "@/lib/types";

interface TaskTypeButtonProps {
  label: TaskType;
  selected: boolean;
  onClick: () => void;
}

export function TaskTypeButton({ label, selected, onClick }: TaskTypeButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`min-h-12 rounded-xl border px-4 py-3 text-left text-sm font-medium transition ${
        selected
          ? "border-brand bg-blue-50 text-brand"
          : "border-slate-200 bg-white text-slate-700 active:bg-slate-100"
      }`}
    >
      {label}
    </button>
  );
}
