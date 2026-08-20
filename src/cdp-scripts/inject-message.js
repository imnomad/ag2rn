// CDP script: inject text into AG's editor and submit
// Extracted from server.js buildInjectScript()

export function buildInjectScript(safeText, appendMode) {
  return `
(async () => {
  // 1. Find the active editor (Lexical or generic contenteditable)
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

  // 2. Clear or position cursor
  if (${appendMode}) {
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0) {
      sel.collapseToEnd();
    }
  } else {
    const sel = window.getSelection();
    if (sel && sel.selectAllChildren) {
      try { sel.selectAllChildren(editor); } catch {}
    }
    try { document.execCommand('delete', false, null); } catch {}
  }

  const textVal = ${safeText};

  // 3. Inject text with all browser input events for Lexical/React compatibility
  let inserted = false;

  // Method A: Clipboard paste event
  try {
    const dt = new DataTransfer();
    dt.setData('text/plain', textVal);
    const pasteEvent = new ClipboardEvent('paste', {
      clipboardData: dt, bubbles: true, cancelable: true,
    });
    const notHandled = editor.dispatchEvent(pasteEvent);
    if (!notHandled) inserted = true;
  } catch {}

  // Method B: execCommand insertText
  if (!inserted) {
    try {
      document.execCommand('insertText', false, textVal);
      inserted = true;
    } catch {}
  }

  // Method C: beforeinput / input synthetic events
  try {
    editor.dispatchEvent(new InputEvent('beforeinput', {
      inputType: 'insertText',
      data: textVal,
      bubbles: true,
      cancelable: true,
    }));
    editor.dispatchEvent(new InputEvent('input', {
      inputType: 'insertText',
      data: textVal,
      bubbles: true,
    }));
  } catch {}

  // Method D: textarea value assignment fallback
  if (editor.tagName === 'TEXTAREA') {
    editor.value = textVal;
    editor.dispatchEvent(new Event('input', { bubbles: true }));
    editor.dispatchEvent(new Event('change', { bubbles: true }));
  }

  // 4. Helper to find active Send Button (excluding cancel/stop buttons)
  const findSendButton = () => {
    const selectors = [
      'button[data-tooltip-id*="input-send-button"]:not([data-tooltip-id*="cancel"])',
      'button[data-tooltip-id*="send"]:not([data-tooltip-id*="cancel"])',
      'button[data-testid*="send"]:not([data-testid*="cancel"])',
      'button[aria-label*="send" i]:not([aria-label*="cancel" i])',
      'button[aria-label*="submit" i]',
      'button:has(svg.lucide-arrow-up)',
      'button:has(svg.lucide-arrow-right)',
      'button:has(svg.lucide-send)',
    ];
    for (const sel of selectors) {
      try {
        const btn = document.querySelector(sel);
        if (btn && (btn.offsetParent !== null || btn.getClientRects().length > 0)) {
          return btn;
        }
      } catch {}
    }
    return null;
  };

  // 5. Wait for React / Lexical state to update and enable the send button
  let sendBtn = null;
  for (let i = 0; i < 6; i++) {
    await new Promise(r => setTimeout(r, 60));
    sendBtn = findSendButton();
    if (sendBtn && !sendBtn.disabled && !sendBtn.classList.contains('pointer-events-none')) {
      break;
    }
  }

  // 6. Trigger Submission
  if (sendBtn) {
    const opts = { bubbles: true, cancelable: true };
    sendBtn.dispatchEvent(new PointerEvent('pointerdown', opts));
    sendBtn.dispatchEvent(new MouseEvent('mousedown', opts));
    sendBtn.dispatchEvent(new PointerEvent('pointerup', opts));
    sendBtn.dispatchEvent(new MouseEvent('mouseup', opts));
    sendBtn.click();
    return { ok: true, method: 'button_click' };
  }

  // Fallback: Dispatch Enter key event directly to the editor
  const enterDown = new KeyboardEvent('keydown', {
    key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true, cancelable: true,
  });
  editor.dispatchEvent(enterDown);

  const enterUp = new KeyboardEvent('keyup', {
    key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true,
  });
  editor.dispatchEvent(enterUp);

  return { ok: true, method: 'enter_keypress' };
})()
`;
}
