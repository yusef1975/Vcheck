# VibeCheck — Stop Wasting Tokens on Lazy Prompts

> *"The best code agents in the world are only as good as the prompts you feed them."*

---

## The Problem

Let's be honest.

90% of "vibe coding" prompts look like this:

```
fix the login page
```

And then the agent guesses. It touches 14 files. It breaks your auth flow. It costs you $0.47 in tokens and 20 minutes of debugging.

**That's not the agent's fault. That's your prompt.**

---

## The Solution: VibeCheck

**VibeCheck** is an MCP server that sits between you and your coding agent. Every prompt you write gets instantly:

- **Scored** (1–100) across 4 dimensions: Specificity, Context, Acceptance Criteria, and Persona Alignment
- **Scanned** for security red flags (disabling auth? hardcoding secrets? We catch it.)
- **Enriched** with your project's tech stack, relevant file suggestions, and dependency checks
- **Refined** through an expert persona lens (Security Auditor, Performance Specialist, Senior Engineer)
- **Templated** with battle-tested prompt structures for features, bugs, refactors, and tests

The result? Your agent gets a **high-density, context-rich instruction** instead of a vague wish. Better code. Fewer iterations. Lower cost.

---

## Why It Matters

| Without VibeCheck | With VibeCheck |
|---|---|
| "fix the login page" | Structured prompt with file paths, tech stack, acceptance criteria, and security constraints |
| Agent guesses → breaks things | Agent executes precisely → ships code |
| 4-5 iterations to get it right | 1 iteration, done |
| $2+ per task in token waste | Pennies, every time |

---

## How It Works

```
Your Prompt → VibeCheck MCP → Refined Prompt → Your Coding Agent
```

1. **Install**: `npm install -g vibecheck-mcp`
2. **Connect**: Add VibeCheck to your MCP client config
3. **Write**: Type your "vibe" — VibeCheck handles the rest

---

## Built for Teams That Ship

- **History Tracking** — Every prompt logged with scores, personas, and timestamps
- **Iterative Refinement** — Get feedback? Run it through the refinement loop for V2
- **Configurable** — Custom personas, ignored dirs, scan limits via `.vibecheckrc`
- **MCP Native** — Works with Cursor, Cline, Claude Code, and any MCP-compatible agent

---

## The Bottom Line

Every lazy prompt costs you time, tokens, and momentum.

VibeCheck turns every prompt into a precision instrument.

**Your agent deserves better input. Your codebase deserves better output.**

---

*Built by the OpenClaw collective. Engineered by Henry.*

> 🎯 Start vibing smarter: `npm install -g vibecheck-mcp`
