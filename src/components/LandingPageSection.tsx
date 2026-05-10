"use client";

import { useState, useCallback } from "react";
import { IdeaProject, TaskPrefill } from "@/lib/ideaTypes";
import {
  BusinessNode,
  LandingPageSpec,
  LandingPageFeature,
  TREE_STATUS_COLORS,
  TREE_STATUS_LABELS,
  TREE_STATUSES,
  TreeStatus,
} from "@/lib/treeTypes";
import { saveLandingPageSpecs, loadLandingPageSpecs } from "@/lib/ideaStorage";
import { RawLandingPageSpec } from "@/app/api/tree/landing/route";

interface Props {
  project: IdeaProject;
  businessNodes: BusinessNode[];
  spec: LandingPageSpec | null;
  onSpecChange: (spec: LandingPageSpec | null) => void;
  onSendToBuild: (prefill: TaskPrefill) => void;
}

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

export function LandingPageSection({
  project,
  businessNodes,
  spec,
  onSpecChange,
  onSendToBuild,
}: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

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
      const selected = businessNodes.filter((n) => n.status === "selected");
      const toSend = selected.length > 0 ? selected : businessNodes;

      const res = await fetch("/api/tree/landing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ project, selectedNodes: toSend }),
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
    setSpecField(
      "featureSections",
      spec.featureSections.map((f) => (f.id === updated.id ? updated : f))
    );
  };

  const deleteFeature = (id: string) => {
    if (!spec) return;
    setSpecField("featureSections", spec.featureSections.filter((f) => f.id !== id));
  };

  const addFeature = () => {
    if (!spec) return;
    const f = newFeature(spec.id);
    setSpecField("featureSections", [...spec.featureSections, f]);
  };

  const handleSendToBuild = () => {
    if (!spec) return;

    const selectedNodes = businessNodes.filter((n) => n.status === "selected");
    const nodesCtx = selectedNodes.length > 0
      ? `\nKey problems addressed:\n${selectedNodes.map((n) => `- ${n.title}: ${n.pain}`).join("\n")}`
      : "";

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
      nodesCtx,
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

    onSendToBuild({
      taskType: "new_feature",
      rawInput,
      agentSuggestion: "cursor",
      repoFullName,
    });
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-slate-700">What are we promising?</p>
        <button
          type="button"
          onClick={handleGenerate}
          disabled={loading || businessNodes.length === 0}
          className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-600 hover:border-slate-300 hover:bg-slate-50 disabled:opacity-50"
          title={businessNodes.length === 0 ? "Add business nodes first" : undefined}
        >
          {loading ? "…" : "✦ Generate Spec"}
        </button>
      </div>

      {error && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-700">
          {error}
        </div>
      )}

      {businessNodes.length === 0 && (
        <p className="rounded-xl border border-dashed border-slate-200 p-3 text-xs text-slate-400">
          Add business tree nodes first to generate a landing page spec.
        </p>
      )}

      {!spec && businessNodes.length > 0 && (
        <p className="rounded-xl border border-dashed border-slate-200 p-3 text-xs text-slate-400">
          No landing page spec yet. Generate one from your business nodes.
        </p>
      )}

      {spec && (
        <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Status</p>
            <select
              className="rounded-lg border border-slate-200 px-2 py-1 text-xs text-slate-700 outline-none"
              value={spec.status}
              onChange={(e) => setSpecField("status", e.target.value as TreeStatus)}
            >
              {TREE_STATUSES.map((s) => (
                <option key={s} value={s}>{TREE_STATUS_LABELS[s]}</option>
              ))}
            </select>
            <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${TREE_STATUS_COLORS[spec.status]}`}>
              {TREE_STATUS_LABELS[spec.status]}
            </span>
          </div>

          <div>
            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">Hero Headline</p>
            <input
              className="w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm font-bold text-slate-900 outline-none focus:border-brand"
              value={spec.heroHeadline}
              onChange={(e) => setSpecField("heroHeadline", e.target.value)}
              placeholder="Hero headline…"
            />
          </div>

          <div>
            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">Subheadline</p>
            <input
              className="w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm text-slate-700 outline-none focus:border-brand"
              value={spec.heroSubheadline}
              onChange={(e) => setSpecField("heroSubheadline", e.target.value)}
              placeholder="Subheadline…"
            />
          </div>

          <div>
            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">Target User</p>
            <input
              className="w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs text-slate-700 outline-none focus:border-brand"
              value={spec.targetUser}
              onChange={(e) => setSpecField("targetUser", e.target.value)}
              placeholder="Target user…"
            />
          </div>

          <div>
            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">Problem Section</p>
            <textarea
              className="w-full resize-none rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs text-slate-700 outline-none focus:border-brand"
              rows={3}
              value={spec.problemSection}
              onChange={(e) => setSpecField("problemSection", e.target.value)}
              placeholder="Problem section copy…"
            />
          </div>

          <div>
            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">Product Promise</p>
            <textarea
              className="w-full resize-none rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs text-slate-700 outline-none focus:border-brand"
              rows={2}
              value={spec.productPromise}
              onChange={(e) => setSpecField("productPromise", e.target.value)}
              placeholder="Product promise…"
            />
          </div>

          {/* Feature sections */}
          <div>
            <div className="mb-2 flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                Features ({spec.featureSections.length})
              </p>
              <button
                type="button"
                onClick={addFeature}
                className="text-xs text-slate-400 hover:text-slate-600"
              >
                + Add
              </button>
            </div>
            <div className="space-y-2">
              {spec.featureSections.map((f) => (
                <FeatureCard
                  key={f.id}
                  feature={f}
                  onUpdate={updateFeature}
                  onDelete={() => deleteFeature(f.id)}
                />
              ))}
            </div>
          </div>

          {/* Workflow steps */}
          <div>
            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">Workflow Steps</p>
            {spec.workflowSteps.map((step, i) => (
              <div key={i} className="mb-1 flex gap-1">
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
                <button
                  type="button"
                  onClick={() => setSpecField("workflowSteps", spec.workflowSteps.filter((_, j) => j !== i))}
                  className="px-2 text-slate-300 hover:text-red-400"
                >
                  ×
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={() => setSpecField("workflowSteps", [...spec.workflowSteps, ""])}
              className="text-xs text-slate-400 hover:text-slate-600"
            >
              + Add step
            </button>
          </div>

          <div>
            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">MVP Boundary</p>
            <textarea
              className="w-full resize-none rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs text-slate-700 outline-none focus:border-brand"
              rows={2}
              value={spec.mvpBoundary}
              onChange={(e) => setSpecField("mvpBoundary", e.target.value)}
              placeholder="What's in and out of v1…"
            />
          </div>

          <div>
            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">Primary CTA</p>
            <input
              className="w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs text-slate-700 outline-none focus:border-brand"
              value={spec.primaryCta}
              onChange={(e) => setSpecField("primaryCta", e.target.value)}
              placeholder="Button text…"
            />
          </div>

          <div>
            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">Notes</p>
            <textarea
              className="w-full resize-none rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs text-slate-700 outline-none focus:border-brand"
              rows={2}
              value={spec.notes}
              onChange={(e) => setSpecField("notes", e.target.value)}
              placeholder="Notes…"
            />
          </div>

          <button
            type="button"
            onClick={handleSendToBuild}
            className="w-full rounded-xl bg-brand py-2.5 text-sm font-semibold text-white"
          >
            → Build Landing Page
          </button>
        </div>
      )}
    </div>
  );
}

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
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="text-xs text-slate-400 hover:text-slate-600"
        >
          {expanded ? "▲" : "▼"}
        </button>
        <button
          type="button"
          onClick={onDelete}
          className="text-xs text-red-400 hover:text-red-600"
        >
          ×
        </button>
      </div>

      {expanded && (
        <div className="space-y-2 border-t border-slate-200 p-2.5">
          <input
            className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-700 outline-none focus:border-brand"
            placeholder="User problem this solves…"
            value={feature.userProblem}
            onChange={(e) => set("userProblem", e.target.value)}
          />
          <input
            className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-700 outline-none focus:border-brand"
            placeholder="What it does…"
            value={feature.whatItDoes}
            onChange={(e) => set("whatItDoes", e.target.value)}
          />
          <input
            className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-700 outline-none focus:border-brand"
            placeholder="Why it matters…"
            value={feature.whyItMatters}
            onChange={(e) => set("whyItMatters", e.target.value)}
          />
          <input
            className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-700 outline-none focus:border-brand"
            placeholder="Success definition…"
            value={feature.successDefinition}
            onChange={(e) => set("successDefinition", e.target.value)}
          />
          <select
            className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700 outline-none"
            value={feature.status}
            onChange={(e) => set("status", e.target.value as TreeStatus)}
          >
            {TREE_STATUSES.map((s) => (
              <option key={s} value={s}>{TREE_STATUS_LABELS[s]}</option>
            ))}
          </select>
          <textarea
            className="w-full resize-none rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-700 outline-none focus:border-brand"
            rows={2}
            placeholder="Notes…"
            value={feature.notes}
            onChange={(e) => set("notes", e.target.value)}
          />
        </div>
      )}
    </div>
  );
}
