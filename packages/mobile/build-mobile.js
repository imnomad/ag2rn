// packages/mobile/build-mobile.js
// Synchronizes core web assets into the Capacitor native mobile distribution directory

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const publicDir = path.resolve(__dirname, '../../public');
const mobileWwwDir = path.resolve(__dirname, 'www');

console.log('[Mobile Build] Syncing web assets to packages/mobile/www...');

// Ensure www exists
if (!fs.existsSync(mobileWwwDir)) {
  fs.mkdirSync(mobileWwwDir, { recursive: true });
}

// Helper to copy directory recursively
function copyDirSync(src, dest) {
  if (!fs.existsSync(dest)) {
    fs.mkdirSync(dest, { recursive: true });
  }
  const entries = fs.readdirSync(src, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      if (entry.name === 'dashboard') continue; // Dashboard is desktop-only
      copyDirSync(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

// Copy public assets
copyDirSync(publicDir, mobileWwwDir);

// Inject native mobile companion script into index.html
const indexPath = path.join(mobileWwwDir, 'index.html');
if (fs.existsSync(indexPath)) {
  let indexContent = fs.readFileSync(indexPath, 'utf-8');
  
  if (!indexContent.includes('mobile-bridge.js')) {
    indexContent = indexContent.replace(
      '</body>',
      '  <script src="js/mobile-bridge.js"></script>\n</body>'
    );
    fs.writeFileSync(indexPath, indexContent, 'utf-8');
    console.log('[Mobile Build] Injected mobile-bridge.js into mobile index.html');
  }
}

console.log('[Mobile Build] Mobile build completed successfully.');
