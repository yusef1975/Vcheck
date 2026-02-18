import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import * as fs from "fs";
import * as path from "path";

// ─────────────────────────────────────────────────────────────
// VibeCheck MCP Server v1.2.0
// Quality-gate for "Vibe Coding" — refines lazy prompts into
// high-density, context-aware, persona-driven instructions.
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
    "1. **SPECIFICITY** — State exactly what you want built, modified, or fixed. Reference file paths, function names, and line numbers.",
    "2. **CONTEXT** — Include relevant code snippets, error messages, or architectural constraints.",
    "3. **CONSTRAINTS** — Specify language, framework version, style guide, or performance requirements.",
    "4. **ACCEPTANCE CRITERIA** — Define what 'done' looks like: expected output, test cases, or UI behavior.",
    "5. **SCOPE CONTROL** — Explicitly state what should NOT be changed.",
    "6. **STRUCTURE** — Break complex tasks into numbered sub-tasks with clear dependencies.",
];

// ─────────────────────────────────────────────────────────────
// Exclusion Lists for Project Scanning
// ─────────────────────────────────────────────────────────────

const IGNORED_DIRS = new Set([
    "node_modules", ".git", "dist", ".next", ".nuxt", ".output",
    "build", "coverage", "__pycache__", ".vscode", ".idea",
    "vendor", ".turbo", ".cache",
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
        try {
            entries = fs.readdirSync(dir, { withFileTypes: true });
        } catch {
            return;
        }

        for (const entry of entries) {
            if (files.length >= maxFiles) break;

            if (entry.isDirectory()) {
                if (!IGNORED_DIRS.has(entry.name) && !entry.name.startsWith(".")) {
                    walk(path.join(dir, entry.name), depth + 1);
                }
            } else if (entry.isFile()) {
                const ext = path.extname(entry.name).toLowerCase();
                if (!IGNORED_EXTENSIONS.has(ext)) {
                    const relativePath = path.relative(rootDir, path.join(dir, entry.name));
                    files.push(relativePath.replace(/\\/g, "/"));
                }
            }
        }
    }

    walk(rootDir);
    return files;
}

// ─────────────────────────────────────────────────────────────
// Context Suggestion Engine
// ─────────────────────────────────────────────────────────────

function suggestContext(
    query: string,
    projectFiles: string[]
): { matched: string[]; keywords: string[] } {
    const stopWords = new Set([
        "the", "and", "for", "that", "this", "with", "from", "are", "was",
        "will", "can", "has", "have", "not", "but", "all", "they", "been",
        "its", "into", "also", "than", "just", "how", "add", "fix", "make",
        "use", "get", "set", "new", "want", "need", "like", "some",
    ]);

    const keywords = query
        .toLowerCase()
        .replace(/[^a-z0-9\s_-]/g, " ")
        .split(/\s+/)
        .filter((w) => w.length >= 3 && !stopWords.has(w));

    const uniqueKeywords = [...new Set(keywords)];

    const scored = projectFiles
        .map((filePath) => {
            const lowerPath = filePath.toLowerCase();
            const basename = path.basename(filePath).toLowerCase();
            let score = 0;

            for (const keyword of uniqueKeywords) {
                if (basename.includes(keyword)) score += 3;
                else if (lowerPath.includes(keyword)) score += 1;
            }

            return { filePath, score };
        })
        .filter((item) => item.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, 15);

    return {
        matched: scored.map((s) => s.filePath),
        keywords: uniqueKeywords,
    };
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
    // Try package.json (Node.js / JavaScript / TypeScript)
    const packageJsonPath = path.join(projectRoot, "package.json");
    if (fs.existsSync(packageJsonPath)) {
        try {
            const raw = fs.readFileSync(packageJsonPath, "utf-8");
            const pkg = JSON.parse(raw);

            const deps: Record<string, string> = pkg.dependencies || {};
            const devDeps: Record<string, string> = pkg.devDependencies || {};
            const allDeps = { ...deps, ...devDeps };

            const frameworks: string[] = [];

            // Detect common frameworks
            const frameworkMap: Record<string, string> = {
                react: "React",
                next: "Next.js",
                vue: "Vue.js",
                nuxt: "Nuxt",
                angular: "Angular",
                svelte: "Svelte",
                express: "Express",
                fastify: "Fastify",
                nestjs: "NestJS",
                "@nestjs/core": "NestJS",
                electron: "Electron",
                "react-native": "React Native",
                typescript: "TypeScript",
                "@modelcontextprotocol/sdk": "MCP SDK",
            };

            for (const [pkg, name] of Object.entries(frameworkMap)) {
                if (allDeps[pkg]) {
                    frameworks.push(`${name} (${allDeps[pkg]})`);
                }
            }

            return {
                runtime: "Node.js",
                frameworks,
                dependencies: deps,
                devDependencies: devDeps,
                source: "package.json",
            };
        } catch {
            // Invalid JSON, skip
        }
    }

    // Try requirements.txt (Python)
    const requirementsPath = path.join(projectRoot, "requirements.txt");
    if (fs.existsSync(requirementsPath)) {
        try {
            const raw = fs.readFileSync(requirementsPath, "utf-8");
            const deps: Record<string, string> = {};
            const frameworks: string[] = [];

            for (const line of raw.split("\n")) {
                const trimmed = line.trim();
                if (!trimmed || trimmed.startsWith("#")) continue;

                const match = trimmed.match(/^([a-zA-Z0-9_-]+)\s*([><=!~]+\s*[\d.]+)?/);
                if (match) {
                    deps[match[1]] = match[2]?.trim() || "latest";
                }
            }

            const pyFrameworks: Record<string, string> = {
                django: "Django",
                flask: "Flask",
                fastapi: "FastAPI",
                pytorch: "PyTorch",
                tensorflow: "TensorFlow",
                pandas: "Pandas",
                numpy: "NumPy",
            };

            for (const [pkg, name] of Object.entries(pyFrameworks)) {
                if (deps[pkg]) frameworks.push(`${name} (${deps[pkg]})`);
            }

            return {
                runtime: "Python",
                frameworks,
                dependencies: deps,
                devDependencies: {},
                source: "requirements.txt",
            };
        } catch {
            // Skip
        }
    }

    // Try go.mod (Go)
    const goModPath = path.join(projectRoot, "go.mod");
    if (fs.existsSync(goModPath)) {
        try {
            const raw = fs.readFileSync(goModPath, "utf-8");
            const deps: Record<string, string> = {};

            for (const line of raw.split("\n")) {
                const match = line.trim().match(/^([\w./\-]+)\s+(v[\d.]+)/);
                if (match) {
                    deps[match[1]] = match[2];
                }
            }

            return {
                runtime: "Go",
                frameworks: [],
                dependencies: deps,
                devDependencies: {},
                source: "go.mod",
            };
        } catch {
            // Skip
        }
    }

    return null;
}

/**
 * Check if a specific library exists in the project dependencies
 * and return its version.
 */
function checkDependency(
    libraryName: string,
    techStack: TechStack
): { found: boolean; version: string | null; isDev: boolean } {
    const lowerName = libraryName.toLowerCase();

    for (const [dep, ver] of Object.entries(techStack.dependencies)) {
        if (dep.toLowerCase() === lowerName) {
            return { found: true, version: ver, isDev: false };
        }
    }

    for (const [dep, ver] of Object.entries(techStack.devDependencies)) {
        if (dep.toLowerCase() === lowerName) {
            return { found: true, version: ver, isDev: true };
        }
    }

    return { found: false, version: null, isDev: false };
}

/**
 * Extract library names mentioned in the prompt.
 */
function extractMentionedLibraries(prompt: string): string[] {
    const knownLibraries = [
        "react", "vue", "angular", "svelte", "next", "nuxt", "express",
        "fastify", "nestjs", "electron", "typescript", "zod", "prisma",
        "drizzle", "tailwind", "tailwindcss", "sass", "webpack", "vite",
        "rollup", "jest", "vitest", "mocha", "chai", "cypress", "playwright",
        "django", "flask", "fastapi", "pytorch", "tensorflow", "pandas",
        "numpy", "redis", "mongodb", "postgres", "mysql", "sqlite",
        "docker", "kubernetes", "graphql", "apollo", "trpc",
    ];

    const lowerPrompt = prompt.toLowerCase();
    return knownLibraries.filter((lib) => lowerPrompt.includes(lib));
}

// ─────────────────────────────────────────────────────────────
// Prompt Refinement Engine (v3 — with Personas & Tech Stack)
// ─────────────────────────────────────────────────────────────

function refinePrompt(
    rawPrompt: string,
    projectRoot?: string,
    personaKey?: string
): string {
    const sections: string[] = [];
    const persona = PERSONAS[personaKey?.toLowerCase() || "default"] || PERSONAS["default"];

    sections.push(`# 🎯 VibeCheck — Refined Prompt\n`);
    sections.push(
        `> *Refined by VibeCheck v1.2.0 | Persona: ${persona.emoji} ${persona.name}*\n`
    );

    // ── Persona Expert Constraints ──
    sections.push(`## ${persona.emoji} Expert Constraints (${persona.name})\n`);
    sections.push(`*${persona.description}*\n`);
    persona.expertConstraints.forEach((c, i) => {
        sections.push(`${i + 1}. ${c}`);
    });
    sections.push("");

    // ── Coding Standards ──
    sections.push("## 📋 Coding Standards\n");
    sections.push(REFINEMENT_PRINCIPLES.join("\n"));
    sections.push("");

    // ── Tech Stack Detection ──
    if (projectRoot) {
        const techStack = detectTechStack(projectRoot);
        if (techStack) {
            sections.push(`## 🔧 Tech Stack Detected\n`);
            sections.push(`| Property | Value |`);
            sections.push(`|----------|-------|`);
            sections.push(`| **Runtime** | ${techStack.runtime} |`);
            sections.push(`| **Source** | \`${techStack.source}\` |`);

            if (techStack.frameworks.length > 0) {
                sections.push(`| **Frameworks** | ${techStack.frameworks.join(", ")} |`);
            }
            sections.push("");

            // ── Dependency Intelligence ──
            const mentionedLibs = extractMentionedLibraries(rawPrompt);
            if (mentionedLibs.length > 0) {
                sections.push("## 📦 Dependency Check\n");
                for (const lib of mentionedLibs) {
                    const result = checkDependency(lib, techStack);
                    if (result.found) {
                        sections.push(
                            `- ✅ **${lib}** — found (v${result.version})${result.isDev ? " *(dev)*" : ""}`
                        );
                    } else {
                        sections.push(
                            `- ❌ **${lib}** — **NOT installed**. You may need to \`npm install ${lib}\` first.`
                        );
                    }
                }
                sections.push("");
            }
        }
    }

    // ── Quality Issues ──
    const issues: string[] = [];

    if (rawPrompt.length < 50) {
        issues.push(
            "⚠️ **Too Short** — This prompt lacks detail. Add file paths, expected behavior, and constraints."
        );
    }
    if (!/\.(ts|js|py|go|rs|tsx|jsx|css|html)/i.test(rawPrompt)) {
        issues.push(
            "⚠️ **No File References** — Specify which files should be modified."
        );
    }
    if (!/should|must|expect|return|output/i.test(rawPrompt)) {
        issues.push(
            "⚠️ **No Acceptance Criteria** — Define what 'done' looks like."
        );
    }

    if (issues.length > 0) {
        sections.push("## ⚠️ Quality Issues\n");
        sections.push(issues.join("\n"));
        sections.push("");
    }

    // ── Context Suggestion ──
    if (projectRoot) {
        try {
            const projectFiles = scanProjectFiles(projectRoot);
            const { matched, keywords } = suggestContext(rawPrompt, projectFiles);

            if (matched.length > 0) {
                sections.push("## 📂 Recommended Context\n");
                sections.push(
                    `*Keywords: ${keywords.map((k) => `\`${k}\``).join(", ")}*\n`
                );
                matched.forEach((f) => sections.push(`- \`${f}\``));
                sections.push("");
            }
        } catch {
            // Silently skip
        }
    }

    // ── Original + Refined ──
    sections.push("## 📝 Original Prompt\n");
    sections.push(`\`\`\`\n${rawPrompt}\n\`\`\`\n`);

    sections.push("## ✨ Refined Instruction\n");
    sections.push(
        `${rawPrompt}\n\n` +
        `**📌 Checklist before executing:**\n` +
        `- [ ] Target files/directories identified\n` +
        `- [ ] Expected output/behavior defined\n` +
        `- [ ] Constraints (framework, style, perf) specified\n` +
        `- [ ] Scope boundaries set (what NOT to change)`
    );

    return sections.join("\n");
}

// ─────────────────────────────────────────────────────────────
// MCP Server Setup
// ─────────────────────────────────────────────────────────────

const server = new McpServer({
    name: "vibecheck",
    version: "1.2.0",
});

// ── Tool: refine_vibe_prompt (enhanced with personas & tech stack) ──
server.tool(
    "refine_vibe_prompt",
    "Validates and refines a 'vibe coding' prompt with persona-driven expert constraints, tech-stack awareness, dependency checking, and context suggestion.",
    {
        prompt: z.string().describe("The raw prompt to validate and refine."),
        context: z
            .string()
            .optional()
            .describe("Optional additional context (project structure, constraints)."),
        projectRoot: z
            .string()
            .optional()
            .describe("Absolute path to the project root. Defaults to cwd."),
        persona: z
            .enum([
                "Default",
                "Senior Engineer",
                "Product Manager",
                "Security Auditor",
                "Performance Specialist",
            ])
            .optional()
            .describe("Expert persona to apply. Each persona adds specialized constraints."),
    },
    async ({ prompt, context, projectRoot, persona }) => {
        let inputPrompt = prompt;
        if (context) {
            inputPrompt += `\n\n### Additional Context\n${context}`;
        }

        const root = projectRoot || process.cwd();
        const refined = refinePrompt(inputPrompt, root, persona);

        return {
            content: [{ type: "text" as const, text: refined }],
        };
    }
);

// ── Tool: suggest_vibe_context ──
server.tool(
    "suggest_vibe_context",
    "Scans the project directory and suggests relevant files to include in a coding prompt.",
    {
        query: z.string().describe("What you want to do, e.g. 'fix the login page'."),
        projectRoot: z.string().optional().describe("Absolute path to project root. Defaults to cwd."),
    },
    async ({ query, projectRoot }) => {
        const root = projectRoot || process.cwd();
        const projectFiles = scanProjectFiles(root);
        const { matched, keywords } = suggestContext(query, projectFiles);

        let output = `# 📂 Suggested Context Files\n\n`;
        output += `> Scanned **${projectFiles.length}** files | Keywords: ${keywords.map((k) => `\`${k}\``).join(", ")}\n\n`;

        if (matched.length === 0) {
            output += `No matching files found. Try being more specific or referencing file names.\n`;
        } else {
            output += `| # | File |\n|---|------|\n`;
            matched.forEach((f, i) => {
                output += `| ${i + 1} | \`${f}\` |\n`;
            });
            output += `\n> 💡 Include these files as context for better code generation.`;
        }

        return {
            content: [{ type: "text" as const, text: output }],
        };
    }
);

// ── Tool: detect_tech_stack (new in Task 003) ──
server.tool(
    "detect_tech_stack",
    "Reads package.json, requirements.txt, or go.mod to identify the project's primary frameworks, libraries, and versions.",
    {
        projectRoot: z.string().optional().describe("Absolute path to project root. Defaults to cwd."),
    },
    async ({ projectRoot }) => {
        const root = projectRoot || process.cwd();
        const techStack = detectTechStack(root);

        if (!techStack) {
            return {
                content: [
                    {
                        type: "text" as const,
                        text: "# ❌ No Tech Stack Detected\n\nCould not find `package.json`, `requirements.txt`, or `go.mod` in the project root.",
                    },
                ],
            };
        }

        let output = `# 🔧 Tech Stack Report\n\n`;
        output += `| Property | Value |\n|----------|-------|\n`;
        output += `| **Runtime** | ${techStack.runtime} |\n`;
        output += `| **Source** | \`${techStack.source}\` |\n`;

        if (techStack.frameworks.length > 0) {
            output += `| **Frameworks** | ${techStack.frameworks.join(", ")} |\n`;
        }

        output += `\n## 📦 Dependencies (${Object.keys(techStack.dependencies).length})\n\n`;
        output += `| Package | Version |\n|---------|--------|\n`;
        for (const [pkg, ver] of Object.entries(techStack.dependencies)) {
            output += `| \`${pkg}\` | ${ver} |\n`;
        }

        if (Object.keys(techStack.devDependencies).length > 0) {
            output += `\n## 🛠️ Dev Dependencies (${Object.keys(techStack.devDependencies).length})\n\n`;
            output += `| Package | Version |\n|---------|--------|\n`;
            for (const [pkg, ver] of Object.entries(techStack.devDependencies)) {
                output += `| \`${pkg}\` | ${ver} |\n`;
            }
        }

        return {
            content: [{ type: "text" as const, text: output }],
        };
    }
);

// ─────────────────────────────────────────────────────────────
// Start
// ─────────────────────────────────────────────────────────────

async function main() {
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error("🎯 VibeCheck MCP Server v1.2.0 is running on stdio...");
}

main().catch((error) => {
    console.error("Fatal error starting VibeCheck:", error);
    process.exit(1);
});
