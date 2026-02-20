// DOM elements
const goalInputView = document.getElementById('goal-input-view');
const activeGoalView = document.getElementById('active-goal-view');
const casualView = document.getElementById('casual-view');
const goalText = document.getElementById('goal-text');
const currentGoalText = document.getElementById('current-goal-text');

// Buttons
const setGoalBtn = document.getElementById('set-goal-btn');
const casualBtn = document.getElementById('casual-btn');
const clearGoalBtn = document.getElementById('clear-goal-btn');
const setNewGoalBtn = document.getElementById('set-new-goal-btn');

// Show the correct view based on current state
function showView(state) {
  goalInputView.classList.add('hidden');
  activeGoalView.classList.add('hidden');
  casualView.classList.add('hidden');

  if (state.active && state.goal) {
    // Goal is set — show active goal card
    activeGoalView.classList.remove('hidden');
    currentGoalText.textContent = state.goal;
  } else if (state.casual) {
    // Casual mode — show casual card
    casualView.classList.remove('hidden');
  } else {
    // No state — show goal input
    goalInputView.classList.remove('hidden');
  }
}

// Load current state from storage on popup open
chrome.storage.local.get(['goal', 'active', 'casual'], (data) => {
  showView(data);
});

// "Set Goal" — save goal and switch to active view
setGoalBtn.addEventListener('click', () => {
  const goal = goalText.value.trim();
  if (!goal) return; // ignore empty input

  const state = { goal, active: true, casual: false };
  chrome.storage.local.set(state, () => {
    showView(state);
  });
});

// Allow pressing Enter to set goal
goalText.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') setGoalBtn.click();
});

// "Just Browsing" — clear goal, enter casual mode
casualBtn.addEventListener('click', () => {
  const state = { goal: null, active: false, casual: true };
  chrome.storage.local.set(state, () => {
    showView(state);
  });
});

// "Clear Goal" — reset to input view
clearGoalBtn.addEventListener('click', () => {
  const state = { goal: null, active: false, casual: false };
  chrome.storage.local.set(state, () => {
    showView(state);
  });
});

// "Set a Goal Instead" — switch from casual to input view
setNewGoalBtn.addEventListener('click', () => {
  const state = { goal: null, active: false, casual: false };
  chrome.storage.local.set(state, () => {
    showView(state);
  });
});
