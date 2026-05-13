import NextAuth from "next-auth";
import { authOptions } from "@/lib/authOptions";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const handler = NextAuth(authOptions);

export async function GET(req: Request) {
  const cookies = req.headers.get("cookie") ?? "(none)";
  console.log("[auth-debug] GET cookies:", cookies.substring(0, 500));
  return handler(req as any);
}

export async function POST(req: Request) {
  const cookies = req.headers.get("cookie") ?? "(none)";
  console.log("[auth-debug] POST cookies:", cookies.substring(0, 500));
  return handler(req as any);
}
