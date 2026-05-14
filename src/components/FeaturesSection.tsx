"use client";

import { useState, useCallback } from "react";
import {
  Feature,
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
    createdAt: now,
    updatedAt: now,
  };
}

function FeatureEditPanel({
  feature,
  onUpdate,
  onClose,
}: {
  feature: Feature;
  onUpdate: (f: Feature) => void;
  onClose: () => void;
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

      <select
        className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-700 outline-none"
        value={feature.status}
        onChange={(e) => set("status", e.target.value as FeatureStatus)}
      >
        {FEATURE_STATUSES.map((s) => (
          <option key={s} value={s}>{s}</option>
        ))}
      </select>

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
  onToggleExpand,
  onToggleEdit,
  onUpdate,
  onAddChild,
  onDelete,
  onBreakDown,
  onSendToBuild,
}: {
  feature: Feature;
  allFeatures: Feature[];
  depth: number;
  expandedIds: Set<string>;
  editingId: string | null;
  breakingDownId: string | null;
  onToggleExpand: (id: string) => void;
  onToggleEdit: (id: string) => void;
  onUpdate: (f: Feature) => void;
  onAddChild: (parentId: string) => void;
  onDelete: (id: string) => void;
  onBreakDown: (f: Feature) => void;
  onSendToBuild: (f: Feature) => void;
}) {
  const children = allFeatures.filter((f) => f.parentId === feature.id);
  const isExpanded = expandedIds.has(feature.id);
  const isEditing = editingId === feature.id;
  const isBreaking = breakingDownId === feature.id;
  const isLeaf = children.length === 0;

  return (
    <div className={depth > 0 ? "pl-4" : ""}>
      <div className="rounded-xl border border-slate-200 bg-white mb-1">
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
            <p className="text-sm font-semibold text-slate-900 truncate">
              {feature.title || "Untitled"}
            </p>
            <div className="mt-0.5 flex flex-wrap items-center gap-1">
              <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${FEATURE_STATUS_COLORS[feature.status]}`}>
                {feature.status}
              </span>
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
            {isLeaf && (
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
              onToggleExpand={onToggleExpand}
              onToggleEdit={onToggleEdit}
              onUpdate={onUpdate}
              onAddChild={onAddChild}
              onDelete={onDelete}
              onBreakDown={onBreakDown}
              onSendToBuild={onSendToBuild}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function FeaturesSection({ project, features, onFeaturesChange, onSendToBuild }: Props) {
  const [loading, setLoading] = useState(false);
  const [breakingDownId, setBreakingDownId] = useState<string | null>(null);
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
          createdAt: now,
          updatedAt: now,
        };
      });
      persist([...features, ...newFeatures]);
      const roots = newFeatures.filter((f) => f.parentId === null);
      setExpandedIds((prev) => {
        const next = new Set(prev);
        roots.forEach((r) => next.add(r.id));
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

  const handleSendToBuild = (feature: Feature) => {
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

  const handleAddChild = (parentId: string) => {
    const f = newFeature(project.id, parentId);
    persist([...features, f]);
    setEditingId(f.id);
    setExpandedIds((prev) => new Set([...prev, parentId]));
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

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-slate-700">Feature tree</p>
        <div className="flex gap-2">
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
              onToggleExpand={toggleExpand}
              onToggleEdit={toggleEdit}
              onUpdate={handleUpdate}
              onAddChild={handleAddChild}
              onDelete={handleDelete}
              onBreakDown={handleBreakDown}
              onSendToBuild={handleSendToBuild}
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
              onToggleExpand={toggleExpand}
              onToggleEdit={toggleEdit}
              onUpdate={handleUpdate}
              onAddChild={handleAddChild}
              onDelete={handleDelete}
              onBreakDown={handleBreakDown}
              onSendToBuild={handleSendToBuild}
            />
          ))}
        </div>
      )}
    </div>
  );
}
