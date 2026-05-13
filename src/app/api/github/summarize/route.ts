import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import { getRepoSummaryContext, validateRepoFullName } from "@/lib/github";

export const runtime = "nodejs";

export type SummarizeResult = {
  summary?: string;
  error?: string;
};

export async function POST(request: Request) {
  const body = (await request.json()) as { repoFullName?: unknown };

  if (!validateRepoFullName(body.repoFullName)) {
    return NextResponse.json({ error: "Invalid repository name." } satisfies SummarizeResult, { status: 400 });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "ANTHROPIC_API_KEY is not set." } satisfies SummarizeResult, { status: 503 });
  }

  try {
    const context = await getRepoSummaryContext(body.repoFullName);

    const client = new Anthropic({ apiKey });
    const msg = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 400,
      messages: [{
        role: "user",
        content: `Summarize what this GitHub repository does in 3-5 short bullet points. Focus on what a developer working on it needs to know: what it is, what problem it solves, the main tech stack, and any key architectural decisions. Be concrete, not generic.\n\n${context}`,
      }],
    });

    const summary = msg.content[0]?.type === "text" ? msg.content[0].text.trim() : "";
    return NextResponse.json({ summary } satisfies SummarizeResult);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Summarization failed.";
    return NextResponse.json({ error: message } satisfies SummarizeResult, { status: 500 });
  }
}
