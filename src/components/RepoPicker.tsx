"use client";

import { useState } from "react";
import { GitHubRepo, ProjectType } from "@/lib/types";

interface RepoPickerProps {
  repos: GitHubRepo[];
  selectedRepo: GitHubRepo | null;
  favoriteRepoFullNames: string[];
  recentRepoFullNames: string[];
  projectType: ProjectType;
  onSelect: (repo: GitHubRepo) => void;
  onToggleFavorite: (repoFullName: string) => void;
  onProjectTypeChange: (type: ProjectType) => void;
}

export function RepoPicker({
  repos,
  selectedRepo,
  favoriteRepoFullNames,
  recentRepoFullNames,
  onSelect,
  onToggleFavorite,
}: RepoPickerProps) {
  const [search, setSearch] = useState("");
  const [showList, setShowList] = useState(!selectedRepo);

  const normalizedSearch = search.trim().toLowerCase();

  const recentRepos = recentRepoFullNames
    .map((fullName) => repos.find((r) => r.fullName === fullName))
    .filter((r): r is GitHubRepo => Boolean(r))
    .slice(0, 5);

  const filteredRepos = repos
    .filter((r) => r.fullName.toLowerCase().includes(normalizedSearch))
    .sort((a, b) => {
      const aFav = favoriteRepoFullNames.includes(a.fullName) ? 1 : 0;
      const bFav = favoriteRepoFullNames.includes(b.fullName) ? 1 : 0;
      const aRec = recentRepoFullNames.includes(a.fullName) ? 1 : 0;
      const bRec = recentRepoFullNames.includes(b.fullName) ? 1 : 0;
      return bFav - aFav || bRec - aRec || a.fullName.localeCompare(b.fullName);
    })
    .slice(0, 25);

  const handleSelect = (repo: GitHubRepo) => {
    onSelect(repo);
    setShowList(false);
    setSearch("");
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
      {/* ── Selected repo header ── */}
      {selectedRepo ? (
        <div className="p-3">
          <div className="flex items-center gap-2">
            {/* Repo name — tap to change */}
            <button
              type="button"
              onClick={() => setShowList((v) => !v)}
              className="flex min-w-0 flex-1 flex-col text-left"
            >
              <span className="truncate text-sm font-semibold text-slate-900">{selectedRepo.fullName}</span>
              <span className="text-xs text-slate-400">{showList ? "tap to close" : "tap to change"}</span>
            </button>
          </div>
        </div>
      ) : (
        /* No repo selected yet — show prompt */
        <div className="p-3">
          <p className="text-sm text-slate-500">Select a repository to get started.</p>
        </div>
      )}

      {/* ── Repo list (collapsible) ── */}
      {(!selectedRepo || showList) && (
        <div className={`${selectedRepo ? "border-t border-slate-100" : ""} p-3`}>
          <input
            className="mb-3 min-h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-blue-100"
            placeholder="Search repositories…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            autoFocus={showList && !!selectedRepo}
          />

          {recentRepos.length > 0 && !normalizedSearch && (
            <div className="mb-3">
              <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400">Recent</p>
              <div className="flex gap-1.5 overflow-x-auto pb-1">
                {recentRepos.map((repo) => (
                  <button
                    key={repo.id}
                    type="button"
                    onClick={() => handleSelect(repo)}
                    className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-semibold ${
                      selectedRepo?.fullName === repo.fullName
                        ? "border-brand bg-blue-50 text-brand"
                        : "border-slate-200 bg-white text-slate-700"
                    }`}
                  >
                    {repo.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="max-h-64 space-y-1.5 overflow-auto">
            {filteredRepos.length === 0 ? (
              <p className="rounded-xl border border-dashed border-slate-200 p-3 text-sm text-slate-500">
                No repos found.
              </p>
            ) : (
              filteredRepos.map((repo) => {
                const selected = selectedRepo?.fullName === repo.fullName;
                const fav = favoriteRepoFullNames.includes(repo.fullName);
                return (
                  <div
                    key={repo.id}
                    className={`flex items-center gap-2 rounded-xl border px-3 py-2.5 ${
                      selected ? "border-brand bg-blue-50" : "border-slate-200 bg-white"
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => handleSelect(repo)}
                      className="flex-1 text-left"
                    >
                      <p className={`text-sm font-medium ${selected ? "text-brand" : "text-slate-900"}`}>
                        {repo.fullName}
                      </p>
                      <p className="text-xs text-slate-400">
                        {repo.private ? "Private" : "Public"} · {repo.defaultBranch}
                      </p>
                    </button>
                    <button
                      type="button"
                      onClick={() => onToggleFavorite(repo.fullName)}
                      className={`shrink-0 text-base ${fav ? "opacity-100" : "opacity-30 hover:opacity-60"}`}
                      title={fav ? "Remove favorite" : "Add favorite"}
                    >
                      ★
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
