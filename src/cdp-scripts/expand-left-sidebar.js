// Expand the left sidebar when it's collapsed.
// Used by POST /expand-left-sidebar.

export const EXPAND_LEFT_SIDEBAR_SCRIPT = `
  (async () => {
    const leftRoot = document.querySelector('.bg-sidebar') || document.querySelector('[class*="bg-sidebar"]');
    const isCollapsed = !leftRoot || leftRoot.offsetParent === null || leftRoot.clientWidth < 40;
    if (!isCollapsed) return { ok: true, wasCollapsed: false };

    const toggleBtn = document.querySelector(
      '[data-testid="sidebar-toggle"], button[aria-label*="sidebar" i], button:has(svg.lucide-panel-left), button:has(svg.lucide-menu), [data-tooltip-id*="sidebar"]'
    );
    if (toggleBtn) {
      toggleBtn.click();
      return { ok: true, wasCollapsed: true };
    }
    return { ok: false, error: 'Toggle button not found' };
  })()
`;
