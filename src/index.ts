import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
    CallToolRequestSchema,
    ListToolsRequestSchema,
    ListResourcesRequestSchema,
    ReadResourceRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import fs from "fs";
import path from "path";
import { NotebookSessionManager } from "./session-manager.js";
import { ArtifactProcessor } from "./processor.js";
import { ARTIFACT_KEYS } from "./constants.js";

/**
 * KHU Notebook Research MCP Server
 * @version 0.0.1
 * @author Taekyung Kim, PhD.
 */

const SERVER_NAME = "khu-notebook-research-mcp";
const VERSION = "0.0.1";

class ResearchServer {
    private server: Server;
    private session: NotebookSessionManager | null = null;
    private processor: ArtifactProcessor | null = null;

    constructor() {
        this.server = new Server(
            { name: SERVER_NAME, version: VERSION },
            { capabilities: { tools: {}, resources: {} } }
        );
        this.setupHandlers();
    }

    private getSession(): { session: NotebookSessionManager, processor: ArtifactProcessor } {
        if (!this.session || !this.processor) {
            // Load credentials
            const home = process.env.HOME || process.env.USERPROFILE || "";
            const authPath = path.join(home, ".notebooklm-mcp", "auth.json");
            let creds = { cookieHeader: "", csrfToken: "" };

            if (fs.existsSync(authPath)) {
                try {
                    const data = JSON.parse(fs.readFileSync(authPath, "utf-8"));
                    const cookieStr = Object.entries(data.cookies || {}).map(([k, v]) => `${k}=${v}`).join("; ");
                    creds = { cookieHeader: cookieStr, csrfToken: data.csrf_token };
                    console.error(`Status: Loaded credentials from ${authPath}`);
                } catch (e) {
                    console.error("Auth load error:", e);
                }
            } else {
                console.error("Status: No auth file found. Waiting for manual authentication.");
            }

            this.session = new NotebookSessionManager(creds);
            this.processor = new ArtifactProcessor(this.session);
        }
        return { session: this.session, processor: this.processor };
    }

    private setupHandlers() {
        this.server.setRequestHandler(ListToolsRequestSchema, async () => {
            return {
                tools: [
                    {
                        name: "research_notebook_list",
                        description: "List all available research notebooks.",
                        inputSchema: { type: "object", properties: {} }
                    },
                    {
                        name: "research_notebook_create",
                        description: "Create a new research notebook.",
                        inputSchema: {
                            type: "object",
                            properties: { title: { type: "string" } },
                            required: ["title"]
                        }
                    },
                    {
                        name: "research_deep_search",
                        description: "Conduct deep web research and import findings automatically.",
                        inputSchema: {
                            type: "object",
                            properties: {
                                notebook_id: { type: "string" },
                                topic: { type: "string", description: "Research topic/query" }
                            },
                            required: ["notebook_id", "topic"]
                        }
                    },
                    {
                        name: "generate_study_material",
                        description: "Generate various study materials and artifacts.",
                        inputSchema: {
                            type: "object",
                            properties: {
                                notebook_id: { type: "string" },
                                material_type: {
                                    type: "string",
                                    enum: Object.values(ARTIFACT_KEYS),
                                    description: "Type of material to generate"
                                },
                                context: { type: "object", description: "Optional configuration" }
                            },
                            required: ["notebook_id", "material_type"]
                        }
                    },
                    {
                        name: "add_source_content",
                        description: "Add a specific source (text, url, pdf) to the notebook.",
                        inputSchema: {
                            type: "object",
                            properties: {
                                notebook_id: { type: "string" },
                                category: { type: "string", enum: ["text", "url", "drive"] },
                                payload: { type: "string", description: "Content or URL" },
                                title: { type: "string" }
                            },
                            required: ["notebook_id", "category", "payload"]
                        }
                    },
                    {
                        name: "update_credentials",
                        description: "Update session cookies manually.",
                        inputSchema: {
                            type: "object",
                            properties: {
                                cookies: { type: "string", description: "Raw cookie string" },
                                csrf_token: { type: "string" }
                            },
                            required: ["cookies"]
                        }
                    }
                ]
            };
        });

        this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
            const { name, arguments: args } = request.params;
            const { session, processor } = this.getSession();
            const inputs = args as any;

            try {
                if (name === "research_notebook_list") {
                    const list = await session.fetchAllNotebooks();
                    return { content: [{ type: "text", text: JSON.stringify(list, null, 2) }] };
                }

                if (name === "research_notebook_create") {
                    const res = await session.createNotebookProject(inputs.title);
                    return { content: [{ type: "text", text: JSON.stringify(res) }] };
                }

                if (name === "research_deep_search") {
                    const res = await processor.executeDeepResearch(inputs.notebook_id, inputs.topic);
                    return { content: [{ type: "text", text: JSON.stringify(res, null, 2) }] };
                }

                if (name === "generate_study_material") {
                    const res = await processor.createArtifact(inputs.notebook_id, inputs.material_type, inputs.context);
                    return { content: [{ type: "text", text: JSON.stringify(res) }] };
                }

                if (name === "add_source_content") {
                    const res = await session.addSourceToNotebook(inputs.notebook_id, inputs.category, inputs.payload, inputs.title);
                    return { content: [{ type: "text", text: JSON.stringify(res) }] };
                }

                if (name === "update_credentials") {
                    // Logic to save to file would go here for manual updates
                    // Simplified for this refactor
                    return { content: [{ type: "text", text: "Credentials received. Please restart server or implement persistence." }] };
                }

                throw new Error(`Unknown tool: ${name}`);

            } catch (error: any) {
                return {
                    content: [{ type: "text", text: `Operation Failed: ${error.message}` }],
                    isError: true
                };
            }
        });
    }

    async start() {
        const transport = new StdioServerTransport();
        await this.server.connect(transport);
        console.error(`${SERVER_NAME} v${VERSION} running.`);
    }
}

const instance = new ResearchServer();
instance.start().catch(console.error);
