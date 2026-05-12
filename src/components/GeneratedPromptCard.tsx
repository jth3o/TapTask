interface GeneratedPromptCardProps {
  prompt: string;
  copied: boolean;
  creatingIssue: boolean;
  issueUrl: string;
  issueCreated: boolean;
  showClaudeButton: boolean;
  sendingClaude: boolean;
  claudeSent: boolean;
  onCopy: () => void;
  onCreateIssue: () => void;
  onSendToClaude: () => void;
}

export function GeneratedPromptCard({
  prompt,
  copied,
  creatingIssue,
  issueUrl,
  issueCreated,
  showClaudeButton,
  sendingClaude,
  claudeSent,
  onCopy,
  onCreateIssue,
  onSendToClaude
}: GeneratedPromptCardProps) {
  if (!prompt) return null;

  return (
    <section className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <h3 className="text-base font-semibold text-slate-900">Generated Prompt</h3>
      <pre className="max-h-72 overflow-auto whitespace-pre-wrap rounded-xl bg-slate-50 p-3 text-xs text-slate-700">{prompt}</pre>
      <div className="grid grid-cols-2 gap-2">
        <button type="button" onClick={onCopy} className="min-h-12 rounded-xl bg-brand px-4 text-sm font-semibold text-white">
          {copied ? "Copied" : "Copy Prompt"}
        </button>
        <button
          type="button"
          onClick={onCreateIssue}
          disabled={creatingIssue || issueCreated}
          className="min-h-12 rounded-xl bg-slate-900 px-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
        >
          {issueCreated ? "Issue Created" : creatingIssue ? "Creating..." : "Create Issue"}
        </button>
      </div>
      {issueUrl ? (
        <a className="block rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm font-semibold text-emerald-700" href={issueUrl} target="_blank" rel="noreferrer">
          View created issue
        </a>
      ) : null}
      {showClaudeButton && issueCreated ? (
        <button
          type="button"
          onClick={onSendToClaude}
          disabled={sendingClaude || claudeSent}
          className="min-h-12 w-full rounded-xl bg-violet-600 px-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
        >
          {claudeSent ? "Sent to Claude" : sendingClaude ? "Sending..." : "Send to Claude"}
        </button>
      ) : null}
    </section>
  );
}
