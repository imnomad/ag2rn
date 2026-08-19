// packages/core/src/tunnel/port-finder.js
// Utility to find an open TCP port automatically if the default port is occupied

import net from 'net';

/**
 * Checks if a specific TCP port is available on the local machine.
 * @param {number} port
 * @returns {Promise<boolean>}
 */
export function isPortAvailable(port) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once('error', () => {
      resolve(false);
    });
    server.once('listening', () => {
      server.close(() => {
        resolve(true);
      });
    });
    server.listen(port, '0.0.0.0');
  });
}

/**
 * Finds an available port starting from desiredPort.
 * If desiredPort is busy, searches desiredPort + 1, desiredPort + 2, etc.
 * @param {number} [desiredPort=3820]
 * @param {number} [maxAttempts=30]
 * @returns {Promise<number>} Available port number
 */
export async function findAvailablePort(desiredPort = 3820, maxAttempts = 30) {
  let port = desiredPort;
  for (let i = 0; i < maxAttempts; i++) {
    const available = await isPortAvailable(port);
    if (available) {
      return port;
    }
    port++;
  }
  return desiredPort; // Fallback
}
