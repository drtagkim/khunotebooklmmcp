import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
    CallToolRequestSchema,
    ListToolsRequestSchema,
    ListResourcesRequestSchema,
    ReadResourceRequestSchema,

} from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import fs from "fs";
import path from "path";
import { NotebookLMClient } from "./api-client.js";
import { NotebookOrchestrator } from "./orchestrator.js";
import { browserLogin } from "./browser-auth.js";

const server = new Server(
    {
        name: "antigravity-notebooklm-mcp",
        version: "2.0.0",
    },
    {
        capabilities: {
            tools: {},
        },
    }
);

let client: NotebookLMClient | null = null;
let orchestrator: NotebookOrchestrator | null = null;

// Helper to ensure client is initialized
function getClient() {
    if (!client) {
        let cookies = "";
        let csrfToken = "";
        const home = process.env.HOME || process.env.USERPROFILE || "";
        const authPath = path.join(home, ".notebooklm-mcp", "auth.json");

        if (fs.existsSync(authPath)) {
            try {
                const data = JSON.parse(fs.readFileSync(authPath, "utf-8"));
                cookies = Object.entries(data.cookies).map(([k, v]) => `${k}=${v}`).join("; ");
                csrfToken = data.csrf_token;
                console.error(`Status: 🔑 Loaded auth from ${authPath}`);
            } catch (e) {
                console.error(`Error: Failed to parse ${authPath}:`, e);
            }
        } else {
            cookies = process.env.NOTEBOOKLM_COOKIES || "";
            csrfToken = process.env.NOTEBOOKLM_CSRF || "";
            console.error("Status: Using environment variables for auth");
        }

        console.error("Initializing NotebookLMClient with cookies length:", cookies.length, "and csrf length:", csrfToken.length);
        client = new NotebookLMClient({ cookies, csrfToken });
        orchestrator = new NotebookOrchestrator(client);
    }
    return { client, orchestrator };
}

server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
        tools: [
            {
                name: "manage_notebook",
                description: "Create, rename, delete, list, get details, or configure chat for a notebook.",
                inputSchema: {
                    type: "object",
                    properties: {
                        action: { type: "string", enum: ["list", "get", "create", "rename", "delete", "configure_chat"], description: "Action to perform" },
                        notebook_id: { type: "string" },
                        title: { type: "string" },
                        goal: { type: "string", enum: ["default", "summary", "explanation", "critique", "custom"], description: "Chat goal for configure_chat" },
                        custom_prompt: { type: "string", description: "Custom prompt when goal is 'custom'" },
                    },
                    required: ["action"],
                },
            },
            {
                name: "manage_source",
                description: "Add, rename, delete, sync, or check freshness of sources in a notebook.",
                inputSchema: {
                    type: "object",
                    properties: {
                        action: { type: "string", enum: ["add", "rename", "delete", "sync", "check_freshness"], description: "Action to perform" },
                        notebook_id: { type: "string" },
                        type: { type: "string", enum: ["text", "url", "drive"], description: "Required for 'add' action" },
                        content: { type: "string", description: "Content for 'add' action" },
                        source_id: { type: "string", description: "Required for 'rename', 'delete', 'sync' actions" },
                        source_ids: { type: "array", items: { type: "string" }, description: "Required for 'check_freshness' action" },
                        title: { type: "string", description: "Title for 'add' or 'rename' actions" },
                    },
                    required: ["action", "notebook_id"],
                },
            },
            {
                name: "perform_deep_research",
                description: "Perform deep web research and automatically import findings into a notebook.",
                inputSchema: {
                    type: "object",
                    properties: {
                        notebook_id: { type: "string" },
                        query: { type: "string" },
                    },
                    required: ["notebook_id", "query"],
                },
            },
            {
                name: "generate_artifact",
                description: "Generate AI artifacts (Audio Overview, Video, Quiz, Slides, etc.).",
                inputSchema: {
                    type: "object",
                    properties: {
                        notebook_id: { type: "string" },
                        type: { type: "string", enum: ["audio", "video", "quiz", "slides", "infographic", "report", "mind_map"] },
                        config: { type: "object", description: "Type-specific configuration (language, format, etc.)" },
                    },
                    required: ["notebook_id", "type"],
                },
            },
            {
                name: "query_notebook",
                description: "Ask questions about the notebook sources.",
                inputSchema: {
                    type: "object",
                    properties: {
                        notebook_id: { type: "string" },
                        query: { type: "string" },
                        conversation_id: { type: "string" },
                    },
                    required: ["notebook_id", "query"],
                },
            },
            {
                name: "authenticate",
                description: "Update authentication tokens. Use method='browser' to open a browser for Google login, or method='manual' to provide cookies directly.",
                inputSchema: {
                    type: "object",
                    properties: {
                        method: { type: "string", enum: ["manual", "browser"], description: "Authentication method: 'browser' opens Chrome for login, 'manual' requires cookies" },
                        cookies: { type: "string", description: "Cookie header from Chrome DevTools (required for manual method)" },
                        csrfToken: { type: "string", description: "at= token from network requests (optional, will be extracted automatically)" },
                    },
                    required: [],
                },
            }
        ],
    };
});

server.setRequestHandler(ListResourcesRequestSchema, async () => {
    const ctx = getClient();
    try {
        const notebooks = await ctx.client.listNotebooks();
        return {
            resources: notebooks.map((nb: any) => ({
                uri: `notebooklm://${nb.id}`,
                name: nb.title,
                mimeType: "application/json",
                description: `Notebook: ${nb.title} (${nb.emoji || ''})`
            }))
        };
    } catch (e: any) {
        console.error("Failed to list resources:", e);
        return { resources: [] };
    }
});

server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
    const { uri } = request.params;
    const ctx = getClient();

    // Parse URI: notebooklm://{notebook_id}
    const match = uri.match(/^notebooklm:\/\/([a-zA-Z0-9-]+)$/);
    if (!match) {
        throw new Error(`Invalid resource URI: ${uri}`);
    }

    const notebookId = match[1];
    try {
        const notebook = await ctx.client.getNotebook(notebookId);
        return {
            contents: [{
                uri,
                mimeType: "application/json",
                text: JSON.stringify(notebook, null, 2)
            }]
        };
    } catch (e: any) {
        throw new Error(`Failed to read notebook ${notebookId}: ${e.message}`);
    }
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    const ctx = getClient();

    try {
        switch (name) {
            case "manage_notebook": {
                const { action, notebook_id, title } = args as any;
                if (action === "list") return { content: [{ type: "text", text: JSON.stringify(await ctx.client.listNotebooks()) }] };
                if (action === "get") return { content: [{ type: "text", text: JSON.stringify(await ctx.client.getNotebook(notebook_id)) }] };
                if (action === "create") return { content: [{ type: "text", text: JSON.stringify(await ctx.client.createNotebook(title)) }] };
                if (action === "rename") return { content: [{ type: "text", text: JSON.stringify(await ctx.client.renameNotebook(notebook_id, title)) }] };
                if (action === "delete") return { content: [{ type: "text", text: JSON.stringify(await ctx.client.deleteNotebook(notebook_id)) }] };
                if (action === "configure_chat") {
                    const { goal, custom_prompt } = args as any;
                    return { content: [{ type: "text", text: JSON.stringify(await ctx.client.configureChat(notebook_id, goal, custom_prompt)) }] };
                }
                break;
            }
            case "manage_source": {
                const { action, notebook_id, type, content, source_id, title } = args as any;

                if (action === "add") {
                    if (!type || !content) throw new Error("Type and content are required for 'add' action");
                    const result = await ctx.client.addSource(notebook_id, type, content, title);
                    return { content: [{ type: "text", text: JSON.stringify(result) }] };
                }

                if (action === "rename") {
                    if (!source_id || !title) throw new Error("Source ID and title are required for 'rename' action");
                    const result = await ctx.client.renameSource(notebook_id, source_id, title);
                    return { content: [{ type: "text", text: JSON.stringify(result) }] };
                }

                if (action === "delete") {
                    if (!source_id) throw new Error("Source ID is required for 'delete' action");
                    const result = await ctx.client.deleteSource(notebook_id, source_id);
                    return { content: [{ type: "text", text: JSON.stringify(result) }] };
                }

                if (action === "sync") {
                    if (!source_id) throw new Error("Source ID is required for 'sync' action");
                    const result = await ctx.client.syncDriveSource(notebook_id, source_id);
                    return { content: [{ type: "text", text: JSON.stringify(result) }] };
                }

                if (action === "check_freshness") {
                    const argsAny = args as any;
                    const ids = argsAny.source_ids || (argsAny.source_id ? [argsAny.source_id] : []);
                    if (!ids || ids.length === 0) throw new Error("source_ids array (or single source_id) is required for 'check_freshness' action");
                    const result = await ctx.client.checkSourceFreshness(notebook_id, ids);
                    return { content: [{ type: "text", text: JSON.stringify(result) }] };
                }

                throw new Error(`Unknown action: ${action}`);
            }
            case "perform_deep_research": {
                const { notebook_id, query } = args as any;
                const result = await ctx.orchestrator!.performDeepWebResearch(notebook_id, query);
                return { content: [{ type: "text", text: JSON.stringify(result) }] };
            }
            case "generate_artifact": {
                const { notebook_id, type, config } = args as any;
                const result = await ctx.orchestrator!.generateArtifact(notebook_id, type, config);
                return { content: [{ type: "text", text: JSON.stringify(result) }] };
            }
            case "query_notebook": {
                const { notebook_id, query, conversation_id } = args as any;
                const result = await ctx.client.query(notebook_id, query, conversation_id);
                return { content: [{ type: "text", text: JSON.stringify(result) }] };
            }
            case "authenticate": {
                const { method, cookies, csrfToken } = args as any;

                // Browser-based authentication
                if (method === "browser" || (!method && !cookies)) {
                    try {
                        const tokens = await browserLogin();

                        // Reset client to force reload with new tokens
                        client = null;
                        orchestrator = null;

                        return {
                            content: [{
                                type: "text",
                                text: `✅ Browser authentication successful!\n🍪 Cookies: ${Object.keys(tokens.cookies).length} extracted\n🔑 CSRF: ${tokens.csrf_token ? 'Extracted' : 'Not found'}\n📁 Saved to ~/.notebooklm-mcp/auth.json`
                            }]
                        };
                    } catch (error: any) {
                        return {
                            content: [{ type: "text", text: `❌ Browser authentication failed: ${error.message}` }],
                            isError: true,
                        };
                    }
                }

                // Manual authentication (cookies provided)
                if (!cookies) {
                    throw new Error("Cookies are required for manual authentication. Use method='browser' for automated login.");
                }

                // Save to cache
                try {
                    const home = process.env.HOME || process.env.USERPROFILE || "";
                    const authPath = path.join(home, ".notebooklm-mcp", "auth.json");
                    const authData = {
                        cookies: cookies.split(';').reduce((acc: any, curr: string) => {
                            const [key, ...valueParts] = curr.split('=');
                            const k = key?.trim();
                            const v = valueParts.join('=')?.trim();
                            if (k && v) acc[k] = v;
                            return acc;
                        }, {}),
                        csrf_token: csrfToken?.trim() || ''
                    };
                    fs.writeFileSync(authPath, JSON.stringify(authData, null, 2));
                    console.error("Saved new authentication tokens to cache");
                } catch (e) {
                    console.error("Failed to save auth cache:", e);
                }

                // Reset client to force reload with new tokens
                client = null;
                orchestrator = null;

                return { content: [{ type: "text", text: "Successfully updated and saved authentication tokens." }] };
            }
            default:
                throw new Error(`Unknown tool: ${name}`);
        }
    } catch (error: any) {
        return {
            content: [{ type: "text", text: `Error: ${error.message}` }],
            isError: true,
        };
    }

    return { content: [{ type: "text", text: "Unsupported operation" }], isError: true };
});

async function main() {
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error("Antigravity NotebookLM MCP Server running on stdio");
}

main().catch((error) => {
    console.error("Fatal error in main():", error);
    process.exit(1);
});
