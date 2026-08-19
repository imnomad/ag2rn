// public/js/mobile-bridge.js
// Native Mobile Bridge for AG2RN (iOS & Android)
// Handles QR pairing modal, persistent token storage, native haptics, and background reconnect

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

  // Create and inject Pairing Modal if not paired
  function showPairingModal() {
    if (document.getElementById('mobile-pairing-overlay')) return;

    const overlay = document.createElement('div');
    overlay.id = 'mobile-pairing-overlay';
    overlay.style.cssText = `
      position: fixed; inset: 0; z-index: 99999;
      background: #090e17; color: #f8fafc;
      display: flex; flex-direction: column; align-items: center; justify-content: center;
      padding: 24px; font-family: 'Inter', sans-serif; text-align: center;
    `;

    overlay.innerHTML = `
      <div style="max-width: 380px; width: 100%; display: flex; flex-direction: column; gap: 20px;">
        <div style="display: flex; align-items: center; justify-content: center; gap: 12px;">
          <img src="/ag2r-icon.png" width="48" height="48" style="border-radius: 12px;">
          <div style="text-align: left;">
            <h2 style="font-size: 1.4rem; font-weight: 700; margin: 0;">AG2RN Mobile</h2>
            <span style="font-size: 0.75rem; color: #38bdf8; font-weight: 600; text-transform: uppercase;">Antigravity 2.0 Companion</span>
          </div>
        </div>

        <div style="background: rgba(17, 24, 39, 0.8); border: 1px solid rgba(255,255,255,0.08); border-radius: 16px; padding: 24px;">
          <span class="material-symbols-rounded" style="font-size: 48px; color: #38bdf8; margin-bottom: 12px;">qr_code_scanner</span>
          <h3 style="font-size: 1.1rem; margin-bottom: 8px;">Vincular con tu Computadora</h3>
          <p style="font-size: 0.85rem; color: #94a3b8; line-height: 1.5; margin-bottom: 20px;">
            Abre <strong>AG2RN Control Center</strong> en tu PC o Mac y escanea el código QR que aparece en pantalla.
          </p>

          <div style="display: flex; flex-direction: column; gap: 12px;">
            <button id="btn-scan-qr" style="
              background: linear-gradient(135deg, #38bdf8, #2563eb);
              color: white; border: none; padding: 14px 20px; font-size: 0.95rem; font-weight: 600;
              border-radius: 10px; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 8px;
            ">
              <span class="material-symbols-rounded">photo_camera</span>
              <span>Escanear Código QR</span>
            </button>

            <button id="btn-manual-entry" style="
              background: rgba(255,255,255,0.05); color: #94a3b8; border: 1px solid rgba(255,255,255,0.1);
              padding: 10px 16px; font-size: 0.85rem; border-radius: 10px; cursor: pointer;
            ">
              Ingresar Enlace Manualmente
            </button>
          </div>

          <div id="manual-input-box" style="display: none; margin-top: 16px; flex-direction: column; gap: 8px; text-align: left;">
            <label style="font-size: 0.75rem; color: #94a3b8;">Enlace de emparejamiento (ag2rn://pair?...):</label>
            <input id="manual-pairing-input" type="text" placeholder="Pega el enlace mágico aquí..." style="
              background: #000; border: 1px solid rgba(255,255,255,0.2); color: white;
              padding: 10px 12px; border-radius: 8px; font-size: 0.8rem; width: 100%;
            ">
            <button id="btn-submit-manual" style="
              background: #10b981; color: white; border: none; padding: 10px; border-radius: 8px; font-weight: 600; cursor: pointer;
            ">
              Conectar
            </button>
          </div>
        </div>

        <div id="pairing-status-msg" style="font-size: 0.8rem; color: #f59e0b; min-height: 20px;"></div>
      </div>
    `;

    document.body.appendChild(overlay);

    // Event listeners
    const statusMsg = document.getElementById('pairing-status-msg');
    const manualBox = document.getElementById('manual-input-box');
    const manualInput = document.getElementById('manual-pairing-input');

    document.getElementById('btn-manual-entry').addEventListener('click', () => {
      manualBox.style.display = manualBox.style.display === 'none' ? 'flex' : 'none';
    });

    document.getElementById('btn-submit-manual').addEventListener('click', () => {
      const val = manualInput.value.trim();
      if (!val) return;
      processPairingUri(val, statusMsg);
    });

    document.getElementById('btn-scan-qr').addEventListener('click', () => {
      startCameraScan(statusMsg);
    });
  }

  // Process pairing URI
  async function processPairingUri(uriString, statusEl) {
    try {
      statusEl.textContent = 'Verificando credenciales con la computadora...';
      statusEl.style.color = '#38bdf8';

      let dataBase64 = '';
      if (uriString.includes('data=')) {
        dataBase64 = decodeURIComponent(uriString.split('data=')[1].split('&')[0]);
      } else {
        dataBase64 = uriString;
      }

      const payload = JSON.parse(atob(dataBase64));
      if (payload.type !== 'ag2rn-pair' || !payload.url || !payload.token) {
        throw new Error('Formato de código QR no válido');
      }

      const deviceId = getOrCreateDeviceId();
      const deviceName = navigator.userAgent.includes('iPhone') ? 'iPhone'
        : navigator.userAgent.includes('Android') ? 'Android'
        : 'Dispositivo Móvil';
      const platform = navigator.userAgent.includes('iPhone') ? 'ios' : 'android';

      // Perform Handshake with Desktop Server
      const res = await fetch(`${payload.url}/api/pairing/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          deviceId,
          deviceName,
          platform,
          token: payload.token,
        }),
      });

      const result = await res.json();

      if (result.ok && result.authToken) {
        localStorage.setItem(STORAGE_KEY_URL, payload.url);
        localStorage.setItem(STORAGE_KEY_TOKEN, result.authToken);

        statusEl.textContent = '¡Conexión establecida con éxito!';
        statusEl.style.color = '#10b981';

        setTimeout(() => {
          const overlay = document.getElementById('mobile-pairing-overlay');
          if (overlay) overlay.remove();
          window.location.reload();
        }, 1000);
      } else {
        throw new Error(result.error || 'Token de emparejamiento inválido o expirado.');
      }
    } catch (err) {
      statusEl.textContent = `Error: ${err.message}`;
      statusEl.style.color = '#f43f5e';
    }
  }

  // Camera scan fallback / implementation
  function startCameraScan(statusEl) {
    statusEl.textContent = 'Iniciando cámara...';
    // If running in browser or Capacitor without native plugin yet, prompt user
    const promptUri = prompt('Si no tienes cámara activa en el simulador, pega el enlace mágico de la PC:');
    if (promptUri) {
      processPairingUri(promptUri, statusEl);
    } else {
      statusEl.textContent = '';
    }
  }

  // Initialize on document ready
  document.addEventListener('DOMContentLoaded', () => {
    // Only show pairing screen if running on remote client without local host
    if (window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
      if (!isPaired()) {
        showPairingModal();
      }
    }

    // Add Haptic feedback on action buttons if Capacitor is present
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
  });

  // Global helper to unpair
  window.unpairServer = () => {
    if (confirm('¿Deseas desvincular este dispositivo de la computadora?')) {
      localStorage.removeItem(STORAGE_KEY_URL);
      localStorage.removeItem(STORAGE_KEY_TOKEN);
      window.location.reload();
    }
  };
})();
