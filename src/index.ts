import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import * as fs from "fs";
import * as path from "path";

// ─────────────────────────────────────────────────────────────
// VibeCheck MCP Server v1.1.0
// Quality-gate for "Vibe Coding" — refines lazy prompts into
// high-density, context-aware instructions.
// ─────────────────────────────────────────────────────────────

const REFINEMENT_PRINCIPLES = [
    "1. SPECIFICITY — State exactly what you want built, modified, or fixed. Reference file paths, function names, and line numbers when possible.",
    "2. CONTEXT — Include relevant code snippets, error messages, or architectural constraints so the agent doesn't guess.",
    "3. CONSTRAINTS — Specify language, framework version, style guide, or performance requirements upfront.",
    "4. ACCEPTANCE CRITERIA — Define what 'done' looks like: expected output, test cases, or UI behavior.",
    "5. SCOPE CONTROL — Explicitly state what should NOT be changed to prevent unintended side-effects.",
    "6. STRUCTURE — Break complex tasks into numbered sub-tasks with clear dependencies.",
];

const IGNORED_DIRS = new Set([
    "node_modules",
    ".git",
    "dist",
    ".next",
    ".nuxt",
    ".output",
    "build",
    "coverage",
    "__pycache__",
    ".vscode",
    ".idea",
    "vendor",
    ".turbo",
    ".cache",
]);

const IGNORED_EXTENSIONS = new Set([
    ".lock",
    ".log",
    ".map",
    ".min.js",
    ".min.css",
    ".ico",
    ".png",
    ".jpg",
    ".jpeg",
    ".gif",
    ".svg",
    ".woff",
    ".woff2",
    ".ttf",
    ".eot",
]);

// ─────────────────────────────────────────────────────────────
// Project Scanner — Context Awareness
// ─────────────────────────────────────────────────────────────

/**
 * Recursively scans a directory and returns a flat list of file paths,
 * excluding common non-source directories and binary files.
 */
function scanProjectFiles(
    rootDir: string,
    maxFiles: number = 500
): string[] {
    const files: string[] = [];

    function walk(dir: string, depth: number = 0): void {
        if (files.length >= maxFiles || depth > 10) return;

        let entries: fs.Dirent[];
        try {
            entries = fs.readdirSync(dir, { withFileTypes: true });
        } catch {
            return; // Skip directories we can't read
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

/**
 * Suggests relevant files based on a query string by matching
 * keywords against file paths and names.
 */
function suggestContext(
    query: string,
    projectFiles: string[]
): { matched: string[]; keywords: string[] } {
    // Extract meaningful keywords from the query (3+ chars, lowercase)
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

    // Deduplicate
    const uniqueKeywords = [...new Set(keywords)];

    // Score each file by how many keywords match its path
    const scored = projectFiles
        .map((filePath) => {
            const lowerPath = filePath.toLowerCase();
            const basename = path.basename(filePath).toLowerCase();
            let score = 0;

            for (const keyword of uniqueKeywords) {
                if (basename.includes(keyword)) {
                    score += 3; // Strong match on filename
                } else if (lowerPath.includes(keyword)) {
                    score += 1; // Weaker match on path
                }
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
// Prompt Refinement Engine
// ─────────────────────────────────────────────────────────────

/**
 * Refines a raw "vibe" prompt into a professional, high-density instruction.
 * Now with automatic context suggestion.
 */
function refinePrompt(rawPrompt: string, projectRoot?: string): string {
    const refinedSections: string[] = [];

    refinedSections.push("## Refined Prompt\n");
    refinedSections.push(
        "> The following prompt has been refined by VibeCheck for maximum clarity and actionability.\n"
    );

    // Prepend best-practice context
    refinedSections.push("### Coding Standards Applied");
    refinedSections.push(REFINEMENT_PRINCIPLES.join("\n"));
    refinedSections.push("");

    // Analyze the raw prompt for common issues
    const issues: string[] = [];

    if (rawPrompt.length < 50) {
        issues.push(
            "⚠️ **Too Short** — This prompt lacks detail. Consider adding file paths, expected behavior, and constraints."
        );
    }

    if (!/\.(ts|js|py|go|rs|tsx|jsx|css|html)/i.test(rawPrompt)) {
        issues.push(
            "⚠️ **No File References** — Consider specifying which files should be modified."
        );
    }

    if (!/should|must|expect|return|output/i.test(rawPrompt)) {
        issues.push(
            "⚠️ **No Acceptance Criteria** — Define what 'done' looks like."
        );
    }

    if (issues.length > 0) {
        refinedSections.push("### Issues Detected");
        refinedSections.push(issues.join("\n"));
        refinedSections.push("");
    }

    // Auto-suggest context files if we have a project root
    if (projectRoot) {
        try {
            const projectFiles = scanProjectFiles(projectRoot);
            const { matched, keywords } = suggestContext(rawPrompt, projectFiles);

            if (matched.length > 0) {
                refinedSections.push("### 📂 Recommended Context");
                refinedSections.push(
                    `*Based on keywords: ${keywords.map((k) => `\`${k}\``).join(", ")}*\n`
                );
                refinedSections.push(
                    "Include these files in your prompt for better results:\n"
                );
                matched.forEach((f) => {
                    refinedSections.push(`- \`${f}\``);
                });
                refinedSections.push("");
            }
        } catch {
            // Silently skip if we can't scan the project
        }
    }

    // Output the refined version
    refinedSections.push("### Original Prompt");
    refinedSections.push(`\`\`\`\n${rawPrompt}\n\`\`\``);
    refinedSections.push("");

    refinedSections.push("### Refined Instruction");
    refinedSections.push(
        `Given the coding standards above, here is the refined task:\n\n${rawPrompt}\n\n` +
        `**Additional context required:**\n` +
        `- Target files/directories: [specify]\n` +
        `- Expected output/behavior: [specify]\n` +
        `- Constraints (framework, style, perf): [specify]\n` +
        `- What should NOT change: [specify]`
    );

    return refinedSections.join("\n");
}

// ─────────────────────────────────────────────────────────────
// Server Setup
// ─────────────────────────────────────────────────────────────

const server = new McpServer({
    name: "vibecheck",
    version: "1.1.0",
});

// Register the refine_vibe_prompt tool (enhanced with context awareness)
server.tool(
    "refine_vibe_prompt",
    "Validates and refines a 'vibe coding' prompt into a high-density, context-aware instruction. Automatically scans the project directory and suggests relevant files to include.",
    {
        prompt: z.string().describe("The raw prompt to validate and refine."),
        context: z
            .string()
            .optional()
            .describe(
                "Optional additional context such as project structure, tech stack, or constraints."
            ),
        projectRoot: z
            .string()
            .optional()
            .describe(
                "Optional absolute path to the project root directory for context scanning. Defaults to cwd."
            ),
    },
    async ({ prompt, context, projectRoot }) => {
        let inputPrompt = prompt;

        if (context) {
            inputPrompt += `\n\n### Additional Context\n${context}`;
        }

        const root = projectRoot || process.cwd();
        const refined = refinePrompt(inputPrompt, root);

        return {
            content: [
                {
                    type: "text" as const,
                    text: refined,
                },
            ],
        };
    }
);

// Register the suggest_vibe_context tool (new in Task 002)
server.tool(
    "suggest_vibe_context",
    "Scans the project directory and suggests relevant files to include in a coding prompt based on a query.",
    {
        query: z
            .string()
            .describe("What you want to do, e.g. 'fix the login page' or 'add dark mode'."),
        projectRoot: z
            .string()
            .optional()
            .describe(
                "Optional absolute path to the project root directory. Defaults to cwd."
            ),
    },
    async ({ query, projectRoot }) => {
        const root = projectRoot || process.cwd();
        const projectFiles = scanProjectFiles(root);
        const { matched, keywords } = suggestContext(query, projectFiles);

        const totalFiles = projectFiles.length;

        let output = `## 📂 Suggested Context Files\n\n`;
        output += `Scanned **${totalFiles}** files in project.\n`;
        output += `Keywords extracted: ${keywords.map((k) => `\`${k}\``).join(", ")}\n\n`;

        if (matched.length === 0) {
            output += `No matching files found for the query. Try being more specific or referencing file names directly.\n`;
        } else {
            output += `### Recommended files to include:\n\n`;
            matched.forEach((f, i) => {
                output += `${i + 1}. \`${f}\`\n`;
            });
            output += `\n> 💡 Include these files as context in your prompt for better, more targeted code generation.`;
        }

        return {
            content: [
                {
                    type: "text" as const,
                    text: output,
                },
            ],
        };
    }
);

// ─────────────────────────────────────────────────────────────
// Start the server
// ─────────────────────────────────────────────────────────────

async function main() {
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error("VibeCheck MCP Server v1.1.0 is running on stdio...");
}

main().catch((error) => {
    console.error("Fatal error starting VibeCheck:", error);
    process.exit(1);
});
