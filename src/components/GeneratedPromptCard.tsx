interface GeneratedPromptCardProps {
  prompt: string;
  copied: boolean;
  saved: boolean;
  onCopy: () => void;
  onSave: () => void;
}

export function GeneratedPromptCard({ prompt, copied, saved, onCopy, onSave }: GeneratedPromptCardProps) {
  if (!prompt) return null;

  return (
    <section className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <h3 className="text-base font-semibold text-slate-900">Generated Prompt</h3>
      <pre className="max-h-72 overflow-auto whitespace-pre-wrap rounded-xl bg-slate-50 p-3 text-xs text-slate-700">{prompt}</pre>
      <div className="grid grid-cols-2 gap-2">
        <button type="button" onClick={onCopy} className="min-h-12 rounded-xl bg-brand px-4 text-sm font-semibold text-white">
          {copied ? "Copied" : "Copy Prompt"}
        </button>
        <button type="button" onClick={onSave} className="min-h-12 rounded-xl bg-slate-900 px-4 text-sm font-semibold text-white">
          {saved ? "Saved" : "Save Task"}
        </button>
      </div>
    </section>
  );
}
