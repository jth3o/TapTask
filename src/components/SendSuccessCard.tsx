import { SendTaskResponse, STATUS_LABELS } from "@/lib/types";

type SendSuccessCardProps = {
  result: SendTaskResponse | null;
  copiedIssueBody: boolean;
  copiedAgentPrompt: boolean;
  onCopyIssueBody: () => void;
  onCopyAgentPrompt: () => void;
};

function dispatchMessage(result: SendTaskResponse) {
  return result.message;
}

export function SendSuccessCard({
  result,
  copiedIssueBody,
  copiedAgentPrompt,
  onCopyIssueBody,
  onCopyAgentPrompt
}: SendSuccessCardProps) {
  if (!result) return null;

  const isWarning = result.dispatchStatus === "dispatch_failed" || result.dispatchStatus === "agent_not_connected";
  const isFutureIntegration = result.dispatchStatus === "future_integration";
  const issueBody = result.issueBody ?? "";
  const issueTitle = result.issueTitle ?? "Sent Task";

  return (
    <section className="space-y-3 rounded-2xl border border-emerald-200 bg-white p-4 shadow-sm">
      <div className={isWarning ? "rounded-xl bg-amber-50 p-3 text-amber-800" : "rounded-xl bg-emerald-50 p-3 text-emerald-800"}>
        <p className="text-xs font-semibold uppercase tracking-wide">{STATUS_LABELS[result.dispatchStatus]}</p>
        <p className="text-sm font-bold">{dispatchMessage(result)}</p>
        {result.dispatchError ? <p className="mt-1 text-xs">{result.dispatchError}</p> : null}
      </div>

      {result.issueCreated && result.issueUrl ? (
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Issue</p>
          <h3 className="mt-1 text-base font-semibold text-slate-900">{issueTitle}</h3>
          <a className="mt-2 inline-block text-sm font-semibold text-brand" href={result.issueUrl} target="_blank" rel="noreferrer">
            Open issue #{result.issueNumber}
          </a>
        </div>
      ) : null}

      {result.dispatchStatus === "sent_to_claude" ? (
        <p className="rounded-xl bg-blue-50 p-3 text-sm font-semibold text-blue-800">Waiting for PR</p>
      ) : null}

      {result.dispatchStatus === "agent_not_connected" ? (
        <p className="rounded-xl bg-slate-50 p-3 text-sm text-slate-700">
          Create a Claude setup issue from the Agent Readiness card, then install the workflow before expecting @claude to code.
        </p>
      ) : null}

      {isFutureIntegration ? (
        <p className="rounded-xl bg-slate-50 p-3 text-sm text-slate-700">
          Use the copyable prompt below with this agent manually. Automatic dispatch is not implemented yet.
        </p>
      ) : null}

      {result.codexCommand ? (
        <pre className="whitespace-pre-wrap rounded-xl bg-slate-50 p-3 text-xs text-slate-700">{result.codexCommand}</pre>
      ) : null}

      <div className="grid grid-cols-2 gap-2">
        <button type="button" onClick={onCopyIssueBody} disabled={!issueBody} className="min-h-12 rounded-xl border border-slate-200 px-3 text-sm font-semibold text-slate-700 disabled:cursor-not-allowed disabled:opacity-50">
          {copiedIssueBody ? "Issue Copied" : "Copy Issue Body"}
        </button>
        <button type="button" onClick={onCopyAgentPrompt} className="min-h-12 rounded-xl bg-slate-900 px-3 text-sm font-semibold text-white">
          {copiedAgentPrompt ? "Task Copied" : result.cursorOpenUrl ? "Copy Cursor Task" : "Copy Agent Prompt"}
        </button>
      </div>

      {result.cursorOpenUrl ? (
        <a className="block min-h-12 rounded-xl bg-brand px-4 py-3 text-center text-sm font-semibold text-white" href={result.cursorOpenUrl} target="_blank" rel="noreferrer">
          Open Cursor
        </a>
      ) : null}
    </section>
  );
}
