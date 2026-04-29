import { GitHubRepo } from "@/lib/types";

interface RepoPickerProps {
  repos: GitHubRepo[];
  selectedRepo: GitHubRepo | null;
  favoriteRepoFullNames: string[];
  recentRepoFullNames: string[];
  search: string;
  onSearchChange: (value: string) => void;
  onSelect: (repo: GitHubRepo) => void;
  onToggleFavorite: (repoFullName: string) => void;
}

export function RepoPicker({
  repos,
  selectedRepo,
  favoriteRepoFullNames,
  recentRepoFullNames,
  search,
  onSearchChange,
  onSelect,
  onToggleFavorite
}: RepoPickerProps) {
  const normalizedSearch = search.trim().toLowerCase();
  const recentRepos = recentRepoFullNames
    .map((fullName) => repos.find((repo) => repo.fullName === fullName))
    .filter((repo): repo is GitHubRepo => Boolean(repo))
    .slice(0, 4);
  const filteredRepos = repos
    .filter((repo) => repo.fullName.toLowerCase().includes(normalizedSearch))
    .sort((a, b) => {
      const aFavorite = favoriteRepoFullNames.includes(a.fullName) ? 1 : 0;
      const bFavorite = favoriteRepoFullNames.includes(b.fullName) ? 1 : 0;
      const aRecent = recentRepoFullNames.includes(a.fullName) ? 1 : 0;
      const bRecent = recentRepoFullNames.includes(b.fullName) ? 1 : 0;
      return bFavorite - aFavorite || bRecent - aRecent || a.fullName.localeCompare(b.fullName);
    })
    .slice(0, 25);

  return (
    <section className="space-y-3">
      <input
        className="min-h-12 w-full rounded-xl border border-slate-300 bg-white px-3 text-base shadow-sm outline-none focus:border-brand focus:ring-2 focus:ring-blue-100"
        placeholder="Search repositories..."
        value={search}
        onChange={(event) => onSearchChange(event.target.value)}
      />

      {selectedRepo ? (
        <div className="rounded-xl border border-blue-200 bg-blue-50 p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-brand">Selected repo</p>
          <p className="text-sm font-semibold text-slate-900">{selectedRepo.fullName}</p>
        </div>
      ) : null}

      {recentRepos.length > 0 ? (
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Recent repos</p>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {recentRepos.map((repo) => (
              <button
                key={repo.id}
                type="button"
                className="min-h-11 shrink-0 rounded-full border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700"
                onClick={() => onSelect(repo)}
              >
                {repo.name}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      <div className="max-h-80 space-y-2 overflow-auto pr-1">
        {filteredRepos.length === 0 ? (
          <p className="rounded-xl border border-dashed border-slate-300 p-3 text-sm text-slate-600">No repos found.</p>
        ) : (
          filteredRepos.map((repo) => {
            const selected = selectedRepo?.fullName === repo.fullName;
            const favorite = favoriteRepoFullNames.includes(repo.fullName);

            return (
              <article key={repo.id} className={`rounded-xl border bg-white p-3 ${selected ? "border-brand" : "border-slate-200"}`}>
                <button type="button" className="block w-full text-left" onClick={() => onSelect(repo)}>
                  <p className="text-sm font-semibold text-slate-900">{repo.fullName}</p>
                  <p className="mt-2 text-xs text-slate-500">
                    {repo.private ? "Private" : "Public"} - Default: {repo.defaultBranch}
                  </p>
                </button>
                <button
                  type="button"
                  className="mt-2 min-h-10 rounded-lg border border-slate-200 px-3 text-xs font-semibold text-slate-700"
                  onClick={() => onToggleFavorite(repo.fullName)}
                >
                  {favorite ? "Favorited" : "Favorite"}
                </button>
              </article>
            );
          })
        )}
      </div>
    </section>
  );
}
