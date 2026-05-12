// EXPERIMENTAL — powers the Labs > Build Trees section.
// Not called by the primary workflow. Kept for future use.
import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import { IdeaProject } from "@/lib/ideaTypes";
import { BusinessNode, LandingPageFeature, BuildNodeType } from "@/lib/treeTypes";
import { extractObject } from "@/lib/extractJSON";

const MODEL = "claude-haiku-4-5-20251001";

export interface RawBuildNode {
  parentIndex: number;
  title: string;
  nodeType: BuildNodeType;
  purpose: string;
  acceptanceCriteria: string[];
  nonGoals: string[];
  verificationPlan: string[];
}

interface BuildTreeRequest {
  project: IdeaProject;
  businessNode?: BusinessNode;
  landingFeature?: LandingPageFeature;
  title?: string;
}

interface BuildTreeResponse {
  tree?: { title: string; summary: string };
  nodes?: RawBuildNode[];
  error?: string;
}

export async function POST(request: Request) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "ANTHROPIC_API_KEY is not set." } as BuildTreeResponse,
      { status: 503 }
    );
  }

  let body: BuildTreeRequest;
  try {
    body = (await request.json()) as BuildTreeRequest;
  } catch {
    return NextResponse.json({ error: "Invalid request body." } as BuildTreeResponse, { status: 400 });
  }

  const { project, businessNode, landingFeature, title } = body;
  const client = new Anthropic({ apiKey });

  const ctx = [
    `Project: ${project.name || "Unnamed"}`,
    project.problem ? `Problem: ${project.problem}` : null,
    project.targetUser ? `Target User: ${project.targetUser}` : null,
    project.mvpDefinition ? `MVP: ${project.mvpDefinition}` : null,
    businessNode ? `\nFocus node: [${businessNode.nodeType}] ${businessNode.title}\nSummary: ${businessNode.summary}\nPain: ${businessNode.pain}\nWorkaround: ${businessNode.currentWorkaround}\nSuccess: ${businessNode.successDefinition}` : null,
    landingFeature ? `\nLanding feature: ${landingFeature.title}\nProblem: ${landingFeature.userProblem}\nWhat it does: ${landingFeature.whatItDoes}\nSuccess: ${landingFeature.successDefinition}` : null,
    title ? `\nBuild title hint: ${title}` : null,
  ].filter(Boolean).join("\n");

  const prompt = `Generate a build tree for this specific web page feature or section. All build trees are for web pages. Every node must be concrete and actionable — NOT generic placeholders.

Context:
${ctx}

Return ONLY a JSON object, no markdown:
{"title":"<short build tree title>","summary":"<1-2 sentences on what this build covers>","nodes":[{"parentIndex":-1,"title":"<solution root title>","nodeType":"solution_root","purpose":"<overall purpose>","acceptanceCriteria":["<criterion>"],"nonGoals":["<not in scope>"],"verificationPlan":["<how to verify>"]},{"parentIndex":0,"title":"<specific UI task>","nodeType":"frontend_ui","purpose":"<purpose>","acceptanceCriteria":["<criterion>"],"nonGoals":[],"verificationPlan":["<test step>"]},...]}

Required structure:
1. One solution_root node (parentIndex: -1)
2. One frontend_ui branch node (parentIndex: 0) with 3-5 specific children for web page sections, components, and layouts
3. One backend_logic branch node (parentIndex: 0) with 3-5 specific children for API routes, form handlers, and data fetching
4. One integration_api branch node (parentIndex: 0) with 3-5 specific children for third-party APIs, webhooks, and embedding scripts (or 1 if no integrations needed)
5. One data_persistence branch node (parentIndex: 0) with 2-4 specific children
6. One testing_verification branch node (parentIndex: 0) with 3-5 specific children

ALL child nodes must be specific to this web page feature — name actual components, routes, data models, test cases.`;

  try {
    const msg = await client.messages.create({
      model: MODEL,
      max_tokens: 3000,
      messages: [{ role: "user", content: prompt }],
    });

    const raw = msg.content[0]?.type === "text" ? msg.content[0].text.trim() : "{}";
    const result = extractObject<{ title: string; summary: string; nodes: RawBuildNode[] }>(raw);
    return NextResponse.json({
      tree: { title: result.title, summary: result.summary },
      nodes: result.nodes,
    } as BuildTreeResponse);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Generation failed.";
    return NextResponse.json({ error: message } as BuildTreeResponse, { status: 500 });
  }
}
