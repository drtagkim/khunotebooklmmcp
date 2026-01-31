
import fs from 'fs';
import path from 'path';
import { NotebookSessionManager } from '../src/session-manager.js';

async function main() {
    try {
        // Load credentials
        const home = process.env.HOME || process.env.USERPROFILE || "";
        const authPath = path.join(home, ".notebooklm-mcp", "auth.json");
        
        if (!fs.existsSync(authPath)) {
            console.error("Auth file not found at " + authPath);
            process.exit(1);
        }

        const data = JSON.parse(fs.readFileSync(authPath, "utf-8"));
        const cookieStr = Object.entries(data.cookies || {}).map(([k, v]) => `${k}=${v}`).join("; ");
        const creds = { cookieHeader: cookieStr, csrfToken: data.csrf_token };

        const session = new NotebookSessionManager(creds);
        console.log("Fetching notebooks...");
        
        const notebooks = await session.fetchAllNotebooks();
        console.log(JSON.stringify(notebooks, null, 2));

    } catch (error) {
        console.error("Error:", error);
    }
}

main();
