import { FormEvent, useState } from "react";
import { ProjectProfile } from "@/lib/types";

interface ProjectProfileFormProps {
  onCreate: (project: ProjectProfile) => void;
}

export function ProjectProfileForm({ onCreate }: ProjectProfileFormProps) {
  const [projectName, setProjectName] = useState("");
  const [repoUrl, setRepoUrl] = useState("");

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!projectName.trim()) return;

    onCreate({
      id: crypto.randomUUID(),
      projectName: projectName.trim(),
      repoUrl: repoUrl.trim() || undefined,
    });

    setProjectName("");
    setRepoUrl("");
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
      <button type="submit" className="min-h-12 w-full rounded-xl bg-slate-900 px-4 text-sm font-semibold text-white">
        Save Project Profile
      </button>
    </form>
  );
}
