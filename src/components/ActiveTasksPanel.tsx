"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ActiveTask, ActiveTaskStatus, CIStatus, QueuedTaskPayload, SendTaskResponse } from "@/lib/types";
import { patchActiveTask, saveActiveTasks } from "@/lib/taskStorage";
import { loadFeatures, saveFeatures } from "@/lib/ideaStorage";
import type { PollResult } from "@/app/api/tasks/poll/route";
import type { MergeResult } from "@/app/api/tasks/merge/route";
import type { FixConflictsResult } from "@/app/api/tasks/fix-conflicts/route";

const POLL_INTERVAL_RUNNING_MS = 60_000;  // poll every 60s while agent is working

const STATUS_BADGE: Record<ActiveTaskStatus, { label: string; classes: string }> = {
  queued:   { label: "Queued",    classes: "bg-slate-100 text-slate-500"  },
  running:  { label: "Running…",  classes: "bg-blue-100 text-blue-700"    },
  pr_open:  { label: "PR Ready",  classes: "bg-amber-100 text-amber-700"  },
  merged:   { label: "Merged ✓",  classes: "bg-emerald-100 text-emerald-700" },
  failed:   { label: "Failed",    classes: "bg-red-100 text-red-700"      },
  closed:   { label: "Closed",    classes: "bg-slate-100 text-slate-500"  },
};

type Props = {
  tasks: ActiveTask[];
  onTasksChange: (tasks: ActiveTask[]) => void;
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
  isPolling: boolean;
  isMerging: boolean;
  isFixing: boolean;
}) {
  const badge = STATUS_BADGE[task.status];
  const isQueued = task.status === "queued";
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

      {isQueued && (
        <p className="mt-2 text-xs text-slate-400">Waiting for the current task to finish before dispatching.</p>
      )}
      {!isQueued && task.lastNote && (
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
        {!isQueued && task.issueUrl && (
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
          {isQueued && (
            <button type="button" onClick={onDismiss}
              className="text-xs text-slate-400 hover:text-slate-600">
              Remove from queue
            </button>
          )}
          {!isQueued && task.status === "pr_open" && (task.prNumber || task.prUrl) && !hasConflict && !isDraft && (
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
          {!isQueued && isDraft && task.prNumber && (
            <button
              type="button"
              onClick={onMarkReady}
              disabled={isMerging}
              className="rounded-lg bg-emerald-600 px-3 py-1 text-xs font-semibold text-white disabled:opacity-50 active:bg-emerald-700"
            >
              {isMerging ? "Merging…" : "Mark Ready & Merge"}
            </button>
          )}
          {!isQueued && task.status === "pr_open" && !task.prNumber && !task.prUrl && !hasConflict && (
            <a href={`https://github.com/${task.repoFullName}/pulls`} target="_blank" rel="noreferrer"
              className="rounded-lg bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
              View PRs on GitHub
            </a>
          )}
          {!isQueued && hasConflict && task.prNumber && (
            <button
              type="button"
              onClick={onFixConflicts}
              disabled={isFixing}
              className="rounded-lg bg-violet-600 px-3 py-1 text-xs font-semibold text-white disabled:opacity-50 active:bg-violet-700"
            >
              {isFixing ? "Starting…" : "Fix with AI"}
            </button>
          )}
          {!isQueued && !isDone && (
            <button type="button" onClick={onPoll}
              className="text-xs text-slate-400 underline hover:text-slate-600">
              Refresh
            </button>
          )}
          {!isQueued && !isDone && (
            <button type="button" onClick={onDismiss}
              className="text-xs text-slate-400 hover:text-slate-600">
              Cancel
            </button>
          )}
          {!isQueued && isDone && (
            <button type="button" onClick={onDismiss}
              className="text-xs text-slate-400 hover:text-slate-600">
              Dismiss
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function resetFeatureToTodo(sourceItemId: string | undefined) {
  if (!sourceItemId) return;
  const features = loadFeatures();
  const idx = features.findIndex((f) => f.id === sourceItemId);
  if (idx !== -1 && features[idx].status === "in_progress") {
    features[idx] = { ...features[idx], status: "backlog", updatedAt: new Date().toISOString() };
    saveFeatures(features);
  }
}

export function ActiveTasksPanel({ tasks, onTasksChange }: Props) {
  const [open, setOpen] = useState(false);
  const [polling, setPolling]       = useState<Set<string>>(new Set());
  const [merging, setMerging]       = useState<Set<string>>(new Set());
  const [fixing, setFixing]         = useState<Set<string>>(new Set());
  const [dispatching, setDispatching] = useState<Set<string>>(new Set());
  const tasksRef = useRef(tasks);
  tasksRef.current = tasks;

  const dispatchQueued = useCallback(async (task: ActiveTask) => {
    if (!task.queuedPayload || dispatching.has(task.id)) return;
    setDispatching((s) => new Set(s).add(task.id));
    try {
      const { endpoint, body } = task.queuedPayload as QueuedTaskPayload;
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const errBody = (await res.json()) as { error?: string };
        resetFeatureToTodo(task.sourceItemId);
        const next = patchActiveTask(task.id, { status: "failed", lastNote: errBody.error ?? "Dispatch failed." });
        onTasksChange(next);
        return;
      }
      const data = (await res.json()) as SendTaskResponse;
      const now = new Date().toISOString();
      if (data.dispatchStatus !== "cursor_run_started") resetFeatureToTodo(task.sourceItemId);
      const next = patchActiveTask(task.id, {
        status: data.dispatchStatus === "cursor_run_started" ? "running" : "failed",
        issueNumber: data.issueNumber,
        issueUrl: data.issueUrl,
        issueTitle: data.issueTitle ?? task.issueTitle,
        runId: data.cursorRun?.runId,
        agentId: data.cursorRun?.agentId,
        branch: data.cursorRun?.branch,
        queuedPayload: undefined,
        startedAt: now,
        lastNote: data.dispatchStatus === "cursor_run_started" ? "Dispatched automatically from queue." : (data.message ?? "Dispatch failed."),
      });
      onTasksChange(next);
    } finally {
      setDispatching((s) => { const n = new Set(s); n.delete(task.id); return n; });
    }
  }, [dispatching, onTasksChange]);

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
        // Surface server errors (e.g. repo deleted → 500) as a note
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

      // If the poll returned a PR number that another task already owns, ignore
      // it — this prevents the time-based fallback from claiming the same PR
      // for multiple tasks running against the same repo.
      if (result.prNumber && !task.prNumber) {
        const alreadyClaimed = tasksRef.current.some(
          (t) => t.id !== task.id && t.prNumber === result.prNumber
        );
        if (alreadyClaimed) {
          return; // stay "running" until this task's PR explicitly references its issue
        }
      }

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
        if (result.status === "failed") resetFeatureToTodo(task.sourceItemId);
      }

      const next = patchActiveTask(task.id, patch);
      onTasksChange(next);

      const updatedTask = { ...task, ...patch };

      if (result.status === "merged" && task.sourceItemId) {
        const features = loadFeatures();
        const idx = features.findIndex((f) => f.id === task.sourceItemId);
        if (idx !== -1) {
          features[idx] = {
            ...features[idx],
            status: "done",
            prUrl: result.prUrl ?? task.prUrl ?? features[idx].prUrl,
            updatedAt: new Date().toISOString(),
          };
          saveFeatures(features);
        }
      }

      // Auto-merge: if CI passed (or no CI configured) and task has autoMerge enabled
      if (result.status === "pr_open" && (result.ciStatus === "success" || result.ciStatus === "none" || result.ciStatus === undefined) && task.autoMerge) {
        void mergeTask(updatedTask as ActiveTask, true);
        return;
      }

      // Queue advance: when this task merged, dispatch the next queued task for the same repo
      if (result.status === "merged") {
        const nextQueued = tasksRef.current.find(
          (t) => t.status === "queued" && t.repoFullName === task.repoFullName
        );
        if (nextQueued) void dispatchQueued(nextQueued);
      }
    } finally {
      setPolling((s) => { const n = new Set(s); n.delete(task.id); return n; });
    }
  }, [onTasksChange, dispatchQueued]);

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
        if (task.sourceItemId) {
          const features = loadFeatures();
          const idx = features.findIndex((f) => f.id === task.sourceItemId);
          if (idx !== -1) {
            features[idx] = {
              ...features[idx],
              status: "done",
              prUrl: task.prUrl ?? features[idx].prUrl,
              updatedAt: new Date().toISOString(),
            };
            saveFeatures(features);
          }
        }
        // Dispatch the next queued task for the same repo
        const nextQueued = tasksRef.current.find(
          (t) => t.status === "queued" && t.repoFullName === task.repoFullName
        );
        if (nextQueued) void dispatchQueued(nextQueued);
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
  }, [onTasksChange, dispatchQueued]);

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
  // Also immediately dispatch any queued tasks that are first in line for their repo
  useEffect(() => {
    const reposSeen = new Set<string>();
    tasksRef.current
      .filter((t) => t.status === "running" || t.status === "pr_open")
      .forEach((t) => reposSeen.add(t.repoFullName));
    tasksRef.current
      .filter((t) => t.status === "queued" && !reposSeen.has(t.repoFullName))
      .forEach((t) => { reposSeen.add(t.repoFullName); void dispatchQueued(t); });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const pollRunning = () => tasksRef.current
      .filter((t) => t.status === "running")
      .forEach((t) => void pollTask(t));

    // Poll running tasks on mount and on interval
    pollRunning();

    const runningId = setInterval(pollRunning, POLL_INTERVAL_RUNNING_MS);
    return () => clearInterval(runningId);
  }, [pollTask]);

  // Immediately poll newly-added tasks, and dispatch newly-added queued tasks that have no blocker
  const prevIdsRef = useRef(new Set(tasks.map((t) => t.id)));
  useEffect(() => {
    const newIds = tasks.filter((t) => !prevIdsRef.current.has(t.id));
    newIds.forEach((t) => {
      if (t.status === "running") void pollTask(t);
    });
    // Dispatch any newly-queued tasks that are first in line for their repo
    const activeRepos = new Set(
      tasks.filter((t) => t.status === "running" || t.status === "pr_open").map((t) => t.repoFullName)
    );
    const dispatchedRepos = new Set<string>();
    newIds
      .filter((t) => t.status === "queued" && !activeRepos.has(t.repoFullName))
      .forEach((t) => {
        if (!dispatchedRepos.has(t.repoFullName)) {
          dispatchedRepos.add(t.repoFullName);
          void dispatchQueued(t);
        }
      });
    prevIdsRef.current = new Set(tasks.map((t) => t.id));
  }, [tasks, pollTask, dispatchQueued]);

  // Immediately merge any pr_open tasks that have autoMerge and passing CI
  useEffect(() => {
    tasks
      .filter((t) =>
        t.status === "pr_open" &&
        t.autoMerge &&
        (t.ciStatus === "success" || t.ciStatus === "none") &&
        !merging.has(t.id)
      )
      .forEach((t) => void mergeTask(t, true));
  }, [tasks, merging, mergeTask]);

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
    const task = tasksRef.current.find((t) => t.id === id);
    if (task?.status === "queued") resetFeatureToTodo(task.sourceItemId);
    const next = tasksRef.current.filter((t) => t.id !== id);
    saveActiveTasks(next);
    onTasksChange(next);
  };

  if (tasks.length === 0) return null;

  const activeCount  = tasks.filter((t) => t.status === "running" || t.status === "pr_open").length;
  const queuedCount  = tasks.filter((t) => t.status === "queued").length;
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
          {queuedCount > 0 && (
            <span className="rounded-full bg-slate-200 px-2 py-0.5 text-xs font-semibold text-slate-600">
              {queuedCount} queued
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
            />
          ))}
        </div>
      )}
    </section>
  );
}
