/**
 * Browser-based authentication for NotebookLM using Chrome Remote Debugging
 * 
 * This approach:
 * 1. Launches Chrome with remote debugging enabled
 * 2. User logs in manually (no automation, so no Google blocking)
 * 3. We extract cookies via CDP after login is complete
 * 
 * Based on jacob-bd/notebooklm-mcp approach.
 */

import { exec, execSync, spawn, ChildProcess } from 'child_process';
import fs from 'fs';
import path from 'path';
import os from 'os';
import http from 'http';

export interface AuthTokens {
    cookies: Record<string, string>;
    csrf_token: string;
}

const REMOTE_DEBUGGING_PORT = 9222;
const NOTEBOOKLM_URL = 'https://notebooklm.google.com/';

/**
 * Find Chrome executable path
 */
function findChrome(): string | null {
    const possiblePaths = [
        '/usr/bin/google-chrome',
        '/usr/bin/google-chrome-stable',
        '/usr/bin/chromium',
        '/usr/bin/chromium-browser',
        '/snap/bin/chromium',
        '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
        'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
        'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    ];

    for (const p of possiblePaths) {
        if (fs.existsSync(p)) {
            return p;
        }
    }
    return null;
}

/**
 * Check if Chrome is already running with remote debugging
 */
async function isDebugPortAvailable(): Promise<boolean> {
    return new Promise((resolve) => {
        const req = http.get(`http://127.0.0.1:${REMOTE_DEBUGGING_PORT}/json/version`, (res) => {
            resolve(true);
            res.resume();
        });
        req.on('error', () => resolve(false));
        req.setTimeout(1000, () => {
            req.destroy();
            resolve(false);
        });
    });
}

/**
 * Get WebSocket debugger URL from Chrome
 */
async function getDebuggerUrl(): Promise<string | null> {
    return new Promise((resolve) => {
        http.get(`http://127.0.0.1:${REMOTE_DEBUGGING_PORT}/json/version`, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    const json = JSON.parse(data);
                    resolve(json.webSocketDebuggerUrl || null);
                } catch {
                    resolve(null);
                }
            });
        }).on('error', () => resolve(null));
    });
}

/**
 * Get all pages/targets from Chrome
 */
async function getPages(): Promise<any[]> {
    return new Promise((resolve) => {
        http.get(`http://127.0.0.1:${REMOTE_DEBUGGING_PORT}/json/list`, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    resolve(JSON.parse(data));
                } catch {
                    resolve([]);
                }
            });
        }).on('error', () => resolve([]));
    });
}

/**
 * Extract cookies using CDP - connect to a specific page target
 */
async function extractCookiesViaCDP(): Promise<Record<string, string>> {
    const WebSocket = (await import('ws')).default;

    // Get the NotebookLM page target
    const pages = await getPages();
    const notebookPage = pages.find(p =>
        p.url &&
        p.url.includes('notebooklm.google.com') &&
        p.webSocketDebuggerUrl
    );

    if (!notebookPage || !notebookPage.webSocketDebuggerUrl) {
        // Fallback to browser-level endpoint
        const debuggerUrl = await getDebuggerUrl();
        if (!debuggerUrl) {
            throw new Error('Could not get Chrome debugger URL');
        }
        console.log('   Using browser-level endpoint...');
        return extractFromWebSocket(WebSocket, debuggerUrl);
    }

    console.log('   Connecting to NotebookLM page...');
    return extractFromWebSocket(WebSocket, notebookPage.webSocketDebuggerUrl);
}

/**
 * Extract cookies from a WebSocket connection
 */
async function extractFromWebSocket(WebSocket: any, wsUrl: string): Promise<Record<string, string>> {
    return new Promise((resolve, reject) => {
        console.log('   Opening WebSocket connection...');
        const ws = new WebSocket(wsUrl);
        let messageId = 1;
        let resolved = false;

        ws.on('open', () => {
            console.log('   Requesting cookies via CDP...');
            // First enable Network domain
            ws.send(JSON.stringify({
                id: messageId++,
                method: 'Network.enable'
            }));
            // Then request all cookies
            ws.send(JSON.stringify({
                id: messageId++,
                method: 'Network.getAllCookies'
            }));
        });

        ws.on('message', (data: Buffer) => {
            try {
                const response = JSON.parse(data.toString());
                if (response.result && response.result.cookies) {
                    const cookies: Record<string, string> = {};
                    for (const cookie of response.result.cookies) {
                        if (cookie.domain.includes('google.com') || cookie.domain.includes('notebooklm')) {
                            cookies[cookie.name] = cookie.value;
                        }
                    }
                    if (Object.keys(cookies).length > 0 && !resolved) {
                        resolved = true;
                        ws.close();
                        resolve(cookies);
                    }
                }
            } catch (e) {
                // Ignore parse errors
            }
        });

        ws.on('error', (err: Error) => {
            if (!resolved) {
                resolved = true;
                reject(new Error(`WebSocket error: ${err.message}`));
            }
        });

        // Increased timeout to 30 seconds
        setTimeout(() => {
            if (!resolved) {
                resolved = true;
                ws.close();
                reject(new Error('Timeout waiting for cookies (30s)'));
            }
        }, 30000);
    });
}

/**
 * Wait for user to log in and reach NotebookLM main page
 */
async function waitForLogin(maxWaitMinutes: number = 5): Promise<boolean> {
    const maxWait = maxWaitMinutes * 60 * 1000;
    const checkInterval = 2000;
    const startTime = Date.now();

    console.log('⏳ Waiting for you to log in...');
    console.log('   (Will auto-detect when you reach NotebookLM)\n');

    while (Date.now() - startTime < maxWait) {
        const pages = await getPages();

        // Check if any page is on NotebookLM (not accounts.google.com)
        const notebookPage = pages.find(p =>
            p.url &&
            p.url.includes('notebooklm.google.com') &&
            !p.url.includes('accounts.google.com') &&
            !p.url.includes('signin')
        );

        if (notebookPage) {
            console.log('✅ Login detected!');
            return true;
        }

        await new Promise(r => setTimeout(r, checkInterval));
    }

    return false;
}

/**
 * Main browser login function
 */
export async function browserLogin(): Promise<AuthTokens> {
    console.log('🔐 NotebookLM Authentication');
    console.log('============================\n');

    // Find Chrome
    const chromePath = findChrome();
    if (!chromePath) {
        throw new Error('Chrome not found. Please install Google Chrome.');
    }
    console.log(`✅ Found Chrome: ${chromePath}`);

    // Check if Chrome is already running with debugging
    const alreadyRunning = await isDebugPortAvailable();

    if (alreadyRunning) {
        console.log('⚠️  Chrome is already running with remote debugging.');
        console.log('   Using existing session...\n');
    } else {
        // Check if Chrome is running at all (without debugging)
        try {
            execSync('pgrep -x chrome || pgrep -x chromium || pgrep -x google-chrome', { stdio: 'pipe' });
            console.log('\n❌ Chrome is running but without remote debugging enabled.');
            console.log('   Please close Chrome completely (Cmd+Q or quit from taskbar) and try again.\n');
            throw new Error('Chrome is running without remote debugging. Please close Chrome and try again.');
        } catch {
            // Chrome is not running, we can start it
        }

        // Create profile directory
        const profileDir = path.join(os.homedir(), '.notebooklm-mcp', 'chrome-profile');
        if (!fs.existsSync(profileDir)) {
            fs.mkdirSync(profileDir, { recursive: true });
        }

        console.log('🚀 Launching Chrome with remote debugging...\n');

        // Launch Chrome with remote debugging
        const chromeArgs = [
            `--remote-debugging-port=${REMOTE_DEBUGGING_PORT}`,
            '--remote-allow-origins=*',
            `--user-data-dir=${profileDir}`,
            '--no-first-run',
            '--no-default-browser-check',
            NOTEBOOKLM_URL
        ];

        const chrome = spawn(chromePath, chromeArgs, {
            detached: true,
            stdio: 'ignore'
        });
        chrome.unref();

        // Wait for Chrome to start
        await new Promise(r => setTimeout(r, 3000));

        // Verify debugging is available
        const available = await isDebugPortAvailable();
        if (!available) {
            throw new Error('Failed to connect to Chrome. Make sure no other Chrome instances are running.');
        }
    }

    // Wait for user to log in
    const loggedIn = await waitForLogin(5);
    if (!loggedIn) {
        throw new Error('Login timeout. Please try again and log in within 5 minutes.');
    }

    // Extract cookies
    console.log('\n🍪 Extracting cookies...');
    const cookies = await extractCookiesViaCDP();

    if (Object.keys(cookies).length === 0) {
        throw new Error('No cookies extracted. Please make sure you are logged in.');
    }

    // Try to extract CSRF token by visiting the page
    let csrfToken = '';
    // The CSRF token needs to be extracted from page content - for now we'll leave it empty
    // The client will try to extract it when needed

    console.log(`✅ Extracted ${Object.keys(cookies).length} cookies`);

    // Save to file
    const authData: AuthTokens = {
        cookies,
        csrf_token: csrfToken
    };

    const authDir = path.join(os.homedir(), '.notebooklm-mcp');
    const authPath = path.join(authDir, 'auth.json');

    if (!fs.existsSync(authDir)) {
        fs.mkdirSync(authDir, { recursive: true });
    }

    fs.writeFileSync(authPath, JSON.stringify(authData, null, 2));

    console.log(`📁 Saved to: ${authPath}`);
    console.log('\n✅ SUCCESS! You can now close the browser.');
    console.log('   The MCP server will use the saved credentials.\n');

    return authData;
}

/**
 * CLI entry point
 */
async function main() {
    try {
        await browserLogin();
        process.exit(0);
    } catch (error: any) {
        console.error('\n❌ Authentication failed:', error.message);
        console.error('\nTroubleshooting:');
        console.error('  1. Make sure Chrome is completely closed before running');
        console.error('  2. Try running: killall chrome google-chrome chromium');
        console.error('  3. If issues persist, use manual authentication with the authenticate tool\n');
        process.exit(1);
    }
}

// Run if executed directly
const isMainModule = import.meta.url === `file://${process.argv[1]}`;
if (isMainModule) {
    main();
}
