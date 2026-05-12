"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function MobileHeader() {
  const pathname = usePathname();
  const onIdeas = pathname.startsWith("/ideas");
  const onMarket = pathname.startsWith("/market");
  const onBuild = !onIdeas && !onMarket;

  return (
    <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/95 backdrop-blur">
      <div className="flex items-center justify-between px-4 py-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900">TapTask</h1>
          <p className="text-xs text-slate-500">Execution cockpit for AI coding agents.</p>
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
  );
}
