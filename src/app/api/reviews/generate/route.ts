import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import { ReviewRequest, ReviewResponse, WebsiteReview, PAGE_TYPE_LABELS } from "@/lib/reviewTypes";
import { extractObject } from "@/lib/extractJSON";

const MODEL = "claude-haiku-4-5-20251001";

export async function POST(request: Request) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "ANTHROPIC_API_KEY is not set." } as ReviewResponse,
      { status: 503 }
    );
  }

  let body: ReviewRequest;
  try {
    body = (await request.json()) as ReviewRequest;
  } catch {
    return NextResponse.json({ error: "Invalid request body." } as ReviewResponse, { status: 400 });
  }

  const { pageType, targetUser, pageGoal, url, notes } = body;
  if (!url?.trim()) {
    return NextResponse.json({ error: "URL is required." } as ReviewResponse, { status: 400 });
  }

  const client = new Anthropic({ apiKey });

  const prompt = `Review this web page as a UX expert. URL: ${url}. Page type: ${PAGE_TYPE_LABELS[pageType]}. Target user: ${targetUser || "general"}. Goal: ${pageGoal || "not specified"}.${notes ? ` Context: ${notes}` : ""}

Return ONLY a JSON object, no markdown:
{"productPresentationScore":<0-100>,"firstGlanceClarityScore":<0-100>,"visualHierarchyScore":<0-100>,"ctaStrengthScore":<0-100>,"trustScore":<0-100>,"perceivedValueScore":<0-100>,"mobileUsabilityScore":<0-100>,"demoReadinessScore":<0-100>,"overallVerdict":"<2 sentences>","strongestPart":"<1 sentence>","weakestPart":"<1 sentence>","prioritizedIssues":["issue 1","issue 2","issue 3"],"recommendedChanges":[{"title":"<title>","description":"<1 sentence>","taskType":"polish_ui","suggestedAgent":"cursor"}],"launchReadiness":"public_launch|soft_launch|fix_before_launch|do_not_show"}`;

  try {
    const msg = await client.messages.create({
      model: MODEL,
      max_tokens: 2000,
      messages: [{ role: "user", content: prompt }],
    });

    const text = msg.content[0]?.type === "text" ? msg.content[0].text.trim() : "{}";
    const parsed = extractObject<Omit<WebsiteReview, "pageType" | "targetUser" | "pageGoal" | "url" | "notes">>(text);
    const review: WebsiteReview = { pageType, targetUser, pageGoal, url, notes, ...parsed };
    return NextResponse.json({ review } as ReviewResponse);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Review generation failed.";
    return NextResponse.json({ error: message } as ReviewResponse, { status: 500 });
  }
}
