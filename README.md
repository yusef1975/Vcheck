# 🎯 VibeCheck MCP Server

**Stop writing lazy prompts. Start shipping better code.**

VibeCheck is an [MCP](https://modelcontextprotocol.io/) (Model Context Protocol) server that acts as a quality gate for AI-assisted coding. It intercepts underspecified prompts and refines them into high-density, context-aware instructions — so your AI assistant produces better code with fewer iterations.

[![MIT License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Version](https://img.shields.io/badge/version-1.5.0-green.svg)](package.json)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-blue.svg)](tsconfig.json)

---

## Why VibeCheck?

Most AI coding prompts are too vague. "Add a login page" tells your AI nothing about auth providers, styling, error handling, or scope. You end up in a loop of corrections that burns tokens and time.

VibeCheck **scores** your prompt, **flags** what's missing, **detects** your tech stack, **suggests** relevant files, and **transforms** it into a structured instruction with persona-specific requirements — all before a single line of code is generated.

---

## Features

| Feature | Description |
|---------|-------------|
| 🎯 **Prompt Refinement** | Transforms vague prompts into structured, actionable instructions |
| 📊 **Vibe Scoring** | Scores prompts 1–100 across specificity, context, criteria, and persona alignment |
| 🏗️ **5 Expert Personas** | Default, Senior Engineer, Product Manager, Security Auditor, Performance Specialist |
| 🔧 **Tech-Stack Detection** | Auto-detects Node.js, Python, and Go projects with framework identification |
| 📦 **Dependency Checking** | Verifies if libraries mentioned in your prompt are actually installed |
| 📂 **Context Suggestion** | Scans your project and recommends relevant files to include |
| 🔒 **Security Guardrails** | Flags prompts that attempt to disable auth, hardcode secrets, or bypass validation |
| 📝 **History Tracking** | Logs all refinements to `.vibecheck/history.json` with auto-rotation |
| 🔄 **Iterative Refinement** | Feed back on a refined prompt to generate improved V2 |
| 📄 **Prompt Templates** | Starter templates for features, refactors, bug fixes, tests, and API endpoints |

---

## Quick Start

### Prerequisites

- [Node.js](https://nodejs.org/) 18+ 
- An MCP-compatible client (Cursor, Claude Desktop, VS Code, Windsurf, etc.)

### Install

```bash
# Clone the repo
git clone https://github.com/yusef1975/Vcheck.git
cd Vcheck

# Install dependencies
npm install

# Build
npm run build
```

### Connect to Your Editor

Add VibeCheck to your MCP client configuration:

<details>
<summary><b>Cursor</b></summary>

Create or edit `.cursor/mcp.json` in your project (or `~/.cursor/mcp.json` globally):

```json
{
  "mcpServers": {
    "vibecheck": {
      "command": "node",
      "args": ["/absolute/path/to/Vcheck/dist/index.js"]
    }
  }
}
```
</details>

<details>
<summary><b>Claude Desktop</b></summary>

Edit `claude_desktop_config.json`:
- **macOS:** `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows:** `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "vibecheck": {
      "command": "node",
      "args": ["/absolute/path/to/Vcheck/dist/index.js"]
    }
  }
}
```
</details>

<details>
<summary><b>VS Code (Copilot)</b></summary>

Add to `.vscode/settings.json`:

```json
{
  "mcp": {
    "servers": {
      "vibecheck": {
        "command": "node",
        "args": ["/absolute/path/to/Vcheck/dist/index.js"]
      }
    }
  }
}
```
</details>

<details>
<summary><b>Windsurf / Antigravity</b></summary>

Add to your MCP config file (`mcp_config.json`):

```json
{
  "mcpServers": {
    "vibecheck": {
      "command": "node",
      "args": ["/absolute/path/to/Vcheck/dist/index.js"]
    }
  }
}
```
</details>

> **Tip:** Replace `/absolute/path/to/Vcheck` with the actual path where you cloned the repo.

After adding the config, **restart your editor**. The tools will be available immediately.

---

## Tools

### `refine_vibe_prompt`
The core tool. Validates, scores, and transforms your prompt.

```
Input:  "add a login page to my nextjs app"
Output: Structured instruction with tech-stack context, persona requirements, 
        file suggestions, security checks, and a completion checklist.
```

**Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `prompt` | string | ✅ | The raw prompt to refine |
| `persona` | enum | ❌ | Expert persona to apply |
| `projectRoot` | string | ❌ | Absolute path to project root |
| `context` | string | ❌ | Additional context to include |

### `score_vibe`
Scores a prompt 1–100 with a detailed breakdown.

**Scoring Categories:**
| Category | Max Points |
|----------|-----------|
| 🎯 Specificity | 30 |
| 📂 Context | 30 |
| ✅ Acceptance Criteria | 20 |
| 🏗️ Persona Alignment | 20 |

**Score Badges:** ❌ LAZY (0–19) → ⚠️ WEAK (20–39) → ⚡ DECENT (40–59) → ✅ STRONG (60–79) → 🏆 ELITE (80–100)

### `suggest_vibe_context`
Scans your project and suggests relevant files based on keyword matching.

### `detect_tech_stack`
Auto-detects your project's runtime, frameworks, and dependencies from `package.json`, `requirements.txt`, or `go.mod`.

### `refinement_loop`
Takes feedback on a previously refined prompt and generates an improved V2.

### `init_vibecheck`
Generates a default `.vibecheckrc` config file, creates the `.vibecheck/` directory, and updates `.gitignore`.

### `list_vibe_templates`
Returns starter prompt templates:
- 🚀 **New Feature** — structured feature request
- 🔧 **Refactor** — refactoring guide
- 🐛 **Bug Fix** — bug report with reproduction steps
- 🧪 **Test Suite** — test planning template
- 🌐 **API Endpoint** — REST endpoint specification

---

## Resources

VibeCheck exposes two MCP resources that other agents can read:

| Resource URI | Description |
|-------------|-------------|
| `vibecheck://history` | JSON array of all prompt refinement history |
| `vibecheck://rules` | Markdown document with refinement principles and persona definitions |

---

## Personas

Each persona applies domain-specific expert constraints to your prompt:

| Persona | Focus |
|---------|-------|
| 🧑‍💻 **Default** | Clean code, SOLID principles, error handling |
| 🏗️ **Senior Engineer** | Scalability, failure modes, observability, race conditions |
| 📊 **Product Manager** | User impact, accessibility, analytics, i18n |
| 🛡️ **Security Auditor** | Input validation, injection attacks, secrets, CORS |
| ⚡ **Performance Specialist** | Profiling, caching, lazy loading, connection pooling |

---

## Configuration

Run `init_vibecheck` to generate a `.vibecheckrc` in your project root:

```json
{
  "ignoredDirs": ["node_modules", ".git", "dist", "..."],
  "ignoredExtensions": [".lock", ".log", ".map", "..."],
  "maxScanFiles": 500,
  "maxScanDepth": 10,
  "customPersonas": {
    "my persona": {
      "name": "My Persona",
      "emoji": "🎨",
      "description": "A custom expert with specific constraints.",
      "expertConstraints": [
        "Always use design tokens from the shared theme.",
        "Prefer CSS Grid over Flexbox for page layouts."
      ]
    }
  }
}
```

---

## Project Structure

```
src/
├── index.ts        # MCP server, tool registrations, refinement engine
├── config.ts       # .vibecheckrc loading and defaults
├── personas.ts     # 5 built-in personas + custom persona support
├── scanner.ts      # Async project scanner, context suggestion, tech-stack detection
├── scoring.ts      # Vibe Score (1–100) calculation
├── security.ts     # Security guardrail patterns
├── history.ts      # History logging with 200-entry rotation
└── templates.ts    # 5 starter prompt templates
```

---

## Environment Variables

| Variable | Description |
|----------|-------------|
| `VIBECHECK_PROJECT_ROOT` | Override the default project root (falls back to `cwd`) |

---

## Development

```bash
# Watch mode (auto-recompile on changes)
npm run dev

# Build
npm run build

# Run directly
npm start
```

---

## License

[MIT](LICENSE) — Built by [yusef1975](https://github.com/yusef1975)
