
import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import fs from 'fs';
import path from 'path';
import os from 'os';

puppeteer.use(StealthPlugin());

function delay(time) {
    return new Promise(resolve => setTimeout(resolve, time));
}

async function main() {
    console.log("🚀 Connecting to Chrome (User Profile)...");

    try {
        const browser = await puppeteer.connect({
            browserURL: 'http://127.0.0.1:9222',
            defaultViewport: null
        });

        console.log("✅ Connected!");

        const pages = await browser.pages();
        let page = pages[0];
        if (!page) page = await browser.newPage();

        // Check if we are already on NotebookLM
        const currentUrl = page.url();
        if (!currentUrl.includes('notebooklm.google.com')) {
            console.log("Navigating to NotebookLM...");
            await page.goto('https://notebooklm.google.com/', { waitUntil: 'networkidle2' });
        } else {
            console.log("Already on NotebookLM");
            await page.reload({ waitUntil: 'networkidle2' });
        }

        // Logic to verify login
        if (page.url().includes('accounts.google.com')) {
            console.log("⚠️ NOT Logged In. Please login in the browser window manually.");
            while (!page.url().includes('notebooklm.google.com') || page.url().includes('accounts')) {
                await delay(2000);
            }
            console.log("✅ Login confirmed.");
        }

        // Research Process
        console.log("Starting research flow...");

        let inNotebook = false;

        // 1. Check if we are inside a notebook (look for chat input)
        if (await page.$('textarea')) {
            console.log("Already inside a notebook.");
            inNotebook = true;
        } else {
            // 2. Try to find the specific notebook for K-Culture
            try {
                // Wait for list to load
                await delay(3000);

                // Scan for text
                const notebookTitle = "2025 K-Culture Report";
                const found = await page.evaluate((title) => {
                    const els = Array.from(document.querySelectorAll('div, a, span'));
                    const match = els.find(el => el.innerText && el.innerText.includes(title));
                    if (match) {
                        const clickable = match.closest('div[role="button"], a, mat-card');
                        if (clickable) {
                            clickable.click();
                            return true;
                        }
                    }
                    return false;
                }, notebookTitle);

                if (found) {
                    console.log(`Open notebook: ${notebookTitle}`);
                    inNotebook = true;
                } else {
                    // Create New
                    console.log("Creating new notebook...");
                    await page.evaluate(() => {
                        const els = Array.from(document.querySelectorAll('div, span'));
                        const createBtn = els.find(el => el.innerText && el.innerText.includes('New notebook'));
                        if (createBtn) createBtn.click();
                    });
                    inNotebook = true;
                }
            } catch (e) {
                console.error("Navigation error:", e);
            }
        }

        if (!inNotebook) {
            console.log("⚠️ Could not automate navigation. Please click on the notebook manually.");
            await delay(10000);
        } else {
            await delay(5000);
        }

        // Send Query
        const query = `
2025년 K-컬처(한류)를 빛낸 10대 인물을 선정해서 보고서를 작성해줘.
1. K-Pop (뉴진스 등)
2. K-Drama (오징어게임2 배우 등)
3. 영화, 문학 (한강 등)
등 다양한 분야 포함.
각 인물의 성과와 선정 이유를 마크다운 리포트로 작성.
        `;

        console.log("Typing query...");
        const chatSelector = 'textarea';
        await page.waitForSelector(chatSelector, { timeout: 60000 });

        await page.type(chatSelector, query);
        await delay(1000);
        await page.keyboard.press('Enter');

        console.log("Researching... (This takes about 1-2 minutes)");

        let lastText = "";
        let stable = 0;

        process.stdout.write("Generating");
        for (let i = 0; i < 150; i++) {
            await delay(2000);
            process.stdout.write(".");

            const text = await page.evaluate(() => document.body.innerText);
            if (text.length > lastText.length) {
                lastText = text;
                stable = 0;
            } else {
                stable++;
            }

            if (stable > 15 && lastText.length > 500) break;
        }

        // Save
        const filePath = path.join(os.homedir(), 'Downloads', '2025_K_Culture_Report_Final.md');
        fs.writeFileSync(filePath, lastText);

        console.log(`\n✅ Saved report to: ${filePath}`);

        browser.disconnect();

    } catch (e) {
        console.error("Error:", e);
    }
}

main();
