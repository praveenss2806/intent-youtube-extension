# Phase 2: SPA Navigation Detection — Explained

## The Problem

YouTube is a **Single Page Application (SPA)**. When you click a video, YouTube doesn't do a full page reload — it updates the URL and swaps content using JavaScript. This means our content script (`content.js`) only runs **once** when you first open YouTube, not on every video click.

We need a way to detect these in-app navigations.

## The Solution: History API Patching

Browsers have a `history` object with `pushState()` and `replaceState()` methods. SPAs like YouTube call these to change the URL without reloading. We **monkey-patch** (override) these methods to fire a custom event every time YouTube navigates.

## Two Worlds, One Bridge

Chrome extensions run content scripts in two possible "worlds":

| World | Can access page JS? | Can use chrome APIs? |
|-------|---------------------|---------------------|
| **MAIN** | Yes | No |
| **ISOLATED** | No | Yes |

- `injector.js` runs in **MAIN** world — it can override `history.pushState` because it shares the page's JavaScript context
- `content.js` runs in **ISOLATED** world — it can use `chrome.storage` but can't see the page's JS

**Bridge**: `injector.js` dispatches a `CustomEvent` on `document`. Both worlds share the same DOM, so `content.js` can listen for it.

```
[YouTube calls history.pushState()]
    ↓
[Our patched version runs]
    ↓
[Dispatches 'intent-url-change' CustomEvent on document]
    ↓
[content.js (ISOLATED world) hears the event]
    ↓
[Runs onVideoNavigation() with the new URL]
```

## How injector.js Works

```js
// Save the original method
const originalPushState = history.pushState.bind(history);

// Replace it with our version
history.pushState = function (...args) {
  originalPushState(...args);  // Call the original first
  notifyNavigation();          // Then fire our custom event
};
```

We do the same for `replaceState`, and also listen for `popstate` (browser back/forward buttons).

Everything is wrapped in an **IIFE** `(function() { ... })()` to avoid leaking variables into YouTube's global scope.

## How content.js Handles It

### Filtering
Not every URL change matters. We only care about **video pages**:
- `/watch?v=...` — regular videos
- `/shorts/...` — YouTube Shorts

Home page, search results, channel pages → ignored.

### Debouncing
YouTube sometimes fires **multiple** `pushState` calls for a single navigation (e.g. updating URL params). We use an 800ms debounce: wait for the URL changes to settle, then process only the final URL.

```
Click video → pushState fires → timer starts (800ms)
             → pushState fires again → timer resets (800ms)
             → ... quiet ...
             → 800ms passes → onVideoNavigation() runs once
```

### Initial Page Load
When `content.js` first runs (on a full page load), the injector hasn't dispatched any events yet. So we manually call `onVideoNavigation(location.href)` to handle the case where the user navigated directly to a video URL.

## What Happens Now

Right now Phase 2 just logs to the console:
```
[Intent] Video navigation: https://www.youtube.com/watch?v=abc123
```

Phase 3 will replace this log with actual deviation detection (comparing the video title against the user's goal).
