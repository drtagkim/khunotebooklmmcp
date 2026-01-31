
import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import path from 'path';
import os from 'os';
import { exec } from 'child_process';
import fs from 'fs';

puppeteer.use(StealthPlugin());

function delay(time) {
    return new Promise(function (resolve) {
        setTimeout(resolve, time)
    });
}

async function main() {
    console.log("🚀 Preparing to use YOUR Default Chrome Profile...");

    // Path to the real default profile on macOS
    const defaultProfilePath = path.join(os.homedir(), 'Library/Application Support/Google/Chrome');

    // We need to make sure Chrome is launched with the debugging port.
    // We will launch it via 'exec' so it detaches and acts like a normal browser opening.
    const chromePath = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

    console.log("launching Chrome with your default profile + automation port...");

    // Command to launch Chrome with the default profile and debugging enabled.
    // Note: We do NOT specify --user-data-dir if we want the system default, 
    // BUT to ensure the port works we might need to be careful. 
    // Actually, on macOS, if you run the binary directly without --user-data-dir, it picks up the default.
    // The key is that NO other Chrome instances can be running.

    const cmd = `"${chromePath}" --remote-debugging-port=9222 --no-first-run --no-default-browser-check`;

    exec(cmd, (error) => {
        // This callback might not fire immediately if Chrome stays open, which is expected.
        if (error) console.log("Chrome launch log:", error.message);
    });

    console.log("⏳ Waiting for Chrome to start...");
    await delay(3000);

    try {
        const browser = await puppeteer.connect({
            browserURL: 'http://127.0.0.1:9222',
            defaultViewport: null
        });

        console.log("✅ API Connected to your Chrome!");

        // Open NotebookLM
        const pages = await browser.pages();
        let page = pages[0];
        if (!page) page = await browser.newPage();

        console.log("Navigating to NotebookLM...");
        await page.goto('https://notebooklm.google.com/', { waitUntil: 'networkidle2' });

        // Since it's the User's Real Profile, they should be logged in!
        if (page.url().includes('accounts.google.com')) {
            console.log("⚠️ You are NOT logged in even on your main profile.");
            console.log("👉 Please login now in the opened window.");

            while (true) {
                if (page.url().includes('notebooklm.google.com') && !page.url().includes('accounts')) {
                    break;
                }
                await delay(1000);
            }
        } else {
            console.log("✅ Auto-login confirmed!");
        }

        // === Research Logic ===

        console.log("Starting research...");

        // Ensure we are in a notebook
        let inNotebook = false;

        // Check for "New Notebook" or existing "2025 K-Culture"
        // Adjust selectors for safety
        try {
            await delay(2000);

            // If already in a notebook, there will be a header or chat bar
            if (await page.$('textarea')) {
                inNotebook = true;
            } else {
                // We are in the dashboard list
                // Find "2025 K-Culture Report"
                const links = await page.$$('div[role="button"], a');
                for (const link of links) {
                    const txt = await page.evaluate(el => el.innerText, link);
                    if (txt.includes('2025 K-Culture Report') || txt.includes('Untitled')) { // Reuse untitled if needed
                        console.log(`Opening notebook: ${txt.split('\n')[0]}`);
                        await link.click();
                        inNotebook = true;
                        break;
                    }
                }

                if (!inNotebook) {
                    // Create new
                    console.log("Creating new notebook...");
                    // Try finding the 'New notebook' text (usually first card)
                    const cards = await page.$$('.mat-mdc-card');
                    if (cards.length > 0) {
                        await cards[0].click(); // First card is usually "New"
                        inNotebook = true;
                    }
                }
            }
        } catch (e) {
            console.log(e);
        }

        await delay(4000);

        // Send Query
        const chatSelector = 'textarea';
        await page.waitForSelector(chatSelector, { timeout: 30000 });

        const query = `
2025년 K-컬처(한류)를 빛낸 10대 인물을 선정해서 보고서를 만들어줘.
- K-Pop, Drama, Movie, Literature 등 분야별 안배.
- 핵심 성과, 선정 이유 포함.
- 마크다운 포맷.
        `;

        await page.type(chatSelector, query);
        await delay(500);
        await page.keyboard.press('Enter');

        console.log("Query sent! Waiting for response...");

        // Wait for result
        let lastText = "";
        let stableCount = 0;

        process.stdout.write("Generating");
        for (let i = 0; i < 90; i++) {
            await delay(2000);
            process.stdout.write(".");

            const currentText = await page.evaluate(() => document.body.innerText);
            if (currentText.length === lastText.length && currentText.length > 500) {
                stableCount++;
            } else {
                stableCount = 0;
                lastText = currentText;
            }

            if (stableCount > 8) break;
        }

        // Save
        const savePath = path.join(os.homedir(), 'Downloads', '2025_K_Culture_Report_RealChrome.txt');
        fs.writeFileSync(savePath, lastText);

        console.log(`\n✅ Saved to ${savePath}`);

        console.log("keeping browser open for you.");
        browser.disconnect();

    } catch (e) {
        console.error("Error:", e);
    }
}

main();
