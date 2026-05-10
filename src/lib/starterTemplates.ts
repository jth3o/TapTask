import { ProjectType } from "./types";

export interface TemplateFile {
  path: string;
  content: string;
}

function gitignore(extras: string[] = []): string {
  return [
    "node_modules/",
    "dist/",
    ".next/",
    "out/",
    ".env",
    ".env.local",
    ".env*.local",
    "*.log",
    ".DS_Store",
    ...extras,
  ].join("\n");
}

// ─── Web Page (Next.js 15 + TypeScript + Tailwind) ───────────────────────────

function webPageFiles(name: string, description: string): TemplateFile[] {
  const slug = name.toLowerCase().replace(/\s+/g, "-");
  return [
    {
      path: "package.json",
      content: JSON.stringify({
        name: slug,
        version: "0.1.0",
        private: true,
        scripts: { dev: "next dev", build: "next build", start: "next start", lint: "next lint" },
        dependencies: { next: "^15.0.0", react: "^19.0.0", "react-dom": "^19.0.0" },
        devDependencies: {
          typescript: "^5",
          "@types/node": "^20",
          "@types/react": "^19",
          "@types/react-dom": "^19",
          tailwindcss: "^3.4",
          autoprefixer: "^10",
          postcss: "^8",
        },
      }, null, 2),
    },
    {
      path: "tsconfig.json",
      content: JSON.stringify({
        compilerOptions: {
          target: "ES2017", lib: ["dom", "dom.iterable", "esnext"],
          allowJs: true, skipLibCheck: true, strict: true,
          noEmit: true, esModuleInterop: true, module: "esnext",
          moduleResolution: "bundler", resolveJsonModule: true,
          isolatedModules: true, jsx: "preserve", incremental: true,
          plugins: [{ name: "next" }],
          paths: { "@/*": ["./src/*"] },
        },
        include: ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
        exclude: ["node_modules"],
      }, null, 2),
    },
    {
      path: "next.config.ts",
      content: `import type { NextConfig } from "next";\n\nconst nextConfig: NextConfig = {};\n\nexport default nextConfig;\n`,
    },
    {
      path: "tailwind.config.ts",
      content: `import type { Config } from "tailwindcss";\nexport default { content: ["./src/**/*.{ts,tsx}"], theme: { extend: {} }, plugins: [] } satisfies Config;\n`,
    },
    {
      path: "postcss.config.mjs",
      content: `export default { plugins: { tailwindcss: {}, autoprefixer: {} } };\n`,
    },
    {
      path: "src/app/layout.tsx",
      content: `import type { Metadata } from "next";\nimport { Inter } from "next/font/google";\nimport "./globals.css";\n\nconst inter = Inter({ subsets: ["latin"] });\n\nexport const metadata: Metadata = { title: "${name}", description: "${description || name}" };\n\nexport default function RootLayout({ children }: { children: React.ReactNode }) {\n  return (\n    <html lang="en">\n      <body className={inter.className}>{children}</body>\n    </html>\n  );\n}\n`,
    },
    {
      path: "src/app/page.tsx",
      content: `export default function Home() {\n  return (\n    <main className="mx-auto max-w-4xl px-4 py-16">\n      <section className="text-center">\n        <h1 className="text-5xl font-extrabold tracking-tight text-slate-900">${name}</h1>\n        <p className="mt-6 text-xl text-slate-500">${description || "Your tagline here."}</p>\n        <div className="mt-10 flex justify-center gap-4">\n          <a href="#" className="rounded-xl bg-blue-600 px-8 py-3 text-white font-semibold hover:bg-blue-700">Get started</a>\n          <a href="#" className="rounded-xl border border-slate-200 px-8 py-3 font-semibold text-slate-700 hover:bg-slate-50">Learn more</a>\n        </div>\n      </section>\n\n      <section className="mt-24 grid grid-cols-1 gap-8 sm:grid-cols-3">\n        {["Feature one", "Feature two", "Feature three"].map((f) => (\n          <div key={f} className="rounded-2xl border border-slate-200 p-6">\n            <h3 className="font-bold text-slate-900">{f}</h3>\n            <p className="mt-2 text-sm text-slate-500">Describe this section briefly.</p>\n          </div>\n        ))}\n      </section>\n    </main>\n  );\n}\n`,
    },
    {
      path: "src/app/globals.css",
      content: `@tailwind base;\n@tailwind components;\n@tailwind utilities;\n`,
    },
    { path: ".gitignore", content: gitignore() },
    {
      path: "README.md",
      content: `# ${name}\n\nWeb page built with TapTask.\n\n## Getting Started\n\n\`\`\`bash\nnpm install\nnpm run dev\n\`\`\`\n\n---\n*Scaffolded by TapTask*\n`,
    },
  ];
}

// ─── Public API ───────────────────────────────────────────────────────────────

export const TEMPLATE_LABELS: Record<ProjectType, string> = {
  web_page: "Next.js + Tailwind",
};

export function getStarterFiles(
  projectType: ProjectType,
  projectName: string,
  description: string
): TemplateFile[] {
  switch (projectType) {
    case "web_page":
    default:
      return webPageFiles(projectName, description);
  }
}
