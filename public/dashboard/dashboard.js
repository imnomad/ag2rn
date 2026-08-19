// public/dashboard/dashboard.js
// AG2RN Desktop Control Center Client

document.addEventListener('DOMContentLoaded', () => {
  // Elements
  const globalDot = document.getElementById('sidebar-global-dot');
  const globalStatus = document.getElementById('sidebar-global-status');
  
  const agBadge = document.getElementById('ag-process-badge');
  const agTitle = document.getElementById('ag-process-title');
  const agDetail = document.getElementById('ag-process-detail');
  const agPortVal = document.getElementById('ag-cdp-port-val');
  
  const cdpBadge = document.getElementById('cdp-status-badge');
  const cdpTitle = document.getElementById('cdp-status-title');
  const cdpDetail = document.getElementById('cdp-status-detail');
  const agentStateVal = document.getElementById('agent-state-val');
  
  const networkUrlVal = document.getElementById('network-url-val');
  const wsClientsCount = document.getElementById('ws-clients-count');
  
  const qrImage = document.getElementById('qr-image');
  const qrImageLarge = document.getElementById('qr-image-large');
  const qrLoading = document.getElementById('qr-loading');
  
  const devicesList = document.getElementById('devices-list');
  const devicesCountBadge = document.getElementById('devices-count-badge');
  const logsConsole = document.getElementById('logs-console');
  
  const btnLaunchAg = document.getElementById('btn-launch-ag');
  const btnRestartAg = document.getElementById('btn-restart-ag');
  const btnRefresh = document.getElementById('btn-refresh');
  const btnRefreshQr = document.getElementById('btn-refresh-qr');
  const btnCopyMagicLink = document.getElementById('btn-copy-magic-link');
  const btnClearLogs = document.getElementById('btn-clear-logs');

  let currentQrPayload = '';

  // Log helper
  function addLog(message, isError = false) {
    const entry = document.createElement('div');
    entry.className = isError ? 'log-entry log-err' : 'log-entry';
    const ts = new Date().toLocaleTimeString();
    entry.textContent = `[${ts}] ${message}`;
    logsConsole.appendChild(entry);
    logsConsole.scrollTop = logsConsole.scrollHeight;
  }

  // Navigation tabs
  document.querySelectorAll('.nav-item').forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      document.querySelectorAll('.nav-item').forEach(l => l.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
      
      link.classList.add('active');
      const tabId = link.getAttribute('data-tab');
      const target = document.getElementById(`tab-${tabId}`);
      if (target) target.classList.add('active');

      const titleMap = {
        overview: 'Panel de Control',
        pairing: 'Vincular Dispositivo Móvil',
        devices: 'Dispositivos Autorizados',
        logs: 'Consola de Eventos y Diagnósticos',
      };
      document.getElementById('page-title').textContent = titleMap[tabId] || 'AG2RN';
    });
  });

  // Fetch Full Status
  async function refreshStatus() {
    try {
      const res = await fetch('/api/status');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();

      // Antigravity 2.0 Status
      if (data.antigravityRunning) {
        agBadge.textContent = 'En ejecución';
        agBadge.className = 'card-tag tag-emerald';
        agTitle.textContent = 'Antigravity 2.0 Activo';
        agDetail.textContent = `PID: ${data.antigravityPid}`;
      } else {
        agBadge.textContent = 'Inactivo';
        agBadge.className = 'card-tag tag-rose';
        agTitle.textContent = 'Antigravity 2.0 Detenido';
        agDetail.textContent = 'Haz clic en "Lanzar Antigravity" para iniciar.';
      }

      agPortVal.textContent = data.cdpPort || '9000';

      // CDP Bridge Status
      if (data.cdpConnected) {
        cdpBadge.textContent = 'Conectado';
        cdpBadge.className = 'card-tag tag-emerald';
        cdpTitle.textContent = 'Bridge CDP Enlazado';
        cdpDetail.textContent = `Conectado a puerto ${data.cdpPort}`;
        globalDot.className = 'status-dot online';
        globalStatus.textContent = 'En línea';
      } else {
        cdpBadge.textContent = 'Desconectado';
        cdpBadge.className = 'card-tag tag-rose';
        cdpTitle.textContent = 'Esperando CDP...';
        cdpDetail.textContent = 'Antigravity debe tener --remote-debugging-port';
        globalDot.className = 'status-dot offline';
        globalStatus.textContent = 'Esperando Antigravity';
      }

      // Network & Clients
      networkUrlVal.textContent = data.connectionUrl || 'https://localhost:3000';
      wsClientsCount.textContent = data.wsClients || 0;

    } catch (err) {
      addLog(`Error al consultar estado: ${err.message}`, true);
    }
  }

  // Fetch QR Code
  async function refreshQrCode() {
    qrLoading.style.display = 'flex';
    try {
      const res = await fetch('/api/pairing/qr');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();

      if (data.ok && data.qrDataUrl) {
        qrImage.src = data.qrDataUrl;
        if (qrImageLarge) qrImageLarge.src = data.qrDataUrl;
        currentQrPayload = data.qrPayload;
        qrLoading.style.display = 'none';
        addLog(`Nuevo código QR generado. Vence a las: ${new Date(data.expiresAt).toLocaleTimeString()}`);
      }
    } catch (err) {
      addLog(`Error generando QR: ${err.message}`, true);
    }
  }

  // Fetch Paired Devices
  async function refreshDevices() {
    try {
      const res = await fetch('/api/pairing/devices');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const devices = data.devices || [];

      devicesCountBadge.textContent = `${devices.length} dispositivo(s)`;

      if (devices.length === 0) {
        devicesList.innerHTML = `
          <div class="empty-devices">
            <span class="material-symbols-rounded">mobile_off</span>
            <p>No hay dispositivos móviles vinculados aún.</p>
            <small>Escanea el código QR para autorizar tu primer teléfono.</small>
          </div>
        `;
        return;
      }

      devicesList.innerHTML = devices.map(d => `
        <div class="device-item">
          <div class="device-info">
            <h4>${d.deviceName} <span class="badge">${d.platform.toUpperCase()}</span></h4>
            <p>Última conexión: ${new Date(d.lastSeen).toLocaleString()}</p>
          </div>
          <button class="btn btn-sm btn-ghost text-rose" onclick="revokeDevice('${d.deviceId}')">
            Revocar
          </button>
        </div>
      `).join('');

    } catch (err) {
      addLog(`Error cargando dispositivos: ${err.message}`, true);
    }
  }

  // Global revoke helper
  window.revokeDevice = async (deviceId) => {
    if (!confirm('¿Deseas revocar el acceso a este dispositivo?')) return;
    try {
      const res = await fetch('/api/pairing/revoke', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deviceId }),
      });
      if (res.ok) {
        addLog(`Dispositivo ${deviceId} revocado con éxito.`);
        refreshDevices();
      }
    } catch (err) {
      addLog(`Error revocando dispositivo: ${err.message}`, true);
    }
  };

  // Launch Antigravity
  btnLaunchAg.addEventListener('click', async () => {
    addLog('Solicitando lanzamiento de Antigravity 2.0...');
    btnLaunchAg.disabled = true;
    try {
      const res = await fetch('/api/antigravity/launch', { method: 'POST' });
      const data = await res.json();
      if (data.ok) {
        addLog(`Antigravity 2.0 lanzado con éxito (PID: ${data.pid || 'Iniciado'})`);
      } else {
        addLog(`Error lanzando Antigravity: ${data.reason}`, true);
      }
    } catch (err) {
      addLog(`Error de red: ${err.message}`, true);
    } finally {
      setTimeout(() => {
        btnLaunchAg.disabled = false;
        refreshStatus();
      }, 2000);
    }
  });

  // Restart Antigravity
  btnRestartAg.addEventListener('click', async () => {
    if (!confirm('¿Deseas reiniciar el proceso de Antigravity 2.0?')) return;
    addLog('Reiniciando Antigravity 2.0...');
    btnRestartAg.disabled = true;
    try {
      const res = await fetch('/restart-antigravity', { method: 'POST' });
      const data = await res.json();
      if (data.ok) {
        addLog('Reinicio de Antigravity 2.0 completado.');
      } else {
        addLog(`Error al reiniciar: ${data.reason}`, true);
      }
    } catch (err) {
      addLog(`Error de red: ${err.message}`, true);
    } finally {
      setTimeout(() => {
        btnRestartAg.disabled = false;
        refreshStatus();
      }, 3000);
    }
  });

  // Copy Magic Link
  btnCopyMagicLink.addEventListener('click', () => {
    if (!currentQrPayload) return;
    navigator.clipboard.writeText(currentQrPayload).then(() => {
      const orig = btnCopyMagicLink.innerHTML;
      btnCopyMagicLink.innerHTML = `<span class="material-symbols-rounded">check</span><span>¡Copiado!</span>`;
      setTimeout(() => { btnCopyMagicLink.innerHTML = orig; }, 2000);
      addLog('Enlace de emparejamiento copiado al portapapeles.');
    });
  });

  // Refresh Buttons
  btnRefresh.addEventListener('click', () => {
    refreshStatus();
    refreshDevices();
  });

  btnRefreshQr.addEventListener('click', () => {
    refreshQrCode();
  });

  btnClearLogs.addEventListener('click', () => {
    logsConsole.innerHTML = '';
  });

  // Initial Load
  refreshStatus();
  refreshQrCode();
  refreshDevices();

  // Polling updates every 4 seconds
  setInterval(refreshStatus, 4000);
  setInterval(refreshDevices, 10000);
});
