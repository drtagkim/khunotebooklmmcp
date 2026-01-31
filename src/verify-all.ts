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

    console.log("Client initialized. Fetching notebooks...");

    try {
        const notebooks = await client.fetchAllNotebooks();
        console.log(`\nFound ${notebooks.length} existing notebooks:\n`);
        notebooks.forEach(nb => {
            console.log(`- [${nb.title}] (ID: ${nb.id})`);
        });
    } catch (e) {
        console.error("Failed to list notebooks:", e);
    }
}

main().catch(console.error);
