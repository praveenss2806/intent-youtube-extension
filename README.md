# Intent — Focused YouTube

<p align="center">
  <img src="icons/icon128.png" alt="Intent logo" width="80" />
</p>

<p align="center">
  <strong>Set a goal before you browse. Stay on track while you watch.</strong>
</p>

A Chrome extension that helps you stay focused on YouTube. When you open YouTube, Intent asks what you came to learn — then nudges you when you drift off-topic.

## How It Works

1. **Set a goal** — On your first YouTube visit each browser session, a full-screen overlay asks: *"What brings you to YouTube?"* Type a goal like "Learn React hooks" or choose "Just Browsing."
2. **Watch videos** — Intent silently checks each video you navigate to against your goal using a hybrid AI + keyword matching system.
3. **Get nudged** — If you drift off-topic, a blocking modal appears with your goal as a reminder. Choose to get back on track or deliberately keep watching.
4. **Track progress** — The popup shows session stats: videos watched, on-topic count, and off-topic count.

## Features

- **Session-scoped goals** — Goals automatically reset when you close Chrome. Fresh start every session, stats persist.
- **Hybrid relevance detection** — Uses Chrome's built-in Gemini Nano AI when available, falls back to keyword matching.
- **SPA-aware** — Detects YouTube's single-page navigations (no page reloads to miss).
- **Cross-tab sync** — Set a goal in one tab, it applies everywhere. No duplicate overlays.
- **Glassmorphism UI** — Frosted glass design with YouTube's red color scheme.
- **Zero build step** — Plain JS/CSS/HTML. No bundler, no framework.

## Install

1. Clone or download this repo
2. Open `chrome://extensions` in Chrome
3. Enable **Developer Mode** (top right)
4. Click **Load unpacked** → select this repo's root folder
5. Navigate to YouTube — the goal overlay appears

## Project Structure

```
├── manifest.json              # MV3 extension manifest
├── background/
│   └── background.js          # Service worker — initializes state, clears goals on startup
├── content/
│   ├── content.js             # ISOLATED world — overlay, navigation detection, nudge logic
│   ├── injector.js            # MAIN world — History API patching, Chrome AI bridge
│   └── nudge.css              # Styles for overlay, nudge modal, glassmorphism effects
├── popup/
│   ├── popup.html             # Extension popup — goal input, active view, casual view
│   ├── popup.css              # Popup styles
│   └── popup.js               # Popup state machine and stats display
└── icons/
    ├── icon.svg               # Source icon (red gradient)
    ├── icon16.png             # Toolbar icon
    ├── icon48.png             # Extensions page icon
    └── icon128.png            # Chrome Web Store icon
```

## Architecture

Three execution contexts communicate via `chrome.storage.local`:

| Context | Files | World | Purpose |
|---------|-------|-------|---------|
| **Background** | `background.js` | Service Worker | State init, session reset on startup |
| **Content** | `content.js` | ISOLATED | Overlay, navigation detection, nudge UI, chrome API access |
| **Injector** | `injector.js` | MAIN | History API patching, Chrome Built-in AI (Gemini Nano) |
| **Popup** | `popup/` | Extension | Goal input, mode switching, session stats |

### Why two content script worlds?

- **MAIN world** (`injector.js`) can access page JavaScript (History API, `LanguageModel` AI API) but has no `chrome.*` APIs
- **ISOLATED world** (`content.js`) has `chrome.*` APIs but can't touch page JS
- They communicate via `CustomEvent` dispatches on `document`

### Storage Schema

```js
{
  goal: string | null,   // Current goal text
  active: boolean,       // Goal mode active
  casual: boolean,       // "Just Browsing" mode
  videosWatched: number, // Total videos navigated to
  onTopic: number,       // Videos matching goal
  offTopic: number       // Videos not matching goal
}
```

`goal`, `active`, and `casual` are cleared on browser startup. Stats persist across sessions.

## Development

No build system. To develop:

1. Load unpacked at `chrome://extensions`
2. Edit files directly
3. Click the reload button on the extension card (or Ctrl+R on the extensions page)

### Key events to know

- `yt-navigate-finish` — YouTube fires this on every SPA navigation (primary detection)
- `intent-url-change` — Custom event from injector.js History API patches (fallback)
- `intent-check-relevance` / `intent-relevance-result` — ISOLATED ↔ MAIN bridge for AI checks

## Permissions

| Permission | Reason |
|-----------|--------|
| `storage` | Persist goals, mode, and stats |
| `activeTab` | Access current YouTube tab |
| `*://*.youtube.com/*` | Content scripts on YouTube pages |

## License

MIT
