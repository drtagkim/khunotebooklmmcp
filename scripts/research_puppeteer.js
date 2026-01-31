
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

    const userDataDir = path.join(os.homedir(), '.notebooklm-mcp', 'chrome-profile');

    // Launch browser
    const browser = await puppeteer.launch({
        headless: false, // Show browser so user can see/interact if needed
        executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', // Adjust if needed
        userDataDir: userDataDir,
        args: ['--no-first-run', '--no-default-browser-check']
    });

    try {
        const page = await browser.newPage();
        await page.setViewport({ width: 1280, height: 800 });

        console.log("Navigating to NotebookLM...");
        await page.goto('https://notebooklm.google.com/', { waitUntil: 'networkidle2' });

        // Wait for login or list
        // Try to find "Create new" button or list of notebooks
        // Selectors might need adjustment based on current UI.
        // Assuming there is a "New Notebook" card which often has text "New notebook"

        console.log("Waiting for notebook list...");
        await delay(5000); // Wait for hydration

        // Check if we need to login (redirected)
        if (page.url().includes('accounts.google.com')) {
            console.error("❌ Not logged in. Please run `npm run login` first.");
            await browser.close();
            process.exit(1);
        }

        // 1. Look for existing "2025 K-Culture Report" or create new
        // The UI is Grid of cards.
        // We'll search for text "2025 K-Culture Report"

        // Simple approach: Click "New notebook" button
        // The button usually has a specific class or text.
        // Let's try to find based on aria-label or text content

        const notebookLink = await page.evaluateHandle(() => {
            const elements = Array.from(document.querySelectorAll('div, a'));
            return elements.find(el => el.textContent.includes('2025 K-Culture Report'));
        });

        if (notebookLink && notebookLink.asElement()) {
            console.log("Found existing notebook. Clicking...");
            await notebookLink.asElement().click();
        } else {
            console.log("Creating new notebook...");
            // Click "New notebook"
            // Usually the first card with "New notebook" text
            const createBtn = await page.evaluateHandle(() => {
                const divs = Array.from(document.querySelectorAll('div[role="button"], div.mat-mdc-card'));
                return divs.find(el => el.textContent.includes('New notebook') || el.textContent.includes('Create'));
            });

            if (createBtn && createBtn.asElement()) {
                await createBtn.asElement().click();

                // Wait for Title Input
                await delay(3000);

                // Rename title if possible, or just skip
                // Title is usually an input[type="text"] or editable div
                // We will just proceed to chat
            } else {
                throw new Error("Could not find Create Notebook button");
            }
        }

        await delay(5000); // Wait for notebook to load

        // 2. Locate Chat Input
        // Textarea placeholder "Type a question..." or similar
        console.log("Locating chat input...");
        const chatSelector = 'textarea';
        await page.waitForSelector(chatSelector, { timeout: 10000 });

        const topic = "2025년 K-컬처(한류)를 빛낸 10대 인물과 주요 성과. K-Pop(NewJeans 등), K-Drama(오징어게임2 배우 등), 영화, 문학(한강 작가 등). 1. 이름 - 업적 형식으로 자세히 리포트 작성해줘.";

        await page.type(chatSelector, topic);
        await page.keyboard.press('Enter');

        console.log("Query sent. Waiting for response...");

        // 3. Wait for response
        // Generating indicator...
        await delay(5000);

        // Wait until generation stops.
        // We can poll for the last message content.
        let lastText = "";
        let stabilityCount = 0;

        process.stdout.write("Generating");
        for (let i = 0; i < 60; i++) { // Max 2 minutes
            await delay(2000);
            process.stdout.write(".");

            // Get the last response bubble
            // Selectors are tricky. Usually in a scrollable container.
            // We'll grab all text from the chat container and take the last chunk
            const currentText = await page.evaluate(() => {
                const bubbles = document.querySelectorAll('.model-response, .response-message'); // Guessing class names
                if (bubbles.length > 0) {
                    return bubbles[bubbles.length - 1].innerText;
                }
                // Fallback: get all text and split?
                return document.body.innerText;
            });

            if (currentText && currentText.length > lastText.length) {
                lastText = currentText;
                stabilityCount = 0;
            } else if (currentText && currentText.length === lastText.length && currentText.length > 100) {
                stabilityCount++;
            }

            if (stabilityCount > 5) { // 10 seconds of no change
                console.log("\nResponse stabilized.");
                break;
            }
        }

        // Extract content
        // In Puppeteer we can just dump the `lastText`

        if (!lastText) {
            console.warn("\nCould not extract specific text. Dumping page content...");
            lastText = await page.evaluate(() => document.body.innerText);
        }

        // 4. Save to file
        const downloadsPath = path.join(os.homedir(), 'Downloads', '2025_K_Culture_Report_Puppeteer.md');

        const report = `# K-Culture Research Result\n\n${lastText}\n\nGenerated by Antigravity`;
        fs.writeFileSync(downloadsPath, report);

        console.log(`\n✅ Saved to ${downloadsPath}`);

        await delay(2000);
        await browser.close();

    } catch (e) {
        console.error("\n❌ Error:", e);
        // await browser.close(); // Keep open for debugging if failed
    }
}

main();
