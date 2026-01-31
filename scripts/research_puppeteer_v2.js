
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
    console.log("🚀 Starting Browsing Agent for Research...");
    console.log("ℹ️  A Chrome window will open. If you are not logged in, please log in manually.");

    const userDataDir = path.join(os.homedir(), '.notebooklm-mcp', 'chrome-profile');

    // Launch browser
    const browser = await puppeteer.launch({
        headless: false,
        executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
        userDataDir: userDataDir,
        args: ['--no-first-run', '--no-default-browser-check']
    });

    try {
        const page = await browser.newPage();
        await page.setViewport({ width: 1280, height: 800 });

        console.log("Navigating to NotebookLM...");
        await page.goto('https://notebooklm.google.com/', { waitUntil: 'networkidle2' });

        // === Manual Login Wait Loop ===
        while (true) {
            const url = page.url();
            if (url.includes('notebooklm.google.com') && !url.includes('accounts.google.com') && !url.includes('signin')) {
                console.log("✅ Logged in to NotebookLM!");
                break;
            }
            console.log("Waiting for login... (Please login in the browser)");
            await delay(3000);
        }
        // ==============================

        console.log("Waiting for dashboard...");
        await delay(5000);

        // 1. Look for existing "2025 K-Culture Report" or create new
        let notebookFound = false;

        // Try clicking on a card with the title
        try {
            const notebook = await page.evaluateHandle(() => {
                const elements = Array.from(document.querySelectorAll('.mat-mdc-card-title, .title, div[role="heading"]'));
                const target = elements.find(el => el.innerText.includes('2025 K-Culture Report') || el.innerText.includes('Untitled Project'));
                return target ? target.closest('div[role="button"], mat-card, a') : null;
            });

            if (notebook && notebook.asElement()) {
                console.log("Found a notebook. Clicking...");
                await notebook.asElement().click();
                notebookFound = true;
            }
        } catch (e) {
            console.log("Search error", e);
        }

        if (!notebookFound) {
            console.log("Trying to create new notebook...");
            // Look for "New notebook" card
            try {
                const createBtn = await page.evaluateHandle(() => {
                    const elements = Array.from(document.querySelectorAll('div, span'));
                    // "New notebook" text often appears in the card
                    const target = elements.find(el => el.innerText && el.innerText.includes('New notebook'));
                    return target ? target.closest('div[role="button"], mat-card') : null;
                });

                if (createBtn && createBtn.asElement()) {
                    await createBtn.asElement().click();
                    notebookFound = true;
                } else {
                    console.error("Could not find 'New notebook' button.");
                }
            } catch (e) {
                console.error("Create error", e);
            }
        }

        if (!notebookFound) {
            console.log("❌ Failed to enter a notebook. Dumping page text for debug:");
            const text = await page.evaluate(() => document.body.innerText);
            // console.log(text);
            throw new Error("Navigation failed");
        }

        await delay(5000); // Wait for notebook load

        // 2. Locate Chat Input
        console.log("Locating chat input...");
        const chatSelector = 'textarea';
        await page.waitForSelector(chatSelector, { timeout: 30000 });

        const topic = `
[Research Tasks]
1. 2025년 한류를 빛낸 10대 인물을 선정해줘. (가상 시나리오 혹은 현재 트렌드 기반 예측)
2. 각 인물별 주요 업적과 선정 이유를 상세히 기술해줘.
3. K-Pop, Drama, Movie, Literature 등 다양한 분야를 포함해줘.
4. 마크다운 형식으로 깔끔하게 보고서를 작성해줘.
        `;

        await page.type(chatSelector, topic);
        await delay(1000);
        await page.keyboard.press('Enter');

        console.log("Query sent. Waiting for response...");
        await delay(5000);

        // 3. Wait for response stabilization
        let lastText = "";
        let stabilityCount = 0;

        process.stdout.write("Generating");
        for (let i = 0; i < 90; i++) { // 3 minutes max
            await delay(2000);
            process.stdout.write(".");

            // Get the response text
            // The chat bubbles structure: .message-content or similar
            const currentText = await page.evaluate(() => {
                // Try to find the last markdown rendered block
                const bubs = document.querySelectorAll('app-message-bubble, .message-bubble, .prose');
                if (bubs.length > 0) {
                    return bubs[bubs.length - 1].innerText;
                }
                return document.body.innerText;
            });

            if (currentText && currentText.length > lastText.length) {
                lastText = currentText;
                stabilityCount = 0;
            } else if (currentText && currentText.length === lastText.length && currentText.length > 50) {
                stabilityCount++;
            }

            if (stabilityCount > 8) { // ~16 seconds stable
                console.log("\nResponse stabilized.");
                break;
            }
        }

        // 4. Save to file
        const downloadsPath = path.join(os.homedir(), 'Downloads', '2025_K_Culture_Report_Puppeteer.md');
        const report = `# K-Culture Research Result (2025)\n\n${lastText}\n\n*Generated by Antigravity via NotebookLM*`;

        fs.writeFileSync(downloadsPath, report);

        console.log(`\n✅ Report Saved to: ${downloadsPath}`);

        await delay(3000);
        await browser.close();

    } catch (e) {
        console.error("\n❌ Error:", e);
        // await browser.close();
    }
}

main();
