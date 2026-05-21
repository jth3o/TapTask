import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import { GenerateRequest, GenerateResponse, RoadmapItem, RawFeature, RawGoal } from "@/lib/ideaTypes";
import { extractArray, extractObject } from "@/lib/extractJSON";

const MODEL_FAST = "claude-haiku-4-5-20251001";
const MODEL_QUALITY = "claude-sonnet-4-6";

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
        model: MODEL_FAST,
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
        model: MODEL_FAST,
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
        model: MODEL_FAST,
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
        model: MODEL_FAST,
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
        model: MODEL_QUALITY,
        max_tokens: 600,
        messages: [{
          role: "user",
          content: `Score this web page on 4 dimensions (0-10 each), where 10 means an AI coding agent could start building immediately with no ambiguity.\n\nDimensions:\n- problemClarity: Is the problem specific and well-defined for a concrete user?\n- userAlignment: Do the target user and MVP match — would this user actually use this?\n- mvpScope: Is the MVP tightly scoped, or does it have hidden scope creep?\n- feasibility: Is there enough detail for an agent to build the first screen today?\n\nWeb page:\n${ctx}\n\nReturn ONLY a JSON object, no markdown: {"score":<overall avg 0-10>,"breakdown":{"problemClarity":<0-10>,"userAlignment":<0-10>,"mvpScope":<0-10>,"feasibility":<0-10>},"feedback":"<1-2 sentences identifying the single biggest gap>"}`,
        }],
      });
      const text = msg.content[0]?.type === "text" ? msg.content[0].text.trim() : '{"score":0,"feedback":"","breakdown":{"problemClarity":0,"userAlignment":0,"mvpScope":0,"feasibility":0}}';
      const parsed = extractObject<{ score: number; feedback: string; breakdown: { problemClarity: number; userAlignment: number; mvpScope: number; feasibility: number } }>(text);
      return NextResponse.json({ action, result: parsed } as GenerateResponse);
    }

    if (action === "features") {
      const tg = body.targetGoal;
      const cc = body.cycleContext;
      const existing = body.existingFeatures ?? [];
      const doneList = existing.filter((f) => f.status === "done").map((f) => f.title);
      const inProgressList = existing.filter((f) => f.status === "in_progress").map((f) => f.title);
      const plannedList = existing.filter((f) => f.status === "backlog").map((f) => f.title);

      const cycleBlock = cc
        ? `\n\nActive cycle context — generate ONLY what is needed for this cycle, nothing beyond it:\nCycle goal: ${cc.goal}\n${cc.logicSummary ? `What to build: ${cc.logicSummary}` : ""}\n${cc.evaluationSignal ? `Evaluation signal: ${cc.evaluationSignal}` : ""}`
        : "";

      const doneBlock = doneList.length
        ? `\n\nALREADY BUILT — do not suggest these under any circumstances:\n${doneList.map((t) => `- ${t}`).join("\n")}`
        : "";
      const inProgressBlock = inProgressList.length
        ? `\n\nIN PROGRESS — do not duplicate, only suggest if a meaningfully different piece is still missing:\n${inProgressList.map((t) => `- ${t}`).join("\n")}`
        : "";
      const plannedBlock = plannedList.length
        ? `\n\nALREADY PLANNED — do not recreate:\n${plannedList.map((t) => `- ${t}`).join("\n")}`
        : "";

      const scopeInstruction = cc
        ? `Generate only the features still missing to achieve the cycle goal and evaluation signal above. Prefer the minimum needed — if 1-2 features are enough, return 1-2. Do not suggest features for future cycles.`
        : tg
          ? `Generate 3-5 features that together fully implement the goal "${tg.title}"${tg.description ? ` — ${tg.description}` : ""}, and nothing else.`
          : `Generate 4-6 top-level product features for the MVP.`;

      const msg = await client.messages.create({
        model: MODEL_QUALITY,
        max_tokens: 4000,
        messages: [{
          role: "user",
          content: `Given this app:\n${ctx}${cycleBlock}${doneBlock}${inProgressBlock}${plannedBlock}\n\n${scopeInstruction} Each feature must directly serve the target user. For features complex enough to need breakdown (multiple distinct UI interactions), also generate 2-3 sub-features as children using parentIndex. Simple single-interaction features do NOT need sub-features. Assign priority: "must" for required-this-cycle, "should" for important-but-deferrable, "could" for nice-to-have. Return ONLY a flat JSON array, no markdown:\n[{"parentIndex":-1,"title":"short name","description":"1-2 sentences","placement":"where in the app UI","accessPath":"how to navigate there","taskType":"new_feature","suggestedAgent":"cursor","acceptanceCriteria":["criterion"],"nonGoals":["not this"],"priority":"must"}]`,
        }],
      });
      const text = msg.content[0]?.type === "text" ? msg.content[0].text.trim() : "[]";
      return NextResponse.json({ action, result: extractArray<RawFeature>(text) } as GenerateResponse);
    }

    if (action === "sub_features") {
      const pf = body.parentFeature;
      if (!pf) return NextResponse.json({ error: "parentFeature required" } as GenerateResponse, { status: 400 });
      const parentCtx = `Feature: ${pf.title}\nDescription: ${pf.description}\nPlacement: ${pf.placement}`;
      const msg = await client.messages.create({
        model: MODEL_QUALITY,
        max_tokens: 2000,
        messages: [{
          role: "user",
          content: `Given this app:\n${ctx}\n\nParent feature:\n${parentCtx}\n\nGenerate 2-4 sub-features that break this feature into concrete buildable pieces. Assign priority: "must" for MVP-critical pieces, "should" for important-but-deferrable, "could" for nice-to-have. Return ONLY a JSON array, no markdown (parentIndex is always -1; caller assigns real parentId):\n[{"parentIndex":-1,"title":"sub-feature name","description":"1-2 sentences","placement":"specific screen or panel","accessPath":"tap sequence to reach it","taskType":"new_feature","suggestedAgent":"cursor","acceptanceCriteria":["criterion"],"nonGoals":["not this"],"priority":"must"}]`,
        }],
      });
      const text = msg.content[0]?.type === "text" ? msg.content[0].text.trim() : "[]";
      return NextResponse.json({ action, result: extractArray<RawFeature>(text) } as GenerateResponse);
    }

    if (action === "add_feature") {
      const userMessage = body.userMessage?.trim();
      if (!userMessage) return NextResponse.json({ error: "userMessage required" } as GenerateResponse, { status: 400 });
      const msg = await client.messages.create({
        model: MODEL_QUALITY,
        max_tokens: 2000,
        messages: [{
          role: "user",
          content: `Given this app:\n${ctx}\n\nThe user wants to add this feature: "${userMessage}"\n\nGenerate exactly 1 top-level feature for it (parentIndex: -1). If the feature is complex enough to warrant breakdown, also generate 2-3 sub-features as children (parentIndex: 0, since the root feature is at index 0). Simple, single-interaction features do NOT need sub-features. Assign priority: "must" for MVP-critical, "should" for important-but-deferrable, "could" for nice-to-have. Return ONLY a flat JSON array, no markdown:\n[{"parentIndex":-1,"title":"short name","description":"1-2 sentences","placement":"where in the app UI this lives","accessPath":"how the user navigates to it","taskType":"new_feature","suggestedAgent":"cursor","acceptanceCriteria":["criterion"],"nonGoals":["not this"],"priority":"should"}]`,
        }],
      });
      const text = msg.content[0]?.type === "text" ? msg.content[0].text.trim() : "[]";
      return NextResponse.json({ action, result: extractArray<RawFeature>(text) } as GenerateResponse);
    }

    if (action === "refine_feature") {
      const ft = body.featureToRefine;
      if (!ft) return NextResponse.json({ error: "featureToRefine required" } as GenerateResponse, { status: 400 });
      const ftCtx = [
        `Feature: ${ft.title}`,
        ft.description ? `Description: ${ft.description}` : null,
        ft.placement ? `Placement: ${ft.placement}` : null,
        ft.acceptanceCriteria.filter(Boolean).length > 0
          ? `Current criteria: ${ft.acceptanceCriteria.filter(Boolean).join("; ")}`
          : null,
        ft.nonGoals.filter(Boolean).length > 0
          ? `Current non-goals: ${ft.nonGoals.filter(Boolean).join("; ")}`
          : null,
      ].filter(Boolean).join("\n");
      const msg = await client.messages.create({
        model: MODEL_QUALITY,
        max_tokens: 800,
        messages: [{
          role: "user",
          content: `Given this app:\n${ctx}\n\nFeature to refine:\n${ftCtx}\n\nRewrite the acceptance criteria and non-goals to be concrete and implementation-ready. Each criterion should describe observable, testable behaviour — not vague intent. Non-goals should be specific things that will NOT be built in v1. Return ONLY a JSON object, no markdown:\n{"acceptanceCriteria":["<specific testable criterion>"],"nonGoals":["<specific exclusion>"]}`,
        }],
      });
      const text = msg.content[0]?.type === "text" ? msg.content[0].text.trim() : '{"acceptanceCriteria":[],"nonGoals":[]}';
      const parsed = extractObject<{ acceptanceCriteria: string[]; nonGoals: string[] }>(text);
      return NextResponse.json({ action, result: parsed } as GenerateResponse);
    }

    if (action === "success_metrics") {
      const msg = await client.messages.create({
        model: MODEL_FAST,
        max_tokens: 600,
        messages: [{
          role: "user",
          content: `Given this web page:\n${ctx}\n\nList 3-5 measurable success metrics that would tell you the MVP is working after launch. Each metric should be specific and observable — avoid vanity metrics. Return ONLY a JSON array of short strings. Example: ["50% of users complete signup without dropping off","Average session length > 3 minutes within 2 weeks of launch"]`,
        }],
      });
      const text = msg.content[0]?.type === "text" ? msg.content[0].text.trim() : "[]";
      return NextResponse.json({ action, result: extractArray<string>(text) } as GenerateResponse);
    }

    if (action === "goals") {
      const cc = body.cycleContext;
      const existing = body.existingGoals ?? [];
      const doneFeatures = (body.existingFeatures ?? []).filter((f) => f.status === "done").map((f) => f.title);
      const existingBlock = existing.length
        ? `\n\nAlready exists — do NOT recreate:\n${existing.map((g) => `- ${g}`).join("\n")}\n\nOnly return NEW task groups not already covered.`
        : "";
      const doneBlock = doneFeatures.length
        ? `\n\nFeatures already built — do not create task groups solely to cover these:\n${doneFeatures.map((t) => `- ${t}`).join("\n")}`
        : "";
      const prompt = cc
        ? `Given this app:\n${ctx}\n\nActive cycle:\nGoal: ${cc.goal}\n${cc.logicSummary ? `What to build: ${cc.logicSummary}` : ""}\n${cc.evaluationSignal ? `Evaluation signal: ${cc.evaluationSignal}` : ""}${existingBlock}${doneBlock}\n\nGenerate ONLY the task groups still needed to achieve the cycle goal and evaluation signal. Be minimal — if 1-2 groups cover what's left, return 1-2. Each group must:\n- Describe a concrete buildable outcome required for THIS cycle\n- Not duplicate work already done or already planned\n- Prefer backend/logic/data over UI polish\n\nReturn ONLY a JSON array, no markdown:\n[{"title":"Task group title","description":"1 sentence on what this group delivers"}]`
        : `Given this app:\n${ctx}${existingBlock}${doneBlock}\n\nGenerate 3-5 user goals covering the remaining MVP scope. Each goal must:\n- Start with "User can" followed by a specific, observable outcome\n- Be mutually exclusive and collectively exhaustive for what's NOT yet built\n- Be outcome-focused, not UI-area-focused\n\nReturn ONLY a JSON array, no markdown:\n[{"title":"User can X","description":"1 sentence on what this goal unlocks for the user"}]`;
      const msg = await client.messages.create({
        model: MODEL_QUALITY,
        max_tokens: 1200,
        messages: [{ role: "user", content: prompt }],
      });
      const text = msg.content[0]?.type === "text" ? msg.content[0].text.trim() : "[]";
      return NextResponse.json({ action, result: extractArray<RawGoal>(text) } as GenerateResponse);
    }

    if (action === "cycle_title") {
      const cc = body.cycleContext;
      const msg = await client.messages.create({
        model: MODEL_FAST,
        max_tokens: 100,
        messages: [{
          role: "user",
          content: `Given this app:\n${ctx}\n${cc ? `\nCycle goal: ${cc.goal}` : ""}\n\nWrite a short cycle title (3-6 words) that captures the focus of this cycle. Plain text, no quotes.`,
        }],
      });
      const text = msg.content[0]?.type === "text" ? msg.content[0].text.trim() : "";
      return NextResponse.json({ action, result: text } as GenerateResponse);
    }

    if (action === "cycle_goal") {
      const cc = body.cycleContext;
      const msg = await client.messages.create({
        model: MODEL_FAST,
        max_tokens: 200,
        messages: [{
          role: "user",
          content: `Given this app:\n${ctx}\n${cc ? `\nCycle type: ${cc.title}` : ""}\n\nWrite a single sentence cycle goal starting with "By the end of this cycle, we will know whether…" — it should describe a specific, testable learning outcome. Plain text only.`,
        }],
      });
      const text = msg.content[0]?.type === "text" ? msg.content[0].text.trim() : "";
      return NextResponse.json({ action, result: text } as GenerateResponse);
    }

    if (action === "cycle_logic") {
      const cc = body.cycleContext;
      const msg = await client.messages.create({
        model: MODEL_FAST,
        max_tokens: 250,
        messages: [{
          role: "user",
          content: `Given this app:\n${ctx}\n${cc?.goal ? `\nCycle goal: ${cc.goal}` : ""}\n\nDescribe the minimum thing to build to evaluate the cycle goal. 1-3 sentences. Prefer backend logic, data handling, and core flows over UI polish. Do not suggest dashboards, analytics, or features beyond the goal. Plain text only.`,
        }],
      });
      const text = msg.content[0]?.type === "text" ? msg.content[0].text.trim() : "";
      return NextResponse.json({ action, result: text } as GenerateResponse);
    }

    if (action === "cycle_evaluation") {
      const cc = body.cycleContext;
      const msg = await client.messages.create({
        model: MODEL_FAST,
        max_tokens: 150,
        messages: [{
          role: "user",
          content: `Given this app:\n${ctx}\n${cc?.goal ? `\nCycle goal: ${cc.goal}` : ""}${cc?.logicSummary ? `\nWhat is being built: ${cc.logicSummary}` : ""}\n\nWrite a single concrete evaluation signal — a short observable outcome that confirms the cycle goal was met (e.g. "3 users complete the flow without help", "conversion rate exceeds 20%"). Plain text only, no bullet points.`,
        }],
      });
      const text = msg.content[0]?.type === "text" ? msg.content[0].text.trim() : "";
      return NextResponse.json({ action, result: text } as GenerateResponse);
    }

    if (action === "product_summary") {
      const sc = body.summaryContext;
      const doneList = sc?.doneFeatures.length ? sc.doneFeatures.map((f) => `- ${f}`).join("\n") : "None recorded yet.";
      const inProgressList = sc?.inProgressFeatures.length ? sc.inProgressFeatures.map((f) => `- ${f}`).join("\n") : "None.";
      const goalsList = sc?.goals.length ? sc.goals.map((g) => `- ${g}`).join("\n") : "None.";
      const msg = await client.messages.create({
        model: MODEL_QUALITY,
        max_tokens: 600,
        messages: [{
          role: "user",
          content: `You are writing a short product brief for a builder reviewing their own project. Be concrete and honest — do not invent things that aren't in the data.

Project:
${ctx}

Goals:
${goalsList}

Completed features:
${doneList}

In-progress features:
${inProgressList}

Write a plain-text product summary with exactly three short sections, each starting with the section label on its own line:

WHAT'S BUILT
2-4 sentences describing what currently exists and works, based only on completed features. If nothing is done, say so plainly.

WHY IT'S USEFUL
2-3 sentences on the core value — who benefits and what problem it solves.

HOW TO USE IT
3-5 short numbered steps walking through the main user flow from the completed features. If too little is built to describe a flow, say what the next step would be.

No markdown, no bullet points outside the numbered list, no headers beyond the three labels above.`,
        }],
      });
      const text = msg.content[0]?.type === "text" ? msg.content[0].text.trim() : "";
      return NextResponse.json({ action, result: text } as GenerateResponse);
    }

    return NextResponse.json({ error: `Unknown action: ${action}` } as GenerateResponse, { status: 400 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Generation failed.";
    return NextResponse.json({ error: message } as GenerateResponse, { status: 500 });
  }
}
