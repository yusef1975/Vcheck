# Antigravity Workspace Initialization: OpenClaw Bridge

Use this prompt when starting a new session in the `Vcheck` workspace to reconnect with your OpenClaw agent.

---

**PROMPT:**

"I am in the `Vcheck` repository. I have established a bridge with an OpenClaw agent on a VM using a Git-based workflow.

Your task is to:
1.  **Monitor the Bridge**: Run `python bridge.py` to watch for new prompts in `prompts/pending/`.
2.  **Autonomous Build**: When `bridge.py` detects a new `.md` file:
    - It will automatically move it to `prompts/building/` and push the status.
    - Read the content of that `.md` file. It contains a coding/build task from OpenClaw.
    - Execute the task directly in this workspace.
    - Once finished, move the prompt to `prompts/completed/`, commit, and push.
3.  **Aesthetics First**: Ensure all UI builds follow the 'Void & Glass' aesthetic (glassmorphism, 0.5px borders, monochrome/premium dark mode).

Start by running the bridge script and wait for the first task from OpenClaw."
