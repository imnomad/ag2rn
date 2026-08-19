// packages/core/src/pairing/pairing.js
// Quick pairing protocol & QR code generator for AG2RN Mobile Client (iOS & Android)

import crypto from 'crypto';
import fs from 'fs';
import { getConfigPath, ensureConfigDir } from '../../../../src/paths.js';

const PAIRED_DEVICES_PATH = getConfigPath('paired-devices.json');
const pairedDevices = new Map();

/**
 * Loads paired mobile devices from disk.
 */
export function loadPairedDevices() {
  try {
    if (fs.existsSync(PAIRED_DEVICES_PATH)) {
      const raw = JSON.parse(fs.readFileSync(PAIRED_DEVICES_PATH, 'utf-8'));
      for (const [id, dev] of Object.entries(raw)) {
        pairedDevices.set(id, dev);
      }
    }
  } catch {
    // Start empty if missing/corrupt
  }
}

/**
 * Saves paired devices to disk.
 */
export function savePairedDevices() {
  try {
    ensureConfigDir();
    const obj = Object.fromEntries(pairedDevices);
    fs.writeFileSync(PAIRED_DEVICES_PATH, JSON.stringify(obj, null, 2));
  } catch (err) {
    console.debug('[Pairing] Failed to save paired devices:', err.message);
  }
}

// Initialize on load
loadPairedDevices();

/**
 * Generates an ephemeral pairing token and returns the payload to render inside the QR code.
 * @param {string} endpoint Public or local URL of the AG2RN server (e.g. https://xyz.trycloudflare.com or https://192.168.1.50:3000)
 * @param {string} serverName Display name of this host (e.g. "My PC (Windows 11)")
 * @param {string} masterPassword Application master password or secret
 * @returns {{ qrPayload: string, pairingToken: string, expiresAt: number }}
 */
export function createPairingPayload(endpoint, serverName, masterPassword) {
  const pairingToken = crypto.randomBytes(24).toString('hex');
  const expiresAt = Date.now() + 10 * 60 * 1000; // 10 minutes valid

  const payload = {
    v: '2.0',
    type: 'ag2rn-pair',
    url: endpoint,
    name: serverName,
    token: pairingToken,
    secret: crypto.createHmac('sha256', masterPassword || 'ag2rn-default-salt').update(pairingToken).digest('hex'),
    exp: expiresAt,
  };

  const qrPayload = `ag2rn://pair?data=${encodeURIComponent(Buffer.from(JSON.stringify(payload)).toString('base64'))}`;

  return {
    qrPayload,
    payload,
    pairingToken,
    expiresAt,
  };
}

/**
 * Validates a pairing request from a mobile device.
 * @param {string} deviceId Unique ID of mobile device
 * @param {string} deviceName User-friendly name (e.g. "iPhone 15 Pro")
 * @param {string} platform "ios" | "android"
 * @param {string} token Pairing token received from QR scan
 * @param {string} activeToken Current valid token on desktop
 * @returns {{ success: boolean, authToken?: string, error?: string }}
 */
export function registerPairedDevice(deviceId, deviceName, platform, token, activeToken) {
  if (!token || token !== activeToken) {
    return { success: false, error: 'invalid_or_expired_token' };
  }

  const persistentAuthToken = crypto.randomBytes(32).toString('hex');

  const record = {
    deviceId,
    deviceName: deviceName || 'Mobile Device',
    platform: platform || 'unknown',
    authToken: persistentAuthToken,
    pairedAt: new Date().toISOString(),
    lastSeen: new Date().toISOString(),
  };

  pairedDevices.set(deviceId, record);
  savePairedDevices();

  return {
    success: true,
    authToken: persistentAuthToken,
  };
}

/**
 * Verifies if an incoming HTTP/WS request belongs to an authorized paired mobile device.
 * @param {string} deviceId
 * @param {string} authToken
 * @returns {boolean}
 */
export function verifyDeviceAuth(deviceId, authToken) {
  if (!deviceId || !authToken) return false;
  const dev = pairedDevices.get(deviceId);
  if (!dev) return false;
  if (dev.authToken === authToken) {
    dev.lastSeen = new Date().toISOString();
    return true;
  }
  return false;
}

/**
 * Revokes a paired mobile device.
 * @param {string} deviceId
 */
export function revokePairedDevice(deviceId) {
  pairedDevices.delete(deviceId);
  savePairedDevices();
}

/**
 * Returns list of currently authorized devices.
 */
export function getAuthorizedDevices() {
  return Array.from(pairedDevices.values()).map(d => ({
    deviceId: d.deviceId,
    deviceName: d.deviceName,
    platform: d.platform,
    pairedAt: d.pairedAt,
    lastSeen: d.lastSeen,
  }));
}
