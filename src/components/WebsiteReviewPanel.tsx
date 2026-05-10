"use client";

import { useState } from "react";
import { saveTaskPrefill } from "@/lib/ideaStorage";
import { TaskPrefill } from "@/lib/ideaTypes";
import { TASK_TYPE_OPTIONS, TaskType } from "@/lib/types";

type WebsiteReviewPanelProps = {
  defaultUrl?: string;
  repoFullName?: string;
  onClose: () => void;
};

export function WebsiteReviewPanel({ defaultUrl = "", repoFullName, onClose }: WebsiteReviewPanelProps) {
  const [url, setUrl] = useState(defaultUrl);
  const [frameLoaded, setFrameLoaded] = useState(false);
  const [frameBlocked, setFrameBlocked] = useState(false);
  const [notes, setNotes] = useState("");
  const [taskType, setTaskType] = useState<TaskType>("polish_ui");
  const [sent, setSent] = useState(false);

  const canPreview = url.trim().startsWith("http");
  const canSend = notes.trim().length > 0;

  const handleSend = () => {
    const prefill: TaskPrefill = {
      taskType,
      rawInput: notes.trim(),
      agentSuggestion: "cursor",
      repoFullName,
    };
    saveTaskPrefill(prefill);
    setSent(true);
    setTimeout(() => setSent(false), 2000);
  };

  return (
    <div className="rounded-xl border border-violet-200 bg-violet-50 p-3 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-bold text-violet-800">Review Website</p>
        <button type="button" onClick={onClose} className="text-xs text-violet-400 hover:text-violet-600">
          dismiss
        </button>
      </div>

      {/* URL bar */}
      <div className="flex gap-2">
        <input
          type="url"
          value={url}
          onChange={(e) => { setUrl(e.target.value); setFrameLoaded(false); setFrameBlocked(false); }}
          placeholder="https://…"
          className="flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-violet-400"
        />
        {url && (
          <a
            href={url}
            target="_blank"
            rel="noreferrer"
            className="shrink-0 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
          >
            Open ↗
          </a>
        )}
      </div>

      {/* Iframe preview */}
      {canPreview && (
        <div className="relative overflow-hidden rounded-xl border border-slate-200 bg-white" style={{ height: 420 }}>
          {!frameLoaded && !frameBlocked && (
            <div className="absolute inset-0 flex items-center justify-center text-xs text-slate-400">
              Loading preview…
            </div>
          )}
          {frameBlocked ? (
            <div className="flex h-full flex-col items-center justify-center gap-2 p-4 text-center">
              <p className="text-sm font-semibold text-slate-600">Preview blocked by site</p>
              <p className="text-xs text-slate-400">This site doesn't allow embedding. Open it in a new tab to review.</p>
              <a
                href={url}
                target="_blank"
                rel="noreferrer"
                className="mt-1 rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-brand hover:bg-slate-50"
              >
                Open in new tab ↗
              </a>
            </div>
          ) : (
            <iframe
              key={url}
              src={url}
              title="Site preview"
              className="h-full w-full border-0"
              onLoad={() => setFrameLoaded(true)}
              onError={() => setFrameBlocked(true)}
              sandbox="allow-scripts allow-same-origin allow-forms"
            />
          )}
        </div>
      )}

      {/* Notes */}
      <div>
        <label className="mb-1 block text-xs font-semibold text-slate-600">What did you find?</label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Describe what to fix or improve…"
          rows={3}
          className="w-full resize-none rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-violet-400"
        />
      </div>

      {/* Task type */}
      <div>
        <label className="mb-1 block text-xs font-semibold text-slate-600">Task type</label>
        <div className="-mx-0.5 flex flex-wrap gap-1">
          {TASK_TYPE_OPTIONS.filter((o) => ["polish_ui", "fix_bug", "new_feature", "fix_build"].includes(o.value)).map((o) => (
            <button
              key={o.value}
              type="button"
              onClick={() => setTaskType(o.value)}
              className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                taskType === o.value
                  ? "border-brand bg-brand text-white"
                  : "border-slate-200 bg-white text-slate-600"
              }`}
            >
              {o.label}
            </button>
          ))}
        </div>
      </div>

      <button
        type="button"
        onClick={handleSend}
        disabled={!canSend}
        className="w-full min-h-10 rounded-xl bg-brand px-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40 active:opacity-80"
      >
        {sent ? "Prefilled in Build ✓" : "→ Send Fix to Build Tab"}
      </button>
    </div>
  );
}
