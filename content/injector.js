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

  // =============================================================
  // Phase 3B/C: Chrome Built-in AI relevance check
  // Receives goal+title from ISOLATED world, runs Gemini Nano,
  // dispatches result back via intent-relevance-result event.
  // =============================================================

  // System prompt kept short — Gemini Nano has a 4096 token context window
  const AI_SYSTEM_PROMPT =
    'You classify if a YouTube video is relevant to a user\'s stated goal. ' +
    'Reply with exactly one word: ON_TOPIC or OFF_TOPIC. ' +
    'Be lenient — if the video is even loosely related, say ON_TOPIC.';

  // Cache the AI session (creating one is expensive, ~500ms+)
  let _aiSession = null;

  /**
   * Gets or creates a LanguageModel session.
   * Returns null if Chrome AI is unavailable (old Chrome, no hardware, etc.).
   */
  async function getAISession() {
    if (_aiSession) return _aiSession;

    // Check if the LanguageModel API exists in this browser
    if (!('LanguageModel' in self)) return null;

    try {
      const availability = await LanguageModel.availability();
      // 'unavailable' means the model can't run on this device
      if (availability === 'unavailable') return null;

      // 'downloadable' or 'downloading' will block until model is ready
      // The 3s timeout in content.js handles this gracefully
      _aiSession = await LanguageModel.create({
        initialPrompts: [{ role: 'system', content: AI_SYSTEM_PROMPT }],
      });
      return _aiSession;
    } catch (err) {
      console.warn('[Intent] Failed to create AI session:', err.message);
      return null;
    }
  }

  /**
   * Builds the user prompt for the AI model.
   * Kept minimal to stay within per-prompt token limits (1024).
   */
  function buildAIPrompt(goal, title) {
    return `Goal: "${goal}"\nVideo title: "${title}"\nVerdict:`;
  }

  // Listen for relevance check requests from content.js (ISOLATED world)
  document.addEventListener('intent-check-relevance', async (e) => {
    const { goal, title, requestId } = e.detail;

    // Helper to dispatch result back to ISOLATED world
    function sendResult(detail) {
      document.dispatchEvent(new CustomEvent('intent-relevance-result', {
        detail: { ...detail, requestId },
      }));
    }

    // No LanguageModel API → tell content.js to use keyword fallback
    if (!('LanguageModel' in self)) {
      sendResult({ available: false, reason: 'no-api' });
      return;
    }

    try {
      const session = await getAISession();
      if (!session) {
        sendResult({ available: false, reason: 'model-unavailable' });
        return;
      }

      // Ask Gemini Nano to classify the video
      const response = await session.prompt(buildAIPrompt(goal, title));
      const verdict = response.trim().toUpperCase();

      // Parse: look for OFF_TOPIC in response. Default to on-topic if ambiguous
      // (less annoying for user than false positives)
      const onTopic = !verdict.includes('OFF_TOPIC');

      sendResult({ available: true, onTopic, method: 'ai', raw: response.trim() });
    } catch (err) {
      console.warn('[Intent] AI relevance check failed:', err.message);
      // Invalidate stale session so next request creates a fresh one
      _aiSession = null;
      sendResult({ available: false, reason: 'error', error: err.message });
    }
  });
})();
