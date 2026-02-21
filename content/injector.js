// =============================================================
// Intent - YouTube Focus Extension
// Injector script: runs in MAIN world at document_start
// Patches History API as fallback for SPA navigation detection
// Primary detection uses yt-navigate-finish in content.js
// =============================================================

(function () {
  const originalPushState = history.pushState.bind(history);
  const originalReplaceState = history.replaceState.bind(history);

  // Dispatch custom event to bridge MAIN → ISOLATED world
  function notifyNavigation() {
    document.dispatchEvent(
      new CustomEvent('intent-url-change', {
        detail: { url: location.href },
      })
    );
  }

  history.pushState = function (...args) {
    originalPushState(...args);
    notifyNavigation();
  };

  history.replaceState = function (...args) {
    originalReplaceState(...args);
    notifyNavigation();
  };

  window.addEventListener('popstate', notifyNavigation);
})();
