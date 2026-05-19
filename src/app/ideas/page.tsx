"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { MobileHeader } from "@/components/MobileHeader";
import { loadIdeaProjects, loadAndClearOpenProjectId, saveIdeaProjects, saveTaskPrefill, loadFeatures, saveFeatures, loadGoals, saveGoals } from "@/lib/ideaStorage";
import {
  Feature,
  GenerateAction,
  GenerateResponse,
  Goal,
  IdeaProject,
  PROJECT_STATUS_COLORS,
  PROJECT_STATUS_LABELS,
  PROJECT_STATUSES,
  ProjectStatus,
  TaskPrefill,
} from "@/lib/ideaTypes";
import { FeaturesSection } from "@/components/FeaturesSection";
import { CreateRepoPanel } from "@/components/CreateRepoPanel";
import ActiveCycleSection from "@/components/ActiveCycleSection";
import { getActiveProjectCycle } from "@/lib/projectCycleStorage";

// ─── Next Step ────────────────────────────────────────────────────────────────

type NextStep =
  | { type: "fill_problem" }
  | { type: "generate_target_user" }
  | { type: "generate_mvp" }
  | { type: "score_clarity" }
  | { type: "improve_clarity"; feedback: string }
  | { type: "create_cycle" }
  | { type: "all_done" };

function computeNextStep(project: IdeaProject): NextStep {
  if (!project.problem.trim()) return { type: "fill_problem" };
  if (!project.targetUser.trim()) return { type: "generate_target_user" };
  if (!project.mvpDefinition.trim()) return { type: "generate_mvp" };
  if (!project.clarityScore) return { type: "score_clarity" };
  if (project.clarityScore.score < 7) return { type: "improve_clarity", feedback: project.clarityScore.feedback };
  if (!getActiveProjectCycle(project.id)) return { type: "create_cycle" };
  return { type: "all_done" };
}

function NextStepCard({
  step,
  onGenerate,
}: {
  step: NextStep;
  onGenerate: (action: GenerateAction) => void;
}) {
  if (step.type === "all_done") return null;

  const configs: Record<string, { headline: string; description: string; cta?: string; action?: GenerateAction }> = {
    fill_problem:         { headline: "Describe the problem", description: "What pain does this solve, and for whom?" },
    generate_target_user: { headline: "Define your target user", description: "Who specifically will use this?", cta: "✦ Generate", action: "target_user" },
    generate_mvp:         { headline: "Define your MVP", description: "What's the smallest version that proves value?", cta: "✦ Generate", action: "mvp" },
    score_clarity:        { headline: "Score your clarity", description: "Check if the idea is clear enough to build.", cta: "✦ Score", action: "clarity_score" },
    create_cycle:         { headline: "Start your first cycle", description: "↓ Scroll to Active Cycle below and click \"Start first cycle\"." },
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

// ─── Project Editor ───────────────────────────────────────────────────────────

function ProjectEditor({
  project,
  features,
  goals,
  onUpdate,
  onDelete,
  onFeaturesChange,
  onGoalsChange,
  onClose,
  onSendToBuild,
}: {
  project: IdeaProject;
  features: Feature[];
  goals: Goal[];
  onUpdate: (p: IdeaProject) => void;
  onDelete: () => void;
  onFeaturesChange: (features: Feature[]) => void;
  onGoalsChange: (goals: Goal[]) => void;
  onClose: () => void;
  onSendToBuild: (prefill: TaskPrefill) => void;
}) {
  const [generating, setGenerating] = useState<GenerateAction | null>(null);
  const [generateError, setGenerateError] = useState("");
  const [createRepoOpen, setCreateRepoOpen] = useState(false);
  const [showUnscopedItems, setShowUnscopedItems] = useState(false);
  const [summary, setSummary] = useState<string | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [overviewOpen, setOverviewOpen] = useState(false);

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
      } else if (action === "clarity_score" && typeof res.result === "object" && !Array.isArray(res.result)) {
        set("clarityScore", res.result as IdeaProject["clarityScore"]);
      } else if (action === "success_metrics" && Array.isArray(res.result)) {
        set("successMetrics", res.result as string[]);
      }
    } catch {
      setGenerateError("Generation failed. Check your network connection.");
    } finally {
      setGenerating(null);
    }
  };

  const generateSummary = async () => {
    setSummaryLoading(true);
    setSummary(null);
    try {
      const doneFeatures = features.filter((f) => f.status === "done").map((f) => f.title);
      const inProgressFeatures = features.filter((f) => f.status === "in_progress").map((f) => f.title);
      const goalTitles = goals.map((g) => g.title).filter(Boolean);
      const res = await fetch("/api/ideas/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "product_summary",
          project,
          summaryContext: { doneFeatures, inProgressFeatures, goals: goalTitles },
        }),
      });
      const data = (await res.json()) as GenerateResponse;
      if (data.error) { setSummary(`Error: ${data.error}`); return; }
      if (typeof data.result === "string") setSummary(data.result);
    } catch {
      setSummary("Generation failed. Check your network connection.");
    } finally {
      setSummaryLoading(false);
    }
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
          {project.clarityScore && <ClarityBadge score={project.clarityScore.score} />}
        </div>
        <button
          type="button"
          onClick={() => { setSummary(null); generateSummary(); }}
          disabled={summaryLoading}
          className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-600 hover:border-slate-300 hover:bg-slate-50 disabled:opacity-50"
        >
          {summaryLoading ? "…" : "✦ What's built"}
        </button>
        <button type="button" onClick={onDelete} className="text-xs text-red-400 hover:text-red-600">
          Delete
        </button>
      </div>

      {/* Product summary panel */}
      {summary && (
        <div className="rounded-xl border border-brand/20 bg-brand/5 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-brand">Product Summary</p>
            <button type="button" onClick={() => setSummary(null)} className="text-xs text-slate-400 hover:text-slate-600">✕</button>
          </div>
          <div className="space-y-3 text-xs text-slate-700 whitespace-pre-wrap leading-relaxed">
            {summary.split(/\n(?=WHAT'S BUILT|WHY IT'S USEFUL|HOW TO USE IT)/).map((section, i) => {
              const [label, ...rest] = section.split("\n");
              return (
                <div key={i}>
                  <p className="font-semibold text-slate-500 mb-1">{label}</p>
                  <p className="whitespace-pre-wrap">{rest.join("\n").trim()}</p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Next step */}
      <NextStepCard
        step={computeNextStep(project)}
        onGenerate={generate}
      />

      {/* Core fields — collapsible */}
      <div className="rounded-2xl border border-slate-200 bg-white">
        <button
          type="button"
          onClick={() => setOverviewOpen((o) => !o)}
          className="flex w-full items-center justify-between px-4 py-3 text-left"
        >
          <div className="min-w-0">
            <p className="text-sm font-semibold text-slate-800 truncate">{project.name || "Unnamed project"}</p>
            {!overviewOpen && (
              <p className="text-xs text-slate-400 truncate mt-0.5">
                {project.problem ? project.problem.slice(0, 80) + (project.problem.length > 80 ? "…" : "") : "No problem statement yet"}
              </p>
            )}
          </div>
          <span className="ml-2 shrink-0 text-xs text-slate-400">{overviewOpen ? "▲" : "▼"}</span>
        </button>

        {overviewOpen && (
        <div className="space-y-3 border-t border-slate-100 p-4">
          <input
            className="w-full bg-transparent text-lg font-bold text-slate-900 outline-none placeholder:font-normal placeholder:text-slate-400"
            placeholder="Web page name…"
            value={project.name}
            onChange={(e) => set("name", e.target.value)}
          />

        {project.marketArenaName && (
          <a
            href="/market"
            className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-500 hover:border-slate-300 hover:text-slate-700 no-underline"
          >
            <span>📡</span>
            <span>From Market Scan: <span className="font-semibold">{project.marketArenaName}</span></span>
          </a>
        )}

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
            <div className="mt-2 space-y-1.5">
              {project.clarityScore.breakdown && (
                <div className="rounded-xl border border-slate-100 bg-slate-50 p-2.5 space-y-1">
                  {(
                    [
                      ["Problem clarity", project.clarityScore.breakdown.problemClarity],
                      ["User alignment",  project.clarityScore.breakdown.userAlignment],
                      ["MVP scope",       project.clarityScore.breakdown.mvpScope],
                      ["Feasibility",     project.clarityScore.breakdown.feasibility],
                    ] as [string, number][]
                  ).map(([label, val]) => {
                    const fill = val >= 8 ? "bg-emerald-400" : val >= 5 ? "bg-amber-400" : "bg-red-400";
                    const text = val >= 8 ? "text-emerald-600" : val >= 5 ? "text-amber-600" : "text-red-500";
                    return (
                      <div key={label} className="flex items-center gap-2">
                        <span className="w-28 shrink-0 text-[10px] text-slate-500">{label}</span>
                        <div className="flex-1 h-1 rounded-full bg-slate-200">
                          <div className={`h-1 rounded-full ${fill}`} style={{ width: `${val * 10}%` }} />
                        </div>
                        <span className={`w-4 text-right text-[10px] font-bold ${text}`}>{val}</span>
                      </div>
                    );
                  })}
                </div>
              )}
              <p className="text-xs text-slate-500">{project.clarityScore.feedback}</p>
            </div>
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

        <div>
          <div className="mb-1 flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
              Success metrics {project.successMetrics && project.successMetrics.length > 0 ? `(${project.successMetrics.length})` : ""}
            </p>
            <GenerateButton
              label="Generate"
              loading={generating === "success_metrics"}
              onClick={() => generate("success_metrics")}
            />
          </div>
          {project.successMetrics && project.successMetrics.length > 0 ? (
            <ul className="space-y-1">
              {project.successMetrics.map((m, i) => (
                <li key={i} className="flex gap-2">
                  <input
                    className="flex-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs text-slate-700 outline-none focus:border-brand"
                    value={m}
                    onChange={(e) => {
                      const next = [...(project.successMetrics ?? [])];
                      next[i] = e.target.value;
                      set("successMetrics", next);
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => set("successMetrics", (project.successMetrics ?? []).filter((_, j) => j !== i))}
                    className="px-2 text-slate-300 hover:text-red-400"
                  >
                    ×
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-slate-400">No metrics yet. Generate or add manually.</p>
          )}
          <button
            type="button"
            onClick={() => set("successMetrics", [...(project.successMetrics ?? []), ""])}
            className="mt-1.5 text-xs text-slate-400 hover:text-slate-600"
          >
            + Add metric
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
        )}
      </div>

      {generateError && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-700">
          {generateError}
        </div>
      )}

      {/* Active Cycle (cycle-first planning) */}
      <ActiveCycleSection
        project={project}
        features={features}
        onFeaturesChange={onFeaturesChange}
        goals={goals}
        onGoalsChange={onGoalsChange}
        onSendToBuild={onSendToBuild}
      />

      {/* Unscoped items from before cycles existed */}
      {(() => {
        const unscopedGoals = goals.filter((g) => !g.cycleId);
        const unscopedFeatures = features.filter((f) => {
          const goal = f.goalId ? goals.find((g) => g.id === f.goalId) : null;
          return !goal || !goal.cycleId;
        });
        if (unscopedGoals.length === 0 && unscopedFeatures.length === 0) return null;
        return (
          <div className="rounded-2xl border border-slate-200 bg-white">
            <button
              type="button"
              onClick={() => setShowUnscopedItems((v) => !v)}
              className="flex w-full items-center justify-between p-4 text-left"
            >
              <p className="text-sm font-semibold text-slate-500">
                Unscoped items ({unscopedGoals.length + unscopedFeatures.length})
              </p>
              <span className="text-slate-400">{showUnscopedItems ? "▲" : "▼"}</span>
            </button>
            {showUnscopedItems && (
              <div className="border-t border-slate-100 p-4">
                <p className="mb-3 text-xs text-slate-400">
                  Goals and features not linked to any cycle. Move them into an active cycle or delete them.
                </p>
                <FeaturesSection
                  project={project}
                  features={unscopedFeatures}
                  onFeaturesChange={(updated) => {
                    const cycleFeatures = features.filter((f) => {
                      const goal = f.goalId ? goals.find((g) => g.id === f.goalId) : null;
                      return goal && goal.cycleId;
                    });
                    onFeaturesChange([...cycleFeatures, ...updated]);
                  }}
                  goals={unscopedGoals}
                  onGoalsChange={(updatedGoals) => {
                    const cycleGoals = goals.filter((g) => g.cycleId);
                    onGoalsChange([...cycleGoals, ...updatedGoals]);
                  }}
                  onSendToBuild={onSendToBuild}
                />
              </div>
            )}
          </div>
        );
      })()}

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
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [allFeatures, setAllFeatures] = useState<Feature[]>([]);
  const [allGoals, setAllGoals] = useState<Goal[]>([]);

  useEffect(() => {
    const loaded = loadIdeaProjects();
    setProjects(loaded);
    setAllFeatures(loadFeatures());
    setAllGoals(loadGoals());
    const openId = loadAndClearOpenProjectId();
    if (openId && loaded.find((p) => p.id === openId)) {
      setSelectedId(openId);
    }
  }, []);

  const saveProjects = (next: IdeaProject[]) => {
    setProjects(next);
    saveIdeaProjects(next);
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
    const nextFeatures = allFeatures.filter((f) => f.projectId !== id);
    setAllFeatures(nextFeatures);
    saveFeatures(nextFeatures);
    const nextGoals = allGoals.filter((g) => g.projectId !== id);
    setAllGoals(nextGoals);
    saveGoals(nextGoals);
    setSelectedId(null);
  };

  const handleGoalsChange = (projectId: string, goals: Goal[]) => {
    const without = allGoals.filter((g) => g.projectId !== projectId);
    const next = [...without, ...goals];
    setAllGoals(next);
    saveGoals(next);
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

  const selectedProject = projects.find((p) => p.id === selectedId) ?? null;
  const projectFeatures = selectedProject
    ? allFeatures.filter((f) => f.projectId === selectedProject.id)
    : [];

  return (
    <main className="mx-auto min-h-screen max-w-xl pb-24">
      <MobileHeader />

      <div className="space-y-4 px-4 pt-4">
        {selectedProject ? (
          <ProjectEditor
            project={selectedProject}
            features={projectFeatures}
            goals={allGoals.filter((g) => g.projectId === selectedProject.id)}
            onUpdate={handleUpdate}
            onDelete={() => handleDelete(selectedProject.id)}
            onFeaturesChange={(features) => handleFeaturesChange(selectedProject.id, features)}
            onGoalsChange={(goals) => handleGoalsChange(selectedProject.id, goals)}
            onClose={() => setSelectedId(null)}
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
