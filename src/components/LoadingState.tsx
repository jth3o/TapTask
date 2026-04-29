interface LoadingStateProps {
  message: string;
}

export function LoadingState({ message }: LoadingStateProps) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-600">
      {message}
    </div>
  );
}
