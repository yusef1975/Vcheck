import * as fsp from "fs/promises";
import * as path from "path";

// ─────────────────────────────────────────────────────────────
// History Tracking
// ─────────────────────────────────────────────────────────────

const MAX_HISTORY_ENTRIES = 200;

export interface HistoryEntry {
    timestamp: string;
    persona: string;
    rawPrompt: string;
    refinedPrompt: string;
    vibeScore: number;
    securityFlags: string[];
}

export async function logHistory(entry: HistoryEntry, projectRoot: string): Promise<void> {
    const historyDir = path.join(projectRoot, ".vibecheck");
    const historyFile = path.join(historyDir, "history.json");
    try {
        await fsp.mkdir(historyDir, { recursive: true });
        let history: HistoryEntry[] = [];
        try {
            const raw = await fsp.readFile(historyFile, "utf-8");
            history = JSON.parse(raw);
        } catch { /* start fresh */ }

        history.push(entry);

        // Rotate: keep only the last N entries
        if (history.length > MAX_HISTORY_ENTRIES) {
            history = history.slice(history.length - MAX_HISTORY_ENTRIES);
        }

        await fsp.writeFile(historyFile, JSON.stringify(history, null, 2), "utf-8");
    } catch (err) {
        console.error("Failed to log history:", err);
    }
}

export async function readHistory(projectRoot: string): Promise<HistoryEntry[]> {
    const historyFile = path.join(projectRoot, ".vibecheck", "history.json");
    try {
        const raw = await fsp.readFile(historyFile, "utf-8");
        return JSON.parse(raw);
    } catch {
        return [];
    }
}
