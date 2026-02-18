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

export function securityCheck(prompt: string): string[] {
    return SECURITY_PATTERNS.filter(({ pattern }) => pattern.test(prompt)).map(({ flag }) => flag);
}
