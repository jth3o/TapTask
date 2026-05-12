// EXPERIMENTAL — not part of the primary workflow.
// Accessible via the Labs collapsible in the project editor.
// Build Tree decomposition may be revisited in a future iteration.
"use client";

import { useState, useCallback } from "react";
import { IdeaProject, TaskPrefill } from "@/lib/ideaTypes";
import {
  BusinessNode,
  LandingPageSpec,
  LandingPageFeature,
  BuildTree,
  BuildNode,
  BuildNodeType,
  BUILD_NODE_TYPE_LABELS,
  BUILD_NODE_TYPES,
  TREE_STATUS_COLORS,
  TREE_STATUS_LABELS,
  TREE_STATUSES,
  TreeStatus,
} from "@/lib/treeTypes";
import { saveBuildTrees, saveBuildNodes, loadBuildNodes } from "@/lib/ideaStorage";
import { RawBuildNode } from "@/app/api/tree/buildtree/route";

interface Props {
  project: IdeaProject;
  businessNodes: BusinessNode[];
  landingSpec: LandingPageSpec | null;
  trees: BuildTree[];
  allBuildNodes: BuildNode[];
  onTreesChange: (trees: BuildTree[]) => void;
  onBuildNodesChange: (nodes: BuildNode[]) => void;
  onSendToBuild: (prefill: TaskPrefill) => void;
}

type SourceType = "business_node" | "landing_feature" | "custom";

function newBuildNode(buildTreeId: string, parentId: string | null): BuildNode {
  return {
    id: crypto.randomUUID(),
    buildTreeId,
    parentId,
    title: "",
    nodeType: "custom",
    purpose: "",
    status: "not_started",
    notes: "",
    blockers: "",
    acceptanceCriteria: [],
    nonGoals: [],
    verificationPlan: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

function BuildNodeEditPanel({
  node,
  onUpdate,
  onClose,
}: {
  node: BuildNode;
  onUpdate: (n: BuildNode) => void;
  onClose: () => void;
}) {
  const set = <K extends keyof BuildNode>(key: K, val: BuildNode[K]) =>
    onUpdate({ ...node, [key]: val, updatedAt: new Date().toISOString() });

  const acText = node.acceptanceCriteria.join("\n");
  const ngText = node.nonGoals.join("\n");
  const vpText = node.verificationPlan.join("\n");

  return (
    <div className="space-y-2 border-t border-slate-100 bg-slate-50 p-2.5">
      <input
        className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm font-semibold text-slate-900 outline-none focus:border-brand"
        placeholder="Node title…"
        value={node.title}
        onChange={(e) => set("title", e.target.value)}
      />

      <div className="flex gap-2">
        <select
          className="flex-1 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-700 outline-none"
          value={node.nodeType}
          onChange={(e) => set("nodeType", e.target.value as BuildNodeType)}
        >
          {BUILD_NODE_TYPES.map((t) => (
            <option key={t} value={t}>{BUILD_NODE_TYPE_LABELS[t]}</option>
          ))}
        </select>
        <select
          className="flex-1 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-700 outline-none"
          value={node.status}
          onChange={(e) => set("status", e.target.value as TreeStatus)}
        >
          {TREE_STATUSES.map((s) => (
            <option key={s} value={s}>{TREE_STATUS_LABELS[s]}</option>
          ))}
        </select>
      </div>

      <textarea
        className="w-full resize-none rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-700 outline-none focus:border-brand"
        rows={2}
        placeholder="Purpose…"
        value={node.purpose}
        onChange={(e) => set("purpose", e.target.value)}
      />

      <div>
        <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400">Acceptance criteria (one per line)</p>
        <textarea
          className="w-full resize-none rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-700 outline-none focus:border-brand"
          rows={3}
          value={acText}
          onChange={(e) => set("acceptanceCriteria", e.target.value.split("\n").filter(Boolean))}
        />
      </div>

      <div>
        <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400">Non-goals (one per line)</p>
        <textarea
          className="w-full resize-none rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-700 outline-none focus:border-brand"
          rows={2}
          value={ngText}
          onChange={(e) => set("nonGoals", e.target.value.split("\n").filter(Boolean))}
        />
      </div>

      <div>
        <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400">Verification plan (one per line)</p>
        <textarea
          className="w-full resize-none rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-700 outline-none focus:border-brand"
          rows={2}
          value={vpText}
          onChange={(e) => set("verificationPlan", e.target.value.split("\n").filter(Boolean))}
        />
      </div>

      <textarea
        className="w-full resize-none rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-700 outline-none focus:border-brand"
        rows={2}
        placeholder="Notes…"
        value={node.notes}
        onChange={(e) => set("notes", e.target.value)}
      />

      <input
        className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-700 outline-none focus:border-brand"
        placeholder="Blockers…"
        value={node.blockers}
        onChange={(e) => set("blockers", e.target.value)}
      />

      <button type="button" onClick={onClose} className="text-xs text-slate-400 hover:text-slate-600">
        Done editing
      </button>
    </div>
  );
}

function BuildNodeRow({
  node,
  allNodes,
  depth,
  expandedIds,
  editingId,
  onToggleExpand,
  onToggleEdit,
  onUpdate,
  onAddChild,
  onDelete,
  onWorkOn,
}: {
  node: BuildNode;
  allNodes: BuildNode[];
  depth: number;
  expandedIds: Set<string>;
  editingId: string | null;
  onToggleExpand: (id: string) => void;
  onToggleEdit: (id: string) => void;
  onUpdate: (n: BuildNode) => void;
  onAddChild: (parentId: string) => void;
  onDelete: (id: string) => void;
  onWorkOn: (node: BuildNode) => void;
}) {
  const children = allNodes.filter((n) => n.parentId === node.id);
  const isExpanded = expandedIds.has(node.id);
  const isEditing = editingId === node.id;

  return (
    <div className={depth > 0 ? "pl-4" : ""}>
      <div className="mb-1 rounded-xl border border-slate-200 bg-white">
        <div className="flex items-start gap-2 p-2.5">
          {children.length > 0 && (
            <button
              type="button"
              onClick={() => onToggleExpand(node.id)}
              className="mt-0.5 text-slate-400 hover:text-slate-600"
            >
              {isExpanded ? "▾" : "▸"}
            </button>
          )}
          {children.length === 0 && <span className="w-3" />}

          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-slate-900 truncate">{node.title || "Untitled"}</p>
            <div className="mt-1 flex flex-wrap items-center gap-1">
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-500">
                {BUILD_NODE_TYPE_LABELS[node.nodeType]}
              </span>
              <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${TREE_STATUS_COLORS[node.status]}`}>
                {TREE_STATUS_LABELS[node.status]}
              </span>
            </div>
            {node.purpose && !isEditing && (
              <p className="mt-1 text-[11px] text-slate-500 line-clamp-1">{node.purpose}</p>
            )}
          </div>

          <div className="flex shrink-0 flex-col gap-1">
            <button
              type="button"
              onClick={() => onWorkOn(node)}
              className="rounded-lg bg-brand px-2 py-1 text-[10px] font-semibold text-white"
            >
              → Work
            </button>
            <button
              type="button"
              onClick={() => onToggleEdit(node.id)}
              className="rounded-lg border border-slate-200 px-2 py-1 text-[10px] text-slate-500 hover:bg-slate-50"
            >
              {isEditing ? "Close" : "Edit"}
            </button>
            <button
              type="button"
              onClick={() => onAddChild(node.id)}
              className="rounded-lg border border-slate-200 px-2 py-1 text-[10px] text-slate-500 hover:bg-slate-50"
            >
              + Child
            </button>
            <button
              type="button"
              onClick={() => onDelete(node.id)}
              className="rounded-lg px-2 py-1 text-[10px] text-red-400 hover:text-red-600"
            >
              Del
            </button>
          </div>
        </div>

        {isEditing && (
          <BuildNodeEditPanel
            node={node}
            onUpdate={onUpdate}
            onClose={() => onToggleEdit(node.id)}
          />
        )}
      </div>

      {isExpanded && children.length > 0 && (
        <div>
          {children.map((child) => (
            <BuildNodeRow
              key={child.id}
              node={child}
              allNodes={allNodes}
              depth={depth + 1}
              expandedIds={expandedIds}
              editingId={editingId}
              onToggleExpand={onToggleExpand}
              onToggleEdit={onToggleEdit}
              onUpdate={onUpdate}
              onAddChild={onAddChild}
              onDelete={onDelete}
              onWorkOn={onWorkOn}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function BuildTreeCard({
  tree,
  nodes,
  businessNodes,
  landingSpec,
  project,
  onNodesChange,
  onDeleteTree,
  onSendToBuild,
}: {
  tree: BuildTree;
  nodes: BuildNode[];
  businessNodes: BusinessNode[];
  landingSpec: LandingPageSpec | null;
  project: IdeaProject;
  onNodesChange: (nodes: BuildNode[]) => void;
  onDeleteTree: () => void;
  onSendToBuild: (prefill: TaskPrefill) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [editingId, setEditingId] = useState<string | null>(null);

  const linkedBizNode = businessNodes.find((n) => n.id === tree.businessNodeId);
  const linkedFeature = landingSpec?.featureSections.find((f) => f.id === tree.landingPageFeatureId);

  const persistNodes = useCallback(
    (next: BuildNode[]) => {
      onNodesChange(next);
      const all = loadBuildNodes();
      const without = all.filter((n) => n.buildTreeId !== tree.id);
      saveBuildNodes([...without, ...next]);
    },
    [onNodesChange, tree.id]
  );

  const handleUpdateNode = (updated: BuildNode) => {
    persistNodes(nodes.map((n) => (n.id === updated.id ? updated : n)));
  };

  const handleDeleteNode = (id: string) => {
    const toDelete = new Set<string>();
    const queue = [id];
    while (queue.length > 0) {
      const cur = queue.shift()!;
      toDelete.add(cur);
      nodes.filter((n) => n.parentId === cur).forEach((n) => queue.push(n.id));
    }
    persistNodes(nodes.filter((n) => !toDelete.has(n.id)));
  };

  const handleAddChild = (parentId: string) => {
    const n = newBuildNode(tree.id, parentId);
    persistNodes([...nodes, n]);
    setEditingId(n.id);
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

  const handleWorkOn = (node: BuildNode) => {
    const ac = node.acceptanceCriteria.filter(Boolean);
    const ng = node.nonGoals.filter(Boolean);
    const vp = node.verificationPlan.filter(Boolean);

    const rawInput = [
      `[Project: ${project.name}]`,
      project.problem ? `Problem: ${project.problem}` : null,
      project.targetUser ? `Target User: ${project.targetUser}` : null,
      `\nBuild Tree: ${tree.title}`,
      tree.summary ? `Summary: ${tree.summary}` : null,
      linkedBizNode ? `\nBusiness Context: [${linkedBizNode.nodeType}] ${linkedBizNode.title}\nPain: ${linkedBizNode.pain}` : null,
      linkedFeature ? `\nFeature Context: ${linkedFeature.title}\nProblem: ${linkedFeature.userProblem}` : null,
      `\nWork Bucket: ${node.title}`,
      `Type: ${BUILD_NODE_TYPE_LABELS[node.nodeType]}`,
      node.purpose ? `Purpose: ${node.purpose}` : null,
      ac.length > 0 ? `\nAcceptance Criteria:\n${ac.map((c) => `- ${c}`).join("\n")}` : null,
      ng.length > 0 ? `\nNon-Goals:\n${ng.map((g) => `- ${g}`).join("\n")}` : null,
      vp.length > 0 ? `\nVerification Plan:\n${vp.map((v) => `- ${v}`).join("\n")}` : null,
      node.notes ? `\nNotes: ${node.notes}` : null,
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

  const rootNodes = nodes.filter((n) => n.parentId === null);

  return (
    <div className="rounded-2xl border border-slate-200 bg-white">
      <div className="flex items-start gap-2 p-3">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-slate-900">{tree.title}</p>
          {(linkedBizNode || linkedFeature) && (
            <p className="mt-0.5 text-xs text-slate-500">
              {linkedBizNode ? `From: ${linkedBizNode.title}` : linkedFeature ? `Feature: ${linkedFeature.title}` : ""}
            </p>
          )}
          <div className="mt-1 flex items-center gap-1.5">
            <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${TREE_STATUS_COLORS[tree.status]}`}>
              {TREE_STATUS_LABELS[tree.status]}
            </span>
            <span className="text-[10px] text-slate-400">{nodes.length} nodes</span>
          </div>
        </div>
        <div className="flex shrink-0 gap-1">
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs text-slate-500 hover:bg-slate-50"
          >
            {expanded ? "Collapse" : "Expand"}
          </button>
          <button
            type="button"
            onClick={onDeleteTree}
            className="rounded-lg px-2.5 py-1.5 text-xs text-red-400 hover:text-red-600"
          >
            Del
          </button>
        </div>
      </div>

      {expanded && (
        <div className="border-t border-slate-100 p-3">
          {tree.summary && (
            <p className="mb-2 text-xs text-slate-500">{tree.summary}</p>
          )}
          {rootNodes.length === 0 ? (
            <p className="text-xs text-slate-400">No nodes yet.</p>
          ) : (
            rootNodes.map((node) => (
              <BuildNodeRow
                key={node.id}
                node={node}
                allNodes={nodes}
                depth={0}
                expandedIds={expandedIds}
                editingId={editingId}
                onToggleExpand={toggleExpand}
                onToggleEdit={toggleEdit}
                onUpdate={handleUpdateNode}
                onAddChild={handleAddChild}
                onDelete={handleDeleteNode}
                onWorkOn={handleWorkOn}
              />
            ))
          )}
          <button
            type="button"
            onClick={() => handleAddChild(rootNodes[0]?.id ?? "")}
            disabled={rootNodes.length === 0}
            className="mt-2 text-xs text-slate-400 hover:text-slate-600 disabled:opacity-40"
          >
            + Add node
          </button>
        </div>
      )}
    </div>
  );
}

export function BuildTreeSection({
  project,
  businessNodes,
  landingSpec,
  trees,
  allBuildNodes,
  onTreesChange,
  onBuildNodesChange,
  onSendToBuild,
}: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [sourceType, setSourceType] = useState<SourceType>("custom");
  const [selectedBizNodeId, setSelectedBizNodeId] = useState("");
  const [selectedFeatureId, setSelectedFeatureId] = useState("");
  const [customTitle, setCustomTitle] = useState("");

  const persistTrees = useCallback(
    (next: BuildTree[]) => {
      onTreesChange(next);
      saveBuildTrees([
        ...next.filter((t) => t.projectId === project.id),
      ]);
    },
    [onTreesChange, project.id]
  );

  const persistAllNodes = useCallback(
    (treeId: string, nodes: BuildNode[]) => {
      const without = allBuildNodes.filter((n) => n.buildTreeId !== treeId);
      const next = [...without, ...nodes];
      onBuildNodesChange(next);
      saveBuildNodes(next);
    },
    [allBuildNodes, onBuildNodesChange]
  );

  const handleCreate = async () => {
    setLoading(true);
    setError("");
    try {
      const bizNode = sourceType === "business_node"
        ? businessNodes.find((n) => n.id === selectedBizNodeId)
        : undefined;
      const landingFeature = sourceType === "landing_feature" && landingSpec
        ? landingSpec.featureSections.find((f) => f.id === selectedFeatureId)
        : undefined;

      const res = await fetch("/api/tree/buildtree", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          project,
          businessNode: bizNode,
          landingFeature,
          title: sourceType === "custom" ? customTitle : undefined,
        }),
      });
      const data = (await res.json()) as {
        tree?: { title: string; summary: string };
        nodes?: RawBuildNode[];
        error?: string;
      };
      if (data.error) { setError(data.error); return; }
      if (!data.tree || !data.nodes) return;

      const now = new Date().toISOString();
      const treeId = crypto.randomUUID();

      const newTree: BuildTree = {
        id: treeId,
        projectId: project.id,
        businessNodeId: bizNode?.id ?? null,
        landingPageFeatureId: landingFeature?.id ?? null,
        title: data.tree.title,
        summary: data.tree.summary,
        status: "not_started",
        createdAt: now,
        updatedAt: now,
      };

      const idMap = new Map<number, string>();
      const newNodes: BuildNode[] = data.nodes.map((raw, i) => {
        const id = crypto.randomUUID();
        idMap.set(i, id);
        return {
          id,
          buildTreeId: treeId,
          parentId: raw.parentIndex === -1 ? null : (idMap.get(raw.parentIndex) ?? null),
          title: raw.title,
          nodeType: raw.nodeType,
          purpose: raw.purpose,
          status: "not_started",
          notes: "",
          blockers: "",
          acceptanceCriteria: raw.acceptanceCriteria ?? [],
          nonGoals: raw.nonGoals ?? [],
          verificationPlan: raw.verificationPlan ?? [],
          createdAt: now,
          updatedAt: now,
        };
      });

      persistTrees([...trees, newTree]);
      persistAllNodes(treeId, newNodes);
      setShowCreate(false);
      setCustomTitle("");
    } catch {
      setError("Generation failed. Check network connection.");
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteTree = (treeId: string) => {
    persistTrees(trees.filter((t) => t.id !== treeId));
    const without = allBuildNodes.filter((n) => n.buildTreeId !== treeId);
    onBuildNodesChange(without);
    saveBuildNodes(without);
  };

  const landingFeatures = landingSpec?.featureSections ?? [];

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-slate-700">How will we build this part?</p>
        <button
          type="button"
          onClick={() => setShowCreate((v) => !v)}
          className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"
        >
          {showCreate ? "Cancel" : "+ Create Build Tree"}
        </button>
      </div>

      {error && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-700">
          {error}
        </div>
      )}

      {showCreate && (
        <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-3">
          <p className="text-xs font-semibold text-slate-700">Create from:</p>

          <div className="flex gap-2">
            {(["business_node", "landing_feature", "custom"] as SourceType[]).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setSourceType(t)}
                className={`rounded-lg border px-3 py-1.5 text-xs font-medium ${
                  sourceType === t
                    ? "border-brand bg-brand/10 text-brand"
                    : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                }`}
              >
                {t === "business_node" ? "Business Node" : t === "landing_feature" ? "Landing Feature" : "Custom"}
              </button>
            ))}
          </div>

          {sourceType === "business_node" && (
            <select
              className="w-full rounded-lg border border-slate-200 px-2.5 py-2 text-xs text-slate-700 outline-none"
              value={selectedBizNodeId}
              onChange={(e) => setSelectedBizNodeId(e.target.value)}
            >
              <option value="">Select a business node…</option>
              {businessNodes.map((n) => (
                <option key={n.id} value={n.id}>{n.title || "Untitled"}</option>
              ))}
            </select>
          )}

          {sourceType === "landing_feature" && (
            <select
              className="w-full rounded-lg border border-slate-200 px-2.5 py-2 text-xs text-slate-700 outline-none"
              value={selectedFeatureId}
              onChange={(e) => setSelectedFeatureId(e.target.value)}
            >
              <option value="">Select a landing feature…</option>
              {landingFeatures.map((f) => (
                <option key={f.id} value={f.id}>{f.title || "Untitled"}</option>
              ))}
            </select>
          )}

          {sourceType === "custom" && (
            <input
              className="w-full rounded-lg border border-slate-200 px-2.5 py-2 text-xs text-slate-700 outline-none focus:border-brand"
              placeholder="Build tree title…"
              value={customTitle}
              onChange={(e) => setCustomTitle(e.target.value)}
            />
          )}

          <button
            type="button"
            onClick={handleCreate}
            disabled={
              loading ||
              (sourceType === "business_node" && !selectedBizNodeId) ||
              (sourceType === "landing_feature" && !selectedFeatureId)
            }
            className="w-full rounded-xl bg-brand py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            {loading ? "Generating…" : "✦ Generate Build Tree"}
          </button>
        </div>
      )}

      {trees.length === 0 && !showCreate && (
        <p className="rounded-xl border border-dashed border-slate-200 p-3 text-xs text-slate-400">
          No build trees yet. Create one from a business node or landing feature.
        </p>
      )}

      <div className="space-y-3">
        {trees.map((tree) => (
          <BuildTreeCard
            key={tree.id}
            tree={tree}
            nodes={allBuildNodes.filter((n) => n.buildTreeId === tree.id)}
            businessNodes={businessNodes}
            landingSpec={landingSpec}
            project={project}
            onNodesChange={(nodes) => persistAllNodes(tree.id, nodes)}
            onDeleteTree={() => handleDeleteTree(tree.id)}
            onSendToBuild={onSendToBuild}
          />
        ))}
      </div>
    </div>
  );
}
