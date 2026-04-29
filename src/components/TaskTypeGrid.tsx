import { TASK_TYPE_OPTIONS, TaskType } from "@/lib/types";
import { TaskTypeButton } from "./TaskTypeButton";

interface TaskTypeGridProps {
  value: TaskType;
  onChange: (value: TaskType) => void;
}

export function TaskTypeGrid({ value, onChange }: TaskTypeGridProps) {
  return (
    <div className="grid grid-cols-2 gap-2">
      {TASK_TYPE_OPTIONS.map((type) => (
        <TaskTypeButton
          key={type.value}
          label={type.label}
          selected={value === type.value}
          onClick={() => onChange(type.value)}
        />
      ))}
    </div>
  );
}
