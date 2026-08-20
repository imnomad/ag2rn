// CDP script: inject text into AG's editor and submit
// Extracted from server.js buildInjectScript()

export function buildInjectScript(safeText, appendMode) {
  return `
(async () => {
  // Find the editor (Lexical or generic contenteditable)
  const editorCandidates = document.querySelectorAll(
    '[data-lexical-editor="true"], #antigravity\\\\.agentSidePanelInputBox [contenteditable="true"], [contenteditable="true"][role="textbox"], [contenteditable="true"], textarea'
  );

  // Filter to visible editors, take the last one (usually the input at bottom)
  let editor = null;
  for (const el of editorCandidates) {
    if (el.offsetParent !== null || el.getClientRects().length > 0) editor = el;
  }
  if (!editor) return { ok: false, reason: 'no_editor' };

  editor.focus();
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

  let inserted = false;
  try {
    const dt = new DataTransfer();
    dt.setData('text/plain', textVal);
    const pasteEvent = new ClipboardEvent('paste', {
      clipboardData: dt, bubbles: true, cancelable: true,
    });
    const notHandled = editor.dispatchEvent(pasteEvent);
    if (!notHandled) inserted = true;
  } catch {}

  if (!inserted) {
    try {
      document.execCommand('insertText', false, textVal);
      inserted = true;
    } catch {}
  }

  if (!inserted && editor.tagName === 'TEXTAREA') {
    editor.value = textVal;
    editor.dispatchEvent(new Event('input', { bubbles: true }));
    editor.dispatchEvent(new Event('change', { bubbles: true }));
  }

  // Brief delay for editor to process
  await new Promise(r => setTimeout(r, 120));

  // Find and click submit button
  const submitSelectors = [
    'button[data-tooltip-id*="input-send-button"]',
    'button[data-tooltip-id="input-send-button-cancel-tooltip"]',
    'button[data-testid="input-send-button"]',
    'button[data-testid="send-button"]',
    'button[aria-label*="send" i]',
    'button[aria-label*="submit" i]',
  ];

  let submitBtn = null;
  for (const sel of submitSelectors) {
    submitBtn = document.querySelector(sel);
    if (submitBtn && (submitBtn.offsetParent !== null || submitBtn.getClientRects().length > 0)) break;
    submitBtn = null;
  }

  // Fallback: look for arrow icon button near the editor
  if (!submitBtn) {
    const arrow = document.querySelector('svg.lucide-arrow-right, svg.lucide-arrow-up, svg.lucide-send');
    if (arrow) submitBtn = arrow.closest('button');
  }

  // Fallback: form submit or sibling button
  if (!submitBtn) {
    const form = editor.closest('form');
    if (form) submitBtn = form.querySelector('button[type="submit"], button:last-of-type');
  }
  if (!submitBtn) {
    const parent = editor.parentElement;
    if (parent) submitBtn = parent.querySelector('button');
  }

  if (submitBtn) {
    submitBtn.click();
    return { ok: true, method: 'button' };
  }

  // Last resort: dispatch Enter key
  const enterEvent = new KeyboardEvent('keydown', {
    key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true,
  });
  editor.dispatchEvent(enterEvent);
  return { ok: true, method: 'enter' };
})()
`;
}
