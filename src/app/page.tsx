"use client";

import { useEffect, useMemo, useState } from "react";
import { AgentConnections } from "@/components/AgentConnections";
import { AgentSelector } from "@/components/AgentSelector";
import { CursorRunStatusCard } from "@/components/CursorRunStatusCard";
import { ErrorState } from "@/components/ErrorState";
import { LoadingState } from "@/components/LoadingState";
import { MobileHeader } from "@/components/MobileHeader";
import { OpenPullRequests } from "@/components/OpenPullRequests";
import { RecentTasks } from "@/components/RecentTasks";
import { RepoPicker } from "@/components/RepoPicker";
import { SendSuccessCard } from "@/components/SendSuccessCard";
import { SendTaskButton } from "@/components/SendTaskButton";
import { TaskInput } from "@/components/TaskInput";
import { TaskTypeGrid } from "@/components/TaskTypeGrid";
import {
  DEFAULT_AGENT_SETTINGS,
  loadAgentConnectionSettings,
  loadFavoriteRepos,
  loadRecentRepos,
  loadSentTasks,
  rememberRepo,
  saveAgentConnectionSettings,
  saveFavoriteRepos,
  saveRecentRepos,
  saveSentTasks
} from "@/lib/storage";
import { Agent, AgentConnectionSettings, GitHubRepo, SendTaskResponse, SentTask, TaskType } from "@/lib/types";

export default function HomePage() {
  const [taskType, setTaskType] = useState<TaskType>("new_feature");
  const [agent, setAgent] = useState<Agent>("cursor");
  const [rawInput, setRawInput] = useState("");
  const [repos, setRepos] = useState<GitHubRepo[]>([]);
  const [selectedRepoFullName, setSelectedRepoFullName] = useState("");
  const [repoSearch, setRepoSearch] = useState("");
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

  useEffect(() => {
    setRecentTasks(loadSentTasks());
    setFavoriteRepoFullNames(loadFavoriteRepos());
    setRecentRepoFullNames(loadRecentRepos());
    const savedAgentSettings = loadAgentConnectionSettings();
    setAgentSettings(savedAgentSettings);
    setAgent(savedAgentSettings.preferredAgent);
  }, []);

  useEffect(() => {
    async function fetchRepos() {
      setLoadingRepos(true);
      setError("");

      try {
        const response = await fetch("/api/github/repos");
        const data = (await response.json()) as { repos?: GitHubRepo[]; error?: string };

        if (!response.ok) {
          throw new Error(data.error || "Unable to load GitHub repositories.");
        }

        const nextRepos = data.repos ?? [];
        setRepos(nextRepos);
        setSelectedRepoFullName((current) => current || nextRepos[0]?.fullName || "");
      } catch (fetchError) {
        setError(fetchError instanceof Error ? fetchError.message : "Unable to load GitHub repositories.");
      } finally {
        setLoadingRepos(false);
      }
    }

    void fetchRepos();
  }, []);

  const selectedRepo = useMemo(() => repos.find((repo) => repo.fullName === selectedRepoFullName) ?? null, [repos, selectedRepoFullName]);

  const handleSelectRepo = (repo: GitHubRepo) => {
    setSelectedRepoFullName(repo.fullName);
    const nextRecentRepos = rememberRepo(repo, recentRepoFullNames);
    setRecentRepoFullNames(nextRecentRepos);
    saveRecentRepos(nextRecentRepos);
    setSendResult(null);
  };

  const handleToggleFavorite = (repoFullName: string) => {
    const nextFavorites = favoriteRepoFullNames.includes(repoFullName)
      ? favoriteRepoFullNames.filter((fullName) => fullName !== repoFullName)
      : [repoFullName, ...favoriteRepoFullNames].slice(0, 20);
    setFavoriteRepoFullNames(nextFavorites);
    saveFavoriteRepos(nextFavorites);
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

  const handleSendTask = async () => {
    if (!selectedRepo) return;
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
            ? {
                repoFullName: selectedRepo.fullName,
                taskType,
                rawInput
              }
            : {
                repoFullName: selectedRepo.fullName,
                taskType,
                agent,
                rawInput,
                allowIssueOnly: true,
                codexEnabled: agentSettings.codexEnabled,
                codexDispatchMode: agentSettings.codexDispatchMode,
                cursorEnabled: agentSettings.cursorEnabled,
                cursorOpenUrl: agentSettings.cursorOpenUrl
              }
        )
      });
      const data = (await response.json()) as SendTaskResponse & { error?: string };

      if (!response.ok) {
        throw new Error(data.error || "Unable to send task.");
      }

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
        createdAt: new Date().toISOString()
      };
      const nextTasks = [task, ...recentTasks].slice(0, 30);
      setRecentTasks(nextTasks);
      saveSentTasks(nextTasks);
    } catch (sendError) {
      setError(sendError instanceof Error ? sendError.message : "Unable to send task.");
    } finally {
      setSendingTask(false);
    }
  };

  const copyIssueBody = async () => {
    if (!sendResult?.issueBody) return;
    await navigator.clipboard.writeText(sendResult.issueBody);
    setCopiedIssueBody(true);
  };

  const copyAgentPrompt = async () => {
    if (!sendResult) return;
    await navigator.clipboard.writeText(sendResult.agentPrompt);
    setCopiedAgentPrompt(true);
  };

  return (
    <main className="mx-auto min-h-screen max-w-xl space-y-5 pb-24">
      <MobileHeader />

      <section className="space-y-2 px-4">
        <h2 className="text-lg font-semibold text-slate-900">Repository</h2>
        {loadingRepos ? (
          <LoadingState message="Loading GitHub repositories..." />
        ) : (
          <RepoPicker
            repos={repos}
            selectedRepo={selectedRepo}
            favoriteRepoFullNames={favoriteRepoFullNames}
            recentRepoFullNames={recentRepoFullNames}
            search={repoSearch}
            onSearchChange={setRepoSearch}
            onSelect={handleSelectRepo}
            onToggleFavorite={handleToggleFavorite}
          />
        )}
      </section>

      {selectedRepo ? (
        <section className="px-4">
          <AgentConnections
            repoFullName={selectedRepo.fullName}
            settings={agentSettings}
            onSettingsChange={handleAgentSettingsChange}
          />
        </section>
      ) : null}

      <section className="space-y-2 px-4">
        <h2 className="text-lg font-semibold text-slate-900">Task Type</h2>
        <TaskTypeGrid value={taskType} onChange={setTaskType} />
      </section>

      <section className="space-y-2 px-4">
        <h2 className="text-lg font-semibold text-slate-900">Target Agent</h2>
        <AgentSelector value={agent} onChange={handleAgentChange} />
      </section>

      <section className="space-y-2 px-4">
        <h2 className="text-lg font-semibold text-slate-900">Rough Task Details</h2>
        <TaskInput value={rawInput} onChange={setRawInput} />
        <SendTaskButton
          disabled={!selectedRepo || !rawInput.trim()}
          sending={sendingTask}
          label={agent === "cursor" ? "Send to Cursor" : "Send Task"}
          onClick={handleSendTask}
        />
      </section>

      <section className="px-4">
        <ErrorState message={error} />
      </section>

      <section className="px-4">
        <SendSuccessCard
          result={sendResult}
          copiedIssueBody={copiedIssueBody}
          copiedAgentPrompt={copiedAgentPrompt}
          onCopyIssueBody={copyIssueBody}
          onCopyAgentPrompt={copyAgentPrompt}
        />
      </section>

      <section className="px-4">
        <CursorRunStatusCard result={sendResult} />
      </section>

      <section className="px-4">
        <RecentTasks tasks={recentTasks} />
      </section>

      {selectedRepo ? (
        <section className="px-4">
          <OpenPullRequests
            repoFullName={selectedRepo.fullName}
            sentTasks={recentTasks.filter((task) => task.repoFullName === selectedRepo.fullName)}
            codexEnabled={agentSettings.codexEnabled}
          />
        </section>
      ) : null}
    </main>
  );
}
