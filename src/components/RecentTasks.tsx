import { SentTask, TASK_TYPE_OPTIONS, AGENT_OPTIONS, STATUS_LABELS } from "@/lib/types";

interface RecentTasksProps {
  tasks: SentTask[];
}

function taskTypeLabel(value: SentTask["taskType"]) {
  return TASK_TYPE_OPTIONS.find((option) => option.value === value)?.label ?? value;
}

function agentLabel(value: SentTask["agent"]) {
  return AGENT_OPTIONS.find((option) => option.value === value)?.label ?? value;
}

function recentStatusLabel(task: SentTask) {
  if (task.dispatchStatus === "issue_created") return "Issue created only";
  if (task.dispatchStatus === "cursor_run_started") return "Cursor run started";
  if (task.dispatchStatus === "cursor_running") return "Cursor running";
  if (task.dispatchStatus === "agent_not_connected") return "Claude not connected";
  if (task.dispatchStatus === "sent_to_claude") return "Sent to Claude";
  if (task.dispatchStatus === "waiting_for_pr") return "Waiting for PR";
  if (task.dispatchStatus === "pr_opened") return "PR opened";
  if (task.dispatchStatus === "dispatch_failed") return "Dispatch failed";
  if (task.dispatchStatus === "future_integration") return "Future integration";
  return STATUS_LABELS[task.dispatchStatus];
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
              <p className="text-sm font-semibold text-slate-900">{task.issueTitle}</p>
              <p className="text-xs text-slate-600">
                {taskTypeLabel(task.taskType)} - {agentLabel(task.agent)} - {task.repoFullName}
              </p>
              <p className="mt-1 text-xs text-slate-500">Status: {recentStatusLabel(task)}</p>
              {task.message ? <p className="mt-1 text-xs text-slate-500">{task.message}</p> : null}
              {task.issueUrl ? (
                <a className="mt-2 inline-block text-xs font-semibold text-brand" href={task.issueUrl} target="_blank" rel="noreferrer">
                  Open issue
                </a>
              ) : null}
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
