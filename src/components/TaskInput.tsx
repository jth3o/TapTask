interface TaskInputProps {
  value: string;
  onChange: (value: string) => void;
}

export function TaskInput({ value, onChange }: TaskInputProps) {
  return (
    <textarea
      className="w-full rounded-xl border border-slate-300 bg-white px-3 py-3 text-base shadow-sm outline-none focus:border-brand focus:ring-2 focus:ring-blue-100"
      rows={8}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      placeholder={`Add a clear button to reset the fake email form.
Fix the mobile overflow on the dashboard.
Fix the Vercel build error.
Write a README for setup and usage.`}
    />
  );
}
