// NOTE: This route is also used by the primary workflow (LandingPageSection) without
// tree nodes. The selectedNodes field is optional — when empty, the spec is generated
// from project fields alone. Business/build tree integration is experimental.
import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import { IdeaProject } from "@/lib/ideaTypes";
import { BusinessNode } from "@/lib/treeTypes";
import { extractObject } from "@/lib/extractJSON";

const MODEL = "claude-haiku-4-5-20251001";

export interface RawLandingFeature {
  title: string;
  userProblem: string;
  whatItDoes: string;
  whyItMatters: string;
  successDefinition: string;
  buildDifficulty: "low" | "medium" | "high";
}

export interface RawLandingPageSpec {
  heroHeadline: string;
  heroSubheadline: string;
  targetUser: string;
  problemSection: string;
  productPromise: string;
  featureSections: RawLandingFeature[];
  workflowSteps: string[];
  mvpBoundary: string;
  primaryCta: string;
  notes: string;
}

interface LandingRequest {
  project: IdeaProject;
  selectedNodes?: BusinessNode[]; // optional — not required for the primary workflow
}

interface LandingResponse {
  spec?: RawLandingPageSpec;
  error?: string;
}

export async function POST(request: Request) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "ANTHROPIC_API_KEY is not set." } as LandingResponse,
      { status: 503 }
    );
  }

  let body: LandingRequest;
  try {
    body = (await request.json()) as LandingRequest;
  } catch {
    return NextResponse.json({ error: "Invalid request body." } as LandingResponse, { status: 400 });
  }

  const { project, selectedNodes = [] } = body;
  const client = new Anthropic({ apiKey });

  const nodesSummary = selectedNodes.map((n) =>
    `- [${n.nodeType}] ${n.title}: ${n.summary}${n.pain ? ` | Pain: ${n.pain}` : ""}`
  ).join("\n");

  const ctx = [
    `Project: ${project.name || "Unnamed"}`,
    project.problem ? `Problem: ${project.problem}` : null,
    project.targetUser ? `Target User: ${project.targetUser}` : null,
    project.mvpDefinition ? `MVP: ${project.mvpDefinition}` : null,
    selectedNodes.length > 0 ? `\nKey problem nodes:\n${nodesSummary}` : null,
  ].filter(Boolean).join("\n");

  const prompt = `Generate a landing page spec for this web page product. This is a web page — not a mobile app, not enterprise software. Be direct and honest about what it solves. No fluff.

Context:
${ctx}

Return ONLY a JSON object, no markdown:
{"heroHeadline":"<10 words max, direct claim>","heroSubheadline":"<1 sentence expanding the claim>","targetUser":"<specific user description>","problemSection":"<2-3 sentences describing the pain>","productPromise":"<1 sentence — what you guarantee>","featureSections":[{"title":"<feature name>","userProblem":"<problem this solves>","whatItDoes":"<what the feature does>","whyItMatters":"<why this matters to user>","successDefinition":"<2-3 acceptance criteria sentences, period-separated>","buildDifficulty":"<low|medium|high>"}],"workflowSteps":["<step 1>","<step 2>","<step 3>"],"mvpBoundary":"<what is and isn't in v1>","primaryCta":"<action button text>","notes":"<any important caveats>"}

Rules:
- 3-5 featureSections, each tightly tied to a real user problem
- workflowSteps: 3-5 steps showing how someone uses the product
- mvpBoundary: be explicit about scope limits
- buildDifficulty: "low" = UI-only or config, "medium" = backend + UI, "high" = external API, auth, or data pipeline
- successDefinition: write as 2-3 acceptance criteria sentences (e.g. "User can do X. System shows Y. Error case Z is handled.")`;

  try {
    const msg = await client.messages.create({
      model: MODEL,
      max_tokens: 2500,
      messages: [{ role: "user", content: prompt }],
    });

    const raw = msg.content[0]?.type === "text" ? msg.content[0].text.trim() : "{}";
    const spec = extractObject<RawLandingPageSpec>(raw);
    return NextResponse.json({ spec } as LandingResponse);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Generation failed.";
    return NextResponse.json({ error: message } as LandingResponse, { status: 500 });
  }
}
