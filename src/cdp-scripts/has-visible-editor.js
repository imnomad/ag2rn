// CDP script: check if a visible Lexical/contenteditable editor exists.
// Synchronous (no async) — safe for cross-context probing with no GC risk.

export const HAS_VISIBLE_EDITOR_SCRIPT = `
  (() => {
    const candidates = document.querySelectorAll(
      '[data-lexical-editor="true"], #antigravity\\\\.agentSidePanelInputBox [contenteditable="true"], [contenteditable="true"][role="textbox"], [contenteditable="true"], textarea'
    );
    for (const el of candidates) {
      if (el.offsetParent !== null || el.getClientRects().length > 0) {
        return true;
      }
    }
    return false;
  })()
`;
