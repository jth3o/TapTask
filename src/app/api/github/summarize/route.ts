import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import { getRepoSummaryContext, validateRepoFullName } from "@/lib/github";
import { withAuth } from "@/lib/requireAuth";

export const runtime = "nodejs";

export type SummarizeResult = {
  summary?: string;
  error?: string;
};

export const POST = withAuth(async (request: Request) => {
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
      max_tokens: 600,
      messages: [{
        role: "user",
        content: `Analyze this GitHub repository and respond in exactly three sections with these headers:

**What it does**
One or two sentences in plain English that anyone could understand — no jargon, no tech terms. Explain it like you're describing it to a friend who doesn't code.

**How it works**
2-3 bullet points on the technical approach: key tech stack choices, architecture decisions, how the main pieces fit together.

**Next steps**
2-3 bullet points on what a developer should work on next, based on what appears unfinished, missing, or worth improving in the codebase.

Be specific and concrete. No filler.

${context}`,
      }],
    });

    const summary = msg.content[0]?.type === "text" ? msg.content[0].text.trim() : "";
    return NextResponse.json({ summary } satisfies SummarizeResult);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Summarization failed.";
    return NextResponse.json({ error: message } satisfies SummarizeResult, { status: 500 });
  }
});