import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/authOptions";
import { withGitHubToken } from "@/lib/github";

type RouteHandler<T extends Request | void = Request> = (request: T) => Promise<Response>;

// Wraps an API route handler with auth. Injects the GitHub access token
// from the session into the per-request AsyncLocalStorage used by github.ts.
export function withAuth<T extends Request | void = Request>(handler: RouteHandler<T>): RouteHandler<T> {
  return async (request: T) => {
    const session = await getServerSession(authOptions);
    const token = (session as { accessToken?: string } | null)?.accessToken
      ?? process.env.GITHUB_TOKEN;

    if (!token) {
      return NextResponse.json({ error: "Unauthorized. Please sign in." }, { status: 401 });
    }

    return withGitHubToken(token, () => handler(request));
  };
}
