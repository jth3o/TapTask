# TapTask

TapTask is a mobile-first Next.js app that converts rough coding requests into structured prompts for Cursor, Claude, Codex, or ChatGPT.

## What v1 Includes

- Task types: New Project, New Feature, Fix Bug, Polish UI, Refactor, Add Test, Fix Build, Review PR, Write README, Deploy Check
- Project profile manager stored in localStorage
- Prompt generation templates by task type
- Copy generated prompt button
- Save generated task button
- Recent saved tasks list that persists across refresh

## Tech

- Next.js App Router
- TypeScript
- Tailwind CSS
- localStorage only (no auth, no DB, no external APIs)

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

1. Choose a task type.
2. Select a project profile (or create one).
3. Enter rough task details.
4. Select the target agent.
5. Tap Generate Prompt.
6. Copy or save the prompt.
7. Review recent saved tasks on the home screen.

## Data storage

All data is local to the browser and saved to localStorage:

- `taptask-project-profiles-v1`
- `taptask-saved-tasks-v1`
