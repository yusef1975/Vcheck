import { loadConfig } from "./config.js";
import { resolvePersona, type Persona } from "./personas.js";
import { scanProjectFiles, suggestContext } from "./scanner.js";

// ─────────────────────────────────────────────────────────────
// Prompt Scoring
// ─────────────────────────────────────────────────────────────

export interface VibeScore {
    total: number;
    specificity: number;
    contextAvailability: number;
    acceptanceCriteria: number;
    personaAlignment: number;
    breakdown: string;
}

export async function scoreVibe(prompt: string, personaKey?: string, projectRoot?: string): Promise<VibeScore> {
    let specificity = 0, contextAvailability = 0, acceptanceCriteria = 0, personaAlignment = 0;

    // ── Specificity (30 pts) ──
    if (prompt.length > 200) specificity += 10;
    else if (prompt.length > 100) specificity += 5;
    else if (prompt.length > 50) specificity += 2;
    if (/\.(ts|js|py|go|rs|tsx|jsx|css|html)/i.test(prompt)) specificity += 10;
    if (/function|class|method|component|api|endpoint/i.test(prompt)) specificity += 5;
    if (/line\s*\d+|L\d+/i.test(prompt)) specificity += 5;

    // ── Context (30 pts) ──
    if (projectRoot) {
        try {
            const files = await scanProjectFiles(projectRoot);
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
    const config = projectRoot ? loadConfig(projectRoot) : {};
    const persona = resolvePersona(config, personaKey);
    const pl = prompt.toLowerCase();
    for (const c of persona.expertConstraints) {
        const words = c.toLowerCase().split(/\s+/).filter((w) => w.length > 4);
        if (words.filter((w) => pl.includes(w)).length > 0) personaAlignment += 3;
    }

    // Clamp
    specificity = Math.min(30, specificity);
    contextAvailability = Math.min(30, contextAvailability);
    acceptanceCriteria = Math.min(20, acceptanceCriteria);
    personaAlignment = Math.min(20, personaAlignment);

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
