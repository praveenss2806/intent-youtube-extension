# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Chrome Extension (Manifest V3) that helps users stay focused on YouTube by setting a goal before browsing and nudging them when they drift off-topic.

## Development

No build system — plain JS/CSS/HTML. To develop:
1. Go to `chrome://extensions`, enable Developer Mode
2. "Load unpacked" → select this repo's root directory
3. After code changes, click the reload button on the extension card

No test framework is configured.

## Architecture

**Three execution contexts** communicate via `chrome.storage.local`:

- **Popup** (`popup/`) — 3-view state machine (input/active/casual) toggled with `.hidden` CSS class. Entry: `popup.html`
- **Content Scripts** (`content/`) — Two scripts in different worlds:
  - `content.js` (ISOLATED world, `document_idle`) — injects goal overlay on YouTube, has `chrome.*` API access
  - `injector.js` (MAIN world, `document_start`) — stub for Phase 2 History API patching, has direct page JS access but no chrome APIs
- **Background** (`background/background.js`) — MV3 service worker, initializes storage on install

**Storage schema** (`chrome.storage.local`):
```
{ goal, active, casual, videosWatched, onTopic, offTopic }
```

**CSS strategy**: All content-injected elements use `intent-` prefix and `!important` to avoid YouTube CSS conflicts. Overlay uses z-index 99999.

## Key Design Decisions

- Two content script worlds (MAIN + ISOLATED) are required — MAIN for History API patching, ISOLATED for chrome API access
- Popup uses hidden sections instead of navigation for smoother UX
- `casual` flag is separate from `active` to distinguish "no choice yet" vs "explicitly chose casual"
- Full-screen overlay forces intentional goal-setting each session

## Roadmap

Detailed 5-phase plan in `.plans/intent-extension-plan.md`. Current: Phase 1.5 complete (scaffold + popup + overlay). Next: Phase 2 (SPA navigation detection).
