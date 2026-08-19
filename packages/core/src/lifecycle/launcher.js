// packages/core/src/lifecycle/launcher.js
// Cross-platform lifecycle management (launch, kill, restart, status check) for Antigravity 2.0

import { spawn, execSync } from 'child_process';
import os from 'os';
import { findAntigravityExecutable } from './detector.js';

/**
 * Checks if Antigravity 2.0 process is currently running.
 * @returns {{ running: boolean, pid: number|null }}
 */
export function isAntigravityRunning() {
  const platform = os.platform();

  try {
    if (platform === 'win32') {
      // Use tasklist or PowerShell
      const output = execSync('tasklist /FI "IMAGENAME eq Antigravity.exe" /FO CSV /NH', {
        encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'ignore'],
      }).trim();

      if (output && output.toLowerCase().includes('antigravity.exe')) {
        const parts = output.split(',');
        const pidStr = parts[1] ? parts[1].replace(/"/g, '').trim() : null;
        const pid = pidStr ? parseInt(pidStr, 10) : null;
        return { running: true, pid };
      }
    } else if (platform === 'darwin') {
      const psOutput = execSync('ps aux', { encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] });
      for (const line of psOutput.split('\n')) {
        if (line.includes('Antigravity.app/Contents/MacOS/Antigravity') && !line.includes('grep')) {
          const pid = parseInt(line.trim().split(/\s+/)[1], 10);
          return { running: true, pid };
        }
      }
    } else {
      // Linux
      const pgrep = execSync('pgrep -f "antigravity"', { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'ignore'] }).trim();
      if (pgrep) {
        const pid = parseInt(pgrep.split('\n')[0], 10);
        return { running: true, pid };
      }
    }
  } catch {
    // Process not found or command failed
  }

  return { running: false, pid: null };
}

/**
 * Launches Antigravity 2.0 with remote debugging enabled.
 * @param {number} [port=9000] Remote debugging port.
 * @returns {{ ok: boolean, reason?: string, pid?: number }}
 */
export function launchAntigravity(port = 9000) {
  const exePath = findAntigravityExecutable();
  const platform = os.platform();

  if (!exePath && platform !== 'darwin') {
    return { ok: false, reason: 'executable_not_found' };
  }

  try {
    if (platform === 'win32') {
      const child = spawn(exePath, [`--remote-debugging-port=${port}`], {
        detached: true,
        stdio: 'ignore',
      });
      child.unref();
      return { ok: true, pid: child.pid };
    } else if (platform === 'darwin') {
      const home = process.env.HOME || '/Users/' + process.env.USER;
      const child = spawn('/bin/bash', ['-l', '-c', `open -a Antigravity --args --remote-debugging-port=${port}`], {
        detached: true,
        stdio: 'ignore',
        env: { ...process.env, HOME: home },
      });
      child.unref();
      return { ok: true, pid: child.pid };
    } else {
      // Linux
      const child = spawn(exePath, [`--remote-debugging-port=${port}`], {
        detached: true,
        stdio: 'ignore',
      });
      child.unref();
      return { ok: true, pid: child.pid };
    }
  } catch (err) {
    return { ok: false, reason: err.message };
  }
}

/**
 * Gracefully terminates and restarts Antigravity 2.0 with CDP enabled.
 * @param {number} [port=9000]
 * @returns {Promise<{ ok: boolean, reason?: string }>}
 */
export async function restartAntigravity(port = 9000) {
  const { running, pid } = isAntigravityRunning();

  if (running && pid) {
    try {
      if (os.platform() === 'win32') {
        execSync(`taskkill /PID ${pid} /F`, { stdio: 'ignore' });
      } else {
        process.kill(pid, 'SIGTERM');
      }
    } catch {
      // Process already terminated or permission error
    }
  }

  // Wait 1.5s for process cleanup
  await new Promise(resolve => setTimeout(resolve, 1500));

  return launchAntigravity(port);
}
