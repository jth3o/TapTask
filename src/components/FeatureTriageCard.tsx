"use client";

import { useState } from "react";
import { IdeaProject } from "@/lib/ideaTypes";
import {
  FeatureIdea,
  FeatureTriageDecision,
  FeatureIdeaSource,
  ScopeImpact,
  EvaluationImpact,
  FEATURE_TRIAGE_LABELS,
  FEATURE_TRIAGE_COLORS,
  FEATURE_IDEA_SOURCE_LABELS,
  SCOPE_IMPACT_LABELS,
  EVALUATION_IMPACT_LABELS,
} from "@/lib/cycleTypes";
import {
  getFeatureIdeasForProject,
  createFeatureIdea,
  updateFeatureIdea,
} from "@/lib/cycleStorage";

interface Props {
  project: IdeaProject;
  cycleId?: string;
  onIdeasChange?: () => void;
}

const SELECT_CLASS =
  "w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand bg-white";
const TEXTAREA_CLASS =
  "w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand resize-none";
const INPUT_CLASS =
  "w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand";

const DECISION_ORDER: FeatureTriageDecision[] = [
  "build_now",
  "park",
  "evidence_needed",
  "cut",
];

const DECISION_SECTION_COLORS: Record<FeatureTriageDecision, string> = {
  build_now: "border-emerald-200 bg-emerald-50",
  park: "border-slate-200 bg-slate-50",
  evidence_needed: "border-amber-200 bg-amber-50",
  cut: "border-red-100 bg-red-50",
};

const DECISION_HEADING_COLORS: Record<FeatureTriageDecision, string> = {
  build_now: "text-emerald-700",
  park: "text-slate-600",
  evidence_needed: "text-amber-700",
  cut: "text-red-500",
};

const BLANK_FORM = {
  title: "",
  description: "",
  source: "user_idea" as FeatureIdeaSource,
  decision: "park" as FeatureTriageDecision,
  reason: "",
  requiredForSmallestLoop: false,
  basedOnEvidence: false,
  scopeImpact: "keeps_scope" as ScopeImpact,
  evaluationImpact: "neutral" as EvaluationImpact,
  notThisCycleReason: "",
};

function IdeaBadges({ idea }: { idea: FeatureIdea }) {
  return (
    <div className="flex flex-wrap gap-1 mt-1.5">
      {idea.requiredForSmallestLoop && (
        <span className="rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-600">
          required
        </span>
      )}
      {idea.basedOnEvidence && (
        <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-600">
          evidence-based
        </span>
      )}
      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-500">
        {SCOPE_IMPACT_LABELS[idea.scopeImpact]}
      </span>
      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-500">
        {EVALUATION_IMPACT_LABELS[idea.evaluationImpact]}
      </span>
      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-500">
        {FEATURE_IDEA_SOURCE_LABELS[idea.source]}
      </span>
    </div>
  );
}

function IdeaCard({
  idea,
  onDecisionChange,
}: {
  idea: FeatureIdea;
  onDecisionChange: (id: string, decision: FeatureTriageDecision) => void;
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3 space-y-2">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-slate-800 truncate">{idea.title}</p>
          {idea.reason && (
            <p className="mt-0.5 text-xs text-slate-500 line-clamp-2">{idea.reason}</p>
          )}
        </div>
        <span
          className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold ${FEATURE_TRIAGE_COLORS[idea.decision]}`}
        >
          {FEATURE_TRIAGE_LABELS[idea.decision]}
        </span>
      </div>
      {idea.description && (
        <p className="text-xs text-slate-500 line-clamp-2">{idea.description}</p>
      )}
      <IdeaBadges idea={idea} />
      {idea.notThisCycleReason && (
        <p className="text-xs text-slate-400 italic">
          Not this cycle: {idea.notThisCycleReason}
        </p>
      )}
      <div className="pt-1">
        <select
          value={idea.decision}
          onChange={(e) =>
            onDecisionChange(idea.id, e.target.value as FeatureTriageDecision)
          }
          className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs outline-none focus:border-brand"
        >
          {DECISION_ORDER.map((d) => (
            <option key={d} value={d}>
              {FEATURE_TRIAGE_LABELS[d]}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}

export default function FeatureTriageCard({ project, cycleId, onIdeasChange }: Props) {
  const [ideas, setIdeas] = useState<FeatureIdea[]>(() =>
    getFeatureIdeasForProject(project.id)
  );
  const [form, setForm] = useState(BLANK_FORM);
  const [formOpen, setFormOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const refresh = () => setIdeas(getFeatureIdeasForProject(project.id));

  const set = <K extends keyof typeof BLANK_FORM>(k: K, v: (typeof BLANK_FORM)[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const handleSave = () => {
    if (!form.title.trim()) return;
    setSaving(true);
    createFeatureIdea(project.id, {
      title: form.title.trim(),
      description: form.description.trim(),
      source: form.source,
      decision: form.decision,
      reason: form.reason.trim(),
      requiredForSmallestLoop: form.requiredForSmallestLoop,
      basedOnEvidence: form.basedOnEvidence,
      scopeImpact: form.scopeImpact,
      evaluationImpact: form.evaluationImpact,
      cycleId,
      notThisCycleReason: form.notThisCycleReason.trim() || undefined,
    });
    refresh();
    onIdeasChange?.();
    setForm(BLANK_FORM);
    setFormOpen(false);
    setSaving(false);
  };

  const handleDecisionChange = (id: string, decision: FeatureTriageDecision) => {
    updateFeatureIdea(id, { decision });
    refresh();
    onIdeasChange?.();
  };

  const grouped = DECISION_ORDER.reduce(
    (acc, d) => ({ ...acc, [d]: ideas.filter((i) => i.decision === d) }),
    {} as Record<FeatureTriageDecision, FeatureIdea[]>
  );

  const showNotThisCycle =
    form.decision === "park" ||
    form.decision === "evidence_needed" ||
    form.decision === "cut";

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-slate-800">Feature Triage</h3>
          <p className="mt-0.5 text-xs text-slate-400">
            Feature ideas are not build tasks. Triage before sending to Build.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setFormOpen((o) => !o)}
          className="shrink-0 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 active:bg-slate-50"
        >
          {formOpen ? "Cancel" : "+ Idea"}
        </button>
      </div>

      {/* Add form */}
      {formOpen && (
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-3">
          <div className="space-y-1">
            <label className="block text-xs font-semibold text-slate-500">Title</label>
            <input
              type="text"
              value={form.title}
              onChange={(e) => set("title", e.target.value)}
              placeholder="Feature idea title"
              className={INPUT_CLASS}
            />
          </div>
          <div className="space-y-1">
            <label className="block text-xs font-semibold text-slate-500">Description</label>
            <textarea
              rows={2}
              value={form.description}
              onChange={(e) => set("description", e.target.value)}
              placeholder="What is this and why does it matter?"
              className={TEXTAREA_CLASS}
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <label className="block text-xs font-semibold text-slate-500">Source</label>
              <select
                value={form.source}
                onChange={(e) => set("source", e.target.value as FeatureIdeaSource)}
                className={SELECT_CLASS}
              >
                {(Object.keys(FEATURE_IDEA_SOURCE_LABELS) as FeatureIdeaSource[]).map((s) => (
                  <option key={s} value={s}>
                    {FEATURE_IDEA_SOURCE_LABELS[s]}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label className="block text-xs font-semibold text-slate-500">Decision</label>
              <select
                value={form.decision}
                onChange={(e) => set("decision", e.target.value as FeatureTriageDecision)}
                className={SELECT_CLASS}
              >
                {DECISION_ORDER.map((d) => (
                  <option key={d} value={d}>
                    {FEATURE_TRIAGE_LABELS[d]}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="space-y-1">
            <label className="block text-xs font-semibold text-slate-500">Reason</label>
            <textarea
              rows={2}
              value={form.reason}
              onChange={(e) => set("reason", e.target.value)}
              placeholder="Why this decision?"
              className={TEXTAREA_CLASS}
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <label className="block text-xs font-semibold text-slate-500">Scope impact</label>
              <select
                value={form.scopeImpact}
                onChange={(e) => set("scopeImpact", e.target.value as ScopeImpact)}
                className={SELECT_CLASS}
              >
                {(Object.keys(SCOPE_IMPACT_LABELS) as ScopeImpact[]).map((s) => (
                  <option key={s} value={s}>
                    {SCOPE_IMPACT_LABELS[s]}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label className="block text-xs font-semibold text-slate-500">Evaluation impact</label>
              <select
                value={form.evaluationImpact}
                onChange={(e) => set("evaluationImpact", e.target.value as EvaluationImpact)}
                className={SELECT_CLASS}
              >
                {(Object.keys(EVALUATION_IMPACT_LABELS) as EvaluationImpact[]).map((e) => (
                  <option key={e} value={e}>
                    {EVALUATION_IMPACT_LABELS[e]}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex gap-4">
            <label className="flex items-center gap-2 text-xs text-slate-600 cursor-pointer">
              <input
                type="checkbox"
                checked={form.requiredForSmallestLoop}
                onChange={(e) => set("requiredForSmallestLoop", e.target.checked)}
                className="rounded"
              />
              Required for smallest loop?
            </label>
            <label className="flex items-center gap-2 text-xs text-slate-600 cursor-pointer">
              <input
                type="checkbox"
                checked={form.basedOnEvidence}
                onChange={(e) => set("basedOnEvidence", e.target.checked)}
                className="rounded"
              />
              Based on evidence?
            </label>
          </div>
          {showNotThisCycle && (
            <div className="space-y-1">
              <label className="block text-xs font-semibold text-slate-500">
                Not this cycle — reason
              </label>
              <textarea
                rows={1}
                value={form.notThisCycleReason}
                onChange={(e) => set("notThisCycleReason", e.target.value)}
                placeholder="Why not now?"
                className={TEXTAREA_CLASS}
              />
            </div>
          )}
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || !form.title.trim()}
            className="w-full rounded-xl bg-brand py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save idea"}
          </button>
        </div>
      )}

      {/* Grouped lists */}
      {DECISION_ORDER.map((decision) => {
        const group = grouped[decision];
        if (group.length === 0) return null;
        return (
          <div key={decision}>
            <h4
              className={`mb-2 text-xs font-semibold uppercase tracking-wide ${DECISION_HEADING_COLORS[decision]}`}
            >
              {FEATURE_TRIAGE_LABELS[decision]} ({group.length})
            </h4>
            <div className={`rounded-xl border p-3 space-y-2 ${DECISION_SECTION_COLORS[decision]}`}>
              {group.map((idea) => (
                <IdeaCard
                  key={idea.id}
                  idea={idea}
                  onDecisionChange={handleDecisionChange}
                />
              ))}
            </div>
          </div>
        );
      })}

      {ideas.length === 0 && !formOpen && (
        <p className="text-center text-xs text-slate-400 py-2">
          No ideas yet. Add one to triage it.
        </p>
      )}
    </div>
  );
}
