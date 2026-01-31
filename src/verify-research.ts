import { NotebookSessionManager } from './session-manager.js';
import { ArtifactProcessor } from './processor.js';
import fs from 'fs';
import path from 'path';

async function main() {
    const home = process.env.HOME || process.env.USERPROFILE || "";
    const authPath = path.join(home, ".notebooklm-mcp", "auth.json");

    if (!fs.existsSync(authPath)) {
        console.error("Auth file not found");
        return;
    }

    const data = JSON.parse(fs.readFileSync(authPath, "utf-8"));
    const cookies = Object.entries(data.cookies).map(([k, v]) => `${k}=${v}`).join("; ");
    const csrfToken = data.csrf_token;

    const client = new NotebookSessionManager({ cookieHeader: cookies, csrfToken });
    const processor = new ArtifactProcessor(client);

    const NOTEBOOK_ID = "0270302e-7920-4dcd-adec-aec2055ea107"; // 문화콘텐츠 지수 개발
    const QUERY = "문화콘텐츠 지수 개발";

    console.log(`Starting Deep Search for notebook: ${NOTEBOOK_ID}`);
    console.log(`Query: ${QUERY}`);

    // Explicitly refresh session / get CSRF
    try {
        console.log("Refreshing session to get CSRF token...");
        const csrf = await client.refreshSession();
        console.log(`CSRF Token retrieved: ${csrf.substring(0, 10)}... (Length: ${csrf.length})`);
    } catch (e) {
        console.error("Failed to refresh session/get CSRF token!");
        console.error(e);
        return;
    }

    try {
        const result = await processor.executeDeepResearch(NOTEBOOK_ID, QUERY);
        console.log("\n✅ Deep Research Completed Successfully!");
        console.log(`Sources Added: ${result.sourceCount}`);
        console.log("\nSummary of Findings:\n");
        console.log(result.summary);
    } catch (error) {
        console.error("\n❌ Research Failed:", error);
    }
}

main().catch(console.error);
