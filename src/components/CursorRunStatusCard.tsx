import { CursorRunInfo, STATUS_LABELS, SendTaskResponse } from "@/lib/types";
import { CursorEventStream } from "./CursorEventStream";

type CursorRunStatusCardProps = {
  result: SendTaskResponse | null;
};

function statusText(run: CursorRunInfo) {
  if (run.status === "running") return "Cursor Running";
  if (run.status === "finished") return "Cursor Finished";
  if (run.status === "error" || run.status === "failed") return "Failed / Needs Attention";
  if (run.status === "cancelled") return "Cancelled";
  return "Cursor Run Started";
}

export function CursorRunStatusCard({ result }: CursorRunStatusCardProps) {
  if (!result?.cursorRun) return null;

  const run = result.cursorRun;

  return (
    <section className="space-y-3 rounded-2xl border border-blue-200 bg-white p-4 shadow-sm">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-blue-700">
          {STATUS_LABELS[result.dispatchStatus] ?? statusText(run)}
        </p>
        <h3 className="mt-1 text-base font-bold text-slate-900">{statusText(run)}</h3>
        <p className="mt-1 text-sm text-slate-600">Cursor is expected to create a branch and open a PR that references the GitHub issue.</p>
      </div>

      <div className="grid grid-cols-2 gap-2 text-xs text-slate-600">
        {run.runId ? (
          <div className="rounded-xl bg-slate-50 p-3">
            <p className="font-semibold text-slate-900">Run ID</p>
            <p className="mt-1 break-all">{run.runId}</p>
          </div>
        ) : null}
        {run.agentId ? (
          <div className="rounded-xl bg-slate-50 p-3">
            <p className="font-semibold text-slate-900">Agent ID</p>
            <p className="mt-1 break-all">{run.agentId}</p>
          </div>
        ) : null}
      </div>

      {run.prUrl ? (
        <a className="block rounded-xl bg-emerald-50 p-3 text-sm font-semibold text-emerald-700" href={run.prUrl} target="_blank" rel="noreferrer">
          Open PR
        </a>
      ) : (
        <p className="rounded-xl bg-blue-50 p-3 text-sm font-semibold text-blue-800">Waiting for PR</p>
      )}

      <CursorEventStream events={run.events} />
    </section>
  );
}
