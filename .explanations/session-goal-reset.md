# Session Goal Reset — Explanation

## What changed

Two small but important changes that fix how goals persist across browser sessions.

### 1. `background/background.js` — `onStartup` listener

```js
chrome.runtime.onStartup.addListener(() => {
  chrome.storage.local.set({ goal: null, active: false, casual: false });
});
```

`chrome.runtime.onStartup` fires **once** when the user launches Chrome (not on service worker restarts). It clears the session-specific flags (`goal`, `active`, `casual`) while leaving stats intact. This means every new browser session starts fresh — the user will see the goal overlay again.

### 2. `content/content.js` — `showGoalOverlay()` now async

**Before**: Used `sessionStorage` to track if overlay was shown. Problem: `sessionStorage` is per-tab, so every new YouTube tab showed the overlay again even if a goal was already active.

**After**: Reads `{ active, casual }` from `chrome.storage.local`. Since storage is shared across all tabs, once a user sets a goal in one tab, no other tab shows the overlay. And since `onStartup` clears these flags, the overlay correctly reappears after a browser restart.

## Key design insight

`chrome.storage.local` now serves double duty:
1. **Within a session** — shared across all tabs (replaces per-tab `sessionStorage`)
2. **Across sessions** — cleared by `onStartup` (replaces manual expiry logic)

This is simpler than alternatives like `chrome.storage.session` (which requires `setAccessLevel` calls) and works reliably with MV3 service worker lifecycle.
