"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import Image from "next/image";
import { useState } from "react";

function GuidePanel({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end" onClick={onClose}>
      <div
        className="absolute inset-0 bg-black/40"
        aria-hidden="true"
      />
      <div
        className="relative max-h-[85dvh] overflow-y-auto rounded-t-2xl bg-white px-5 py-6 space-y-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-base font-bold text-slate-900">What TapTask does</h2>
            <p className="mt-0.5 text-xs text-slate-500">Current capabilities and how to use each tab.</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-1 text-slate-400 hover:bg-slate-100"
          >
            ✕
          </button>
        </div>

        <Section title="Build" badge="Tab 1">
          <p>Describe a coding task in plain English, pick an AI agent, and send it as a GitHub issue. The agent opens a pull request — you review and merge it right here.</p>
          <Steps steps={[
            "Connect a GitHub repo via the Setup card",
            "Connect Claude, Cursor, or Codex in Agent Connections",
            "Type what you want built and tap Send",
            "Watch the agent's status update live",
            "Merge the PR from the Active Tasks panel when it's ready",
          ]} />
        </Section>

        <Section title="Ideas" badge="Tab 2">
          <p>Plan what to build before writing any code. Organize features into goals, run focused build cycles, and send features directly to Build when ready.</p>
          <Steps steps={[
            "Create a project and fill in the problem and target user",
            "Generate goals and features with the ✦ AI buttons",
            "Start a cycle — set a goal, what to build, and how you'll evaluate",
            "Tap → Build on any feature to pre-fill the Build tab",
            "Sync with your repo to see which features have open PRs",
          ]} />
        </Section>

        <Section title="Market" badge="Tab 3">
          <p>Log market signals — competitor moves, user complaints, opportunities — and convert them into product ideas in the Ideas tab.</p>
          <Steps steps={[
            "Add a signal (competitor, feedback, trend, or opportunity)",
            "Fill in what happened and who it affects",
            "Tap Convert to create an Ideas project pre-filled from the signal",
          ]} />
        </Section>

        <div className="rounded-xl border border-slate-100 bg-slate-50 px-4 py-3 text-xs text-slate-500">
          <span className="font-semibold text-slate-700">Tip:</span> The fastest path is Build → send a task → merge. Ideas and Market are for planning before you build.
        </div>
      </div>
    </div>
  );
}

function Section({ title, badge, children }: { title: string; badge: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <span className="rounded-full bg-brand/10 px-2 py-0.5 text-[10px] font-bold text-brand">{badge}</span>
        <h3 className="text-sm font-semibold text-slate-800">{title}</h3>
      </div>
      <div className="space-y-2 text-xs text-slate-600">{children}</div>
    </div>
  );
}

function Steps({ steps }: { steps: string[] }) {
  return (
    <ol className="space-y-1 pl-1">
      {steps.map((s, i) => (
        <li key={i} className="flex gap-2">
          <span className="shrink-0 font-semibold text-slate-400">{i + 1}.</span>
          <span>{s}</span>
        </li>
      ))}
    </ol>
  );
}

export function MobileHeader() {
  const pathname = usePathname();
  const onIdeas = pathname.startsWith("/ideas");
  const onMarket = pathname.startsWith("/market");
  const onBuild = !onIdeas && !onMarket;
  const { data: session } = useSession();
  const [showGuide, setShowGuide] = useState(false);

  return (
    <>
      {showGuide && <GuidePanel onClose={() => setShowGuide(false)} />}
    <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/95 backdrop-blur">
      <div className="flex items-center justify-between px-4 py-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900">TapTask</h1>
          <p className="text-xs text-slate-500">Execution cockpit for AI coding agents.</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowGuide(true)}
            className="flex h-7 w-7 items-center justify-center rounded-full border border-slate-200 text-xs font-bold text-slate-500 hover:bg-slate-50 active:bg-slate-100"
            title="How to use TapTask"
          >
            ?
          </button>
          {session?.user && (
          <button
            type="button"
            onClick={() => void signOut({ callbackUrl: "/signin" })}
            className="flex items-center gap-2 rounded-lg border border-slate-200 px-2 py-1.5 text-xs text-slate-500 hover:bg-slate-50 active:bg-slate-100"
            title={`Signed in as ${session.user.name ?? session.user.email ?? ""}. Tap to sign out.`}
          >
            {session.user.image ? (
              <Image
                src={session.user.image}
                alt={session.user.name ?? ""}
                width={20}
                height={20}
                className="rounded-full"
              />
            ) : (
              <span className="h-5 w-5 rounded-full bg-slate-200" />
            )}
            <span className="hidden sm:inline">{session.user.name ?? session.user.email}</span>
            <span className="text-slate-300">·</span>
            <span>Sign out</span>
          </button>
          )}
        </div>
      </div>
      <div className="flex border-t border-slate-100">
        <Link
          href="/"
          className={`flex-1 py-2.5 text-center text-sm font-semibold transition-colors ${
            onBuild ? "border-b-2 border-brand text-brand" : "text-slate-500 hover:text-slate-700"
          }`}
        >
          Build
        </Link>
        <Link
          href="/ideas"
          className={`flex-1 py-2.5 text-center text-sm font-semibold transition-colors ${
            onIdeas ? "border-b-2 border-brand text-brand" : "text-slate-500 hover:text-slate-700"
          }`}
        >
          Ideas
        </Link>
        <Link
          href="/market"
          className={`flex-1 py-2.5 text-center text-sm font-semibold transition-colors ${
            onMarket ? "border-b-2 border-brand text-brand" : "text-slate-500 hover:text-slate-700"
          }`}
        >
          Market
        </Link>
      </div>
    </header>
    </>
  );
}
