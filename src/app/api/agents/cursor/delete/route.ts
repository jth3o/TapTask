import { NextResponse } from "next/server";
import { withAuth } from "@/lib/requireAuth";

export const runtime = "nodejs";

export const POST = withAuth(async (request: Request) => {
  const apiKey = process.env.CURSOR_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "CURSOR_API_KEY not configured." }, { status: 503 });
  }

  let body: { agentIds?: unknown };
  try {
    body = (await request.json()) as { agentIds?: unknown };
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  if (!Array.isArray(body.agentIds) || body.agentIds.length === 0) {
    return NextResponse.json({ error: "agentIds array is required." }, { status: 400 });
  }

  const agentIds = body.agentIds.filter((id): id is string => typeof id === "string" && id.length > 0);

  const results = await Promise.allSettled(
    agentIds.map((agentId) =>
      fetch(`https://api.cursor.com/v1/agents/${agentId}`, {
        method: "DELETE",
        headers: {
          Authorization: `Basic ${Buffer.from(`${apiKey}:`).toString("base64")}`,
        },
      })
    )
  );

  const deleted = results.filter((r) => r.status === "fulfilled").length;
  const failed = results.length - deleted;

  return NextResponse.json({ deleted, failed });
});
