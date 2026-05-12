import { ActiveTask } from "./types";

const ACTIVE_TASKS_KEY = "taptask-active-tasks-v1";

function isClient() {
  return typeof window !== "undefined";
}

export function loadActiveTasks(): ActiveTask[] {
  if (!isClient()) return [];
  const value = window.localStorage.getItem(ACTIVE_TASKS_KEY);
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed)) return [];
    return parsed as ActiveTask[];
  } catch {
    return [];
  }
}

export function saveActiveTasks(tasks: ActiveTask[]) {
  if (!isClient()) return;
  window.localStorage.setItem(ACTIVE_TASKS_KEY, JSON.stringify(tasks));
}

export function upsertActiveTask(task: ActiveTask) {
  const tasks = loadActiveTasks();
  const idx = tasks.findIndex((t) => t.id === task.id);
  if (idx >= 0) {
    tasks[idx] = task;
  } else {
    tasks.unshift(task);
  }
  saveActiveTasks(tasks.slice(0, 50));
}

export function patchActiveTask(id: string, patch: Partial<ActiveTask>) {
  const tasks = loadActiveTasks();
  const next = tasks.map((t) =>
    t.id === id ? { ...t, ...patch, updatedAt: new Date().toISOString() } : t
  );
  saveActiveTasks(next);
  return next;
}
