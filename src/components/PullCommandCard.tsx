type PullCommandCardProps = {
  branch: string;
  copied: boolean;
  onCopy: () => void;
};

export function pullCommands(branch: string) {
  return `git fetch origin
git checkout ${branch}
npm install
npm run build
npm run dev`;
}

export function PullCommandCard({ branch, copied, onCopy }: PullCommandCardProps) {
  return (
    <div className="space-y-2 rounded-xl bg-slate-50 p-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Local Pull / Test</p>
      <pre className="overflow-auto text-xs text-slate-700">{pullCommands(branch)}</pre>
      <button
        type="button"
        onClick={onCopy}
        className="min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700"
      >
        {copied ? "Commands Copied" : "Copy Pull Commands"}
      </button>
    </div>
  );
}
