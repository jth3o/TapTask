"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ActiveTask, ActiveTaskStatus, CIStatus } from "@/lib/types";
import { patchActiveTask, saveActiveTasks } from "@/lib/taskStorage";
import type { PollResult } from "@/app/api/tasks/poll/route";
import type { MergeResult } from "@/app/api/tasks/merge/route";
import type { FixConflictsResult } from "@/app/api/tasks/fix-conflicts/route";

const POLL_INTERVAL_RUNNING_MS = 20_000;  // poll every 20s while agent is working
const POLL_INTERVAL_PR_OPEN_MS = 60_000;  // poll every 60s once PR is found (CI updates, external merges)

const STATUS_BADGE: Record<ActiveTaskStatus, { label: string; classes: string }> = {
  running:  { label: "Running…",  classes: "bg-blue-100 text-blue-700"    },
  pr_open:  { label: "PR Ready",  classes: "bg-amber-100 text-amber-700"  },
  merged:   { label: "Merged ✓",  classes: "bg-emerald-100 text-emerald-700" },
  failed:   { label: "Failed",    classes: "bg-red-100 text-red-700"      },
  closed:   { label: "Closed",    classes: "bg-slate-100 text-slate-500"  },
};

type Props = {
  tasks: ActiveTask[];
  onTasksChange: (tasks: ActiveTask[]) => void;
  onFollowUp: (task: ActiveTask, note: string) => void;
};

const CI_BADGE: Record<CIStatus, { label: string; classes: string } | null> = {
  pending: { label: "Checks running", classes: "bg-yellow-100 text-yellow-700" },
  success: { label: "Checks passed",  classes: "bg-emerald-100 text-emerald-700" },
  failure: { label: "Checks failed",  classes: "bg-red-100 text-red-700" },
  none:    null,
};

function timeAgo(iso: string) {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

function extractPrNumber(prUrl: string): number | undefined {
  const m = prUrl.match(/\/pull\/(\d+)(?:\/|$)/);
  return m ? parseInt(m[1], 10) : undefined;
}

function TaskRow({
  task,
  onPoll,
  onMerge,
  onMarkReady,
  onFixConflicts,
  onDismiss,
  onFollowUp,
  isPolling,
  isMerging,
  isFixing,
}: {
  task: ActiveTask;
  onPoll: () => void;
  onMerge: () => void;
  onMarkReady: () => void;
  onFixConflicts: () => void;
  onDismiss: () => void;
  onFollowUp: (note: string) => void;
  isPolling: boolean;
  isMerging: boolean;
  isFixing: boolean;
}) {
  const [followUpOpen, setFollowUpOpen] = useState(false);
  const [followUpNote, setFollowUpNote] = useState("");
  const badge = STATUS_BADGE[task.status];
  const isDone = task.status === "merged" || task.status === "failed" || task.status === "closed";
  const hasConflict = !!task.mergeError?.toLowerCase().includes("conflict");
  const isDraft = !!task.prIsDraft;

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-slate-900">{task.issueTitle}</p>
          <p className="mt-0.5 text-xs text-slate-400">
            {task.repoFullName} · {timeAgo(task.startedAt)}
          </p>
        </div>
        <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${badge.classes}`}>
          {isPolling ? "Checking…" : badge.label}
        </span>
      </div>

      {task.lastNote && (
        <p className="mt-2 text-xs text-slate-400">{task.lastNote}</p>
      )}
      {task.mergeError && (
        <p className="mt-1 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">
          {task.mergeError}
        </p>
      )}
      {!task.runId && task.status === "running" && (
        <p className="mt-1 text-xs text-amber-600">
          No Cursor run ID — redispatch this task to enable tracking.
        </p>
      )}

      <div className="mt-2 flex flex-wrap items-center gap-2">
        {task.issueUrl && (
          <a href={task.issueUrl} target="_blank" rel="noreferrer"
            className="text-xs text-blue-600 underline">
            Issue #{task.issueNumber}
          </a>
        )}
        {task.prUrl && (
          <a href={task.prUrl} target="_blank" rel="noreferrer"
            className="text-xs text-blue-600 underline">
            PR #{task.prNumber}
          </a>
        )}
        {task.ciStatus && task.ciStatus !== "none" && (() => {
          const ci = CI_BADGE[task.ciStatus!];
          if (!ci) return null;
          return (
            <a href={task.ciUrl ?? task.prUrl ?? "#"} target="_blank" rel="noreferrer"
              className={`rounded-full px-2 py-0.5 text-xs font-semibold ${ci.classes}`}>
              {ci.label}
            </a>
          );
        })()}

        <div className="ml-auto flex items-center gap-2">
          {task.status === "pr_open" && (task.prNumber || task.prUrl) && !hasConflict && !isDraft && (
            <button
              type="button"
              onClick={onMerge}
              disabled={isMerging}
              title={task.ciStatus === "failure" ? "Checks are failing — merge anyway?" : undefined}
              className={`rounded-lg px-3 py-1 text-xs font-semibold text-white disabled:opacity-50 ${
                task.ciStatus === "failure"
                  ? "bg-amber-500 active:bg-amber-600"
                  : "bg-emerald-600 active:bg-emerald-700"
              }`}
            >
              {isMerging ? "Merging…" : task.ciStatus === "failure" ? "Merge anyway" : "Merge to main"}
            </button>
          )}
          {isDraft && task.prNumber && (
            <button
              type="button"
              onClick={onMarkReady}
              disabled={isMerging}
              className="rounded-lg bg-emerald-600 px-3 py-1 text-xs font-semibold text-white disabled:opacity-50 active:bg-emerald-700"
            >
              {isMerging ? "Merging…" : "Mark Ready & Merge"}
            </button>
          )}
          {task.status === "pr_open" && !task.prNumber && !task.prUrl && !hasConflict && (
            <a href={`https://github.com/${task.repoFullName}/pulls`} target="_blank" rel="noreferrer"
              className="rounded-lg bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
              View PRs on GitHub
            </a>
          )}
          {hasConflict && task.prNumber && (
            <button
              type="button"
              onClick={onFixConflicts}
              disabled={isFixing}
              className="rounded-lg bg-violet-600 px-3 py-1 text-xs font-semibold text-white disabled:opacity-50 active:bg-violet-700"
            >
              {isFixing ? "Starting…" : "Fix with AI"}
            </button>
          )}
          {!isDone && (
            <button type="button" onClick={onPoll}
              className="text-xs text-slate-400 underline hover:text-slate-600">
              Refresh
            </button>
          )}
          {isDone && task.status !== "merged" && (
            <button type="button" onClick={onDismiss}
              className="text-xs text-slate-400 hover:text-slate-600">
              Dismiss
            </button>
          )}
        </div>
      </div>

      {task.status === "merged" && !followUpOpen && (
        <div className="mt-2 flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2">
          <span className="flex-1 text-xs text-slate-500">Did this ship well for the active cycle?</span>
          <button type="button" onClick={onDismiss}
            className="text-xs font-semibold text-emerald-600 hover:text-emerald-700">
            ✓ Yes
          </button>
          <button type="button" onClick={() => setFollowUpOpen(true)}
            className="text-xs font-semibold text-amber-600 hover:text-amber-700">
            Needs work
          </button>
        </div>
      )}
      {followUpOpen && (
        <div className="mt-2 space-y-2">
          <textarea
            className="w-full resize-none rounded-lg border border-slate-200 px-2.5 py-2 text-xs text-slate-700 outline-none focus:border-brand"
            rows={2}
            placeholder="What's missing or needs improvement?"
            value={followUpNote}
            onChange={(e) => setFollowUpNote(e.target.value)}
            autoFocus
          />
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => { onFollowUp(followUpNote); setFollowUpOpen(false); onDismiss(); }}
              disabled={!followUpNote.trim()}
              className="rounded-lg bg-brand px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-40"
            >
              → Send follow-up
            </button>
            <button type="button" onClick={() => setFollowUpOpen(false)}
              className="text-xs text-slate-400 hover:text-slate-600">
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export function ActiveTasksPanel({ tasks, onTasksChange, onFollowUp }: Props) {
  const [open, setOpen] = useState(false);
  const [polling, setPolling]   = useState<Set<string>>(new Set());
  const [merging, setMerging]   = useState<Set<string>>(new Set());
  const [fixing, setFixing]     = useState<Set<string>>(new Set());
  const tasksRef = useRef(tasks);
  tasksRef.current = tasks;

  const mergeTask = useCallback(async (task: ActiveTask, markReady = false) => {
    const prNum = task.prNumber ?? extractPrNumber(task.prUrl ?? "");
    if (!prNum) return;
    setMerging((s) => new Set(s).add(task.id));
    try {
      const res = await fetch("/api/tasks/merge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          repoFullName: task.repoFullName,
          prNumber:     prNum,
          prTitle:      task.issueTitle,
          markReady,
        }),
      });
      const result = (await res.json()) as MergeResult;

      if (result.merged) {
        const next = patchActiveTask(task.id, { status: "merged", mergeError: undefined, seen: false });
        onTasksChange(next);
      } else {
        const errMsg = result.error ?? "Merge returned false.";
        const isGone  = errMsg.includes("404") || errMsg.toLowerCase().includes("not found");
        const isDraft = errMsg.toLowerCase().includes("draft");
        const next = patchActiveTask(task.id, {
          status:     isGone ? "failed" : task.status,
          prIsDraft:  isDraft ? true : task.prIsDraft,
          mergeError: (isGone || isDraft) ? undefined : errMsg,
          lastNote:   isGone  ? "Repository or PR not found — it may have been deleted."
                    : isDraft ? "PR is a draft — use \"Mark Ready & Merge\" to publish and merge it."
                    : task.lastNote,
          seen: isGone ? false : task.seen,
        });
        onTasksChange(next);
      }
    } catch (err) {
      const next = patchActiveTask(task.id, {
        mergeError: err instanceof Error ? err.message : "Merge failed.",
      });
      onTasksChange(next);
    } finally {
      setMerging((s) => { const n = new Set(s); n.delete(task.id); return n; });
    }
  }, [onTasksChange]);

  const pollTask = useCallback(async (task: ActiveTask) => {
    if (task.status === "merged" || task.status === "failed" || task.status === "closed") return;

    setPolling((s) => new Set(s).add(task.id));
    try {
      const res = await fetch("/api/tasks/poll", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          repoFullName: task.repoFullName,
          issueNumber:  task.issueNumber,
          prNumber:     task.prNumber,
          branch:       task.branch,
          startedAt:    task.startedAt,
          runId:        task.runId,
          agentId:      task.agentId,
        }),
      });
      if (!res.ok) {
        try {
          const errBody = (await res.json()) as { error?: string };
          if (errBody.error) {
            const next = patchActiveTask(task.id, { lastNote: `Poll error: ${errBody.error}` });
            onTasksChange(next);
          }
        } catch { /* ignore parse errors */ }
        return;
      }

      const result = (await res.json()) as PollResult;
      const patch: Partial<ActiveTask> = {
        status: result.status,
        lastNote: result.note,
        mergeError: undefined,
      };
      if (result.prNumber)               patch.prNumber  = result.prNumber;
      if (result.prUrl)                  patch.prUrl     = result.prUrl;
      if (result.branch)                 patch.branch    = result.branch;
      if (result.prIsDraft !== undefined) patch.prIsDraft = result.prIsDraft;
      if (result.ciStatus)               patch.ciStatus  = result.ciStatus;
      if (result.ciUrl)                  patch.ciUrl     = result.ciUrl;

      // Show badge when status changes to pr_open, merged, or failed
      if (result.status !== task.status &&
          (result.status === "pr_open" || result.status === "merged" || result.status === "failed")) {
        patch.seen = false;
      }

      const next = patchActiveTask(task.id, patch);
      onTasksChange(next);

      // Auto-merge when CI passes (or when there's no CI at all)
      const prNum = result.prNumber ?? task.prNumber ?? extractPrNumber(task.prUrl ?? "");
      const ciGreen = result.ciStatus === "success" || result.ciStatus === "none";
      if (result.status === "pr_open" && ciGreen && !result.prIsDraft && prNum) {
        const updatedTask = next.find((t) => t.id === task.id);
        if (updatedTask) void mergeTask(updatedTask);
      }
    } finally {
      setPolling((s) => { const n = new Set(s); n.delete(task.id); return n; });
    }
  }, [onTasksChange, mergeTask]);

  const fixConflicts = useCallback(async (task: ActiveTask) => {
    const prNum = task.prNumber ?? extractPrNumber(task.prUrl ?? "");
    if (!prNum) return;
    setFixing((s) => new Set(s).add(task.id));
    try {
      const res = await fetch("/api/tasks/fix-conflicts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          repoFullName: task.repoFullName,
          prNumber:     prNum,
        }),
      });
      const result = (await res.json()) as FixConflictsResult & { error?: string };
      if (!res.ok || result.error) {
        const next = patchActiveTask(task.id, { mergeError: result.error ?? "Failed to start AI fix." });
        onTasksChange(next);
        return;
      }
      // Update the task: new runId/agentId for the conflict-fix agent, back to running
      const next = patchActiveTask(task.id, {
        status: "running",
        runId: result.cursorRun.runId,
        agentId: result.cursorRun.agentId,
        mergeError: undefined,
        lastNote: "AI agent is resolving merge conflicts…",
        seen: true,
      });
      onTasksChange(next);
    } finally {
      setFixing((s) => { const n = new Set(s); n.delete(task.id); return n; });
    }
  }, [onTasksChange]);

  // Poll on mount + separate intervals for running vs pr_open
  useEffect(() => {
    const pollRunning = () => tasksRef.current
      .filter((t) => t.status === "running")
      .forEach((t) => void pollTask(t));
    const pollPrOpen = () => tasksRef.current
      .filter((t) => t.status === "pr_open")
      .forEach((t) => void pollTask(t));

    // Poll all on mount
    pollRunning();
    pollPrOpen();

    const runningId = setInterval(pollRunning, POLL_INTERVAL_RUNNING_MS);
    const prOpenId  = setInterval(pollPrOpen,  POLL_INTERVAL_PR_OPEN_MS);
    return () => { clearInterval(runningId); clearInterval(prOpenId); };
  }, [pollTask]);

  // Immediately poll newly-added tasks
  const prevIdsRef = useRef(new Set(tasks.map((t) => t.id)));
  useEffect(() => {
    tasks.forEach((t) => {
      if (!prevIdsRef.current.has(t.id) && (t.status === "running" || t.status === "pr_open")) {
        void pollTask(t);
      }
    });
    prevIdsRef.current = new Set(tasks.map((t) => t.id));
  }, [tasks, pollTask]);

  const handleOpen = () => {
    setOpen((o) => {
      if (!o) {
        const next = tasksRef.current.map((t) => ({ ...t, seen: true }));
        saveActiveTasks(next);
        // Defer parent update — calling setState on HomePage inside setOpen's updater causes React error
        setTimeout(() => onTasksChange(next), 0);
      }
      return !o;
    });
  };

  const handleDismiss = (id: string) => {
    const next = tasksRef.current.filter((t) => t.id !== id);
    saveActiveTasks(next);
    onTasksChange(next);
  };

  if (tasks.length === 0) return null;

  const activeCount  = tasks.filter((t) => t.status === "running" || t.status === "pr_open").length;
  const unseenCount  = tasks.filter((t) => !t.seen && (t.status === "merged" || t.status === "failed")).length;
  const prReadyCount = tasks.filter((t) => t.status === "pr_open").length;

  return (
    <section className="px-4">
      <button
        type="button"
        onClick={handleOpen}
        className="flex w-full items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 shadow-sm active:bg-slate-50"
      >
        <span className="flex items-center gap-2">
          Agent Tasks
          {activeCount > 0 && (
            <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-semibold text-blue-700">
              {activeCount} running
            </span>
          )}
          {prReadyCount > 0 && (
            <span className="rounded-full bg-amber-400 px-2 py-0.5 text-xs font-bold text-white">
              {prReadyCount} ready to merge
            </span>
          )}
          {unseenCount > 0 && (
            <span className="rounded-full bg-emerald-500 px-2 py-0.5 text-xs font-bold text-white">
              {unseenCount} merged
            </span>
          )}
        </span>
        <span className="text-slate-400">{open ? "▲" : "▼"}</span>
      </button>

      {open && (
        <div className="mt-2 space-y-2">
          {tasks.map((task) => (
            <TaskRow
              key={task.id}
              task={task}
              isPolling={polling.has(task.id)}
              isMerging={merging.has(task.id)}
              isFixing={fixing.has(task.id)}
              onPoll={() => void pollTask(task)}
              onMerge={() => void mergeTask(task)}
              onMarkReady={() => void mergeTask(task, true)}
              onFixConflicts={() => void fixConflicts(task)}
              onDismiss={() => handleDismiss(task.id)}
              onFollowUp={(note) => onFollowUp(task, note)}
            />
          ))}
        </div>
      )}
    </section>
  );
}
