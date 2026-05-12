# TapTask

TapTask is a mobile-first Next.js app for sending coding tasks from your phone to Cursor’s coding agent, with GitHub as the source of truth.

TapTask creates GitHub issues, starts Cursor SDK cloud runs, and tracks matching PRs. It does not edit your local computer, push to main, merge PRs, or store data in a database. Cursor is expected to update GitHub branches and PRs; you pull and test locally later.

## How v1 Works

1. Open TapTask on your phone.
2. Pick a GitHub repository available to `GITHUB_TOKEN`.
3. Choose a task type.
5. Write a rough coding request.
6. Tap `Send to Cursor`.
7. TapTask creates a structured GitHub issue.
8. TapTask starts a Cursor SDK cloud agent run server-side.
9. TapTask stores the Cursor run ID/status locally and shows the issue link, run status, and open PR pull commands.

## Tech

- Next.js App Router
- TypeScript
- Tailwind CSS
- `@cursor/sdk`
- GitHub REST API
- `localStorage` for recent sent tasks and recent/favorite repos
- No database, OAuth, OpenAI API, Vercel API, direct code editing, or auto-merge for v1

## GitHub token setup

Create `.env.local` from `.env.example`:

```bash
cp .env.example .env.local
```

Set `GITHUB_TOKEN` to a fine-grained GitHub token. The token should have:

- Repository access: all repositories, or selected repositories
- Metadata: read
- Issues: read/write
- Pull requests: read
- Contents: read

Do not expose this token in client code. TapTask only uses it from server routes under `src/app/api/github`.

GitHub only shows a token once when you create it. If you lose it, revoke it and generate a new one from GitHub Settings -> Developer settings -> Personal access tokens.

## Cursor SDK Setup

Create a Cursor API key from Cursor Dashboard -> Integrations, then add it to `.env.local`:

```bash
CURSOR_API_KEY=your_cursor_api_key
GITHUB_TOKEN=your_github_token
```

TapTask uses `CURSOR_API_KEY` only in server routes. The key is never exposed to the browser or saved in localStorage.

When you tap `Send to Cursor`, TapTask:

1. Creates a GitHub issue in the selected repo.
2. Starts a Cursor SDK cloud agent run with the repo URL and default branch.
3. Sends Cursor the issue URL, issue number, task type, structured issue body, and PR instructions.
4. Asks Cursor to create a new branch, commit changes, and open a PR against the default branch.
5. Expects the PR body to include `Closes #ISSUE_NUMBER`.

Test this first on a low-risk repo with a small task, then check the PR before pulling locally.

## Agent Connections

TapTask does not itself run Claude, Cursor, Codex, or any other AI agent. It dispatches tasks through GitHub by creating issues and, when available, comments.

A repo must have Claude Code GitHub Action configured before `@claude` comments will trigger coding work. Cursor and Codex are local/manual connection settings in v1. If an agent is not connected, TapTask can still create a GitHub issue and will label the task honestly.

TapTask v1 checks for these likely Claude workflow paths:

- `.github/workflows/claude.yml`
- `.github/workflows/claude.yaml`
- `.github/workflows/claude-code.yml`
- `.github/workflows/claude-code.yaml`

If a workflow file is found, TapTask reads it when possible and looks for likely Claude or Anthropic strings such as `claude`, `anthropic`, `claude-code`, or `anthropics/claude-code-action`. TapTask does not try to read repository secret values because GitHub does not expose them.

If no Claude workflow is found, TapTask shows `Agent Not Connected`, creates issues only, and skips the Claude dispatch comment. The app can also create a Claude setup issue in the selected repo.

The Agent Connections section stores these local settings in `localStorage`:

- `codexEnabled`
- `cursorEnabled`
- `preferredAgent`
- `cursorOpenUrl`

## Claude

Claude is the only automatic implementation dispatch in v1 when a likely Claude workflow is detected.

The `Test Claude Dispatch` button creates an issue titled `TapTask Claude Connection Test` and comments:

```text
@claude reply to confirm you can see this issue. Do not edit code and do not open a PR.
```

## Claude Setup

To use automatic Claude dispatch, enable Claude Code GitHub Action in each target repository. Repos must have Claude Code GitHub Action configured before `@claude` comments will do anything.

Required setup:

- Add a Claude workflow file under `.github/workflows/`.
- Add the required secret, usually `ANTHROPIC_API_KEY`.
- Give the workflow permissions:
  - `contents: write`
  - `pull-requests: write`
  - `issues: write`
  - `id-token: write`
- Confirm the workflow listens to `issue_comment` or the correct Claude trigger event.
- Manually test by commenting `@claude` on an issue and checking the Actions tab.
- Completion proof: Claude opens a PR.

When Claude is connected, TapTask posts this exact issue comment after creating a Claude task:

```text
@claude implement the GitHub issue above by editing the repository code. Create a new branch, commit the changes, and open a pull request against the default branch. Do not merge. If you cannot create the branch, commit, or pull request, reply with the exact blocker.
```

Claude should then work through GitHub branches and PRs. You can pull and test the PR locally later from the Open PRs section.

## Codex / ChatGPT

Codex is manually configured in v1. Connect GitHub to ChatGPT from Settings -> Apps -> GitHub, then set up Codex cloud and enable code review for the repo.

TapTask supports:

- PR Review mode: use the Open PRs section to comment `@codex review` on a selected PR.
- Issue Implementation mode: create a GitHub issue and copy the generated `@codex` implementation command.

TapTask does not claim Codex automatic implementation works unless you mark Codex as enabled in Agent Connections.

## Cursor

Cursor is the primary dispatch path in v1. Connect Cursor to GitHub and configure `CURSOR_API_KEY` server-side.

TapTask creates a GitHub issue, starts a Cursor SDK cloud run, and shows:

- issue URL
- Cursor run status
- run ID / agent ID
- run events when available from the SDK
- matching PRs and local pull/test commands

## Run locally

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## Build and lint

```bash
npm run lint
npm run build
```

## How to use

1. Add `GITHUB_TOKEN` to `.env.local`.
2. Start the app.
3. Search and select a GitHub repo.
4. Choose a coding task type.
5. Keep Cursor selected as the target agent.
6. Write a rough coding request.
7. Tap `Send to Cursor`.
8. Review the issue link and Cursor run status.
9. Watch open PRs for a matching PR.
10. Review recent sent tasks and open PR pull commands.

## API routes

- `GET /api/github/repos`
- `GET /api/github/agent-readiness?repoFullName=owner/repo`
- `GET /api/github/pulls?repoFullName=owner/repo`
- `POST /api/agents/cursor/run`
- `POST /api/github/claude/test-dispatch`
- `POST /api/github/pulls/codex-review`
- `POST /api/tasks/send`
- `POST /api/github/issues`
- `POST /api/github/issues/comment`

## Data storage

All data is local to the browser and saved to localStorage:

- `taptask-sent-tasks-v1`
- `taptask-favorite-repos-v1`
- `taptask-recent-repos-v1`
- `taptask-agent-settings-v1`

Tokens are never stored in localStorage.

## Current Limitations

- Cursor SDK run status is stored locally for now.
- Cursor run event display is limited to events returned when the run starts.
- Codex is manually enabled and supports issue command copy or PR review comments.
- Claude dispatch requires a Claude Code GitHub Action workflow in the target repo.
- There is no auto-merge.
- There are no direct code edits.
- There is no database.
