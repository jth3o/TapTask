import { FormEvent, useState } from "react";
import { AGENTS, Agent, PROJECT_TYPE_LABELS, PROJECT_TYPES, ProjectProfile, ProjectType } from "@/lib/types";

interface ProjectProfileFormProps {
  onCreate: (project: ProjectProfile) => void;
}

export function ProjectProfileForm({ onCreate }: ProjectProfileFormProps) {
  const [open, setOpen] = useState(false);
  const [projectName, setProjectName] = useState("");
  const [projectType, setProjectType] = useState<ProjectType>("web_app");
  const [repoUrl, setRepoUrl] = useState("");
  const [techStack, setTechStack] = useState("");
  const [rulesNotes, setRulesNotes] = useState("");
  const [defaultAgent, setDefaultAgent] = useState<Agent>("Cursor");

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!projectName.trim()) return;

    onCreate({
      id: crypto.randomUUID(),
      projectName: projectName.trim(),
      projectType,
      repoUrl: repoUrl.trim(),
      techStack: techStack.trim(),
      rulesNotes: rulesNotes.trim(),
      defaultAgent,
      createdAt: new Date().toISOString()
    });

    setProjectName("");
    setProjectType("web_app");
    setRepoUrl("");
    setTechStack("");
    setRulesNotes("");
    setDefaultAgent("Cursor");
    setOpen(false);
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="w-full rounded-xl border border-dashed border-slate-300 py-3 text-sm text-slate-500 hover:border-slate-400 hover:text-slate-700"
      >
        + Add project
      </button>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-2 rounded-2xl border border-slate-200 bg-white p-4">
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-slate-900">New project</span>
        <button type="button" onClick={() => setOpen(false)} className="text-xs text-slate-400 hover:text-slate-600">
          cancel
        </button>
      </div>

      <select
        className="min-h-12 w-full rounded-xl border border-slate-300 px-3 text-sm"
        value={projectType}
        onChange={(e) => setProjectType(e.target.value as ProjectType)}
      >
        {PROJECT_TYPES.map((type) => (
          <option key={type} value={type}>
            {PROJECT_TYPE_LABELS[type]}
          </option>
        ))}
      </select>

      <input
        className="min-h-12 w-full rounded-xl border border-slate-300 px-3 text-sm"
        placeholder="Project name"
        value={projectName}
        onChange={(e) => setProjectName(e.target.value)}
        required
      />
      <input
        className="min-h-12 w-full rounded-xl border border-slate-300 px-3 text-sm"
        placeholder="Repo URL (optional)"
        value={repoUrl}
        onChange={(e) => setRepoUrl(e.target.value)}
      />
      <input
        className="min-h-12 w-full rounded-xl border border-slate-300 px-3 text-sm"
        placeholder="Tech stack"
        value={techStack}
        onChange={(e) => setTechStack(e.target.value)}
      />
      <textarea
        className="w-full rounded-xl border border-slate-300 px-3 py-3 text-sm"
        rows={3}
        placeholder="Project rules / notes"
        value={rulesNotes}
        onChange={(e) => setRulesNotes(e.target.value)}
      />
      <select
        className="min-h-12 w-full rounded-xl border border-slate-300 px-3 text-sm"
        value={defaultAgent}
        onChange={(e) => setDefaultAgent(e.target.value as Agent)}
      >
        {AGENTS.map((a) => (
          <option key={a} value={a}>
            {a}
          </option>
        ))}
      </select>
      <button type="submit" className="min-h-12 w-full rounded-xl bg-slate-900 px-4 text-sm font-semibold text-white">
        Save Project
      </button>
    </form>
  );
}
