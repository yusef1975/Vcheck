#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import * as fsp from "fs/promises";
import * as path from "path";

// Module imports
import { loadConfig, DEFAULT_CONFIG } from "./config.js";
import { BUILTIN_PERSONAS, getPersonas, resolvePersona } from "./personas.js";
import { scanProjectFiles, suggestContext, detectTechStack, checkDependency, extractMentionedLibraries } from "./scanner.js";
import { securityCheck } from "./security.js";
import { scoreVibe } from "./scoring.js";
import { logHistory, readHistory } from "./history.js";
import { PROMPT_TEMPLATES } from "./templates.js";

// ─────────────────────────────────────────────────────────────
// VibeCheck MCP Server v1.5.0
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
// Refinement Engine (v5 — actually transforms the prompt)
// ─────────────────────────────────────────────────────────────

async function refinePrompt(rawPrompt: string, projectRoot?: string, personaKey?: string): Promise<string> {
    const sections: string[] = [];
    const config = projectRoot ? loadConfig(projectRoot) : {};
    const persona = resolvePersona(config, personaKey);
    const secFlags = securityCheck(rawPrompt);
    const score = await scoreVibe(rawPrompt, personaKey, projectRoot);

    sections.push(`# 🎯 VibeCheck — Refined Prompt\n`);
    sections.push(`> *v1.5.0 | ${persona.emoji} ${persona.name} | Vibe Score: **${score.total}/100***\n`);

    // Security alerts
    if (secFlags.length > 0) {
        sections.push(`## 🔒 Security Alert\n`);
        sections.push(`> **WARNING:** Potentially dangerous instructions detected.\n`);
        secFlags.forEach((f) => sections.push(`- ${f}`));
        sections.push(`\n> Review and ensure these are intentional.\n`);
    }

    // Score
    sections.push(`## 📊 Vibe Score\n`);
    sections.push(score.breakdown);
    sections.push("");

    // Expert constraints
    sections.push(`## ${persona.emoji} Expert Constraints (${persona.name})\n`);
    sections.push(`*${persona.description}*\n`);
    persona.expertConstraints.forEach((c, i) => sections.push(`${i + 1}. ${c}`));
    sections.push("");

    // Coding standards
    sections.push("## 📋 Coding Standards\n");
    sections.push(REFINEMENT_PRINCIPLES.join("\n"));
    sections.push("");

    // Tech stack & deps
    if (projectRoot) {
        const techStack = await detectTechStack(projectRoot);
        if (techStack) {
            sections.push(`## 🔧 Tech Stack\n`);
            sections.push(`| Property | Value |\n|----------|-------|`);
            sections.push(`| **Runtime** | ${techStack.runtime} |`);
            if (techStack.frameworks.length > 0) sections.push(`| **Frameworks** | ${techStack.frameworks.join(", ")} |`);
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
            const files = await scanProjectFiles(projectRoot, config);
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
    if (!/\.(ts|js|py|go|rs|tsx|jsx|css|html)/i.test(rawPrompt)) issues.push("⚠️ **No File References** — Specify which files to change.");
    if (!/should|must|expect|return|output/i.test(rawPrompt)) issues.push("⚠️ **No Acceptance Criteria** — Define what 'done' looks like.");

    if (issues.length > 0) {
        sections.push("## ⚠️ Quality Issues\n");
        sections.push(issues.join("\n"));
        sections.push("");
    }

    // ── Original ──
    sections.push("## 📝 Original Prompt\n");
    sections.push(`\`\`\`\n${rawPrompt}\n\`\`\`\n`);

    // ── ACTUAL REFINED VERSION (the core transformation) ──
    sections.push("## ✨ Refined Instruction\n");

    // Build a truly transformed prompt
    const refined: string[] = [];
    refined.push(`### Objective\n`);
    refined.push(rawPrompt.trim());
    refined.push("");

    // Add specificity hints based on what's missing
    if (rawPrompt.length < 100) {
        refined.push(`### Required Details\n`);
        refined.push(`Please specify the following before proceeding:\n`);
        if (!/\.(ts|js|py|go|rs|tsx|jsx|css|html)/i.test(rawPrompt)) {
            refined.push(`- **Target files**: Which files should be created or modified?`);
        }
        if (!/should|must|expect|return|output/i.test(rawPrompt)) {
            refined.push(`- **Expected behavior**: What should the result look like?`);
        }
        if (!/not|don't|avoid|except|only/i.test(rawPrompt)) {
            refined.push(`- **Scope boundaries**: What should NOT be changed?`);
        }
        refined.push("");
    }

    // Inject persona-specific requirements
    refined.push(`### ${persona.emoji} ${persona.name} Requirements\n`);
    persona.expertConstraints.forEach((c) => refined.push(`- ${c}`));
    refined.push("");

    // Checklist
    refined.push(`### 📌 Completion Checklist\n`);
    refined.push(`- [ ] Target files identified and modified`);
    refined.push(`- [ ] Expected behavior validated`);
    refined.push(`- [ ] Constraints and scope respected`);
    refined.push(`- [ ] Edge cases handled`);
    if (persona.name === "Security Auditor") refined.push(`- [ ] Security review passed`);
    if (persona.name === "Performance Specialist") refined.push(`- [ ] Performance benchmarks met`);
    if (persona.name === "Senior Engineer") refined.push(`- [ ] Code reviewed for scalability`);

    sections.push(refined.join("\n"));

    return sections.join("\n");
}

// ─────────────────────────────────────────────────────────────
// MCP Server
// ─────────────────────────────────────────────────────────────

const server = new McpServer({
    name: "vibecheck",
    version: "1.5.0",
});

// ── Shared ──
const personaEnum = z.enum(["Default", "Senior Engineer", "Product Manager", "Security Auditor", "Performance Specialist"]).optional();

// Resolve projectRoot: prefer explicit arg, then env var, fallback to cwd
function resolveRoot(explicit?: string): string {
    return explicit || process.env.VIBECHECK_PROJECT_ROOT || process.cwd();
}

// ── Resources ──

server.resource(
    "history",
    "vibecheck://history",
    { description: "The VibeCheck prompt refinement history log.", mimeType: "application/json" },
    async (uri) => {
        const root = resolveRoot();
        const history = await readHistory(root);
        return { contents: [{ uri: uri.href, mimeType: "application/json", text: JSON.stringify(history, null, 2) }] };
    }
);

server.resource(
    "rules",
    "vibecheck://rules",
    { description: "The current VibeCheck refinement principles and coding standards.", mimeType: "text/markdown" },
    async (uri) => {
        let content = "# VibeCheck Refinement Principles\n\n";
        content += REFINEMENT_PRINCIPLES.join("\n");
        content += "\n\n# Available Personas\n\n";
        for (const [key, persona] of Object.entries(BUILTIN_PERSONAS)) {
            content += `## ${persona.emoji} ${persona.name} (\`${key}\`)\n`;
            content += `${persona.description}\n\n`;
            persona.expertConstraints.forEach((c) => { content += `- ${c}\n`; });
            content += "\n";
        }
        return { contents: [{ uri: uri.href, mimeType: "text/markdown", text: content }] };
    }
);

// ── Tools ──

server.tool(
    "refine_vibe_prompt",
    "Validates, scores, and refines a prompt with persona-driven constraints, tech-stack awareness, dependency checking, context suggestion, and security guardrails.",
    {
        prompt: z.string().describe("The raw prompt to validate and refine."),
        context: z.string().optional().describe("Optional additional context."),
        projectRoot: z.string().optional().describe("Absolute path to project root. Defaults to cwd."),
        persona: personaEnum.describe("Expert persona to apply."),
    },
    async ({ prompt, context, projectRoot, persona }) => {
        let inputPrompt = prompt;
        if (context) inputPrompt += `\n\n### Additional Context\n${context}`;
        const root = resolveRoot(projectRoot);
        const refined = await refinePrompt(inputPrompt, root, persona);
        const score = await scoreVibe(inputPrompt, persona, root);
        await logHistory({
            timestamp: new Date().toISOString(), persona: persona || "Default",
            rawPrompt: inputPrompt, refinedPrompt: refined, vibeScore: score.total,
            securityFlags: securityCheck(inputPrompt),
        }, root);
        return { content: [{ type: "text" as const, text: refined }] };
    }
);

server.tool(
    "suggest_vibe_context",
    "Scans the project and suggests relevant files to include.",
    {
        query: z.string().describe("What you want to do."),
        projectRoot: z.string().optional().describe("Absolute path to project root."),
    },
    async ({ query, projectRoot }) => {
        const root = resolveRoot(projectRoot);
        const config = loadConfig(root);
        const files = await scanProjectFiles(root, config);
        const { matched, keywords } = suggestContext(query, files);
        let output = `# 📂 Suggested Context Files\n\n> Scanned **${files.length}** files | Keywords: ${keywords.map((k) => `\`${k}\``).join(", ")}\n\n`;
        if (matched.length === 0) { output += `No matching files found.\n`; }
        else { output += `| # | File |\n|---|------|\n`; matched.forEach((f, i) => { output += `| ${i + 1} | \`${f}\` |\n`; }); }
        return { content: [{ type: "text" as const, text: output }] };
    }
);

server.tool(
    "detect_tech_stack",
    "Identifies the project's frameworks, libraries, and versions.",
    { projectRoot: z.string().optional().describe("Absolute path to project root.") },
    async ({ projectRoot }) => {
        const root = resolveRoot(projectRoot);
        const ts = await detectTechStack(root);
        if (!ts) return { content: [{ type: "text" as const, text: "# ❌ No Tech Stack Detected" }] };
        let output = `# 🔧 Tech Stack Report\n\n| Property | Value |\n|----------|-------|\n| **Runtime** | ${ts.runtime} |\n| **Source** | \`${ts.source}\` |\n`;
        if (ts.frameworks.length > 0) output += `| **Frameworks** | ${ts.frameworks.join(", ")} |\n`;
        output += `\n## 📦 Dependencies (${Object.keys(ts.dependencies).length})\n\n| Package | Version |\n|---------|---------|\n`;
        for (const [p, v] of Object.entries(ts.dependencies)) output += `| \`${p}\` | ${v} |\n`;
        return { content: [{ type: "text" as const, text: output }] };
    }
);

server.tool(
    "score_vibe",
    "Scores a prompt 1-100 based on specificity, context, criteria, and persona alignment.",
    {
        prompt: z.string().describe("The prompt to score."),
        persona: personaEnum.describe("Persona to score against."),
        projectRoot: z.string().optional().describe("Absolute path to project root."),
    },
    async ({ prompt, persona, projectRoot }) => {
        const root = resolveRoot(projectRoot);
        const score = await scoreVibe(prompt, persona, root);
        const secFlags = securityCheck(prompt);
        let output = `# 📊 Vibe Score Report\n\n${score.breakdown}\n`;
        if (secFlags.length > 0) { output += `\n## 🔒 Security Flags\n\n`; secFlags.forEach((f) => { output += `- ${f}\n`; }); }
        output += `\n## 💡 Tips\n\n`;
        if (score.specificity < 20) output += `- Add file paths, function names, line references.\n`;
        if (score.contextAvailability < 20) output += `- Include code snippets or error messages.\n`;
        if (score.acceptanceCriteria < 15) output += `- Define expected output or test cases.\n`;
        if (score.personaAlignment < 10) output += `- Align with your selected persona's concerns.\n`;
        return { content: [{ type: "text" as const, text: output }] };
    }
);

server.tool(
    "refinement_loop",
    "Takes feedback on a refined prompt and generates an improved V2.",
    {
        original_prompt: z.string().describe("The original raw prompt."),
        refined_prompt: z.string().describe("The previously refined prompt."),
        feedback: z.string().describe("User's feedback on what to improve."),
        persona: personaEnum.describe("Persona to apply."),
        projectRoot: z.string().optional().describe("Absolute path to project root."),
    },
    async ({ original_prompt, refined_prompt, feedback, persona, projectRoot }) => {
        const root = resolveRoot(projectRoot);
        const config = loadConfig(root);
        const personaObj = resolvePersona(config, persona);
        const combined = `${original_prompt}\n\n${feedback}`;
        const score = await scoreVibe(combined, persona, root);

        let v2 = `# 🔄 Refined Prompt — Version 2\n\n`;
        v2 += `> *Persona: ${personaObj.emoji} ${personaObj.name} | Vibe Score: **${score.total}/100***\n\n`;

        v2 += `## 💬 Feedback Applied\n\n> ${feedback}\n\n`;

        // Use the previous refined prompt as a base and layer feedback on top
        v2 += `## ✨ Improved Instruction\n\n`;
        v2 += `### Objective\n\n${original_prompt}\n\n`;
        v2 += `### V2 Adjustments (from feedback)\n\n${feedback}\n\n`;

        // If the previous refined prompt had specific sections, reference them
        if (refined_prompt.includes("Completion Checklist")) {
            v2 += `### Previous Refinement Context\n\nThe V1 refinement has been incorporated. The following adjustments supersede where they conflict.\n\n`;
        }

        v2 += `### ${personaObj.emoji} Expert Constraints\n\n`;
        personaObj.expertConstraints.forEach((c, i) => { v2 += `${i + 1}. ${c}\n`; });
        v2 += `\n## 📊 Updated Vibe Score\n\n${score.breakdown}`;

        try {
            const files = await scanProjectFiles(root, config);
            const { matched, keywords } = suggestContext(combined, files);
            if (matched.length > 0) {
                v2 += `\n\n## 📂 Updated Context\n\n*Keywords: ${keywords.map((k) => `\`${k}\``).join(", ")}*\n\n`;
                matched.forEach((f) => { v2 += `- \`${f}\`\n`; });
            }
        } catch { /* skip */ }

        await logHistory({
            timestamp: new Date().toISOString(), persona: persona || "Default",
            rawPrompt: `[V2] ${original_prompt}`, refinedPrompt: v2, vibeScore: score.total,
            securityFlags: securityCheck(combined),
        }, root);

        return { content: [{ type: "text" as const, text: v2 }] };
    }
);

server.tool(
    "init_vibecheck",
    "Generates a default .vibecheckrc config and .gitignore entries for a project.",
    { projectRoot: z.string().optional().describe("Absolute path to project root.") },
    async ({ projectRoot }) => {
        const root = resolveRoot(projectRoot);

        const configPath = path.join(root, ".vibecheckrc");
        const defaultRc = {
            ignoredDirs: DEFAULT_CONFIG.ignoredDirs,
            ignoredExtensions: DEFAULT_CONFIG.ignoredExtensions,
            maxScanFiles: 500,
            maxScanDepth: 10,
            customPersonas: {},
        };
        await fsp.writeFile(configPath, JSON.stringify(defaultRc, null, 2), "utf-8");
        await fsp.mkdir(path.join(root, ".vibecheck"), { recursive: true });

        const gitignorePath = path.join(root, ".gitignore");
        let gitignore = "";
        try { gitignore = await fsp.readFile(gitignorePath, "utf-8"); } catch { /* new file */ }
        const entries = [".vibecheck/history.json"];
        const toAdd = entries.filter((e) => !gitignore.includes(e));
        if (toAdd.length > 0) {
            gitignore += `\n# VibeCheck\n${toAdd.join("\n")}\n`;
            await fsp.writeFile(gitignorePath, gitignore, "utf-8");
        }

        let output = `# ✅ VibeCheck Initialized\n\n`;
        output += `| File | Status |\n|------|--------|\n`;
        output += `| \`.vibecheckrc\` | Created with default config |\n`;
        output += `| \`.vibecheck/\` | Directory created |\n`;
        output += `| \`.gitignore\` | Updated with VibeCheck entries |\n`;
        output += `\n> Edit \`.vibecheckrc\` to customize personas, ignored dirs, and scan limits.`;

        return { content: [{ type: "text" as const, text: output }] };
    }
);

server.tool(
    "list_vibe_templates",
    "Returns common starter prompt templates for new features, refactors, bug fixes, tests, and API endpoints.",
    {
        template: z.enum(["new_feature", "refactor", "bug_fix", "test_suite", "api_endpoint"]).optional()
            .describe("Specific template to return. Omit to list all."),
    },
    async ({ template }) => {
        if (template && PROMPT_TEMPLATES[template]) {
            const t = PROMPT_TEMPLATES[template];
            return { content: [{ type: "text" as const, text: `# ${t.name}\n\n\`\`\`markdown\n${t.template}\n\`\`\`` }] };
        }

        let output = `# 📄 VibeCheck Prompt Templates\n\n`;
        output += `Use these structured templates for higher-quality prompts.\n\n`;
        output += `| Template | Key |\n|----------|-----|\n`;
        for (const [key, t] of Object.entries(PROMPT_TEMPLATES)) {
            output += `| ${t.name} | \`${key}\` |\n`;
        }
        output += `\n> Call \`list_vibe_templates\` with a specific template key to get the full template.`;

        return { content: [{ type: "text" as const, text: output }] };
    }
);

// ─────────────────────────────────────────────────────────────
// Start
// ─────────────────────────────────────────────────────────────

async function main() {
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error("🎯 VibeCheck MCP Server v1.5.0 is running on stdio...");
}

main().catch((error) => {
    console.error("Fatal error starting VibeCheck:", error);
    process.exit(1);
});
