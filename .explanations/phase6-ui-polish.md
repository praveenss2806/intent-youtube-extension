# Phase 6: UI Polish Explanation

## Glassmorphism
Glassmorphism creates a "frosted glass" effect using:
- `backdrop-filter: blur(Npx)` — blurs content behind the element
- Semi-transparent backgrounds: `rgba(255,255,255,0.05)` instead of solid colors
- Subtle borders: `rgba(255,255,255,0.08)` — just visible enough to define edges
- Inner highlight: `inset 0 1px 0 rgba(255,255,255,0.05)` — simulates light hitting glass top edge

## Color Strategy
YouTube's red (#FF0000) is too harsh for UI surfaces. We use Material Red 600 (#e53935) as primary, with #ff5252 for hover states and #c62828 for gradient depth. The gradient buttons use `linear-gradient(135deg, #e53935, #c62828)` with a `box-shadow` glow of `rgba(229,57,53,0.25)`.

## Blocking Nudge Modal
Previously the nudge was a dismissible toast that auto-disappeared after 10s — easy to ignore.
Now it's a full-screen modal (`position: fixed`, `100vw × 100vh`, `z-index: 99999`) that:
1. Blurs YouTube behind it (`backdrop-filter: blur(8px)`)
2. Centers a glass card with warning icon, goal reminder, and action buttons
3. Forces a deliberate choice: "Back on Track" (searches goal) or "Keep Watching" (dismisses + cooldown)
4. No auto-dismiss — the user must actively decide

## SVG Logo
The logo uses an inline `<svg>` with a `<linearGradient>` fill on a circle + white "I" text. Using inline SVG avoids extra HTTP requests and allows the gradient to render crisply at any size. The popup uses 28×28, the overlay uses 36×36 (same viewBox, just scaled).

## PNG Icon Generation
Chrome extensions require PNG icons in manifest.json. The `generate-pngs.html` helper renders the SVG to canvas at 16/48/128px and provides download buttons. Open once, download, replace the old PNGs.
