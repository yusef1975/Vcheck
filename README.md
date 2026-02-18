# VibeCheck MCP Server - Technical Specification

## Overview
VibeCheck is an MCP (Model Context Protocol) server designed to act as a quality-gate for "Vibe Coding." It intercepts lazy or underspecified prompts and refines them into high-density, context-aware instructions that produce better code and lower token costs.

## Core Features
1. **Prompt Validation:** Checks for specificity, context references, and design constraints.
2. **Context Enrichment:** Automatically suggests which files from the local repo should be included in the prompt.
3. **Refinement Engine:** Rewrites "lazy" prompts into professional, "Henry-style" instructions.
4. **MCP Tooling:** Exposes `refine_vibe_prompt` to other coding agents (Cursor, Cline, etc.).

## Tech Stack
- **Runtime:** Node.js / TypeScript
- **Protocol:** MCP SDK (@modelcontextprotocol/sdk)
- **Deployment:** Local executable / MCP Server

## Initial Task for Tactical Agent
1. Initialize a new Node.js project with TypeScript.
2. Install `@modelcontextprotocol/sdk`.
3. Create a basic MCP server structure with a single tool: `refine_prompt`.
4. Implement a simple "refinement" logic that prepends coding best practices to any incoming prompt.
5. Push this initial structure to a new repository: `vibecheck-mcp`.
