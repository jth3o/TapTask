import { FormEvent, useState } from "react";
import { AGENTS, Agent, ProjectProfile } from "@/lib/types";

interface ProjectProfileFormProps {
  onCreate: (project: ProjectProfile) => void;
}

export function ProjectProfileForm({ onCreate }: ProjectProfileFormProps) {
  const [projectName, setProjectName] = useState("");
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
      repoUrl: repoUrl.trim(),
      techStack: techStack.trim(),
      rulesNotes: rulesNotes.trim(),
      defaultAgent,
      createdAt: new Date().toISOString()
    });

    setProjectName("");
    setRepoUrl("");
    setTechStack("");
    setRulesNotes("");
    setDefaultAgent("Cursor");
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-2">
      <input
        className="min-h-12 w-full rounded-xl border border-slate-300 px-3 text-sm"
        placeholder="Project name"
        value={projectName}
        onChange={(event) => setProjectName(event.target.value)}
        required
      />
      <input
        className="min-h-12 w-full rounded-xl border border-slate-300 px-3 text-sm"
        placeholder="Repo URL (optional)"
        value={repoUrl}
        onChange={(event) => setRepoUrl(event.target.value)}
      />
      <input
        className="min-h-12 w-full rounded-xl border border-slate-300 px-3 text-sm"
        placeholder="Tech stack"
        value={techStack}
        onChange={(event) => setTechStack(event.target.value)}
      />
      <textarea
        className="w-full rounded-xl border border-slate-300 px-3 py-3 text-sm"
        rows={3}
        placeholder="Project rules/notes"
        value={rulesNotes}
        onChange={(event) => setRulesNotes(event.target.value)}
      />
      <select
        className="min-h-12 w-full rounded-xl border border-slate-300 px-3 text-sm"
        value={defaultAgent}
        onChange={(event) => setDefaultAgent(event.target.value as Agent)}
      >
        {AGENTS.map((agent) => (
          <option key={agent} value={agent}>
            {agent}
          </option>
        ))}
      </select>
      <button type="submit" className="min-h-12 w-full rounded-xl bg-slate-900 px-4 text-sm font-semibold text-white">
        Save Project Profile
      </button>
    </form>
  );
}
