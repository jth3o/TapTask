"use client";

import { useEffect, useState } from "react";
import { generateClaudeSetupIssue } from "@/lib/generateIssue";
import { AgentReadiness } from "@/lib/types";
import { ErrorState } from "./ErrorState";
import { LoadingState } from "./LoadingState";

type AgentReadinessCardProps = {
  repoFullName: string;
};

type CreatedIssueResponse = {
  issue?: {
    number: number;
    htmlUrl: string;
  };
  error?: string;
};

export function AgentReadinessCard({ repoFullName }: AgentReadinessCardProps) {
  const [readiness, setReadiness] = useState<AgentReadiness | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [creatingSetupIssue, setCreatingSetupIssue] = useState(false);
  const [setupIssueUrl, setSetupIssueUrl] = useState("");

  useEffect(() => {
    if (!repoFullName) return;

    let cancelled = false;

    async function loadReadiness() {
      setLoading(true);
      setError("");
      setSetupIssueUrl("");

      try {
        const response = await fetch(`/api/github/agent-readiness?repoFullName=${encodeURIComponent(repoFullName)}`);
        const data = (await response.json()) as AgentReadiness & { error?: string };

        if (!response.ok) {
          throw new Error(data.error || "Unable to check agent readiness.");
        }

        if (!cancelled) {
          setReadiness(data);
        }
      } catch (readinessError) {
        if (!cancelled) {
          setReadiness(null);
          setError(readinessError instanceof Error ? readinessError.message : "Unable to check agent readiness.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadReadiness();

    return () => {
      cancelled = true;
    };
  }, [repoFullName]);

  const createSetupIssue = async () => {
    const setupIssue = generateClaudeSetupIssue(repoFullName);
    setCreatingSetupIssue(true);
    setError("");

    try {
      const response = await fetch("/api/github/issues", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          repoFullName,
          title: setupIssue.title,
          body: setupIssue.body
        })
      });
      const data = (await response.json()) as CreatedIssueResponse;

      if (!response.ok || !data.issue) {
        throw new Error(data.error || "Unable to create Claude setup issue.");
      }

      setSetupIssueUrl(data.issue.htmlUrl);
    } catch (setupError) {
      setError(setupError instanceof Error ? setupError.message : "Unable to create Claude setup issue.");
    } finally {
      setCreatingSetupIssue(false);
    }
  };

  if (loading) {
    return <LoadingState message="Checking agent readiness..." />;
  }

  const claudeConnected = readiness?.claude.connected ?? false;
  const claudeStatusLabel = claudeConnected ? "Connected" : "Needs setup";
  const claudeMessage = !readiness
    ? ""
    : !claudeConnected
      ? "Claude is not connected for this repo yet. TapTask can create GitHub issues, but no AI agent will code until a Claude workflow is installed."
      : readiness.claude.confidence === "high"
        ? "Claude workflow detected. TapTask can attempt @claude dispatch."
        : "Claude workflow file found, but setup may still fail if secrets or workflow permissions are missing.";

  return (
    <section className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Agent Readiness</p>
        <h2 className="mt-1 text-lg font-semibold text-slate-900">Repo agent connections</h2>
      </div>

      <ErrorState message={error} />

      {readiness ? (
        <div className="space-y-3">
          <div className={claudeConnected ? "rounded-xl bg-emerald-50 p-3 text-emerald-800" : "rounded-xl bg-amber-50 p-3 text-amber-800"}>
            <p className="text-xs font-semibold uppercase tracking-wide">{claudeStatusLabel}</p>
            <p className="text-sm font-bold">Claude</p>
            <p className="mt-1 text-sm">{claudeMessage}</p>
            {readiness.claude.workflowPath ? (
              <p className="mt-1 text-xs">Workflow: {readiness.claude.workflowPath}</p>
            ) : null}
            <p className="mt-1 text-xs">Confidence: {readiness.claude.confidence}</p>
          </div>

          <div className="grid grid-cols-2 gap-2 text-xs text-slate-600">
            <div className="rounded-xl border border-slate-200 p-3">
              <p className="font-semibold text-slate-900">Cursor</p>
              <p className="mt-1 font-semibold text-slate-500">Future integration</p>
              <p className="mt-1">{readiness.cursor.notes[0]}</p>
            </div>
            <div className="rounded-xl border border-slate-200 p-3">
              <p className="font-semibold text-slate-900">Codex</p>
              <p className="mt-1 font-semibold text-slate-500">Future integration</p>
              <p className="mt-1">{readiness.codex.notes[0]}</p>
            </div>
          </div>

          {!claudeConnected ? (
            <button
              type="button"
              onClick={createSetupIssue}
              disabled={creatingSetupIssue}
              className="min-h-12 w-full rounded-xl bg-slate-900 px-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
            >
              {creatingSetupIssue ? "Creating..." : "Create Claude Setup Issue"}
            </button>
          ) : null}

          {setupIssueUrl ? (
            <a className="block rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm font-semibold text-emerald-700" href={setupIssueUrl} target="_blank" rel="noreferrer">
              Open Claude setup issue
            </a>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
