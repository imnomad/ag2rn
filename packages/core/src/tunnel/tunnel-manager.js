// packages/core/src/tunnel/tunnel-manager.js
// Multiplatform tunnel and network address discovery for AG2RN

import os from 'os';
import { spawn } from 'child_process';

let activeTunnelProcess = null;
let activeTunnelUrl = null;

export const DEFAULT_PORT = 3820;

/**
 * Returns all local IPv4 network addresses of this machine.
 * Useful for local Wi-Fi pairing when tunnel is not needed.
 * @returns {Array<{ name: string, address: string }>}
 */
export function getLocalIpAddresses() {
  const interfaces = os.networkInterfaces();
  const results = [];

  for (const [name, addrs] of Object.entries(interfaces)) {
    if (!addrs) continue;
    for (const addr of addrs) {
      if (addr.family === 'IPv4' && !addr.internal) {
        results.push({ name, address: addr.address });
      }
    }
  }

  return results;
}

/**
 * Gets the primary local connection URL.
 * @param {number} [port=3820]
 * @returns {string}
 */
export function getPrimaryLocalUrl(port = DEFAULT_PORT) {
  const ips = getLocalIpAddresses();
  if (ips.length > 0) {
    return `https://${ips[0].address}:${port}`;
  }
  return `https://localhost:${port}`;
}

/**
 * Starts a Cloudflare Quick Tunnel if cloudflared binary is present.
 * @param {number} [localPort=3820]
 * @returns {Promise<{ ok: boolean, url?: string, error?: string }>}
 */
export function startCloudflareTunnel(localPort = DEFAULT_PORT) {
  return new Promise((resolve) => {
    if (activeTunnelProcess && activeTunnelUrl) {
      return resolve({ ok: true, url: activeTunnelUrl });
    }

    try {
      const child = spawn('cloudflared', ['tunnel', '--url', `https://localhost:${localPort}`, '--no-tls-verify'], {
        stdio: ['ignore', 'pipe', 'pipe'],
      });

      activeTunnelProcess = child;
      let resolved = false;

      const timeout = setTimeout(() => {
        if (!resolved) {
          resolved = true;
          resolve({ ok: false, error: 'Tunnel startup timed out' });
        }
      }, 15000);

      const checkOutput = (data) => {
        const str = data.toString();
        const match = str.match(/https:\/\/[a-zA-Z0-9-]+\.trycloudflare\.com/);
        if (match && !resolved) {
          resolved = true;
          clearTimeout(timeout);
          activeTunnelUrl = match[0];
          resolve({ ok: true, url: activeTunnelUrl });
        }
      };

      child.stdout.on('data', checkOutput);
      child.stderr.on('data', checkOutput);

      child.on('error', (err) => {
        if (!resolved) {
          resolved = true;
          clearTimeout(timeout);
          resolve({ ok: false, error: `cloudflared failed: ${err.message}` });
        }
      });

      child.on('exit', () => {
        activeTunnelProcess = null;
        activeTunnelUrl = null;
      });
    } catch (err) {
      resolve({ ok: false, error: err.message });
    }
  });
}

/**
 * Stops the active tunnel process.
 */
export function stopTunnel() {
  if (activeTunnelProcess) {
    try {
      activeTunnelProcess.kill();
    } catch {}
    activeTunnelProcess = null;
    activeTunnelUrl = null;
  }
}

/**
 * Returns the current active public or local connection URL.
 * @param {number} [port=3820]
 * @returns {string}
 */
export function resolveConnectionUrl(port = DEFAULT_PORT) {
  if (process.env.TUNNEL_URL) return process.env.TUNNEL_URL;
  if (activeTunnelUrl) return activeTunnelUrl;
  return getPrimaryLocalUrl(port);
}
