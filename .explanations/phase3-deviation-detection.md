# Phase 3: Deviation Detection — Hybrid AI + Keyword Matching

## What it does
When a user navigates to a YouTube video with an active goal, the extension determines if the video is on-topic or off-topic. It tries Chrome's on-device AI (Gemini Nano) first, falling back to keyword matching if AI is unavailable.

## How it works

### Flow
```
Video navigation detected (Phase 2)
        ↓
Read goal from chrome.storage.local
        ↓ (skip if no active goal)
Wait 500ms for YouTube to update document.title
        ↓
Extract video title from document.title
        ↓
┌─── Try AI (ISOLATED → MAIN world bridge) ───┐
│  content.js dispatches intent-check-relevance │
│  injector.js receives, calls LanguageModel    │
│  injector.js dispatches intent-relevance-result│
└──────────────────────────────────────────────┘
        ↓
AI available? → Use AI verdict
AI unavailable/timeout? → Keyword fallback
        ↓
Log: [Intent] Title: "..." | ON-TOPIC/OFF-TOPIC (method: ai/keyword)
```

### Keyword matching (fallback)
1. Extract keywords from goal and title: lowercase, split on non-alphanumeric, remove stop words
2. Score = (goal keywords found in title) / (total goal keywords)
3. Score < 0.3 = off-topic

**Example:**
- Goal: "learn react hooks" → keywords: `[react, hooks]`
- Title: "React Hooks Tutorial" → keywords: `[react, hooks, tutorial]`
- Matched: 2/2 = 1.0 → ON-TOPIC

### Chrome AI (primary)
- Uses `LanguageModel` API (Gemini Nano, on-device)
- System prompt instructs: reply ON_TOPIC or OFF_TOPIC, be lenient
- Session is cached — creating is expensive (~500ms)
- If model needs downloading, the 3s timeout fires and keyword fallback runs

### Cross-world bridge
The AI runs in MAIN world (`injector.js`) because `LanguageModel` isn't accessible in ISOLATED world (`content.js`). Communication uses CustomEvents on `document`:

```
ISOLATED (content.js)              MAIN (injector.js)
       │                                  │
       ├── intent-check-relevance ──────→ │ (goal, title, requestId)
       │                                  │
       │ ←── intent-relevance-result ─────┤ (onTopic, method, requestId)
       │                                  │
```

Each request gets a unique `requestId` so rapid navigations don't mix up responses.

## Files changed
- `content/content.js` — keyword functions, AI bridge, hybrid `onVideoNavigation`
- `content/injector.js` — LanguageModel session, relevance check listener
