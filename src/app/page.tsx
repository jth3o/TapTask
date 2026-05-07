"use client";

import { useEffect, useMemo, useState } from "react";
import { AgentSelector } from "@/components/AgentSelector";
import { BigChangePhasesCard } from "@/components/BigChangePhasesCard";
import { ChangePlannerCard } from "@/components/ChangePlannerCard";
import { GeneratedPromptCard } from "@/components/GeneratedPromptCard";
import { LocalGitHubPanel } from "@/components/LocalGitHubPanel";
import { MobileHeader } from "@/components/MobileHeader";
import { ProjectProfileForm } from "@/components/ProjectProfileForm";
import { ProjectSelector } from "@/components/ProjectSelector";
import { RecentTasks } from "@/components/RecentTasks";
import { TaskInput } from "@/components/TaskInput";
import { TaskTypeButton } from "@/components/TaskTypeButton";
import { buildTaskTitle, generateChangePlan, generatePhasePrompt, generatePrompt } from "@/lib/generatePrompt";
import { loadProjectProfiles, loadSavedTasks, saveProjectProfiles, saveSavedTasks } from "@/lib/storage";
import { Agent, ChangePlan, PROJECT_TYPE_LABELS, ProjectProfile, SavedTask, TASK_TYPES, TaskType } from "@/lib/types";

export default function HomePage() {
  const [taskType, setTaskType] = useState<TaskType>("New Feature");
  const [agent, setAgent] = useState<Agent>("Cursor");
  const [roughDetails, setRoughDetails] = useState("");
  const [generatedPrompt, setGeneratedPrompt] = useState("");
  const [copied, setCopied] = useState(false);
  const [saved, setSaved] = useState(false);
  const [projects, setProjects] = useState<ProjectProfile[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [recentTasks, setRecentTasks] = useState<SavedTask[]>([]);
  const [changePlan, setChangePlan] = useState<ChangePlan | null>(null);
  const [promptLabel, setPromptLabel] = useState("");

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
    () => projects.find((p) => p.id === selectedProjectId) ?? null,
    [projects, selectedProjectId]
  );

  const handleCreateProject = (project: ProjectProfile) => {
    const next = [project, ...projects];
    setProjects(next);
    saveProjectProfiles(next);
    setSelectedProjectId(project.id);
    setAgent(project.defaultAgent);
  };

  const resetPlanAndPrompt = () => {
    setChangePlan(null);
    setGeneratedPrompt("");
    setCopied(false);
    setSaved(false);
    setPromptLabel("");
  };

  const handlePlan = () => {
    if (!selectedProject || !roughDetails.trim()) return;
    resetPlanAndPrompt();
    const plan = generateChangePlan({
      taskType,
      projectType: selectedProject.projectType,
      agent,
      profile: selectedProject,
      roughDetails,
    });
    setChangePlan(plan);
  };

  const handleGeneratePrompt = () => {
    if (!selectedProject) return;
    const prompt = generatePrompt({ taskType, agent, profile: selectedProject, roughDetails });
    setGeneratedPrompt(prompt);
    setPromptLabel(buildTaskTitle(taskType, roughDetails));
    setCopied(false);
    setSaved(false);
  };

  const handleGeneratePhasePrompt = (phaseIndex: number) => {
    if (!selectedProject || !changePlan?.phases) return;
    const phase = changePlan.phases[phaseIndex];
    const prompt = generatePhasePrompt(phase, selectedProject, roughDetails);
    setGeneratedPrompt(prompt);
    setPromptLabel(phase.title);
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
      title: promptLabel || buildTaskTitle(taskType, roughDetails),
      taskType,
      agent,
      projectProfileId: selectedProject.id,
      projectName: selectedProject.projectName,
      roughDetails,
      generatedPrompt,
      createdAt: new Date().toISOString(),
    };
    const next = [task, ...recentTasks].slice(0, 30);
    setRecentTasks(next);
    saveSavedTasks(next);
    setSaved(true);
  };

  const canPlan = !!selectedProject && !!roughDetails.trim();

  return (
    <main className="mx-auto min-h-screen max-w-xl space-y-4 pb-20">
      <MobileHeader />

      <section className="space-y-2 px-4">
        <h2 className="text-lg font-semibold text-slate-900">Task Type</h2>
        <div className="grid grid-cols-2 gap-2">
          {TASK_TYPES.map((type) => (
            <TaskTypeButton
              key={type}
              label={type}
              selected={taskType === type}
              onClick={() => {
                setTaskType(type);
                resetPlanAndPrompt();
              }}
            />
          ))}
        </div>
      </section>

      <section className="space-y-2 px-4">
        <h2 className="text-lg font-semibold text-slate-900">Project</h2>
        <ProjectSelector
          projects={projects}
          selectedProjectId={selectedProjectId}
          onChange={(id) => {
            setSelectedProjectId(id);
            const p = projects.find((proj) => proj.id === id);
            if (p) setAgent(p.defaultAgent);
            resetPlanAndPrompt();
          }}
        />
        {selectedProject && (
          <p className="px-1 text-xs text-slate-500">
            {PROJECT_TYPE_LABELS[selectedProject.projectType]}
            {selectedProject.repoUrl ? ` · ${selectedProject.repoUrl.replace("https://github.com/", "")}` : ""}
          </p>
        )}
        <ProjectProfileForm onCreate={handleCreateProject} />
      </section>

      <section className="space-y-2 px-4">
        <h2 className="text-lg font-semibold text-slate-900">Target Agent</h2>
        <AgentSelector value={agent} onChange={(a) => { setAgent(a); resetPlanAndPrompt(); }} />
      </section>

      <section className="space-y-2 px-4">
        <h2 className="text-lg font-semibold text-slate-900">Task Details</h2>
        <TaskInput value={roughDetails} onChange={(v) => { setRoughDetails(v); resetPlanAndPrompt(); }} />
        <button
          type="button"
          onClick={handlePlan}
          disabled={!canPlan}
          className="min-h-12 w-full rounded-xl bg-brand px-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
        >
          Plan Change
        </button>
      </section>

      {changePlan && (
        <section className="px-4">
          <ChangePlannerCard
            plan={changePlan}
            onGeneratePrompt={handleGeneratePrompt}
            onGeneratePhasePrompt={handleGeneratePhasePrompt}
          />
        </section>
      )}

      {changePlan?.phases && changePlan.phases.length > 0 && (
        <section className="px-4">
          <BigChangePhasesCard phases={changePlan.phases} onGeneratePhasePrompt={handleGeneratePhasePrompt} />
        </section>
      )}

      {generatedPrompt && (
        <section className="px-4">
          {promptLabel && (
            <p className="mb-2 px-1 text-xs font-semibold uppercase tracking-wide text-slate-500">{promptLabel}</p>
          )}
          <GeneratedPromptCard prompt={generatedPrompt} copied={copied} saved={saved} onCopy={handleCopy} onSave={handleSave} />
        </section>
      )}

      {selectedProject && (
        <section className="px-4">
          <LocalGitHubPanel project={selectedProject} />
        </section>
      )}

      <section className="px-4">
        <RecentTasks tasks={recentTasks} />
      </section>
    </main>
  );
}
