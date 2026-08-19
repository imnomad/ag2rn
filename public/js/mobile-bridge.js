// public/js/mobile-bridge.js
// Native Mobile Bridge for AG2RN (iOS & Android)
// Handles QR pairing modal, persistent token storage, fetch proxying, and background reconnect

(function () {
  const STORAGE_KEY_URL = 'ag2rn_server_url';
  const STORAGE_KEY_TOKEN = 'ag2rn_auth_token';
  const STORAGE_KEY_DEVICE_ID = 'ag2rn_device_id';

  // Helper to determine if we are in a mobile native environment
  function isNativeMobile() {
    return (
      !!window.Capacitor ||
      window.location.protocol === 'capacitor:' ||
      window.location.protocol === 'file:' ||
      navigator.userAgent.includes('Android') ||
      navigator.userAgent.includes('iPhone')
    );
  }

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
            Abre <strong>AG2RN Control Center</strong> en tu PC y pega aquí el enlace de emparejamiento o la URL de conexión.
          </p>

          <div style="display: flex; flex-direction: column; gap: 12px; text-align: left;">
            <label style="font-size: 0.75rem; color: #38bdf8; font-weight: 600;">Enlace de la PC o Enlace Mágico:</label>
            <input id="manual-pairing-input" type="text" placeholder="Ej: https://10.0.2.2:3820 o enlace mágico" style="
              background: #030712; border: 1px solid rgba(255,255,255,0.15); color: white;
              padding: 12px 14px; border-radius: 10px; font-size: 0.85rem; width: 100%; box-sizing: border-box; outline: none;
            ">
            <button id="btn-submit-manual" style="
              background: linear-gradient(135deg, #38bdf8, #2563eb);
              color: white; border: none; padding: 14px; border-radius: 10px; font-size: 0.95rem; font-weight: 600; cursor: pointer;
              display: flex; align-items: center; justify-content: center; gap: 8px; margin-top: 6px;
            ">
              <span>Conectar con Antigravity 2.0</span>
            </button>
          </div>
        </div>

        <div id="pairing-status-msg" style="font-size: 0.85rem; color: #f59e0b; min-height: 20px; font-weight: 500;"></div>
      </div>
    `;

    document.body.appendChild(overlay);

    const statusMsg = document.getElementById('pairing-status-msg');
    const manualInput = document.getElementById('manual-pairing-input');

    // Default placeholder in Android emulator for quick 1-tap testing
    if (navigator.userAgent.includes('Android') && !manualInput.value) {
      manualInput.placeholder = 'https://10.0.2.2:3820 o pega enlace';
    }

    document.getElementById('btn-submit-manual').addEventListener('click', () => {
      const val = manualInput.value.trim();
      if (!val) {
        statusMsg.textContent = 'Por favor ingresa la URL o enlace mágico de tu PC';
        statusMsg.style.color = '#f43f5e';
        return;
      }
      processPairingInput(val, statusMsg);
    });
  }

  // Process pairing input (either magic link ag2rn://pair?... or direct URL https://10.0.2.2:3820)
  async function processPairingInput(inputString, statusEl) {
    try {
      statusEl.textContent = 'Conectando con tu computadora...';
      statusEl.style.color = '#38bdf8';

      let targetUrl = '';
      let targetToken = '';

      if (inputString.includes('ag2rn://pair') || inputString.includes('data=')) {
        let dataBase64 = '';
        if (inputString.includes('data=')) {
          dataBase64 = decodeURIComponent(inputString.split('data=')[1].split('&')[0]);
        } else {
          dataBase64 = inputString;
        }

        const payload = JSON.parse(atob(dataBase64));
        if (!payload.url) throw new Error('Enlace de emparejamiento inválido');
        targetUrl = payload.url;
        targetToken = payload.token;

        // If in Android emulator, convert localhost/192.168 to 10.0.2.2 if needed
        if (navigator.userAgent.includes('Android') && (targetUrl.includes('localhost') || targetUrl.includes('127.0.0.1'))) {
          targetUrl = targetUrl.replace('localhost', '10.0.2.2').replace('127.0.0.1', '10.0.2.2');
        }
      } else {
        // Direct URL entered
        targetUrl = inputString.replace(/\/+$/, '');
        if (!targetUrl.startsWith('http://') && !targetUrl.startsWith('https://')) {
          targetUrl = `https://${targetUrl}`;
        }
      }

      const deviceId = getOrCreateDeviceId();
      const deviceName = navigator.userAgent.includes('iPhone') ? 'iPhone'
        : navigator.userAgent.includes('Android') ? 'Android Device'
        : 'Mobile Companion';
      const platform = navigator.userAgent.includes('iPhone') ? 'ios' : 'android';

      // Perform Handshake with Desktop Server
      const res = await fetch(`${targetUrl}/api/pairing/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          deviceId,
          deviceName,
          platform,
          token: targetToken,
        }),
      });

      const result = await res.json();

      if (result.ok && result.authToken) {
        localStorage.setItem(STORAGE_KEY_URL, targetUrl);
        localStorage.setItem(STORAGE_KEY_TOKEN, result.authToken);

        statusEl.textContent = '¡Conectado con éxito a Antigravity 2.0!';
        statusEl.style.color = '#10b981';

        setTimeout(() => {
          const overlay = document.getElementById('mobile-pairing-overlay');
          if (overlay) overlay.remove();
          window.location.reload();
        }, 800);
      } else {
        // Fallback: save targetUrl even if token handshake failed so user can connect
        localStorage.setItem(STORAGE_KEY_URL, targetUrl);
        localStorage.setItem(STORAGE_KEY_TOKEN, 'direct-connect');
        statusEl.textContent = '¡Conectando...';
        statusEl.style.color = '#10b981';
        setTimeout(() => {
          const overlay = document.getElementById('mobile-pairing-overlay');
          if (overlay) overlay.remove();
          window.location.reload();
        }, 800);
      }
    } catch (err) {
      statusEl.textContent = `Error: ${err.message}. Verifica que el servidor de la PC esté activo.`;
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

  // Add Haptic feedback if Capacitor is present
  if (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.Haptics) {
    document.addEventListener('click', (e) => {
      const btn = e.target.closest('button');
      if (btn) {
        try {
          window.Capacitor.Plugins.Haptics.impact({ style: 'LIGHT' });
        } catch {}
      }
    });
  }

  // Global helper to unpair / switch server
  window.unpairServer = () => {
    if (confirm('¿Deseas desvincular este dispositivo de la computadora?')) {
      localStorage.removeItem(STORAGE_KEY_URL);
      localStorage.removeItem(STORAGE_KEY_TOKEN);
      window.location.reload();
    }
  };

  window.showPairingModal = showPairingModal;
})();
