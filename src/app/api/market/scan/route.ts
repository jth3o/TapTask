import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import { ScanRequest, ScanResponse } from "@/lib/marketTypes";

const MODEL = "claude-haiku-4-5-20251001";

export async function POST(request: Request) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "ANTHROPIC_API_KEY is not set." } as ScanResponse, { status: 503 });
  }

  let body: ScanRequest;
  try {
    body = (await request.json()) as ScanRequest;
  } catch {
    return NextResponse.json({ error: "Invalid request body." } as ScanResponse, { status: 400 });
  }

  const { arenaName, excludeSignalTitles } = body;
  const client = new Anthropic({ apiKey });

  const exclusionClause = excludeSignalTitles && excludeSignalTitles.length > 0
    ? `\nDo NOT repeat these already-seen signals: ${excludeSignalTitles.map((t) => `"${t}"`).join(", ")}.`
    : "";

  // IMPORTANT: keep field values SHORT — one sentence each — to avoid token overflow.
  const prompt = `Find 4 market signals in "${arenaName}": what is shifting AND where people are actively complaining. Be specific — name real tools, companies, events. No vague trends.${exclusionClause}

Return ONLY valid JSON (no markdown, no extra text):
[{"signalTitle":"<10 words>","summary":"<2 sentences>","whatChanged":"<1 sentence>","affectedUsers":["<role>"],"painCreated":"<1 sentence>","currentWorkarounds":["<1 phrase>"],"opportunitySpace":"<1 sentence>","whyNow":"<1 sentence>","confidenceLevel":"high","sourceLinks":["<url>"],"sourceDates":["<Mon YYYY>"]},...]`;

  try {
    const msg = await client.messages.create({
      model: MODEL,
      max_tokens: 4000,
      messages: [{ role: "user", content: prompt }],
    });

    const raw = msg.content[0]?.type === "text" ? msg.content[0].text.trim() : "";

    // Find outermost JSON array boundaries
    const start = raw.indexOf("[");
    const end = raw.lastIndexOf("]");
    if (start === -1 || end <= start) {
      return NextResponse.json({ error: "Model returned no JSON array. Try again." } as ScanResponse, { status: 500 });
    }

    let signals: ScanResponse["signals"];
    try {
      signals = JSON.parse(raw.slice(start, end + 1)) as ScanResponse["signals"];
    } catch {
      // If still broken, attempt to recover by truncating at the last complete object
      const partial = raw.slice(start);
      const lastComplete = partial.lastIndexOf("},");
      if (lastComplete === -1) {
        return NextResponse.json({ error: "Could not parse market signals. Try again." } as ScanResponse, { status: 500 });
      }
      signals = JSON.parse(partial.slice(0, lastComplete + 1) + "]") as ScanResponse["signals"];
    }

    return NextResponse.json({ signals } as ScanResponse);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Scan failed.";
    return NextResponse.json({ error: message } as ScanResponse, { status: 500 });
  }
}
