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
