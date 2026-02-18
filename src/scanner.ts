import * as fsp from "fs/promises";
import * as path from "path";
import type { VibeCheckConfig } from "./config.js";
import { DEFAULT_CONFIG } from "./config.js";

// ─────────────────────────────────────────────────────────────
// Project Scanner (async)
// ─────────────────────────────────────────────────────────────

export async function scanProjectFiles(rootDir: string, config: VibeCheckConfig = {}): Promise<string[]> {
    const ignoredDirs = new Set(config.ignoredDirs || DEFAULT_CONFIG.ignoredDirs!);
    const ignoredExts = new Set(config.ignoredExtensions || DEFAULT_CONFIG.ignoredExtensions!);
    const maxFiles = config.maxScanFiles || DEFAULT_CONFIG.maxScanFiles!;
    const maxDepth = config.maxScanDepth || DEFAULT_CONFIG.maxScanDepth!;
    const files: string[] = [];

    // Resolve to absolute to prevent escaping project root
    const resolvedRoot = path.resolve(rootDir);

    async function walk(dir: string, depth: number = 0): Promise<void> {
        if (files.length >= maxFiles || depth > maxDepth) return;

        // Boundary check: ensure we're still inside the project root
        const resolvedDir = path.resolve(dir);
        if (!resolvedDir.startsWith(resolvedRoot)) return;

        let entries: import("fs").Dirent<string>[];
        try { entries = await fsp.readdir(dir, { withFileTypes: true, encoding: "utf-8" }) as import("fs").Dirent<string>[]; } catch { return; }

        for (const entry of entries) {
            if (files.length >= maxFiles) break;
            if (entry.isDirectory()) {
                if (!ignoredDirs.has(entry.name) && !entry.name.startsWith(".")) {
                    await walk(path.join(dir, entry.name), depth + 1);
                }
            } else if (entry.isFile()) {
                const ext = path.extname(entry.name).toLowerCase();
                if (!ignoredExts.has(ext)) {
                    files.push(path.relative(resolvedRoot, path.join(dir, entry.name)).replace(/\\/g, "/"));
                }
            }
        }
    }

    await walk(resolvedRoot);
    return files;
}

// ─────────────────────────────────────────────────────────────
// Context Suggestion
// ─────────────────────────────────────────────────────────────

const STOP_WORDS = new Set([
    "the", "and", "for", "that", "this", "with", "from", "are", "was",
    "will", "can", "has", "have", "not", "but", "all", "they", "been",
    "its", "into", "also", "than", "just", "how", "add", "fix", "make",
    "use", "get", "set", "new", "want", "need", "like", "some",
]);

export function suggestContext(query: string, projectFiles: string[]): { matched: string[]; keywords: string[] } {
    const keywords = [...new Set(
        query.toLowerCase().replace(/[^a-z0-9\s_-]/g, " ").split(/\s+/)
            .filter((w) => w.length >= 3 && !STOP_WORDS.has(w))
    )];

    const scored = projectFiles
        .map((fp) => {
            const lp = fp.toLowerCase();
            const bn = path.basename(fp).toLowerCase();
            let score = 0;
            for (const k of keywords) {
                if (bn.includes(k)) score += 3;
                else if (lp.includes(k)) score += 1;
            }
            return { filePath: fp, score };
        })
        .filter((i) => i.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, 15);

    return { matched: scored.map((s) => s.filePath), keywords };
}

// ─────────────────────────────────────────────────────────────
// Tech-Stack Discovery
// ─────────────────────────────────────────────────────────────

export interface TechStack {
    runtime: string;
    frameworks: string[];
    dependencies: Record<string, string>;
    devDependencies: Record<string, string>;
    source: string;
}

export async function detectTechStack(projectRoot: string): Promise<TechStack | null> {
    const packageJsonPath = path.join(projectRoot, "package.json");
    try {
        const raw = await fsp.readFile(packageJsonPath, "utf-8");
        const pkg = JSON.parse(raw);
        const deps: Record<string, string> = pkg.dependencies || {};
        const devDeps: Record<string, string> = pkg.devDependencies || {};
        const allDeps = { ...deps, ...devDeps };
        const frameworks: string[] = [];

        const frameworkMap: Record<string, string> = {
            react: "React", next: "Next.js", vue: "Vue.js", nuxt: "Nuxt",
            angular: "Angular", svelte: "Svelte", express: "Express",
            fastify: "Fastify", "@nestjs/core": "NestJS", electron: "Electron",
            "react-native": "React Native", typescript: "TypeScript",
            "@modelcontextprotocol/sdk": "MCP SDK",
        };

        for (const [p, name] of Object.entries(frameworkMap)) {
            if (allDeps[p]) frameworks.push(`${name} (${allDeps[p]})`);
        }

        return { runtime: "Node.js", frameworks, dependencies: deps, devDependencies: devDeps, source: "package.json" };
    } catch { /* not found or invalid */ }

    const reqPath = path.join(projectRoot, "requirements.txt");
    try {
        const raw = await fsp.readFile(reqPath, "utf-8");
        const deps: Record<string, string> = {};
        const frameworks: string[] = [];
        for (const line of raw.split("\n")) {
            const t = line.trim();
            if (!t || t.startsWith("#")) continue;
            const m = t.match(/^([a-zA-Z0-9_-]+)\s*([><=!~]+\s*[\d.]+)?/);
            if (m) deps[m[1]] = m[2]?.trim() || "latest";
        }
        const pyFw: Record<string, string> = { django: "Django", flask: "Flask", fastapi: "FastAPI" };
        for (const [p, n] of Object.entries(pyFw)) { if (deps[p]) frameworks.push(`${n} (${deps[p]})`); }
        return { runtime: "Python", frameworks, dependencies: deps, devDependencies: {}, source: "requirements.txt" };
    } catch { /* not found or invalid */ }

    const goModPath = path.join(projectRoot, "go.mod");
    try {
        const raw = await fsp.readFile(goModPath, "utf-8");
        const deps: Record<string, string> = {};
        for (const line of raw.split("\n")) {
            const m = line.trim().match(/^([\w./\-]+)\s+(v[\d.]+)/);
            if (m) deps[m[1]] = m[2];
        }
        return { runtime: "Go", frameworks: [], dependencies: deps, devDependencies: {}, source: "go.mod" };
    } catch { /* not found or invalid */ }

    return null;
}

export function checkDependency(lib: string, ts: TechStack): { found: boolean; version: string | null; isDev: boolean } {
    const ln = lib.toLowerCase();
    for (const [d, v] of Object.entries(ts.dependencies)) { if (d.toLowerCase() === ln) return { found: true, version: v, isDev: false }; }
    for (const [d, v] of Object.entries(ts.devDependencies)) { if (d.toLowerCase() === ln) return { found: true, version: v, isDev: true }; }
    return { found: false, version: null, isDev: false };
}

// Word-boundary matching to avoid false positives like "next" matching "next steps"
export function extractMentionedLibraries(prompt: string): string[] {
    const known = [
        "react", "vue", "angular", "svelte", "next.js", "nextjs", "nuxt", "express",
        "fastify", "nestjs", "electron", "typescript", "zod", "prisma",
        "drizzle", "tailwind", "tailwindcss", "sass", "webpack", "vite",
        "rollup", "jest", "vitest", "mocha", "cypress", "playwright",
        "django", "flask", "fastapi", "pytorch", "tensorflow", "pandas",
        "numpy", "redis", "mongodb", "postgres", "mysql", "sqlite",
        "docker", "kubernetes", "graphql", "apollo", "trpc",
    ];
    const lp = prompt.toLowerCase();
    return known.filter((lib) => {
        // Use word boundary: lib must be surrounded by non-alpha chars or start/end of string
        const escaped = lib.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        return new RegExp(`(?:^|[\\s,;:'"\\(\\[/])${escaped}(?:$|[\\s,;:'"\\)\\]/\\.])`, "i").test(lp);
    });
}
