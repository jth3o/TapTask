import { ProjectProfile, SavedTask } from "./types";

const PROJECTS_KEY = "taptask-project-profiles-v1";
const TASKS_KEY = "taptask-saved-tasks-v1";

function isClient() {
  return typeof window !== "undefined";
}

export function loadProjectProfiles(): ProjectProfile[] {
  if (!isClient()) return [];
  const value = window.localStorage.getItem(PROJECTS_KEY);
  if (!value) return [];
  try {
    return JSON.parse(value) as ProjectProfile[];
  } catch {
    return [];
  }
}

export function saveProjectProfiles(profiles: ProjectProfile[]) {
  if (!isClient()) return;
  window.localStorage.setItem(PROJECTS_KEY, JSON.stringify(profiles));
}

export function loadSavedTasks(): SavedTask[] {
  if (!isClient()) return [];
  const value = window.localStorage.getItem(TASKS_KEY);
  if (!value) return [];
  try {
    return JSON.parse(value) as SavedTask[];
  } catch {
    return [];
  }
}

export function saveSavedTasks(tasks: SavedTask[]) {
  if (!isClient()) return;
  window.localStorage.setItem(TASKS_KEY, JSON.stringify(tasks));
}
