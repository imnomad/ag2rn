// packages/core/src/lifecycle/detector.js
// Cross-platform detection of Antigravity 2.0 executable, config paths, and CDP DevToolsActivePort

import fs from 'fs';
import path from 'path';
import os from 'os';
import { execSync } from 'child_process';

/**
 * Returns candidate DevToolsActivePort file locations based on OS.
 */
export function getDevToolsPortCandidatePaths() {
  const home = os.homedir();
  const platform = os.platform();
  const candidates = [];

  if (platform === 'win32') {
    const appData = process.env.APPDATA || path.join(home, 'AppData', 'Roaming');
    const localAppData = process.env.LOCALAPPDATA || path.join(home, 'AppData', 'Local');

    candidates.push(
      path.join(appData, 'Antigravity', 'DevToolsActivePort'),
      path.join(localAppData, 'Antigravity', 'DevToolsActivePort'),
      path.join(localAppData, 'Antigravity', 'User Data', 'DevToolsActivePort'),
      path.join(home, '.config', 'Antigravity', 'DevToolsActivePort')
    );
  } else if (platform === 'darwin') {
    candidates.push(
      path.join(home, 'Library', 'Application Support', 'Antigravity', 'DevToolsActivePort'),
      path.join(home, 'Library', 'Application Support', 'Google', 'Antigravity', 'DevToolsActivePort')
    );
  } else {
    // Linux / BSD
    const xdgConfig = process.env.XDG_CONFIG_HOME || path.join(home, '.config');
    candidates.push(
      path.join(xdgConfig, 'Antigravity', 'DevToolsActivePort'),
      path.join(home, '.config', 'antigravity', 'DevToolsActivePort')
    );
  }

  return candidates;
}

/**
 * Attempts to read the active CDP port written by Antigravity 2.0.
 * @returns {number|null} Port number if found and valid, null otherwise.
 */
export function readDevToolsPort() {
  const candidatePaths = getDevToolsPortCandidatePaths();

  for (const candidate of candidatePaths) {
    try {
      if (fs.existsSync(candidate)) {
        const content = fs.readFileSync(candidate, 'utf-8').trim();
        const firstLine = content.split('\n')[0].trim();
        const port = parseInt(firstLine, 10);
        if (!isNaN(port) && port > 0 && port < 65536) {
          return port;
        }
      }
    } catch {
      // Ignore unreadable or locked files
    }
  }

  return null;
}

/**
 * Returns candidate paths where Antigravity 2.0 executable might be installed.
 */
export function getAntigravityExecutableCandidates() {
  const home = os.homedir();
  const platform = os.platform();
  const candidates = [];

  if (platform === 'win32') {
    const localAppData = process.env.LOCALAPPDATA || path.join(home, 'AppData', 'Local');
    const programFiles = process.env.ProgramFiles || 'C:\\Program Files';
    const programFilesX86 = process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)';

    candidates.push(
      path.join(localAppData, 'Programs', 'Antigravity', 'Antigravity.exe'),
      path.join(localAppData, 'Antigravity', 'Antigravity.exe'),
      path.join(programFiles, 'Antigravity', 'Antigravity.exe'),
      path.join(programFilesX86, 'Antigravity', 'Antigravity.exe')
    );
  } else if (platform === 'darwin') {
    candidates.push(
      '/Applications/Antigravity.app/Contents/MacOS/Antigravity',
      path.join(home, 'Applications', 'Antigravity.app', 'Contents', 'MacOS', 'Antigravity')
    );
  } else {
    // Linux
    candidates.push(
      '/opt/Antigravity/antigravity',
      '/usr/bin/antigravity',
      '/usr/local/bin/antigravity',
      path.join(home, '.local', 'share', 'Antigravity', 'antigravity')
    );
  }

  return candidates;
}

/**
 * Finds the Antigravity 2.0 executable path on the system.
 * @returns {string|null} Full path to executable or null if not found.
 */
export function findAntigravityExecutable() {
  const candidates = getAntigravityExecutableCandidates();

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  // Fallback: check PATH using where/which
  try {
    const cmd = os.platform() === 'win32' ? 'where Antigravity' : 'which antigravity';
    const output = execSync(cmd, { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'ignore'] }).trim();
    if (output) {
      const first = output.split('\n')[0].trim();
      if (fs.existsSync(first)) return first;
    }
  } catch {
    // Not found in PATH
  }

  return null;
}
