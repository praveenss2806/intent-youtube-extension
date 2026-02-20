// =============================================================
// Intent - YouTube Focus Extension
// Content script: runs in ISOLATED world on every YouTube page
// =============================================================

// Show the goal overlay every time YouTube loads
showGoalOverlay();

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
