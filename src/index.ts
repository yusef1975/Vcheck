import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import * as fs from "fs";
import * as fsp from "fs/promises";
import * as path from "path";

// ─────────────────────────────────────────────────────────────
// VibeCheck MCP Server v1.3.0
// Quality-gate for "Vibe Coding" — refines lazy prompts into
// high-density, context-aware, persona-driven instructions
// with history tracking, scoring, and security guardrails.
// ─────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────
// Personas Configuration
// ─────────────────────────────────────────────────────────────

interface Persona {
    name: string;
    emoji: string;
    description: string;
    expertConstraints: string[];
}

const PERSONAS: Record<string, Persona> = {
    default: {
        name: "Default",
        emoji: "🧑‍💻",
        description: "A well-rounded software engineer focused on clean, maintainable code.",
        expertConstraints: [
            "Follow SOLID principles and clean architecture patterns.",
            "Write self-documenting code with meaningful variable names.",
            "Include error handling for all edge cases.",
            "Ensure backward compatibility unless explicitly breaking.",
        ],
    },
    "senior engineer": {
        name: "Senior Engineer",
        emoji: "🏗️",
        description: "Battle-tested architect who prioritizes scalability and maintainability.",
        expertConstraints: [
            "Design for horizontal scalability from day one.",
            "Consider failure modes: what happens when this service goes down?",
            "Add comprehensive logging and observability hooks.",
            "Write code that a junior dev can understand and maintain.",
            "Consider database migration strategies for schema changes.",
            "Always think about race conditions and concurrent access.",
        ],
    },
    "product manager": {
        name: "Product Manager",
        emoji: "📊",
        description: "User-focused strategist who thinks in terms of impact and deliverables.",
        expertConstraints: [
            "Prioritize user-facing features over internal refactoring.",
            "Consider accessibility (WCAG 2.1 AA) in all UI changes.",
            "Include analytics hooks for measuring feature adoption.",
            "Define clear success metrics for this change.",
            "Think about the onboarding experience for new users.",
            "Consider internationalization requirements.",
        ],
    },
    "security auditor": {
        name: "Security Auditor",
        emoji: "🛡️",
        description: "Threat-aware specialist who finds vulnerabilities before attackers do.",
        expertConstraints: [
            "Validate and sanitize ALL user inputs — never trust client data.",
            "Check for SQL injection, XSS, and CSRF vulnerabilities.",
            "Ensure secrets are never hardcoded or logged.",
            "Implement proper authentication and authorization checks.",
            "Use parameterized queries for all database operations.",
            "Apply the principle of least privilege to all access controls.",
            "Review for path traversal and file inclusion attacks.",
            "Ensure proper CORS configuration.",
        ],
    },
    "performance specialist": {
        name: "Performance Specialist",
        emoji: "⚡",
        description: "Optimization expert who squeezes every millisecond out of the system.",
        expertConstraints: [
            "Profile before optimizing — measure, don't guess.",
            "Consider memory allocation patterns and garbage collection impact.",
            "Use lazy loading and code splitting for frontend assets.",
            "Implement caching strategies (CDN, in-memory, database query cache).",
            "Minimize database round-trips with batch operations.",
            "Consider connection pooling and resource limits.",
            "Optimize critical rendering path for web applications.",
            "Use streaming for large data sets instead of buffering.",
        ],
    },
};

// ─────────────────────────────────────────────────────────────
// Refinement Principles
// ─────────────────────────────────────────────────────────────

const REFINEMENT_PRINCIPLES = [
    "1. **SPECIFICITY** — State exactly what you want built, modified, or fixed.",
    "2. **CONTEXT** — Include relevant code snippets, error messages, or constraints.",
    "3. **CONSTRAINTS** — Specify language, framework version, style guide, or perf requirements.",
    "4. **ACCEPTANCE CRITERIA** — Define what 'done' looks like.",
    "5. **SCOPE CONTROL** — Explicitly state what should NOT be changed.",
    "6. **STRUCTURE** — Break complex tasks into numbered sub-tasks.",
];

// ─────────────────────────────────────────────────────────────
// Security Guardrails
// ─────────────────────────────────────────────────────────────

const SECURITY_PATTERNS = [
    { pattern: /disable\s*(auth|authentication|authorization)/i, flag: "🚨 Attempts to disable authentication/authorization" },
    { pattern: /bypass\s*(auth|security|login|password|verification)/i, flag: "🚨 Attempts to bypass security mechanisms" },
    { pattern: /skip\s*(validation|sanitiz|check|verify)/i, flag: "🚨 Attempts to skip input validation" },
    { pattern: /hardcode\s*(password|secret|key|token|credential)/i, flag: "🚨 Attempts to hardcode secrets" },
    { pattern: /remove\s*(csrf|cors|rate.?limit|firewall)/i, flag: "🚨 Attempts to remove security protections" },
    { pattern: /eval\s*\(|exec\s*\(|system\s*\(/i, flag: "⚠️ References dangerous code execution functions" },
    { pattern: /sudo|chmod\s+777|--no-verify/i, flag: "⚠️ Uses elevated privileges or bypasses verification" },
    { pattern: /DROP\s+TABLE|DELETE\s+FROM.*WHERE\s+1/i, flag: "🚨 Destructive database operations detected" },
];

function securityCheck(prompt: string): string[] {
    const flags: string[] = [];
    for (const { pattern, flag } of SECURITY_PATTERNS) {
        if (pattern.test(prompt)) {
            flags.push(flag);
        }
    }
    return flags;
}

// ─────────────────────────────────────────────────────────────
// Exclusion Lists
// ─────────────────────────────────────────────────────────────

const IGNORED_DIRS = new Set([
    "node_modules", ".git", "dist", ".next", ".nuxt", ".output",
    "build", "coverage", "__pycache__", ".vscode", ".idea",
    "vendor", ".turbo", ".cache", ".vibecheck",
]);

const IGNORED_EXTENSIONS = new Set([
    ".lock", ".log", ".map", ".min.js", ".min.css",
    ".ico", ".png", ".jpg", ".jpeg", ".gif", ".svg",
    ".woff", ".woff2", ".ttf", ".eot",
]);

// ─────────────────────────────────────────────────────────────
// Project Scanner
// ─────────────────────────────────────────────────────────────

function scanProjectFiles(rootDir: string, maxFiles: number = 500): string[] {
    const files: string[] = [];

    function walk(dir: string, depth: number = 0): void {
        if (files.length >= maxFiles || depth > 10) return;
        let entries: fs.Dirent[];
        try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }

        for (const entry of entries) {
            if (files.length >= maxFiles) break;
            if (entry.isDirectory()) {
                if (!IGNORED_DIRS.has(entry.name) && !entry.name.startsWith(".")) {
                    walk(path.join(dir, entry.name), depth + 1);
                }
            } else if (entry.isFile()) {
                const ext = path.extname(entry.name).toLowerCase();
                if (!IGNORED_EXTENSIONS.has(ext)) {
                    files.push(path.relative(rootDir, path.join(dir, entry.name)).replace(/\\/g, "/"));
                }
            }
        }
    }

    walk(rootDir);
    return files;
}

// ─────────────────────────────────────────────────────────────
// Context Suggestion
// ─────────────────────────────────────────────────────────────

function suggestContext(query: string, projectFiles: string[]): { matched: string[]; keywords: string[] } {
    const stopWords = new Set([
        "the", "and", "for", "that", "this", "with", "from", "are", "was",
        "will", "can", "has", "have", "not", "but", "all", "they", "been",
        "its", "into", "also", "than", "just", "how", "add", "fix", "make",
        "use", "get", "set", "new", "want", "need", "like", "some",
    ]);

    const keywords = [...new Set(
        query.toLowerCase().replace(/[^a-z0-9\s_-]/g, " ").split(/\s+/)
            .filter((w) => w.length >= 3 && !stopWords.has(w))
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

interface TechStack {
    runtime: string;
    frameworks: string[];
    dependencies: Record<string, string>;
    devDependencies: Record<string, string>;
    source: string;
}

function detectTechStack(projectRoot: string): TechStack | null {
    const packageJsonPath = path.join(projectRoot, "package.json");
    if (fs.existsSync(packageJsonPath)) {
        try {
            const pkg = JSON.parse(fs.readFileSync(packageJsonPath, "utf-8"));
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
        } catch { /* skip */ }
    }

    const reqPath = path.join(projectRoot, "requirements.txt");
    if (fs.existsSync(reqPath)) {
        try {
            const raw = fs.readFileSync(reqPath, "utf-8");
            const deps: Record<string, string> = {};
            const frameworks: string[] = [];
            for (const line of raw.split("\n")) {
                const t = line.trim();
                if (!t || t.startsWith("#")) continue;
                const m = t.match(/^([a-zA-Z0-9_-]+)\s*([><=!~]+\s*[\d.]+)?/);
                if (m) deps[m[1]] = m[2]?.trim() || "latest";
            }
            const pyFw: Record<string, string> = { django: "Django", flask: "Flask", fastapi: "FastAPI", pytorch: "PyTorch", tensorflow: "TensorFlow" };
            for (const [p, n] of Object.entries(pyFw)) { if (deps[p]) frameworks.push(`${n} (${deps[p]})`); }
            return { runtime: "Python", frameworks, dependencies: deps, devDependencies: {}, source: "requirements.txt" };
        } catch { /* skip */ }
    }

    const goModPath = path.join(projectRoot, "go.mod");
    if (fs.existsSync(goModPath)) {
        try {
            const raw = fs.readFileSync(goModPath, "utf-8");
            const deps: Record<string, string> = {};
            for (const line of raw.split("\n")) {
                const m = line.trim().match(/^([\w./\-]+)\s+(v[\d.]+)/);
                if (m) deps[m[1]] = m[2];
            }
            return { runtime: "Go", frameworks: [], dependencies: deps, devDependencies: {}, source: "go.mod" };
        } catch { /* skip */ }
    }

    return null;
}

function checkDependency(lib: string, ts: TechStack): { found: boolean; version: string | null; isDev: boolean } {
    const ln = lib.toLowerCase();
    for (const [d, v] of Object.entries(ts.dependencies)) { if (d.toLowerCase() === ln) return { found: true, version: v, isDev: false }; }
    for (const [d, v] of Object.entries(ts.devDependencies)) { if (d.toLowerCase() === ln) return { found: true, version: v, isDev: true }; }
    return { found: false, version: null, isDev: false };
}

function extractMentionedLibraries(prompt: string): string[] {
    const known = [
        "react", "vue", "angular", "svelte", "next", "nuxt", "express",
        "fastify", "nestjs", "electron", "typescript", "zod", "prisma",
        "drizzle", "tailwind", "tailwindcss", "sass", "webpack", "vite",
        "rollup", "jest", "vitest", "mocha", "cypress", "playwright",
        "django", "flask", "fastapi", "pytorch", "tensorflow", "pandas",
        "numpy", "redis", "mongodb", "postgres", "mysql", "sqlite",
        "docker", "kubernetes", "graphql", "apollo", "trpc",
    ];
    const lp = prompt.toLowerCase();
    return known.filter((lib) => lp.includes(lib));
}

// ─────────────────────────────────────────────────────────────
// Prompt Scoring System
// ─────────────────────────────────────────────────────────────

interface VibeScore {
    total: number;
    specificity: number;
    contextAvailability: number;
    acceptanceCriteria: number;
    personaAlignment: number;
    breakdown: string;
}

function scoreVibe(prompt: string, personaKey?: string, projectRoot?: string): VibeScore {
    let specificity = 0;
    let contextAvailability = 0;
    let acceptanceCriteria = 0;
    let personaAlignment = 0;

    // ── Specificity (30 pts) ──
    if (prompt.length > 200) specificity += 10;
    else if (prompt.length > 100) specificity += 5;
    else if (prompt.length > 50) specificity += 2;

    if (/\.(ts|js|py|go|rs|tsx|jsx|css|html)/i.test(prompt)) specificity += 10;
    if (/function|class|method|component|api|endpoint/i.test(prompt)) specificity += 5;
    if (/line\s*\d+|L\d+/i.test(prompt)) specificity += 5;

    // ── Context Availability (30 pts) ──
    if (projectRoot) {
        try {
            const files = scanProjectFiles(projectRoot);
            const { matched } = suggestContext(prompt, files);
            if (matched.length > 5) contextAvailability += 15;
            else if (matched.length > 0) contextAvailability += 10;
        } catch { /* skip */ }
    }

    if (/```[\s\S]+```/.test(prompt)) contextAvailability += 10;
    if (/error|stack\s*trace|exception/i.test(prompt)) contextAvailability += 5;
    if (/import|require|from\s+['"]/.test(prompt)) contextAvailability += 5;

    // ── Acceptance Criteria (20 pts) ──
    if (/should|must|expect|return|output/i.test(prompt)) acceptanceCriteria += 8;
    if (/test|spec|assert|verify/i.test(prompt)) acceptanceCriteria += 7;
    if (/when.*then|given.*when/i.test(prompt)) acceptanceCriteria += 5;

    // ── Persona Alignment (20 pts) ──
    const persona = PERSONAS[personaKey?.toLowerCase() || "default"] || PERSONAS["default"];
    const promptLower = prompt.toLowerCase();

    for (const constraint of persona.expertConstraints) {
        const words = constraint.toLowerCase().split(/\s+/).filter((w) => w.length > 4);
        const matchCount = words.filter((w) => promptLower.includes(w)).length;
        if (matchCount > 0) personaAlignment += Math.min(5, matchCount * 2);
    }

    personaAlignment = Math.min(20, personaAlignment);

    // Clamp individual scores
    specificity = Math.min(30, specificity);
    contextAvailability = Math.min(30, contextAvailability);
    acceptanceCriteria = Math.min(20, acceptanceCriteria);

    const total = specificity + contextAvailability + acceptanceCriteria + personaAlignment;

    let badge: string;
    if (total >= 80) badge = "🏆 ELITE";
    else if (total >= 60) badge = "✅ STRONG";
    else if (total >= 40) badge = "⚡ DECENT";
    else if (total >= 20) badge = "⚠️ WEAK";
    else badge = "❌ LAZY";

    const breakdown = [
        `| Category | Score | Max |`,
        `|----------|-------|-----|`,
        `| 🎯 Specificity | ${specificity} | 30 |`,
        `| 📂 Context | ${contextAvailability} | 30 |`,
        `| ✅ Acceptance Criteria | ${acceptanceCriteria} | 20 |`,
        `| ${persona.emoji} Persona Alignment | ${personaAlignment} | 20 |`,
        `| **${badge}** | **${total}** | **100** |`,
    ].join("\n");

    return { total, specificity, contextAvailability, acceptanceCriteria, personaAlignment, breakdown };
}

// ─────────────────────────────────────────────────────────────
// History Tracking
// ─────────────────────────────────────────────────────────────

interface HistoryEntry {
    timestamp: string;
    persona: string;
    rawPrompt: string;
    refinedPrompt: string;
    vibeScore: number;
    securityFlags: string[];
}

async function logHistory(entry: HistoryEntry, projectRoot: string): Promise<void> {
    const historyDir = path.join(projectRoot, ".vibecheck");
    const historyFile = path.join(historyDir, "history.json");

    try {
        await fsp.mkdir(historyDir, { recursive: true });

        let history: HistoryEntry[] = [];
        try {
            const raw = await fsp.readFile(historyFile, "utf-8");
            history = JSON.parse(raw);
        } catch {
            // File doesn't exist yet, start fresh
        }

        history.push(entry);
        await fsp.writeFile(historyFile, JSON.stringify(history, null, 2), "utf-8");
    } catch (err) {
        console.error("Failed to log history:", err);
    }
}

// ─────────────────────────────────────────────────────────────
// Prompt Refinement Engine (v4)
// ─────────────────────────────────────────────────────────────

function refinePrompt(rawPrompt: string, projectRoot?: string, personaKey?: string): string {
    const sections: string[] = [];
    const persona = PERSONAS[personaKey?.toLowerCase() || "default"] || PERSONAS["default"];

    // ── Security Check ──
    const secFlags = securityCheck(rawPrompt);

    // ── Vibe Score ──
    const score = scoreVibe(rawPrompt, personaKey, projectRoot);

    sections.push(`# 🎯 VibeCheck — Refined Prompt\n`);
    sections.push(`> *v1.3.0 | ${persona.emoji} ${persona.name} | Vibe Score: **${score.total}/100***\n`);

    // Security warnings (if any)
    if (secFlags.length > 0) {
        sections.push(`## 🔒 Security Alert\n`);
        sections.push(`> **WARNING:** This prompt contains potentially dangerous instructions.\n`);
        secFlags.forEach((f) => sections.push(`- ${f}`));
        sections.push(`\n> Please review and ensure these are intentional before executing.\n`);
    }

    // Vibe Score badge
    sections.push(`## 📊 Vibe Score\n`);
    sections.push(score.breakdown);
    sections.push("");

    // Persona constraints
    sections.push(`## ${persona.emoji} Expert Constraints (${persona.name})\n`);
    sections.push(`*${persona.description}*\n`);
    persona.expertConstraints.forEach((c, i) => sections.push(`${i + 1}. ${c}`));
    sections.push("");

    // Coding standards
    sections.push("## 📋 Coding Standards\n");
    sections.push(REFINEMENT_PRINCIPLES.join("\n"));
    sections.push("");

    // Tech stack
    if (projectRoot) {
        const techStack = detectTechStack(projectRoot);
        if (techStack) {
            sections.push(`## 🔧 Tech Stack\n`);
            sections.push(`| Property | Value |`);
            sections.push(`|----------|-------|`);
            sections.push(`| **Runtime** | ${techStack.runtime} |`);
            if (techStack.frameworks.length > 0) {
                sections.push(`| **Frameworks** | ${techStack.frameworks.join(", ")} |`);
            }
            sections.push("");

            const mentioned = extractMentionedLibraries(rawPrompt);
            if (mentioned.length > 0) {
                sections.push("## 📦 Dependency Check\n");
                for (const lib of mentioned) {
                    const r = checkDependency(lib, techStack);
                    if (r.found) sections.push(`- ✅ **${lib}** v${r.version}${r.isDev ? " *(dev)*" : ""}`);
                    else sections.push(`- ❌ **${lib}** — **NOT installed**`);
                }
                sections.push("");
            }
        }

        // Context suggestion
        try {
            const files = scanProjectFiles(projectRoot);
            const { matched, keywords } = suggestContext(rawPrompt, files);
            if (matched.length > 0) {
                sections.push("## 📂 Recommended Context\n");
                sections.push(`*Keywords: ${keywords.map((k) => `\`${k}\``).join(", ")}*\n`);
                matched.forEach((f) => sections.push(`- \`${f}\``));
                sections.push("");
            }
        } catch { /* skip */ }
    }

    // Quality issues
    const issues: string[] = [];
    if (rawPrompt.length < 50) issues.push("⚠️ **Too Short** — Add file paths, behavior, constraints.");
    if (!/\.(ts|js|py|go|rs|tsx|jsx|css|html)/i.test(rawPrompt)) issues.push("⚠️ **No File References**");
    if (!/should|must|expect|return|output/i.test(rawPrompt)) issues.push("⚠️ **No Acceptance Criteria**");

    if (issues.length > 0) {
        sections.push("## ⚠️ Quality Issues\n");
        sections.push(issues.join("\n"));
        sections.push("");
    }

    // Original + Refined
    sections.push("## 📝 Original Prompt\n");
    sections.push(`\`\`\`\n${rawPrompt}\n\`\`\`\n`);

    sections.push("## ✨ Refined Instruction\n");
    sections.push(
        `${rawPrompt}\n\n` +
        `**📌 Checklist:**\n` +
        `- [ ] Target files identified\n` +
        `- [ ] Expected behavior defined\n` +
        `- [ ] Constraints specified\n` +
        `- [ ] Scope boundaries set`
    );

    return sections.join("\n");
}

// ─────────────────────────────────────────────────────────────
// MCP Server Setup
// ─────────────────────────────────────────────────────────────

const server = new McpServer({
    name: "vibecheck",
    version: "1.3.0",
});

// ── Tool: refine_vibe_prompt ──
server.tool(
    "refine_vibe_prompt",
    "Validates, scores, and refines a prompt with persona-driven constraints, tech-stack awareness, dependency checking, context suggestion, and security guardrails.",
    {
        prompt: z.string().describe("The raw prompt to validate and refine."),
        context: z.string().optional().describe("Optional additional context."),
        projectRoot: z.string().optional().describe("Absolute path to project root. Defaults to cwd."),
        persona: z.enum(["Default", "Senior Engineer", "Product Manager", "Security Auditor", "Performance Specialist"]).optional()
            .describe("Expert persona to apply."),
    },
    async ({ prompt, context, projectRoot, persona }) => {
        let inputPrompt = prompt;
        if (context) inputPrompt += `\n\n### Additional Context\n${context}`;

        const root = projectRoot || process.cwd();
        const refined = refinePrompt(inputPrompt, root, persona);

        // Log to history
        const score = scoreVibe(inputPrompt, persona, root);
        const secFlags = securityCheck(inputPrompt);
        await logHistory({
            timestamp: new Date().toISOString(),
            persona: persona || "Default",
            rawPrompt: inputPrompt,
            refinedPrompt: refined,
            vibeScore: score.total,
            securityFlags: secFlags,
        }, root);

        return { content: [{ type: "text" as const, text: refined }] };
    }
);

// ── Tool: suggest_vibe_context ──
server.tool(
    "suggest_vibe_context",
    "Scans the project and suggests relevant files to include in a coding prompt.",
    {
        query: z.string().describe("What you want to do."),
        projectRoot: z.string().optional().describe("Absolute path to project root."),
    },
    async ({ query, projectRoot }) => {
        const root = projectRoot || process.cwd();
        const files = scanProjectFiles(root);
        const { matched, keywords } = suggestContext(query, files);

        let output = `# 📂 Suggested Context Files\n\n`;
        output += `> Scanned **${files.length}** files | Keywords: ${keywords.map((k) => `\`${k}\``).join(", ")}\n\n`;

        if (matched.length === 0) {
            output += `No matching files found.\n`;
        } else {
            output += `| # | File |\n|---|------|\n`;
            matched.forEach((f, i) => { output += `| ${i + 1} | \`${f}\` |\n`; });
            output += `\n> 💡 Include these for better code generation.`;
        }

        return { content: [{ type: "text" as const, text: output }] };
    }
);

// ── Tool: detect_tech_stack ──
server.tool(
    "detect_tech_stack",
    "Identifies the project's frameworks, libraries, and versions from manifest files.",
    {
        projectRoot: z.string().optional().describe("Absolute path to project root."),
    },
    async ({ projectRoot }) => {
        const root = projectRoot || process.cwd();
        const ts = detectTechStack(root);

        if (!ts) {
            return { content: [{ type: "text" as const, text: "# ❌ No Tech Stack Detected\n\nNo manifest files found." }] };
        }

        let output = `# 🔧 Tech Stack Report\n\n`;
        output += `| Property | Value |\n|----------|-------|\n`;
        output += `| **Runtime** | ${ts.runtime} |\n| **Source** | \`${ts.source}\` |\n`;
        if (ts.frameworks.length > 0) output += `| **Frameworks** | ${ts.frameworks.join(", ")} |\n`;

        output += `\n## 📦 Dependencies (${Object.keys(ts.dependencies).length})\n\n`;
        output += `| Package | Version |\n|---------|--------|\n`;
        for (const [p, v] of Object.entries(ts.dependencies)) output += `| \`${p}\` | ${v} |\n`;

        if (Object.keys(ts.devDependencies).length > 0) {
            output += `\n## 🛠️ Dev Dependencies (${Object.keys(ts.devDependencies).length})\n\n`;
            output += `| Package | Version |\n|---------|--------|\n`;
            for (const [p, v] of Object.entries(ts.devDependencies)) output += `| \`${p}\` | ${v} |\n`;
        }

        return { content: [{ type: "text" as const, text: output }] };
    }
);

// ── Tool: score_vibe (new in Task 004) ──
server.tool(
    "score_vibe",
    "Scores a prompt from 1-100 based on specificity, context, acceptance criteria, and persona alignment.",
    {
        prompt: z.string().describe("The prompt to score."),
        persona: z.enum(["Default", "Senior Engineer", "Product Manager", "Security Auditor", "Performance Specialist"]).optional()
            .describe("Persona to score alignment against."),
        projectRoot: z.string().optional().describe("Absolute path to project root."),
    },
    async ({ prompt, persona, projectRoot }) => {
        const root = projectRoot || process.cwd();
        const score = scoreVibe(prompt, persona, root);
        const secFlags = securityCheck(prompt);

        let output = `# 📊 Vibe Score Report\n\n`;
        output += score.breakdown;
        output += `\n`;

        if (secFlags.length > 0) {
            output += `\n## 🔒 Security Flags\n\n`;
            secFlags.forEach((f) => { output += `- ${f}\n`; });
        }

        output += `\n## 💡 Improvement Tips\n\n`;
        if (score.specificity < 20) output += `- Add file paths, function names, and line references.\n`;
        if (score.contextAvailability < 20) output += `- Include code snippets, error messages, or stack traces.\n`;
        if (score.acceptanceCriteria < 15) output += `- Define expected output, test cases, or behavior.\n`;
        if (score.personaAlignment < 10) output += `- Align your prompt with the selected persona's concerns.\n`;

        return { content: [{ type: "text" as const, text: output }] };
    }
);

// ── Tool: refinement_loop (new in Task 004) ──
server.tool(
    "refinement_loop",
    "Takes user feedback on a refined prompt and generates an improved Version 2.",
    {
        original_prompt: z.string().describe("The original raw prompt."),
        refined_prompt: z.string().describe("The previously refined prompt."),
        feedback: z.string().describe("User's feedback on what to improve."),
        persona: z.enum(["Default", "Senior Engineer", "Product Manager", "Security Auditor", "Performance Specialist"]).optional()
            .describe("Persona to apply."),
        projectRoot: z.string().optional().describe("Absolute path to project root."),
    },
    async ({ original_prompt, refined_prompt, feedback, persona, projectRoot }) => {
        const root = projectRoot || process.cwd();
        const personaObj = PERSONAS[persona?.toLowerCase() || "default"] || PERSONAS["default"];

        let v2 = `# 🔄 Refined Prompt — Version 2\n\n`;
        v2 += `> *Iterative refinement based on user feedback*\n`;
        v2 += `> *Persona: ${personaObj.emoji} ${personaObj.name}*\n\n`;

        v2 += `## 💬 Feedback Applied\n\n`;
        v2 += `> ${feedback}\n\n`;

        v2 += `## ✨ Improved Instruction\n\n`;
        v2 += `${original_prompt}\n\n`;
        v2 += `### Adjustments Based on Feedback\n\n`;
        v2 += `${feedback}\n\n`;

        // Re-apply persona constraints
        v2 += `### ${personaObj.emoji} Expert Constraints\n\n`;
        personaObj.expertConstraints.forEach((c, i) => { v2 += `${i + 1}. ${c}\n`; });

        // Re-score
        const combinedPrompt = `${original_prompt}\n\n${feedback}`;
        const score = scoreVibe(combinedPrompt, persona, root);
        v2 += `\n## 📊 Updated Vibe Score\n\n`;
        v2 += score.breakdown;

        // Context suggestion on combined prompt
        if (root) {
            try {
                const files = scanProjectFiles(root);
                const { matched, keywords } = suggestContext(combinedPrompt, files);
                if (matched.length > 0) {
                    v2 += `\n\n## 📂 Updated Context Suggestions\n\n`;
                    v2 += `*Keywords: ${keywords.map((k) => `\`${k}\``).join(", ")}*\n\n`;
                    matched.forEach((f) => { v2 += `- \`${f}\`\n`; });
                }
            } catch { /* skip */ }
        }

        // Log iteration
        await logHistory({
            timestamp: new Date().toISOString(),
            persona: persona || "Default",
            rawPrompt: `[ITERATION] ${original_prompt}`,
            refinedPrompt: v2,
            vibeScore: score.total,
            securityFlags: securityCheck(combinedPrompt),
        }, root);

        return { content: [{ type: "text" as const, text: v2 }] };
    }
);

// ─────────────────────────────────────────────────────────────
// Start
// ─────────────────────────────────────────────────────────────

async function main() {
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error("🎯 VibeCheck MCP Server v1.3.0 is running on stdio...");
}

main().catch((error) => {
    console.error("Fatal error starting VibeCheck:", error);
    process.exit(1);
});
