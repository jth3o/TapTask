import { SavedTask } from "@/lib/types";

interface RecentTasksProps {
  tasks: SavedTask[];
}

export function RecentTasks({ tasks }: RecentTasksProps) {
  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold text-slate-900">Recent Tasks</h2>
      {tasks.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-300 p-3 text-sm text-slate-600">No saved tasks yet.</p>
      ) : (
        <div className="space-y-2">
          {tasks.slice(0, 8).map((task) => (
            <article key={task.id} className="rounded-xl border border-slate-200 bg-white p-3">
              <p className="text-sm font-semibold text-slate-900">{task.title}</p>
              <p className="text-xs text-slate-600">
                {task.taskType} • {task.agent} • {task.projectName}
              </p>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
