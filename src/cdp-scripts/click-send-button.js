// Click the send/submit button in AG's editor.

export const CLICK_SEND_BUTTON_SCRIPT = `
  (() => {
    const selectors = [
      'button[data-tooltip-id*="input-send-button"]',
      'button[data-tooltip-id="input-send-button-cancel-tooltip"]',
      'button[data-testid="input-send-button"]',
      'button[data-testid="send-button"]',
      'button[aria-label*="send" i]',
      'button[aria-label*="submit" i]',
    ];
    let btn = null;
    for (const sel of selectors) {
      btn = document.querySelector(sel);
      if (btn && (btn.offsetParent !== null || btn.getClientRects().length > 0)) break;
      btn = null;
    }
    if (!btn) {
      const arrow = document.querySelector('svg.lucide-arrow-right, svg.lucide-arrow-up, svg.lucide-send');
      if (arrow) btn = arrow.closest('button');
    }
    if (btn) {
      btn.click();
      return { ok: true, method: 'button' };
    }
    return { ok: false, reason: 'no_send_button' };
  })()
`;
