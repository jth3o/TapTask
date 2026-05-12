import { Agent, GitHubRepo, TaskType } from "./types";
import { buildIssueTitle, generateAgentPrompt } from "./generateIssue";

interface PromptInput {
  taskType: TaskType;
  agent: Agent;
  repo: GitHubRepo;
  roughDetails: string;
}

export function buildTaskTitle(taskType: TaskType, roughDetails: string): string {
  return buildIssueTitle(taskType, roughDetails);
}

export function generatePrompt({ taskType, agent, repo, roughDetails }: PromptInput): string {
  return generateAgentPrompt({
    repoFullName: repo.fullName,
    taskType,
    agent,
    rawInput: roughDetails
  });
}
