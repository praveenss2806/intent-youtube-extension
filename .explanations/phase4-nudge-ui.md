# Phase 4: Nudge UI — Off-Topic Toast Banner

## What it does
When the user navigates to an off-topic YouTube video (detected by Phase 3), a toast banner slides down from the top of the page with two options: dismiss or get back on track.

## How it works

### Flow
```
Phase 3 detects OFF-TOPIC video
        ↓
showNudge(goal)
        ↓
Check _dismissedVideos set → skip if already dismissed
        ↓
Remove any existing nudge (prevent stacking)
        ↓
Create toast DOM → append to document.body
        ↓
Start 10s auto-dismiss timer
        ↓
┌─── User actions ───────────────────────┐
│                                         │
│  "Back on Track"                        │
│  → window.location.href = YouTube       │
│    search for goal (same tab)           │
│                                         │
│  "Dismiss"                              │
│  → Add URL to _dismissedVideos          │
│  → dismissNudge() (slide-up + remove)   │
│                                         │
│  No action (10s)                        │
│  → Auto-dismiss (slide-up + remove)     │
└─────────────────────────────────────────┘
```

### Toast anatomy
```
┌──────────────────────────────────────────────────┐
│  You're drifting from your goal: learn react     │
│                                                   │
│                        [Dismiss] [Back on Track]  │
└──────────────────────────────────────────────────┘
```

### Cooldown system
- `_dismissedVideos` is a `Set` of video URLs (in memory, not persisted)
- When user dismisses a nudge, the current URL is added to the set
- Next navigation to the same URL skips the nudge
- Set resets on full page reload (YouTube SPA navigations don't reset it)

### CSS animations
- **Slide down**: toast enters from above viewport (`translateY(-100%) → translateY(0)`)
- **Slide up**: toast exits back above viewport (`translateY(0) → translateY(-100%)`)
- Both animations are 300ms with ease timing

### Z-index hierarchy
- Goal overlay: `99999` (blocks everything)
- Nudge toast: `9999` (above YouTube, below overlay)

## Files changed
- `content/content.js` — `showNudge()`, `dismissNudge()`, `_dismissedVideos` set, wired into `onVideoNavigation`
- `content/nudge.css` — toast styles + slide animations
