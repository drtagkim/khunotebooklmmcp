
import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import fs from 'fs';
import path from 'path';
import os from 'os';

puppeteer.use(StealthPlugin());

async function delay(time) {
    return new Promise(function (resolve) {
        setTimeout(resolve, time)
    });
}

async function main() {
    console.log("🚀 Connecting to existing Chrome instance...");

    try {
        // Connect to the manually launched Chrome on port 9222
        const browser = await puppeteer.connect({
            browserURL: 'http://127.0.0.1:9222',
            defaultViewport: null // Keep current viewport
        });

        console.log("✅ Connected to Chrome!");

        // Find the NotebookLM page or open a new one
        const pages = await browser.pages();
        let page = pages.find(p => p.url().includes('notebooklm.google.com'));

        if (!page) {
            console.log("Opening new NotebookLM tab...");
            page = await browser.newPage();
            await page.goto('https://notebooklm.google.com/', { waitUntil: 'networkidle2' });
        } else {
            console.log("Found existing NotebookLM tab. Using it.");
            await page.bringToFront();
        }

        // Wait for hydration
        await delay(3000);

        // Check login
        if (page.url().includes('accounts.google.com') || page.url().includes('signin')) {
            console.log("⚠️ Please log in manually in the browser window.");
            // Wait for user to login
            while (true) {
                if (page.url().includes('notebooklm.google.com') && !page.url().includes('accounts')) {
                    console.log("✅ Login detected!");
                    break;
                }
                await delay(2000);
            }
        }

        // --- Research Workflow ---

        // 1. Enter/Create Notebook
        console.log("Looking for notebook...");
        let notebookEntered = false;

        try {
            // Try to find the title in the list
            const cards = await page.$$('div[role="button"], a, mat-card');
            for (const card of cards) {
                const text = await page.evaluate(el => el.innerText, card);
                if (text.includes('2025 K-Culture Report') || text.includes('Untitled Project')) {
                    console.log(`Clicking notebook: ${text.split('\n')[0]}...`);
                    await card.click();
                    notebookEntered = true;
                    break;
                }
            }

            if (!notebookEntered) {
                // Try new
                console.log("Creating new notebook...");
                const newBtns = await page.$$('div[role="button"]');
                for (const btn of newBtns) {
                    const text = await page.evaluate(el => el.innerText, btn);
                    if (text.includes("New notebook")) {
                        await btn.click();
                        notebookEntered = true;
                        break;
                    }
                }
            }
        } catch (e) {
            console.error("Navigation error:", e);
        }

        if (!notebookEntered) {
            // Maybe we are already IN the notebook?
            const chatInput = await page.$('textarea');
            if (chatInput) {
                console.log("Already inside a notebook.");
                notebookEntered = true;
            }
        }

        if (!notebookEntered) {
            console.error("Could not find or enter a notebook. Please click one manually.");
            await delay(10000); // Give user time
        }

        await delay(3000);

        // 2. Chat
        console.log("Sending research query...");
        const chatSelector = 'textarea[placeholder*="Ask"], textarea';
        await page.waitForSelector(chatSelector, { timeout: 30000 });

        const topic = `
[Research Request]
2025년 K-컬처(한류)를 빛낸 10대 인물을 선정하고 보고서를 작성해줘.
- 포함 분야: K-Pop, K-Drama, 영화, 문학, K-Food 등
- 형식: 
  1. 인물/그룹명
  2. 주요 성과 (구체적 수치나 작품명 포함)
  3. 선정 이유
- 마크다운 형식으로 출력해줘.
        `;

        await page.type(chatSelector, topic);
        await delay(1000);
        await page.keyboard.press('Enter');

        // 3. Wait for response
        console.log("Waiting for detailed response (this may take a minute)...");

        let lastText = "";
        let sameCount = 0;

        process.stdout.write("Thinking");
        for (let i = 0; i < 90; i++) {
            await delay(2000);
            process.stdout.write(".");

            const text = await page.evaluate(() => {
                const bubbles = document.querySelectorAll('.message-bubble, .prose'); // Adjust selectors as needed for NBLM
                // NotebookLM often uses custom tags or classes.
                // Let's grab the last extensive text block.
                const allDivs = document.querySelectorAll('div');
                let maxLen = 0;
                let bestText = "";

                // Heuristic: Find the last added large text block that isn't the user query
                // Easier: Grab the whole chat history text?
                return document.body.innerText;
            });

            if (text.length > lastText.length) {
                lastText = text;
                sameCount = 0;
            } else {
                sameCount++;
            }

            if (sameCount > 10 && lastText.length > 500) { // Stable for 20s
                break;
            }
        }

        // 4. Save
        // We need to extract just the LAST message. 
        // For now, saving the whole text dump is safer than missing content due to selector issues.

        const downloadsPath = path.join(os.homedir(), 'Downloads', '2025_K_Culture_Report_Final.txt');
        fs.writeFileSync(downloadsPath, lastText);

        console.log(`\n✅ Done! Report saved to ${downloadsPath}`);

        // Don't close the browser, let the user keep it.
        browser.disconnect();

    } catch (e) {
        console.error("FATAL:", e);
    }
}

main();
