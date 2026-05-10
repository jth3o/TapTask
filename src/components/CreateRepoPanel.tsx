"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { IdeaProject } from "@/lib/ideaTypes";
import { saveTaskPrefill } from "@/lib/ideaStorage";

interface CreateRepoResult {
  fullName: string;
  htmlUrl: string;
  defaultBranch: string;
  cloneUrl: string;
  commitSha: string;
  templateLabel: string;
  fileCount: number;
}

function firstBuildTask(project: IdeaProject, projectName: string): string {
  const base = project.mvpDefinition
    ? `MVP scope: ${project.mvpDefinition}`
    : `Web page: ${projectName}${project.problem ? `\nProblem: ${project.problem}` : ""}`;

  return `${base}\n\nBuild the initial web page: hero section, core content sections, and any interactive elements described above. Make it responsive. No placeholder content.\n\nAcceptance criteria:\n- Core flow works end to end\n- No placeholder content\n- Code is clean and committed`;
}

export function CreateRepoPanel({
  project,
  onRepoCreated,
}: {
  project: IdeaProject;
  onRepoCreated: (repoFullName: string, htmlUrl: string) => void;
}) {
  const router = useRouter();

  const [projectName, setProjectName] = useState(project.name);
  const [description, setDescription] = useState(project.description || project.problem || "");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<CreateRepoResult | null>(null);
  const [dispatching, setDispatching] = useState(false);
  const [dispatched, setDispatched] = useState(false);

  const canCreate = projectName.trim().length > 0 && !creating && !result;

  const handleCreate = async () => {
    setCreating(true);
    setError("");
    try {
      const res = await fetch("/api/github/repos/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectName: projectName.trim(), description, projectType: "web_page", visibility: "private" }),
      });
      const data = (await res.json()) as CreateRepoResult & { error?: string };
      if (!res.ok || data.error) throw new Error(data.error ?? "Repo creation failed.");
      setResult(data);
      onRepoCreated(data.fullName, data.htmlUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Repo creation failed.");
    } finally {
      setCreating(false);
    }
  };

  const handleDispatch = () => {
    if (!result) return;
    setDispatching(true);
    const task = firstBuildTask({ ...project, name: projectName }, projectName);
    saveTaskPrefill({
      taskType: "new_feature",
      rawInput: task,
      agentSuggestion: "cursor",
      repoFullName: result.fullName,
    });
    setDispatched(true);
    setTimeout(() => router.push("/"), 300);
  };

  if (result) {
    return (
      <div className="space-y-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
        <div className="flex items-center gap-2">
          <span className="text-lg">✓</span>
          <p className="text-sm font-bold text-emerald-800">Repo created</p>
        </div>

        <div className="rounded-xl border border-emerald-200 bg-white p-3 space-y-2">
          <Row label="Repo" value={
            <a href={result.htmlUrl} target="_blank" rel="noreferrer" className="font-semibold text-brand hover:underline break-all">
              {result.fullName} ↗
            </a>
          } />
          <Row label="Branch" value={<code className="text-xs">{result.defaultBranch}</code>} />
          <Row label="Commit" value={<code className="text-xs">{result.commitSha.slice(0, 7)}</code>} />
          <Row label="Template" value={<span className="text-xs">{result.templateLabel}</span>} />
          <Row label="Files" value={<span className="text-xs">{result.fileCount} files committed</span>} />
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-1.5">First build task</p>
          <p className="text-xs text-slate-700 whitespace-pre-wrap">{firstBuildTask({ ...project, name: projectName }, projectName)}</p>
        </div>

        <button
          type="button"
          onClick={handleDispatch}
          disabled={dispatching || dispatched}
          className="w-full min-h-11 rounded-xl bg-brand px-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60 active:opacity-90"
        >
          {dispatched ? "Opening Build tab… ✓" : dispatching ? "Sending…" : "→ Send First Task to Build Tab"}
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4">
      <p className="text-sm font-bold text-slate-800">Create Web Page Repo</p>

      <div>
        <label className="mb-1 block text-xs font-semibold text-slate-500">Repo name</label>
        <input
          value={projectName}
          onChange={(e) => setProjectName(e.target.value)}
          className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand"
          placeholder="my-web-page"
        />
        <p className="mt-1 text-xs text-slate-400">
          Will be created as: <code>{projectName.toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, "") || "my-web-page"}</code>
        </p>
      </div>

      <div>
        <label className="mb-1 block text-xs font-semibold text-slate-500">Description</label>
        <input
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand"
          placeholder="What does this web page do?"
        />
      </div>

      {error && (
        <p className="rounded-xl bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>
      )}

      <button
        type="button"
        onClick={() => void handleCreate()}
        disabled={!canCreate}
        className="w-full min-h-12 rounded-xl bg-brand px-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40 active:opacity-90"
      >
        {creating ? (
          <span className="flex items-center justify-center gap-2">
            <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
            Creating repo…
          </span>
        ) : (
          "Create Repo"
        )}
      </button>
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-xs text-slate-500 shrink-0">{label}</span>
      <span className="text-right">{value}</span>
    </div>
  );
}
