// EXPERIMENTAL — powers the Labs > Business Tree section.
// Not called by the primary workflow. Kept for future use.
import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import { IdeaProject } from "@/lib/ideaTypes";
import { MarketSignal, OpportunityMap } from "@/lib/marketTypes";
import { BusinessNodeType } from "@/lib/treeTypes";
import { extractArray } from "@/lib/extractJSON";

const MODEL = "claude-haiku-4-5-20251001";

export interface RawBusinessNode {
  parentIndex: number;
  title: string;
  nodeType: BusinessNodeType;
  summary: string;
  affectedUser: string;
  pain: string;
  currentWorkaround: string;
  successDefinition: string;
}

interface BusinessTreeRequest {
  project: IdeaProject;
  marketSignal?: MarketSignal;
  opportunity?: OpportunityMap;
}

interface BusinessTreeResponse {
  nodes?: RawBusinessNode[];
  error?: string;
}

export async function POST(request: Request) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "ANTHROPIC_API_KEY is not set." } as BusinessTreeResponse,
      { status: 503 }
    );
  }

  let body: BusinessTreeRequest;
  try {
    body = (await request.json()) as BusinessTreeRequest;
  } catch {
    return NextResponse.json({ error: "Invalid request body." } as BusinessTreeResponse, { status: 400 });
  }

  const { project, marketSignal, opportunity } = body;
  const client = new Anthropic({ apiKey });

  const ctx = [
    `Project: ${project.name || "Unnamed"}`,
    project.problem ? `Problem: ${project.problem}` : null,
    project.targetUser ? `Target User: ${project.targetUser}` : null,
    project.mvpDefinition ? `MVP: ${project.mvpDefinition}` : null,
    marketSignal ? `Market Signal: ${marketSignal.signalTitle} — ${marketSignal.painCreated}` : null,
    opportunity ? `Opportunity: ${opportunity.smallestMvp}` : null,
  ].filter(Boolean).join("\n");

  const prompt = `You are helping a solo builder plan a web page product. All output should be framed around web page building — not general software, not mobile apps, not enterprise systems.

Analyze this web page and generate a business problem tree with 8-15 nodes. Focus on the real user problem, NOT marketing fluff.

Web page context:
${ctx}

Return ONLY a JSON array, no markdown:
[{"parentIndex":-1,"title":"<short title>","nodeType":"market_space|user_group|major_problem|specific_pain|current_workaround|product_promise|custom","summary":"<1-2 sentences>","affectedUser":"<who>","pain":"<specific pain>","currentWorkaround":"<what they do now>","successDefinition":"<how we know we solved it>"},...]

Rules:
- parentIndex -1 = root node (use nodeType "market_space")
- parentIndex refers to 0-based index in the array
- Build a tree: market_space → user_group → major_problem → specific_pain → current_workaround → product_promise
- Frame everything around the web page and its users
- Be specific, name real problems not abstractions
- 8-15 nodes total`;

  try {
    const msg = await client.messages.create({
      model: MODEL,
      max_tokens: 3000,
      messages: [{ role: "user", content: prompt }],
    });

    const raw = msg.content[0]?.type === "text" ? msg.content[0].text.trim() : "[]";
    const nodes = extractArray<RawBusinessNode>(raw);
    return NextResponse.json({ nodes } as BusinessTreeResponse);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Generation failed.";
    return NextResponse.json({ error: message } as BusinessTreeResponse, { status: 500 });
  }
}
