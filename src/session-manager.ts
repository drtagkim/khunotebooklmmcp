import axios, { AxiosInstance } from 'axios';
import { NOTEBOOK_ENDPOINTS, RESEARCH_STRATEGIES, ARTIFACT_CODE_MAP } from './constants.js';

interface SessionCredentials {
    cookieHeader: string;
    csrfToken?: string;
    sessionId?: string;
}

/**
 * NotebookSessionManager
 * Handles low-level communication with the NotebookLM backend.
 * Refactored for academic research usage.
 * @author Taekyung Kim, PhD.
 */
export class NotebookSessionManager {
    private readonly httpClient: AxiosInstance;
    private currentCsrf: string = '';
    private currentSession: string = '';
    private requestCounter: number = 200000;
    private buildLabel: string = 'boq_labs-tailwind-frontend_20260121.08_p0';

    constructor(creds: SessionCredentials) {
        this.httpClient = axios.create({
            baseURL: 'https://notebooklm.google.com',
            headers: {
                'Cookie': creds.cookieHeader,
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/132.0.0.0 Safari/537.36',
                'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
                'Origin': 'https://notebooklm.google.com',
                'Referer': 'https://notebooklm.google.com/',
                'X-Goog-AuthUser': '0',
            }
        });
        this.currentCsrf = creds.csrfToken || '';
        this.currentSession = creds.sessionId || '';
    }

    /**
     * Refreshes the AT (Anti-Xsrf) token by scraping the index page.
     */
    async refreshSession(): Promise<string> {
        try {
            const { data: html } = await this.httpClient.get('/');

            // Extract AT token
            const atMatch = html.match(/"SNlM0e":"([^"]+)"/);
            if (atMatch?.[1]) {
                this.currentCsrf = atMatch[1];
            } else {
                throw new Error("Failed to extract CSRF token. Session might be expired.");
            }

            // Extract BL (Build Label)
            const blMatch = html.match(/"cfb2h":"([^"]+)"/) || html.match(/"bl":"([^"]+)"/);
            if (blMatch?.[1]) {
                this.buildLabel = blMatch[1];
            }

            return this.currentCsrf;
        } catch (error) {
            console.error("Session refresh failed:", error);
            throw error;
        }
    }

    private createRpcBody(rpcId: string, payload: any[]): string {
        const payloadStr = JSON.stringify(payload);
        const rpcPayload = [[[rpcId, payloadStr, null, "generic"]]];

        const params = new URLSearchParams();
        params.append('f.req', JSON.stringify(rpcPayload));
        if (this.currentCsrf) {
            params.append('at', this.currentCsrf);
        }

        return params.toString();
    }

    private createRpcUrl(rpcId: string): string {
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

    private extractRpcResponse(rawText: string): any {
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

    // --- Notebook Operations ---

    async fetchAllNotebooks(): Promise<any[]> {
        if (!this.currentCsrf) await this.refreshSession();

        const body = this.createRpcBody(NOTEBOOK_ENDPOINTS.LIST, [null, 2]);
        const url = this.createRpcUrl(NOTEBOOK_ENDPOINTS.LIST);

        const response = await this.httpClient.post(url, body);
        const data = this.extractRpcResponse(response.data);

        return this.parseNotebookList(data);
    }

    private parseNotebookList(data: any): any[] {
        const results: any[] = [];
        const traverse = (node: any) => {
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
        return results.filter(nb => {
            // Basic filter for default templates
            const t = nb.title.toLowerCase();
            return !t.includes("example") && !t.includes("sample");
        });
    }

    async getNotebookDetails(id: string): Promise<any> {
        const body = this.createRpcBody(NOTEBOOK_ENDPOINTS.GET_DETAILS, [id]);
        const url = this.createRpcUrl(NOTEBOOK_ENDPOINTS.GET_DETAILS);
        const res = await this.httpClient.post(url, body);
        return this.extractRpcResponse(res.data);
    }

    async createNotebookProject(title: string): Promise<{ id: string, title: string } | null> {
        // [title, null, null, [2], [1, ... [1]]]
        const reqData = [title, null, null, [2], [1, null, null, null, null, null, null, null, null, null, [1]]];
        const body = this.createRpcBody(NOTEBOOK_ENDPOINTS.CREATE, reqData);
        const url = this.createRpcUrl(NOTEBOOK_ENDPOINTS.CREATE);

        const res = await this.httpClient.post(url, body);
        const parsed = this.extractRpcResponse(res.data);

        if (parsed && parsed[2]) {
            return { id: parsed[2], title: parsed[0] };
        }
        return null;
    }

    async deleteNotebookProject(id: string): Promise<boolean> {
        const body = this.createRpcBody(NOTEBOOK_ENDPOINTS.DELETE, [[id], [2]]);
        const url = this.createRpcUrl(NOTEBOOK_ENDPOINTS.DELETE);
        const res = await this.httpClient.post(url, body);
        const parsed = this.extractRpcResponse(res.data);
        return parsed && parsed[0] === id;
    }

    async renameNotebookProject(id: string, newTitle: string): Promise<boolean> {
        const reqData = [id, [[null, null, null, [null, newTitle]]]];
        const body = this.createRpcBody(NOTEBOOK_ENDPOINTS.RENAME, reqData);
        const url = this.createRpcUrl(NOTEBOOK_ENDPOINTS.RENAME); // Should ideally append path
        await this.httpClient.post(url, body);
        return true;
    }

    // --- Source Operations ---

    async addSourceToNotebook(notebookId: string, type: 'text' | 'url' | 'drive', content: string, title: string = "New Source"): Promise<any> {
        let sourcePacket: any[];

        if (type === 'text') {
            // [null, [title, content], null, 2, ...]
            sourcePacket = [null, [title, content], null, 2, null, null, null, null, null, null, 1];
        } else if (type === 'url') {
            const isYoutube = content.includes("youtube") || content.includes("youtu.be");
            if (isYoutube) {
                sourcePacket = [null, null, null, null, null, null, null, [content], null, null, 1];
            } else {
                sourcePacket = [null, null, [content], null, null, null, null, null, null, null, 1];
            }
        } else {
            // Drive: [[id, mime, 1, title], ...]
            sourcePacket = [[content, "application/vnd.google-apps.document", 1, title], null, null, null, null, null, null, null, null, null, 1];
        }

        const reqData = [[sourcePacket], notebookId, [2], [1, null, null, null, null, null, null, null, null, null, [1]]];
        const body = this.createRpcBody(NOTEBOOK_ENDPOINTS.SOURCE_ADD, reqData);
        const url = this.createRpcUrl(NOTEBOOK_ENDPOINTS.SOURCE_ADD); // Append path?

        const res = await this.httpClient.post(url, body);
        return this.extractRpcResponse(res.data);
    }

    async removeSource(notebookId: string, sourceId: string): Promise<any> {
        const body = this.createRpcBody(NOTEBOOK_ENDPOINTS.SOURCE_DELETE, [notebookId, [sourceId]]);
        const url = this.createRpcUrl(NOTEBOOK_ENDPOINTS.SOURCE_DELETE);
        const res = await this.httpClient.post(url, body);
        return this.extractRpcResponse(res.data);
    }

    // --- Research & Artifacts ---

    async initiateResearch(notebookId: string, query: string, mode: 'fast' | 'deep' = 'fast'): Promise<{ taskId: string, reportId?: string }> {
        const rpcId = mode === 'fast' ? NOTEBOOK_ENDPOINTS.RESEARCH_FAST : NOTEBOOK_ENDPOINTS.RESEARCH_DEEP;
        // Web source = 1
        const reqData = mode === 'fast'
            ? [[query, 1], null, 1, notebookId]
            : [null, [1], [query, 1], 5, notebookId];

        const body = this.createRpcBody(rpcId, reqData);
        const res = await this.httpClient.post(this.createRpcUrl(rpcId), body);
        const parsed = this.extractRpcResponse(res.data);

        if (!parsed) throw new Error("Research initiation failed");

        return {
            taskId: mode === 'fast' ? parsed[0] : parsed[1],
            reportId: mode === 'deep' ? parsed[0] : undefined
        };
    }

    async checkResearchStatus(notebookId: string, taskId: string): Promise<any> {
        const body = this.createRpcBody(NOTEBOOK_ENDPOINTS.RESEARCH_POLL, [null, null, notebookId]);
        const url = this.createRpcUrl(NOTEBOOK_ENDPOINTS.RESEARCH_POLL);
        const res = await this.httpClient.post(url, body);
        const parsed = this.extractRpcResponse(res.data);

        if (!parsed) return { status: 'unknown' };

        // Flatten logic for tasks
        const allTasks = Array.isArray(parsed[0]) && typeof parsed[0][0] !== 'string' ? parsed[0] : parsed;
        const task = allTasks.find((t: any) => t[0] === taskId);

        if (!task) return { status: 'pending' };

        const info = task[1];
        const statusCode = info[4]; // 2=done

        return {
            status: (statusCode === 2 || statusCode === 6) ? 'completed' : 'processing',
            sources: info[3]?.[0] || [],
            summary: info[3]?.[1] || ""
        };
    }

    async importResearchResults(notebookId: string, taskId: string, sources: any[]): Promise<any> {
        const sourcePayload = sources.map(s => [null, null, [s[0], s[1]], null, null, null, null, null, null, null, 2]);
        const reqData = [null, [taskId], [1], notebookId, sourcePayload];

        const body = this.createRpcBody(NOTEBOOK_ENDPOINTS.RESEARCH_IMPORT, reqData);
        const res = await this.httpClient.post(this.createRpcUrl(NOTEBOOK_ENDPOINTS.RESEARCH_IMPORT), body);
        return this.extractRpcResponse(res.data);
    }

    async generateStudyArtifact(notebookId: string, typeCode: number, config: any): Promise<any> {
        const reqData = [notebookId, typeCode.toString(), config]; // Type needs to be stringified for some RPCs? Or as is?
        // Checking original: [notebookId, type, config] where type was defined as constants values
        const body = this.createRpcBody(NOTEBOOK_ENDPOINTS.STUDIO_CREATE, [notebookId, typeCode, config]);
        const res = await this.httpClient.post(this.createRpcUrl(NOTEBOOK_ENDPOINTS.STUDIO_CREATE), body);
        return this.extractRpcResponse(res.data);
    }

    async listArtifacts(notebookId: string): Promise<any[]> {
        const typeList = Object.values(ARTIFACT_CODE_MAP);
        const body = this.createRpcBody(NOTEBOOK_ENDPOINTS.STUDIO_POLL, [notebookId, typeList]);
        const res = await this.httpClient.post(this.createRpcUrl(NOTEBOOK_ENDPOINTS.STUDIO_POLL), body);
        const parsed = this.extractRpcResponse(res.data);

        if (!Array.isArray(parsed)) return [];

        return parsed.map((item: any) => ({
            id: item[0],
            typeCode: item[1],
            status: item[2], // verify index
            meta: item
        }));
    }

    async generatedMindMap(notebookId: string, sourceIds: string[] = []): Promise<any> {
        const body = this.createRpcBody(NOTEBOOK_ENDPOINTS.MIND_MAP_GEN, [notebookId, sourceIds, null]);
        const res = await this.httpClient.post(this.createRpcUrl(NOTEBOOK_ENDPOINTS.MIND_MAP_GEN), body);
        return this.extractRpcResponse(res.data);
    }
}
