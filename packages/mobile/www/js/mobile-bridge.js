// public/js/mobile-bridge.js
// Native Mobile Bridge for AG2RN (iOS & Android)
// Handles QR pairing modal, persistent token storage, fetch proxying, and background reconnect

(function () {
  const isNativeApp = !!window.Capacitor || location.protocol === 'capacitor:' || location.protocol === 'file:';
  if (!isNativeApp) {
    // In standard web browser (Safari / Chrome / PWA), we are loaded directly from the server — no proxying needed!
    return;
  }

  const STORAGE_KEY_URL = 'ag2rn_server_url';
  const STORAGE_KEY_TOKEN = 'ag2rn_auth_token';
  const STORAGE_KEY_DEVICE_ID = 'ag2rn_device_id';

  // Generate or retrieve persistent device UUID
  function getOrCreateDeviceId() {
    let id = localStorage.getItem(STORAGE_KEY_DEVICE_ID);
    if (!id) {
      id = 'dev-' + Math.random().toString(36).substring(2, 10) + '-' + Date.now().toString(36);
      localStorage.setItem(STORAGE_KEY_DEVICE_ID, id);
    }
    return id;
  }

  // Check if device is paired
  function isPaired() {
    return !!localStorage.getItem(STORAGE_KEY_TOKEN) && !!localStorage.getItem(STORAGE_KEY_URL);
  }

  // ─────────────────────────────────────────────
  // Intercept Global Fetch for Native Remote Proxy with Self-Healing
  // ─────────────────────────────────────────────
  let consecutiveFailures = 0;
  const originalFetch = window.fetch;

  window.fetch = async function (input, init = {}) {
    let serverUrl = localStorage.getItem(STORAGE_KEY_URL);
    const authToken = localStorage.getItem(STORAGE_KEY_TOKEN);

    if (serverUrl && typeof input === 'string' && input.startsWith('/')) {
      const fullUrl = `${serverUrl}${input}`;
      init = init || {};
      init.headers = init.headers || {};
      if (authToken && typeof init.headers.set === 'function') {
        init.headers.set('X-AG2RN-Token', authToken);
      } else if (authToken && typeof init.headers === 'object') {
        init.headers['X-AG2RN-Token'] = authToken;
      }

      try {
        const res = await originalFetch.call(this, fullUrl, init);
        if (res.ok || res.status < 500) {
          consecutiveFailures = 0;
          return res;
        }
      } catch (err) {
        consecutiveFailures++;
        // If stored server is unreachable (e.g. port changed from 3000 to 3821), auto-discover live server
        if (consecutiveFailures >= 2) {
          const candidates = getProbeCandidates();
          for (const c of candidates) {
            try {
              const probeRes = await originalFetch(`${c.url}/api/status`, { signal: AbortSignal.timeout(800) });
              if (probeRes.ok) {
                localStorage.setItem(STORAGE_KEY_URL, c.url);
                consecutiveFailures = 0;
                return originalFetch.call(this, `${c.url}${input}`, init);
              }
            } catch {}
          }
        }
        throw err;
      }
    }
    return originalFetch.call(this, input, init);
  };

  // ─────────────────────────────────────────────
  // Pairing Modal
  // ─────────────────────────────────────────────
  function showPairingModal() {
    if (document.getElementById('mobile-pairing-overlay')) return;

    const overlay = document.createElement('div');
    overlay.id = 'mobile-pairing-overlay';
    overlay.style.cssText = `
      position: fixed; inset: 0; z-index: 99999;
      background: #090e17; color: #f8fafc;
      display: flex; flex-direction: column; align-items: center; justify-content: center;
      padding: 24px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; text-align: center;
    `;

    overlay.innerHTML = `
      <div style="max-width: 380px; width: 100%; display: flex; flex-direction: column; gap: 20px;">
        <div style="display: flex; align-items: center; justify-content: center; gap: 12px;">
          <img src="ag2r-icon.png" width="48" height="48" style="border-radius: 12px;" onerror="this.src='/ag2r-icon.png'">
          <div style="text-align: left;">
            <h2 style="font-size: 1.35rem; font-weight: 700; margin: 0;">AG2RN Mobile</h2>
            <span style="font-size: 0.75rem; color: #38bdf8; font-weight: 600; text-transform: uppercase;">Antigravity 2.0 Companion</span>
          </div>
        </div>

        <div style="background: rgba(17, 24, 39, 0.9); border: 1px solid rgba(255,255,255,0.08); border-radius: 16px; padding: 24px; box-shadow: 0 20px 25px -5px rgba(0,0,0,0.5);">
          <div style="font-size: 42px; margin-bottom: 12px;">📱 💻</div>
          <h3 style="font-size: 1.15rem; font-weight: 600; margin-bottom: 8px;">Conectar a tu Computadora</h3>
          <p style="font-size: 0.85rem; color: #94a3b8; line-height: 1.5; margin-bottom: 20px;">
            Presiona <strong>Auto-Detectar</strong> o pega el enlace mágico de tu PC.
          </p>

          <div style="display: flex; flex-direction: column; gap: 12px; text-align: left;">
            <button id="btn-auto-detect" style="
              background: linear-gradient(135deg, #38bdf8, #2563eb);
              color: white; border: none; padding: 15px; border-radius: 12px; font-size: 1rem; font-weight: 700; cursor: pointer;
              display: flex; align-items: center; justify-content: center; gap: 8px; box-shadow: 0 4px 12px rgba(37,99,235,0.4);
            ">
              <span>⚡ Auto-Detectar Servidor Local</span>
            </button>

            <div style="display: flex; align-items: center; gap: 8px; margin: 6px 0;">
              <div style="flex: 1; height: 1px; background: rgba(255,255,255,0.1);"></div>
              <span style="font-size: 0.75rem; color: #64748b;">O ENTRADA MANUAL</span>
              <div style="flex: 1; height: 1px; background: rgba(255,255,255,0.1);"></div>
            </div>

            <input id="manual-pairing-input" type="text" placeholder="Ej: http://10.0.2.2:3821 o enlace..." style="
              background: #030712; border: 1px solid rgba(255,255,255,0.15); color: white;
              padding: 12px 14px; border-radius: 10px; font-size: 0.85rem; width: 100%; box-sizing: border-box; outline: none;
            ">
            <button id="btn-submit-manual" style="
              background: rgba(255,255,255,0.08); color: white; border: 1px solid rgba(255,255,255,0.15);
              padding: 11px; border-radius: 10px; font-size: 0.85rem; font-weight: 600; cursor: pointer;
            ">
              <span>Conectar Manualmente</span>
            </button>
          </div>
        </div>

        <div id="pairing-status-msg" style="font-size: 0.85rem; color: #f59e0b; min-height: 20px; font-weight: 500;"></div>
      </div>
    `;

    document.body.appendChild(overlay);

    const statusMsg = document.getElementById('pairing-status-msg');
    const manualInput = document.getElementById('manual-pairing-input');

    document.getElementById('btn-auto-detect').addEventListener('click', () => {
      autoDetectAndConnect(statusMsg);
    });

    document.getElementById('btn-submit-manual').addEventListener('click', () => {
      const val = manualInput.value.trim();
      if (!val) {
        autoDetectAndConnect(statusMsg);
        return;
      }
      processPairingInput(val, statusMsg);
    });
  }

  // Candidate URLs for auto probing
  function getProbeCandidates(customInput) {
    const candidates = [];
    if (customInput) {
      let clean = customInput.trim();
      if (clean.startsWith('ag2rn://pair') || clean.includes('data=')) {
        try {
          const dataBase64 = clean.includes('data=') ? decodeURIComponent(clean.split('data=')[1].split('&')[0]) : clean;
          const payload = JSON.parse(atob(dataBase64));
          if (payload.url) {
            candidates.push({ url: payload.url, token: payload.token });
            const port = payload.url.split(':')[2] || '3820';
            const httpPort = parseInt(port) + 1;
            candidates.push({ url: `http://10.0.2.2:${httpPort}`, token: payload.token });
            candidates.push({ url: `https://10.0.2.2:${port}`, token: payload.token });
            candidates.push({ url: `http://192.168.0.15:${httpPort}`, token: payload.token });
          }
        } catch {}
      } else {
        if (!clean.startsWith('http://') && !clean.startsWith('https://')) {
          candidates.push({ url: `http://${clean}` });
          candidates.push({ url: `https://${clean}` });
        } else {
          candidates.push({ url: clean });
          if (clean.startsWith('https://')) {
            candidates.push({ url: clean.replace('https://', 'http://').replace(':3820', ':3821') });
          }
        }
      }
    }

    // Default discovery candidates (HTTP first for emulator speed, then HTTPS)
    candidates.push({ url: 'http://10.0.2.2:3821' });
    candidates.push({ url: 'https://10.0.2.2:3820' });
    candidates.push({ url: 'http://192.168.0.15:3821' });
    candidates.push({ url: 'https://192.168.0.15:3820' });
    candidates.push({ url: 'http://localhost:3821' });
    candidates.push({ url: 'https://localhost:3820' });

    return candidates;
  }

  // Auto-probe all candidate addresses and connect to the fastest responder
  async function autoDetectAndConnect(statusEl) {
    statusEl.textContent = '⚡ Probando conexiones con la PC...';
    statusEl.style.color = '#38bdf8';

    const candidates = getProbeCandidates();
    for (const c of candidates) {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 1200);

        const res = await originalFetch(`${c.url}/api/status`, {
          signal: controller.signal,
          headers: { 'Accept': 'application/json' },
        });
        clearTimeout(timeout);

        if (res.ok || res.status === 200 || res.status === 401) {
          statusEl.textContent = `¡Servidor detectado en ${c.url}! Conectando...`;
          statusEl.style.color = '#10b981';

          await completePairing(c.url, c.token || '', statusEl);
          return;
        }
      } catch (e) {}
    }

    statusEl.textContent = 'No se pudo conectar. Verifica que AG2RN esté abierto en tu PC.';
    statusEl.style.color = '#f43f5e';
  }

  // Process pairing input with smart fallbacks
  async function processPairingInput(inputString, statusEl) {
    statusEl.textContent = 'Verificando dirección...';
    statusEl.style.color = '#38bdf8';

    const candidates = getProbeCandidates(inputString);

    for (const c of candidates) {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 1500);

        const res = await originalFetch(`${c.url}/api/status`, {
          signal: controller.signal,
        });
        clearTimeout(timeout);

        if (res.ok || res.status === 200 || res.status === 401) {
          await completePairing(c.url, c.token || '', statusEl);
          return;
        }
      } catch (e) {}
    }

    // Direct registration attempt on primary target
    const primary = candidates[0] ? candidates[0].url : inputString;
    await completePairing(primary, candidates[0]?.token || '', statusEl);
  }

  // Complete device handshake and persist session
  async function completePairing(targetUrl, token, statusEl) {
    try {
      const cleanUrl = targetUrl.replace(/\/+$/, '');
      const deviceId = getOrCreateDeviceId();
      const deviceName = navigator.userAgent.includes('iPhone') ? 'iPhone'
        : navigator.userAgent.includes('Android') ? 'Android Pixel'
        : 'Dispositivo Móvil';
      const platform = navigator.userAgent.includes('iPhone') ? 'ios' : 'android';

      let authToken = 'connected';
      try {
        const res = await originalFetch(`${cleanUrl}/api/pairing/register`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ deviceId, deviceName, platform, token }),
        });
        const data = await res.json();
        if (data.authToken) authToken = data.authToken;
      } catch {}

      localStorage.setItem(STORAGE_KEY_URL, cleanUrl);
      localStorage.setItem(STORAGE_KEY_TOKEN, authToken);

      statusEl.textContent = '¡Enlazado con éxito a Antigravity 2.0!';
      statusEl.style.color = '#10b981';

      setTimeout(() => {
        const overlay = document.getElementById('mobile-pairing-overlay');
        if (overlay) overlay.remove();
        window.location.reload();
      }, 600);
    } catch (err) {
      statusEl.textContent = `Error: ${err.message}`;
      statusEl.style.color = '#f43f5e';
    }
  }

  // Auto-trigger on startup if not paired
  function checkPairingStatus() {
    if (!isPaired()) {
      showPairingModal();
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', checkPairingStatus);
  } else {
    checkPairingStatus();
  }

  // Global helper to unpair
  window.unpairServer = () => {
    if (confirm('¿Deseas desvincular este dispositivo de la computadora?')) {
      localStorage.removeItem(STORAGE_KEY_URL);
      localStorage.removeItem(STORAGE_KEY_TOKEN);
      window.location.reload();
    }
  };

  window.showPairingModal = showPairingModal;
})();
