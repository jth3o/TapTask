import type { NextAuthOptions } from "next-auth";
import GitHubProvider from "next-auth/providers/github";

export const authOptions: NextAuthOptions = {
  secret: process.env.NEXTAUTH_SECRET,
  debug: true,
  providers: [
    GitHubProvider({
      clientId: process.env.GITHUB_CLIENT_ID ?? "",
      clientSecret: process.env.GITHUB_CLIENT_SECRET ?? "",
      authorization: {
        params: { scope: "repo user:email" },
      },
      checks: ["state"],
      token: {
        url: "https://github.com/login/oauth/access_token",
        async request(context) {
          const params = new URLSearchParams({
            client_id: context.provider.clientId as string,
            client_secret: context.provider.clientSecret as string,
            code: context.params.code as string,
            redirect_uri: context.provider.callbackUrl,
          });
          const res = await fetch("https://github.com/login/oauth/access_token", {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
            body: params,
          });
          const tokens = await res.json() as Record<string, unknown>;
          console.log("[auth-debug] GitHub token response:", JSON.stringify(tokens));
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          return { tokens: tokens as any };
        },
      },
    }),
  ],
  callbacks: {
    async signIn({ user, account }) {
      console.log("[auth-debug] signIn callback reached, user:", user?.email, "provider:", account?.provider);
      return true;
    },
    async jwt({ token, account }) {
      if (account?.access_token) {
        token.accessToken = account.access_token;
      }
      return token;
    },
    async session({ session, token }) {
      (session as { accessToken?: string }).accessToken = token.accessToken as string | undefined;
      return session;
    },
  },
  pages: {
    signIn: "/signin",
  },
};
