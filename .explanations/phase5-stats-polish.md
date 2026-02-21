# Phase 5: Stats + Polish

## What was added

### 1. Stats Tracking (content.js)
After each relevance check in `onVideoNavigation()`, we atomically increment storage counters:
- `videosWatched` — always +1
- `onTopic` or `offTopic` — +1 based on the relevance result

Uses `get` then `set` pattern to safely increment without overwriting.

### 2. Popup Stats Display (popup.html + popup.css + popup.js)
Three-column stats row in the active-goal view:
- **Videos** (white) — total videos checked
- **On-topic** (green #4caf50) — videos matching goal
- **Off-topic** (red #f44336) — videos not matching goal

"Reset Stats" button zeros all counters without clearing the goal.

### 3. Live Goal Sync (content.js)
`chrome.storage.onChanged` listener reacts to popup changes in real-time:
- **Goal cleared** → dismisses any visible nudge toast immediately
- **New goal set** → re-runs `onVideoNavigation()` on current URL to check relevance against the updated goal

### 4. Edge Cases
Confirmed all already handled by the existing `/watch` + `/shorts/` URL filter — homepage, search, playlists are skipped. No changes needed.

## Data Flow
```
Video navigation → relevance check → stats increment → storage updated
                                                              ↓
Popup opens → reads stats from storage → displays in stats row
                                                              ↓
"Reset Stats" → zeros counters in storage + UI
```

```
Popup changes goal → chrome.storage.onChanged fires in content.js
  → goal cleared: dismiss nudge
  → new goal: re-check current video
```
