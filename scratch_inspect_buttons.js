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

  // Inspect what happens when clicking new conversation button
  const res = await client.Runtime.evaluate({
    expression: `(() => {
      // Find all buttons with aria-label or data-testid
      const btns = Array.from(document.querySelectorAll('button, a')).map(b => {
        return {
          tag: b.tagName,
          text: b.textContent.trim().substring(0, 30),
          aria: b.getAttribute('aria-label'),
          testId: b.getAttribute('data-testid'),
          href: b.getAttribute('href')
        };
      }).filter(b => b.aria || b.testId || b.href);
      return btns;
    })()`,
    returnByValue: true
  });

  console.log(JSON.stringify(res.result.value, null, 2));
  await client.close();
}

main().catch(console.error);
