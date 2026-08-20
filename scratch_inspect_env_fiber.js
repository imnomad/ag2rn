import CDP from 'chrome-remote-interface';
import fs from 'fs';
import path from 'path';
import os from 'os';

function readDevToolsPort() {
  const possiblePaths = [
    path.join(os.homedir(), 'AppData', 'Roaming', 'Antigravity', 'DevToolsActivePort'),
    path.join(os.homedir(), 'AppData', 'Local', 'Programs', 'Antigravity', 'DevToolsActivePort'),
  ];
  for (const p of possiblePaths) {
    try {
      if (fs.existsSync(p)) {
        const content = fs.readFileSync(p, 'utf-8').trim().split('\n');
        const port = parseInt(content[0], 10);
        if (port > 0) return port;
      }
    } catch {}
  }
  return 9000;
}

async function main() {
  const port = readDevToolsPort();
  const targets = await CDP.List({ host: '127.0.0.1', port });
  const target = targets.find(t => t.url?.includes('workbench.html') || t.title?.includes('workbench')) || targets.find(t => t.type === 'page');

  const client = await CDP({ host: '127.0.0.1', port, target });
  await client.Runtime.enable();

  // Search React fibers on any element that has environment or branch in text/label
  const res = await client.Runtime.evaluate({
    expression: `(() => {
      const candidates = Array.from(document.querySelectorAll('*')).filter(el => {
        const t = (el.textContent || '').toLowerCase();
        const aria = (el.getAttribute('aria-label') || '').toLowerCase();
        return aria.includes('environment') || aria.includes('branch') || aria.includes('worktree') ||
               t.includes('worktree') || t.includes('environment');
      });

      const results = candidates.map(el => {
        const k = Object.keys(el).find(key => key.startsWith('__reactFiber$'));
        let f = k ? el[k] : null;
        const fiberDetails = [];
        for (let i = 0; i < 15 && f; i++) {
          const p = f.memoizedProps;
          if (p && typeof p === 'object') {
            const useful = {};
            for (const key of Object.keys(p)) {
              if (key === 'children') continue;
              const v = p[key];
              useful[key] = typeof v === 'function' ? (v.name || 'anonymous fn') : (typeof v === 'object' && v ? (Array.isArray(v) ? 'Array(' + v.length + ')' : Object.keys(v).slice(0, 5)) : v);
            }
            if (Object.keys(useful).length > 0) {
              fiberDetails.push({ depth: i, comp: f.type?.name || typeof f.type, props: useful });
            }
          }
          f = f.return;
        }
        return {
          tag: el.tagName,
          text: el.textContent ? el.textContent.substring(0, 40) : '',
          aria: el.getAttribute('aria-label'),
          fiberDetails
        };
      });

      return results;
    })()`,
    returnByValue: true
  });

  console.log(JSON.stringify(res.result.value, null, 2));
  await client.close();
}

main().catch(console.error);
