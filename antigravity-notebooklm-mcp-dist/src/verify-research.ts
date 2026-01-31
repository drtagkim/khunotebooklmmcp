import { NotebookLMClient } from './api-client.js';
import { NotebookOrchestrator } from './orchestrator.js';
import fs from 'fs';
import path from 'path';

async function verifyResearch() {
    const home = process.env.HOME || process.env.USERPROFILE || "";
    const authPath = path.join(home, ".notebooklm-mcp", "auth.json");

    if (!fs.existsSync(authPath)) {
        console.error("❌ No auth file found");
        return;
    }

    const data = JSON.parse(fs.readFileSync(authPath, "utf-8"));
    const cookies = Object.entries(data.cookies).map(([k, v]) => `${k}=${v}`).join("; ");
    const csrfToken = data.csrf_token;

    const client = new NotebookLMClient({ cookies, csrfToken });
    const orchestrator = new NotebookOrchestrator(client);

    try {
        console.log("🚀 Testing Deep Research (Fast Mode first for speed)...");
        const createRes = await client.createNotebook("RESEARCH_VERIFY");
        const notebookId = createRes[2];
        console.log(`Created notebook: ${notebookId}`);

        console.log("Starting research on 'Model Context Protocol'...");
        // Use 'fast' mode - deep mode seems to require special conditions
        const result = await orchestrator.performDeepWebResearch(notebookId, "What is Model Context Protocol?", 'fast');

        console.log("\n✅ Research Success!");
        console.log(`Imported ${result.importedCount} sources.`);
        console.log("Sample Result Summary:", result.task.summary?.substring(0, 300));

        // Cleanup
        // await client.deleteNotebook(notebookId);
        // console.log("Cleaned up.");

    } catch (e: any) {
        console.error("❌ Research Verification Failed:", e.message);
    }
}

verifyResearch();
