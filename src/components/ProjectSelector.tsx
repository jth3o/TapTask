"use client";

import { useState, useRef, useEffect } from "react";
import { ProjectProfile } from "@/lib/types";

interface ProjectSelectorProps {
  projects: ProjectProfile[];
  selectedProjectId: string;
  onChange: (projectId: string) => void;
}

export function ProjectSelector({ projects, selectedProjectId, onChange }: ProjectSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  if (projects.length === 0) {
    return <p className="rounded-xl border border-dashed border-slate-300 p-3 text-sm text-slate-600">No project profiles yet. Add one below.</p>;
  }

  const selectedProject = projects.find((project) => project.id === selectedProjectId);

  const handleSelect = (projectId: string) => {
    onChange(projectId);
    setIsOpen(false);
  };

  return (
    <div ref={dropdownRef} className="relative">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="min-h-12 w-full rounded-xl border border-slate-300 bg-white px-3 text-left text-sm flex items-center justify-between"
      >
        <span className="truncate">{selectedProject?.projectName || "Select a project"}</span>
        <svg
          className={`ml-2 h-5 w-5 text-slate-500 transition-transform ${isOpen ? "rotate-180" : ""}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <div className="absolute z-10 mt-1 w-full rounded-xl border border-slate-300 bg-white shadow-lg max-h-60 overflow-auto">
          {projects.map((project) => (
            <button
              key={project.id}
              type="button"
              onClick={() => handleSelect(project.id)}
              className={`w-full px-3 py-3 text-left text-sm hover:bg-slate-50 first:rounded-t-xl last:rounded-b-xl ${
                project.id === selectedProjectId ? "bg-slate-100 font-semibold" : ""
              }`}
            >
              <div className="truncate">{project.projectName}</div>
              {project.repoUrl && (
                <div className="truncate text-xs text-slate-500 mt-0.5">{project.repoUrl}</div>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
