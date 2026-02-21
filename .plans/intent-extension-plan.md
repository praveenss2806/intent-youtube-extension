# Intent - YouTube Focus Chrome Extension

## Context
Chrome extension (MV3) that helps users stay focused on YouTube. On every YouTube page load, a full-screen overlay asks for a goal or casual browsing. If goal is set, extension monitors navigation and nudges when user drifts off-topic. Icon popup also available to change goal anytime.

## Progress
- [x] Phase 1: Scaffold + Popup
- [x] Phase 1.5: YouTube Goal Overlay
- [x] Phase 2: YouTube SPA Navigation Detection
- [ ] Phase 3: Deviation Detection
- [ ] Phase 4: Nudge UI
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
    content.js               # Goal overlay + (future) nav detection, deviation, nudge
    injector.js              # [stub] Patches History API (MAIN world, document_start)
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
- **`content/injector.js`** (MAIN world, `document_start`):
  - Override `history.pushState` + `history.replaceState`
  - Dispatch `intent-url-change` CustomEvent on `document` (bridges MAIN→ISOLATED world)
  - Listen `popstate` for back/forward
- **`content/content.js`** (ISOLATED world, `document_idle`):
  - Listen for `intent-url-change` event
  - Handle initial page load
  - Filter: only act on `/watch` and `/shorts/` URLs
  - Debounce 800ms

### Verify
Console logs on every YouTube navigation.

---

## Phase 3: Deviation Detection  ⬅️ NEXT

### Goal
Compare current video against user's stated goal using keyword matching.

### Implementation (in `content/content.js`)
- Extract video title from `document.title` → strip " - YouTube"
- Split goal into keywords, remove stop words, lowercase
- Relevance = matched keywords / total goal keywords
- Threshold: relevance < 0.3 → off-topic
- Wait 500ms after navigation for title to update

### Stop words list
`a, an, the, to, is, how, for, and, in, on, of, it, i, my, me, we, do, be, so, no, or, if, by, at, up, as`

---

## Phase 4: Nudge UI

### Goal
Non-intrusive dismissible banner when deviation detected.

### Implementation
- **`content/nudge.css`**: Fixed top-center toast, dark bg, z-index 9999, slide animation
- **Nudge DOM** (created in `content.js`):
  - Message: "You're drifting from your goal: **[goal]**"
  - "Dismiss" button → hide + add video to cooldown set
  - "Back on Track" button → navigate to YouTube search with goal
  - Auto-dismiss after 10s
- All classes prefixed `intent-` with `!important`
- In-memory dismissed set (per page session) prevents re-nudge on same video

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
[injector.js] --intent-url-change--> [content.js]
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
