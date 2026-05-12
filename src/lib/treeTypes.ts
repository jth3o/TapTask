// Tree types are used by:
//   - LandingPageSpec / LandingPageFeature → primary workflow (LandingPageSection)
//   - BusinessNode, BuildTree, BuildNode → experimental Labs section only
// Do not remove — these types will be needed when the tree planning feature is revisited.
export const TREE_STATUSES = [
  "not_started", "planned", "selected", "in_progress",
  "needs_review", "weak", "good_enough", "done", "blocked"
] as const;
export type TreeStatus = (typeof TREE_STATUSES)[number];

export const TREE_STATUS_LABELS: Record<TreeStatus, string> = {
  not_started: "Not started",
  planned: "Planned",
  selected: "Selected",
  in_progress: "In progress",
  needs_review: "Needs review",
  weak: "Weak",
  good_enough: "Good enough",
  done: "Done",
  blocked: "Blocked",
};

export const TREE_STATUS_COLORS: Record<TreeStatus, string> = {
  not_started: "bg-slate-100 text-slate-500",
  planned: "bg-blue-50 text-blue-600",
  selected: "bg-brand/10 text-brand",
  in_progress: "bg-amber-50 text-amber-700",
  needs_review: "bg-purple-50 text-purple-700",
  weak: "bg-red-50 text-red-600",
  good_enough: "bg-emerald-50 text-emerald-700",
  done: "bg-emerald-100 text-emerald-800",
  blocked: "bg-red-100 text-red-700",
};

export const BUSINESS_NODE_TYPES = [
  "market_space", "user_group", "major_problem",
  "specific_pain", "current_workaround", "product_promise", "custom"
] as const;
export type BusinessNodeType = (typeof BUSINESS_NODE_TYPES)[number];

export const BUSINESS_NODE_TYPE_LABELS: Record<BusinessNodeType, string> = {
  market_space: "Market Space",
  user_group: "User Group",
  major_problem: "Major Problem",
  specific_pain: "Specific Pain",
  current_workaround: "Current Workaround",
  product_promise: "Product Promise",
  custom: "Custom",
};

export interface BusinessNode {
  id: string;
  projectId: string;
  parentId: string | null;
  title: string;
  nodeType: BusinessNodeType;
  summary: string;
  affectedUser: string;
  pain: string;
  currentWorkaround: string;
  successDefinition: string;
  status: TreeStatus;
  notes: string;
  blockers: string;
  createdAt: string;
  updatedAt: string;
}

export const DIFFICULTY_LEVELS = ["low", "medium", "high"] as const;
export type BuildDifficulty = (typeof DIFFICULTY_LEVELS)[number];

export const DIFFICULTY_COLORS: Record<BuildDifficulty, string> = {
  low: "bg-emerald-100 text-emerald-700",
  medium: "bg-amber-100 text-amber-700",
  high: "bg-red-100 text-red-700",
};

export interface LandingPageFeature {
  id: string;
  landingPageSpecId: string;
  title: string;
  userProblem: string;
  whatItDoes: string;
  whyItMatters: string;
  successDefinition: string;
  buildDifficulty?: BuildDifficulty; // estimated effort for primary workflow
  status: TreeStatus;
  notes: string;
}

export interface LandingPageSpec {
  id: string;
  projectId: string;
  heroHeadline: string;
  heroSubheadline: string;
  targetUser: string;
  problemSection: string;
  productPromise: string;
  featureSections: LandingPageFeature[];
  workflowSteps: string[];
  mvpBoundary: string;
  primaryCta: string;
  notes: string;
  status: TreeStatus;
  createdAt: string;
  updatedAt: string;
}

export const BUILD_NODE_TYPES = [
  "solution_root", "frontend_ui", "backend_logic",
  "integration_api", "data_persistence", "testing_verification", "custom"
] as const;
export type BuildNodeType = (typeof BUILD_NODE_TYPES)[number];

export const BUILD_NODE_TYPE_LABELS: Record<BuildNodeType, string> = {
  solution_root: "Solution Root",
  frontend_ui: "Frontend / UI",
  backend_logic: "Backend / Logic",
  integration_api: "Integrations / APIs",
  data_persistence: "Data / Persistence",
  testing_verification: "Testing / Verification",
  custom: "Custom",
};

export interface BuildTree {
  id: string;
  projectId: string;
  businessNodeId?: string | null;
  landingPageFeatureId?: string | null;
  title: string;
  summary: string;
  status: TreeStatus;
  createdAt: string;
  updatedAt: string;
}

export interface BuildNode {
  id: string;
  buildTreeId: string;
  parentId: string | null;
  title: string;
  nodeType: BuildNodeType;
  purpose: string;
  status: TreeStatus;
  notes: string;
  blockers: string;
  acceptanceCriteria: string[];
  nonGoals: string[];
  verificationPlan: string[];
  createdAt: string;
  updatedAt: string;
}
