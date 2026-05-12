import { GitHubPullRequest, SentTask } from "./types";

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function pullMatchesSentTask(pull: GitHubPullRequest, task: SentTask) {
  const text = `${pull.title}\n${pull.body ?? ""}`;
  const issueNumber = task.issueNumber;

  if (issueNumber) {
    const issuePatterns = [
      new RegExp(`#${issueNumber}\\b`, "i"),
      new RegExp(`closes\\s+#${issueNumber}\\b`, "i"),
      new RegExp(`fixes\\s+#${issueNumber}\\b`, "i"),
      new RegExp(`resolves\\s+#${issueNumber}\\b`, "i")
    ];

    if (issuePatterns.some((pattern) => pattern.test(text))) {
      return true;
    }
  }

  return Boolean(task.id && new RegExp(`task\\s*id:\\s*${escapeRegex(task.id)}`, "i").test(text));
}

export function findMatchingPullForTask(pulls: GitHubPullRequest[], task: SentTask) {
  return pulls.find((pull) => pullMatchesSentTask(pull, task)) ?? null;
}
