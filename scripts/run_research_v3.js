
import axios from 'axios';
import fs from 'fs';
import path from 'path';

const NOTEBOOK_ENDPOINTS = {
    LIST: "wXbhsf",
    GET_DETAILS: "rLM1Ne",
    CREATE: "CCqFvf",
    RENAME: "s0tc2d",
    DELETE: "WWINqb",
    SOURCE_ADD: "izAoDd",
    SOURCE_GET: "hizoJc",
    SOURCE_FRESHNESS: "yR9Yof",
    SOURCE_SYNC: "FLmJqe",
    SOURCE_DELETE: "tGMBJ",
    SOURCE_RENAME: "b7Wfje",
    CONVERSATIONS: "hPTbtc",
    USER_SETTINGS: "hT54vc",
    NOTIFICATIONS: "ozz5Z",
    APP_SETTINGS: "ZwVcOc",
    SUMMARY_GEN: "VfAZjd",
    SOURCE_GUIDE: "tr032e",
    RESEARCH_FAST: "Ljjv0c",
    RESEARCH_DEEP: "QA9ei",
    RESEARCH_POLL: "e3bVqc",
    RESEARCH_IMPORT: "LBwxtb",
    STUDIO_CREATE: "R7cb6c",
    STUDIO_POLL: "gArtLc",
    STUDIO_DELETE: "V5N4be",
    MIND_MAP_GEN: "yyryJe",
    MIND_MAP_SAVE: "CYK0Xb",
    MIND_MAP_LIST: "cFji9",
    MIND_MAP_DELETE: "AH0mwd",
};

class NotebookSessionManager {
    constructor(creds) {
        this.currentCsrf = '';
        this.currentSession = '';
        this.requestCounter = 200000;
        this.buildLabel = 'boq_labs-tailwind-frontend_20260121.08_p0';

        // Use MAC User-Agent matching the system
        this.httpClient = axios.create({
            baseURL: 'https://notebooklm.google.com',
            headers: {
                'Cookie': creds.cookieHeader,
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/132.0.0.0 Safari/537.36',
                'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
                'Origin': 'https://notebooklm.google.com',
                'Referer': 'https://notebooklm.google.com/',
                'X-Goog-AuthUser': '0',
            }
        });
        this.currentCsrf = creds.csrfToken || '';
        this.currentSession = creds.sessionId || '';
    }

    async refreshSession() {
        try {
            console.log("Requesting index page to refresh session...");
            const { data: html } = await this.httpClient.get('/');

            // Extract AT token
            const atMatch = html.match(/"SNlM0e":"([^"]+)"/);
            if (atMatch && atMatch[1]) {
                this.currentCsrf = atMatch[1];
                console.log(`✅ Refreshed CSRF Token: ${this.currentCsrf.substring(0, 10)}...`);
            } else {
                console.error("Dumping partial HTML for debug:");
                console.error(html.substring(0, 500));
                throw new Error("Failed to extract CSRF token. Session might be expired.");
            }

            // Extract BL (Build Label)
            const blMatch = html.match(/"cfb2h":"([^"]+)"/) || html.match(/"bl":"([^"]+)"/);
            if (blMatch && blMatch[1]) {
                this.buildLabel = blMatch[1];
            }

            return this.currentCsrf;
        } catch (error) {
            console.error("Session refresh failed:", error.message);
            throw error;
        }
    }

    createRpcBody(rpcId, payload) {
        const payloadStr = JSON.stringify(payload);
        const rpcPayload = [[[rpcId, payloadStr, null, "generic"]]];

        const params = new URLSearchParams();
        params.append('f.req', JSON.stringify(rpcPayload));
        if (this.currentCsrf) {
            params.append('at', this.currentCsrf);
        }

        return params.toString();
    }

    createRpcUrl(rpcId) {
        this.requestCounter++;
        const params = new URLSearchParams({
            rpcids: rpcId,
            'source-path': '/',
            bl: this.buildLabel,
            hl: 'en',
            _reqid: this.requestCounter.toString(),
            rt: 'c',
        });
        if (this.currentSession) {
            params.append('f.sid', this.currentSession);
        }
        return `/_/LabsTailwindUi/data/batchexecute?${params.toString()}`;
    }

    extractRpcResponse(rawText) {
        const cleanText = rawText.replace(/^\)]}'\n/, '');
        const lines = cleanText.split('\n');

        for (const line of lines) {
            if (!line.trim()) continue;
            try {
                const json = JSON.parse(line);
                const payload = json?.[0]?.[2];
                if (payload) {
                    return JSON.parse(payload);
                }
            } catch {
                continue;
            }
        }
        return null;
    }

    async fetchAllNotebooks() {
        if (!this.currentCsrf) await this.refreshSession();

        const body = this.createRpcBody(NOTEBOOK_ENDPOINTS.LIST, [null, 2]);
        const url = this.createRpcUrl(NOTEBOOK_ENDPOINTS.LIST);

        const response = await this.httpClient.post(url, body);
        const data = this.extractRpcResponse(response.data);

        return this.parseNotebookList(data);
    }

    parseNotebookList(data) {
        const results = [];
        const traverse = (node) => {
            if (!node || typeof node !== 'object') return;

            if (Array.isArray(node) && node.length > 5 && typeof node[2] === 'string' && node[2].length === 36) {
                const title = Array.isArray(node[0]) ? node[0][0] : node[0];
                results.push({
                    id: node[2],
                    title: title || "Untitled Project",
                    icon: node[3] || ""
                });
                return;
            }

            Object.values(node).forEach(traverse);
        };

        traverse(data);
        return results;
    }

    async createNotebookProject(title) {
        // [title, null, null, [2], [1, ... [1]]]
        const reqData = [title, null, null, [2], [1, null, null, null, null, null, null, null, null, null, [1]]];
        const body = this.createRpcBody(NOTEBOOK_ENDPOINTS.CREATE, reqData);
        const url = this.createRpcUrl(NOTEBOOK_ENDPOINTS.CREATE);

        const res = await this.httpClient.post(url, body);
        const parsed = this.extractRpcResponse(res.data);

        if (parsed && parsed[2]) {
            return { id: parsed[2], title: parsed[0] };
        }
        return null; // Or throw error?
    }

    async renameNotebookProject(id, newTitle) {
        const reqData = [id, [[null, null, null, [null, newTitle]]]];
        const body = this.createRpcBody(NOTEBOOK_ENDPOINTS.RENAME, reqData);
        const url = this.createRpcUrl(NOTEBOOK_ENDPOINTS.RENAME);
        await this.httpClient.post(url, body);
        return true;
    }

    async initiateResearch(notebookId, query, mode = 'fast') {
        const rpcId = mode === 'fast' ? NOTEBOOK_ENDPOINTS.RESEARCH_FAST : NOTEBOOK_ENDPOINTS.RESEARCH_DEEP;
        const reqData = mode === 'fast'
            ? [[query, 1], null, 1, notebookId]
            : [null, [1], [query, 1], 5, notebookId];

        const body = this.createRpcBody(rpcId, reqData);
        const res = await this.httpClient.post(this.createRpcUrl(rpcId), body);
        const parsed = this.extractRpcResponse(res.data);

        if (!parsed) {
            console.error("Research Initiation Response:", res.data);
            throw new Error("Research initiation failed. Check logs.");
        }

        return {
            taskId: mode === 'fast' ? parsed[0] : parsed[1],
            reportId: mode === 'deep' ? parsed[0] : undefined
        };
    }

    async checkResearchStatus(notebookId, taskId) {
        const body = this.createRpcBody(NOTEBOOK_ENDPOINTS.RESEARCH_POLL, [null, null, notebookId]);
        const url = this.createRpcUrl(NOTEBOOK_ENDPOINTS.RESEARCH_POLL);
        const res = await this.httpClient.post(url, body);
        const parsed = this.extractRpcResponse(res.data);

        if (!parsed) return { status: 'unknown' };

        const allTasks = Array.isArray(parsed[0]) && typeof parsed[0][0] !== 'string' ? parsed[0] : parsed;
        const task = allTasks.find(t => t[0] === taskId);

        if (!task) return { status: 'pending' };

        const info = task[1];
        const statusCode = info[4]; // 2=done

        return {
            status: (statusCode === 2 || statusCode === 6) ? 'completed' : 'processing',
            sources: info[3]?.[0] || [],
            summary: info[3]?.[1] || ""
        };
    }
}

// --- Main Execution ---

const SLEEP_MS = 5000;
const MAX_RETRIES = 60;

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function main() {
    try {
        console.log("🚀 Starting K-Culture Research Task (V3 - Mac Headers)...");

        // 1. Load Credentials
        const home = process.env.HOME || process.env.USERPROFILE || "";
        const authPath = path.join(home, ".notebooklm-mcp", "auth.json");

        if (!fs.existsSync(authPath)) {
            console.error("❌ Auth file not found.");
            process.exit(1);
        }

        const data = JSON.parse(fs.readFileSync(authPath, "utf-8"));
        const cookieStr = Object.entries(data.cookies || {}).map(([k, v]) => `${k}=${v}`).join("; ");
        const creds = { cookieHeader: cookieStr, csrfToken: data.csrf_token }; // Empty csrf is ok, will refresh

        const session = new NotebookSessionManager(creds);

        // Always refresh first
        await session.refreshSession();

        // 2. Find or Create Notebook
        console.log("Fetching notebook list...");
        const notebooks = await session.fetchAllNotebooks();

        let targetNotebook = notebooks.find(n => n.title === "2025 K-Culture Report");

        if (!targetNotebook) {
            // Reuse Untitled
            const untitled = notebooks.find(n => n.title === "Untitled Project");
            if (untitled) {
                console.log(`♻️ Reusing 'Untitled Project' (${untitled.id})...`);
                await session.renameNotebookProject(untitled.id, "2025 K-Culture Report");
                targetNotebook = { ...untitled, title: "2025 K-Culture Report" };
            } else {
                // Try create
                console.log("Creating new notebook...");
                const newNb = await session.createNotebookProject("2025 K-Culture Report");
                if (newNb) {
                    targetNotebook = newNb;
                } else if (notebooks.length > 0) {
                    console.warn("Using first available notebook...");
                    targetNotebook = notebooks[0];
                }
            }
        }

        if (!targetNotebook) {
            throw new Error("No notebook available.");
        }

        console.log(`👉 Using Notebook: "${targetNotebook.title}" (${targetNotebook.id})`);

        // 3. Initiate
        const topic = "2025년 K-컬처(한류)를 빛낸 10대 인물과 주요 성과. K-Pop(NewJeans 등), K-Drama(오징어게임2 배우 등), 영화, 문학(한강 작가 등). 1. 이름 - 업적 형식";
        console.log(`🔍 Starting Deep Research on: "${topic}"...`);

        const { taskId } = await session.initiateResearch(targetNotebook.id, topic, 'deep');
        console.log(`✅ Research started. Task ID: ${taskId}`);

        // 4. Poll
        let summary = "";
        let sources = [];

        process.stdout.write("⏳ Researching");
        for (let i = 0; i < MAX_RETRIES; i++) {
            const result = await session.checkResearchStatus(targetNotebook.id, taskId);

            if (result.status === 'completed') {
                console.log("\n✅ Research completed!");
                summary = result.summary;
                sources = result.sources;
                break;
            } else {
                process.stdout.write(".");
                await sleep(SLEEP_MS);
            }
        }

        if (!summary) throw new Error("Research timed out.");

        // 5. Generate Report
        let reportContent = `# 2025 K-Culture Report: 10 Key Figures\n\n`;
        reportContent += `**Date:** ${new Date().toLocaleDateString()}\n\n`;
        reportContent += `## Research Summary\n\n${summary}\n\n`;

        reportContent += `## Sources\n\n`;
        if (sources) {
            sources.forEach((src, idx) => {
                const title = src.title || "Source";
                const url = src.url || src.uri || "#";
                reportContent += `${idx + 1}. [${title}](${url})\n`;
            });
        }

        const downloadsPath = path.join(home, 'Downloads', '2025_K_Culture_Report.md');
        fs.writeFileSync(downloadsPath, reportContent, 'utf-8');
        console.log(`\n📄 Report saved to: ${downloadsPath}`);

    } catch (error) {
        console.error("\n❌ Error:", error.message);
        if (error.response) {
            console.error("Response:", error.response.status, error.response.data);
        }
        process.exit(1);
    }
}

main();
