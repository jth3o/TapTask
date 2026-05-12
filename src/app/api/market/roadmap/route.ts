import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import { RoadmapRequest, RoadmapResponse } from "@/lib/marketTypes";
import { extractArray } from "@/lib/extractJSON";

const MODEL = "claude-haiku-4-5-20251001";

export async function POST(request: Request) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "ANTHROPIC_API_KEY is not set." } as RoadmapResponse, { status: 503 });
  }

  let body: RoadmapRequest;
  try {
    body = (await request.json()) as RoadmapRequest;
  } catch {
    return NextResponse.json({ error: "Invalid request body." } as RoadmapResponse, { status: 400 });
  }

  const { signal, opportunity, arenaName } = body;
  const client = new Anthropic({ apiKey });

  const prompt = `Generate 5 sequenced build-ready TapTask roadmap items for this MVP. Infrastructure first, core feature second, polish last. Each item must be concrete enough for an AI agent to start immediately.

Arena: ${arenaName}
MVP: ${opportunity.smallestMvp}
Pain: ${signal.painCreated}

Return ONLY a JSON array, no markdown:
[{"title":"<short>","goal":"<1 sentence>","acceptanceCriteria":["<criterion>","<criterion>"],"nonGoals":["<item>"],"suggestedProjectType":"web_app","suggestedAgent":"cursor|claude|codex|manual","verificationPlan":"<1 sentence>","taskType":"new_feature|fix_bug|polish_ui|fix_build|refactor|add_test|review_pr|write_readme|deploy_check"}]`;

  try {
    const msg = await client.messages.create({
      model: MODEL,
      max_tokens: 2500,
      messages: [{ role: "user", content: prompt }],
    });

    const text = msg.content[0]?.type === "text" ? msg.content[0].text.trim() : "[]";
    const items = extractArray<RoadmapResponse["items"] extends (infer U)[] | undefined ? U : never>(text);
    return NextResponse.json({ items } as RoadmapResponse);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Roadmap generation failed.";
    return NextResponse.json({ error: message } as RoadmapResponse, { status: 500 });
  }
}
