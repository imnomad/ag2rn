// CDP script: inject text into AG's editor and submit
// Extracted from server.js buildInjectScript()

export function buildInjectScript(safeText, appendMode) {
  return `
(async () => {
  // 1. Find active editor
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

  // 2. Clear previous content if not appending
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

  // 3. Clean single insertion via execCommand
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

  // 4. Collapse selection to end
  const sel = window.getSelection();
  if (sel) {
    try { sel.collapseToEnd(); } catch {}
  }

  // Brief delay for React/Lexical state cycle
  await new Promise(r => setTimeout(r, 100));

  // 5. Find Send Button in input box / toolbar
  const findSendButton = () => {
    const selectors = [
      'button[data-tooltip-id*="input-send-button"]:not([data-tooltip-id*="cancel"])',
      'button[data-testid*="send"]:not([data-testid*="cancel"])',
      'button[aria-label*="send" i]:not([aria-label*="cancel" i])',
      'button:has(svg.lucide-arrow-right)',
      'button:has(svg.lucide-arrow-up)',
      'button:has(svg.lucide-send)',
    ];
    for (const sel of selectors) {
      try {
        const b = document.querySelector(sel);
        if (b && (b.offsetParent !== null || b.getClientRects().length > 0)) {
          return b;
        }
      } catch {}
    }
    const parent = editor.closest('#antigravity\\\\.agentSidePanelInputBox') || editor.parentElement;
    if (parent) {
      const btns = Array.from(parent.querySelectorAll('button'));
      return btns[btns.length - 1] || null;
    }
    return null;
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

  // 6. Also dispatch DOM Enter event directly to editor
  editor.dispatchEvent(new KeyboardEvent('keydown', {
    key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true, cancelable: true, view: window
  }));
  editor.dispatchEvent(new KeyboardEvent('keyup', {
    key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true, view: window
  }));

  return { ok: true, method: btn ? 'button_and_enter' : 'enter', btnX, btnY };
})()
`;
}
