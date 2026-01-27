import fs from 'fs';
import path from 'path';
import readline from 'readline';

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

const home = process.env.HOME || process.env.USERPROFILE || "";
const authPath = path.join(home, ".notebooklm-mcp", "auth.json");

console.log("\n=== NotebookLM MCP Authentication Helper ===\n");
console.log("This script will save your credentials to: " + authPath);
console.log("See instructions on how to get these values in the README or chat.\n");

function ask(question: string): Promise<string> {
    return new Promise((resolve) => {
        rl.question(question, (answer) => resolve(answer.trim()));
    });
}

async function main() {
    try {
        const cookie = await ask("Paste your 'Cookie' header string: ");
        const csrf = await ask("Paste your 'at' (CSRF) token: ");

        if (!cookie || !csrf) {
            console.error("\nError: Both Cookie and CSRF token are required.");
            process.exit(1);
        }

        // Parse cookies into object
        const cookieObj = cookie.split('; ').reduce((acc: any, curr: string) => {
            const [key, value] = curr.split('=');
            if (key && value) acc[key] = value;
            return acc;
        }, {});

        const authData = {
            cookies: cookieObj,
            csrf_token: csrf,
            updated_at: new Date().toISOString()
        };

        const dir = path.dirname(authPath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }

        fs.writeFileSync(authPath, JSON.stringify(authData, null, 2));
        console.log("\n✅ Successfully saved authentication tokens!");
        console.log("You can now use the NotebookLM MCP server.");

    } catch (error: any) {
        console.error("\n❌ Error saving tokens:", error.message);
    } finally {
        rl.close();
    }
}

main();
