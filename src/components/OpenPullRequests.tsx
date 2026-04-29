"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { findMatchingPullForTask } from "@/lib/prMatching";
import { GitHubPullRequest, SentTask } from "@/lib/types";
import { ErrorState } from "./ErrorState";
import { LoadingState } from "./LoadingState";
import { PrActionsCard } from "./PrActionsCard";
import { PullCommandCard, pullCommands } from "./PullCommandCard";

const POLL_INTERVAL_MS = 15_000;

type OpenPullRequestsProps = {
  repoFullName: string;
  sentTasks?: SentTask[];
  codexEnabled?: boolean;
  pollWhenActive?: boolean;
};

export function OpenPullRequests({
  repoFullName,
  sentTasks = [],
  codexEnabled = false,
  pollWhenActive = false
}: OpenPullRequestsProps) {
  const [pulls, setPulls] = useState<GitHubPullRequest[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [copiedBranch, setCopiedBranch] = useState("");
  const [codexReviewing, setCodexReviewing] = useState<number | null>(null);
  const [codexReviewed, setCodexReviewed] = useState<number | null>(null);
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadPulls = useCallback(async (showSpinner = false) => {
    if (!repoFullName) {
      setPulls([]);
      return;
    }
    if (showSpinner) setLoading(true);
    setError("");

    try {
      const response = await fetch(`/api/github/pulls?repoFullName=${encodeURIComponent(repoFullName)}`);
      const data = (await response.json()) as { pulls?: GitHubPullRequest[]; error?: string };

      if (!response.ok) {
        throw new Error(data.error ?? "Unable to load open pull requests.");
      }

      setPulls(data.pulls ?? []);
      setLastRefreshed(new Date());
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load open pull requests.");
    } finally {
      setLoading(false);
    }
  }, [repoFullName]);

  useEffect(() => {
    if (!repoFullName) {
      setPulls([]);
      return;
    }
    void loadPulls(true);
  }, [repoFullName, loadPulls]);

  useEffect(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    if (pollWhenActive && repoFullName) {
      intervalRef.current = setInterval(() => {
        void loadPulls(false);
      }, POLL_INTERVAL_MS);
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [pollWhenActive, repoFullName, loadPulls]);

  const copyCommands = async (pull: GitHubPullRequest) => {
    await navigator.clipboard.writeText(pullCommands(pull.headBranch));
    setCopiedBranch(pull.headBranch);
  };

  const requestCodexReview = async (pull: GitHubPullRequest) => {
    setCodexReviewing(pull.number);
    setError("");

    try {
      const response = await fetch("/api/github/pulls/codex-review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ repoFullName, pullNumber: pull.number })
      });
      const data = (await response.json()) as { error?: string };

      if (!response.ok) {
        throw new Error(data.error ?? "Unable to request Codex review.");
      }

      setCodexReviewed(pull.number);
    } catch (reviewError) {
      setError(reviewError instanceof Error ? reviewError.message : "Unable to request Codex review.");
    } finally {
      setCodexReviewing(null);
    }
  };

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Open PRs</h2>
          {pollWhenActive ? (
            <p className="text-xs text-blue-600">Watching for new PRs every 15s…</p>
          ) : (
            <p className="text-sm text-slate-600">Pull branches locally when you are ready to test.</p>
          )}
        </div>
        <button
          type="button"
          onClick={() => loadPulls(true)}
          disabled={loading}
          className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 disabled:cursor-not-allowed disabled:opacity-50 active:bg-slate-50"
        >
          {loading ? "…" : "Refresh"}
        </button>
      </div>

      {lastRefreshed && pollWhenActive ? (
        <p className="text-xs text-slate-400">
          Last checked {lastRefreshed.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
        </p>
      ) : null}

      {loading && pulls.length === 0 ? <LoadingState message="Loading open pull requests..." /> : null}
      <ErrorState message={error} />

      {!loading && !error && pulls.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-300 p-3 text-sm text-slate-600">
          {pollWhenActive ? "No PRs yet — checking automatically…" : "No open PRs for this repo."}
        </p>
      ) : null}

      <div className="space-y-3">
        {pulls.map((pull) => (
          <article key={pull.number} className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div>
              <a className="text-sm font-bold text-slate-900" href={pull.htmlUrl} target="_blank" rel="noreferrer">
                #{pull.number} {pull.title}
              </a>
              <p className="mt-1 text-xs text-slate-500">
                {pull.draft ? "Draft" : "Open"} · {pull.userLogin} · {pull.headBranch} → {pull.baseBranch}
              </p>
              {sentTasks.some((task) => findMatchingPullForTask([pull], task)) ? (
                <p className="mt-2 rounded-lg bg-blue-50 px-2 py-1 text-xs font-semibold text-blue-700">
                  Matches a recent TapTask issue
                </p>
              ) : null}
            </div>

            <PullCommandCard branch={pull.headBranch} copied={copiedBranch === pull.headBranch} onCopy={() => copyCommands(pull)} />

            <PrActionsCard
              repoFullName={repoFullName}
              pull={pull}
              onMerged={() => loadPulls(false)}
              onClosed={() => loadPulls(false)}
            />

            {codexEnabled ? (
              <button
                type="button"
                onClick={() => requestCodexReview(pull)}
                disabled={codexReviewing === pull.number}
                className="min-h-11 w-full rounded-xl bg-slate-900 px-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
              >
                {codexReviewed === pull.number
                  ? "Codex Review Requested"
                  : codexReviewing === pull.number
                    ? "Requesting..."
                    : "Comment @codex review"}
              </button>
            ) : null}
          </article>
        ))}
      </div>
    </section>
  );
}
