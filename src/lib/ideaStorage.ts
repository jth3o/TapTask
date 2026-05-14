import { IdeaProject, RoadmapItem, TaskPrefill, Feature } from "./ideaTypes";
import { BusinessNode, LandingPageSpec, BuildTree, BuildNode } from "./treeTypes";

const PROJECTS_KEY = "taptask-idea-projects-v1";
const ROADMAP_KEY = "taptask-roadmap-items-v1";
const PREFILL_KEY = "taptask-task-prefill-v1";
const OPEN_PROJECT_KEY = "taptask-open-project-v1";

function isClient() {
  return typeof window !== "undefined";
}

export function loadIdeaProjects(): IdeaProject[] {
  if (!isClient()) return [];
  const raw = window.localStorage.getItem(PROJECTS_KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw) as IdeaProject[];
  } catch {
    return [];
  }
}

export function saveIdeaProjects(projects: IdeaProject[]) {
  if (!isClient()) return;
  window.localStorage.setItem(PROJECTS_KEY, JSON.stringify(projects));
}

export function loadRoadmapItems(): RoadmapItem[] {
  if (!isClient()) return [];
  const raw = window.localStorage.getItem(ROADMAP_KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw) as RoadmapItem[];
  } catch {
    return [];
  }
}

export function saveRoadmapItems(items: RoadmapItem[]) {
  if (!isClient()) return;
  window.localStorage.setItem(ROADMAP_KEY, JSON.stringify(items));
}

export function saveTaskPrefill(prefill: TaskPrefill) {
  if (!isClient()) return;
  window.localStorage.setItem(PREFILL_KEY, JSON.stringify(prefill));
}

export function loadAndClearTaskPrefill(): TaskPrefill | null {
  if (!isClient()) return null;
  const raw = window.localStorage.getItem(PREFILL_KEY);
  if (!raw) return null;
  window.localStorage.removeItem(PREFILL_KEY);
  try {
    return JSON.parse(raw) as TaskPrefill;
  } catch {
    return null;
  }
}

export function saveOpenProjectId(id: string): void {
  if (!isClient()) return;
  window.localStorage.setItem(OPEN_PROJECT_KEY, id);
}

export function loadAndClearOpenProjectId(): string | null {
  if (!isClient()) return null;
  const id = window.localStorage.getItem(OPEN_PROJECT_KEY);
  if (id) window.localStorage.removeItem(OPEN_PROJECT_KEY);
  return id;
}

// ─── Feature storage ──────────────────────────────────────────────────────────

const FEATURES_KEY = "taptask-features-v1";

export function loadFeatures(): Feature[] {
  if (!isClient()) return [];
  const raw = window.localStorage.getItem(FEATURES_KEY);
  if (!raw) return [];
  try { return JSON.parse(raw) as Feature[]; } catch { return []; }
}

export function saveFeatures(features: Feature[]): void {
  if (!isClient()) return;
  window.localStorage.setItem(FEATURES_KEY, JSON.stringify(features));
}

// ─── Tree storage ─────────────────────────────────────────────────────────────

const BUSINESS_NODES_KEY = "taptask-business-nodes-v1";
const LANDING_PAGE_SPECS_KEY = "taptask-landing-page-specs-v1";
const BUILD_TREES_KEY = "taptask-build-trees-v1";
const BUILD_NODES_KEY = "taptask-build-nodes-v1";

export function loadBusinessNodes(): BusinessNode[] {
  if (!isClient()) return [];
  const raw = window.localStorage.getItem(BUSINESS_NODES_KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw) as BusinessNode[];
  } catch {
    return [];
  }
}

export function saveBusinessNodes(nodes: BusinessNode[]): void {
  if (!isClient()) return;
  window.localStorage.setItem(BUSINESS_NODES_KEY, JSON.stringify(nodes));
}

export function loadLandingPageSpecs(): LandingPageSpec[] {
  if (!isClient()) return [];
  const raw = window.localStorage.getItem(LANDING_PAGE_SPECS_KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw) as LandingPageSpec[];
  } catch {
    return [];
  }
}

export function saveLandingPageSpecs(specs: LandingPageSpec[]): void {
  if (!isClient()) return;
  window.localStorage.setItem(LANDING_PAGE_SPECS_KEY, JSON.stringify(specs));
}

export function loadBuildTrees(): BuildTree[] {
  if (!isClient()) return [];
  const raw = window.localStorage.getItem(BUILD_TREES_KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw) as BuildTree[];
  } catch {
    return [];
  }
}

export function saveBuildTrees(trees: BuildTree[]): void {
  if (!isClient()) return;
  window.localStorage.setItem(BUILD_TREES_KEY, JSON.stringify(trees));
}

export function loadBuildNodes(): BuildNode[] {
  if (!isClient()) return [];
  const raw = window.localStorage.getItem(BUILD_NODES_KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw) as BuildNode[];
  } catch {
    return [];
  }
}

export function saveBuildNodes(nodes: BuildNode[]): void {
  if (!isClient()) return;
  window.localStorage.setItem(BUILD_NODES_KEY, JSON.stringify(nodes));
}
