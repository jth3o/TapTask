"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { MobileHeader } from "@/components/MobileHeader";
import {
  loadIdeaProjects, loadRoadmapItems, loadAndClearOpenProjectId,
  saveIdeaProjects, saveRoadmapItems, saveTaskPrefill,
  loadLandingPageSpecs, saveLandingPageSpecs,
  // Tree storage kept for Labs section and delete cleanup
  loadBusinessNodes, saveBusinessNodes,
  loadBuildTrees, saveBuildTrees,
  loadBuildNodes, saveBuildNodes,
} from "@/lib/ideaStorage";
import {
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
import { AGENT_OPTIONS, TASK_TYPE_OPTIONS, Agent, TaskType } from "@/lib/types";
import { CreateRepoPanel } from "@/components/CreateRepoPanel";
import { LandingPageSection } from "@/components/LandingPageSection";
// Tree components — kept in codebase, rendered only inside the Labs (Experimental) section
import { BusinessTreeSection } from "@/components/BusinessTreeSection";
import { BuildTreeSection } from "@/components/BuildTreeSection";
import { BusinessNode, LandingPageSpec, BuildTree, BuildNode } from "@/lib/treeTypes";

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

function buildPromptPreview(item: RoadmapItem): string {
  const lines: string[] = [];
  lines.push(`Task: ${item.title || "(untitled)"}`);
  if (item.description) lines.push(`\n${item.description}`);
  const criteria = item.acceptanceCriteria.filter(Boolean);
  if (criteria.length > 0) {
    lines.push(`\nAcceptance Criteria:`);
    criteria.forEach((c) => lines.push(`- ${c}`));
  }
  const nonGoals = item.nonGoals.filter(Boolean);
  if (nonGoals.length > 0) {
    lines.push(`\nNon-Goals:`);
    nonGoals.forEach((g) => lines.push(`- ${g}`));
  }
  return lines.join("\n");
}

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
  const [showPrompt, setShowPrompt] = useState(false);
  const [copied, setCopied] = useState(false);

  const setField = <K extends keyof RoadmapItem>(key: K, val: RoadmapItem[K]) =>
    onUpdate({ ...item, [key]: val });

  const statusColors: Record<RoadmapItemStatus, string> = ROADMAP_STATUS_COLORS;
  const filledCriteria = item.acceptanceCriteria.filter(Boolean);

  const handleCopyPrompt = () => {
    navigator.clipboard.writeText(buildPromptPreview(item)).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

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
            {filledCriteria.length > 0 && (
              <span className="rounded bg-emerald-50 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700">
                {filledCriteria.length} criteri{filledCriteria.length === 1 ? "on" : "a"}
              </span>
            )}
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

      {/* Inline criteria preview (when not expanded and criteria exist) */}
      {!expanded && filledCriteria.length > 0 && (
        <div className="border-t border-slate-100 px-3 py-2">
          <div className="space-y-0.5">
            {filledCriteria.map((c, i) => (
              <div key={i} className="flex items-start gap-1.5">
                <span className="mt-0.5 text-[10px] text-slate-300">✓</span>
                <p className="text-xs text-slate-500">{c}</p>
              </div>
            ))}
          </div>
        </div>
      )}

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

          {/* Acceptance criteria — pre-populated from promises */}
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

          {/* Agent prompt preview */}
          <div className="rounded-lg border border-slate-200 bg-slate-50">
            <button
              type="button"
              onClick={() => setShowPrompt((v) => !v)}
              className="flex w-full items-center justify-between px-3 py-2 text-left"
            >
              <span className="text-xs font-semibold text-slate-500">Agent Prompt Preview</span>
              <span className="text-xs text-slate-400">{showPrompt ? "▲" : "▼"}</span>
            </button>
            {showPrompt && (
              <div className="border-t border-slate-200 p-3">
                <pre className="whitespace-pre-wrap text-xs text-slate-600 leading-relaxed">
                  {buildPromptPreview(item)}
                </pre>
                <button
                  type="button"
                  onClick={handleCopyPrompt}
                  className="mt-2 text-xs font-semibold text-brand hover:opacity-70"
                >
                  {copied ? "✓ Copied" : "Copy prompt"}
                </button>
              </div>
            )}
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

// ─── Labs Section (Experimental) ─────────────────────────────────────────────
// This section houses experimental tree-based planning tools.
// It is NOT part of the primary workflow and is hidden by default.
// Business Tree and Build Trees are not required to create projects,
// generate landing pages, or dispatch build tasks.

function LabsSection({
  project,
  landingSpec,
  onSendToBuild,
}: {
  project: IdeaProject;
  landingSpec: LandingPageSpec | null;
  onSendToBuild: (prefill: TaskPrefill) => void;
}) {
  const [open, setOpen] = useState(false);
  const [businessNodes, setBusinessNodes] = useState<BusinessNode[]>([]);
  const [buildTrees, setBuildTrees] = useState<BuildTree[]>([]);
  const [buildNodes, setBuildNodes] = useState<BuildNode[]>([]);
  const [loaded, setLoaded] = useState(false);

  // Lazy-load tree data only when the Labs section is first opened
  useEffect(() => {
    if (open && !loaded) {
      setBusinessNodes(loadBusinessNodes().filter((n) => n.projectId === project.id));
      const trees = loadBuildTrees().filter((t) => t.projectId === project.id);
      setBuildTrees(trees);
      const treeIds = new Set(trees.map((t) => t.id));
      setBuildNodes(loadBuildNodes().filter((n) => treeIds.has(n.buildTreeId)));
      setLoaded(true);
    }
  }, [open, loaded, project.id]);

  const handleNodesChange = (nodes: BusinessNode[]) => {
    setBusinessNodes(nodes);
    const all = loadBusinessNodes();
    const without = all.filter((n) => n.projectId !== project.id);
    saveBusinessNodes([...without, ...nodes]);
  };

  const handleTreesChange = (trees: BuildTree[]) => {
    setBuildTrees(trees);
    const all = loadBuildTrees();
    const without = all.filter((t) => t.projectId !== project.id);
    saveBuildTrees([...without, ...trees]);
  };

  const handleBuildNodesChange = (nodes: BuildNode[]) => {
    setBuildNodes(nodes);
    const treeIds = new Set(buildTrees.map((t) => t.id));
    const all = loadBuildNodes();
    const without = all.filter((n) => !treeIds.has(n.buildTreeId));
    saveBuildNodes([...without, ...nodes]);
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between p-4 text-left"
      >
        <div className="flex items-center gap-2">
          <p className="text-sm font-semibold text-slate-700">Labs</p>
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-500">
            Experimental
          </span>
        </div>
        <span className="text-slate-400">{open ? "▲" : "▼"}</span>
      </button>

      {open && (
        <div className="space-y-6 border-t border-slate-100 p-4">
          <p className="text-xs text-slate-400">
            These tools are experimental and not required for the main workflow. Business and build trees may
            become part of a future planning feature.
          </p>

          {/* Business Tree */}
          <div>
            <p className="mb-3 text-sm font-semibold text-slate-700">What needs solving?</p>
            <BusinessTreeSection
              project={project}
              nodes={businessNodes}
              onNodesChange={handleNodesChange}
              onSendToBuild={onSendToBuild}
            />
          </div>

          {/* Build Trees */}
          <div>
            <p className="mb-3 text-sm font-semibold text-slate-700">How will we build this part?</p>
            <BuildTreeSection
              project={project}
              businessNodes={businessNodes}
              landingSpec={landingSpec}
              trees={buildTrees}
              allBuildNodes={buildNodes}
              onTreesChange={handleTreesChange}
              onBuildNodesChange={handleBuildNodesChange}
              onSendToBuild={onSendToBuild}
            />
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Project Editor ───────────────────────────────────────────────────────────
// Primary workflow: name → problem → target user → MVP → GitHub repo →
//   landing page spec → promises → Build Landing Page → PR / preview / merge

function ProjectEditor({
  project,
  items,
  onUpdate,
  onDelete,
  onItemsChange,
  onSendToTapTask,
  onClose,
  landingSpec,
  onLandingSpecChange,
  onSendToBuild,
}: {
  project: IdeaProject;
  items: RoadmapItem[];
  onUpdate: (p: IdeaProject) => void;
  onDelete: () => void;
  onItemsChange: (items: RoadmapItem[]) => void;
  onSendToTapTask: (item: RoadmapItem) => void;
  onClose: () => void;
  landingSpec: LandingPageSpec | null;
  onLandingSpecChange: (spec: LandingPageSpec | null) => void;
  onSendToBuild: (prefill: TaskPrefill) => void;
  // onCreateBuildTask is passed down to LandingPageSection so promise cards can inject tasks
}) {
  const [generating, setGenerating] = useState<GenerateAction | null>(null);
  const [generateError, setGenerateError] = useState("");
  const [clarityScore, setClarityScore] = useState<{ score: number; feedback: string } | null>(null);
  const [createRepoOpen, setCreateRepoOpen] = useState(false);

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
        setClarityScore(res.result as { score: number; feedback: string });
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

  // Called when user clicks "Create Build Task" on a promise card
  const handleCreateBuildTask = (fields: { title: string; description: string; acceptanceCriteria: string[] }) => {
    const newItem: RoadmapItem = {
      id: crypto.randomUUID(),
      projectId: project.id,
      title: fields.title,
      description: fields.description,
      taskType: "new_feature",
      acceptanceCriteria: fields.acceptanceCriteria,
      nonGoals: [],
      suggestedAgent: "cursor",
      status: "pending",
    };
    onItemsChange([...items, newItem]);
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2">
        <button type="button" onClick={onClose} className="text-sm text-slate-400 hover:text-slate-600">
          ← Back
        </button>
        <div className="flex flex-1 items-center gap-2">
          <StatusPicker value={project.status} onChange={(s) => set("status", s)} />
          {clarityScore && <ClarityBadge score={clarityScore.score} />}
        </div>
        <button type="button" onClick={onDelete} className="text-xs text-red-400 hover:text-red-600">
          Delete
        </button>
      </div>

      {/* Step 1 — Project basics */}
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
          {clarityScore && (
            <p className="mt-1.5 text-xs text-slate-500">{clarityScore.feedback}</p>
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
      </div>

      {generateError && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-700">
          {generateError}
        </div>
      )}

      {/* Step 2 — GitHub repo */}
      <div className="space-y-2 rounded-2xl border border-slate-200 bg-white p-4">
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

      {/* Step 3 — Landing page spec + promises */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4">
        <p className="mb-3 text-base font-semibold text-slate-900">Landing Page &amp; Promises</p>
        <LandingPageSection
          project={project}
          spec={landingSpec}
          onSpecChange={onLandingSpecChange}
          onSendToBuild={onSendToBuild}
          onCreateBuildTask={handleCreateBuildTask}
        />
      </div>

      {/* Step 4 — Build tasks created from promises or added manually */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-base font-semibold text-slate-900">
            Build Tasks {items.length > 0 ? `(${items.length})` : ""}
          </p>
          <div className="flex gap-2">
            <GenerateButton
              label="Generate tasks"
              loading={generating === "roadmap"}
              onClick={() => generate("roadmap")}
            />
            <button
              type="button"
              onClick={addItem}
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"
            >
              + Add
            </button>
          </div>
        </div>

        {items.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-200 p-4 text-center">
            <p className="text-xs text-slate-500">No build tasks yet.</p>
            <p className="mt-0.5 text-xs text-slate-400">
              Use <span className="font-medium">Create Build Task</span> on a promise above, or add manually.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {items.map((item) => (
              <RoadmapItemRow
                key={item.id}
                item={item}
                onUpdate={updateItem}
                onDelete={() => deleteItem(item.id)}
                onSend={() => onSendToTapTask(item)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Labs — experimental tree tools, not part of the primary workflow */}
      <LabsSection
        project={project}
        landingSpec={landingSpec}
        onSendToBuild={onSendToBuild}
      />
    </div>
  );
}

// ─── Project Card (list view) ─────────────────────────────────────────────────

function ProjectCard({
  project,
  itemCount,
  onSelect,
}: {
  project: IdeaProject;
  itemCount: number;
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
      {itemCount > 0 && (
        <p className="mt-2 text-xs text-slate-400">{itemCount} build task{itemCount !== 1 ? "s" : ""}</p>
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
  const [allLandingSpecs, setAllLandingSpecs] = useState<LandingPageSpec[]>([]);

  useEffect(() => {
    const loaded = loadIdeaProjects();
    setProjects(loaded);
    setAllItems(loadRoadmapItems());
    setAllLandingSpecs(loadLandingPageSpecs());
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
    saveProjects([p, ...projects]);
    setSelectedId(p.id);
  };

  const handleUpdate = (updated: IdeaProject) => {
    saveProjects(projects.map((p) => (p.id === updated.id ? updated : p)));
  };

  const handleDelete = (id: string) => {
    saveProjects(projects.filter((p) => p.id !== id));
    saveItems(allItems.filter((i) => i.projectId !== id));
    // Clean up tree data for the deleted project (kept for storage hygiene)
    saveBusinessNodes(loadBusinessNodes().filter((n) => n.projectId !== id));
    const remainingTrees = loadBuildTrees().filter((t) => t.projectId !== id);
    saveBuildTrees(remainingTrees);
    const remainingTreeIds = new Set(remainingTrees.map((t) => t.id));
    saveBuildNodes(loadBuildNodes().filter((n) => remainingTreeIds.has(n.buildTreeId)));
    setAllLandingSpecs((prev) => prev.filter((s) => s.projectId !== id));
    setSelectedId(null);
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
  const projectLandingSpec = selectedProject
    ? (allLandingSpecs.find((s) => s.projectId === selectedProject.id) ?? null)
    : null;

  return (
    <main className="mx-auto min-h-screen max-w-xl pb-24">
      <MobileHeader />

      <div className="space-y-4 px-4 pt-4">
        {selectedProject ? (
          <ProjectEditor
            project={selectedProject}
            items={projectItems}
            onUpdate={handleUpdate}
            onDelete={() => handleDelete(selectedProject.id)}
            onItemsChange={(items) => handleItemsChange(selectedProject.id, items)}
            onSendToTapTask={(item) => handleSendToTapTask(selectedProject, item)}
            onClose={() => setSelectedId(null)}
            landingSpec={projectLandingSpec}
            onLandingSpecChange={(spec) => {
              const without = allLandingSpecs.filter((s) => s.projectId !== selectedProject.id);
              const next = spec ? [...without, spec] : without;
              setAllLandingSpecs(next);
              saveLandingPageSpecs(next);
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
                  Create a web page project, define the problem, connect a repo, and generate a landing page.
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
                    itemCount={allItems.filter((i) => i.projectId === p.id).length}
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
