"use client";

import { useEffect, useState } from "react";
import { GitHubPullRequest, GitHubPullRequestFile } from "@/lib/types";
import type { FollowUpAction } from "@/lib/generateIssue";

// ─── Risk ────────────────────────────────────────────────────────────────────

const HIGH_RISK_FILES = new Set([
  "package.json",
  "package-lock.json",
  "pnpm-lock.yaml",
  "yarn.lock",
  "next.config.ts",
  "tsconfig.json",
  ".env.example",
  "src/lib/types.ts",
  "src/lib/github.ts"
]);

type RiskLevel = "low" | "medium" | "high";

function computeRisk(files: GitHubPullRequestFile[]): { level: RiskLevel; highRiskFiles: string[] } {
  const highRiskTouched = files
    .map((f) => f.filename)
    .filter((name) => HIGH_RISK_FILES.has(name) || name.startsWith("src/app/api/"));

  if (highRiskTouched.length > 0) return { level: "high", highRiskFiles: highRiskTouched };

  const totalAdditions = files.reduce((sum, f) => sum + f.additions, 0);
  if (files.length > 8 || totalAdditions > 500) return { level: "medium", highRiskFiles: [] };

  return { level: "low", highRiskFiles: [] };
}

const riskStyle: Record<RiskLevel, string> = {
  low: "bg-emerald-50 text-emerald-700",
  medium: "bg-amber-50 text-amber-700",
  high: "bg-red-50 text-red-700"
};

const riskLabel: Record<RiskLevel, string> = {
  low: "Low risk",
  medium: "Medium risk",
  high: "High risk"
};

// ─── Types ───────────────────────────────────────────────────────────────────

type MergeStep = "idle" | "confirm" | "merging" | "merged" | "error";
type CloseStep = "idle" | "confirm" | "closing" | "closed" | "error";

type ActionResult = {
  message: string;
  issueUrl?: string;
  cursorPrompt?: string;
};

type PrActionsCardProps = {
  repoFullName: string;
  pull: GitHubPullRequest;
  onMerged?: () => void;
  onClosed?: () => void;
};

// ─── Follow-up button config ─────────────────────────────────────────────────

const FOLLOW_UP_ACTIONS: { action: FollowUpAction; label: string; fullWidth?: boolean }[] = [
  { action: "fix_build", label: "Fix Build" },
  { action: "make_smaller_diff", label: "Smaller Diff" },
  { action: "polish_ui", label: "Polish UI" },
  { action: "add_readme", label: "Add README" },
  { action: "explain_changes", label: "Explain Changes" },
  { action: "create_followup", label: "Create Follow-up" },
  { action: "start_over", label: "Start Over From Main", fullWidth: true }
];

// ─── Component ───────────────────────────────────────────────────────────────

export function PrActionsCard({ repoFullName, pull, onMerged, onClosed }: PrActionsCardProps) {
  const [files, setFiles] = useState<GitHubPullRequestFile[] | null>(null);
  const [loadingFiles, setLoadingFiles] = useState(true);
  const [filesOpen, setFilesOpen] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null | undefined>(undefined);
  const [mergeStep, setMergeStep] = useState<MergeStep>("idle");
  const [mergeError, setMergeError] = useState("");
  const [closeStep, setCloseStep] = useState<CloseStep>("idle");
  const [closeError, setCloseError] = useState("");
  const [followupOpen, setFollowupOpen] = useState(false);
  const [recoveryOpen, setRecoveryOpen] = useState(false);
  const [actioning, setActioning] = useState<FollowUpAction | null>(null);
  const [actionResult, setActionResult] = useState<ActionResult | null>(null);
  const [copiedCursorPrompt, setCopiedCursorPrompt] = useState(false);

  // Eager file fetch for risk assessment
  useEffect(() => {
    async function fetchFiles() {
      try {
        const res = await fetch(
          `/api/github/pulls/files?repoFullName=${encodeURIComponent(repoFullName)}&pullNumber=${pull.number}`
        );
        const data = (await res.json()) as { files?: GitHubPullRequestFile[] };
        setFiles(data.files ?? []);
      } catch {
        setFiles([]);
      } finally {
        setLoadingFiles(false);
      }
    }
    void fetchFiles();
  }, [repoFullName, pull.number]);

  // Preview URL
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

  // ─── Merge ────────────────────────────────────────────────────────────────

  const handleMerge = async () => {
    if (mergeStep === "idle") { setMergeStep("confirm"); return; }
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
      if (!res.ok || !data.merged) throw new Error(data.error ?? "Merge failed.");
      setMergeStep("merged");
      onMerged?.();
    } catch (err) {
      setMergeError(err instanceof Error ? err.message : "Merge failed.");
      setMergeStep("error");
    }
  };

  // ─── Close ────────────────────────────────────────────────────────────────

  const handleClose = async () => {
    if (closeStep === "idle") { setCloseStep("confirm"); return; }
    if (closeStep !== "confirm") return;
    setCloseStep("closing");
    setCloseError("");
    try {
      const res = await fetch("/api/github/pulls/close", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ repoFullName, pullNumber: pull.number })
      });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) throw new Error(data.error ?? "Close failed.");
      setCloseStep("closed");
      onClosed?.();
    } catch (err) {
      setCloseError(err instanceof Error ? err.message : "Close failed.");
      setCloseStep("error");
    }
  };

  // ─── Reduce diff comment ──────────────────────────────────────────────────

  const handleReduceDiff = async () => {
    setActioning("make_smaller_diff");
    try {
      const res = await fetch("/api/github/issues/comment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          repoFullName,
          issueNumber: pull.number,
          body: "This PR is too broad. Please revise this PR to make the smallest possible change, preserve existing architecture, avoid unrelated files, and explain why each changed file is necessary."
        })
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Failed to post comment.");
      setActionResult({ message: "Comment posted asking agent to reduce diff." });
    } catch (err) {
      setActionResult({ message: err instanceof Error ? err.message : "Failed to post comment." });
    } finally {
      setActioning(null);
    }
  };

  // ─── Follow-up actions ────────────────────────────────────────────────────

  const handleFollowUp = async (action: FollowUpAction) => {
    setActioning(action);
    setActionResult(null);
    try {
      const res = await fetch("/api/github/pulls/followup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          repoFullName,
          pullNumber: pull.number,
          pullTitle: pull.title,
          pullUrl: pull.htmlUrl,
          headBranch: pull.headBranch,
          action
        })
      });
      const data = (await res.json()) as {
        message?: string;
        issueUrl?: string;
        cursorPrompt?: string;
        error?: string;
      };
      if (!res.ok) throw new Error(data.error ?? "Action failed.");
      setActionResult({
        message: data.message ?? "Done.",
        issueUrl: data.issueUrl,
        cursorPrompt: data.cursorPrompt
      });
    } catch (err) {
      setActionResult({ message: err instanceof Error ? err.message : "Action failed." });
    } finally {
      setActioning(null);
    }
  };

  // ─── Derived values ───────────────────────────────────────────────────────

  const risk = files !== null ? computeRisk(files) : null;
  const totalAdditions = files?.reduce((sum, f) => sum + f.additions, 0) ?? 0;
  const totalDeletions = files?.reduce((sum, f) => sum + f.deletions, 0) ?? 0;

  const mergeLabel = { idle: "Merge PR", confirm: "Confirm merge", merging: "Merging…", merged: "Merged ✓", error: "Merge failed" }[mergeStep];
  const mergeClass = {
    idle: "bg-slate-900 text-white",
    confirm: "bg-amber-500 text-white",
    merging: "bg-slate-400 text-white cursor-not-allowed",
    merged: "bg-emerald-600 text-white cursor-not-allowed",
    error: "bg-red-600 text-white"
  }[mergeStep];

  const closeLabel = { idle: "Close PR", confirm: "Confirm close", closing: "Closing…", closed: "Closed ✓", error: "Close failed" }[closeStep];
  const closeClass = {
    idle: "border border-red-200 text-red-700",
    confirm: "bg-red-500 text-white",
    closing: "bg-slate-400 text-white cursor-not-allowed",
    closed: "bg-slate-400 text-white cursor-not-allowed",
    error: "bg-red-600 text-white"
  }[closeStep];

  return (
    <div className="space-y-3">

      {/* ── Risk summary ─────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-2">
        {loadingFiles ? (
          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-500">Assessing risk…</span>
        ) : risk ? (
          <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${riskStyle[risk.level]}`}>
            {riskLabel[risk.level]}
          </span>
        ) : null}

        {files !== null && !loadingFiles ? (
          <span className="text-xs text-slate-500">
            {files.length} file{files.length !== 1 ? "s" : ""}
            {" · "}
            <span className="text-emerald-600">+{totalAdditions}</span>
            {" "}
            <span className="text-red-500">−{totalDeletions}</span>
          </span>
        ) : null}

        {previewUrl ? (
          <a
            href={previewUrl}
            target="_blank"
            rel="noreferrer"
            className="ml-auto rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700"
          >
            Preview ↗
          </a>
        ) : null}
      </div>

      {risk?.level === "high" && risk.highRiskFiles.length > 0 ? (
        <p className="rounded-xl bg-red-50 px-3 py-2 text-xs text-red-700">
          High-risk files: {risk.highRiskFiles.slice(0, 4).join(", ")}
          {risk.highRiskFiles.length > 4 ? ` +${risk.highRiskFiles.length - 4} more` : ""}
        </p>
      ) : null}

      {/* ── Primary actions ───────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => setFilesOpen((o) => !o)}
          className="min-h-10 rounded-xl border border-slate-200 px-3 text-sm font-semibold text-slate-700 active:bg-slate-50"
        >
          {filesOpen ? "Hide files" : "View files"}
        </button>
        <button
          type="button"
          onClick={handleMerge}
          disabled={mergeStep === "merging" || mergeStep === "merged" || closeStep === "closed"}
          className={`min-h-10 rounded-xl px-3 text-sm font-semibold transition ${mergeClass} disabled:cursor-not-allowed`}
        >
          {mergeLabel}
        </button>
      </div>

      {mergeStep === "error" && mergeError ? (
        <p className="rounded-xl bg-red-50 px-3 py-2 text-xs text-red-700">{mergeError}</p>
      ) : null}

      {/* ── Files list ────────────────────────────────────────────────── */}
      {filesOpen && files !== null ? (
        <div className="rounded-xl border border-slate-100 bg-slate-50 p-3">
          {files.length > 0 ? (
            <ul className="space-y-1">
              {files.map((file) => (
                <li key={file.filename} className="flex items-center gap-2 text-xs text-slate-700">
                  <span className={
                    file.status === "added" ? "text-emerald-600" :
                    file.status === "removed" ? "text-red-500" :
                    file.status === "renamed" ? "text-amber-500" : "text-blue-500"
                  }>
                    {file.status === "added" ? "+" : file.status === "removed" ? "−" : file.status === "renamed" ? "→" : "~"}
                  </span>
                  <span className="break-all font-mono">{file.filename}</span>
                  <span className="ml-auto shrink-0 text-slate-400">+{file.additions} −{file.deletions}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-slate-500">No files found.</p>
          )}
        </div>
      ) : null}

      {/* ── Follow-up actions ─────────────────────────────────────────── */}
      <button
        type="button"
        onClick={() => { setFollowupOpen((o) => !o); setActionResult(null); }}
        className="flex w-full items-center justify-between rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-semibold text-slate-700 active:bg-slate-50"
      >
        <span>Follow-up actions</span>
        <span className="text-slate-400">{followupOpen ? "▲" : "▼"}</span>
      </button>

      {followupOpen ? (
        <div className="space-y-2 rounded-xl border border-slate-100 bg-slate-50 p-3">
          <div className="grid grid-cols-2 gap-2">
            {FOLLOW_UP_ACTIONS.filter((a) => !a.fullWidth).map(({ action, label }) => (
              <button
                key={action}
                type="button"
                onClick={() => handleFollowUp(action)}
                disabled={actioning !== null}
                className="min-h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 disabled:cursor-not-allowed disabled:opacity-50 active:bg-slate-100"
              >
                {actioning === action ? "…" : label}
              </button>
            ))}
          </div>
          {FOLLOW_UP_ACTIONS.filter((a) => a.fullWidth).map(({ action, label }) => (
            <button
              key={action}
              type="button"
              onClick={() => handleFollowUp(action)}
              disabled={actioning !== null}
              className="min-h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 disabled:cursor-not-allowed disabled:opacity-50 active:bg-slate-100"
            >
              {actioning === action ? "…" : label}
            </button>
          ))}
        </div>
      ) : null}

      {/* ── Recovery actions ──────────────────────────────────────────── */}
      <button
        type="button"
        onClick={() => { setRecoveryOpen((o) => !o); setActionResult(null); }}
        className="flex w-full items-center justify-between rounded-xl border border-red-100 px-3 py-2.5 text-sm font-semibold text-red-700 active:bg-red-50"
      >
        <span>Recovery actions</span>
        <span className="text-red-400">{recoveryOpen ? "▲" : "▼"}</span>
      </button>

      {recoveryOpen ? (
        <div className="space-y-2 rounded-xl border border-red-100 bg-red-50 p-3">
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={handleClose}
              disabled={closeStep === "closing" || closeStep === "closed"}
              className={`min-h-10 rounded-xl px-3 text-sm font-semibold transition ${closeClass} disabled:cursor-not-allowed`}
            >
              {closeLabel}
            </button>
            <button
              type="button"
              onClick={handleReduceDiff}
              disabled={actioning === "make_smaller_diff"}
              className="min-h-10 rounded-xl border border-red-200 px-3 text-sm font-semibold text-red-700 disabled:cursor-not-allowed disabled:opacity-50 active:bg-red-100"
            >
              {actioning === "make_smaller_diff" ? "…" : "Ask to Reduce Diff"}
            </button>
          </div>
          {closeStep === "error" && closeError ? (
            <p className="rounded-xl bg-white px-3 py-2 text-xs text-red-700">{closeError}</p>
          ) : null}
          <button
            type="button"
            onClick={() => handleFollowUp("start_over")}
            disabled={actioning !== null}
            className="min-h-10 w-full rounded-xl border border-red-200 bg-white px-3 text-sm font-semibold text-red-700 disabled:cursor-not-allowed disabled:opacity-50 active:bg-red-100"
          >
            {actioning === "start_over" ? "…" : "Create Replacement Task"}
          </button>
        </div>
      ) : null}

      {/* ── Action result ─────────────────────────────────────────────── */}
      {actionResult ? (
        <div className="rounded-xl border border-slate-200 bg-white p-3 text-sm text-slate-700">
          <p className="font-semibold">{actionResult.message}</p>
          {actionResult.issueUrl ? (
            <a
              href={actionResult.issueUrl}
              target="_blank"
              rel="noreferrer"
              className="mt-1 block text-sm font-semibold text-brand"
            >
              Open issue ↗
            </a>
          ) : null}
          {actionResult.cursorPrompt ? (
            <button
              type="button"
              onClick={async () => {
                await navigator.clipboard.writeText(actionResult.cursorPrompt!);
                setCopiedCursorPrompt(true);
              }}
              className="mt-2 min-h-10 w-full rounded-xl border border-slate-200 px-3 text-sm font-semibold text-slate-700 active:bg-slate-50"
            >
              {copiedCursorPrompt ? "Copied ✓" : "Copy Cursor Prompt"}
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
