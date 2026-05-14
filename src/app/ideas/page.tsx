"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { MobileHeader } from "@/components/MobileHeader";
import { loadIdeaProjects, loadRoadmapItems, loadAndClearOpenProjectId, saveIdeaProjects, saveRoadmapItems, saveTaskPrefill, loadBusinessNodes, loadLandingPageSpecs, loadBuildTrees, loadBuildNodes, loadFeatures, saveFeatures } from "@/lib/ideaStorage";
import {
  Feature,
  GenerateAction,
  GenerateResponse,
  IdeaProject,
  PROJECT_STATUS_COLORS,
  PROJECT_STATUS_LABELS,
  PROJECT_STATUSES,
  ProjectStatus,
  ROADMAP_STATUS_COLORS,
  RoadmapItem,
  RoadmapItemStatus,
  TaskPrefill,
} from "@/lib/ideaTypes";
import { FeaturesSection } from "@/components/FeaturesSection";
import { AGENT_OPTIONS, TASK_TYPE_OPTIONS, Agent, TaskType } from "@/lib/types";
import { CreateRepoPanel } from "@/components/CreateRepoPanel";
import { BusinessTreeSection } from "@/components/BusinessTreeSection";
import { LandingPageSection } from "@/components/LandingPageSection";
import { BuildTreeSection } from "@/components/BuildTreeSection";
import { BusinessNode, LandingPageSpec, BuildTree, BuildNode } from "@/lib/treeTypes";

// ─── Next Step ────────────────────────────────────────────────────────────────

type NextStep =
  | { type: "fill_problem" }
  | { type: "generate_target_user" }
  | { type: "generate_mvp" }
  | { type: "score_clarity" }
  | { type: "improve_clarity"; feedback: string }
  | { type: "generate_features" }
  | { type: "send_to_build"; feature: Feature }
  | { type: "all_done" };

function computeNextStep(project: IdeaProject, features: Feature[]): NextStep {
  if (!project.problem.trim()) return { type: "fill_problem" };
  if (!project.targetUser.trim()) return { type: "generate_target_user" };
  if (!project.mvpDefinition.trim()) return { type: "generate_mvp" };
  if (!project.clarityScore) return { type: "score_clarity" };
  if (project.clarityScore.score < 7) return { type: "improve_clarity", feedback: project.clarityScore.feedback };
  if (features.length === 0) return { type: "generate_features" };
  const leaves = features.filter((f) => !features.some((other) => other.parentId === f.id));
  const buildable = leaves.filter((f) => f.status === "backlog");
  if (buildable.length > 0) return { type: "send_to_build", feature: buildable[0] };
  return { type: "all_done" };
}

function NextStepCard({
  step,
  onGenerate,
  onSendToBuild,
}: {
  step: NextStep;
  onGenerate: (action: GenerateAction) => void;
  onSendToBuild: (feature: Feature) => void;
}) {
  if (step.type === "all_done") return null;

  const configs: Record<string, { headline: string; description: string; cta?: string; action?: GenerateAction }> = {
    fill_problem:          { headline: "Describe the problem", description: "What pain does this solve, and for whom?" },
    generate_target_user:  { headline: "Define your target user", description: "Who specifically will use this?", cta: "✦ Generate", action: "target_user" },
    generate_mvp:          { headline: "Define your MVP", description: "What's the smallest version that proves value?", cta: "✦ Generate", action: "mvp" },
    score_clarity:         { headline: "Score your clarity", description: "Check if the idea is clear enough to build.", cta: "✦ Score", action: "clarity_score" },
    generate_features:     { headline: "Generate your features", description: "Break this project into buildable features.", cta: "✦ Generate", action: "features" },
  };

  if (step.type === "improve_clarity") {
    return (
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-amber-500">Next step</p>
        <p className="mt-0.5 text-sm font-semibold text-amber-900">Tighten your MVP definition</p>
        <p className="mt-1 text-xs text-amber-700">{step.feedback}</p>
        <button
          type="button"
          onClick={() => onGenerate("clarity_score")}
          className="mt-2 rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-semibold text-white"
        >
          ✦ Re-score
        </button>
      </div>
    );
  }

  if (step.type === "send_to_build") {
    return (
      <div className="rounded-2xl border border-brand/20 bg-blue-50 p-4">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-brand">Next step</p>
        <p className="mt-0.5 text-sm font-semibold text-slate-900">Send to Build</p>
        <p className="mt-1 text-xs text-slate-600 truncate">"{step.feature.title}"</p>
        <button
          type="button"
          onClick={() => onSendToBuild(step.feature)}
          className="mt-2 rounded-lg bg-brand px-3 py-1.5 text-xs font-semibold text-white"
        >
          → Build
        </button>
      </div>
    );
  }

  const cfg = configs[step.type];
  if (!cfg) return null;

  return (
    <div className="rounded-2xl border border-brand/20 bg-blue-50 p-4">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-brand">Next step</p>
      <p className="mt-0.5 text-sm font-semibold text-slate-900">{cfg.headline}</p>
      <p className="mt-1 text-xs text-slate-600">{cfg.description}</p>
      {cfg.cta && cfg.action && (
        <button
          type="button"
          onClick={() => onGenerate(cfg.action!)}
          className="mt-2 rounded-lg bg-brand px-3 py-1.5 text-xs font-semibold text-white"
        >
          {cfg.cta}
        </button>
      )}
    </div>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function newProject(): IdeaProject {
  return {
    id: crypto.randomUUID(),
    name: "",
    description: "",
    status: "idea",
    projectType: "web_page",
    problem: "",
    targetUser: "",
    mvpDefinition: "",
    assumptions: [],
    githubRepoUrl: "",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

function newRoadmapItem(projectId: string): RoadmapItem {
  return {
    id: crypto.randomUUID(),
    projectId,
    title: "",
    description: "",
    taskType: "new_feature",
    acceptanceCriteria: [""],
    nonGoals: [""],
    suggestedAgent: "cursor",
    status: "pending",
  };
}

async function callGenerate(action: GenerateAction, project: IdeaProject): Promise<GenerateResponse> {
  const res = await fetch("/api/ideas/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action, project }),
  });
  return (await res.json()) as GenerateResponse;
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function StatusPicker({
  value,
  onChange,
}: {
  value: ProjectStatus;
  onChange: (s: ProjectStatus) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`rounded-full px-3 py-1 text-xs font-semibold ${PROJECT_STATUS_COLORS[value]}`}
      >
        {PROJECT_STATUS_LABELS[value]} ▾
      </button>
      {open && (
        <div className="absolute left-0 top-8 z-20 w-44 rounded-xl border border-slate-200 bg-white shadow-lg">
          {PROJECT_STATUSES.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => { onChange(s); setOpen(false); }}
              className={`block w-full px-3 py-2 text-left text-xs font-medium hover:bg-slate-50 ${value === s ? "font-semibold" : ""}`}
            >
              <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${PROJECT_STATUS_COLORS[s]}`}>
                {PROJECT_STATUS_LABELS[s]}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function GenerateButton({
  label,
  loading,
  onClick,
}: {
  label: string;
  loading: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={loading}
      className="shrink-0 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-600 hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
    >
      {loading ? "…" : `✦ ${label}`}
    </button>
  );
}

function ClarityBadge({ score }: { score: number }) {
  const color =
    score >= 8 ? "bg-emerald-100 text-emerald-700" :
    score >= 5 ? "bg-yellow-100 text-yellow-700" :
    "bg-red-100 text-red-700";
  return (
    <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${color}`}>
      Clarity {score}/10
    </span>
  );
}

// ─── Roadmap Item Row ────────────────────────────────────────────────────────

function RoadmapItemRow({
  item,
  onUpdate,
  onDelete,
  onSend,
}: {
  item: RoadmapItem;
  onUpdate: (updated: RoadmapItem) => void;
  onDelete: () => void;
  onSend: () => void;
}) {
  const [expanded, setExpanded] = useState(false);

  const setField = <K extends keyof RoadmapItem>(key: K, val: RoadmapItem[K]) =>
    onUpdate({ ...item, [key]: val });

  const statusColors: Record<RoadmapItemStatus, string> = ROADMAP_STATUS_COLORS;

  return (
    <div className="rounded-xl border border-slate-200 bg-white">
      {/* Header row */}
      <div className="flex items-start gap-2 p-3">
        <div className="flex-1">
          <input
            className="w-full bg-transparent text-sm font-semibold text-slate-900 outline-none placeholder:font-normal placeholder:text-slate-400"
            placeholder="Task title…"
            value={item.title}
            onChange={(e) => onUpdate({ ...item, title: e.target.value })}
          />
          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${statusColors[item.status]}`}>
              {item.status}
            </span>
            <select
              className="rounded bg-slate-50 px-1.5 py-0.5 text-[11px] font-medium text-slate-600 outline-none"
              value={item.taskType}
              onChange={(e) => setField("taskType", e.target.value as TaskType)}
            >
              {TASK_TYPE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
            <select
              className="rounded bg-slate-50 px-1.5 py-0.5 text-[11px] font-medium text-slate-600 outline-none"
              value={item.suggestedAgent}
              onChange={(e) => setField("suggestedAgent", e.target.value as Agent)}
            >
              {AGENT_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="flex shrink-0 flex-col gap-1.5">
          <button
            type="button"
            onClick={onSend}
            className="rounded-lg bg-brand px-3 py-1.5 text-xs font-semibold text-white"
          >
            → Build
          </button>
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="rounded-lg border border-slate-200 px-3 py-1 text-xs text-slate-500 hover:bg-slate-50"
          >
            {expanded ? "Done" : "Edit"}
          </button>
        </div>
      </div>

      {/* Expanded editor */}
      {expanded && (
        <div className="space-y-3 border-t border-slate-100 p-3">
          <textarea
            className="w-full resize-none rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-700 outline-none focus:border-brand"
            rows={2}
            placeholder="Description…"
            value={item.description}
            onChange={(e) => setField("description", e.target.value)}
          />

          <div>
            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">
              Acceptance criteria
            </p>
            {item.acceptanceCriteria.map((c, i) => (
              <div key={i} className="mb-1 flex gap-1">
                <input
                  className="flex-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs text-slate-700 outline-none focus:border-brand"
                  placeholder="Criterion…"
                  value={c}
                  onChange={(e) => {
                    const next = [...item.acceptanceCriteria];
                    next[i] = e.target.value;
                    setField("acceptanceCriteria", next);
                  }}
                />
                <button
                  type="button"
                  onClick={() => setField("acceptanceCriteria", item.acceptanceCriteria.filter((_, j) => j !== i))}
                  className="px-2 text-slate-300 hover:text-red-400"
                >
                  ×
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={() => setField("acceptanceCriteria", [...item.acceptanceCriteria, ""])}
              className="text-xs text-slate-400 hover:text-slate-600"
            >
              + Add criterion
            </button>
          </div>

          <div>
            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">Non-goals</p>
            {item.nonGoals.map((g, i) => (
              <div key={i} className="mb-1 flex gap-1">
                <input
                  className="flex-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs text-slate-700 outline-none focus:border-brand"
                  placeholder="Not in scope…"
                  value={g}
                  onChange={(e) => {
                    const next = [...item.nonGoals];
                    next[i] = e.target.value;
                    setField("nonGoals", next);
                  }}
                />
                <button
                  type="button"
                  onClick={() => setField("nonGoals", item.nonGoals.filter((_, j) => j !== i))}
                  className="px-2 text-slate-300 hover:text-red-400"
                >
                  ×
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={() => setField("nonGoals", [...item.nonGoals, ""])}
              className="text-xs text-slate-400 hover:text-slate-600"
            >
              + Add non-goal
            </button>
          </div>

          <div className="flex items-center justify-between">
            <select
              className="rounded-lg border border-slate-200 px-2 py-1.5 text-xs text-slate-600 outline-none"
              value={item.status}
              onChange={(e) => setField("status", e.target.value as RoadmapItemStatus)}
            >
              {(["pending", "in_progress", "done", "skipped"] as RoadmapItemStatus[]).map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
            <button
              type="button"
              onClick={onDelete}
              className="text-xs text-red-400 hover:text-red-600"
            >
              Delete
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Project Editor ───────────────────────────────────────────────────────────

function ProjectEditor({
  project,
  items,
  features,
  onUpdate,
  onDelete,
  onItemsChange,
  onSendToTapTask,
  onFeaturesChange,
  onClose,
  businessNodes,
  onBusinessNodesChange,
  landingSpec,
  onLandingSpecChange,
  buildTrees,
  onBuildTreesChange,
  buildNodes,
  onBuildNodesChange,
  onSendToBuild,
}: {
  project: IdeaProject;
  items: RoadmapItem[];
  features: Feature[];
  onUpdate: (p: IdeaProject) => void;
  onDelete: () => void;
  onItemsChange: (items: RoadmapItem[]) => void;
  onSendToTapTask: (item: RoadmapItem) => void;
  onFeaturesChange: (features: Feature[]) => void;
  onClose: () => void;
  businessNodes: BusinessNode[];
  onBusinessNodesChange: (nodes: BusinessNode[]) => void;
  landingSpec: LandingPageSpec | null;
  onLandingSpecChange: (spec: LandingPageSpec | null) => void;
  buildTrees: BuildTree[];
  onBuildTreesChange: (trees: BuildTree[]) => void;
  buildNodes: BuildNode[];
  onBuildNodesChange: (nodes: BuildNode[]) => void;
  onSendToBuild: (prefill: TaskPrefill) => void;
}) {
  const [generating, setGenerating] = useState<GenerateAction | null>(null);
  const [generateError, setGenerateError] = useState("");
  const [createRepoOpen, setCreateRepoOpen] = useState(false);
  const [showFeatures, setShowFeatures] = useState(true);
  const [showBusinessTree, setShowBusinessTree] = useState(false);
  const [showLandingPage, setShowLandingPage] = useState(false);
  const [showBuildTrees, setShowBuildTrees] = useState(false);

  const set = <K extends keyof IdeaProject>(key: K, val: IdeaProject[K]) =>
    onUpdate({ ...project, [key]: val, updatedAt: new Date().toISOString() });

  const generate = async (action: GenerateAction) => {
    setGenerating(action);
    setGenerateError("");
    try {
      const res = await callGenerate(action, project);
      if (res.error) {
        setGenerateError(res.error);
        return;
      }
      if (action === "target_user" && typeof res.result === "string") {
        set("targetUser", res.result);
      } else if (action === "mvp" && typeof res.result === "string") {
        set("mvpDefinition", res.result);
      } else if (action === "assumptions" && Array.isArray(res.result)) {
        set("assumptions", res.result as string[]);
      } else if (action === "roadmap" && Array.isArray(res.result)) {
        const newItems = (res.result as Omit<RoadmapItem, "id" | "projectId" | "status">[]).map((r) => ({
          ...r,
          id: crypto.randomUUID(),
          projectId: project.id,
          status: "pending" as RoadmapItemStatus,
          acceptanceCriteria: r.acceptanceCriteria ?? [],
          nonGoals: r.nonGoals ?? [],
        }));
        onItemsChange([...items, ...newItems]);
      } else if (action === "clarity_score" && typeof res.result === "object" && !Array.isArray(res.result)) {
        set("clarityScore", res.result as { score: number; feedback: string });
      }
    } catch {
      setGenerateError("Generation failed. Check your network connection.");
    } finally {
      setGenerating(null);
    }
  };

  const addItem = () => {
    onItemsChange([...items, newRoadmapItem(project.id)]);
  };

  const updateItem = (updated: RoadmapItem) =>
    onItemsChange(items.map((i) => (i.id === updated.id ? updated : i)));

  const deleteItem = (id: string) =>
    onItemsChange(items.filter((i) => i.id !== id));

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2">
        <button type="button" onClick={onClose} className="text-sm text-slate-400 hover:text-slate-600">
          ← Back
        </button>
        <div className="flex flex-1 items-center gap-2">
          <StatusPicker value={project.status} onChange={(s) => set("status", s)} />
          {project.clarityScore && <ClarityBadge score={project.clarityScore.score} />}
        </div>
        <button type="button" onClick={onDelete} className="text-xs text-red-400 hover:text-red-600">
          Delete
        </button>
      </div>

      {/* Next step */}
      <NextStepCard
        step={computeNextStep(project, features)}
        onGenerate={generate}
        onSendToBuild={(feature) => {
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
        }}
      />

      {/* Core fields */}
      <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4">
        <input
          className="w-full bg-transparent text-lg font-bold text-slate-900 outline-none placeholder:font-normal placeholder:text-slate-400"
          placeholder="Web page name…"
          value={project.name}
          onChange={(e) => set("name", e.target.value)}
        />

        <div>
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">Problem</p>
          <textarea
            className="w-full resize-none rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-700 outline-none focus:border-brand"
            rows={3}
            placeholder="What problem does this web page solve? For whom?"
            value={project.problem}
            onChange={(e) => set("problem", e.target.value)}
          />
        </div>

        <div>
          <div className="mb-1 flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Target user</p>
            <GenerateButton
              label="Generate"
              loading={generating === "target_user"}
              onClick={() => generate("target_user")}
            />
          </div>
          <textarea
            className="w-full resize-none rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-700 outline-none focus:border-brand"
            rows={3}
            placeholder="Who is the primary user?"
            value={project.targetUser}
            onChange={(e) => set("targetUser", e.target.value)}
          />
        </div>

        <div>
          <div className="mb-1 flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">MVP definition</p>
            <div className="flex gap-1.5">
              <GenerateButton
                label="Generate"
                loading={generating === "mvp"}
                onClick={() => generate("mvp")}
              />
              <GenerateButton
                label="Score"
                loading={generating === "clarity_score"}
                onClick={() => generate("clarity_score")}
              />
            </div>
          </div>
          <textarea
            className="w-full resize-none rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-700 outline-none focus:border-brand"
            rows={4}
            placeholder="What is the smallest version that proves value?"
            value={project.mvpDefinition}
            onChange={(e) => set("mvpDefinition", e.target.value)}
          />
          {project.clarityScore && (
            <p className="mt-1.5 text-xs text-slate-500">{project.clarityScore.feedback}</p>
          )}
        </div>

        <div>
          <div className="mb-1 flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
              Assumptions {project.assumptions.length > 0 ? `(${project.assumptions.length})` : ""}
            </p>
            <GenerateButton
              label="Generate"
              loading={generating === "assumptions"}
              onClick={() => generate("assumptions")}
            />
          </div>
          {project.assumptions.length > 0 ? (
            <ul className="space-y-1">
              {project.assumptions.map((a, i) => (
                <li key={i} className="flex gap-2">
                  <input
                    className="flex-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs text-slate-700 outline-none focus:border-brand"
                    value={a}
                    onChange={(e) => {
                      const next = [...project.assumptions];
                      next[i] = e.target.value;
                      set("assumptions", next);
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => set("assumptions", project.assumptions.filter((_, j) => j !== i))}
                    className="px-2 text-slate-300 hover:text-red-400"
                  >
                    ×
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-slate-400">No assumptions yet. Generate or add manually.</p>
          )}
          <button
            type="button"
            onClick={() => set("assumptions", [...project.assumptions, ""])}
            className="mt-1.5 text-xs text-slate-400 hover:text-slate-600"
          >
            + Add assumption
          </button>
        </div>

        {/* GitHub repo — link existing or create new */}
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">GitHub repo</p>

          {project.githubRepoUrl ? (
            <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2.5">
              <a
                href={project.githubRepoUrl}
                target="_blank"
                rel="noreferrer"
                className="flex-1 truncate text-sm font-semibold text-emerald-700 hover:underline"
              >
                {project.githubRepoUrl.replace("https://github.com/", "")} ↗
              </a>
              <button
                type="button"
                onClick={() => set("githubRepoUrl", "")}
                className="shrink-0 text-xs text-emerald-400 hover:text-red-500"
              >
                ✕
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              <input
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-700 outline-none focus:border-brand"
                placeholder="https://github.com/owner/repo (paste existing)"
                value={project.githubRepoUrl}
                onChange={(e) => set("githubRepoUrl", e.target.value)}
              />
              <button
                type="button"
                onClick={() => setCreateRepoOpen((o) => !o)}
                className="w-full rounded-xl border border-brand bg-blue-50 py-2.5 text-sm font-semibold text-brand active:bg-blue-100"
              >
                {createRepoOpen ? "Cancel" : "+ Create New Repo"}
              </button>
            </div>
          )}

          {createRepoOpen && !project.githubRepoUrl && (
            <CreateRepoPanel
              project={project}
              onRepoCreated={(fullName, htmlUrl) => {
                set("githubRepoUrl", htmlUrl);
                setCreateRepoOpen(false);
              }}
            />
          )}
        </div>

      </div>

      {generateError && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-700">
          {generateError}
        </div>
      )}

      {/* Features */}
      <div className="rounded-2xl border border-slate-200 bg-white">
        <button
          type="button"
          onClick={() => setShowFeatures((v) => !v)}
          className="flex w-full items-center justify-between p-4 text-left"
        >
          <p className="text-base font-semibold text-slate-900">
            Features {features.length > 0 ? `(${features.length})` : ""}
          </p>
          <span className="text-slate-400">{showFeatures ? "▲" : "▼"}</span>
        </button>
        {showFeatures && (
          <div className="border-t border-slate-100 p-4">
            <FeaturesSection
              project={project}
              features={features}
              onFeaturesChange={onFeaturesChange}
              onSendToBuild={onSendToBuild}
            />
          </div>
        )}
      </div>

      {/* Business Tree */}
      <div className="rounded-2xl border border-slate-200 bg-white">
        <button
          type="button"
          onClick={() => setShowBusinessTree((v) => !v)}
          className="flex w-full items-center justify-between p-4 text-left"
        >
          <p className="text-base font-semibold text-slate-900">What needs solving?</p>
          <span className="text-slate-400">{showBusinessTree ? "▲" : "▼"}</span>
        </button>
        {showBusinessTree && (
          <div className="border-t border-slate-100 p-4">
            <BusinessTreeSection
              project={project}
              nodes={businessNodes}
              onNodesChange={onBusinessNodesChange}
              onSendToBuild={onSendToBuild}
            />
          </div>
        )}
      </div>

      {/* Landing Page */}
      <div className="rounded-2xl border border-slate-200 bg-white">
        <button
          type="button"
          onClick={() => setShowLandingPage((v) => !v)}
          className="flex w-full items-center justify-between p-4 text-left"
        >
          <p className="text-base font-semibold text-slate-900">What are we promising?</p>
          <span className="text-slate-400">{showLandingPage ? "▲" : "▼"}</span>
        </button>
        {showLandingPage && (
          <div className="border-t border-slate-100 p-4">
            <LandingPageSection
              project={project}
              businessNodes={businessNodes}
              spec={landingSpec}
              onSpecChange={onLandingSpecChange}
              onSendToBuild={onSendToBuild}
            />
          </div>
        )}
      </div>

      {/* Build Trees */}
      <div className="rounded-2xl border border-slate-200 bg-white">
        <button
          type="button"
          onClick={() => setShowBuildTrees((v) => !v)}
          className="flex w-full items-center justify-between p-4 text-left"
        >
          <p className="text-base font-semibold text-slate-900">How will we build this part?</p>
          <span className="text-slate-400">{showBuildTrees ? "▲" : "▼"}</span>
        </button>
        {showBuildTrees && (
          <div className="border-t border-slate-100 p-4">
            <BuildTreeSection
              project={project}
              businessNodes={businessNodes}
              landingSpec={landingSpec}
              trees={buildTrees}
              allBuildNodes={buildNodes}
              onTreesChange={onBuildTreesChange}
              onBuildNodesChange={onBuildNodesChange}
              onSendToBuild={onSendToBuild}
            />
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Project Card (list view) ─────────────────────────────────────────────────

function ProjectCard({
  project,
  featureCount,
  onSelect,
}: {
  project: IdeaProject;
  featureCount: number;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className="w-full rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-sm hover:border-slate-300"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1">
          <p className="text-sm font-semibold text-slate-900">{project.name || "Untitled"}</p>
          {project.problem && (
            <p className="mt-1 line-clamp-2 text-xs text-slate-500">{project.problem}</p>
          )}
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1.5">
          <span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold ${PROJECT_STATUS_COLORS[project.status]}`}>
            {PROJECT_STATUS_LABELS[project.status]}
          </span>
          <span className="text-[10px] text-slate-400">
            Web Page
          </span>
        </div>
      </div>
      {featureCount > 0 && (
        <p className="mt-2 text-xs text-slate-400">{featureCount} feature{featureCount !== 1 ? "s" : ""}</p>
      )}
    </button>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function IdeasPage() {
  const router = useRouter();
  const [projects, setProjects] = useState<IdeaProject[]>([]);
  const [allItems, setAllItems] = useState<RoadmapItem[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [allFeatures, setAllFeatures] = useState<Feature[]>([]);
  const [allBusinessNodes, setAllBusinessNodes] = useState<BusinessNode[]>([]);
  const [allLandingSpecs, setAllLandingSpecs] = useState<LandingPageSpec[]>([]);
  const [allBuildTrees, setAllBuildTrees] = useState<BuildTree[]>([]);
  const [allBuildNodes, setAllBuildNodes] = useState<BuildNode[]>([]);

  useEffect(() => {
    const loaded = loadIdeaProjects();
    setProjects(loaded);
    setAllItems(loadRoadmapItems());
    setAllFeatures(loadFeatures());
    setAllBusinessNodes(loadBusinessNodes());
    setAllLandingSpecs(loadLandingPageSpecs());
    setAllBuildTrees(loadBuildTrees());
    setAllBuildNodes(loadBuildNodes());
    const openId = loadAndClearOpenProjectId();
    if (openId && loaded.find((p) => p.id === openId)) {
      setSelectedId(openId);
    }
  }, []);

  const saveProjects = (next: IdeaProject[]) => {
    setProjects(next);
    saveIdeaProjects(next);
  };

  const saveItems = (next: RoadmapItem[]) => {
    setAllItems(next);
    saveRoadmapItems(next);
  };

  const handleCreate = () => {
    const p = newProject();
    const next = [p, ...projects];
    saveProjects(next);
    setSelectedId(p.id);
    setCreating(false);
  };

  const handleUpdate = (updated: IdeaProject) => {
    saveProjects(projects.map((p) => (p.id === updated.id ? updated : p)));
  };

  const handleDelete = (id: string) => {
    saveProjects(projects.filter((p) => p.id !== id));
    saveItems(allItems.filter((i) => i.projectId !== id));
    const nextFeatures = allFeatures.filter((f) => f.projectId !== id);
    setAllFeatures(nextFeatures);
    saveFeatures(nextFeatures);
    setAllBusinessNodes((prev) => prev.filter((n) => n.projectId !== id));
    setAllLandingSpecs((prev) => prev.filter((s) => s.projectId !== id));
    setAllBuildTrees((prev) => prev.filter((t) => t.projectId !== id));
    setSelectedId(null);
  };

  const handleFeaturesChange = (projectId: string, features: Feature[]) => {
    const without = allFeatures.filter((f) => f.projectId !== projectId);
    const next = [...without, ...features];
    setAllFeatures(next);
    saveFeatures(next);
  };

  const handleSendToBuild = (prefill: TaskPrefill) => {
    saveTaskPrefill(prefill);
    router.push("/");
  };

  const handleItemsChange = (projectId: string, items: RoadmapItem[]) => {
    const without = allItems.filter((i) => i.projectId !== projectId);
    saveItems([...without, ...items]);
  };

  const handleSendToTapTask = (project: IdeaProject, item: RoadmapItem) => {
    const criteria = item.acceptanceCriteria.filter(Boolean);
    const nonGoals = item.nonGoals.filter(Boolean);

    const rawInput = [
      `[Web Page: ${project.name}]`,
      project.problem ? `Problem: ${project.problem}` : null,
      project.targetUser ? `Target User: ${project.targetUser}` : null,
      "",
      item.title,
      item.description || null,
      "",
      criteria.length > 0
        ? `Acceptance Criteria:\n${criteria.map((c) => `- ${c}`).join("\n")}`
        : null,
      nonGoals.length > 0
        ? `Non-Goals:\n${nonGoals.map((g) => `- ${g}`).join("\n")}`
        : null,
    ]
      .filter((l) => l !== null)
      .join("\n")
      .trim();

    const repoFullName = project.githubRepoUrl
      ? project.githubRepoUrl.replace("https://github.com/", "").replace(/\/$/, "")
      : undefined;

    const prefill: TaskPrefill = {
      taskType: item.taskType,
      rawInput,
      agentSuggestion: item.suggestedAgent,
      repoFullName,
      sourceItemId: item.id,
    };

    saveTaskPrefill(prefill);
    router.push("/");
  };

  const selectedProject = projects.find((p) => p.id === selectedId) ?? null;
  const projectItems = selectedProject
    ? allItems.filter((i) => i.projectId === selectedProject.id)
    : [];
  const projectFeatures = selectedProject
    ? allFeatures.filter((f) => f.projectId === selectedProject.id)
    : [];
  const projectBusinessNodes = selectedProject
    ? allBusinessNodes.filter((n) => n.projectId === selectedProject.id)
    : [];
  const projectLandingSpec = selectedProject
    ? (allLandingSpecs.find((s) => s.projectId === selectedProject.id) ?? null)
    : null;
  const projectBuildTrees = selectedProject
    ? allBuildTrees.filter((t) => t.projectId === selectedProject.id)
    : [];
  const projectBuildNodes = selectedProject
    ? allBuildNodes.filter((n) => projectBuildTrees.some((t) => t.id === n.buildTreeId))
    : [];

  return (
    <main className="mx-auto min-h-screen max-w-xl pb-24">
      <MobileHeader />

      <div className="space-y-4 px-4 pt-4">
        {selectedProject ? (
          <ProjectEditor
            project={selectedProject}
            items={projectItems}
            features={projectFeatures}
            onUpdate={handleUpdate}
            onDelete={() => handleDelete(selectedProject.id)}
            onItemsChange={(items) => handleItemsChange(selectedProject.id, items)}
            onSendToTapTask={(item) => handleSendToTapTask(selectedProject, item)}
            onFeaturesChange={(features) => handleFeaturesChange(selectedProject.id, features)}
            onClose={() => setSelectedId(null)}
            businessNodes={projectBusinessNodes}
            onBusinessNodesChange={(nodes) => {
              const without = allBusinessNodes.filter((n) => n.projectId !== selectedProject.id);
              setAllBusinessNodes([...without, ...nodes]);
            }}
            landingSpec={projectLandingSpec}
            onLandingSpecChange={(spec) => {
              const without = allLandingSpecs.filter((s) => s.projectId !== selectedProject.id);
              setAllLandingSpecs(spec ? [...without, spec] : without);
            }}
            buildTrees={projectBuildTrees}
            onBuildTreesChange={(trees) => {
              const without = allBuildTrees.filter((t) => t.projectId !== selectedProject.id);
              setAllBuildTrees([...without, ...trees]);
            }}
            buildNodes={projectBuildNodes}
            onBuildNodesChange={(nodes) => {
              const treeIds = new Set(projectBuildTrees.map((t) => t.id));
              const without = allBuildNodes.filter((n) => !treeIds.has(n.buildTreeId));
              setAllBuildNodes([...without, ...nodes]);
            }}
            onSendToBuild={handleSendToBuild}
          />
        ) : (
          <>
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-900">Web Pages</h2>
              <button
                type="button"
                onClick={handleCreate}
                className="rounded-xl bg-brand px-4 py-2 text-sm font-semibold text-white"
              >
                + New Web Page
              </button>
            </div>

            {projects.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-200 p-8 text-center">
                <p className="text-sm font-semibold text-slate-700">No web pages yet.</p>
                <p className="mt-1 text-xs text-slate-400">
                  Add your first web page, scope it, generate a roadmap, and send items to the Build tab.
                </p>
                <button
                  type="button"
                  onClick={handleCreate}
                  className="mt-4 rounded-xl bg-brand px-6 py-2.5 text-sm font-semibold text-white"
                >
                  Add your first web page
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {projects.map((p) => (
                  <ProjectCard
                    key={p.id}
                    project={p}
                    featureCount={allFeatures.filter((f) => f.projectId === p.id).length}
                    onSelect={() => setSelectedId(p.id)}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </main>
  );
}
