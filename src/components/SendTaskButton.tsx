type SendTaskButtonProps = {
  disabled: boolean;
  sending: boolean;
  label?: string;
  onClick: () => void;
};

export function SendTaskButton({ disabled, sending, label = "Send Task", onClick }: SendTaskButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || sending}
      className="min-h-14 w-full rounded-2xl bg-brand px-5 text-base font-bold text-white shadow-lg shadow-blue-200 transition active:scale-[0.99] disabled:cursor-not-allowed disabled:bg-slate-300 disabled:shadow-none"
    >
      {sending ? "Sending..." : label}
    </button>
  );
}
