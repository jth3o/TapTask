"use client";

import { useEffect, useState } from "react";
import { generateClaudeSetupIssue } from "@/lib/generateIssue";
import { AgentConnectionSettings, AgentReadiness } from "@/lib/types";
import { ErrorState } from "./ErrorState";
import { LoadingState } from "./LoadingState";

type AgentConnectionsProps = {
  repoFullName: string;
  settings: AgentConnectionSettings;
  onSettingsChange: (settings: AgentConnectionSettings) => void;
};

type CreatedIssueResponse = {
  issue?: {
    number: number;
    htmlUrl: string;
  };
  error?: string;
};

type ClaudeTestResponse = {
  issueUrl?: string;
  status?: string;
  error?: string;
};

function StatusPill({ label, tone }: { label: string; tone: "green" | "amber" | "slate" | "blue" }) {
  const classes = {
    green: "bg-emerald-50 text-emerald-700",
    amber: "bg-amber-50 text-amber-700",
    slate: "bg-slate-100 text-slate-700",
    blue: "bg-blue-50 text-blue-700"
  };

  return <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${classes[tone]}`}>{label}</span>;
}

export function AgentConnections({ repoFullName, settings, onSettingsChange }: AgentConnectionsProps) {
  const [readiness, setReadiness] = useState<AgentReadiness | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [creatingSetupIssue, setCreatingSetupIssue] = useState(false);
  const [testingClaude, setTestingClaude] = useState(false);
  const [setupIssueUrl, setSetupIssueUrl] = useState("");
  const [testIssueUrl, setTestIssueUrl] = useState("");
  const [testStatus, setTestStatus] = useState("");

  useEffect(() => {
    if (!repoFullName) return;
    let cancelled = false;

    async function loadReadiness() {
      setLoading(true);
      setError("");
      setSetupIssueUrl("");
      setTestIssueUrl("");
      setTestStatus("");

      try {
        const response = await fetch(`/api/github/agent-readiness?repoFullName=${encodeURIComponent(repoFullName)}`);
        const data = (await response.json()) as AgentReadiness & { error?: string };

        if (!response.ok) {
          throw new Error(data.error || "Unable to check agent connections.");
        }

        if (!cancelled) {
          setReadiness(data);
        }
      } catch (readinessError) {
        if (!cancelled) {
          setReadiness(null);
          setError(readinessError instanceof Error ? readinessError.message : "Unable to check agent connections.");
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

  const updateSettings = (next: Partial<AgentConnectionSettings>) => {
    onSettingsChange({ ...settings, ...next });
  };

  const createSetupIssue = async () => {
    const setupIssue = generateClaudeSetupIssue(repoFullName);
    setCreatingSetupIssue(true);
    setError("");

    try {
      const response = await fetch("/api/github/issues", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ repoFullName, title: setupIssue.title, body: setupIssue.body })
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

  const testClaudeDispatch = async () => {
    setTestingClaude(true);
    setError("");
    setTestIssueUrl("");
    setTestStatus("");

    try {
      const response = await fetch("/api/github/claude/test-dispatch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ repoFullName })
      });
      const data = (await response.json()) as ClaudeTestResponse;

      if (!response.ok) {
        throw new Error(data.error || "Unable to test Claude dispatch.");
      }

      setTestIssueUrl(data.issueUrl ?? "");
      setTestStatus(data.status ?? "Claude test dispatch issue created.");
    } catch (testError) {
      setError(testError instanceof Error ? testError.message : "Unable to test Claude dispatch.");
    } finally {
      setTestingClaude(false);
    }
  };

  if (loading) {
    return <LoadingState message="Checking agent connections..." />;
  }

  const claudeLikelyConnected = readiness?.claude.connected && readiness.claude.confidence === "high";
  const claudeWorkflowFound = readiness?.claude.workflowFound ?? false;

  return (
    <section className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Agent Connections</p>
        <h2 className="mt-1 text-lg font-semibold text-slate-900">Dispatch readiness for this repo</h2>
        <p className="mt-1 text-sm text-slate-600">TapTask creates GitHub issues and comments. Connected agents do the coding in branches and PRs.</p>
      </div>

      <ErrorState message={error} />

      <div className="space-y-3">
        <article className="space-y-3 rounded-2xl border border-slate-200 p-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Claude</h3>
              <p className="mt-1 text-sm text-slate-600">
                {claudeLikelyConnected
                  ? "Claude workflow detected. TapTask can attempt @claude dispatch."
                  : claudeWorkflowFound
                    ? "Claude workflow file found, but ANTHROPIC_API_KEY and permissions cannot be verified from the API."
                    : "Claude is not connected for this repo yet. TapTask can create issues, but no AI agent will code until a Claude workflow is installed."}
              </p>
            </div>
            <StatusPill
              label={claudeLikelyConnected ? "Likely connected" : claudeWorkflowFound ? "Needs setup" : "Needs setup"}
              tone={claudeLikelyConnected ? "green" : "amber"}
            />
          </div>
          {readiness?.claude.workflowPath ? <p className="text-xs text-slate-500">Workflow: {readiness.claude.workflowPath}</p> : null}
          <ul className="space-y-1 text-xs text-slate-600">
            <li>- Workflow under .github/workflows/</li>
            <li>- Secret usually named ANTHROPIC_API_KEY</li>
            <li>- Permissions for contents, pull requests, issues, and id token</li>
          </ul>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={testClaudeDispatch}
              disabled={testingClaude}
              className="min-h-11 rounded-xl bg-brand px-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
            >
              {testingClaude ? "Testing..." : "Test Claude Dispatch"}
            </button>
            <button
              type="button"
              onClick={createSetupIssue}
              disabled={creatingSetupIssue}
              className="min-h-11 rounded-xl border border-slate-200 px-3 text-sm font-semibold text-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {creatingSetupIssue ? "Creating..." : "Create Setup Issue"}
            </button>
          </div>
          {testStatus ? <p className="rounded-xl bg-blue-50 p-3 text-sm font-semibold text-blue-800">{testStatus}</p> : null}
          {testIssueUrl ? <a className="text-sm font-semibold text-brand" href={testIssueUrl} target="_blank" rel="noreferrer">Open Claude test issue</a> : null}
          {setupIssueUrl ? <a className="block text-sm font-semibold text-brand" href={setupIssueUrl} target="_blank" rel="noreferrer">Open Claude setup issue</a> : null}
        </article>

        <article className="space-y-3 rounded-2xl border border-slate-200 p-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Codex / ChatGPT</h3>
              <p className="mt-1 text-sm text-slate-600">Connect GitHub to ChatGPT from Settings - Apps - GitHub. Set up Codex cloud and enable code review for this repo.</p>
            </div>
            <StatusPill label={settings.codexEnabled ? "Connected" : "Future integration"} tone={settings.codexEnabled ? "green" : "slate"} />
          </div>
          <label className="flex min-h-11 items-center gap-3 rounded-xl bg-slate-50 px-3 text-sm font-semibold text-slate-700">
            <input type="checkbox" checked={settings.codexEnabled} onChange={(event) => updateSettings({ codexEnabled: event.target.checked })} />
            Mark Codex enabled for this repo
          </label>
          <select
            className="min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm"
            value={settings.codexDispatchMode}
            onChange={(event) => updateSettings({ codexDispatchMode: event.target.value === "pr_review" ? "pr_review" : "issue_implementation" })}
          >
            <option value="issue_implementation">Issue Implementation mode</option>
            <option value="pr_review">PR Review mode</option>
          </select>
        </article>

        <article className="space-y-3 rounded-2xl border border-slate-200 p-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Cursor</h3>
              <p className="mt-1 text-sm text-slate-600">Cursor is the primary TapTask dispatch path. Add CURSOR_API_KEY server-side, connect Cursor to GitHub, then TapTask starts a Cursor SDK cloud run.</p>
            </div>
            <StatusPill label={settings.cursorEnabled ? "Connected" : "Needs setup"} tone={settings.cursorEnabled ? "green" : "slate"} />
          </div>
          <label className="flex min-h-11 items-center gap-3 rounded-xl bg-slate-50 px-3 text-sm font-semibold text-slate-700">
            <input type="checkbox" checked={settings.cursorEnabled} onChange={(event) => updateSettings({ cursorEnabled: event.target.checked })} />
            Mark Cursor SDK configured
          </label>
          <label className="flex min-h-11 items-center gap-3 rounded-xl bg-slate-50 px-3 text-sm font-semibold text-slate-700">
            <input type="checkbox" checked={settings.cursorAutoCreatePR ?? false} onChange={(event) => updateSettings({ cursorAutoCreatePR: event.target.checked })} />
            <span>
              Create PR instead of pushing to main
              <span className="ml-1.5 text-xs font-normal text-slate-400">{settings.cursorAutoCreatePR ? "On — agent opens a PR" : "Off — agent pushes directly to main"}</span>
            </span>
          </label>
          <input
            className="min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm"
            value={settings.cursorOpenUrl ?? ""}
            onChange={(event) => updateSettings({ cursorOpenUrl: event.target.value })}
            placeholder="Cursor open URL"
          />
        </article>
      </div>
    </section>
  );
}
