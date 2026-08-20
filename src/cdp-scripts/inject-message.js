// CDP script: inject text into AG's editor and submit
// Extracted from server.js buildInjectScript()

export function buildInjectScript(safeText, appendMode) {
  return `
(async () => {
  // 1. Find active editor element
  const editorCandidates = document.querySelectorAll(
    '#antigravity\\\\.agentSidePanelInputBox [contenteditable="true"], [data-lexical-editor="true"], [contenteditable="true"][role="textbox"], [contenteditable="true"], textarea'
  );

  let editor = null;
  for (const el of editorCandidates) {
    if (el.offsetParent !== null || (el.getClientRects && el.getClientRects().length > 0)) {
      editor = el;
    }
  }
  if (!editor) return { ok: false, reason: 'no_editor' };

  editor.focus();

  // 2. Clear previous content if not in append mode
  if (!${appendMode}) {
    const range = document.createRange();
    range.selectNodeContents(editor);
    const sel = window.getSelection();
    if (sel) {
      sel.removeAllRanges();
      sel.addRange(range);
    }
    try { document.execCommand('delete', false, null); } catch {}
    if (editor.textContent && editor.textContent.trim()) {
      editor.textContent = '';
    }
  }

  const textVal = ${safeText};

  // 3. Clean single insertion (execCommand natively triggers browser input lifecycle without duplication)
  editor.focus();
  let inserted = false;
  try {
    inserted = document.execCommand('insertText', false, textVal);
  } catch {}

  if (!inserted && editor.tagName === 'TEXTAREA') {
    editor.value = textVal;
    editor.dispatchEvent(new Event('input', { bubbles: true }));
    editor.dispatchEvent(new Event('change', { bubbles: true }));
  }

  // Collapse selection to end so nothing remains highlighted
  const sel = window.getSelection();
  if (sel) {
    try { sel.collapseToEnd(); } catch {}
  }

  // Brief pause for Lexical/React internal state reconciliation
  await new Promise(r => setTimeout(r, 100));

  // 4. Locate Send Button
  const findSendButton = () => {
    // Check inside the input box container first
    const container = editor.closest('#antigravity\\\\.agentSidePanelInputBox') || editor.parentElement?.parentElement;
    if (container) {
      const buttons = Array.from(container.querySelectorAll('button'));
      const activeBtn = buttons.find(b => {
        const isCancel = (b.getAttribute('data-tooltip-id') || '').includes('cancel');
        const hasSvg = b.querySelector('svg');
        return hasSvg && !isCancel && (b.offsetParent !== null || b.getClientRects().length > 0);
      });
      if (activeBtn) return activeBtn;
      if (buttons.length > 0) return buttons[buttons.length - 1];
    }

    // Global selector fallback
    const selectors = [
      'button[data-tooltip-id*="input-send-button"]:not([data-tooltip-id*="cancel"])',
      'button[data-testid*="send"]:not([data-testid*="cancel"])',
      'button[aria-label*="send" i]:not([aria-label*="cancel" i])',
    ];
    for (const sel of selectors) {
      try {
        const b = document.querySelector(sel);
        if (b && (b.offsetParent !== null || b.getClientRects().length > 0)) return b;
      } catch {}
    }

    const allButtons = Array.from(document.querySelectorAll('button'));
    return allButtons.find(b => {
      const svg = b.querySelector('svg');
      return svg && (svg.classList.contains('lucide-arrow-right') || svg.classList.contains('lucide-arrow-up') || svg.classList.contains('lucide-send'));
    }) || null;
  };

  let btnX = null;
  let btnY = null;
  const btn = findSendButton();
  if (btn) {
    const rect = btn.getBoundingClientRect();
    btnX = rect.left + rect.width / 2;
    btnY = rect.top + rect.height / 2;
    const hit = document.elementFromPoint(btnX, btnY) || btn;
    const opts = { bubbles: true, cancelable: true, clientX: btnX, clientY: btnY, view: window };
    hit.dispatchEvent(new PointerEvent('pointerdown', opts));
    hit.dispatchEvent(new MouseEvent('mousedown', opts));
    hit.dispatchEvent(new PointerEvent('pointerup', opts));
    hit.dispatchEvent(new MouseEvent('mouseup', opts));
    hit.click();
    if (typeof btn.click === 'function') btn.click();
  }

  // 5. Also dispatch native Enter keyboard events directly to editor
  const enterDown = new KeyboardEvent('keydown', {
    key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true, cancelable: true, composed: true, view: window
  });
  editor.dispatchEvent(enterDown);

  const enterUp = new KeyboardEvent('keyup', {
    key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true, composed: true, view: window
  });
  editor.dispatchEvent(enterUp);

  return { ok: true, method: btn ? 'button_and_enter' : 'enter', btnX, btnY };
})()
`;
}
