# antigravity-notebooklm-mcp

MCP (Model Context Protocol) server for Google NotebookLM integration.

## Features

- **Notebook Management**: Create, rename, delete, and list notebooks
- **Source Management**: Add text, URL, and Google Drive sources
- **Query/Chat**: Ask questions about your notebook sources
- **Deep Research**: Start web research and import discovered sources
- **Mind Map Generation**: Generate mind maps from notebook sources
- **Artifact Generation**: Create audio overviews, quizzes, and more

## Installation

```bash
npm install
npm run build
```

## Authentication

This server requires Google NotebookLM authentication cookies. You need to:

1. Open NotebookLM in Chrome
2. Go to DevTools → Network tab
3. Find any request to `notebooklm.google.com`
4. Copy the `Cookie` header and the `at=` token from request body
5. Use the `authenticate` tool to set your credentials

Credentials are stored in `~/.notebooklm-mcp/auth.json`

## Usage with Claude Desktop

Add to your Claude Desktop config:

```json
{
  "mcpServers": {
    "notebooklm": {
      "command": "node",
      "args": ["/path/to/antigravity-notebooklm-mcp/build/index.js"]
    }
  }
}
```

## Available Tools

| Tool | Description |
|------|-------------|
| `authenticate` | Update authentication tokens |
| `manage_notebook` | Create, rename, delete, list, or get notebooks |
| `manage_source` | Add, rename, or delete sources |
| `query_notebook` | Ask questions about notebook sources |
| `perform_deep_research` | Start web research and import sources |
| `generate_artifact` | Generate mind maps and other artifacts |

## Development

```bash
# Build
npm run build

# Run verification tests
node build/verify-all.js
```

## Known Limitations

- Deep Research may take 1-5 minutes to complete
- Fast Research tasks may not immediately appear in poll results
- Mind Map generation requires processed sources

## Credits

Based on reverse engineering of the NotebookLM API. Reference implementation: [jacob-bd/notebooklm-mcp](https://github.com/jacob-bd/notebooklm-mcp)

## License

MIT
