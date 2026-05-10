"use client";

import { useEffect, useMemo, useState } from "react";
import { AgentConnections } from "@/components/AgentConnections";
import { AgentSelector } from "@/components/AgentSelector";
import { CursorRunStatusCard } from "@/components/CursorRunStatusCard";
import { ErrorState } from "@/components/ErrorState";
import { SetupCard } from "@/components/SetupCard";
import { LoadingState } from "@/components/LoadingState";
import { MobileHeader } from "@/components/MobileHeader";
import { OpenPullRequests } from "@/components/OpenPullRequests";
import { RecentTasks } from "@/components/RecentTasks";
import { RepoPicker } from "@/components/RepoPicker";
import { SendSuccessCard } from "@/components/SendSuccessCard";
import { TaskInput } from "@/components/TaskInput";
import { TaskTypeGrid } from "@/components/TaskTypeGrid";
import {
  DEFAULT_AGENT_SETTINGS,
  loadAgentConnectionSettings,
  loadFavoriteRepos,
  loadRecentRepos,
  loadRepoProjectTypes,
  loadSentTasks,
  rememberRepo,
  saveAgentConnectionSettings,
  saveFavoriteRepos,
  saveRecentRepos,
  saveRepoProjectTypes,
  saveSentTasks,
} from "@/lib/storage";
import { loadAndClearTaskPrefill } from "@/lib/ideaStorage";
import {
  Agent,
  AgentConnectionSettings,
  GitHubRepo,
  ProjectType,
  SendTaskResponse,
  SentTask,
  TaskType,
  TASK_TYPE_OPTIONS,
} from "@/lib/types";

export default function HomePage() {
  const [taskType, setTaskType] = useState<TaskType>("new_feature");
  const [agent, setAgent] = useState<Agent>("cursor");
  const [rawInput, setRawInput] = useState("");
  const [repos, setRepos] = useState<GitHubRepo[]>([]);
  const [selectedRepoFullName, setSelectedRepoFullName] = useState("");
  const [favoriteRepoFullNames, setFavoriteRepoFullNames] = useState<string[]>([]);
  const [recentRepoFullNames, setRecentRepoFullNames] = useState<string[]>([]);
  const [recentTasks, setRecentTasks] = useState<SentTask[]>([]);
  const [agentSettings, setAgentSettings] = useState<AgentConnectionSettings>(DEFAULT_AGENT_SETTINGS);
  const [loadingRepos, setLoadingRepos] = useState(true);
  const [error, setError] = useState("");
  const [sendingTask, setSendingTask] = useState(false);
  const [sendResult, setSendResult] = useState<SendTaskResponse | null>(null);
  const [copiedIssueBody, setCopiedIssueBody] = useState(false);
  const [copiedAgentPrompt, setCopiedAgentPrompt] = useState(false);
  const [repoProjectTypes, setRepoProjectTypes] = useState<Record<string, ProjectType>>({});
  const [prefillBanner, setPrefillBanner] = useState("");
  const [agentSetupOpen, setAgentSetupOpen] = useState(false);
  const [recentTasksOpen, setRecentTasksOpen] = useState(false);

  useEffect(() => {
    setRecentTasks(loadSentTasks());
    setFavoriteRepoFullNames(loadFavoriteRepos());
    setRecentRepoFullNames(loadRecentRepos());
    setRepoProjectTypes(loadRepoProjectTypes());

    const prefill = loadAndClearTaskPrefill();
    if (prefill) {
      setRawInput(prefill.rawInput);
      const validTaskType = TASK_TYPE_OPTIONS.find((o) => o.value === prefill.taskType);
      if (validTaskType) setTaskType(prefill.taskType);
      setAgent(prefill.agentSuggestion);
      setPrefillBanner("Prefilled from Ideas — edit and send.");
      if (prefill.repoFullName) setSelectedRepoFullName(prefill.repoFullName);
    }

    const savedSettings = loadAgentConnectionSettings();
    setAgentSettings(savedSettings);
    setAgent(savedSettings.preferredAgent);
  }, []);

  useEffect(() => {
    async function fetchRepos() {
      setLoadingRepos(true);
      setError("");
      try {
        const response = await fetch("/api/github/repos");
        const data = (await response.json()) as { repos?: GitHubRepo[]; error?: string };
        if (!response.ok) throw new Error(data.error || "Unable to load GitHub repositories.");
        const nextRepos = data.repos ?? [];
        setRepos(nextRepos);
        setSelectedRepoFullName((current) => current || nextRepos[0]?.fullName || "");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unable to load GitHub repositories.");
      } finally {
        setLoadingRepos(false);
      }
    }
    void fetchRepos();
  }, []);

  const selectedRepo = useMemo(
    () => repos.find((r) => r.fullName === selectedRepoFullName) ?? null,
    [repos, selectedRepoFullName]
  );

  const currentProjectType: ProjectType = useMemo(
    () => (selectedRepoFullName ? (repoProjectTypes[selectedRepoFullName] ?? "web_page") : "web_page"),
    [selectedRepoFullName, repoProjectTypes]
  );

  const handleSelectRepo = (repo: GitHubRepo) => {
    setSelectedRepoFullName(repo.fullName);
    const next = rememberRepo(repo, recentRepoFullNames);
    setRecentRepoFullNames(next);
    saveRecentRepos(next);
    setSendResult(null);
    setAgentSetupOpen(false);
  };

  const handleToggleFavorite = (repoFullName: string) => {
    const next = favoriteRepoFullNames.includes(repoFullName)
      ? favoriteRepoFullNames.filter((n) => n !== repoFullName)
      : [repoFullName, ...favoriteRepoFullNames].slice(0, 20);
    setFavoriteRepoFullNames(next);
    saveFavoriteRepos(next);
  };

  const handleAgentSettingsChange = (settings: AgentConnectionSettings) => {
    setAgentSettings(settings);
    saveAgentConnectionSettings(settings);
  };

  const handleAgentChange = (nextAgent: Agent) => {
    setAgent(nextAgent);
    if (nextAgent !== "manual") {
      handleAgentSettingsChange({ ...agentSettings, preferredAgent: nextAgent });
    }
  };

  const handleProjectTypeChange = (type: ProjectType) => {
    if (!selectedRepoFullName) return;
    const next = { ...repoProjectTypes, [selectedRepoFullName]: type };
    setRepoProjectTypes(next);
    saveRepoProjectTypes(next);
  };

  const doSendTask = async () => {
    if (!selectedRepo || !rawInput.trim()) return;
    setSendingTask(true);
    setError("");
    setSendResult(null);
    setCopiedIssueBody(false);
    setCopiedAgentPrompt(false);
    try {
      const endpoint = agent === "cursor" ? "/api/agents/cursor/run" : "/api/tasks/send";
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          agent === "cursor"
            ? { repoFullName: selectedRepo.fullName, taskType, rawInput, autoCreatePR: agentSettings.cursorAutoCreatePR }
            : {
                repoFullName: selectedRepo.fullName,
                taskType,
                agent,
                rawInput,
                allowIssueOnly: true,
                codexEnabled: agentSettings.codexEnabled,
                codexDispatchMode: agentSettings.codexDispatchMode,
                cursorEnabled: agentSettings.cursorEnabled,
                cursorOpenUrl: agentSettings.cursorOpenUrl,
              }
        ),
      });
      const data = (await response.json()) as SendTaskResponse & { error?: string };
      if (!response.ok) throw new Error(data.error || "Unable to send task.");
      setSendResult(data);
      const task: SentTask = {
        id: data.taskId,
        repoFullName: selectedRepo.fullName,
        taskType,
        agent,
        rawInput,
        issueTitle: data.issueTitle ?? "Sent Task",
        issueBody: data.issueBody ?? "",
        issueCreated: data.issueCreated,
        issueNumber: data.issueNumber,
        issueUrl: data.issueUrl,
        dispatchAttempted: data.dispatchAttempted,
        dispatchStatus: data.dispatchStatus,
        cursorRun: data.cursorRun,
        cursorRunId: data.cursorRun?.runId,
        readinessAtSend: data.readinessAtSend,
        message: data.message,
        createdAt: new Date().toISOString(),
      };
      const nextTasks = [task, ...recentTasks].slice(0, 30);
      setRecentTasks(nextTasks);
      saveSentTasks(nextTasks);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to send task.");
    } finally {
      setSendingTask(false);
    }
  };

  return (
    <main className="mx-auto min-h-screen max-w-xl space-y-4 pb-24">
      <MobileHeader />

      {/* ── Web Page Repo ────────────────────────── */}
      <section className="px-4">
        {loadingRepos ? (
          <LoadingState message="Loading repositories…" />
        ) : (
          <RepoPicker
            repos={repos}
            selectedRepo={selectedRepo}
            favoriteRepoFullNames={favoriteRepoFullNames}
            recentRepoFullNames={recentRepoFullNames}
            projectType={currentProjectType}
            onSelect={handleSelectRepo}
            onToggleFavorite={handleToggleFavorite}
            onProjectTypeChange={handleProjectTypeChange}
          />
        )}
      </section>

      {/* ── Agent connections ────────────────────── */}
      {selectedRepo && (
        <section className="px-4">
          <button
            type="button"
            onClick={() => setAgentSetupOpen((o) => !o)}
            className="flex w-full items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 shadow-sm active:bg-slate-50"
          >
            <span>Agent &amp; Repo Setup</span>
            <span className="text-slate-400">{agentSetupOpen ? "▲" : "▼"}</span>
          </button>
          {agentSetupOpen && (
            <div className="mt-2">
              <AgentConnections
                repoFullName={selectedRepo.fullName}
                settings={agentSettings}
                onSettingsChange={handleAgentSettingsChange}
              />
            </div>
          )}
        </section>
      )}

      {/* ── Prefill banner ──────────────────────── */}
      {prefillBanner && (
        <section className="px-4">
          <div className="flex items-center justify-between rounded-xl border border-blue-200 bg-blue-50 px-4 py-2.5">
            <p className="text-xs font-semibold text-blue-700">{prefillBanner}</p>
            <button type="button" onClick={() => setPrefillBanner("")} className="text-xs text-blue-400 hover:text-blue-600">
              dismiss
            </button>
          </div>
        </section>
      )}

      {/* ── Task ────────────────────────────────── */}
      <section className="space-y-3 px-4">
        <TaskTypeGrid value={taskType} onChange={setTaskType} />
        <TaskInput value={rawInput} onChange={setRawInput} />
        <AgentSelector value={agent} onChange={handleAgentChange} />
        <button
          type="button"
          onClick={() => void doSendTask()}
          disabled={!selectedRepo || !rawInput.trim() || sendingTask}
          className="min-h-12 w-full rounded-xl bg-brand px-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40"
        >
          {sendingTask ? "Sending…" : "Send Task"}
        </button>
      </section>

      {/* ── Results ─────────────────────────────── */}
      <section className="px-4">
        <ErrorState message={error} />
        <SetupCard message={error} />
      </section>

      <section className="px-4">
        <SendSuccessCard
          result={sendResult}
          copiedIssueBody={copiedIssueBody}
          copiedAgentPrompt={copiedAgentPrompt}
          onCopyIssueBody={async () => {
            if (!sendResult?.issueBody) return;
            await navigator.clipboard.writeText(sendResult.issueBody);
            setCopiedIssueBody(true);
          }}
          onCopyAgentPrompt={async () => {
            if (!sendResult) return;
            await navigator.clipboard.writeText(sendResult.agentPrompt);
            setCopiedAgentPrompt(true);
          }}
        />
      </section>

      <section className="px-4">
        <CursorRunStatusCard result={sendResult} />
      </section>

      {selectedRepo && (
        <section className="px-4">
          <OpenPullRequests
            repoFullName={selectedRepo.fullName}
            sentTasks={recentTasks.filter((t) => t.repoFullName === selectedRepo.fullName)}
            codexEnabled={agentSettings.codexEnabled}
            pollWhenActive={
              sendResult !== null &&
              (sendResult.dispatchStatus === "sent_to_claude" ||
                sendResult.dispatchStatus === "cursor_run_started")
            }
          />
        </section>
      )}
      {/* ── Recent Tasks ─────────────────────────── */}
      <section className="px-4">
        <button
          type="button"
          onClick={() => setRecentTasksOpen((o) => !o)}
          className="flex w-full items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 shadow-sm active:bg-slate-50"
        >
          <span>Recent Tasks {recentTasks.length > 0 && <span className="ml-1 text-xs font-normal text-slate-400">({recentTasks.length})</span>}</span>
          <span className="text-slate-400">{recentTasksOpen ? "▲" : "▼"}</span>
        </button>
        {recentTasksOpen && (
          <div className="mt-2">
            <RecentTasks tasks={recentTasks} />
          </div>
        )}
      </section>
    </main>
  );
}
