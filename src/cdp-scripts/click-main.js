// CDP script: main click dispatcher for all source types
// Extracted from server.js POST /click (general handler)
// This is the largest inline script — handles chat, left, right, dropdown,
// dialog, settings, perm, task sources.

export function buildMainClickScript(safeClickId, safeLabel) {
  return `
    (async () => {
      const clickId = ${safeClickId};
      const expectedLabel = ${safeLabel};

      // Parse prefix:index
      const colonIdx = clickId.indexOf(':');
      if (colonIdx === -1) return { ok: false, reason: 'invalid_click_id' };
      const source = clickId.substring(0, colonIdx);
      const idx = parseInt(clickId.substring(colonIdx + 1), 10);

      // Find the root element based on source
      let root = null;
      if (source === 'chat') {
        root =
          document.querySelector('.scrollbar-hide[class*="overflow-y-auto"]') ||
          document.querySelector('[data-testid="conversation-view"]') ||
          document.getElementById('conversation') ||
          document.getElementById('chat') ||
          document.getElementById('cascade');

        // New session page fallback: scroll container is zero-height or missing.
        // Walk up from inputBox to animate-fade-in root (mirrors capture.js detection).
        if (!root || root.clientHeight === 0) {
          const inputBox = document.getElementById('antigravity.agentSidePanelInputBox');
          if (inputBox) {
            let newRoot = inputBox;
            for (let i = 0; i < 10; i++) {
              if (!newRoot.parentElement) break;
              newRoot = newRoot.parentElement;
              const cls = newRoot.className?.toString() || '';
              if (cls.includes('animate-fade-in')) break;
            }
            root = newRoot;
          }
        }
      } else if (source === 'left') {
        root = document.querySelector('.bg-sidebar, [class*="bg-sidebar"], [data-testid="sidebar"], [data-testid="left-sidebar"], aside, nav[aria-label*="sidebar" i]');
      } else if (source === 'right') {
        // Anchor-based: find via tab-id buttons or toggle-aux-sidebar
        const tabBtn = document.querySelector('[data-tab-id="overview"], [data-tab-id="review"]');
        const anchor = tabBtn || document.querySelector('[data-testid="toggle-aux-sidebar"]');
        if (anchor) {
          let el = anchor;
          for (let i = 0; i < 10 && el; i++) {
            el = el.parentElement;
            const cls = el?.className?.toString?.() || '';
            if (cls.includes('flex') && cls.includes('flex-col') && el.children.length >= 2) {
              root = el;
              break;
            }
          }
        }
      } else if (source === 'dropdown') {
        // Portal dropdown: body > div[role="listbox"], [role="menu"], or nested inside Radix container
        for (const child of document.body.children) {
          const role = child.getAttribute('role');
          if ((role === 'listbox' || role === 'menu' || child.hasAttribute('data-radix-popper-content-wrapper')) && child.textContent.trim()) {
            root = child;
            break;
          }
          // Radix wraps portals in ID'd divs — look inside them (matches capture.js logic)
          if (child.id) {
            const nested = child.querySelector('[role="listbox"], [role="menu"], [data-radix-popper-content-wrapper], [data-radix-menu-content], [data-radix-select-content], [data-radix-dropdown-menu-content]');
            if (nested && nested.textContent.trim()) {
              root = nested;
              break;
            }
          }
        }
      } else if (source === 'dialog') {
        // Portal dialog: body > div.fixed.inset-0 (modal), body > div[role="dialog"] (popover),
        // or Radix-nested: body > div#:rXX: > div[role="dialog"] (new AG Radix pattern)
        for (const child of document.body.children) {
          const cls = child.className || '';
          if (cls.includes('fixed') && cls.includes('inset-0')) {
            root = child;
            break;
          }
          if (!root && child.getAttribute('role') === 'dialog') {
            root = child;
          }
          // Radix portals: dialog nested inside an ID'd wrapper div (matches capture.js logic)
          if (!root && child.id) {
            const nested = child.querySelector('[role="dialog"]');
            if (nested && nested.getBoundingClientRect().width > 0) {
              root = nested;
            }
          }
        }
      } else if (source === 'settings') {
        // Settings overlay: same selector as capture
        const settingsOverlay = document.querySelector('#root .fixed.inset-0[class*="z-[5000]"]');
        if (settingsOverlay) {
          root = settingsOverlay.querySelector('[class*="max-w-5xl"]') ||
                 settingsOverlay.querySelector('[class*="rounded-2xl"]') ||
                 settingsOverlay;
        }
      } else if (source === 'ask') {
        // Ask question modal: find Submit+Skip buttons, walk up to card wrapper,
        // enumerate labels then buttons (same order as capture tagging)
        const allBtns = Array.from(document.querySelectorAll('button'));
        const skipBtn = allBtns.find(b => b.textContent.trim() === 'Skip');
        const submitBtn = allBtns.find(b => /^Submit/.test(b.textContent.trim()));
        if (skipBtn && submitBtn) {
          let container = skipBtn;
          for (let i = 0; i < 20 && container.parentElement; i++) {
            container = container.parentElement;
            if (container.contains(submitBtn)) break;
          }
          let cardRoot = container;
          for (let i = 0; i < 5 && cardRoot.parentElement; i++) {
            const cls = (cardRoot.className || '').toString();
            if (cls.includes('bg-card-border')) break;
            cardRoot = cardRoot.parentElement;
          }
          const askEls = [];
          cardRoot.querySelectorAll('[role="radiogroup"] label, [role="group"] label').forEach(el => askEls.push(el));
          cardRoot.querySelectorAll('button').forEach(el => askEls.push(el));
          if (idx >= 0 && idx < askEls.length) {
            const target = askEls[idx];
            const actualLabel = (target.textContent || '').trim().substring(0, 50);
            target.click();
            return { ok: true, label: actualLabel, source: 'ask' };
          }
          return { ok: false, reason: 'ask_index_out_of_range', total: askEls.length };
        }
        return { ok: false, reason: 'no_ask_question_modal' };
      } else if (source === 'perm') {
        // Permission banner: find radiogroup document-wide (it's outside the scroll container)
        const radioGroup = document.querySelector('[role="radiogroup"]');
        if (radioGroup) {
          let banner = radioGroup;
          for (let i = 0; i < 10; i++) {
            if (!banner.parentElement || banner.parentElement === document.body) break;
            banner = banner.parentElement;
            if (/allow|permission/i.test(banner.textContent) && banner.querySelectorAll('button').length >= 1) break;
          }
          // Build list: labels first, then buttons (same order as capture tagging)
          const permEls = [];
          banner.querySelectorAll('[role="radiogroup"] label').forEach(el => permEls.push(el));
          banner.querySelectorAll('button').forEach(el => permEls.push(el));
          if (idx >= 0 && idx < permEls.length) {
            const target = permEls[idx];
            const actualLabel = (target.textContent || '').trim().substring(0, 50);
            target.click();
            return { ok: true, label: actualLabel, source: 'perm' };
          }
          return { ok: false, reason: 'perm_index_out_of_range', total: permEls.length };
        }
        return { ok: false, reason: 'no_permission_banner' };
      } else if (source === 'queue') {
        let queueRoot = document.querySelector('[data-testid*="queue"], [class*="queued"], [aria-label*="queued" i], [aria-label*="queue" i]');
        if (!queueRoot) {
          const inputBox = document.getElementById('antigravity.agentSidePanelInputBox') || document.querySelector('[data-lexical-editor]');
          let parent = inputBox;
          for (let i = 0; i < 4 && parent; i++) {
            const q = parent.querySelector('[class*="queue"], [data-testid*="queue"]');
            if (q) { queueRoot = q; break; }
            parent = parent.parentElement;
          }
        }
        if (queueRoot) {
          const qEls = [];
          queueRoot.querySelectorAll('button, a, [role="button"], [class*="cursor-pointer"]').forEach(el => qEls.push(el));
          if (idx >= 0 && idx < qEls.length) {
            const target = qEls[idx];
            const actualLabel = (target.textContent || '').trim().substring(0, 50);
            target.click();
            return { ok: true, label: actualLabel, source: 'queue' };
          }
          return { ok: false, reason: 'queue_index_out_of_range', total: qEls.length };
        }
        return { ok: false, reason: 'no_queue_container' };
      } else if (source === 'task') {
        // Running tasks: find task section and click the Nth button
        const inputBox = document.getElementById('antigravity.agentSidePanelInputBox');
        if (inputBox) {
          const taskSection = inputBox.querySelector('.rounded-t-2xl');
          if (taskSection) {
            const btns = taskSection.querySelectorAll('button');
            if (idx >= 0 && idx < btns.length) {
              const target = btns[idx];
              const actualLabel = (target.textContent || '').trim().substring(0, 80);
              target.click();
              return { ok: true, label: actualLabel, source: 'task' };
            }
            return { ok: false, reason: 'task_index_out_of_range', total: btns.length };
          }
          return { ok: false, reason: 'no_task_section' };
        }
        return { ok: false, reason: 'no_input_box' };
      } else if (source === 'subinfo') {
        // Subagent info panel: find by text content (same approach as capture)
        const allDivs = document.querySelectorAll('div');
        let infoPanel = null;
        for (const div of allDivs) {
          const txt = div.textContent.trim().toLowerCase();
          if ((txt.includes('cannot') && txt.includes('prompt')) ||
              (txt.includes('open') && txt.includes('overview'))) {
            if (!infoPanel || (infoPanel.contains(div) && div !== infoPanel)) {
              infoPanel = div;
            }
          }
        }
        if (infoPanel) {
          const btns = infoPanel.querySelectorAll('button, a, [role="button"], [role="option"], [role="menuitem"], [role="menuitemradio"]');
          if (idx >= 0 && idx < btns.length) {
            const target = btns[idx];
            const actualLabel = (target.textContent || '').trim().substring(0, 80);
            target.click();
            return { ok: true, label: actualLabel, source: 'subinfo' };
          }
          return { ok: false, reason: 'subinfo_index_out_of_range', total: btns.length };
        }
        return { ok: false, reason: 'no_subinfo_panel' };
      } else if (source === 'btw') {
        const span = Array.from(document.querySelectorAll('span')).find(s => s.textContent.trim().startsWith('Side Question'));
        if (span) {
          let container = span;
          for (let i = 0; i < 5 && container; i++) {
            const cls = (container.className || '').toString();
            if (cls.includes('border-border') && cls.includes('rounded-md')) {
              break;
            }
            container = container.parentElement;
          }
          if (container) {
            const btns = [];
            container.querySelectorAll('button, a, [role="button"]').forEach(el => {
              if (el.closest('#antigravity\\.agentSidePanelInputBox') || el.closest('[class*="bg-card-border"]')) return;
              btns.push(el);
            });
            if (idx >= 0 && idx < btns.length) {
              const target = btns[idx];
              const actualLabel = (target.textContent || '').trim().substring(0, 50);

              const rect = target.getBoundingClientRect();
              const x = rect.left + 5;
              const y = rect.top + rect.height / 2;
              const hit = document.elementFromPoint(x, y) || target;

              const clickOpts = {
                bubbles: true,
                cancelable: true,
                clientX: x,
                clientY: y
              };
              hit.dispatchEvent(new PointerEvent('pointerdown', clickOpts));
              hit.dispatchEvent(new MouseEvent('mousedown', clickOpts));
              hit.dispatchEvent(new PointerEvent('pointerup', clickOpts));
              hit.dispatchEvent(new MouseEvent('mouseup', clickOpts));
              
              let clickTarget = hit;
              while (clickTarget && typeof clickTarget.click !== 'function') {
                clickTarget = clickTarget.parentElement;
              }
              if (clickTarget) {
                clickTarget.click();
              }

              return { ok: true, label: actualLabel, source: 'btw' };
            }
            return { ok: false, reason: 'btw_index_out_of_range', total: btns.length };
          }
        }
        return { ok: false, reason: 'no_btw_container' };
      } else if (source === 'model') {
        // Model selector button — opens AG's model picker dialog
        const findModelBtn = () => {
          return document.querySelector(
            '[aria-label*="model" i], [aria-label*="Select model" i], [data-testid*="model"], [data-tooltip-id*="model"], button:has(svg.lucide-sparkles), button:has(svg.lucide-cpu)'
          ) || Array.from(document.querySelectorAll('button')).find(b => {
            const t = (b.textContent || '').toLowerCase();
            return (t.includes('gemini') || t.includes('claude') || t.includes('gpt') || t.includes('sonnet') || t.includes('flash') || t.includes('pro') || t.includes('opus')) && !b.closest('.scrollbar-hide');
          });
        };
        const target = findModelBtn();
        if (target) {
          const actualLabel = (target.textContent || '').trim().substring(0, 50);
          target.click();
          return { ok: true, label: actualLabel, source: 'model' };
        }
        return { ok: false, reason: 'model_button_not_found' };
      } else if (source === 'project') {
        // Project dropdown button — opens AG's project picker dialog
        const target = document.querySelector('[aria-haspopup="dialog"]');
        if (target) {
          const actualLabel = (target.textContent || '').trim().substring(0, 50);
          target.click();
          return { ok: true, label: actualLabel, source: 'project' };
        }
        return { ok: false, reason: 'project_button_not_found' };
      }

      if (!root) return { ok: false, reason: 'no_root_for_' + source };

      // Settings: inline the same logic as tagInteractives(root, 'settings', true, false)
      // to guarantee identical enumeration between capture and click.
      if (source === 'settings') {
        let sIdx = 0;
        root.querySelectorAll('button, a, [role="button"], [role="option"], [role="menuitem"], [role="menuitemradio"]').forEach(el => {
          el.setAttribute('data-ag-click-id', 'settings:' + sIdx);
          sIdx++;
        });
        const target = root.querySelector('[data-ag-click-id="' + clickId + '"]');
        // Clean up tags
        root.querySelectorAll('[data-ag-click-id]').forEach(el => el.removeAttribute('data-ag-click-id'));
        if (!target) return { ok: false, reason: 'settings_element_not_found', clickId, total: sIdx };
        const actualLabel = (target.textContent || '').trim().substring(0, 50);
        target.click();
        return { ok: true, label: actualLabel, source: 'settings' };
      }

      // Build the same interactive element list as capture
      const skipVis = (source === 'right' || source === 'left' || source === 'settings');
      // maxTextLength only applies to cursor-pointer elements (content vs action ambiguity)
      const maxLen = (source === 'chat') ? 80 : 0;
      const visible = [];
      // Semantic interactive elements — always include, no text-length filter
      root.querySelectorAll('button, a, [role="button"], [role="option"], [role="menuitem"], [role="menuitemradio"], [role="treeitem"], [data-testid*="convo-pill"], [data-testid*="project"]').forEach(el => {
        if (skipVis || el.offsetParent !== null || (el.getClientRects && el.getClientRects().length > 0)) {
          visible.push(el);
        }
      });
      // cursor-pointer elements — filter by text length to skip content containers
      root.querySelectorAll('[class*="cursor-pointer"]').forEach(el => {
        if ((skipVis || el.offsetParent !== null || (el.getClientRects && el.getClientRects().length > 0)) && !visible.includes(el)) {
          const hasHandler = typeof el.onclick === 'function';
          if (maxLen && (el.textContent || '').trim().length > maxLen && !hasHandler) return;
          visible.push(el);
        }
      });

      if (idx < 0 || idx >= visible.length) {
        return { ok: false, reason: 'index_out_of_range', total: visible.length };
      }

      const target = visible[idx];
      const actualLabel = (target.textContent || '').trim().substring(0, 50);

      // Debug: dump elements around the target index to diagnose index drift
      const debugNearby = [];
      for (let d = Math.max(0, idx - 3); d <= Math.min(visible.length - 1, idx + 3); d++) {
        const el = visible[d];
        const txt = (el.textContent || '').trim().substring(0, 60);
        debugNearby.push(d + ':' + el.tagName + ' "' + txt + '"');
      }

      // Validate label matches (if provided) to prevent stale clicks
      if (expectedLabel && actualLabel !== expectedLabel) {
        return { ok: false, reason: 'label_mismatch', expected: expectedLabel, actual: actualLabel, total: visible.length, debugNearby };
      }

      // Dropdown clicks need Lexical editor focus and hit-testing for Radix typeahead items.
      // All other sources (left, right, chat, etc.) use simple target.click().
      if (source === 'dropdown') {
        const lexicalEditor = document.querySelector('[data-lexical-editor="true"]');
        if (lexicalEditor) {
          lexicalEditor.focus();
        }

        const rect = target.getBoundingClientRect();
        const x = rect.left + 5;
        const y = rect.top + rect.height / 2;
        const hit = document.elementFromPoint(x, y) || target;

        const clickOpts = {
          bubbles: true,
          cancelable: true,
          clientX: x,
          clientY: y
        };
        hit.dispatchEvent(new PointerEvent('pointerdown', clickOpts));
        hit.dispatchEvent(new MouseEvent('mousedown', clickOpts));
        hit.dispatchEvent(new PointerEvent('pointerup', clickOpts));
        hit.dispatchEvent(new MouseEvent('mouseup', clickOpts));
        
        let clickTarget = hit;
        while (clickTarget && typeof clickTarget.click !== 'function') {
          clickTarget = clickTarget.parentElement;
        }
        if (clickTarget) {
          clickTarget.click();
        }
      } else {
        target.click();
      }

      return { ok: true, label: actualLabel, source, debugNearby };
    })()
`;
}
