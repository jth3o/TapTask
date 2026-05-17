"use client";

import { useState, useCallback } from "react";
import {
  Feature,
  FeaturePriority,
  FEATURE_PRIORITIES,
  FEATURE_PRIORITY_COLORS,
  FEATURE_PRIORITY_LABELS,
  FeatureStatus,
  FEATURE_STATUSES,
  FEATURE_STATUS_COLORS,
  IdeaProject,
  TaskPrefill,
  RawFeature,
  GenerateResponse,
} from "@/lib/ideaTypes";
import { AGENT_OPTIONS, TASK_TYPE_OPTIONS, Agent, TaskType } from "@/lib/types";

interface Props {
  project: IdeaProject;
  features: Feature[];
  onFeaturesChange: (features: Feature[]) => void;
  onSendToBuild: (prefill: TaskPrefill) => void;
}

function newFeature(projectId: string, parentId: string | null): Feature {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    projectId,
    parentId,
    title: "",
    description: "",
    placement: "",
    accessPath: "",
    taskType: "new_feature",
    suggestedAgent: "cursor",
    acceptanceCriteria: [""],
    nonGoals: [""],
    status: "backlog",
    priority: "should",
    createdAt: now,
    updatedAt: now,
  };
}

function normalizeForMatch(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
}

function featureMatchesPR(featureTitle: string, prTitle: string, branchName: string): boolean {
  const words = normalizeForMatch(featureTitle).split(" ").filter((w) => w.length > 3);
  if (words.length === 0) return false;
  const haystack = normalizeForMatch(prTitle) + " " + normalizeForMatch(branchName.replace(/-/g, " "));
  const matchCount = words.filter((w) => haystack.includes(w)).length;
  return matchCount / words.length >= 0.6;
}

function FeatureEditPanel({
  feature,
  onUpdate,
  onClose,
  onRefine,
  isRefining,
}: {
  feature: Feature;
  onUpdate: (f: Feature) => void;
  onClose: () => void;
  onRefine?: () => void;
  isRefining?: boolean;
}) {
  const set = <K extends keyof Feature>(key: K, val: Feature[K]) =>
    onUpdate({ ...feature, [key]: val, updatedAt: new Date().toISOString() });

  return (
    <div className="max-h-[60vh] overflow-y-auto space-y-2 border-t border-slate-100 bg-slate-50 p-3">
      <input
        className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm font-semibold text-slate-900 outline-none focus:border-brand"
        placeholder="Feature title…"
        value={feature.title}
        onChange={(e) => set("title", e.target.value)}
      />

      <textarea
        className="w-full resize-none rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-700 outline-none focus:border-brand"
        rows={2}
        placeholder="What does this feature do and why does it matter?"
        value={feature.description}
        onChange={(e) => set("description", e.target.value)}
      />

      {onRefine && (
        <button
          type="button"
          onClick={onRefine}
          disabled={isRefining}
          className="w-full rounded-lg border border-brand/30 bg-blue-50 py-1.5 text-xs font-semibold text-brand hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isRefining ? "Refining…" : "✦ Refine criteria & non-goals"}
        </button>
      )}

      <input
        className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-700 outline-none focus:border-brand"
        placeholder="Placement — e.g. Settings → Profile tab"
        value={feature.placement}
        onChange={(e) => set("placement", e.target.value)}
      />

      <input
        className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-700 outline-none focus:border-brand"
        placeholder="Access path — e.g. Tap avatar → Settings → Profile"
        value={feature.accessPath}
        onChange={(e) => set("accessPath", e.target.value)}
      />

      <div className="flex gap-2">
        <select
          className="flex-1 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-700 outline-none"
          value={feature.taskType}
          onChange={(e) => set("taskType", e.target.value as TaskType)}
        >
          {TASK_TYPE_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
        <select
          className="flex-1 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-700 outline-none"
          value={feature.suggestedAgent}
          onChange={(e) => set("suggestedAgent", e.target.value as Agent)}
        >
          {AGENT_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </div>

      <div>
        <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400">Acceptance criteria</p>
        {feature.acceptanceCriteria.map((c, i) => (
          <div key={i} className="mb-1 flex gap-1">
            <input
              className="flex-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-700 outline-none focus:border-brand"
              placeholder="Criterion…"
              value={c}
              onChange={(e) => {
                const next = [...feature.acceptanceCriteria];
                next[i] = e.target.value;
                set("acceptanceCriteria", next);
              }}
            />
            <button
              type="button"
              onClick={() => set("acceptanceCriteria", feature.acceptanceCriteria.filter((_, j) => j !== i))}
              className="px-2 text-slate-300 hover:text-red-400"
            >×</button>
          </div>
        ))}
        <button
          type="button"
          onClick={() => set("acceptanceCriteria", [...feature.acceptanceCriteria, ""])}
          className="text-xs text-slate-400 hover:text-slate-600"
        >+ Add criterion</button>
      </div>

      <div>
        <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400">Non-goals</p>
        {feature.nonGoals.map((g, i) => (
          <div key={i} className="mb-1 flex gap-1">
            <input
              className="flex-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-700 outline-none focus:border-brand"
              placeholder="Not in scope…"
              value={g}
              onChange={(e) => {
                const next = [...feature.nonGoals];
                next[i] = e.target.value;
                set("nonGoals", next);
              }}
            />
            <button
              type="button"
              onClick={() => set("nonGoals", feature.nonGoals.filter((_, j) => j !== i))}
              className="px-2 text-slate-300 hover:text-red-400"
            >×</button>
          </div>
        ))}
        <button
          type="button"
          onClick={() => set("nonGoals", [...feature.nonGoals, ""])}
          className="text-xs text-slate-400 hover:text-slate-600"
        >+ Add non-goal</button>
      </div>

      <div className="flex gap-2">
        <select
          className="flex-1 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-700 outline-none"
          value={feature.status}
          onChange={(e) => set("status", e.target.value as FeatureStatus)}
        >
          {FEATURE_STATUSES.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        <select
          className="flex-1 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-700 outline-none"
          value={feature.priority ?? "should"}
          onChange={(e) => set("priority", e.target.value as FeaturePriority)}
        >
          {FEATURE_PRIORITIES.map((p) => (
            <option key={p} value={p}>{FEATURE_PRIORITY_LABELS[p]}</option>
          ))}
        </select>
      </div>

      <button
        type="button"
        onClick={onClose}
        className="text-xs text-slate-400 hover:text-slate-600"
      >Done editing</button>
    </div>
  );
}

function FeatureRow({
  feature,
  allFeatures,
  depth,
  expandedIds,
  editingId,
  breakingDownId,
  refiningId,
  onToggleExpand,
  onToggleEdit,
  onUpdate,
  onDelete,
  onBreakDown,
  onSendToBuild,
  onRefine,
}: {
  feature: Feature;
  allFeatures: Feature[];
  depth: number;
  expandedIds: Set<string>;
  editingId: string | null;
  breakingDownId: string | null;
  refiningId: string | null;
  onToggleExpand: (id: string) => void;
  onToggleEdit: (id: string) => void;
  onUpdate: (f: Feature) => void;
  onDelete: (id: string) => void;
  onBreakDown: (f: Feature) => void;
  onSendToBuild: (f: Feature) => void;
  onRefine: (f: Feature) => void;
}) {
  const children = allFeatures.filter((f) => f.parentId === feature.id);
  const isExpanded = expandedIds.has(feature.id);
  const isEditing = editingId === feature.id;
  const isLeaf = children.length === 0;
  const isDone = feature.status === "done";
  const isBreaking = breakingDownId === feature.id;

  return (
    <div className={depth > 0 ? "pl-4" : ""}>
      <div className={`rounded-xl border mb-1 ${isDone ? "border-emerald-200 bg-emerald-50/40" : "border-slate-200 bg-white"}`}>
        <div className="flex items-start gap-2 p-2.5">
          {children.length > 0 ? (
            <button
              type="button"
              onClick={() => onToggleExpand(feature.id)}
              className="mt-0.5 shrink-0 text-slate-400 hover:text-slate-600"
            >
              {isExpanded ? "▾" : "▸"}
            </button>
          ) : (
            <span className="mt-0.5 w-3 shrink-0" />
          )}

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <p className={`text-sm font-semibold truncate ${isDone ? "line-through text-slate-400" : "text-slate-900"}`}>
                {feature.title || "Untitled"}
              </p>
              {isDone && feature.prUrl && (
                <a
                  href={feature.prUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="shrink-0 rounded-full bg-emerald-100 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700 hover:underline"
                >
                  ✓ merged
                </a>
              )}
              {!isDone && feature.prUrl && (
                <a
                  href={feature.prUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="shrink-0 rounded-full bg-purple-100 px-1.5 py-0.5 text-[10px] font-semibold text-purple-700 hover:underline"
                >
                  PR open
                </a>
              )}
            </div>
            <div className="mt-0.5 flex flex-wrap items-center gap-1">
              <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${FEATURE_STATUS_COLORS[feature.status]}`}>
                {feature.status}
              </span>
              <select
                className={`rounded-full border-0 px-2 py-0.5 text-[10px] font-semibold outline-none cursor-pointer ${FEATURE_PRIORITY_COLORS[feature.priority ?? "should"]}`}
                value={feature.priority ?? "should"}
                onClick={(e) => e.stopPropagation()}
                onChange={(e) => onUpdate({ ...feature, priority: e.target.value as FeaturePriority, updatedAt: new Date().toISOString() })}
              >
                {FEATURE_PRIORITIES.map((p) => (
                  <option key={p} value={p}>{FEATURE_PRIORITY_LABELS[p]}</option>
                ))}
              </select>
              {feature.placement && (
                <span className="truncate text-[10px] text-slate-400">{feature.placement}</span>
              )}
            </div>
            {feature.description && !isEditing && (
              <p className="mt-1 text-xs text-slate-500 line-clamp-2">{feature.description}</p>
            )}
          </div>

          <div className="flex shrink-0 flex-col gap-1">
            <button
              type="button"
              onClick={() => onToggleEdit(feature.id)}
              className="rounded-lg border border-slate-200 px-2 py-1 text-[10px] text-slate-500 hover:bg-slate-50"
            >
              {isEditing ? "Close" : "Edit"}
            </button>
            <button
              type="button"
              onClick={() => onBreakDown(feature)}
              disabled={isBreaking}
              className="rounded-lg border border-slate-200 px-2 py-1 text-[10px] text-slate-500 hover:bg-slate-50 disabled:opacity-50"
            >
              {isBreaking ? "…" : "Break"}
            </button>
            {isLeaf && !isDone && (
              <button
                type="button"
                onClick={() => onSendToBuild(feature)}
                className="rounded-lg bg-brand px-2 py-1 text-[10px] font-semibold text-white"
              >
                → Build
              </button>
            )}
            <button
              type="button"
              onClick={() => onDelete(feature.id)}
              className="rounded-lg px-2 py-1 text-[10px] text-red-400 hover:text-red-600"
            >
              Del
            </button>
          </div>
        </div>

        {isEditing && (
          <FeatureEditPanel
            feature={feature}
            onUpdate={onUpdate}
            onClose={() => onToggleEdit(feature.id)}
            onRefine={() => onRefine(feature)}
            isRefining={refiningId === feature.id}
          />
        )}
      </div>

      {isExpanded && children.length > 0 && (
        <div>
          {children.map((child) => (
            <FeatureRow
              key={child.id}
              feature={child}
              allFeatures={allFeatures}
              depth={depth + 1}
              expandedIds={expandedIds}
              editingId={editingId}
              breakingDownId={breakingDownId}
              refiningId={refiningId}
              onToggleExpand={onToggleExpand}
              onToggleEdit={onToggleEdit}
              onUpdate={onUpdate}
              onDelete={onDelete}
              onBreakDown={onBreakDown}
              onSendToBuild={onSendToBuild}
              onRefine={onRefine}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function FeaturesSection({ project, features, onFeaturesChange, onSendToBuild }: Props) {
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [breakingDownId, setBreakingDownId] = useState<string | null>(null);
  const [refiningId, setRefiningId] = useState<string | null>(null);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [error, setError] = useState("");
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [editingId, setEditingId] = useState<string | null>(null);

  const persist = useCallback(
    (next: Feature[]) => { onFeaturesChange(next); },
    [onFeaturesChange]
  );

  const handleGenerate = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/ideas/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "features", project }),
      });
      const data = (await res.json()) as GenerateResponse;
      if (data.error) { setError(data.error); return; }
      const rawItems = (data.result ?? []) as RawFeature[];
      const now = new Date().toISOString();
      const idMap = new Map<number, string>();
      const newFeatures: Feature[] = rawItems.map((raw, i) => {
        const id = crypto.randomUUID();
        idMap.set(i, id);
        return {
          id,
          projectId: project.id,
          parentId: raw.parentIndex === -1 ? null : (idMap.get(raw.parentIndex) ?? null),
          title: raw.title,
          description: raw.description,
          placement: raw.placement,
          accessPath: raw.accessPath,
          taskType: raw.taskType as TaskType,
          suggestedAgent: raw.suggestedAgent as Agent,
          acceptanceCriteria: raw.acceptanceCriteria ?? [],
          nonGoals: raw.nonGoals ?? [],
          status: "backlog",
          priority: (raw.priority as FeaturePriority) ?? "should",
          createdAt: now,
          updatedAt: now,
        };
      });
      persist([...features, ...newFeatures]);
      // Auto-expand root features that have children
      const rootsWithChildren = newFeatures.filter(
        (f) => f.parentId === null && newFeatures.some((c) => c.parentId === f.id)
      );
      setExpandedIds((prev) => {
        const next = new Set(prev);
        rootsWithChildren.forEach((r) => next.add(r.id));
        return next;
      });
    } catch {
      setError("Generation failed. Check your network connection.");
    } finally {
      setLoading(false);
    }
  };

  const handleBreakDown = async (parent: Feature) => {
    if (breakingDownId) return;
    setBreakingDownId(parent.id);
    setError("");
    try {
      const res = await fetch("/api/ideas/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "sub_features",
          project,
          parentFeature: { title: parent.title, description: parent.description, placement: parent.placement },
        }),
      });
      const data = (await res.json()) as GenerateResponse;
      if (data.error) { setError(data.error); return; }
      const rawItems = (data.result ?? []) as RawFeature[];
      const now = new Date().toISOString();
      const newFeatures: Feature[] = rawItems.map((raw) => ({
        id: crypto.randomUUID(),
        projectId: project.id,
        parentId: parent.id,
        title: raw.title,
        description: raw.description,
        placement: raw.placement,
        accessPath: raw.accessPath,
        taskType: raw.taskType as TaskType,
        suggestedAgent: raw.suggestedAgent as Agent,
        acceptanceCriteria: raw.acceptanceCriteria ?? [],
        nonGoals: raw.nonGoals ?? [],
        status: "backlog",
        priority: (raw.priority as FeaturePriority) ?? "should",
        createdAt: now,
        updatedAt: now,
      }));
      persist([...features, ...newFeatures]);
      setExpandedIds((prev) => new Set([...prev, parent.id]));
    } catch {
      setError("Sub-feature generation failed.");
    } finally {
      setBreakingDownId(null);
    }
  };

  const handleRefine = async (feature: Feature) => {
    if (refiningId) return;
    setRefiningId(feature.id);
    setError("");
    try {
      const res = await fetch("/api/ideas/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "refine_feature",
          project,
          featureToRefine: {
            title: feature.title,
            description: feature.description,
            placement: feature.placement,
            acceptanceCriteria: feature.acceptanceCriteria,
            nonGoals: feature.nonGoals,
          },
        }),
      });
      const data = (await res.json()) as GenerateResponse;
      if (data.error) { setError(data.error); return; }
      const refined = data.result as { acceptanceCriteria: string[]; nonGoals: string[] };
      if (refined?.acceptanceCriteria) {
        persist(features.map((f) =>
          f.id === feature.id
            ? { ...f, acceptanceCriteria: refined.acceptanceCriteria, nonGoals: refined.nonGoals ?? f.nonGoals, updatedAt: new Date().toISOString() }
            : f
        ));
      }
    } catch {
      setError("Refine failed. Check your network connection.");
    } finally {
      setRefiningId(null);
    }
  };

  const handleChat = async () => {
    const msg = chatInput.trim();
    if (!msg || chatLoading) return;
    setChatLoading(true);
    setChatInput("");
    setError("");
    try {
      const res = await fetch("/api/ideas/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "add_feature", project, userMessage: msg }),
      });
      const data = (await res.json()) as GenerateResponse;
      if (data.error) { setError(data.error); return; }
      const rawItems = (data.result ?? []) as RawFeature[];
      const now = new Date().toISOString();
      const idMap = new Map<number, string>();
      const newFeatures: Feature[] = rawItems.map((raw, i) => {
        const id = crypto.randomUUID();
        idMap.set(i, id);
        return {
          id,
          projectId: project.id,
          parentId: raw.parentIndex === -1 ? null : (idMap.get(raw.parentIndex) ?? null),
          title: raw.title,
          description: raw.description,
          placement: raw.placement,
          accessPath: raw.accessPath,
          taskType: raw.taskType as TaskType,
          suggestedAgent: raw.suggestedAgent as Agent,
          acceptanceCriteria: raw.acceptanceCriteria ?? [],
          nonGoals: raw.nonGoals ?? [],
          status: "backlog",
          priority: (raw.priority as FeaturePriority) ?? "should",
          createdAt: now,
          updatedAt: now,
        };
      });
      persist([...features, ...newFeatures]);
      const root = newFeatures.find((f) => f.parentId === null);
      if (root && newFeatures.some((f) => f.parentId === root.id)) {
        setExpandedIds((prev) => new Set([...prev, root.id]));
      }
    } catch {
      setError("Failed to add feature. Check your network connection.");
    } finally {
      setChatLoading(false);
    }
  };

  const handleSyncRepo = async () => {
    if (!project.githubRepoUrl) return;
    const repoFullName = project.githubRepoUrl.replace("https://github.com/", "").replace(/\/$/, "");
    setSyncing(true);
    setError("");
    try {
      const res = await fetch(`/api/github/pulls?repoFullName=${encodeURIComponent(repoFullName)}&state=all`);
      const data = (await res.json()) as { pulls?: { title: string; htmlUrl: string; headBranch: string; merged: boolean }[]; error?: string };
      if (data.error) { setError(data.error); return; }
      const prs = data.pulls ?? [];
      const now = new Date().toISOString();
      const updated = features.map((f) => {
        const match = prs.find((pr) => featureMatchesPR(f.title, pr.title, pr.headBranch));
        if (!match) return f;
        return {
          ...f,
          prUrl: match.htmlUrl,
          status: match.merged ? ("done" as FeatureStatus) : f.status,
          updatedAt: now,
        };
      });
      persist(updated);
    } catch {
      setError("Sync failed. Check your network connection.");
    } finally {
      setSyncing(false);
    }
  };

  const handleSendToBuild = (feature: Feature) => {
    persist(features.map((f) =>
      f.id === feature.id
        ? { ...f, status: "in_progress" as const, updatedAt: new Date().toISOString() }
        : f
    ));

    const criteria = feature.acceptanceCriteria.filter(Boolean);
    const nonGoals = feature.nonGoals.filter(Boolean);
    const rawInput = [
      `[Project: ${project.name}]`,
      project.problem ? `Problem: ${project.problem}` : null,
      "",
      feature.title,
      feature.description || null,
      feature.placement ? `Location: ${feature.placement}` : null,
      feature.accessPath ? `Access: ${feature.accessPath}` : null,
      "",
      criteria.length > 0 ? `Acceptance Criteria:\n${criteria.map((c) => `- ${c}`).join("\n")}` : null,
      nonGoals.length > 0 ? `Non-Goals:\n${nonGoals.map((g) => `- ${g}`).join("\n")}` : null,
    ].filter((l) => l !== null).join("\n").trim();

    onSendToBuild({
      taskType: feature.taskType,
      rawInput,
      agentSuggestion: feature.suggestedAgent,
      repoFullName: project.githubRepoUrl
        ? project.githubRepoUrl.replace("https://github.com/", "").replace(/\/$/, "")
        : undefined,
      sourceItemId: feature.id,
    });
  };

  const handleUpdate = (updated: Feature) => {
    persist(features.map((f) => (f.id === updated.id ? updated : f)));
  };

  const handleDelete = (id: string) => {
    const toDelete = new Set<string>();
    const queue = [id];
    while (queue.length > 0) {
      const cur = queue.shift()!;
      toDelete.add(cur);
      features.filter((f) => f.parentId === cur).forEach((f) => queue.push(f.id));
    }
    persist(features.filter((f) => !toDelete.has(f.id)));
  };

  const handleAddRoot = () => {
    const f = newFeature(project.id, null);
    persist([...features, f]);
    setEditingId(f.id);
  };

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleEdit = (id: string) => {
    setEditingId((prev) => (prev === id ? null : id));
  };

  const rootFeatures = features.filter((f) => f.parentId === null);
  const orphans = features.filter(
    (f) => f.parentId !== null && !features.find((p) => p.id === f.parentId)
  );

  const doneCount = features.filter((f) => f.status === "done").length;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-slate-700">
          Feature tree
          {features.length > 0 && doneCount > 0 && (
            <span className="ml-1.5 text-xs font-normal text-emerald-600">{doneCount}/{features.length} done</span>
          )}
        </p>
        <div className="flex gap-2">
          {project.githubRepoUrl && features.length > 0 && (
            <button
              type="button"
              onClick={handleSyncRepo}
              disabled={syncing}
              className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-600 hover:border-slate-300 hover:bg-slate-50 disabled:opacity-50"
            >
              {syncing ? "…" : "⟳ Sync repo"}
            </button>
          )}
          <button
            type="button"
            onClick={handleGenerate}
            disabled={loading}
            className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-600 hover:border-slate-300 hover:bg-slate-50 disabled:opacity-50"
          >
            {loading ? "…" : "✦ Generate"}
          </button>
          <button
            type="button"
            onClick={handleAddRoot}
            className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"
          >
            + Add
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-700">
          {error}
        </div>
      )}

      {features.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-200 p-3 text-xs text-slate-400">
          No features yet. Generate a draft or add manually.
        </p>
      ) : (
        <div>
          {rootFeatures.map((f) => (
            <FeatureRow
              key={f.id}
              feature={f}
              allFeatures={features}
              depth={0}
              expandedIds={expandedIds}
              editingId={editingId}
              breakingDownId={breakingDownId}
              refiningId={refiningId}
              onToggleExpand={toggleExpand}
              onToggleEdit={toggleEdit}
              onUpdate={handleUpdate}
              onDelete={handleDelete}
              onBreakDown={handleBreakDown}
              onSendToBuild={handleSendToBuild}
              onRefine={handleRefine}
            />
          ))}
          {orphans.map((f) => (
            <FeatureRow
              key={f.id}
              feature={f}
              allFeatures={features}
              depth={0}
              expandedIds={expandedIds}
              editingId={editingId}
              breakingDownId={breakingDownId}
              refiningId={refiningId}
              onToggleExpand={toggleExpand}
              onToggleEdit={toggleEdit}
              onUpdate={handleUpdate}
              onDelete={handleDelete}
              onBreakDown={handleBreakDown}
              onSendToBuild={handleSendToBuild}
              onRefine={handleRefine}
            />
          ))}
        </div>
      )}

      {/* Chat input */}
      <div className="flex gap-2 pt-1">
        <input
          type="text"
          className="flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-brand placeholder:text-slate-400"
          placeholder="Describe a feature to add…"
          value={chatInput}
          onChange={(e) => setChatInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleChat(); } }}
          disabled={chatLoading}
        />
        <button
          type="button"
          onClick={handleChat}
          disabled={chatLoading || !chatInput.trim()}
          className="shrink-0 rounded-xl bg-brand px-4 py-2 text-sm font-semibold text-white disabled:opacity-40"
        >
          {chatLoading ? "…" : "Add"}
        </button>
      </div>
    </div>
  );
}
