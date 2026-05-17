import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import { OpportunityRequest, OpportunityResponse } from "@/lib/marketTypes";
import { extractObject } from "@/lib/extractJSON";

const MODEL = "claude-sonnet-4-6";

export async function POST(request: Request) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "ANTHROPIC_API_KEY is not set." } as OpportunityResponse, { status: 503 });
  }

  let body: OpportunityRequest;
  try {
    body = (await request.json()) as OpportunityRequest;
  } catch {
    return NextResponse.json({ error: "Invalid request body." } as OpportunityResponse, { status: 400 });
  }

  const { signal, personalConstraints, personalAdvantage, arenaName } = body;
  const client = new Anthropic({ apiKey });

  const prompt = `Evaluate this market opportunity for a solo builder. Be honest — score 70+ only when genuinely strong.

Arena: ${arenaName}
Signal: ${signal.signalTitle}
Pain: ${signal.painCreated}
Workarounds: ${signal.currentWorkarounds.join("; ")}
Opportunity: ${signal.opportunitySpace}
${personalConstraints ? `Constraints: ${personalConstraints}` : ""}
${personalAdvantage ? `Advantage: ${personalAdvantage}` : ""}

Scores (0-100): marketMomentum, painIntensity, userAccessibility, mvpSimplicity, personalAdvantage (20 if none stated), distributionPath, expansionPotential.
opportunityScore = weighted avg toward momentum/pain/distribution.
buildNowScore = weighted avg toward simplicity/advantage/accessibility.
Verdict: build_now (buildNow>=70 AND opp>=60), prototype_next (buildNow>=55 OR opp>=65), watch_market, too_big_for_now (simplicity<40 OR advantage<30), skip (opp<40).

Return ONLY a JSON object, no markdown:
{"userWorkflow":"<1 sentence>","painPoints":["<pain>"],"productAngles":["<angle>","<angle>"],"smallestMvp":"<1 sentence>","whatNotToBuild":["<item>"],"firstUserTest":"<1 sentence>","distributionTest":"<1 sentence>","taptaskFeasibilityNotes":"<1 sentence>","scores":{"marketMomentum":0,"painIntensity":0,"userAccessibility":0,"mvpSimplicity":0,"personalAdvantage":0,"distributionPath":0,"expansionPotential":0,"opportunityScore":0,"buildNowScore":0},"verdict":"watch_market","verdictReason":"<1 sentence>"}`;

  try {
    const msg = await client.messages.create({
      model: MODEL,
      max_tokens: 2000,
      messages: [{ role: "user", content: prompt }],
    });

    const text = msg.content[0]?.type === "text" ? msg.content[0].text.trim() : "{}";
    const opportunity = extractObject<OpportunityResponse["opportunity"]>(text);
    return NextResponse.json({ opportunity } as OpportunityResponse);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Opportunity mapping failed.";
    return NextResponse.json({ error: message } as OpportunityResponse, { status: 500 });
  }
}
