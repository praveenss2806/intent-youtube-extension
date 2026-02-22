// Initialize default state when extension is first installed
chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.set({
    goal: null,
    active: false,
    casual: false,
    // Stats tracking
    videosWatched: 0,
    onTopic: 0,
    offTopic: 0
  });
});

// Clear session-specific state on browser startup (Chrome relaunch).
// Stats (videosWatched, onTopic, offTopic) are preserved across sessions.
// This ensures a fresh goal overlay appears on the first YouTube visit each session.
chrome.runtime.onStartup.addListener(() => {
  chrome.storage.local.set({
    goal: null,
    active: false,
    casual: false
  });
});
