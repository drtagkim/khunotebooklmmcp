# Antigravity NotebookLM MCP

Advanced Model Context Protocol (MCP) server for Google NotebookLM. 
Built for AI agents to autonomously research, manage knowledge bases, and generate multimedia artifacts using Google's NotebookLM engine.

## 🚀 Key Features

*   **Robust Authentication**: 
    *   **Browser Auth**: Safe, undetectable remote-debugging login flow (bypasses Google bot detection).
    *   **Manual Auth**: Fallback for headless environments.
*   **Deep Research**: Autonomous web research agent integration with automated source importing.
*   **Full Notebook Management**: CRUD operations for Notebooks.
*   **Advanced Source Control**: 
    *   Add Text, URLs, PDFs, and Drive files.
    *   **Sync**: Keep Drive sources up-to-date.
    *   **Check Freshness**: Monitor source status.
*   **Studio & Artifacts**: 
    *   Generate **Audio Overviews**, **Mind Maps**, **Quizzes**, **Study Guides**.
    *   Manage Studio: List and delete generated artifacts to keep projects clean.
*   **Chat Configuration**: Set specific goals ("critique", "summary") and custom system prompts for your notebook.

## 🛠️ Installation

```bash
npm install
npm run build
```

## 🔐 Authentication (The Antigravity Way)

This server overcomes common bot detection issues using a dedicated Chrome automation workflow.

### Method 1: Browser Auth (Recommended)
This launches a specialized Chrome instance. You simply log in manually, and the MCP extracts the credentials automatically.

```bash
# Run the auth helper
node build/browser-auth.js
```

### Method 2: Manual Token
If you are on a headless server, you can manually inject cookies:

1.  Open NotebookLM in your local browser.
2.  Copy your `Cookie` header from DevTools (Network tab).
3.  Use the `authenticate` tool in Claude/MCP with `method: "manual"`.

Credentials are securely stored in `~/.notebooklm-mcp/auth.json`.

## 📦 Usage with Claude Desktop

Add to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "notebooklm": {
      "command": "node",
      "args": ["/absolute/path/to/antigravity-notebooklm-mcp/build/index.js"]
    }
  }
}
```

## 🧰 Available Tools

| Tool | Action | Description |
|------|--------|-------------|
| **manage_notebook** | `list`, `get`, `create`, `rename`, `delete`, `configure_chat` | Full lifecycle management. `configure_chat` sets prompts/goals. |
| **manage_source** | `add`, `rename`, `delete`, `sync`, `check_freshness` | Manage knowledge sources. Supports syncing Drive files. |
| **manage_studio** | `list`, `delete` | Manage generated artifacts (Audio, Video, Mind Maps). |
| **query_notebook** | N/A | Ask questions grounded in your sources. |
| **perform_deep_research** | N/A | Execute multi-step deep web research and import findings. |
| **generate_artifact** | `audio`, `video`, `quiz`, `slides`, `mind_map`... | Generate multimedia content from your notes. |
| **authenticate** | `browser`, `manual` | Update session credentials. |

## 🏗️ Architecture

This project uses a direct reverse-engineered RPC client (`NotebookLMClient`) wrapped in an **MCP Server**. 
It includes an **Orchestrator** layer for handling complex, multi-step asynchronous operations like Deep Research and Polling.

## ⚠️ Notes

*   **Deep Research** operations can take 3-5 minutes. The server handles polling, but be patient.
*   **Audio Generation** is a heavy task; ensure you have enough sources before generating.

## License

MIT
