import axios, { AxiosInstance } from 'axios';
import { RPC_IDS, RESEARCH_MODES, STUDIO_TYPE_CODES } from './constants.js';

export interface AuthTokens {
    cookies: string;
    csrfToken?: string;
    sessionId?: string;
}

export class NotebookLMClient {
    private client: AxiosInstance;
    private csrfToken: string = '';
    private sessionId: string = '';
    private reqIdCounter: number = 100000;

    constructor(auth: AuthTokens) {
        this.client = axios.create({
            baseURL: 'https://notebooklm.google.com',
            headers: {
                'Cookie': auth.cookies,
                'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
                'Accept': '*/*',
                'Accept-Language': 'en-US,en;q=0.9',
                'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
                'Origin': 'https://notebooklm.google.com',
                'Referer': 'https://notebooklm.google.com/',
                'X-Goog-AuthUser': '0',
                'Sec-Ch-Ua': '"Google Chrome";v="131", "Chromium";v="131", "Not_A Brand";v="24"',
                'Sec-Ch-Ua-Mobile': '?0',
                'Sec-Ch-Ua-Platform': '"Linux"',
                'Sec-Fetch-Dest': 'empty',
                'Sec-Fetch-Mode': 'cors',
                'Sec-Fetch-Site': 'same-origin',
            }
        });
        this.csrfToken = auth.csrfToken || '';
        this.sessionId = auth.sessionId || '';
    }

    async refreshAtToken(): Promise<string> {
        try {
            const response = await this.client.get('/');
            const html = response.data;

            // Extract AT token
            const atMatch = html.match(/"SNlM0e":"([^"]+)"/);
            if (atMatch && atMatch[1]) {
                this.csrfToken = atMatch[1];
                console.error("Status: Automatically refreshed 'at' token.");
            }

            // Extract Build Label (bl)
            const blMatch = html.match(/"cfb2h":"([^"]+)"/);
            if (blMatch && blMatch[1]) {
                (this as any)._currentBl = blMatch[1];
            } else {
                // Secondary fallback for bl
                const blMatch2 = html.match(/"bl":"([^"]+)"/);
                if (blMatch2 && blMatch2[1]) {
                    (this as any)._currentBl = blMatch2[1];
                }
            }

            if (!this.csrfToken) {
                throw new Error("Could not find 'at' token in page source. Are you logged in?");
            }
            return this.csrfToken;
        } catch (error: any) {
            console.error("Error refreshing tokens:", error.message);
            throw error;
        }
    }

    private async _buildRequestBody(rpcId: string, params: any[]): Promise<string> {
        // Compact JSON without spaces matches browser behavior
        const paramsJson = JSON.stringify(params);
        const fReq = [[[rpcId, paramsJson, null, "generic"]]];
        const fReqJson = JSON.stringify(fReq);

        let body = `f.req=${encodeURIComponent(fReqJson)}`;
        if (this.csrfToken) {
            body += `&at=${encodeURIComponent(this.csrfToken)}`;
        }
        return body + "&";
    }

    private async _buildQueryBody(params: any[]): Promise<string> {
        // Query endpoint uses [null, paramsJson] format instead of [[[...]]]
        const paramsJson = JSON.stringify(params);
        const fReq = [null, paramsJson];
        const fReqJson = JSON.stringify(fReq);

        let body = `f.req=${encodeURIComponent(fReqJson)}`;
        if (this.csrfToken) {
            body += `&at=${encodeURIComponent(this.csrfToken)}`;
        }
        return body + "&";
    }

    private _buildUrl(rpcId: string, path: string = '/'): string {
        this.reqIdCounter += 100000;
        const params: any = {
            rpcids: rpcId,
            'source-path': path,
            bl: (this as any)._currentBl || 'boq_labs-tailwind-frontend_20260121.08_p0',
            hl: 'en',
            _reqid: this.reqIdCounter.toString(),
            rt: 'c',
        };
        if (this.sessionId) {
            params['f.sid'] = this.sessionId;
        }
        const urlParams = new URLSearchParams(params);
        return `/_/LabsTailwindUi/data/batchexecute?${urlParams.toString()}`;
    }

    private _parseBatchResponse(responseText: string): any {
        if (responseText.startsWith(")]}'")) {
            responseText = responseText.substring(4);
        }
        const lines = responseText.trim().split('\n');
        for (let line of lines) {
            if (!line.trim()) continue;
            try {
                // Try to parse the line as JSON
                const data = JSON.parse(line);
                if (Array.isArray(data)) {
                    for (let item of data) {
                        if (Array.isArray(item) && item[0] === 'wrb.fr') {
                            // console.error("DEBUG: Found wrb.fr payload:", item[2].substring(0, 100));
                            return JSON.parse(item[2]);
                        }
                    }
                }
            } catch (e) {
                // Skip lines that aren't valid JSON (like byte counts)
                continue;
            }
        }
        return null;
    }

    async listNotebooks(): Promise<any> {
        if (!this.csrfToken) {
            await this.refreshAtToken();
        }
        // [null, 2] worked well in early tests
        const body = await this._buildRequestBody(RPC_IDS.LIST_NOTEBOOKS, [null, 2]);
        const url = this._buildUrl(RPC_IDS.LIST_NOTEBOOKS);
        const response = await this.client.post(url, body);
        const rawData = this._parseBatchResponse(response.data);

        const findNotebooks = (obj: any): any[] => {
            if (!obj || typeof obj !== 'object') return [];
            if (Array.isArray(obj)) {
                // Signature: item[2] is UUID, item[0] is Title or Title Array
                const notebookItems = obj.filter(item =>
                    Array.isArray(item) &&
                    item.length > 5 &&
                    typeof item[2] === 'string' && item[2].length === 36 && item[2].includes('-')
                );

                if (notebookItems.length > 0) {
                    return notebookItems.map(nb => {
                        let title = "Unnamed";
                        if (Array.isArray(nb[0])) title = nb[0][0];
                        else if (typeof nb[0] === 'string') title = nb[0];

                        return {
                            id: nb[2],
                            title: title || "Unnamed Notebook",
                            emoji: nb[3] || ""
                        };
                    });
                }

                for (const item of obj) {
                    const found = findNotebooks(item);
                    if (found.length > 0) return found;
                }
            } else {
                for (const val of Object.values(obj)) {
                    const found = findNotebooks(val);
                    if (found.length > 0) return found;
                }
            }
            return [];
        };

        const notebooks = findNotebooks(rawData);

        // Filter out Google's example notebooks/suggestions
        return notebooks.filter((nb: any) => {
            const trash = ["example", "sample", "biology", "globalization", "health", "wellness", "economics", "trends", "atlantic", "science", "біологія", "глобалізація"];
            const lowerTitle = nb.title.toLowerCase();
            return !trash.some(word => lowerTitle.includes(word));
        });
    }

    async getNotebook(notebookId: string): Promise<any> {
        const body = await this._buildRequestBody(RPC_IDS.GET_NOTEBOOK, [notebookId]);
        const response = await this.client.post(this._buildUrl(RPC_IDS.GET_NOTEBOOK), body);
        return this._parseBatchResponse(response.data);
    }

    async createNotebook(title: string): Promise<any> {
        // Correct Structure: [title, null, null, [2], [1, null, null, null, null, null, null, null, null, null, [1]]]
        const params = [title, null, null, [2], [1, null, null, null, null, null, null, null, null, null, [1]]];
        const body = await this._buildRequestBody(RPC_IDS.CREATE_NOTEBOOK, params);
        const response = await this.client.post(this._buildUrl(RPC_IDS.CREATE_NOTEBOOK), body);
        const res = this._parseBatchResponse(response.data);
        if (res && Array.isArray(res) && res.length > 2) {
            return { id: res[2], title: res[0] };
        }
        console.log('DEBUG CREATE FAIL RAW:', response.data.substring(0, 500));
        return { success: false, raw: res };
    }

    async renameNotebook(notebookId: string, newTitle: string): Promise<any> {
        // Correct Structure: [notebook_id, [[null, null, null, [null, new_title]]]]
        const params = [notebookId, [[null, null, null, [null, newTitle]]]];
        const body = await this._buildRequestBody(RPC_IDS.RENAME_NOTEBOOK, params);
        // Path should include notebookId for rename
        const response = await this.client.post(this._buildUrl(RPC_IDS.RENAME_NOTEBOOK, `/notebook/${notebookId}`), body);
        const res = this._parseBatchResponse(response.data);
        if (res && Array.isArray(res) && res.length > 2) {
            return { id: res[2], title: res[0] };
        }
        return { success: false, raw: res };
    }

    async configureChat(notebookId: string, goal: string = "default", customPrompt?: string): Promise<any> {
        // Goals: 1=Default, 2=Summary, 3=Explanation, 4=Critique, 5=Custom
        let goalCode = 1;
        if (goal === "summary") goalCode = 2;
        if (goal === "explanation") goalCode = 3;
        if (goal === "critique") goalCode = 4;
        if (goal === "custom") goalCode = 5;

        // Structure: [goalCode, customPrompt?]
        const goalSetting = (goal === "custom" && customPrompt) ? [goalCode, customPrompt] : [goalCode];

        // Chat settings is nested deep in the update structure
        // [notebook_id, [[null, null, null, null, null, null, null, [[goalSetting], [1]]]]]
        // The [1] is length code (1=default)
        const chatSettings = [goalSetting, [1]];
        const params = [notebookId, [[null, null, null, null, null, null, null, chatSettings]]];

        const body = await this._buildRequestBody(RPC_IDS.RENAME_NOTEBOOK, params);
        const response = await this.client.post(this._buildUrl(RPC_IDS.RENAME_NOTEBOOK, `/notebook/${notebookId}`), body);
        return this._parseBatchResponse(response.data);
    }

    async deleteNotebook(notebookId: string): Promise<any> {
        // Correct Structure: [[notebook_id], [2]]
        const params = [[notebookId], [2]];
        const body = await this._buildRequestBody(RPC_IDS.DELETE_NOTEBOOK, params);
        const response = await this.client.post(this._buildUrl(RPC_IDS.DELETE_NOTEBOOK), body);
        const res = this._parseBatchResponse(response.data);
        if (res && Array.isArray(res) && res[0] === notebookId) {
            return { success: true, id: res[0] };
        }
        return { success: false, raw: res };
    }

    async startResearch(notebookId: string, query: string, source: string = 'web', mode: string = 'fast'): Promise<any> {
        const rpcId = mode === 'fast' ? RPC_IDS.START_FAST_RESEARCH : RPC_IDS.START_DEEP_RESEARCH;
        const sourceType = source === 'web' ? 1 : 4;
        const params = mode === 'fast' ? [[query, sourceType], null, 1, notebookId] : [null, [1], [query, sourceType], 5, notebookId];

        const body = await this._buildRequestBody(rpcId, params);
        const response = await this.client.post(this._buildUrl(rpcId), body);
        const result = this._parseBatchResponse(response.data);

        if (!result || !Array.isArray(result)) return null;

        // Deep Research (QA9ei) returns [report_id, task_id, ...]
        // Fast Research (Ljjv0c) returns [task_id, ...]
        const taskId = rpcId === RPC_IDS.START_DEEP_RESEARCH ? result[1] : result[0];
        const reportId = rpcId === RPC_IDS.START_DEEP_RESEARCH ? result[0] : null;

        return { task_id: taskId, report_id: reportId };
    }

    async pollResearch(notebookId: string, taskId: string): Promise<any> {
        const body = await this._buildRequestBody(RPC_IDS.POLL_RESEARCH, [null, null, notebookId]);
        // Include notebook path in URL - required for Google to find the research task
        const response = await this.client.post(this._buildUrl(RPC_IDS.POLL_RESEARCH, `/notebook/${notebookId}`), body);
        const result = this._parseBatchResponse(response.data);

        if (!result || !Array.isArray(result)) {
            return { status: 'no_research' };
        }

        // The result is an array of tasks directly (not nested in result[0])
        // Each task is [taskId, taskInfo, timestamp?]
        let tasks = result;

        // If result[0] is also an array of tasks, then it's nested
        if (Array.isArray(result[0]) && result[0].length > 0 && typeof result[0][0] === 'string') {
            tasks = result;
        } else if (Array.isArray(result[0]) && Array.isArray(result[0][0])) {
            tasks = result[0];
        }

        const taskData = tasks.find((t: any) => Array.isArray(t) && t[0] === taskId);
        if (!taskData) {
            return { status: 'no_research' };
        }

        const info = taskData[1];
        if (!Array.isArray(info)) {
            return { status: 'no_research' };
        }

        // Status is at info[4]: 1 = in_progress, 2 = completed, 6 = imported
        const statusCode = info[4];
        const status = (statusCode === 2 || statusCode === 6) ? 'completed' : 'in_progress';

        // Sources are at info[3][0], summary at info[3][1]
        const sourcesAndSummary = info[3];
        const sources = Array.isArray(sourcesAndSummary) ? (sourcesAndSummary[0] || []) : [];
        const summary = Array.isArray(sourcesAndSummary) ? (sourcesAndSummary[1] || "") : "";

        return {
            status,
            sources,
            summary,
            task_id: taskId,
            source_count: Array.isArray(sources) ? sources.length : 0
        };
    }

    async importResearchSources(notebookId: string, taskId: string, sources: any[]): Promise<any> {
        const sourceArray = sources.map(src => [null, null, [src[0], src[1]], null, null, null, null, null, null, null, 2]);
        const params = [null, [taskId], [1], notebookId, sourceArray];
        const body = await this._buildRequestBody(RPC_IDS.IMPORT_RESEARCH, params);
        const response = await this.client.post(this._buildUrl(RPC_IDS.IMPORT_RESEARCH, `/notebook/${notebookId}`), body);
        return this._parseBatchResponse(response.data);
    }

    async syncDriveSource(notebookId: string, sourceId: string): Promise<any> {
        // Params: [null, [source_id], [2]]
        const params = [null, [sourceId], [2]];
        const body = await this._buildRequestBody(RPC_IDS.SYNC_DRIVE, params);
        // Path should include notebookId
        const response = await this.client.post(this._buildUrl(RPC_IDS.SYNC_DRIVE, `/notebook/${notebookId}`), body);
        const result = this._parseBatchResponse(response.data);

        // Parse result for sync timestamp
        let syncedAt = null;
        if (result && Array.isArray(result) && result.length > 3) {
            const syncInfo = result[3];
            if (Array.isArray(syncInfo) && syncInfo.length > 1) {
                const ts = syncInfo[1];
                if (Array.isArray(ts) && ts.length > 0) {
                    syncedAt = ts[0];
                }
            }
        }

        return {
            success: true,
            source_id: sourceId,
            synced_at: syncedAt
        };
    }

    async checkSourceFreshness(notebookId: string, sourceIds: string[]): Promise<any> {
        // Params: [notebook_id, [source_id_1, source_id_2, ...]]
        const params = [notebookId, sourceIds];
        const body = await this._buildRequestBody(RPC_IDS.CHECK_FRESHNESS, params);
        const response = await this.client.post(this._buildUrl(RPC_IDS.CHECK_FRESHNESS, `/notebook/${notebookId}`), body);
        const result = this._parseBatchResponse(response.data);

        // Result is map of source_id -> status
        // We'll return it as is, or parsed slightly
        return result;
    }

    async addSource(notebookId: string, type: 'text' | 'url' | 'drive', content: string, title?: string): Promise<any> {
        let sourceData: any[];

        if (type === 'text') {
            // Correct Text Structure: [null, [title || "Pasted Text", content], null, 2, null, null, null, null, null, null, 1]
            sourceData = [null, [title || "Pasted Text", content], null, 2, null, null, null, null, null, null, 1];
        } else if (type === 'url') {
            const isYoutube = content.toLowerCase().includes("youtube.com") || content.toLowerCase().includes("youtu.be");
            if (isYoutube) {
                // Correct YouTube Structure: [null, null, null, null, null, null, null, [url], null, null, 1]
                sourceData = [null, null, null, null, null, null, null, [content], null, null, 1];
            } else {
                // Correct Web Structure: [null, null, [url], null, null, null, null, null, null, null, 1]
                sourceData = [null, null, [content], null, null, null, null, null, null, null, 1];
            }
        } else {
            // Correct Drive Structure: [[content, mime_type, 1, title], null, null, null, null, null, null, null, null, null, 1]
            sourceData = [[content, "application/vnd.google-apps.document", 1, title || "Drive Doc"], null, null, null, null, null, null, null, null, null, 1];
        }

        // Common Add Wrapper: [[sourceData], notebook_id, [2], [1, null, null, null, null, null, null, null, null, null, [1]]]
        const params = [[sourceData], notebookId, [2], [1, null, null, null, null, null, null, null, null, null, [1]]];
        const body = await this._buildRequestBody(RPC_IDS.ADD_SOURCE, params);
        // Include notebook path
        const response = await this.client.post(this._buildUrl(RPC_IDS.ADD_SOURCE, `/notebook/${notebookId}`), body);
        const res = this._parseBatchResponse(response.data);

        if (res && Array.isArray(res) && res.length > 0) {
            // Structure: [[[["UUID"],"Title",...]]]
            if (Array.isArray(res[0]) && Array.isArray(res[0][0])) {
                const sourceInfo = res[0][0];
                const id = Array.isArray(sourceInfo[0]) ? sourceInfo[0][0] : sourceInfo[0];
                const title = sourceInfo[1];
                return { source_id: id, title: title, type: type };
            }
            // Fallback
            return { source_id: res[0], title: res[1], type: type };
        }
        return { success: false, raw: res };
    }

    async renameSource(notebookId: string, sourceId: string, newTitle: string): Promise<any> {
        // RPC_IDS.RENAME_NOTEBOOK (s0tc2d) is used for sources too if structure is similar
        // But sources usually use RENAME_SOURCE (b7Wfje)
        // Correct Structure: [notebookId, [[sourceId, newTitle]], [2]]
        const params = [notebookId, [[sourceId, newTitle]], [2]];
        const body = await this._buildRequestBody(RPC_IDS.RENAME_SOURCE, params);
        // Include notebook path
        const response = await this.client.post(this._buildUrl(RPC_IDS.RENAME_SOURCE, `/notebook/${notebookId}`), body);
        return this._parseBatchResponse(response.data);
    }

    async deleteSource(notebookId: string, sourceId: string): Promise<any> {
        // Params: [notebook_id, [source_id]]
        const params = [notebookId, [sourceId]];
        const body = await this._buildRequestBody(RPC_IDS.DELETE_SOURCE, params);
        const response = await this.client.post(this._buildUrl(RPC_IDS.DELETE_SOURCE, `/notebook/${notebookId}`), body);
        return this._parseBatchResponse(response.data);
    }

    async listStudioArtifacts(notebookId: string): Promise<any> {
        // Poll Studio RPC: gArtLc
        // Params: [notebook_id, [1, 3, 5, 6, 7, 9]] (all types)
        const types = Object.values(STUDIO_TYPE_CODES);
        const params = [notebookId, types];

        const body = await this._buildRequestBody(RPC_IDS.POLL_STUDIO, params);
        const response = await this.client.post(this._buildUrl(RPC_IDS.POLL_STUDIO, `/notebook/${notebookId}`), body);
        const res = this._parseBatchResponse(response.data);

        // Parse result list
        const artifacts: any[] = [];
        if (res && Array.isArray(res)) {
            res.forEach((item: any) => {
                // Item structure looks like: [id, type_code, status?, ...]
                if (Array.isArray(item) && item.length > 2) {
                    const id = item[0];
                    const typeCode = item[1];
                    let type = "unknown";

                    if (typeCode === STUDIO_TYPE_CODES.AUDIO) type = "audio";
                    if (typeCode === STUDIO_TYPE_CODES.VIDEO) type = "video";
                    if (typeCode === STUDIO_TYPE_CODES.REPORT) type = "report";
                    if (typeCode === STUDIO_TYPE_CODES.INFOGRAPHIC) type = "infographic";
                    if (typeCode === STUDIO_TYPE_CODES.SLIDE_DECK) type = "slide_deck";
                    if (typeCode === STUDIO_TYPE_CODES.FLASHCARDS) type = "flashcards";

                    // Audio specifics: item[7][0] is status (2=done), item[7][1][0] might be duration?
                    // This parsing is approximate based on structure observation
                    artifacts.push({
                        id,
                        type,
                        type_code: typeCode,
                        raw: item
                    });
                }
            });
        }
        return artifacts;
    }

    async deleteStudioArtifact(notebookId: string, artifactId: string): Promise<any> {
        // RPC: V5N4be
        // Params: [notebook_id, [artifact_id]]
        const params = [notebookId, [artifactId]];
        const body = await this._buildRequestBody(RPC_IDS.DELETE_STUDIO, params);
        const response = await this.client.post(this._buildUrl(RPC_IDS.DELETE_STUDIO, `/notebook/${notebookId}`), body);
        const res = this._parseBatchResponse(response.data);

        // Success if we get something back, usually
        return { success: true, raw: res };
    }

    async query(notebookId: string, queryText: string, conversationId?: string): Promise<any> {
        // Query endpoint params for URL (matches reference QUERY_ENDPOINT)
        this.reqIdCounter += 100000;
        const urlParams = new URLSearchParams({
            bl: (this as any)._currentBl || 'boq_labs-tailwind-frontend_20260121.08_p0',
            hl: 'en',
            _reqid: this.reqIdCounter.toString(),
            rt: 'c'
        });
        if (this.sessionId) {
            urlParams.set('f.sid', this.sessionId);
        }

        const queryUrl = `/_/LabsTailwindUi/data/google.internal.labs.tailwind.orchestration.v1.LabsTailwindOrchestrationService/GenerateFreeFormStreamed?${urlParams.toString()}`;

        const conversation_id = conversationId || "session-" + Math.random().toString(36).substring(7);
        // Structure: [sources_array, query, history, [2, null, [1]], conversation_id]
        // sources_array: [[[sid1]], [[sid2]], ...] or [] for all
        const params = [[], queryText, null, [2, null, [1]], conversation_id];

        const body = await this._buildQueryBody(params);
        const response = await this.client.post(queryUrl, body);

        // Response is streaming, but we return raw for now.
        return response.data;
    }

    async generateMindMap(notebookId: string, sourceIds?: string[]): Promise<any> {
        // RPC: yyryJe
        const params = [notebookId, sourceIds || [], null];
        const body = await this._buildRequestBody(RPC_IDS.GENERATE_MIND_MAP, params);
        const response = await this.client.post(this._buildUrl(RPC_IDS.GENERATE_MIND_MAP), body);
        return this._parseBatchResponse(response.data);
    }

    async createStudioArtifact(notebookId: string, type: string, config: any): Promise<any> {
        // Map types to RPC params
        const params = [notebookId, type, config];
        const body = await this._buildRequestBody(RPC_IDS.CREATE_STUDIO, params);
        const response = await this.client.post(this._buildUrl(RPC_IDS.CREATE_STUDIO), body);
        return this._parseBatchResponse(response.data);
    }
}
