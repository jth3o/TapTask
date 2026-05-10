"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { MobileHeader } from "@/components/MobileHeader";
import {
  MarketRoadmapItem,
  MarketSignal,
  OpportunityMap,
  OpportunityRequest,
  OpportunityResponse,
  RoadmapRequest,
  RoadmapResponse,
  ScanRequest,
  ScanResponse,
  VERDICT_COLORS,
  VERDICT_LABELS,
  Verdict,
} from "@/lib/marketTypes";
import { SavedScan, deleteScan, loadSavedScans, saveScan } from "@/lib/marketStorage";
import { loadIdeaProjects, loadRoadmapItems, saveIdeaProjects, saveOpenProjectId, saveRoadmapItems } from "@/lib/ideaStorage";
import { IdeaProject, RoadmapItem } from "@/lib/ideaTypes";

// ─── Helpers ─────────────────────────────────────────────────────────────────

const ARENA_SUGGESTIONS = [
  "developer tools",
  "creator economy",
  "solo founder workflows",
  "AI productivity",
  "no-code builders",
  "indie SaaS",
  "content monetization",
  "small business web presence",
];

function scoreColor(n: number) {
  if (n >= 70) return "text-emerald-600";
  if (n >= 50) return "text-amber-500";
  return "text-red-500";
}

function ScoreRow({ label, value }: { label: string; value: number }) {
  const bar = Math.max(0, Math.min(100, value));
  const fill = bar >= 70 ? "bg-emerald-500" : bar >= 50 ? "bg-amber-400" : "bg-red-400";
  return (
    <div className="flex items-center gap-2">
      <span className="w-36 shrink-0 text-xs text-slate-500">{label}</span>
      <div className="flex-1 h-1.5 rounded-full bg-slate-100">
        <div className={`h-1.5 rounded-full ${fill}`} style={{ width: `${bar}%` }} />
      </div>
      <span className={`w-8 text-right text-xs font-bold ${scoreColor(value)}`}>{value}</span>
    </div>
  );
}

function ConfidencePill({ level }: { level: "low" | "medium" | "high" }) {
  const styles = {
    low: "bg-red-50 text-red-600",
    medium: "bg-amber-50 text-amber-700",
    high: "bg-emerald-50 text-emerald-700",
  };
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${styles[level]}`}>
      {level} confidence
    </span>
  );
}

function VerdictBadge({ verdict, size = "sm" }: { verdict: Verdict; size?: "sm" | "lg" }) {
  const base = size === "lg" ? "px-3 py-1.5 text-sm font-bold" : "px-2.5 py-1 text-xs font-semibold";
  return (
    <span className={`rounded-full ${base} ${VERDICT_COLORS[verdict]}`}>
      {VERDICT_LABELS[verdict]}
    </span>
  );
}

// ─── Opportunity Section ──────────────────────────────────────────────────────

function OpportunitySection({
  signal,
  scanParams,
  opportunity,
  roadmapItems,
  onMapped,
  onRoadmapGenerated,
  onConverted,
}: {
  signal: MarketSignal;
  scanParams: ScanRequest;
  opportunity: OpportunityMap | null;
  roadmapItems: MarketRoadmapItem[] | null;
  onMapped: (opp: OpportunityMap) => void;
  onRoadmapGenerated: (items: MarketRoadmapItem[]) => void;
  onConverted: (projectId: string) => void;
}) {
  const router = useRouter();
  const [mapping, setMapping] = useState(false);
  const [mapError, setMapError] = useState("");
  const [generatingRoadmap, setGeneratingRoadmap] = useState(false);
  const [roadmapError, setRoadmapError] = useState("");
  const [converting, setConverting] = useState(false);

  const handleMap = async () => {
    setMapping(true);
    setMapError("");
    try {
      const body: OpportunityRequest = {
        signal,
        personalConstraints: scanParams.personalConstraints,
        personalAdvantage: scanParams.personalAdvantage,
        arenaName: scanParams.arenaName,
      };
      const res = await fetch("/api/market/opportunities", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = (await res.json()) as OpportunityResponse;
      if (!res.ok || data.error) throw new Error(data.error ?? "Mapping failed.");
      if (!data.opportunity) throw new Error("No opportunity returned.");
      const opp: OpportunityMap = {
        id: crypto.randomUUID(),
        signalId: signal.id,
        ...data.opportunity,
      };
      onMapped(opp);
    } catch (err) {
      setMapError(err instanceof Error ? err.message : "Mapping failed.");
    } finally {
      setMapping(false);
    }
  };

  const handleGenerateRoadmap = async () => {
    if (!opportunity) return;
    setGeneratingRoadmap(true);
    setRoadmapError("");
    try {
      const body: RoadmapRequest = { signal, opportunity, arenaName: scanParams.arenaName };
      const res = await fetch("/api/market/roadmap", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = (await res.json()) as RoadmapResponse;
      if (!res.ok || data.error) throw new Error(data.error ?? "Roadmap generation failed.");
      if (!data.items) throw new Error("No items returned.");
      onRoadmapGenerated(data.items);
    } catch (err) {
      setRoadmapError(err instanceof Error ? err.message : "Roadmap generation failed.");
    } finally {
      setGeneratingRoadmap(false);
    }
  };

  const handleConvert = () => {
    if (!opportunity) return;
    setConverting(true);

    const project: IdeaProject = {
      id: crypto.randomUUID(),
      name: signal.signalTitle,
      description: signal.summary,
      status: "idea",
      projectType: "web_page",
      problem: signal.painCreated,
      targetUser: signal.affectedUsers.join(", "),
      mvpDefinition: opportunity.smallestMvp,
      assumptions: [
        signal.whyNow,
        ...opportunity.painPoints.slice(0, 3),
      ],
      githubRepoUrl: "",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const existingProjects = loadIdeaProjects();
    saveIdeaProjects([project, ...existingProjects]);

    if (roadmapItems && roadmapItems.length > 0) {
      const existingItems = loadRoadmapItems();
      const newItems: RoadmapItem[] = roadmapItems.map((item) => ({
        id: crypto.randomUUID(),
        projectId: project.id,
        title: item.title,
        description: item.goal,
        taskType: item.taskType,
        acceptanceCriteria: item.acceptanceCriteria,
        nonGoals: item.nonGoals,
        suggestedAgent: item.suggestedAgent,
        status: "pending" as const,
      }));
      saveRoadmapItems([...existingItems, ...newItems]);
    }

    saveOpenProjectId(project.id);
    onConverted(project.id);
    setConverting(false);
    router.push("/ideas");
  };

  if (!opportunity) {
    return (
      <div className="mt-3">
        {mapError && (
          <p className="mb-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{mapError}</p>
        )}
        <button
          type="button"
          onClick={() => void handleMap()}
          disabled={mapping}
          className="w-full min-h-10 rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm font-semibold text-slate-700 disabled:cursor-not-allowed disabled:opacity-50 active:bg-slate-100"
        >
          {mapping ? "Mapping opportunity…" : "✦ Map Opportunity"}
        </button>
      </div>
    );
  }

  return (
    <div className="mt-3 space-y-3 border-t border-slate-100 pt-3">
      {/* Verdict */}
      <div className="flex items-start gap-2">
        <VerdictBadge verdict={opportunity.verdict} size="lg" />
        <p className="text-xs text-slate-600">{opportunity.verdictReason}</p>
      </div>

      {/* Scores */}
      <div className="rounded-xl border border-slate-100 bg-slate-50 p-3 space-y-1.5">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">Scores</span>
          <div className="flex items-center gap-3">
            <span className="text-xs text-slate-500">
              Opportunity: <span className={`font-bold ${scoreColor(opportunity.scores.opportunityScore)}`}>{opportunity.scores.opportunityScore}</span>
            </span>
            <span className="text-xs text-slate-500">
              Build Now: <span className={`font-bold ${scoreColor(opportunity.scores.buildNowScore)}`}>{opportunity.scores.buildNowScore}</span>
            </span>
          </div>
        </div>
        <ScoreRow label="Market Momentum" value={opportunity.scores.marketMomentum} />
        <ScoreRow label="Pain Intensity" value={opportunity.scores.painIntensity} />
        <ScoreRow label="User Accessibility" value={opportunity.scores.userAccessibility} />
        <ScoreRow label="MVP Simplicity" value={opportunity.scores.mvpSimplicity} />
        <ScoreRow label="Personal Advantage" value={opportunity.scores.personalAdvantage} />
        <ScoreRow label="Distribution Path" value={opportunity.scores.distributionPath} />
        <ScoreRow label="Expansion Potential" value={opportunity.scores.expansionPotential} />
      </div>

      {/* Smallest MVP */}
      <div className="rounded-xl bg-blue-50 p-3">
        <p className="mb-1 text-xs font-semibold text-blue-700">Smallest MVP</p>
        <p className="text-xs text-blue-800">{opportunity.smallestMvp}</p>
      </div>

      {/* Feasibility */}
      <div className="rounded-xl bg-slate-50 p-3">
        <p className="mb-1 text-xs font-semibold text-slate-500">TapTask Feasibility</p>
        <p className="text-xs text-slate-700">{opportunity.taptaskFeasibilityNotes}</p>
      </div>

      {/* User workflow + pain */}
      <details className="group">
        <summary className="cursor-pointer text-xs font-semibold text-slate-600 hover:text-slate-800">
          User workflow & pain points ▸
        </summary>
        <div className="mt-2 space-y-2">
          <p className="text-xs text-slate-600">{opportunity.userWorkflow}</p>
          <ul className="space-y-1">
            {opportunity.painPoints.map((p, i) => (
              <li key={i} className="flex gap-1.5 text-xs text-slate-600">
                <span className="shrink-0 text-red-400">•</span>{p}
              </li>
            ))}
          </ul>
        </div>
      </details>

      {/* Product angles */}
      <details className="group">
        <summary className="cursor-pointer text-xs font-semibold text-slate-600 hover:text-slate-800">
          Product angles ({opportunity.productAngles.length}) ▸
        </summary>
        <ul className="mt-2 space-y-1">
          {opportunity.productAngles.map((a, i) => (
            <li key={i} className="flex gap-1.5 text-xs text-slate-600">
              <span className="shrink-0 font-bold text-brand">{i + 1}.</span>{a}
            </li>
          ))}
        </ul>
      </details>

      {/* What NOT to build */}
      {opportunity.whatNotToBuild.length > 0 && (
        <div className="rounded-xl border border-amber-100 bg-amber-50 p-3">
          <p className="mb-1 text-xs font-semibold text-amber-700">Do NOT build in v1</p>
          <ul className="space-y-0.5">
            {opportunity.whatNotToBuild.map((w, i) => (
              <li key={i} className="text-xs text-amber-800">— {w}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Validation */}
      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-xl bg-slate-50 p-3">
          <p className="mb-1 text-xs font-semibold text-slate-500">First user test</p>
          <p className="text-xs text-slate-700">{opportunity.firstUserTest}</p>
        </div>
        <div className="rounded-xl bg-slate-50 p-3">
          <p className="mb-1 text-xs font-semibold text-slate-500">Distribution test</p>
          <p className="text-xs text-slate-700">{opportunity.distributionTest}</p>
        </div>
      </div>

      {/* Roadmap section */}
      {roadmapItems ? (
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
            TapTask Roadmap ({roadmapItems.length} items)
          </p>
          {roadmapItems.map((item, i) => (
            <div key={i} className="rounded-xl border border-slate-200 bg-white p-3">
              <div className="flex items-center gap-2">
                <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-500">
                  {i + 1}
                </span>
                <span className="text-sm font-semibold text-slate-800">{item.title}</span>
                <span className="ml-auto shrink-0 rounded-full bg-blue-50 px-2 py-0.5 text-xs font-semibold text-blue-600">
                  {item.suggestedAgent}
                </span>
              </div>
              <p className="mt-1.5 text-xs text-slate-600">{item.goal}</p>
              {item.acceptanceCriteria.length > 0 && (
                <ul className="mt-1.5 space-y-0.5">
                  {item.acceptanceCriteria.map((c, j) => (
                    <li key={j} className="flex gap-1.5 text-xs text-slate-500">
                      <span className="shrink-0 text-emerald-500">✓</span>{c}
                    </li>
                  ))}
                </ul>
              )}
              <p className="mt-1.5 text-xs text-slate-400">Verify: {item.verificationPlan}</p>
            </div>
          ))}
        </div>
      ) : (
        <div>
          {roadmapError && (
            <p className="mb-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{roadmapError}</p>
          )}
          <button
            type="button"
            onClick={() => void handleGenerateRoadmap()}
            disabled={generatingRoadmap}
            className="w-full min-h-10 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 disabled:cursor-not-allowed disabled:opacity-50 active:bg-slate-50"
          >
            {generatingRoadmap ? "Generating roadmap…" : "✦ Generate TapTask Roadmap"}
          </button>
        </div>
      )}

      {/* Convert to project */}
      <button
        type="button"
        onClick={handleConvert}
        disabled={converting}
        className="w-full min-h-11 rounded-xl bg-brand px-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50 active:opacity-90"
      >
        {converting ? "Creating project…" : "→ Convert to Project"}
      </button>
    </div>
  );
}

// ─── Signal Card ──────────────────────────────────────────────────────────────

function SignalCard({
  signal,
  rank,
  scanParams,
  opportunity,
  roadmapItems,
  onMapped,
  onRoadmapGenerated,
  onConverted,
}: {
  signal: MarketSignal;
  rank: number;
  scanParams: ScanRequest;
  opportunity: OpportunityMap | null;
  roadmapItems: MarketRoadmapItem[] | null;
  onMapped: (opp: OpportunityMap) => void;
  onRoadmapGenerated: (items: MarketRoadmapItem[]) => void;
  onConverted: (projectId: string) => void;
}) {
  const [expanded, setExpanded] = useState(rank === 0);

  return (
    <article className={`rounded-2xl border bg-white shadow-sm ${
      opportunity?.verdict === "build_now"
        ? "border-emerald-200"
        : opportunity?.verdict === "skip"
        ? "border-slate-100"
        : "border-slate-200"
    }`}>
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="w-full p-4 text-left"
      >
        <div className="flex items-start gap-3">
          <span className="mt-0.5 shrink-0 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-500">
            #{rank + 1}
          </span>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-slate-900 leading-snug">{signal.signalTitle}</p>
            <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
              <ConfidencePill level={signal.confidenceLevel} />
              {opportunity && <VerdictBadge verdict={opportunity.verdict} />}
              {opportunity && (
                <span className="text-xs text-slate-400">
                  Score: <span className={`font-bold ${scoreColor(opportunity.scores.buildNowScore)}`}>{opportunity.scores.buildNowScore}</span>
                </span>
              )}
            </div>
          </div>
          <span className="shrink-0 text-slate-400 text-sm">{expanded ? "▲" : "▼"}</span>
        </div>
      </button>

      {expanded && (
        <div className="border-t border-slate-100 px-4 pb-4 space-y-3">
          <p className="text-sm text-slate-700 pt-3">{signal.summary}</p>

          <div className="grid grid-cols-1 gap-2">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-1">What changed</p>
              <p className="text-xs text-slate-700">{signal.whatChanged}</p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-1">Pain created</p>
              <p className="text-xs text-slate-700">{signal.painCreated}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-1">Affected users</p>
              <ul className="space-y-0.5">
                {signal.affectedUsers.map((u, i) => (
                  <li key={i} className="text-xs text-slate-600">• {u}</li>
                ))}
              </ul>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-1">Current workarounds</p>
              <ul className="space-y-0.5">
                {signal.currentWorkarounds.map((w, i) => (
                  <li key={i} className="text-xs text-slate-600">• {w}</li>
                ))}
              </ul>
            </div>
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-1">Opportunity</p>
            <p className="text-xs text-slate-700">{signal.opportunitySpace}</p>
          </div>

          <div className="rounded-xl bg-emerald-50 p-3">
            <p className="text-xs font-semibold text-emerald-700 mb-1">Why now</p>
            <p className="text-xs text-emerald-800">{signal.whyNow}</p>
          </div>

          {signal.sourceLinks.length > 0 && (
            <div className="rounded-xl bg-slate-50 p-3">
              <p className="text-xs font-semibold text-slate-400 mb-1.5">Sources (AI-sourced — verify before acting)</p>
              <ul className="space-y-1">
                {signal.sourceLinks.map((link, i) => (
                  <li key={i} className="flex items-start gap-1.5 text-xs">
                    <span className="shrink-0 text-slate-400">{signal.sourceDates[i] ?? ""}</span>
                    {link.startsWith("http") ? (
                      <a
                        href={link}
                        target="_blank"
                        rel="noreferrer"
                        className="text-brand underline break-all"
                      >
                        {link}
                      </a>
                    ) : (
                      <span className="text-slate-600">{link}</span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <OpportunitySection
            signal={signal}
            scanParams={scanParams}
            opportunity={opportunity}
            roadmapItems={roadmapItems}
            onMapped={onMapped}
            onRoadmapGenerated={onRoadmapGenerated}
            onConverted={onConverted}
          />
        </div>
      )}
    </article>
  );
}

// ─── Scan Form ────────────────────────────────────────────────────────────────

function ScanForm({
  onScanComplete,
  defaultArena,
}: {
  onScanComplete: (signals: MarketSignal[], params: ScanRequest) => void;
  defaultArena?: string;
}) {
  const [arenaName, setArenaName] = useState(defaultArena ?? "");
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState("");

  const canScan = arenaName.trim().length > 0 && !scanning;

  const handleScan = async () => {
    setScanning(true);
    setError("");
    const params: ScanRequest = {
      arenaName,
      targetUserRole: "",
      timeframe: "this_month",
      sourceFocus: "tech_news",
      personalConstraints: "",
      personalAdvantage: "",
    };
    try {
      const res = await fetch("/api/market/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(params),
      });
      const data = (await res.json()) as ScanResponse;
      if (!res.ok || data.error) throw new Error(data.error ?? "Scan failed.");
      if (!data.signals?.length) throw new Error("No signals returned.");
      const signals: MarketSignal[] = data.signals.map((s) => ({ ...s, id: crypto.randomUUID() }));
      onScanComplete(signals, params);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Scan failed.");
    } finally {
      setScanning(false);
    }
  };

  return (
    <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div>
        <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400">What space are you watching?</p>
        <input
          type="text"
          value={arenaName}
          onChange={(e) => setArenaName(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && canScan) void handleScan(); }}
          placeholder="e.g. AI-assisted builders, creator analytics…"
          className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-blue-100"
          autoFocus
        />
        <div className="mt-2 flex flex-wrap gap-1.5">
          {ARENA_SUGGESTIONS.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setArenaName(s)}
              className={`rounded-full border px-2.5 py-1 text-xs font-medium transition-colors ${
                arenaName === s
                  ? "border-brand bg-blue-50 text-brand"
                  : "border-slate-200 text-slate-600 hover:border-slate-300"
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>
      )}

      <button
        type="button"
        onClick={() => void handleScan()}
        disabled={!canScan}
        className="w-full min-h-12 rounded-xl bg-brand px-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40 active:opacity-90"
      >
        {scanning ? (
          <span className="flex items-center justify-center gap-2">
            <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
            Scanning…
          </span>
        ) : (
          "Scan Market"
        )}
      </button>

      {scanning && (
        <p className="text-center text-xs text-slate-400">Finding what's moving and where people are complaining…</p>
      )}
    </div>
  );
}

// ─── Scan Results ─────────────────────────────────────────────────────────────

function ScanResults({
  signals,
  scanParams,
  opportunities,
  roadmaps,
  onMapped,
  onRoadmapGenerated,
  onConverted,
  onRescan,
}: {
  signals: MarketSignal[];
  scanParams: ScanRequest;
  opportunities: Record<string, OpportunityMap>;
  roadmaps: Record<string, MarketRoadmapItem[]>;
  onMapped: (signalId: string, opp: OpportunityMap) => void;
  onRoadmapGenerated: (signalId: string, items: MarketRoadmapItem[]) => void;
  onConverted: (projectId: string) => void;
  onRescan: () => void;
}) {
  const sorted = [...signals].sort((a, b) => {
    const aScore = opportunities[a.id]?.scores.buildNowScore ?? -1;
    const bScore = opportunities[b.id]?.scores.buildNowScore ?? -1;
    return bScore - aScore;
  });

  const mappedCount = Object.keys(opportunities).length;
  const buildNowCount = Object.values(opportunities).filter((o) => o.verdict === "build_now").length;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-bold text-slate-900">
            {signals.length} signals · {scanParams.arenaName}
          </p>
          <p className="text-xs text-slate-500">
            {mappedCount > 0
              ? `${mappedCount} mapped · ${buildNowCount} build-now`
              : "Tap a signal to map its opportunity"}
          </p>
        </div>
        <button
          type="button"
          onClick={onRescan}
          className="rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"
        >
          New scan
        </button>
      </div>

      <div className="rounded-xl border border-amber-100 bg-amber-50 px-3 py-2">
        <p className="text-xs text-amber-700">
          Signals are AI-generated based on training data (cutoff Aug 2025). Source links are citations — verify before acting.
        </p>
      </div>

      {sorted.map((signal, i) => (
        <SignalCard
          key={signal.id}
          signal={signal}
          rank={i}
          scanParams={scanParams}
          opportunity={opportunities[signal.id] ?? null}
          roadmapItems={roadmaps[signal.id] ?? null}
          onMapped={(opp) => onMapped(signal.id, opp)}
          onRoadmapGenerated={(items) => onRoadmapGenerated(signal.id, items)}
          onConverted={onConverted}
        />
      ))}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function MarketPage() {
  const [view, setView] = useState<"form" | "results">("form");
  const [signals, setSignals] = useState<MarketSignal[]>([]);
  const [scanParams, setScanParams] = useState<ScanRequest | null>(null);
  const [opportunities, setOpportunities] = useState<Record<string, OpportunityMap>>({});
  const [roadmaps, setRoadmaps] = useState<Record<string, MarketRoadmapItem[]>>({});
  const [savedScans, setSavedScans] = useState<SavedScan[]>([]);
  const [activeScanId, setActiveScanId] = useState<string | null>(null);

  useEffect(() => {
    setSavedScans(loadSavedScans());
  }, []);

  const persistScan = (
    id: string,
    params: ScanRequest,
    sigs: MarketSignal[],
    opps: Record<string, OpportunityMap>,
    roads: Record<string, MarketRoadmapItem[]>
  ) => {
    const scan: SavedScan = {
      id,
      params,
      signals: sigs,
      opportunities: opps,
      roadmaps: roads,
      createdAt: new Date().toISOString(),
    };
    saveScan(scan);
    setSavedScans(loadSavedScans());
  };

  const handleScanComplete = (sigs: MarketSignal[], params: ScanRequest) => {
    const id = crypto.randomUUID();
    setActiveScanId(id);
    setSignals(sigs);
    setScanParams(params);
    setOpportunities({});
    setRoadmaps({});
    setView("results");
    persistScan(id, params, sigs, {}, {});
  };

  const handleMapped = (signalId: string, opp: OpportunityMap) => {
    const next = { ...opportunities, [signalId]: opp };
    setOpportunities(next);
    if (activeScanId && scanParams) {
      persistScan(activeScanId, scanParams, signals, next, roadmaps);
    }
  };

  const handleRoadmapGenerated = (signalId: string, items: MarketRoadmapItem[]) => {
    const next = { ...roadmaps, [signalId]: items };
    setRoadmaps(next);
    if (activeScanId && scanParams) {
      persistScan(activeScanId, scanParams, signals, opportunities, next);
    }
  };

  const handleConverted = (_projectId: string) => {
    // navigation handled in OpportunitySection
  };

  const loadScan = (scan: SavedScan) => {
    setActiveScanId(scan.id);
    setSignals(scan.signals);
    setScanParams(scan.params);
    setOpportunities(scan.opportunities);
    setRoadmaps(scan.roadmaps);
    setView("results");
  };

  const handleDeleteScan = (id: string) => {
    deleteScan(id);
    setSavedScans(loadSavedScans());
    if (activeScanId === id) {
      setView("form");
      setSignals([]);
      setScanParams(null);
      setActiveScanId(null);
    }
  };

  return (
    <main className="mx-auto min-h-screen max-w-xl space-y-4 pb-24">
      <MobileHeader />

      <section className="space-y-1 px-4 pt-1">
        <h2 className="text-base font-bold text-slate-900">Market Scanner</h2>
        <p className="text-xs text-slate-500">
          Find what&apos;s moving and where people need better web tools.
        </p>
      </section>

      {view === "form" ? (
        <section className="px-4 space-y-4">
          <ScanForm
            onScanComplete={handleScanComplete}
            defaultArena={scanParams?.arenaName}
          />

          {savedScans.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Recent scans</p>
              {savedScans.map((scan) => (
                <div
                  key={scan.id}
                  className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2.5"
                >
                  <button
                    type="button"
                    onClick={() => loadScan(scan)}
                    className="flex-1 text-left"
                  >
                    <p className="text-sm font-semibold text-slate-800">{scan.params.arenaName}</p>
                    <p className="text-xs text-slate-400">
                      {scan.signals.length} signals · {Object.keys(scan.opportunities).length} mapped ·{" "}
                      {new Date(scan.createdAt).toLocaleDateString()}
                    </p>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeleteScan(scan.id)}
                    className="shrink-0 text-xs text-slate-400 hover:text-red-500"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>
      ) : (
        <section className="px-4">
          {scanParams && (
            <ScanResults
              signals={signals}
              scanParams={scanParams}
              opportunities={opportunities}
              roadmaps={roadmaps}
              onMapped={handleMapped}
              onRoadmapGenerated={handleRoadmapGenerated}
              onConverted={handleConverted}
              onRescan={() => setView("form")}
            />
          )}
        </section>
      )}
    </main>
  );
}
