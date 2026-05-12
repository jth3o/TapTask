// EXPERIMENTAL — not part of the primary workflow.
// Accessible via the Labs collapsible in the project editor.
// Business Tree planning may be revisited in a future iteration.
"use client";

import { useState, useCallback } from "react";
import { IdeaProject, TaskPrefill } from "@/lib/ideaTypes";
import {
  BusinessNode,
  BusinessNodeType,
  BUSINESS_NODE_TYPE_LABELS,
  BUSINESS_NODE_TYPES,
  TREE_STATUS_COLORS,
  TREE_STATUS_LABELS,
  TREE_STATUSES,
  TreeStatus,
} from "@/lib/treeTypes";
import { saveBusinessNodes } from "@/lib/ideaStorage";
import { RawBusinessNode } from "@/app/api/tree/business/route";

interface Props {
  project: IdeaProject;
  nodes: BusinessNode[];
  onNodesChange: (nodes: BusinessNode[]) => void;
  onSendToBuild?: (prefill: TaskPrefill) => void;
}

function newNode(projectId: string, parentId: string | null): BusinessNode {
  return {
    id: crypto.randomUUID(),
    projectId,
    parentId,
    title: "",
    nodeType: "custom",
    summary: "",
    affectedUser: "",
    pain: "",
    currentWorkaround: "",
    successDefinition: "",
    status: "not_started",
    notes: "",
    blockers: "",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

function NodeEditPanel({
  node,
  onUpdate,
  onClose,
}: {
  node: BusinessNode;
  onUpdate: (n: BusinessNode) => void;
  onClose: () => void;
}) {
  const set = <K extends keyof BusinessNode>(key: K, val: BusinessNode[K]) =>
    onUpdate({ ...node, [key]: val, updatedAt: new Date().toISOString() });

  return (
    <div className="space-y-2 border-t border-slate-100 bg-slate-50 p-3">
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
          onChange={(e) => set("nodeType", e.target.value as BusinessNodeType)}
        >
          {BUSINESS_NODE_TYPES.map((t) => (
            <option key={t} value={t}>{BUSINESS_NODE_TYPE_LABELS[t]}</option>
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
        placeholder="Summary…"
        value={node.summary}
        onChange={(e) => set("summary", e.target.value)}
      />

      <input
        className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-700 outline-none focus:border-brand"
        placeholder="Affected user…"
        value={node.affectedUser}
        onChange={(e) => set("affectedUser", e.target.value)}
      />

      <input
        className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-700 outline-none focus:border-brand"
        placeholder="Specific pain…"
        value={node.pain}
        onChange={(e) => set("pain", e.target.value)}
      />

      <input
        className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-700 outline-none focus:border-brand"
        placeholder="Current workaround…"
        value={node.currentWorkaround}
        onChange={(e) => set("currentWorkaround", e.target.value)}
      />

      <input
        className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-700 outline-none focus:border-brand"
        placeholder="Success definition…"
        value={node.successDefinition}
        onChange={(e) => set("successDefinition", e.target.value)}
      />

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

      <button
        type="button"
        onClick={onClose}
        className="text-xs text-slate-400 hover:text-slate-600"
      >
        Done editing
      </button>
    </div>
  );
}

function NodeRow({
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
}: {
  node: BusinessNode;
  allNodes: BusinessNode[];
  depth: number;
  expandedIds: Set<string>;
  editingId: string | null;
  onToggleExpand: (id: string) => void;
  onToggleEdit: (id: string) => void;
  onUpdate: (n: BusinessNode) => void;
  onAddChild: (parentId: string) => void;
  onDelete: (id: string) => void;
}) {
  const children = allNodes.filter((n) => n.parentId === node.id);
  const isExpanded = expandedIds.has(node.id);
  const isEditing = editingId === node.id;
  const isSelected = node.status === "selected";

  return (
    <div className={depth > 0 ? "pl-4" : ""}>
      <div
        className={`rounded-xl border ${isSelected ? "border-brand/30 bg-brand/5" : "border-slate-200 bg-white"} mb-1`}
      >
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
            <p className="text-sm font-semibold text-slate-900 truncate">
              {node.title || "Untitled"}
            </p>
            <div className="mt-1 flex flex-wrap items-center gap-1">
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-500">
                {BUSINESS_NODE_TYPE_LABELS[node.nodeType]}
              </span>
              <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${TREE_STATUS_COLORS[node.status]}`}>
                {TREE_STATUS_LABELS[node.status]}
              </span>
            </div>
            {node.summary && !isEditing && (
              <p className="mt-1 text-xs text-slate-500 line-clamp-2">{node.summary}</p>
            )}
          </div>

          <div className="flex shrink-0 flex-col gap-1">
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
          <NodeEditPanel
            node={node}
            onUpdate={onUpdate}
            onClose={() => onToggleEdit(node.id)}
          />
        )}
      </div>

      {isExpanded && children.length > 0 && (
        <div>
          {children.map((child) => (
            <NodeRow
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
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function BusinessTreeSection({ project, nodes, onNodesChange, onSendToBuild }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [editingId, setEditingId] = useState<string | null>(null);

  const persist = useCallback(
    (next: BusinessNode[]) => {
      onNodesChange(next);
      saveBusinessNodes([
        ...next.filter((n) => n.projectId === project.id),
      ]);
    },
    [onNodesChange, project.id]
  );

  const handleGenerate = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/tree/business", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ project }),
      });
      const data = (await res.json()) as { nodes?: RawBusinessNode[]; error?: string };
      if (data.error) { setError(data.error); return; }
      if (!data.nodes) return;

      const now = new Date().toISOString();
      const idMap = new Map<number, string>();
      const newNodes: BusinessNode[] = data.nodes.map((raw, i) => {
        const id = crypto.randomUUID();
        idMap.set(i, id);
        return {
          id,
          projectId: project.id,
          parentId: raw.parentIndex === -1 ? null : (idMap.get(raw.parentIndex) ?? null),
          title: raw.title,
          nodeType: raw.nodeType,
          summary: raw.summary,
          affectedUser: raw.affectedUser,
          pain: raw.pain,
          currentWorkaround: raw.currentWorkaround,
          successDefinition: raw.successDefinition,
          status: "not_started",
          notes: "",
          blockers: "",
          createdAt: now,
          updatedAt: now,
        };
      });

      const merged = [...nodes, ...newNodes];
      persist(merged);

      // Expand root nodes
      const roots = newNodes.filter((n) => n.parentId === null);
      setExpandedIds((prev) => {
        const next = new Set(prev);
        roots.forEach((r) => next.add(r.id));
        return next;
      });
    } catch {
      setError("Generation failed. Check network connection.");
    } finally {
      setLoading(false);
    }
  };

  const handleUpdate = (updated: BusinessNode) => {
    persist(nodes.map((n) => (n.id === updated.id ? updated : n)));
  };

  const handleDelete = (id: string) => {
    // Also delete all descendants
    const toDelete = new Set<string>();
    const queue = [id];
    while (queue.length > 0) {
      const cur = queue.shift()!;
      toDelete.add(cur);
      nodes.filter((n) => n.parentId === cur).forEach((n) => queue.push(n.id));
    }
    persist(nodes.filter((n) => !toDelete.has(n.id)));
  };

  const handleAddChild = (parentId: string) => {
    const n = newNode(project.id, parentId);
    persist([...nodes, n]);
    setEditingId(n.id);
    setExpandedIds((prev) => new Set([...prev, parentId]));
  };

  const handleAddRoot = () => {
    const n = newNode(project.id, null);
    persist([...nodes, n]);
    setEditingId(n.id);
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

  const rootNodes = nodes.filter((n) => n.parentId === null);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-slate-700">What needs solving?</p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={handleGenerate}
            disabled={loading}
            className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-600 hover:border-slate-300 hover:bg-slate-50 disabled:opacity-50"
          >
            {loading ? "…" : "✦ Generate Draft"}
          </button>
          <button
            type="button"
            onClick={handleAddRoot}
            className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"
          >
            + Add node
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-700">
          {error}
        </div>
      )}

      {nodes.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-200 p-3 text-xs text-slate-400">
          No business tree yet. Generate a draft or add nodes manually.
        </p>
      ) : (
        <div>
          {rootNodes.map((node) => (
            <NodeRow
              key={node.id}
              node={node}
              allNodes={nodes}
              depth={0}
              expandedIds={expandedIds}
              editingId={editingId}
              onToggleExpand={toggleExpand}
              onToggleEdit={toggleEdit}
              onUpdate={handleUpdate}
              onAddChild={handleAddChild}
              onDelete={handleDelete}
            />
          ))}
          {/* Orphan nodes (parentId not found in tree) */}
          {nodes
            .filter((n) => n.parentId !== null && !nodes.find((p) => p.id === n.parentId))
            .map((node) => (
              <NodeRow
                key={node.id}
                node={node}
                allNodes={nodes}
                depth={0}
                expandedIds={expandedIds}
                editingId={editingId}
                onToggleExpand={toggleExpand}
                onToggleEdit={toggleEdit}
                onUpdate={handleUpdate}
                onAddChild={handleAddChild}
                onDelete={handleDelete}
              />
            ))}
        </div>
      )}

      {onSendToBuild && nodes.filter((n) => n.status === "selected").length > 0 && (
        <div className="rounded-xl border border-brand/20 bg-brand/5 p-3 text-xs text-brand">
          {nodes.filter((n) => n.status === "selected").length} node(s) selected
        </div>
      )}
    </div>
  );
}
