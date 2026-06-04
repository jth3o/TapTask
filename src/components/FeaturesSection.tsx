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
  MinutesEstimate,
  MINUTES_ESTIMATE_COLORS,
  IdeaProject,
  TaskPrefill,
  RawFeature,
  GenerateResponse,
  Goal,
  GoalStatus,
  GOAL_STATUSES,
  GOAL_STATUS_COLORS,
  GOAL_STATUS_LABELS,
  RawGoal,
} from "@/lib/ideaTypes";
import { AGENT_OPTIONS, TASK_TYPE_OPTIONS, Agent, TaskType, ActiveTask, QueuedTaskPayload } from "@/lib/types";
import { getActiveProjectCycle, getCompletedProjectCycles } from "@/lib/projectCycleStorage";
import { upsertActiveTask } from "@/lib/taskStorage";
import { CycleContext } from "@/lib/ideaTypes";

interface Props {
  project: IdeaProject;
  features: Feature[];
  onFeaturesChange: (features: Feature[]) => void;
  onSendToBuild: (prefill: TaskPrefill) => void;
  onTasksQueued?: (tasks: ActiveTask[]) => void;
  goals: Goal[];
  onGoalsChange: (goals: Goal[]) => void;
  cycleId?: string;
  cycleContext?: CycleContext;
}

function newFeature(projectId: string, parentId: string | null, goalId?: string): Feature {
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
    goalId: goalId ?? null,
    createdAt: now,
    updatedAt: now,
  };
}

function normalizeForMatch(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
}

function featureMatchesPR(featureTitle: string, prTitle: string, branchName: string): boolean {
  const words = normalizeForMatch(featureTitle).split(" ").filter((w) => w.length > 4);
  if (words.length < 2) return false;
  const haystack = normalizeForMatch(prTitle) + " " + normalizeForMatch(branchName.replace(/-/g, " "));
  const matchCount = words.filter((w) => haystack.includes(w)).length;
  return matchCount >= 2 && matchCount / words.length >= 0.75;
}

function FeatureEditPanel({
  feature,
  allFeatures,
  onUpdate,
  onClose,
  onRefine,
  isRefining,
  goals,
}: {
  feature: Feature;
  allFeatures: Feature[];
  onUpdate: (f: Feature) => void;
  onClose: () => void;
  onRefine?: () => void;
  isRefining?: boolean;
  goals: Goal[];
}) {
  const set = <K extends keyof Feature>(key: K, val: Feature[K]) =>
    onUpdate({ ...feature, [key]: val, updatedAt: new Date().toISOString() });

  const duplicate = feature.title.trim().length > 2
    ? allFeatures.find(
        (f) => f.id !== feature.id &&
          f.title.trim().toLowerCase() === feature.title.trim().toLowerCase()
      )
    : null;

  return (
    <div className="max-h-[60vh] overflow-y-auto space-y-2 border-t border-slate-100 bg-slate-50 p-3">
      <input
        className={`w-full rounded-lg border bg-white px-2.5 py-1.5 text-sm font-semibold text-slate-900 outline-none focus:border-brand ${duplicate ? "border-amber-400" : "border-slate-200"}`}
        placeholder="Feature title…"
        value={feature.title}
        onChange={(e) => set("title", e.target.value)}
      />
      {duplicate && (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-xs text-amber-700">
          A feature named &ldquo;{duplicate.title}&rdquo; already exists. Consider editing that one instead.
        </p>
      )}

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

      {goals.length > 0 && (
        <div>
          <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400">Goal</p>
          <select
            className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-700 outline-none"
            value={feature.goalId ?? ""}
            onChange={(e) => set("goalId", e.target.value || null)}
          >
            <option value="">Ungrouped</option>
            {goals.map((g) => (
              <option key={g.id} value={g.id}>{g.title}</option>
            ))}
          </select>
        </div>
      )}

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
  goals,
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
  onPromoteToGoal,
}: {
  feature: Feature;
  allFeatures: Feature[];
  goals: Goal[];
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
  onPromoteToGoal?: (f: Feature) => void;
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
              {feature.buildOrder != null && (
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-500">
                  #{feature.buildOrder}
                </span>
              )}
              {feature.minutesEstimate && (
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${MINUTES_ESTIMATE_COLORS[feature.minutesEstimate]}`}>
                  {feature.minutesEstimate}
                </span>
              )}
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
            {onPromoteToGoal && (
              <button
                type="button"
                onClick={() => onPromoteToGoal(feature)}
                className="rounded-lg border border-slate-200 px-2 py-1 text-[10px] text-slate-500 hover:bg-slate-50"
              >
                ↑ Goal
              </button>
            )}
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
            allFeatures={allFeatures}
            onUpdate={onUpdate}
            onClose={() => onToggleEdit(feature.id)}
            onRefine={() => onRefine(feature)}
            isRefining={refiningId === feature.id}
            goals={goals}
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
              goals={goals}
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

function DependencyChain({
  features,
  allFeatures,
  goals,
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
  features: Feature[];
  allFeatures: Feature[];
  goals: Goal[];
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
  const sorted = [...features].sort((a, b) => (a.buildOrder ?? 999) - (b.buildOrder ?? 999));
  return (
    <div className="relative pl-5">
      {/* vertical connector line */}
      <div className="absolute left-2 top-3 bottom-3 w-px bg-slate-200" />
      {sorted.map((f, i) => (
        <div key={f.id} className="relative mb-2">
          {/* node dot */}
          <div className={`absolute -left-3 top-4 h-2.5 w-2.5 rounded-full border-2 ${
            f.status === "done" ? "border-emerald-400 bg-emerald-100" : "border-slate-300 bg-white"
          }`} />
          {/* horizontal connector */}
          {i < sorted.length - 1 && (
            <div className="absolute -left-2.5 top-7 h-px w-2 bg-slate-200" />
          )}
          <FeatureRow
            feature={f}
            allFeatures={allFeatures}
            goals={goals}
            depth={0}
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
        </div>
      ))}
    </div>
  );
}

function GoalSection({
  goal,
  goalFeatures,
  allFeatures,
  goals,
  onGoalUpdate,
  onGoalDelete,
  onAddFeature,
  onGenerateFeatures,
  generatingFeatures,
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
  onQueueBranch,
  queueingBranch,
}: {
  goal: Goal;
  goalFeatures: Feature[];
  allFeatures: Feature[];
  goals: Goal[];
  onGoalUpdate: (g: Goal) => void;
  onGoalDelete: () => void;
  onAddFeature: () => void;
  onGenerateFeatures: () => void;
  generatingFeatures: boolean;
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
  onQueueBranch?: () => void;
  queueingBranch?: boolean;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const [editingTitle, setEditingTitle] = useState(false);
  const doneCount = goalFeatures.filter((f) => f.status === "done").length;
  const hasBuildOrder = goalFeatures.some((f) => f.buildOrder != null);
  const now = new Date().toISOString();

  return (
    <div className="mb-2 overflow-hidden rounded-2xl border border-slate-200 bg-white">
      <div className="flex items-center gap-2 border-b border-slate-100 bg-slate-50 px-3 py-2">
        <button
          type="button"
          onClick={() => setCollapsed((v) => !v)}
          className="shrink-0 text-xs text-slate-400 hover:text-slate-600"
        >
          {collapsed ? "▸" : "▾"}
        </button>
        {editingTitle ? (
          <input
            className="flex-1 bg-transparent text-sm font-semibold text-slate-900 outline-none"
            value={goal.title}
            onChange={(e) => onGoalUpdate({ ...goal, title: e.target.value, updatedAt: now })}
            onBlur={() => setEditingTitle(false)}
            autoFocus
          />
        ) : (
          <p
            className="flex-1 cursor-text text-sm font-semibold text-slate-900"
            onClick={() => setEditingTitle(true)}
          >
            {goal.title || "Untitled goal"}
          </p>
        )}
        <span className="shrink-0 text-[10px] text-slate-400">
          {goalFeatures.length} feature{goalFeatures.length !== 1 ? "s" : ""}
          {doneCount > 0 ? `, ${doneCount} done` : ""}
        </span>
        <select
          className={`shrink-0 cursor-pointer rounded-full border-0 px-2 py-0.5 text-[10px] font-semibold outline-none ${GOAL_STATUS_COLORS[goal.status]}`}
          value={goal.status}
          onChange={(e) => onGoalUpdate({ ...goal, status: e.target.value as GoalStatus, updatedAt: now })}
        >
          {GOAL_STATUSES.map((s) => (
            <option key={s} value={s}>{GOAL_STATUS_LABELS[s]}</option>
          ))}
        </select>
        <button
          type="button"
          onClick={onGenerateFeatures}
          disabled={generatingFeatures}
          className="shrink-0 rounded-lg border border-slate-200 bg-white px-2 py-0.5 text-[10px] font-semibold text-slate-500 hover:bg-slate-50 disabled:opacity-50"
        >
          {generatingFeatures ? "…" : "✦ Generate"}
        </button>
        {hasBuildOrder && onQueueBranch && goalFeatures.some((f) => f.status !== "done") && (
          <button
            type="button"
            onClick={onQueueBranch}
            disabled={queueingBranch}
            className="shrink-0 rounded-lg border border-violet-200 bg-violet-50 px-2 py-0.5 text-[10px] font-semibold text-violet-700 hover:bg-violet-100 disabled:opacity-50"
          >
            {queueingBranch ? "…" : "Queue →"}
          </button>
        )}
        <button
          type="button"
          onClick={onGoalDelete}
          className="shrink-0 text-[10px] text-red-300 hover:text-red-500"
        >
          ✕
        </button>
      </div>

      {!collapsed && (
        <div className="p-2">
          {goalFeatures.length === 0 ? (
            <p className="px-1 py-1 text-xs text-slate-400">No features yet.</p>
          ) : hasBuildOrder ? (
            <DependencyChain
              features={goalFeatures}
              allFeatures={allFeatures}
              goals={goals}
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
          ) : (
            goalFeatures.map((f) => (
              <FeatureRow
                key={f.id}
                feature={f}
                allFeatures={allFeatures}
                goals={goals}
                depth={0}
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
            ))
          )}
          <button
            type="button"
            onClick={onAddFeature}
            className="mt-1 text-xs text-slate-400 hover:text-slate-600"
          >
            + Add feature
          </button>
        </div>
      )}
    </div>
  );
}

export function FeaturesSection({ project, features, onFeaturesChange, onSendToBuild, onTasksQueued, goals, onGoalsChange, cycleId, cycleContext }: Props) {
  const [goalGeneratingId, setGoalGeneratingId] = useState<string | null>(null);
  const [goalGenerating, setGoalGenerating] = useState(false); // for "✦ Goals" button
  const [queueingGoalId, setQueueingGoalId] = useState<string | null>(null);
  const [queueBanner, setQueueBanner] = useState("");
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

  const handleGenerateForGoal = async (goal: Goal) => {
    if (goalGeneratingId) return;
    setGoalGeneratingId(goal.id);
    setError("");
    try {
      // Include ALL project features so the model knows what's built across every goal
      const existingFeatures = features.map((f) => ({ title: f.title, status: f.status, goalId: f.goalId ?? null }));
      const completedCycles = getCompletedProjectCycles(project.id)
        .filter((c) => c.decision !== "undecided")
        .map((c) => ({ cycleNumber: c.cycleNumber, goal: c.goal, decision: c.decision, evidenceNotes: c.evidenceNotes }));
      const res = await fetch("/api/ideas/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "features", project, targetGoal: { title: goal.title, description: goal.description }, existingFeatures, cycleContext, completedCycles }),
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
          buildOrder: raw.buildOrder,
          minutesEstimate: raw.minutesEstimate as MinutesEstimate | undefined,
          goalId: goal.id,
          createdAt: now,
          updatedAt: now,
        };
      });
      persist([...features, ...newFeatures]);
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
      setGoalGeneratingId(null);
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
          cycleContext,
          existingFeatures: features.map((f) => ({ title: f.title, status: f.status, goalId: f.goalId ?? null })),
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
        buildOrder: raw.buildOrder,
        minutesEstimate: raw.minutesEstimate as MinutesEstimate | undefined,
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
        body: JSON.stringify({
          action: "add_feature",
          project,
          userMessage: msg,
          cycleContext,
          existingFeatures: features.map((f) => ({ title: f.title, status: f.status, goalId: f.goalId ?? null })),
        }),
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
          buildOrder: raw.buildOrder,
          minutesEstimate: raw.minutesEstimate as MinutesEstimate | undefined,
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
      const res = await fetch(`/api/github/pulls?repoFullName=${encodeURIComponent(repoFullName)}&state=open`);
      const data = (await res.json()) as { pulls?: { title: string; htmlUrl: string; headBranch: string; merged: boolean }[]; error?: string };
      if (data.error) { setError(data.error); return; }
      const prs = data.pulls ?? [];
      const prByUrl = new Map(prs.map((pr) => [pr.htmlUrl, pr]));
      const now = new Date().toISOString();
      const updated = features.map((f) => {
        if (f.prUrl) {
          const existing = prByUrl.get(f.prUrl);
          if (existing) return f; // known open PR — no change
          // prUrl not found in open PRs — stale link, clear it and fall through to fuzzy match
        }
        const match = prs.find((pr) => featureMatchesPR(f.title, pr.title, pr.headBranch));
        if (!match) return { ...f, prUrl: undefined };
        // Link the open PR but don't change status — only a real merge marks a feature done
        return { ...f, prUrl: match.htmlUrl, updatedAt: now };
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
    const goalTitle = feature.goalId ? goals.find((g) => g.id === feature.goalId)?.title : null;
    const activeCycle = getActiveProjectCycle(project.id);
    const cc = cycleContext ?? (activeCycle ? {
      cycleNumber: activeCycle.cycleNumber,
      title: activeCycle.title,
      goal: activeCycle.goal,
      logicSummary: activeCycle.logicSummary,
      evaluationSignal: activeCycle.evaluationSignal,
    } : null);
    const cycleLines = cc ? [
      "",
      `Active Cycle #${cc.cycleNumber}: ${cc.title}`,
      cc.goal ? `Goal: ${cc.goal}` : null,
      cc.logicSummary ? `What to build: ${cc.logicSummary}` : null,
      cc.evaluationSignal ? `Evaluation signal: ${cc.evaluationSignal}` : null,
      "",
      "--- Why this is being built now ---",
      "Feature selected for active cycle",
    ].filter((l) => l !== null) : [
      "",
      "⚠ This task is not tied to the active cycle. Consider parking it unless it is required for the current learning goal.",
    ];
    const rawInput = [
      `[Project: ${project.name}]`,
      project.problem ? `Problem: ${project.problem}` : null,
      goalTitle ? `Goal: ${goalTitle}` : null,
      ...cycleLines,
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

  const handleQueueBranch = (goalId: string, goalFeatures: Feature[]) => {
    const repoFullName = project.githubRepoUrl
      ? project.githubRepoUrl.replace("https://github.com/", "").replace(/\/$/, "")
      : null;
    if (!repoFullName) {
      setError("Connect a GitHub repo to this project before queuing tasks.");
      return;
    }
    // Collect full subtree (roots + all descendants) for this goal
    const allGoalFeatures: Feature[] = [];
    const queue: string[] = goalFeatures.map((f) => f.id);
    const seen = new Set<string>();
    while (queue.length > 0) {
      const id = queue.shift()!;
      if (seen.has(id)) continue;
      seen.add(id);
      const f = features.find((x) => x.id === id);
      if (f) {
        allGoalFeatures.push(f);
        features.filter((x) => x.parentId === id).forEach((x) => queue.push(x.id));
      }
    }
    const pending = allGoalFeatures
      .filter((f) => f.status !== "done")
      .sort((a, b) => (a.buildOrder ?? 999) - (b.buildOrder ?? 999));
    if (pending.length === 0) return;

    setQueueingGoalId(goalId);
    const activeCycle = getActiveProjectCycle(project.id);
    const cc = cycleContext ?? (activeCycle ? {
      cycleNumber: activeCycle.cycleNumber,
      title: activeCycle.title,
      goal: activeCycle.goal,
      logicSummary: activeCycle.logicSummary,
      evaluationSignal: activeCycle.evaluationSignal,
    } : null);

    const now = new Date().toISOString();
    const tasks: ActiveTask[] = pending.map((f) => {
      const criteria = f.acceptanceCriteria.filter(Boolean);
      const nonGoals = f.nonGoals.filter(Boolean);
      const rawInput = [
        `[Project: ${project.name}]`,
        project.problem ? `Problem: ${project.problem}` : null,
        cc ? `\nActive Cycle #${cc.cycleNumber}: ${cc.title}` : null,
        cc?.goal ? `Goal: ${cc.goal}` : null,
        cc?.logicSummary ? `What to build: ${cc.logicSummary}` : null,
        "",
        f.buildOrder != null ? `Step ${f.buildOrder}: ${f.title}` : f.title,
        f.description || null,
        f.minutesEstimate ? `Estimated: ${f.minutesEstimate}` : null,
        f.placement ? `Location: ${f.placement}` : null,
        "",
        criteria.length > 0 ? `Acceptance Criteria:\n${criteria.map((c) => `- ${c}`).join("\n")}` : null,
        nonGoals.length > 0 ? `Non-Goals:\n${nonGoals.map((g) => `- ${g}`).join("\n")}` : null,
      ].filter((l) => l !== null).join("\n").trim();

      const queuedPayload: QueuedTaskPayload = {
        endpoint: "/api/agents/cursor/run",
        body: { repoFullName, taskType: f.taskType, rawInput, autoCreatePR: true },
      };
      return {
        id: crypto.randomUUID(),
        repoFullName,
        issueTitle: f.buildOrder != null ? `Step ${f.buildOrder}: ${f.title}` : f.title,
        status: "queued" as const,
        autoMerge: true,
        queuedPayload,
        startedAt: now,
        updatedAt: now,
        seen: true,
        sourceItemId: f.id,
      };
    });

    // Reverse so that unshift() in upsertActiveTask puts task 1 at the front of the list
    [...tasks].reverse().forEach(upsertActiveTask);
    onTasksQueued?.(tasks);

    // Mark features as in_progress
    persist(features.map((f) =>
      pending.find((p) => p.id === f.id)
        ? { ...f, status: "in_progress" as const, updatedAt: now }
        : f
    ));

    setQueueBanner(`${tasks.length} task${tasks.length > 1 ? "s" : ""} queued — go to Build tab to track.`);
    setQueueingGoalId(null);
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

  const handleGenerateGoals = async () => {
    setGoalGenerating(true);
    setError("");
    try {
      const existingGoals = goals.map((g) => g.title).filter(Boolean);
      const existingFeatures = features.map((f) => ({ title: f.title, status: f.status, goalId: f.goalId ?? null }));
      const completedCycles = getCompletedProjectCycles(project.id)
        .filter((c) => c.decision !== "undecided")
        .map((c) => ({ cycleNumber: c.cycleNumber, goal: c.goal, decision: c.decision, evidenceNotes: c.evidenceNotes }));
      const res = await fetch("/api/ideas/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "goals", project, cycleContext, existingGoals, existingFeatures, completedCycles }),
      });
      const data = (await res.json()) as GenerateResponse;
      if (data.error) { setError(data.error); return; }
      const rawGoals = (data.result ?? []) as RawGoal[];
      const now = new Date().toISOString();
      const newGoals: Goal[] = rawGoals.map((r) => ({
        id: crypto.randomUUID(),
        projectId: project.id,
        cycleId,
        title: r.title,
        description: r.description,
        status: "not_started" as GoalStatus,
        createdAt: now,
        updatedAt: now,
      }));
      // Append new goals — don't replace existing ones
      onGoalsChange([...goals, ...newGoals]);
    } catch {
      setError("Goal generation failed.");
    } finally {
      setGoalGenerating(false);
    }
  };

  const handleAddGoal = () => {
    const now = new Date().toISOString();
    const g: Goal = {
      id: crypto.randomUUID(),
      projectId: project.id,
      cycleId,
      title: "",
      status: "not_started",
      createdAt: now,
      updatedAt: now,
    };
    onGoalsChange([...goals, g]);
  };

  const handleGoalUpdate = (updated: Goal) => {
    onGoalsChange(goals.map((g) => (g.id === updated.id ? updated : g)));
  };

  const handleGoalDelete = (id: string) => {
    persist(features.map((f) => f.goalId === id ? { ...f, goalId: null } : f));
    onGoalsChange(goals.filter((g) => g.id !== id));
  };

  const handleAddToGoal = (goalId: string) => {
    const f = newFeature(project.id, null, goalId);
    persist([...features, f]);
    setEditingId(f.id);
  };

  const handlePromoteToGoal = (feature: Feature) => {
    const now = new Date().toISOString();
    const newGoal: Goal = {
      id: crypto.randomUUID(),
      projectId: project.id,
      title: feature.title,
      status: "not_started",
      createdAt: now,
      updatedAt: now,
    };
    onGoalsChange([...goals, newGoal]);
    persist(features.map((f) => f.id === feature.id ? { ...f, goalId: newGoal.id, updatedAt: now } : f));
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
  const projectGoals = goals.filter((g) => g.projectId === project.id);
  const ungroupedRoots = rootFeatures.filter((f) => !f.goalId || !goals.find((g) => g.id === f.goalId));

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-slate-700">
          {cycleContext ? "Task groups" : "Feature tree"}
          {features.length > 0 && doneCount > 0 && (
            <span className="ml-1.5 text-xs font-normal text-emerald-600">{doneCount}/{features.length} done</span>
          )}
        </p>
        <div className="flex gap-2 flex-wrap justify-end">
          {project.githubRepoUrl && features.length > 0 && (
            <button type="button" onClick={handleSyncRepo} disabled={syncing}
              className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-600 hover:border-slate-300 hover:bg-slate-50 disabled:opacity-50">
              {syncing ? "…" : "⟳ Sync repo"}
            </button>
          )}
          <button type="button" onClick={handleGenerateGoals} disabled={goalGenerating}
            className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-600 hover:border-slate-300 hover:bg-slate-50 disabled:opacity-50">
            {goalGenerating ? "…" : cycleContext ? "✦ Generate task groups" : "✦ Goals"}
          </button>
          <button type="button" onClick={handleAddGoal}
            className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50">
            {cycleContext ? "+ Task group" : "+ Goal"}
          </button>
          <button type="button" onClick={handleAddRoot}
            className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50">
            + Feature
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-700">
          {error}
        </div>
      )}

      {queueBanner && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-700">
          {queueBanner}
        </div>
      )}

      {features.length === 0 && projectGoals.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-200 p-3 text-xs text-slate-400">
          {cycleContext ? "No task groups yet. Generate task groups or add manually." : "No features yet. Generate a draft or add manually."}
        </p>
      ) : (
        <div>
          {projectGoals.map((goal) => {
            const goalRoots = rootFeatures.filter((f) => f.goalId === goal.id);
            return (
              <GoalSection
                key={goal.id}
                goal={goal}
                goalFeatures={goalRoots}
                allFeatures={features}
                goals={projectGoals}
                onGoalUpdate={handleGoalUpdate}
                onGoalDelete={() => handleGoalDelete(goal.id)}
                onAddFeature={() => handleAddToGoal(goal.id)}
                onGenerateFeatures={() => handleGenerateForGoal(goal)}
                generatingFeatures={goalGeneratingId === goal.id}
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
                onQueueBranch={() => handleQueueBranch(goal.id, goalRoots)}
                queueingBranch={queueingGoalId === goal.id}
              />
            );
          })}
          {ungroupedRoots.length > 0 && (
            <div className="mb-2">
              {projectGoals.length > 0 && (
                <p className="mb-1 px-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                  Ungrouped
                </p>
              )}
              {ungroupedRoots.map((f) => (
                <FeatureRow
                  key={f.id}
                  feature={f}
                  allFeatures={features}
                  goals={projectGoals}
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
                  onPromoteToGoal={handlePromoteToGoal}
                />
              ))}
            </div>
          )}
          {orphans.map((f) => (
            <FeatureRow
              key={f.id}
              feature={f}
              allFeatures={features}
              goals={projectGoals}
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
