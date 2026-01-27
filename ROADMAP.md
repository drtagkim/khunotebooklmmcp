# Development Roadmap

## Architecture Principles (MUST KEEP)

### Router Pattern ✅
We use 6 router-style tools instead of 31 separate tools:
- `manage_notebook` - actions: list, get, create, rename, delete, configure
- `manage_source` - actions: add, rename, delete, sync, check_freshness
- `query_notebook` - chat with sources
- `perform_deep_research` - web research workflow
- `generate_artifact` - all artifact types
- `authenticate` - session management

**Why this matters:** 
- Smaller system prompt = faster LLM responses
- Less tokens consumed per request
- Agent doesn't get confused choosing between 31 tools

### Lightweight Dependencies ✅
- axios for HTTP (no heavy frameworks)
- No Pydantic-style serialization overhead
- Node.js excels at I/O-bound tasks

---

## Phase 1: Browser Authentication (Priority: HIGH)

**Goal:** Replace manual cookie copying with automated browser login

### Implementation:
```typescript
// New file: src/browser-auth.ts
import puppeteer from 'puppeteer';

async function browserLogin(): Promise<AuthTokens> {
    const browser = await puppeteer.launch({ headless: false });
    const page = await browser.newPage();
    
    await page.goto('https://notebooklm.google.com');
    // Wait for user to complete Google login
    await page.waitForNavigation({ waitUntil: 'networkidle0' });
    
    // Extract cookies and CSRF token
    const cookies = await page.cookies();
    const csrfToken = await page.evaluate(() => {
        // Extract 'at' token from page
    });
    
    await browser.close();
    return { cookies, csrfToken };
}
```

### New Tool:
```typescript
{
    name: "authenticate",
    inputSchema: {
        properties: {
            method: { enum: ["manual", "browser"] }, // NEW
            cookies: { type: "string" },
            csrfToken: { type: "string" }
        }
    }
}
```

---

## Phase 2: Extended Actions (Priority: MEDIUM)

### manage_source - New Actions:
- `sync` - Refresh Google Drive sources (RPC: FLmJqe)
- `check_freshness` - Check if sources are up-to-date (RPC: yR9Yof)

### manage_notebook - New Actions:
- `configure` - Set chat style, custom prompts

### generate_artifact - Better Type Support:
- `video` - Video overview with options
- `slides` - Presentation generator
- `quiz` - Interactive quiz
- `flashcards` - Study flashcards
- `infographic` - Visual summary

---

## Phase 3: Reliability (Priority: MEDIUM)

### Improved Polling:
- Better timeout handling
- Exponential backoff
- Clear error messages

### Mind Map Cleanup:
- Proper deletion (ID + Timestamp)
- No phantom artifacts

---

## Phase 4: Advanced Features (Priority: LOW)

### Studio Status Checking:
- Real-time progress for long artifacts
- Streaming support

### Batch Operations:
- Multiple source adds
- Bulk notebook management

---

## RPC IDs Reference (from Python)

| Feature | RPC ID | Status |
|---------|--------|--------|
| List Notebooks | wXbhsf | ✅ |
| Create Notebook | CCqFvf | ✅ |
| Rename Notebook | s0tc2d | ✅ |
| Delete Notebook | dGxHOe | ✅ |
| Get Notebook | bU14Ce | ✅ |
| Add Source | izAoDd | ✅ |
| Rename Source | blokQb | ✅ |
| Delete Source | RSr8Vc | ✅ |
| Start Research (Fast) | Ljjv0c | ✅ |
| Start Research (Deep) | QA9ei | ✅ |
| Poll Research | e3bVqc | ✅ |
| Import Research | LBwxtb | 🔧 |
| Mind Map | yyryJe | ✅ |
| Query/Chat | streaming | ✅ |
| Sync Drive | FLmJqe | ❌ TODO |
| Check Freshness | yR9Yof | ❌ TODO |
| Configure Chat | ? | ❌ TODO |

---

## Contributing

When adding new features:
1. **NEVER** add new top-level tools - extend existing routers
2. Keep dependencies minimal
3. Test with both fast and slow networks
4. Document RPC structures in code comments
