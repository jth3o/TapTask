type SetupCardProps = {
  message: string;
};

export function SetupCard({ message }: SetupCardProps) {
  const isTokenError =
    message.toLowerCase().includes("github token") ||
    message.toLowerCase().includes("not configured") ||
    message.toLowerCase().includes("401") ||
    message.toLowerCase().includes("403");

  if (!isTokenError) return null;

  return (
    <section className="space-y-3 rounded-2xl border border-amber-200 bg-amber-50 p-4">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">Setup required</p>
        <h2 className="mt-1 text-base font-bold text-slate-900">GitHub token not configured</h2>
        <p className="mt-1 text-sm text-slate-700">
          TapTask needs a GitHub personal access token to load your repos and create issues.
        </p>
      </div>

      <ol className="space-y-2 text-sm text-slate-700">
        <li>
          <span className="font-semibold">1.</span> Go to{" "}
          <a
            href="https://github.com/settings/tokens/new"
            target="_blank"
            rel="noreferrer"
            className="font-semibold text-brand underline"
          >
            github.com/settings/tokens/new
          </a>
        </li>
        <li>
          <span className="font-semibold">2.</span> Select scopes:{" "}
          <code className="rounded bg-amber-100 px-1 text-xs">repo</code>{" "}
          <code className="rounded bg-amber-100 px-1 text-xs">workflow</code>
        </li>
        <li>
          <span className="font-semibold">3.</span> Copy the token and add it to your deployment:
          <pre className="mt-1 rounded-xl bg-white px-3 py-2 text-xs text-slate-700">
            GITHUB_TOKEN=ghp_your_token_here
          </pre>
        </li>
        <li>
          <span className="font-semibold">4.</span> On Vercel: Settings → Environment Variables → add{" "}
          <code className="rounded bg-amber-100 px-1 text-xs">GITHUB_TOKEN</code>, then redeploy.
        </li>
        <li>
          <span className="font-semibold">5.</span> Locally: add to{" "}
          <code className="rounded bg-amber-100 px-1 text-xs">.env.local</code> and restart.
        </li>
      </ol>
    </section>
  );
}
