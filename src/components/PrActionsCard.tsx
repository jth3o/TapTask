"use client";

import { useEffect, useState } from "react";
import { GitHubPullRequest, GitHubPullRequestFile } from "@/lib/types";

type MergeStep = "idle" | "confirm" | "merging" | "merged" | "error";

type PrActionsCardProps = {
  repoFullName: string;
  pull: GitHubPullRequest;
  onMerged?: () => void;
};

function fileStatusBadge(status: GitHubPullRequestFile["status"]) {
  if (status === "added") return <span className="text-emerald-600">+</span>;
  if (status === "removed") return <span className="text-red-500">−</span>;
  if (status === "renamed") return <span className="text-amber-500">→</span>;
  return <span className="text-blue-500">~</span>;
}

export function PrActionsCard({ repoFullName, pull, onMerged }: PrActionsCardProps) {
  const [filesOpen, setFilesOpen] = useState(false);
  const [files, setFiles] = useState<GitHubPullRequestFile[] | null>(null);
  const [loadingFiles, setLoadingFiles] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null | undefined>(undefined);
  const [mergeStep, setMergeStep] = useState<MergeStep>("idle");
  const [mergeError, setMergeError] = useState("");

  useEffect(() => {
    async function fetchPreview() {
      try {
        const res = await fetch(
          `/api/github/pulls/preview?repoFullName=${encodeURIComponent(repoFullName)}&headBranch=${encodeURIComponent(pull.headBranch)}`
        );
        const data = (await res.json()) as { previewUrl?: string | null };
        setPreviewUrl(data.previewUrl ?? null);
      } catch {
        setPreviewUrl(null);
      }
    }
    void fetchPreview();
  }, [repoFullName, pull.headBranch]);

  const toggleFiles = async () => {
    const next = !filesOpen;
    setFilesOpen(next);
    if (next && files === null) {
      setLoadingFiles(true);
      try {
        const res = await fetch(
          `/api/github/pulls/files?repoFullName=${encodeURIComponent(repoFullName)}&pullNumber=${pull.number}`
        );
        const data = (await res.json()) as { files?: GitHubPullRequestFile[]; error?: string };
        setFiles(data.files ?? []);
      } catch {
        setFiles([]);
      } finally {
        setLoadingFiles(false);
      }
    }
  };

  const handleMerge = async () => {
    if (mergeStep === "idle") {
      setMergeStep("confirm");
      return;
    }
    if (mergeStep !== "confirm") return;

    setMergeStep("merging");
    setMergeError("");

    try {
      const res = await fetch("/api/github/pulls/merge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ repoFullName, pullNumber: pull.number })
      });
      const data = (await res.json()) as { merged?: boolean; error?: string };

      if (!res.ok || !data.merged) {
        throw new Error(data.error ?? "Merge failed.");
      }

      setMergeStep("merged");
      onMerged?.();
    } catch (err) {
      setMergeError(err instanceof Error ? err.message : "Merge failed.");
      setMergeStep("error");
    }
  };

  const mergeLabel = {
    idle: "Merge PR",
    confirm: "Tap again to confirm merge",
    merging: "Merging…",
    merged: "Merged ✓",
    error: "Merge failed"
  }[mergeStep];

  const mergeClass = {
    idle: "bg-slate-900 text-white",
    confirm: "bg-amber-500 text-white",
    merging: "bg-slate-400 text-white cursor-not-allowed",
    merged: "bg-emerald-600 text-white cursor-not-allowed",
    error: "bg-red-600 text-white"
  }[mergeStep];

  const totalAdditions = files?.reduce((sum, f) => sum + f.additions, 0) ?? 0;
  const totalDeletions = files?.reduce((sum, f) => sum + f.deletions, 0) ?? 0;

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={toggleFiles}
          className="min-h-10 rounded-xl border border-slate-200 px-3 text-sm font-semibold text-slate-700 active:bg-slate-50"
        >
          {filesOpen ? "Hide files" : "View files"}
        </button>

        <button
          type="button"
          onClick={handleMerge}
          disabled={mergeStep === "merging" || mergeStep === "merged"}
          className={`min-h-10 rounded-xl px-3 text-sm font-semibold transition ${mergeClass} disabled:cursor-not-allowed`}
        >
          {mergeLabel}
        </button>
      </div>

      {mergeStep === "error" && mergeError ? (
        <p className="rounded-xl bg-red-50 px-3 py-2 text-xs text-red-700">{mergeError}</p>
      ) : null}

      {previewUrl ? (
        <a
          href={previewUrl}
          target="_blank"
          rel="noreferrer"
          className="block min-h-10 rounded-xl bg-emerald-50 px-3 py-2.5 text-center text-sm font-semibold text-emerald-700"
        >
          Open Preview ↗
        </a>
      ) : null}

      {filesOpen ? (
        <div className="rounded-xl border border-slate-100 bg-slate-50 p-3">
          {loadingFiles ? (
            <p className="text-xs text-slate-500">Loading files…</p>
          ) : files && files.length > 0 ? (
            <>
              <p className="mb-2 text-xs font-semibold text-slate-500">
                {files.length} file{files.length !== 1 ? "s" : ""} changed
                {" · "}
                <span className="text-emerald-600">+{totalAdditions}</span>
                {" "}
                <span className="text-red-500">−{totalDeletions}</span>
              </p>
              <ul className="space-y-1">
                {files.map((file) => (
                  <li key={file.filename} className="flex items-center gap-2 text-xs text-slate-700">
                    {fileStatusBadge(file.status)}
                    <span className="break-all font-mono">{file.filename}</span>
                    <span className="ml-auto shrink-0 text-slate-400">
                      +{file.additions} −{file.deletions}
                    </span>
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <p className="text-xs text-slate-500">No files found.</p>
          )}
        </div>
      ) : null}
    </div>
  );
}
