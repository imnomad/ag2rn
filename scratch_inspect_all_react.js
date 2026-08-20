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

  const res = await client.Runtime.evaluate({
    expression: `(() => {
      const root = document.getElementById('root');
      if (!root) return { error: 'no root' };
      
      const fiberKey = Object.keys(root).find(k => k.startsWith('__reactFiber$') || k.startsWith('__reactContainer$'));
      if (!fiberKey) return { error: 'no fiberKey' };

      const allStateNodes = [];
      function walk(node, depth) {
        if (!node || depth > 35) return;
        const props = node.memoizedProps;
        if (props && typeof props === 'object') {
          const keys = Object.keys(props);
          const interesting = keys.filter(k => /worktree|branch|workspace|project|env|session|model|cascade/i.test(k));
          if (interesting.length > 0) {
            const summary = {};
            for (const k of interesting) {
              const v = props[k];
              summary[k] = typeof v === 'function' ? 'function' : (typeof v === 'object' && v ? (Array.isArray(v) ? 'Array(' + v.length + ')' : Object.keys(v).slice(0, 5)) : v);
            }
            allStateNodes.push({
              depth: depth,
              comp: node.type && node.type.name ? node.type.name : typeof node.type,
              keys: interesting,
              props: summary
            });
          }
        }
        let child = node.child;
        while (child) {
          walk(child, depth + 1);
          child = child.sibling;
        }
      }

      walk(root[fiberKey], 0);
      return { total: allStateNodes.length, sample: allStateNodes };
    })()`,
    returnByValue: true
  });

  console.log(JSON.stringify(res.result.value, null, 2));
  await client.close();
}

main().catch(console.error);
