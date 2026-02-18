import type { VibeCheckConfig } from "./config.js";

// ─────────────────────────────────────────────────────────────
// Personas
// ─────────────────────────────────────────────────────────────

export interface Persona {
    name: string;
    emoji: string;
    description: string;
    expertConstraints: string[];
}

export const BUILTIN_PERSONAS: Record<string, Persona> = {
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

export function getPersonas(config: VibeCheckConfig): Record<string, Persona> {
    const personas = { ...BUILTIN_PERSONAS };
    if (config.customPersonas) {
        for (const [key, val] of Object.entries(config.customPersonas)) {
            personas[key.toLowerCase()] = val;
        }
    }
    return personas;
}

export function resolvePersona(config: VibeCheckConfig, personaKey?: string): Persona {
    const personas = getPersonas(config);
    return personas[personaKey?.toLowerCase() || "default"] || personas["default"];
}
