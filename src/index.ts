import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

// ─────────────────────────────────────────────────────────────
// VibeCheck MCP Server
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

/**
 * Refines a raw "vibe" prompt into a professional, high-density instruction.
 */
function refinePrompt(rawPrompt: string): string {
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
    version: "1.0.0",
});

// Register the refine_vibe_prompt tool
server.tool(
    "refine_vibe_prompt",
    "Validates and refines a 'vibe coding' prompt into a high-density, context-aware instruction that produces better code and lower token costs.",
    {
        prompt: z.string().describe("The raw prompt to validate and refine."),
        context: z
            .string()
            .optional()
            .describe(
                "Optional additional context such as project structure, tech stack, or constraints."
            ),
    },
    async ({ prompt, context }) => {
        let inputPrompt = prompt;

        if (context) {
            inputPrompt += `\n\n### Additional Context\n${context}`;
        }

        const refined = refinePrompt(inputPrompt);

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

// ─────────────────────────────────────────────────────────────
// Start the server
// ─────────────────────────────────────────────────────────────

async function main() {
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error("VibeCheck MCP Server is running on stdio...");
}

main().catch((error) => {
    console.error("Fatal error starting VibeCheck:", error);
    process.exit(1);
});
