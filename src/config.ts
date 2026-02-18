import * as fs from "fs";
import * as path from "path";

// ─────────────────────────────────────────────────────────────
// Configuration (.vibecheckrc)
// ─────────────────────────────────────────────────────────────

export interface VibeCheckConfig {
    ignoredDirs?: string[];
    ignoredExtensions?: string[];
    customPersonas?: Record<string, {
        name: string;
        emoji: string;
        description: string;
        expertConstraints: string[];
    }>;
    maxScanFiles?: number;
    maxScanDepth?: number;
}

export const DEFAULT_CONFIG: VibeCheckConfig = {
    ignoredDirs: [
        "node_modules", ".git", "dist", ".next", ".nuxt", ".output",
        "build", "coverage", "__pycache__", ".vscode", ".idea",
        "vendor", ".turbo", ".cache", ".vibecheck",
    ],
    ignoredExtensions: [
        ".lock", ".log", ".map", ".min.js", ".min.css",
        ".ico", ".png", ".jpg", ".jpeg", ".gif", ".svg",
        ".woff", ".woff2", ".ttf", ".eot",
    ],
    maxScanFiles: 500,
    maxScanDepth: 10,
};

export function loadConfig(projectRoot: string): VibeCheckConfig {
    const configPath = path.join(projectRoot, ".vibecheckrc");
    try {
        if (fs.existsSync(configPath)) {
            const raw = JSON.parse(fs.readFileSync(configPath, "utf-8"));
            // Validate basic structure
            if (typeof raw !== "object" || raw === null) return {};
            return raw as VibeCheckConfig;
        }
    } catch { /* use defaults */ }
    return {};
}
