import NextAuth from "next-auth";
import { authOptions } from "@/lib/authOptions";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const handler = NextAuth(authOptions);

export async function GET(req: Request, ctx: any) {
  console.log("[auth-debug] GET cookies:", req.headers.get("cookie")?.substring(0, 500) ?? "(none)");
  return handler(req as any, ctx);
}

export async function POST(req: Request, ctx: any) {
  console.log("[auth-debug] POST cookies:", req.headers.get("cookie")?.substring(0, 500) ?? "(none)");
  return handler(req as any, ctx);
}
