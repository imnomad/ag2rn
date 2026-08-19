// public/js/mobile-bridge.js
// Native Mobile Bridge for AG2RN (iOS & Android)
// Handles QR pairing modal, persistent token storage, fetch proxying, and background reconnect

(function () {
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
  // Intercept Global Fetch for Native Remote Proxy
  // ─────────────────────────────────────────────
  const originalFetch = window.fetch;
  window.fetch = function (input, init = {}) {
    const serverUrl = localStorage.getItem(STORAGE_KEY_URL);
    const authToken = localStorage.getItem(STORAGE_KEY_TOKEN);

    if (serverUrl && typeof input === 'string' && input.startsWith('/')) {
      input = `${serverUrl}${input}`;
      init = init || {};
      init.headers = init.headers || {};
      if (authToken && typeof init.headers.set === 'function') {
        init.headers.set('X-AG2RN-Token', authToken);
      } else if (authToken && typeof init.headers === 'object') {
        init.headers['X-AG2RN-Token'] = authToken;
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
            Pega el <strong>Enlace Mágico</strong> copiado del Desktop Control Center o presiona <strong>Auto-Detectar</strong>.
          </p>

          <div style="display: flex; flex-direction: column; gap: 12px; text-align: left;">
            <label style="font-size: 0.75rem; color: #38bdf8; font-weight: 600;">Enlace de la PC o Enlace Mágico:</label>
            <input id="manual-pairing-input" type="text" placeholder="Pega el enlace mágico o IP aquí..." style="
              background: #030712; border: 1px solid rgba(255,255,255,0.15); color: white;
              padding: 12px 14px; border-radius: 10px; font-size: 0.85rem; width: 100%; box-sizing: border-box; outline: none;
            ">
            <button id="btn-submit-manual" style="
              background: linear-gradient(135deg, #38bdf8, #2563eb);
              color: white; border: none; padding: 14px; border-radius: 10px; font-size: 0.95rem; font-weight: 600; cursor: pointer;
              display: flex; align-items: center; justify-content: center; gap: 8px; margin-top: 4px;
            ">
              <span>Conectar con Antigravity 2.0</span>
            </button>

            <button id="btn-auto-detect" style="
              background: rgba(255,255,255,0.06); color: #38bdf8; border: 1px solid rgba(56,189,248,0.3);
              padding: 10px; border-radius: 10px; font-size: 0.85rem; font-weight: 600; cursor: pointer;
              display: flex; align-items: center; justify-content: center; gap: 6px; margin-top: 2px;
            ">
              <span>⚡ Auto-Detectar Servidor Local</span>
            </button>
          </div>
        </div>

        <div id="pairing-status-msg" style="font-size: 0.85rem; color: #f59e0b; min-height: 20px; font-weight: 500;"></div>
      </div>
    `;

    document.body.appendChild(overlay);

    const statusMsg = document.getElementById('pairing-status-msg');
    const manualInput = document.getElementById('manual-pairing-input');

    document.getElementById('btn-submit-manual').addEventListener('click', () => {
      const val = manualInput.value.trim();
      if (!val) {
        // If empty, trigger auto detect
        autoDetectAndConnect(statusMsg);
        return;
      }
      processPairingInput(val, statusMsg);
    });

    document.getElementById('btn-auto-detect').addEventListener('click', () => {
      autoDetectAndConnect(statusMsg);
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
            if (payload.url.includes('192.168.')) {
              const port = payload.url.split(':')[2] || '3820';
              candidates.push({ url: `https://10.0.2.2:${port}`, token: payload.token });
              candidates.push({ url: `http://10.0.2.2:${parseInt(port) + 1}`, token: payload.token });
            }
          }
        } catch {}
      } else {
        if (!clean.startsWith('http://') && !clean.startsWith('https://')) {
          candidates.push({ url: `https://${clean}` });
          candidates.push({ url: `http://${clean}` });
        } else {
          candidates.push({ url: clean });
          // Also try http alternative if https was given
          if (clean.startsWith('https://')) {
            candidates.push({ url: clean.replace('https://', 'http://').replace(':3820', ':3821') });
          }
        }
      }
    }

    // Default discovery candidates
    candidates.push({ url: 'https://10.0.2.2:3820' });
    candidates.push({ url: 'http://10.0.2.2:3821' });
    candidates.push({ url: 'https://192.168.0.15:3820' });
    candidates.push({ url: 'http://192.168.0.15:3821' });
    candidates.push({ url: 'https://localhost:3820' });
    candidates.push({ url: 'http://localhost:3821' });

    return candidates;
  }

  // Auto-probe all candidate addresses and connect to the fastest responder
  async function autoDetectAndConnect(statusEl) {
    statusEl.textContent = 'Buscando servidor AG2RN en la red...';
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
          statusEl.textContent = `¡Servidor encontrado en ${c.url}! Conectando...`;
          statusEl.style.color = '#10b981';

          await completePairing(c.url, '', statusEl);
          return;
        }
      } catch (e) {}
    }

    statusEl.textContent = 'No se encontró el servidor. Asegúrate de que AG2RN esté abierto en la PC.';
    statusEl.style.color = '#f43f5e';
  }

  // Process pairing input with smart fallbacks
  async function processPairingInput(inputString, statusEl) {
    statusEl.textContent = 'Verificando conexión con el servidor...';
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
      }, 700);
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
