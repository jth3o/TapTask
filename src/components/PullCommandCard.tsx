"use client";

import { useState } from "react";

type PullCommandCardProps = {
  branch: string;
  repoFullName?: string;
  prState?: "open" | "merged" | "closed";
};

export function pullCommands(branch: string) {
  return `git fetch origin
git checkout ${branch}
npm install
npm run build
npm run dev`;
}

function CopyCommand({ label, command }: { label: string; command: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(command);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="flex items-center gap-2 rounded-lg bg-slate-900 px-3 py-2">
      <div className="min-w-0 flex-1">
        <p className="mb-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500">{label}</p>
        <code className="block truncate text-xs text-green-400">{command}</code>
      </div>
      <button
        type="button"
        onClick={handleCopy}
        className="shrink-0 rounded px-2 py-0.5 text-xs font-semibold text-slate-300 hover:text-white"
      >
        {copied ? "✓" : "Copy"}
      </button>
    </div>
  );
}

const STATE_COLORS: Record<string, string> = {
  open: "bg-green-100 text-green-800",
  merged: "bg-purple-100 text-purple-800",
  closed: "bg-red-100 text-red-800",
};

export function PullCommandCard({ branch, repoFullName, prState = "open" }: PullCommandCardProps) {
  const [allCopied, setAllCopied] = useState(false);

  const copyAll = async () => {
    await navigator.clipboard.writeText(pullCommands(branch));
    setAllCopied(true);
    setTimeout(() => setAllCopied(false), 1500);
  };

  return (
    <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Local ↔ GitHub</p>
        <div className="flex items-center gap-2">
          {prState && (
            <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${STATE_COLORS[prState] ?? STATE_COLORS.open}`}>
              {prState.toUpperCase()}
            </span>
          )}
          {repoFullName && (
            <span className="text-[10px] text-slate-400">{repoFullName}</span>
          )}
        </div>
      </div>

      <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
        <p className="text-xs text-amber-700">
          <span className="font-semibold">TapTask cannot inspect your local machine yet.</span> Commands are generated from the PR branch. A future local companion CLI will read your actual local state.
        </p>
      </div>

      <div className="space-y-1.5">
        <CopyCommand label="Fetch from remote" command="git fetch origin" />
        <CopyCommand label="Checkout + pull PR branch" command={`git checkout ${branch} && git pull origin ${branch}`} />
        <CopyCommand label="Verify" command="npm run build && npm run lint" />
        <CopyCommand label="Return to main" command="git checkout main && git pull origin main" />
      </div>

      <button
        type="button"
        onClick={copyAll}
        className="min-h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-xs font-semibold text-slate-700 hover:bg-slate-100"
      >
        {allCopied ? "Commands Copied" : "Copy All Commands"}
      </button>
    </div>
  );
}
