// =============================================================
// Intent - YouTube Focus Extension
// Content script: runs in ISOLATED world on every YouTube page
// =============================================================

// --- Phase 1.5: Goal overlay ---
showGoalOverlay();

// --- Phase 2: SPA navigation detection ---
// Handle the initial page load (content script only runs once per full load)
onVideoNavigation(location.href);

// Primary: YouTube fires this on every SPA navigation (works in ISOLATED world)
document.addEventListener('yt-navigate-finish', () => {
  debouncedVideoNavigation(location.href);
});

// Fallback: injector.js dispatches this via History API patching (MAIN → ISOLATED bridge)
document.addEventListener('intent-url-change', (e) => {
  debouncedVideoNavigation(e.detail.url);
});

/**
 * Creates and injects a full-screen overlay on YouTube
 * asking the user for their goal or casual browsing mode.
 * Blocks YouTube interaction until a choice is made.
 */
function showGoalOverlay() {
  // Wait for body to be available
  if (!document.body) {
    document.addEventListener('DOMContentLoaded', () => showGoalOverlay());
    return;
  }

  // Don't double-inject if overlay already exists
  if (document.getElementById('intent-goal-overlay')) return;

  // Create the overlay container
  const overlay = document.createElement('div');
  overlay.id = 'intent-goal-overlay';
  overlay.innerHTML = `
    <div class="intent-overlay-card">
      <h1 class="intent-overlay-logo">Intent</h1>
      <p class="intent-overlay-tagline">What brings you to YouTube?</p>

      <input
        type="text"
        id="intent-overlay-input"
        class="intent-overlay-input"
        placeholder="e.g. Learn React hooks, Study calculus..."
        autocomplete="off"
      />

      <button id="intent-overlay-set-goal" class="intent-overlay-btn intent-overlay-btn-primary">
        Set Goal
      </button>
      <button id="intent-overlay-casual" class="intent-overlay-btn intent-overlay-btn-secondary">
        Just Browsing
      </button>
    </div>
  `;

  document.body.appendChild(overlay);

  // --- Event handlers ---

  const input = document.getElementById('intent-overlay-input');
  const setGoalBtn = document.getElementById('intent-overlay-set-goal');
  const casualBtn = document.getElementById('intent-overlay-casual');

  // Focus the input automatically
  setTimeout(() => input.focus(), 100);

  // "Set Goal" — save goal and dismiss overlay
  setGoalBtn.addEventListener('click', () => {
    const goal = input.value.trim();
    if (!goal) return; // ignore empty input

    chrome.storage.local.set({ goal, active: true, casual: false }, () => {
      dismissOverlay(overlay);
    });
  });

  // Enter key submits goal
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') setGoalBtn.click();
  });

  // "Just Browsing" — set casual mode and dismiss
  casualBtn.addEventListener('click', () => {
    chrome.storage.local.set({ goal: null, active: false, casual: true }, () => {
      dismissOverlay(overlay);
    });
  });
}

/**
 * Smoothly removes the overlay with a fade-out animation.
 */
function dismissOverlay(overlay) {
  overlay.classList.add('intent-overlay-hide');
  // Remove from DOM after animation completes
  setTimeout(() => overlay.remove(), 300);
}

// =============================================================
// Phase 2: SPA Navigation Detection
// =============================================================

/**
 * Called on every detected video navigation.
 * Filters for watch/shorts URLs only — ignores home, search, channels, etc.
 */
function onVideoNavigation(url) {
  const isVideo = url.includes('/watch') || url.includes('/shorts/');
  if (!isVideo) return;

  console.log('[Intent] Video navigation:', url);
}

/**
 * Simple debounce — YouTube fires multiple navigation events per transition.
 * Waits 800ms of quiet before firing, so we only process the final URL.
 */
let _navDebounceTimer = null;
function debouncedVideoNavigation(url) {
  clearTimeout(_navDebounceTimer);
  _navDebounceTimer = setTimeout(() => onVideoNavigation(url), 800);
}
