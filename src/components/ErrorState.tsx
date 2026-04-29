interface ErrorStateProps {
  message: string;
}

export function ErrorState({ message }: ErrorStateProps) {
  if (!message) return null;

  return (
    <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
      {message}
    </div>
  );
}
