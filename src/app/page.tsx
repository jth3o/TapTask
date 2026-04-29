"use client";

import { useEffect, useMemo, useState } from "react";
import { AgentSelector } from "@/components/AgentSelector";
import { GeneratedPromptCard } from "@/components/GeneratedPromptCard";
import { MobileHeader } from "@/components/MobileHeader";
import { ProjectProfileForm } from "@/components/ProjectProfileForm";
import { ProjectSelector } from "@/components/ProjectSelector";
import { RecentTasks } from "@/components/RecentTasks";
import { TaskInput } from "@/components/TaskInput";
import { TaskModeSelector } from "@/components/TaskModeSelector";
import { TaskTypeButton } from "@/components/TaskTypeButton";
import { generatePrompt, buildTaskTitle } from "@/lib/generatePrompt";
import { loadProjectProfiles, loadSavedTasks, saveProjectProfiles, saveSavedTasks } from "@/lib/storage";
import { Agent, ProjectProfile, SavedTask, TASK_TYPES, TaskMode, TaskType } from "@/lib/types";

export default function HomePage() {
  const [taskType, setTaskType] = useState<TaskType>("New Feature");
  const [taskMode, setTaskMode] = useState<TaskMode>("Legacy Context");
  const [agent, setAgent] = useState<Agent>("Cursor");
  const [roughDetails, setRoughDetails] = useState("");
  const [generatedPrompt, setGeneratedPrompt] = useState("");
  const [copied, setCopied] = useState(false);
  const [saved, setSaved] = useState(false);
  const [projects, setProjects] = useState<ProjectProfile[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [recentTasks, setRecentTasks] = useState<SavedTask[]>([]);

  useEffect(() => {
    const loadedProjects = loadProjectProfiles();
    const loadedTasks = loadSavedTasks();
    setProjects(loadedProjects);
    setRecentTasks(loadedTasks);

    if (loadedProjects[0]) {
      setSelectedProjectId(loadedProjects[0].id);
      setAgent(loadedProjects[0].defaultAgent);
    }
  }, []);

  const selectedProject = useMemo(
    () => projects.find((project) => project.id === selectedProjectId) ?? null,
    [projects, selectedProjectId]
  );

  const handleCreateProject = (project: ProjectProfile) => {
    const next = [project, ...projects];
    setProjects(next);
    saveProjectProfiles(next);
    setSelectedProjectId(project.id);
    setAgent(project.defaultAgent);
  };

  const handleGenerate = () => {
    if (!selectedProject) return;
    const prompt = generatePrompt({ taskType, taskMode, agent, profile: selectedProject, roughDetails });
    setGeneratedPrompt(prompt);
    setCopied(false);
    setSaved(false);
  };

  const handleCopy = async () => {
    if (!generatedPrompt) return;
    await navigator.clipboard.writeText(generatedPrompt);
    setCopied(true);
  };

  const handleSave = () => {
    if (!generatedPrompt || !selectedProject) return;
    const task: SavedTask = {
      id: crypto.randomUUID(),
      title: buildTaskTitle(taskType, roughDetails),
      taskType,
      taskMode,
      agent,
      projectProfileId: selectedProject.id,
      projectName: selectedProject.projectName,
      roughDetails,
      generatedPrompt,
      createdAt: new Date().toISOString()
    };
    const next = [task, ...recentTasks].slice(0, 30);
    setRecentTasks(next);
    saveSavedTasks(next);
    setSaved(true);
  };

  return (
    <main className="mx-auto min-h-screen max-w-xl space-y-4 pb-20">
      <MobileHeader />

      <section className="space-y-2 px-4">
        <h2 className="text-lg font-semibold text-slate-900">Task Mode</h2>
        <TaskModeSelector value={taskMode} onChange={setTaskMode} />
      </section>

      <section className="space-y-2 px-4">
        <h2 className="text-lg font-semibold text-slate-900">Task Type</h2>
        <div className="grid grid-cols-2 gap-2">
          {TASK_TYPES.map((type) => (
            <TaskTypeButton key={type} label={type} selected={taskType === type} onClick={() => setTaskType(type)} />
          ))}
        </div>
      </section>

      <section className="space-y-2 px-4">
        <h2 className="text-lg font-semibold text-slate-900">Project Profile</h2>
        <ProjectSelector projects={projects} selectedProjectId={selectedProjectId} onChange={setSelectedProjectId} />
        <ProjectProfileForm onCreate={handleCreateProject} />
      </section>

      <section className="space-y-2 px-4">
        <h2 className="text-lg font-semibold text-slate-900">Target Agent</h2>
        <AgentSelector value={agent} onChange={setAgent} />
      </section>

      <section className="space-y-2 px-4">
        <h2 className="text-lg font-semibold text-slate-900">Rough Task Details</h2>
        <TaskInput value={roughDetails} onChange={setRoughDetails} />
        <button
          type="button"
          onClick={handleGenerate}
          disabled={!selectedProject || !roughDetails.trim()}
          className="min-h-12 w-full rounded-xl bg-brand px-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
        >
          Generate Prompt
        </button>
      </section>

      <section className="px-4">
        <GeneratedPromptCard prompt={generatedPrompt} copied={copied} saved={saved} onCopy={handleCopy} onSave={handleSave} />
      </section>

      <section className="px-4">
        <RecentTasks tasks={recentTasks} />
      </section>
    </main>
  );
}
