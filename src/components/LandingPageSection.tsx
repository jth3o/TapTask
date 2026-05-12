"use client";

import { useState, useCallback } from "react";
import { IdeaProject, RoadmapItem, TaskPrefill } from "@/lib/ideaTypes";
import {
  LandingPageSpec,
  LandingPageFeature,
  BuildDifficulty,
  DIFFICULTY_COLORS,
  TREE_STATUS_COLORS,
  TREE_STATUS_LABELS,
  TREE_STATUSES,
  TreeStatus,
} from "@/lib/treeTypes";
import { saveLandingPageSpecs, loadLandingPageSpecs } from "@/lib/ideaStorage";
import { RawLandingPageSpec } from "@/app/api/tree/landing/route";

// LandingPageSpec and LandingPageFeature live in treeTypes but are core to the
// primary workflow — they are not gated behind the experimental Labs section.

// ─── Types ────────────────────────────────────────────────────────────────────

interface BuildTaskFields {
  title: string;
  description: string;
  acceptanceCriteria: string[];
}

interface Props {
  project: IdeaProject;
  spec: LandingPageSpec | null;
  onSpecChange: (spec: LandingPageSpec | null) => void;
  onSendToBuild: (prefill: TaskPrefill) => void;
  onCreateBuildTask: (fields: BuildTaskFields) => void;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function newFeature(specId: string): LandingPageFeature {
  return {
    id: crypto.randomUUID(),
    landingPageSpecId: specId,
    title: "",
    userProblem: "",
    whatItDoes: "",
    whyItMatters: "",
    successDefinition: "",
    status: "not_started",
    notes: "",
  };
}

/** Split a successDefinition paragraph into 2-3 acceptance criteria bullets. */
function parseCriteria(successDef: string): string[] {
  if (!successDef.trim()) return [];
  const sentences = successDef
    .split(/\.\s+/)
    .map((s) => s.replace(/\.$/, "").trim())
    .filter(Boolean);
  return sentences.length > 0 ? sentences : [successDef.trim()];
}

// ─── Promise Card ─────────────────────────────────────────────────────────────

function PromiseCard({
  feature,
  onCreateTask,
}: {
  feature: LandingPageFeature;
  onCreateTask: (fields: BuildTaskFields) => void;
}) {
  const [taskTitle, setTaskTitle] = useState(`Build: ${feature.title}`);
  const [created, setCreated] = useState(false);

  const difficulty: BuildDifficulty = feature.buildDifficulty ?? "medium";
  const difficultyLabel: Record<BuildDifficulty, string> = {
    low: "Low effort",
    medium: "Medium effort",
    high: "High effort",
  };

  const handleCreate = () => {
    const criteria = parseCriteria(feature.successDefinition);
    const description = [
      feature.whatItDoes,
      feature.whyItMatters ? `\n\nWhy it matters: ${feature.whyItMatters}` : null,
      feature.userProblem ? `\n\nProblem solved: ${feature.userProblem}` : null,
    ]
      .filter(Boolean)
      .join("");

    onCreateTask({ title: taskTitle.trim() || `Build: ${feature.title}`, description, acceptanceCriteria: criteria });
    setCreated(true);
  };

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3.5 space-y-2.5">
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-semibold text-slate-900 leading-snug">{feature.title}</p>
        <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${DIFFICULTY_COLORS[difficulty]}`}>
          {difficultyLabel[difficulty]}
        </span>
      </div>

      {/* Short explanation */}
      {feature.userProblem && (
        <p className="text-xs text-slate-500 leading-relaxed">{feature.userProblem}</p>
      )}

      {/* Implied feature */}
      {feature.whatItDoes && (
        <div className="rounded-lg bg-slate-50 px-2.5 py-2">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 mb-0.5">Implied feature</p>
          <p className="text-xs text-slate-700">{feature.whatItDoes}</p>
        </div>
      )}

      {/* Success definition preview */}
      {feature.successDefinition && (
        <div className="space-y-1">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Acceptance criteria</p>
          {parseCriteria(feature.successDefinition).map((c, i) => (
            <div key={i} className="flex items-start gap-1.5">
              <span className="mt-0.5 text-[10px] text-slate-300">✓</span>
              <p className="text-xs text-slate-600">{c}</p>
            </div>
          ))}
        </div>
      )}

      {/* Suggested task title */}
      <div>
        <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400">Suggested task title</p>
        <input
          className="w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs text-slate-700 outline-none focus:border-brand"
          value={taskTitle}
          onChange={(e) => { setTaskTitle(e.target.value); setCreated(false); }}
        />
      </div>

      {/* CTA */}
      <button
        type="button"
        onClick={handleCreate}
        disabled={created}
        className={`w-full rounded-lg py-2 text-xs font-semibold transition-colors ${
          created
            ? "border border-emerald-200 bg-emerald-50 text-emerald-700"
            : "bg-brand text-white hover:opacity-90"
        }`}
      >
        {created ? "✓ Task added to Build Tasks" : "Create Build Task"}
      </button>
    </div>
  );
}

// ─── Spec editor (collapsible detail view) ────────────────────────────────────

function FeatureCard({
  feature,
  onUpdate,
  onDelete,
}: {
  feature: LandingPageFeature;
  onUpdate: (f: LandingPageFeature) => void;
  onDelete: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const set = <K extends keyof LandingPageFeature>(key: K, val: LandingPageFeature[K]) =>
    onUpdate({ ...feature, [key]: val });

  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50">
      <div className="flex items-center gap-2 p-2.5">
        <div className="flex-1">
          <input
            className="w-full bg-transparent text-xs font-semibold text-slate-900 outline-none placeholder:font-normal placeholder:text-slate-400"
            placeholder="Feature title…"
            value={feature.title}
            onChange={(e) => set("title", e.target.value)}
          />
        </div>
        <button type="button" onClick={() => setExpanded((v) => !v)} className="text-xs text-slate-400 hover:text-slate-600">
          {expanded ? "▲" : "▼"}
        </button>
        <button type="button" onClick={onDelete} className="text-xs text-red-400 hover:text-red-600">×</button>
      </div>

      {expanded && (
        <div className="space-y-2 border-t border-slate-200 p-2.5">
          <input className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-700 outline-none focus:border-brand" placeholder="User problem…" value={feature.userProblem} onChange={(e) => set("userProblem", e.target.value)} />
          <input className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-700 outline-none focus:border-brand" placeholder="What it does…" value={feature.whatItDoes} onChange={(e) => set("whatItDoes", e.target.value)} />
          <input className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-700 outline-none focus:border-brand" placeholder="Why it matters…" value={feature.whyItMatters} onChange={(e) => set("whyItMatters", e.target.value)} />
          <textarea className="w-full resize-none rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-700 outline-none focus:border-brand" rows={2} placeholder="Success definition (acceptance criteria)…" value={feature.successDefinition} onChange={(e) => set("successDefinition", e.target.value)} />
          <select className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700 outline-none" value={feature.status} onChange={(e) => set("status", e.target.value as TreeStatus)}>
            {TREE_STATUSES.map((s) => <option key={s} value={s}>{TREE_STATUS_LABELS[s]}</option>)}
          </select>
          <textarea className="w-full resize-none rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-700 outline-none focus:border-brand" rows={2} placeholder="Notes…" value={feature.notes} onChange={(e) => set("notes", e.target.value)} />
        </div>
      )}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function LandingPageSection({ project, spec, onSpecChange, onSendToBuild, onCreateBuildTask }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showSpecEditor, setShowSpecEditor] = useState(false);

  const canGenerate = !!(project.name || project.problem);

  const persist = useCallback(
    (next: LandingPageSpec | null) => {
      onSpecChange(next);
      const all = loadLandingPageSpecs();
      const without = all.filter((s) => s.projectId !== project.id);
      saveLandingPageSpecs(next ? [...without, next] : without);
    },
    [onSpecChange, project.id]
  );

  const handleGenerate = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/tree/landing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ project, selectedNodes: [] }),
      });
      const data = (await res.json()) as { spec?: RawLandingPageSpec; error?: string };
      if (data.error) { setError(data.error); return; }
      if (!data.spec) return;

      const now = new Date().toISOString();
      const specId = spec?.id ?? crypto.randomUUID();
      const newSpec: LandingPageSpec = {
        id: specId,
        projectId: project.id,
        heroHeadline: data.spec.heroHeadline ?? "",
        heroSubheadline: data.spec.heroSubheadline ?? "",
        targetUser: data.spec.targetUser ?? "",
        problemSection: data.spec.problemSection ?? "",
        productPromise: data.spec.productPromise ?? "",
        featureSections: (data.spec.featureSections ?? []).map((f) => ({
          id: crypto.randomUUID(),
          landingPageSpecId: specId,
          title: f.title ?? "",
          userProblem: f.userProblem ?? "",
          whatItDoes: f.whatItDoes ?? "",
          whyItMatters: f.whyItMatters ?? "",
          successDefinition: f.successDefinition ?? "",
          buildDifficulty: (["low", "medium", "high"].includes(f.buildDifficulty) ? f.buildDifficulty : "medium") as BuildDifficulty,
          status: "not_started" as TreeStatus,
          notes: "",
        })),
        workflowSteps: data.spec.workflowSteps ?? [],
        mvpBoundary: data.spec.mvpBoundary ?? "",
        primaryCta: data.spec.primaryCta ?? "",
        notes: data.spec.notes ?? "",
        status: "not_started",
        createdAt: spec?.createdAt ?? now,
        updatedAt: now,
      };
      persist(newSpec);
      setShowSpecEditor(false); // show promises view after generation
    } catch {
      setError("Generation failed. Check network connection.");
    } finally {
      setLoading(false);
    }
  };

  const setSpecField = <K extends keyof LandingPageSpec>(key: K, val: LandingPageSpec[K]) => {
    if (!spec) return;
    persist({ ...spec, [key]: val, updatedAt: new Date().toISOString() });
  };

  const updateFeature = (updated: LandingPageFeature) => {
    if (!spec) return;
    setSpecField("featureSections", spec.featureSections.map((f) => (f.id === updated.id ? updated : f)));
  };

  const deleteFeature = (id: string) => {
    if (!spec) return;
    setSpecField("featureSections", spec.featureSections.filter((f) => f.id !== id));
  };

  const addFeature = () => {
    if (!spec) return;
    setSpecField("featureSections", [...spec.featureSections, newFeature(spec.id)]);
  };

  const handleSendToBuild = () => {
    if (!spec) return;
    const featuresCtx = spec.featureSections.map((f) =>
      `Feature: ${f.title}\n  Problem: ${f.userProblem}\n  Does: ${f.whatItDoes}\n  Success: ${f.successDefinition}`
    ).join("\n");
    const rawInput = [
      `[Project: ${project.name}]`,
      `Target User: ${spec.targetUser || project.targetUser}`,
      `Headline: ${spec.heroHeadline}`,
      `Subheadline: ${spec.heroSubheadline}`,
      `\nProblem: ${spec.problemSection}`,
      `Promise: ${spec.productPromise}`,
      `\nFeatures:\n${featuresCtx}`,
      spec.workflowSteps.length > 0
        ? `\nWorkflow:\n${spec.workflowSteps.map((s, i) => `${i + 1}. ${s}`).join("\n")}`
        : null,
      `\nMVP Boundary: ${spec.mvpBoundary}`,
      `CTA: ${spec.primaryCta}`,
      spec.notes ? `\nNotes: ${spec.notes}` : null,
    ].filter(Boolean).join("\n").trim();
    const repoFullName = project.githubRepoUrl
      ? project.githubRepoUrl.replace("https://github.com/", "").replace(/\/$/, "")
      : undefined;
    onSendToBuild({ taskType: "new_feature", rawInput, agentSuggestion: "cursor", repoFullName });
  };

  return (
    <div className="space-y-4">
      {/* Generate button */}
      <div className="flex items-center justify-between">
        <p className="text-xs text-slate-500">
          {spec
            ? `${spec.featureSections.length} promise${spec.featureSections.length !== 1 ? "s" : ""} detected`
            : "Generate a landing page spec from your project definition."}
        </p>
        <button
          type="button"
          onClick={handleGenerate}
          disabled={loading || !canGenerate}
          className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-600 hover:border-slate-300 hover:bg-slate-50 disabled:opacity-50"
          title={!canGenerate ? "Add a project name or problem first" : undefined}
        >
          {loading ? "Generating…" : spec ? "✦ Regenerate" : "✦ Generate Spec"}
        </button>
      </div>

      {error && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-700">{error}</div>
      )}

      {!spec && !loading && (
        <div className="rounded-xl border border-dashed border-slate-200 p-4 text-center">
          <p className="text-xs text-slate-400">
            Generate a spec to extract product promises and turn them into build tasks.
          </p>
        </div>
      )}

      {spec && (
        <>
          {/* ── Spec summary ─────────────────────────────────────── */}
          <div className="rounded-xl border border-slate-200 bg-white">
            <button
              type="button"
              onClick={() => setShowSpecEditor((v) => !v)}
              className="flex w-full items-center justify-between px-3.5 py-3 text-left"
            >
              <div className="min-w-0 flex-1 pr-2">
                <p className="truncate text-sm font-semibold text-slate-900">
                  {spec.heroHeadline || "Landing Page Spec"}
                </p>
                {spec.productPromise && (
                  <p className="mt-0.5 truncate text-xs text-slate-500">{spec.productPromise}</p>
                )}
              </div>
              <span className="shrink-0 text-xs text-slate-400">
                {showSpecEditor ? "Hide spec ▲" : "Edit spec ▼"}
              </span>
            </button>

            {showSpecEditor && (
              <div className="space-y-3 border-t border-slate-100 p-3.5">
                <div>
                  <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400">Hero Headline</p>
                  <input className="w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm font-bold text-slate-900 outline-none focus:border-brand" value={spec.heroHeadline} onChange={(e) => setSpecField("heroHeadline", e.target.value)} placeholder="Hero headline…" />
                </div>
                <div>
                  <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400">Subheadline</p>
                  <input className="w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm text-slate-700 outline-none focus:border-brand" value={spec.heroSubheadline} onChange={(e) => setSpecField("heroSubheadline", e.target.value)} placeholder="Subheadline…" />
                </div>
                <div>
                  <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400">Target User</p>
                  <input className="w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs text-slate-700 outline-none focus:border-brand" value={spec.targetUser} onChange={(e) => setSpecField("targetUser", e.target.value)} placeholder="Target user…" />
                </div>
                <div>
                  <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400">Problem Section</p>
                  <textarea className="w-full resize-none rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs text-slate-700 outline-none focus:border-brand" rows={3} value={spec.problemSection} onChange={(e) => setSpecField("problemSection", e.target.value)} placeholder="Problem section copy…" />
                </div>
                <div>
                  <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400">Product Promise</p>
                  <textarea className="w-full resize-none rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs text-slate-700 outline-none focus:border-brand" rows={2} value={spec.productPromise} onChange={(e) => setSpecField("productPromise", e.target.value)} placeholder="Product promise…" />
                </div>
                <div>
                  <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400">MVP Boundary</p>
                  <textarea className="w-full resize-none rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs text-slate-700 outline-none focus:border-brand" rows={2} value={spec.mvpBoundary} onChange={(e) => setSpecField("mvpBoundary", e.target.value)} placeholder="What's in and out of v1…" />
                </div>
                <div>
                  <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400">Primary CTA</p>
                  <input className="w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs text-slate-700 outline-none focus:border-brand" value={spec.primaryCta} onChange={(e) => setSpecField("primaryCta", e.target.value)} placeholder="Button text…" />
                </div>
                <div>
                  <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400">Notes</p>
                  <textarea className="w-full resize-none rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs text-slate-700 outline-none focus:border-brand" rows={2} value={spec.notes} onChange={(e) => setSpecField("notes", e.target.value)} placeholder="Notes…" />
                </div>
                <div>
                  <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                    Status
                  </p>
                  <select className="rounded-lg border border-slate-200 px-2 py-1 text-xs text-slate-700 outline-none" value={spec.status} onChange={(e) => setSpecField("status", e.target.value as TreeStatus)}>
                    {TREE_STATUSES.map((s) => <option key={s} value={s}>{TREE_STATUS_LABELS[s]}{s === "done" ? " — landing page shipped" : ""}</option>)}
                  </select>
                  <span className={`ml-2 rounded-full px-2 py-0.5 text-[10px] font-semibold ${TREE_STATUS_COLORS[spec.status]}`}>
                    {TREE_STATUS_LABELS[spec.status]}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* ── Promises to Build ────────────────────────────────── */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-slate-900">Promises to Build</p>
                <p className="mt-0.5 text-xs text-slate-400">
                  Each promise is what the landing page claims your product can do. Turn each one into a build task.
                </p>
              </div>
              <button
                type="button"
                onClick={addFeature}
                className="shrink-0 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"
              >
                + Add
              </button>
            </div>

            {spec.featureSections.length === 0 ? (
              <p className="rounded-xl border border-dashed border-slate-200 p-3 text-xs text-slate-400">
                No promises detected. Add one manually or regenerate the spec.
              </p>
            ) : (
              <div className="space-y-2.5">
                {spec.featureSections.map((f) => (
                  <PromiseCard
                    key={f.id}
                    feature={f}
                    onCreateTask={onCreateBuildTask}
                  />
                ))}
              </div>
            )}

            {/* Editing promises (for manual tweaks) */}
            {spec.featureSections.length > 0 && (
              <details className="group">
                <summary className="cursor-pointer list-none text-xs text-slate-400 hover:text-slate-600">
                  <span className="group-open:hidden">▶ Edit promises</span>
                  <span className="hidden group-open:inline">▼ Edit promises</span>
                </summary>
                <div className="mt-2 space-y-2">
                  {spec.featureSections.map((f) => (
                    <FeatureCard
                      key={f.id}
                      feature={f}
                      onUpdate={updateFeature}
                      onDelete={() => deleteFeature(f.id)}
                    />
                  ))}
                </div>
              </details>
            )}
          </div>

          {/* Workflow steps (collapsed by default) */}
          {spec.workflowSteps.length > 0 && (
            <details>
              <summary className="cursor-pointer list-none text-xs text-slate-400 hover:text-slate-600">
                ▶ Workflow steps ({spec.workflowSteps.length})
              </summary>
              <div className="mt-2 space-y-1">
                {spec.workflowSteps.map((step, i) => (
                  <div key={i} className="flex gap-1">
                    <span className="mt-1.5 text-xs text-slate-400">{i + 1}.</span>
                    <input
                      className="flex-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs text-slate-700 outline-none focus:border-brand"
                      value={step}
                      onChange={(e) => {
                        const next = [...spec.workflowSteps];
                        next[i] = e.target.value;
                        setSpecField("workflowSteps", next);
                      }}
                    />
                    <button type="button" onClick={() => setSpecField("workflowSteps", spec.workflowSteps.filter((_, j) => j !== i))} className="px-2 text-slate-300 hover:text-red-400">×</button>
                  </div>
                ))}
                <button type="button" onClick={() => setSpecField("workflowSteps", [...spec.workflowSteps, ""])} className="text-xs text-slate-400 hover:text-slate-600">+ Add step</button>
              </div>
            </details>
          )}

          {/* Build landing page */}
          <button
            type="button"
            onClick={handleSendToBuild}
            className="w-full rounded-xl bg-brand py-2.5 text-sm font-semibold text-white"
          >
            → Build Landing Page
          </button>
        </>
      )}
    </div>
  );
}
