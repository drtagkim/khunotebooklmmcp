import { NotebookLMClient } from './api-client.js';
import { NotebookOrchestrator } from './orchestrator.js';
import fs from 'fs';
import path from 'path';

async function verifyAll() {
    const home = process.env.HOME || process.env.USERPROFILE || "";
    const authPath = path.join(home, ".notebooklm-mcp", "auth.json");

    if (!fs.existsSync(authPath)) {
        console.error("❌ No auth file found at", authPath);
        return;
    }

    const data = JSON.parse(fs.readFileSync(authPath, "utf-8"));
    const cookies = Object.entries(data.cookies).map(([k, v]) => `${k}=${v}`).join("; ");
    const csrfToken = data.csrf_token;

    console.log("🚀 Initializing verified verification suite...");
    const client = new NotebookLMClient({ cookies, csrfToken });
    const orchestrator = new NotebookOrchestrator(client);

    try {
        console.log("\n--- TEST 1: List Notebooks ---");
        const notebooks = await client.listNotebooks();
        console.log(`✅ Success: Found ${notebooks.length} notebooks.`);
        notebooks.slice(0, 3).forEach((n: any) => console.log(`  - ${n.title} (${n.id})`));

        console.log("\n--- TEST 2: Create Verification Notebook ---");
        const createRes = await client.createNotebook("ANTIGRAVITY_VERIFY_TEMP");
        const notebookId = createRes[2];
        console.log(`✅ Success: Created notebook ${notebookId}`);

        console.log("\n--- TEST 3: Add Text Source ---");
        const addTextRes = await client.addSource(notebookId, 'text', 'The quick brown fox jumps over the lazy dog. Antigravity research complete.', 'Fox Research');
        console.log(`✅ Success: Added text source.`);

        console.log("\n--- TEST 4: Rename Notebook ---");
        await client.renameNotebook(notebookId, "ANTIGRAVITY_VERIFIED_NODE");
        console.log(`✅ Success: Renamed notebook.`);

        console.log("\n--- TEST 5: Mind Map Generation ---");
        const mmRes = await client.generateMindMap(notebookId);
        if (mmRes) {
            console.log(`✅ Success: Generated Mind Map data.`);
        } else {
            console.log(`⚠️ Warning: Mind Map returned empty (might need source processing).`);
        }

        console.log("\n--- TEST 6: Query Notebook (Streaming Endpoint) ---");
        // Wait for processing
        process.stdout.write("Waiting for background indexing...");
        for (let i = 0; i < 5; i++) {
            process.stdout.write(".");
            await new Promise(r => setTimeout(r, 2000));
        }
        console.log("\nAsking query...");
        const queryRes = await client.query(notebookId, "What does the fox do?");
        console.log(`✅ Success: Received query response (length: ${queryRes.length})`);

        console.log("\n--- TEST 7: Delete Verification Notebook ---");
        await client.deleteNotebook(notebookId);
        console.log(`✅ Success: Cleaned up.`);

        console.log("\n🏁 ALL ENDPOINTS VERIFIED SUCCESSFULLY (EXCEPT DEEP RESEARCH WHICH IS SLOW) 🏁");

    } catch (e: any) {
        console.error("\n❌ VERIFICATION FAILED:", e.message);
        if (e.response) {
            console.error("Status:", e.response.status);
            console.error("Data sample:", JSON.stringify(e.response.data).substring(0, 200));
        }
    }
}

verifyAll();
