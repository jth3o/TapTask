import { useState } from "react";
import { ProjectProfile } from "@/lib/types";

interface LocalGitHubPanelProps {
  project: ProjectProfile;
}

function CopyCommand({ label, command }: { label: string; command: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(command);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="space-y-1">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <div className="flex items-center gap-2 rounded-lg bg-slate-900 px-3 py-2">
        <code className="flex-1 truncate text-xs text-green-400">{command}</code>
        <button
          type="button"
          onClick={handleCopy}
          className="shrink-0 rounded px-2 py-0.5 text-xs font-semibold text-slate-300 hover:text-white"
        >
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
    </div>
  );
}

function StatusPill({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2">
      <span className="text-xs text-slate-500">{label}</span>
      <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${color}`}>{value}</span>
    </div>
  );
}

export function LocalGitHubPanel({ project }: LocalGitHubPanelProps) {
  const [open, setOpen] = useState(false);
  const [prBranch, setPrBranch] = useState("");
  const [prStatus, setPrStatus] = useState<"open" | "merged" | "closed">("open");

  const repoUrl = project.repoUrl?.trim() || "";
  const hasRepo = repoUrl.length > 0;

  const branch = prBranch.trim() || "<pr-branch>";

  const statusColors: Record<string, string> = {
    open: "bg-green-100 text-green-800",
    merged: "bg-purple-100 text-purple-800",
    closed: "bg-red-100 text-red-800",
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex w-full items-center justify-between rounded-xl border border-dashed border-slate-300 px-4 py-3 text-sm text-slate-500 hover:border-slate-400 hover:text-slate-700"
      >
        <span>Local ↔ GitHub sync helper</span>
        <span className="text-xs text-slate-400">tap to open</span>
      </button>
    );
  }

  return (
    <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-slate-900">Local ↔ GitHub</p>
        <button type="button" onClick={() => setOpen(false)} className="text-xs text-slate-400 hover:text-slate-600">
          close
        </button>
      </div>

      <div className="rounded-xl border border-amber-200 bg-amber-50 p-3">
        <p className="text-xs font-semibold text-amber-800">TapTask cannot inspect your local machine yet.</p>
        <p className="mt-1 text-xs text-amber-700">
          Commands below are generated from the repo URL and PR branch you enter. A future local companion CLI will
          read your actual local state.
        </p>
      </div>

      <div className="space-y-2">
        <StatusPill
          label="Repo"
          value={hasRepo ? repoUrl.replace("https://github.com/", "") : "No repo URL set"}
          color={hasRepo ? "bg-slate-100 text-slate-700" : "bg-red-100 text-red-700"}
        />

        <div className="flex gap-2">
          {(["open", "merged", "closed"] as const).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setPrStatus(s)}
              className={`flex-1 rounded-lg py-2 text-xs font-semibold transition-colors ${
                prStatus === s ? statusColors[s] : "bg-slate-100 text-slate-500 hover:bg-slate-200"
              }`}
            >
              {s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>

        <StatusPill label="PR status" value={prStatus.toUpperCase()} color={statusColors[prStatus]} />
      </div>

      <div>
        <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
          PR branch name
        </label>
        <input
          className="min-h-10 w-full rounded-xl border border-slate-300 px-3 text-sm"
          placeholder="e.g. feat/add-project-types"
          value={prBranch}
          onChange={(e) => setPrBranch(e.target.value)}
        />
      </div>

      <div className="space-y-3">
        <CopyCommand label="Fetch latest from remote" command="git fetch origin" />
        <CopyCommand
          label="Checkout PR branch"
          command={`git checkout ${branch} && git pull origin ${branch}`}
        />
        <CopyCommand
          label="Run verification"
          command="npm run build && npm run lint && npm run type-check"
        />
        <CopyCommand label="Return to main" command="git checkout main && git pull origin main" />
        {prStatus === "merged" && (
          <CopyCommand
            label="Pull merged changes to main"
            command="git checkout main && git pull origin main"
          />
        )}
      </div>

      <p className="text-xs text-slate-400">
        These commands assume a standard git + npm workflow. Adjust for your tech stack (cargo, pip, go, etc.).
      </p>
    </section>
  );
}
