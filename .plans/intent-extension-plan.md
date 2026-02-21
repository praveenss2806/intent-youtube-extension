# Intent - YouTube Focus Chrome Extension

## Context
Chrome extension (MV3) that helps users stay focused on YouTube. On every YouTube page load, a full-screen overlay asks for a goal or casual browsing. If goal is set, extension monitors navigation and nudges when user drifts off-topic. Icon popup also available to change goal anytime.

## Progress
- [x] Phase 1: Scaffold + Popup
- [x] Phase 1.5: YouTube Goal Overlay
- [x] Phase 2: YouTube SPA Navigation Detection
- [x] Phase 3: Deviation Detection (Hybrid AI + Keyword)
- [x] Phase 4: Nudge UI
- [ ] Phase 5: Stats + Polish

---

## Project Structure
```
intent-youtube-extension/
  manifest.json              # MV3 manifest
  popup/
    popup.html               # 3 views: goal input, active goal, casual mode
    popup.js                 # State mgmt via chrome.storage.local
    popup.css                # Dark theme (YouTube-like)
  content/
    content.js               # Goal overlay + SPA nav detection + (future) deviation, nudge
    injector.js              # History API patching fallback (MAIN world, document_start)
    nudge.css                # Overlay styles + (future) nudge styles
  background/
    background.js            # Service worker — inits defaults on install
  icons/
    icon16.png               # Blue circle "I" placeholder
    icon48.png
    icon128.png
```

---

## Phase 1: Scaffold + Popup  ✅ DONE

### What was built
- **manifest.json**: MV3, permissions `storage` + `activeTab`, host `*://*.youtube.com/*`
- Two content script entries: `injector.js` (MAIN world, document_start) + `content.js`/`nudge.css` (ISOLATED, document_idle)
- **popup**: 3-view UI (goal input → active goal → casual browsing), dark theme
- **background.js**: Inits defaults on `chrome.runtime.onInstalled` including stats counters
- **icons**: 16/48/128px blue circle placeholder PNGs

### Storage schema
```js
{
  goal: string | null,   // user's focus goal text
  active: boolean,       // true when goal is set
  casual: boolean,       // true when "Just Browsing" selected
  videosWatched: number, // total videos navigated to
  onTopic: number,       // videos matching goal
  offTopic: number       // videos not matching goal
}
```

### Key decisions
- 3 popup views managed by toggling `.hidden` class
- `casual` flag separate from `active` to distinguish "no state yet" vs "chose casual"
- Enter key submits goal input
- Dark theme (#0f0f0f bg, #3ea6ff accent) to match YouTube

---

## Phase 1.5: YouTube Goal Overlay  ✅ DONE

### What was built
- **`content/content.js`**: On every YouTube page load, injects full-screen overlay
  - `showGoalOverlay()` — creates overlay DOM, appends to `document.body`
  - Goal text input (auto-focused after 100ms)
  - "Set Goal" button → saves `{ goal, active: true, casual: false }` to storage → dismisses
  - "Just Browsing" button → saves `{ goal: null, active: false, casual: true }` → dismisses
  - Enter key submits goal
  - `dismissOverlay()` — adds fade-out class, removes after 300ms animation
  - Guard: skips if `document.body` not ready (retries on DOMContentLoaded)
  - Guard: skips if overlay already exists (no double-inject)

- **`content/nudge.css`**: Overlay styles
  - Full-viewport fixed overlay with `backdrop-filter: blur(8px)`, rgba black bg
  - z-index 99999 to sit above all YouTube UI
  - Centered card: #181818 bg, 16px border-radius, 380px width
  - Input: dark bg, blue focus border (#3ea6ff)
  - Primary btn: #3ea6ff, Secondary btn: #272727
  - `intent-fade-in` / `intent-fade-out` keyframe animations
  - All classes `intent-` prefixed with `!important` to avoid YouTube CSS conflicts

### Trigger behavior
- Overlay shows **every time** youtube.com loads (not just first time)
- Icon popup still works independently to view/change goal

---

## Phase 2: YouTube SPA Navigation Detection  ✅ DONE

### Goal
Detect every video navigation in YouTube's SPA.

### Implementation
- **Primary: `yt-navigate-finish`** (YouTube's built-in SPA event)
  - `content.js` listens for `yt-navigate-finish` on `document` — works directly in ISOLATED world
  - Most reliable method; no cross-world bridge needed
- **Fallback: `content/injector.js`** (MAIN world, `document_start`):
  - Override `history.pushState` + `history.replaceState`
  - Dispatch `intent-url-change` CustomEvent on `document` (bridges MAIN→ISOLATED world)
  - Listen `popstate` for back/forward
  - Note: History API patching alone was unreliable on YouTube — may not fire
- **`content/content.js`** (ISOLATED world, `document_idle`):
  - Listen for both `yt-navigate-finish` and `intent-url-change` events
  - Handle initial page load via `onVideoNavigation(location.href)`
  - Filter: only act on `/watch` and `/shorts/` URLs
  - Debounce 800ms — YouTube fires multiple events per navigation

### Verify
`[Intent] Video navigation: <url>` in console on every YouTube video click.

---

## Phase 3: Deviation Detection (Hybrid AI + Keyword)  ✅ DONE

### Goal
Compare current video against user's goal. Primary: Chrome Built-in AI (Gemini Nano). Fallback: keyword matching.

### Implementation
- **`content/content.js`** (ISOLATED world):
  - `STOP_WORDS` set (26 common English words)
  - `extractKeywords(text)` — lowercase, split, filter stops
  - `getVideoTitle()` — `document.title` minus " - YouTube"
  - `calculateRelevance(goalKw, titleKw)` — matched / total ratio
  - `checkRelevanceKeyword(goal, title)` — threshold: < 0.3 = off-topic
  - `requestAIRelevanceCheck(goal, title)` — dispatches `intent-check-relevance` to MAIN world, waits for `intent-relevance-result` with matching `requestId`, 3s timeout
  - `onVideoNavigation(url)` — async, reads goal from storage, waits 500ms for title update, tries AI → falls back to keyword

- **`content/injector.js`** (MAIN world):
  - `AI_SYSTEM_PROMPT` — classify ON_TOPIC/OFF_TOPIC, lenient bias
  - `getAISession()` — checks `LanguageModel` API availability, creates cached session
  - `intent-check-relevance` listener — runs AI prompt, dispatches result back with `requestId`
  - Graceful error handling — nulls stale session, sends `available: false`

### Key decisions
- Hybrid approach: AI-first with keyword fallback ensures it works on any Chrome version
- `requestId` counter prevents result mismatches during rapid navigation
- 3s timeout covers AI model download delay — keyword fallback activates while model loads
- AI prompt biased lenient (defaults to ON_TOPIC on ambiguous response) to avoid false nudges

### Verify
Console on video navigation: `[Intent] Title: "..." | ON-TOPIC/OFF-TOPIC (method: ai/keyword)`

---

## Phase 4: Nudge UI  ✅ DONE

### Goal
Non-intrusive dismissible banner when deviation detected.

### Implementation
- **`content/nudge.css`**:
  - `.intent-nudge` — fixed top-center toast, dark bg (#181818), z-index 9999
  - `intent-slide-down` / `intent-slide-up` keyframe animations
  - `.intent-nudge-message` — white text, goal highlighted in blue (#3ea6ff)
  - `.intent-nudge-btn-action` — blue "Back on Track" button
  - `.intent-nudge-btn-dismiss` — subtle gray "Dismiss" button
- **`content/content.js`**:
  - `_dismissedVideos` Set — tracks dismissed URLs per page session
  - `showNudge(goal)` — creates toast DOM, appends to body, sets up button handlers
  - `dismissNudge(nudge)` — slide-up animation + remove from DOM
  - "Back on Track" → `window.location.href` to YouTube search (same tab)
  - "Dismiss" → adds URL to cooldown, slides out
  - Auto-dismiss after 10s
  - Prevents stacking (removes existing nudge before showing new one)

### Key decisions
- Same-tab navigation for "Back on Track" — stronger nudge, removes distraction
- Slide-down from top — more noticeable than fade-in
- Per-URL cooldown in memory — dismissed video won't re-trigger until full page reload
- Auto-dismiss 10s — non-intrusive, doesn't block YouTube permanently

### Verify
Off-topic video → toast slides down with goal text. "Dismiss" → slides up, no re-nudge. "Back on Track" → YouTube search. 10s → auto-dismiss.

---

## Phase 5: Stats + Polish

### Goal
Session stats + edge case handling.

### Implementation
- Increment `videosWatched`, `onTopic`, `offTopic` in storage on each check
- Popup shows stats: "Videos: X | On-topic: Y | Off-topic: Z" + reset button
- `chrome.storage.onChanged` listener in content.js for live goal updates
- Edge cases: skip homepage, handle Shorts URLs, handle playlists
- "Clear Goal" in popup (already built in Phase 1)
- Placeholder SVG icons (already built in Phase 1)

---

## Data Flow
```
[YouTube loads] --> [content.js shows goal overlay]
                           |
              user sets goal/casual --> [chrome.storage.local]
                                              |
[Icon Popup] --can also change goal--> [chrome.storage.local]
                                              |
                                   [content.js listens onChanged]
                                              |
[yt-navigate-finish / injector.js] --> [content.js]
                                              |
                                   [extract title, keyword match]
                                              |
                          relevance < 0.3 → showNudge()
                                              |
                          "Back on Track" → YouTube search
                          "Dismiss" → hide, cooldown
```

## Verification (end-to-end)
1. Load unpacked at `chrome://extensions`
2. Open youtube.com → goal overlay appears over blurred YouTube
3. Type goal "learn react hooks" → click "Set Goal" → overlay dismisses
4. Watch React tutorial → no nudge
5. Navigate to cooking video → nudge appears
6. "Dismiss" → hides, no re-nudge for same video
7. "Back on Track" → YouTube search for goal
8. Open new YouTube tab → overlay appears again (every time)
9. Click "Just Browsing" → overlay dismisses, no nudges
10. Click extension icon → popup shows current goal, can change it
11. Check stats in popup
