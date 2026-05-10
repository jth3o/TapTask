import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import { GenerateRequest, GenerateResponse, RoadmapItem } from "@/lib/ideaTypes";
import { extractArray, extractObject } from "@/lib/extractJSON";

const MODEL = "claude-haiku-4-5-20251001";

function projectSummary(project: GenerateRequest["project"]): string {
  return [
    `Name: ${project.name || "Unnamed"}`,
    `Type: Web Page`,
    project.problem ? `Problem: ${project.problem}` : null,
    project.targetUser ? `Target User: ${project.targetUser}` : null,
    project.mvpDefinition ? `MVP: ${project.mvpDefinition}` : null,
  ]
    .filter(Boolean)
    .join("\n");
}

export async function POST(request: Request) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "ANTHROPIC_API_KEY is not set. Add it to .env.local to enable AI generation." } as GenerateResponse,
      { status: 503 }
    );
  }

  let body: GenerateRequest;
  try {
    body = (await request.json()) as GenerateRequest;
  } catch {
    return NextResponse.json({ error: "Invalid request body." } as GenerateResponse, { status: 400 });
  }

  const { action, project } = body;
  const client = new Anthropic({ apiKey });
  const ctx = projectSummary(project);

  try {
    if (action === "target_user") {
      const msg = await client.messages.create({
        model: MODEL,
        max_tokens: 400,
        messages: [{
          role: "user",
          content: `Given this web page:\n${ctx}\n\nWrite a 2-3 sentence description of the primary target user. Be specific: who they are, what they do, and why they need this web page. Plain text, no bullet points.`,
        }],
      });
      const text = msg.content[0]?.type === "text" ? msg.content[0].text.trim() : "";
      return NextResponse.json({ action, result: text } as GenerateResponse);
    }

    if (action === "mvp") {
      const msg = await client.messages.create({
        model: MODEL,
        max_tokens: 500,
        messages: [{
          role: "user",
          content: `Given this web page:\n${ctx}\n\nWrite a crisp MVP definition in 3-5 sentences. Define the smallest version of this web page that proves the core value. Focus on what sections and features it includes and what it explicitly does NOT include in v1. Plain text.`,
        }],
      });
      const text = msg.content[0]?.type === "text" ? msg.content[0].text.trim() : "";
      return NextResponse.json({ action, result: text } as GenerateResponse);
    }

    if (action === "assumptions") {
      const msg = await client.messages.create({
        model: MODEL,
        max_tokens: 600,
        messages: [{
          role: "user",
          content: `Given this web page:\n${ctx}\n\nList 5-7 key assumptions this web page is making about users, market, and technology. Return ONLY a JSON array of short strings. Example: ["Users will find this via search","The problem exists at scale"]`,
        }],
      });
      const text = msg.content[0]?.type === "text" ? msg.content[0].text.trim() : "[]";
      const parsed = extractArray<string>(text);
      return NextResponse.json({ action, result: parsed } as GenerateResponse);
    }

    if (action === "roadmap") {
      const msg = await client.messages.create({
        model: MODEL,
        max_tokens: 3000,
        messages: [{
          role: "user",
          content: `Given this web page:\n${ctx}\n\nGenerate 4-6 build-ready roadmap items for the MVP web page. Each item should correspond to a section, feature, or interactive element of the web page. Return ONLY a JSON array, no markdown:
[{"title":"short title","description":"1-2 sentences","taskType":"new_feature|fix_bug|polish_ui|fix_build|refactor|add_test|review_pr|write_readme|deploy_check","acceptanceCriteria":["criterion"],"nonGoals":["not this"],"suggestedAgent":"cursor|claude|codex|manual"}]`,
        }],
      });
      const text = msg.content[0]?.type === "text" ? msg.content[0].text.trim() : "[]";
      const items = extractArray<Omit<RoadmapItem, "id" | "projectId" | "status">>(text);
      return NextResponse.json({ action, result: items } as GenerateResponse);
    }

    if (action === "clarity_score") {
      const msg = await client.messages.create({
        model: MODEL,
        max_tokens: 400,
        messages: [{
          role: "user",
          content: `Score this web page MVP definition for build-readiness 0-10, where 10 means an AI coding agent could start building immediately.\n\nWeb page:\n${ctx}\n\nReturn ONLY a JSON object, no markdown: {"score":<number>,"feedback":"<1-2 sentences>"}`,
        }],
      });
      const text = msg.content[0]?.type === "text" ? msg.content[0].text.trim() : '{"score":0,"feedback":""}';
      const parsed = extractObject<{ score: number; feedback: string }>(text);
      return NextResponse.json({ action, result: parsed } as GenerateResponse);
    }

    return NextResponse.json({ error: `Unknown action: ${action}` } as GenerateResponse, { status: 400 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Generation failed.";
    return NextResponse.json({ error: message } as GenerateResponse, { status: 500 });
  }
}
