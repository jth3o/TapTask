import { ProjectProfile } from "@/lib/types";

interface ProjectSelectorProps {
  projects: ProjectProfile[];
  selectedProjectId: string;
  onChange: (projectId: string) => void;
}

export function ProjectSelector({ projects, selectedProjectId, onChange }: ProjectSelectorProps) {
  if (projects.length === 0) {
    return <p className="rounded-xl border border-dashed border-slate-300 p-3 text-sm text-slate-600">No project profiles yet. Add one below.</p>;
  }

  return (
    <select
      className="min-h-12 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm"
      value={selectedProjectId}
      onChange={(event) => onChange(event.target.value)}
    >
      {projects.map((project) => (
        <option key={project.id} value={project.id}>
          {project.projectName}
        </option>
      ))}
    </select>
  );
}
