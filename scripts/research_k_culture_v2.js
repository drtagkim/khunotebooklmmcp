
import fs from 'fs';
import path from 'path';
import { NotebookSessionManager } from '../build/session-manager.js';

const SLEEP_MS = 5000;
const MAX_RETRIES = 60; // 5 minutes max

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function main() {
    try {
        console.log("🚀 Starting K-Culture Research Task (Retry)...");

        // 1. Load Credentials
        const home = process.env.HOME || process.env.USERPROFILE || "";
        const authPath = path.join(home, ".notebooklm-mcp", "auth.json");

        if (!fs.existsSync(authPath)) {
            console.error("❌ Auth file not found. Please login first.");
            process.exit(1);
        }

        const data = JSON.parse(fs.readFileSync(authPath, "utf-8"));
        const cookieStr = Object.entries(data.cookies || {}).map(([k, v]) => `${k}=${v}`).join("; ");
        const creds = { cookieHeader: cookieStr, csrfToken: data.csrf_token };

        const session = new NotebookSessionManager(creds);

        try {
            console.log("Refreshing session...");
            await session.refreshSession();
        } catch (e) {
            console.warn("⚠️ Session refresh warning:", e.message);
        }

        // 2. Find or Create Notebook
        // Strategy: Try to find an empty "Untitled Project" or use an existing one named "K-Culture"
        console.log("Fetching notebook list...");
        const notebooks = await session.fetchAllNotebooks();

        let targetNotebook = notebooks.find(n => n.title === "2025 K-Culture Report");

        if (!targetNotebook) {
            // Try to find an Untitled Project to reuse
            const untitled = notebooks.find(n => n.title === "Untitled Project");
            if (untitled) {
                console.log(`♻️ Reusing 'Untitled Project' (${untitled.id})...`);
                // Rename it
                try {
                    await session.renameNotebookProject(untitled.id, "2025 K-Culture Report");
                    targetNotebook = { ...untitled, title: "2025 K-Culture Report" };
                    console.log("✅ Renamed to '2025 K-Culture Report'");
                } catch (e) {
                    console.warn("⚠️ Rename failed, using as is.");
                    targetNotebook = untitled;
                }
            } else {
                // If create failed before, and no untitled, just pick the first one but warn user
                console.warn("⚠️ No suitable empty notebook found. Creating one failed previously.");
                console.warn("⚠️ Using the first available notebook as a last resort.");
                // targetNotebook = notebooks[0]; 
                // Let's try create again, maybe it was a fluke? No, fallback to create is risky if it fails.
                // Let's try to create one more time with simple logic
                try {
                    console.log("Attemping creation again...");
                    const newNb = await session.createNotebookProject("2025 K-Culture Report");
                    if (newNb) {
                        targetNotebook = newNb;
                        console.log("✅ Creation succeeded this time!");
                    } else {
                        throw new Error("Creation returned null");
                    }
                } catch (e) {
                    console.error("❌ Creation definitely failed. Using first notebook: " + notebooks[0]?.title);
                    targetNotebook = notebooks[0];
                }
            }
        }

        if (!targetNotebook) {
            throw new Error("No notebook available to run research.");
        }

        console.log(`👉 Using Notebook: "${targetNotebook.title}" (${targetNotebook.id})`);

        // 3. Initiate Deep Research
        const topic = "2025년 K-컬처(한류)를 빛낸 10대 인물과 주요 성과 (K-Pop, K-Drama, K-Movie, K-Food 등 포괄). 1. NewJeans(뉴진스) 2. ??? 형식으로";
        console.log(`🔍 Starting Deep Research on: "${topic}"...`);

        // Use 'deep' mode for better results
        const { taskId } = await session.initiateResearch(targetNotebook.id, topic, 'deep');
        console.log(`✅ Research started. Task ID: ${taskId}`);

        // 4. Poll for results
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

        if (!summary) {
            throw new Error("\n❌ Research timed out or returned empty result.");
        }

        // 5. Generate Report Content
        let reportContent = `# 2025 K-Culture Report: 10 Key Figures\n\n`;
        reportContent += `**Generated by:** NotebookLM (via Antigravity MCP)\n`;
        reportContent += `**Date:** ${new Date().toLocaleDateString()}\n\n`;
        reportContent += `> NOTE: This report assumes 2025 data is available or extrapolates from current trends.\n\n`;
        reportContent += `## Research Summary\n\n${summary}\n\n`;

        reportContent += `## Sources\n\n`;
        if (sources && sources.length > 0) {
            sources.forEach((src, idx) => {
                const title = src.title || "Source " + (idx + 1);
                const url = src.url || src.uri || "#";
                reportContent += `${idx + 1}. [${title}](${url})\n`;
            });
        } else {
            reportContent += `(No explicit sources returned via API, check NotebookLM UI for details)\n`;
        }

        // 6. Save to Downloads
        const downloadsPath = path.join(home, 'Downloads', '2025_K_Culture_Report.md');
        fs.writeFileSync(downloadsPath, reportContent, 'utf-8');

        console.log(`\n📄 Report saved to: ${downloadsPath}`);

    } catch (error) {
        console.error("\n❌ Fatal Error:", error);
        process.exit(1);
    }
}

main();
