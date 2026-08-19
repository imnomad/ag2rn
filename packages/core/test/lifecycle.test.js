// packages/core/test/lifecycle.test.js
// Unit tests for AG2RN detector, pairing, and tunnel modules

import { getDevToolsPortCandidatePaths, getAntigravityExecutableCandidates, readDevToolsPort } from '../src/lifecycle/detector.js';
import { isAntigravityRunning } from '../src/lifecycle/launcher.js';
import { createPairingPayload, registerPairedDevice, verifyDeviceAuth } from '../src/pairing/pairing.js';
import { getLocalIpAddresses, getPrimaryLocalUrl } from '../src/tunnel/tunnel-manager.js';
import { findAvailablePort } from '../src/tunnel/port-finder.js';

console.log('=== Running AG2RN Core Tests ===');

// Test 1: Detector Candidates
const portCandidates = getDevToolsPortCandidatePaths();
console.log(`[Test 1] Port candidate paths count: ${portCandidates.length}`);
if (portCandidates.length === 0) throw new Error('Port candidate paths should not be empty');

const exeCandidates = getAntigravityExecutableCandidates();
console.log(`[Test 2] Executable candidate paths count: ${exeCandidates.length}`);
if (exeCandidates.length === 0) throw new Error('Executable candidate paths should not be empty');

// Test 3: Running status check
const runningStatus = isAntigravityRunning();
console.log(`[Test 3] Antigravity 2.0 running status:`, runningStatus);

// Test 4: DevTools port reading
const devToolsPort = readDevToolsPort();
console.log(`[Test 4] DevToolsActivePort detected:`, devToolsPort || 'None active');

// Test 5: Dynamic Port Finder
const resolvedPort = await findAvailablePort(3820);
console.log(`[Test 5] Available port detected:`, resolvedPort);

// Test 6: Tunnel & IP discovery
const localIps = getLocalIpAddresses();
console.log(`[Test 6] Local IP addresses detected:`, localIps);
const localUrl = getPrimaryLocalUrl(resolvedPort);
console.log(`[Test 6b] Primary local URL:`, localUrl);

// Test 7: Pairing & QR payload generation (async with QR DataURL)
const pairing = await createPairingPayload(localUrl, 'Test-Host', 'secret123');
console.log(`[Test 7] Pairing payload created:`, pairing.qrPayload.substring(0, 50) + '...');
console.log(`[Test 7b] QR DataURL generated:`, pairing.qrDataUrl ? 'YES (Base64 PNG)' : 'NO');
if (!pairing.qrPayload.startsWith('ag2rn://pair?data=')) throw new Error('Invalid QR payload format');
if (!pairing.qrDataUrl.startsWith('data:image/png;base64,')) throw new Error('Invalid QR DataURL format');

// Test 8: Mobile registration validation
const regResult = registerPairedDevice('test-iphone-123', 'John iPhone', 'ios', pairing.pairingToken, pairing.pairingToken);
console.log(`[Test 8] Device registration result:`, regResult);
if (!regResult.success || !regResult.authToken) throw new Error('Device registration failed');

// Test 9: Device Auth verification
const isAuth = verifyDeviceAuth('test-iphone-123', regResult.authToken);
console.log(`[Test 9] Device auth verification:`, isAuth);
if (!isAuth) throw new Error('Device auth verification failed');

console.log('=== All AG2RN Core Tests Passed Successfully! ===');
