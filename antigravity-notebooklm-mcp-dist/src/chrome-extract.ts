/**
 * Extract cookies from your existing Chrome session.
 * 
 * This reads cookies directly from Chrome's cookie database,
 * avoiding the need for Puppeteer automation that Google detects.
 */

import fs from 'fs';
import path from 'path';
import os from 'os';
import { execSync } from 'child_process';

interface AuthTokens {
    cookies: Record<string, string>;
    csrf_token: string;
}

/**
 * Find Chrome's cookies database path
 */
function findCookiesDb(): string | null {
    const home = os.homedir();
    const possiblePaths = [
        // Linux
        path.join(home, '.config/google-chrome/Default/Cookies'),
        path.join(home, '.config/chromium/Default/Cookies'),
        path.join(home, 'snap/chromium/common/chromium/Default/Cookies'),
        // macOS
        path.join(home, 'Library/Application Support/Google/Chrome/Default/Cookies'),
        // Windows
        path.join(home, 'AppData/Local/Google/Chrome/User Data/Default/Network/Cookies'),
    ];

    for (const p of possiblePaths) {
        if (fs.existsSync(p)) {
            return p;
        }
    }
    return null;
}

/**
 * Extract NotebookLM cookies from Chrome's database
 */
export async function extractChromeSession(): Promise<AuthTokens | null> {
    console.log('🔍 Looking for Chrome cookies database...');

    const cookiesDb = findCookiesDb();
    if (!cookiesDb) {
        console.error('❌ Chrome cookies database not found.');
        console.error('   Make sure you are logged into NotebookLM in Chrome first.');
        return null;
    }

    console.log(`✅ Found: ${cookiesDb}`);
    console.log('⚠️  Note: Chrome must be closed to read cookies.\n');

    // Chrome cookies are encrypted on Linux/Mac, we need sqlite3 at minimum
    try {
        // Try using sqlite3 to extract cookies
        const tempDb = '/tmp/notebooklm-cookies-copy.db';
        execSync(`cp "${cookiesDb}" "${tempDb}"`, { stdio: 'pipe' });

        // This is a simplified extraction - Chrome encrypts cookies on Linux
        // For full solution, would need to decrypt using DPAPI (Windows) or keychain (Mac)

        console.log('⚠️  Chrome encrypts cookies on modern systems.');
        console.log('   For now, please use manual authentication:');
        console.log('');
        console.log('   1. Open Chrome DevTools (F12) on notebooklm.google.com');
        console.log('   2. Go to Network tab');
        console.log('   3. Refresh the page');
        console.log('   4. Click any request to notebooklm.google.com');
        console.log('   5. Copy the "Cookie" header value');
        console.log('   6. Find "at=" parameter in Request Payload');
        console.log('');

        fs.unlinkSync(tempDb);
        return null;

    } catch (error: any) {
        console.error('❌ Failed to extract cookies:', error.message);
        return null;
    }
}

// CLI entry point
async function main() {
    const result = await extractChromeSession();
    if (result) {
        console.log('✅ Successfully extracted session!');
    } else {
        console.log('\n📋 Use the authenticate tool with manual cookies instead.');
    }
}

const isMainModule = import.meta.url === `file://${process.argv[1]}`;
if (isMainModule) {
    main();
}
