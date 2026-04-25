interface TaskInputProps {
  value: string;
  onChange: (value: string) => void;
}

export function TaskInput({ value, onChange }: TaskInputProps) {
  return (
    <textarea
      className="w-full rounded-xl border border-slate-300 px-3 py-3 text-sm"
      rows={7}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      placeholder="Describe the coding task in rough form..."
    />
  );
}
