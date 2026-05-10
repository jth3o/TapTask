import { MarketSignal, OpportunityMap, ScanRequest } from "./marketTypes";

const SCANS_KEY = "taptask-market-scans-v1";
const OPEN_PROJECT_KEY = "taptask-open-project-v1";

function isClient() {
  return typeof window !== "undefined";
}

export interface SavedScan {
  id: string;
  params: ScanRequest;
  signals: MarketSignal[];
  opportunities: Record<string, OpportunityMap>;
  roadmaps: Record<string, import("./marketTypes").MarketRoadmapItem[]>;
  createdAt: string;
}

export function loadSavedScans(): SavedScan[] {
  if (!isClient()) return [];
  try {
    return JSON.parse(localStorage.getItem(SCANS_KEY) ?? "[]") as SavedScan[];
  } catch {
    return [];
  }
}

export function saveScan(scan: SavedScan): void {
  const existing = loadSavedScans();
  const next = [scan, ...existing.filter((s) => s.id !== scan.id)].slice(0, 10);
  localStorage.setItem(SCANS_KEY, JSON.stringify(next));
}

export function deleteScan(id: string): void {
  if (!isClient()) return;
  const next = loadSavedScans().filter((s) => s.id !== id);
  localStorage.setItem(SCANS_KEY, JSON.stringify(next));
}

export function saveOpenProjectId(id: string): void {
  if (!isClient()) return;
  localStorage.setItem(OPEN_PROJECT_KEY, id);
}

export function loadAndClearOpenProjectId(): string | null {
  if (!isClient()) return null;
  const id = localStorage.getItem(OPEN_PROJECT_KEY);
  if (id) localStorage.removeItem(OPEN_PROJECT_KEY);
  return id;
}
