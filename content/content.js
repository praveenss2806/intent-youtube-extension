// =============================================================
// Intent - Focused YouTube Extension
// Content script: runs in ISOLATED world on every YouTube page
// =============================================================

// --- Phase 3: Deviation detection helpers ---

// Common English words that don't carry topical meaning
const STOP_WORDS = new Set([
  'a','an','the','to','is','how','for','and','in','on',
  'of','it','i','my','me','we','do','be','so','no',
  'or','if','by','at','up','as',
]);

/**
 * Extracts meaningful keywords from text.
 * Lowercases, splits on non-alphanumeric chars, removes stop words.
 */
function extractKeywords(text) {
  return text
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(w => w.length > 1 && !STOP_WORDS.has(w));
}

/**
 * Gets the current video title from the page tab title.
 * YouTube sets document.title to "Video Title - YouTube".
 */
function getVideoTitle() {
  return document.title.replace(/ - YouTube$/, '').trim();
}

/**
 * Calculates what fraction of goal keywords appear in the title.
 * Returns 1.0 if goal has no keywords (e.g. all stop words).
 */
function calculateRelevance(goalKw, titleKw) {
  if (goalKw.length === 0) return 1;
  const titleSet = new Set(titleKw);
  const matched = goalKw.filter(w => titleSet.has(w)).length;
  return matched / goalKw.length;
}

/**
 * Keyword-based relevance check (fallback when AI is unavailable).
 * Threshold: relevance < 0.3 = off-topic.
 */
function checkRelevanceKeyword(goal, title) {
  const goalKw = extractKeywords(goal);
  const titleKw = extractKeywords(title);
  const relevance = calculateRelevance(goalKw, titleKw);
  return { onTopic: relevance >= 0.3, relevance, method: 'keyword' };
}

// --- Phase 4: Nudge toast for off-topic videos ---

// Tracks dismissed video URLs per page session — won't re-nudge the same video
const _dismissedVideos = new Set();

/**
 * Shows a blocking modal when the user navigates to an off-topic video.
 * Full-screen backdrop (blur + dim) prevents YouTube interaction.
 * No auto-dismiss — user MUST click "Back on Track" or "Keep Watching".
 */
function showNudge(goal) {
  const currentUrl = location.href;

  // Skip if user already dismissed nudge for this video
  if (_dismissedVideos.has(currentUrl)) return;

  // Remove any existing nudge modal to prevent stacking
  const existing = document.getElementById('intent-nudge-overlay');
  if (existing) existing.remove();

  // Build blocking modal DOM — full-screen overlay with centered glass card
  const overlay = document.createElement('div');
  overlay.id = 'intent-nudge-overlay';
  overlay.innerHTML = `
    <div class="intent-nudge-card">
      <div class="intent-nudge-icon">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <circle cx="12" cy="12" r="11" stroke="#e53935" stroke-width="2" fill="rgba(229,57,53,0.1)"/>
          <path d="M12 8v5" stroke="#e53935" stroke-width="2" stroke-linecap="round"/>
          <circle cx="12" cy="16" r="1" fill="#e53935"/>
        </svg>
      </div>
      <h2 class="intent-nudge-title">You're drifting off-topic</h2>
      <p class="intent-nudge-message">
        Your goal: <strong>${goal}</strong>
      </p>
      <p class="intent-nudge-sub">This video doesn't seem related to your goal.</p>
      <div class="intent-nudge-actions">
        <button class="intent-nudge-btn-action">Back on Track</button>
        <button class="intent-nudge-btn-dismiss">Keep Watching</button>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);

  // "Back on Track" — navigate to YouTube search for the goal (same tab)
  overlay.querySelector('.intent-nudge-btn-action').addEventListener('click', () => {
    window.location.href =
      'https://www.youtube.com/results?search_query=' + encodeURIComponent(goal);
  });

  // "Keep Watching" — deliberate choice to stay off-topic, add cooldown
  overlay.querySelector('.intent-nudge-btn-dismiss').addEventListener('click', () => {
    _dismissedVideos.add(currentUrl);
    dismissNudge(overlay);
  });
}

/**
 * Smoothly removes the nudge modal with a fade-out animation.
 */
function dismissNudge(overlay) {
  if (!overlay || !overlay.parentNode) return; // already removed
  overlay.classList.add('intent-nudge-overlay-hide');
  // Remove from DOM after fade-out animation completes
  setTimeout(() => overlay.remove(), 300);
}

// --- Phase 3B: AI relevance bridge (ISOLATED → MAIN world) ---

// Incrementing ID to match each request with its response
let _relevanceRequestId = 0;

/**
 * Asks injector.js (MAIN world) to check relevance via Chrome Built-in AI.
 * Returns a Promise that resolves with the AI result or { available: false }
 * if AI is unavailable or times out (3s).
 */
function requestAIRelevanceCheck(goal, title) {
  const requestId = ++_relevanceRequestId;

  return new Promise((resolve) => {
    // One-shot listener — only accept the response matching our requestId
    const handler = (e) => {
      if (e.detail.requestId !== requestId) return; // not our response
      document.removeEventListener('intent-relevance-result', handler);
      clearTimeout(timeout);
      resolve(e.detail);
    };
    document.addEventListener('intent-relevance-result', handler);

    // If AI takes >3s (model loading, etc.), fall back to keyword matching
    const timeout = setTimeout(() => {
      document.removeEventListener('intent-relevance-result', handler);
      resolve({ available: false, reason: 'timeout' });
    }, 3000);

    // Dispatch request to MAIN world (injector.js listens for this)
    document.dispatchEvent(new CustomEvent('intent-check-relevance', {
      detail: { goal, title, requestId },
    }));
  });
}

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
 *
 * Uses chrome.storage.local (cleared by onStartup in background.js)
 * instead of sessionStorage so the overlay state is shared across all tabs.
 */
async function showGoalOverlay() {
  // Wait for body to be available
  if (!document.body) {
    document.addEventListener('DOMContentLoaded', () => showGoalOverlay());
    return;
  }

  // Don't double-inject if any overlay already exists
  if (document.getElementById('intent-goal-overlay')) return;
  if (document.getElementById('intent-casual-overlay')) return;

  // Check storage: skip if active goal, show casual reminder if casual mode.
  // onStartup clears these on browser restart, so overlay reappears each new session.
  const { active, casual } = await chrome.storage.local.get(['active', 'casual']);
  if (active) return; // goal set — no overlay needed

  // Casual mode — show a reminder overlay each new tab instead of skipping
  if (casual) {
    createCasualOverlayDOM();
    return;
  }

  // First visit (no choice yet) — show full goal input overlay
  createOverlayDOM();
}

/**
 * Builds and injects the overlay DOM. Called only when no goal/casual state exists.
 */
function createOverlayDOM() {

  // Create the overlay container
  const overlay = document.createElement('div');
  overlay.id = 'intent-goal-overlay';
  overlay.innerHTML = `
    <div class="intent-overlay-card">
      <div class="intent-overlay-logo">
        <svg width="36" height="36" viewBox="0 0 28 28" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <linearGradient id="intent-logo-grad-overlay" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stop-color="#ff5252"/>
              <stop offset="100%" stop-color="#e53935"/>
            </linearGradient>
          </defs>
          <circle cx="14" cy="14" r="13" fill="url(#intent-logo-grad-overlay)"/>
          <text x="14" y="19.5" text-anchor="middle" fill="#fff"
                font-family="-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif"
                font-size="16" font-weight="700">I</text>
        </svg>
        <span>Intent</span>
      </div>
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
 * Builds the casual mode reminder overlay — shown on every new YouTube tab
 * when user previously chose "Just Browsing". Offers to continue or set a goal.
 */
function createCasualOverlayDOM() {
  const overlay = document.createElement('div');
  overlay.id = 'intent-casual-overlay';
  overlay.innerHTML = `
    <div class="intent-overlay-card">
      <div class="intent-overlay-logo">
        <svg width="36" height="36" viewBox="0 0 28 28" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <linearGradient id="intent-logo-grad-casual" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stop-color="#ff5252"/>
              <stop offset="100%" stop-color="#e53935"/>
            </linearGradient>
          </defs>
          <circle cx="14" cy="14" r="13" fill="url(#intent-logo-grad-casual)"/>
          <text x="14" y="19.5" text-anchor="middle" fill="#fff"
                font-family="-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif"
                font-size="16" font-weight="700">I</text>
        </svg>
        <span>Intent</span>
      </div>
      <p class="intent-casual-message">You're in casual browsing mode</p>
      <p class="intent-casual-subtext">Would you like to set a goal instead?</p>

      <button id="intent-casual-set-goal" class="intent-overlay-btn intent-overlay-btn-primary">
        Set a Goal
      </button>
      <button id="intent-casual-continue" class="intent-overlay-btn intent-overlay-btn-secondary">
        Continue Browsing
      </button>
    </div>
  `;

  document.body.appendChild(overlay);

  // "Set a Goal" — clear casual mode, dismiss, then show goal input overlay
  document.getElementById('intent-casual-set-goal').addEventListener('click', () => {
    chrome.storage.local.set({ casual: false }, () => {
      dismissOverlay(overlay);
      // Small delay so fade-out finishes before new overlay appears
      setTimeout(() => createOverlayDOM(), 320);
    });
  });

  // "Continue Browsing" — keep casual mode, just dismiss
  document.getElementById('intent-casual-continue').addEventListener('click', () => {
    dismissOverlay(overlay);
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
 * Filters for watch/shorts URLs, then checks relevance against user's goal.
 */
async function onVideoNavigation(url) {
  const isVideo = url.includes('/watch') || url.includes('/shorts/');
  if (!isVideo) return;

  // Read current goal state — skip if no active goal (casual mode or no choice yet)
  const { goal, active } = await chrome.storage.local.get(['goal', 'active']);
  if (!active || !goal) return;

  // Wait for YouTube to update document.title after SPA navigation
  await new Promise(resolve => setTimeout(resolve, 500));

  const title = getVideoTitle();
  if (!title) return; // safety: title not available yet

  // Hybrid: try Chrome AI first, fall back to keyword matching
  let result;
  const aiResult = await requestAIRelevanceCheck(goal, title);

  if (aiResult.available) {
    // AI responded — use its verdict
    result = { onTopic: aiResult.onTopic, method: aiResult.method };
  } else {
    // AI unavailable (old Chrome, timeout, error) — keyword fallback
    console.log(`[Intent] AI unavailable (${aiResult.reason}), using keyword fallback`);
    result = checkRelevanceKeyword(goal, title);
  }

  const status = result.onTopic ? 'ON-TOPIC' : 'OFF-TOPIC';
  console.log(
    `[Intent] Title: "${title}" | ${status} (method: ${result.method})`
  );

  // --- Phase 5: Increment stats counters in storage ---
  // Atomic read-then-write to safely increment without race conditions
  const stats = await chrome.storage.local.get(['videosWatched', 'onTopic', 'offTopic']);
  const update = { videosWatched: (stats.videosWatched || 0) + 1 };
  if (result.onTopic) {
    update.onTopic = (stats.onTopic || 0) + 1;
  } else {
    update.offTopic = (stats.offTopic || 0) + 1;
  }
  chrome.storage.local.set(update);

  // Show nudge toast if video is off-topic
  if (!result.onTopic) showNudge(goal);
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

// --- Phase 5: Live goal sync from popup ---
// Reacts when user changes goal/mode in the popup without needing a page reload
chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== 'local') return;

  // If goal was cleared or user switched to casual, dismiss any active nudge modal
  if (changes.active && !changes.active.newValue) {
    const nudge = document.getElementById('intent-nudge-overlay');
    if (nudge) dismissNudge(nudge);
  }

  // If a new goal was set while active, re-check current video against it
  if (changes.goal && changes.goal.newValue && changes.active?.newValue) {
    onVideoNavigation(location.href);
  }
});
