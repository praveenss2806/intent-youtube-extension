# Goal Reset Every Browser Session

## Problem
- Goals persisted forever in `chrome.storage.local` — stale goals carried over after browser restart
- `sessionStorage` overlay guard was per-tab — new tabs re-showed overlay even with active goal

## Solution

### Phase 1: Clear goal on browser startup
**File: `background/background.js`**
- Added `chrome.runtime.onStartup` listener
- Clears `goal`, `active`, `casual` on Chrome launch
- Preserves stats (`videosWatched`, `onTopic`, `offTopic`)

### Phase 2: Storage-based overlay guard
**File: `content/content.js` — `showGoalOverlay()`**
- Removed `sessionStorage` check
- Made function async, reads `{ active, casual }` from `chrome.storage.local`
- If either is true → skip overlay (user already chose this session)
- If both false → show overlay (fresh session after `onStartup` cleared them)

## Status: COMPLETE
