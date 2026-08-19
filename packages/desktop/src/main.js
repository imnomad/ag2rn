// packages/desktop/src/main.js
// AG2RN Desktop Application & System Tray Server for Windows, macOS and Linux

import { app, BrowserWindow, Tray, Menu, nativeImage, shell, dialog } from 'electron';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Global Error Handler so errors are never silent
process.on('uncaughtException', (err) => {
  console.error('[Fatal Desktop Error]', err);
  try {
    dialog.showErrorBox('AG2RN - Error Inesperado', `${err.message}\n\n${err.stack || ''}`);
  } catch {}
});

process.on('unhandledRejection', (reason) => {
  console.error('[Unhandled Rejection]', reason);
});

let mainWindow = null;
let tray = null;
let isQuitting = false;
const SERVER_PORT = process.env.PORT || 3000;
const DASHBOARD_URL = `https://localhost:${SERVER_PORT}/dashboard`;

// Ignore self-signed certs for local HTTPS connection
app.commandLine.appendSwitch('ignore-certificate-errors');

// Resolve the root directory of the application
function getAppRoot() {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, 'app');
  }
  return path.resolve(__dirname, '../../../');
}

// Start the internal AG2RN Express + WebSocket + CDP server
async function startInternalServer() {
  try {
    const root = getAppRoot();
    const serverPath = path.join(root, 'server.js');
    console.log('[Desktop] Bootstrapping core server at:', serverPath);

    if (fs.existsSync(serverPath)) {
      const serverUrl = pathToFileURL(serverPath).href;
      await import(serverUrl);
      console.log('[Desktop] Internal AG2RN Core Server started successfully.');
    } else {
      console.error('[Desktop] server.js not found at:', serverPath);
    }
  } catch (err) {
    console.error('[Desktop] Server bootstrap failed:', err);
    dialog.showErrorBox('AG2RN - Error al iniciar servidor', err.message);
  }
}

function createWindow() {
  const root = getAppRoot();
  const iconPath = path.join(root, 'public', 'ag2r-icon.png');

  mainWindow = new BrowserWindow({
    width: 1120,
    height: 780,
    minWidth: 860,
    minHeight: 620,
    backgroundColor: '#090e17',
    title: 'AG2RN — Antigravity 2.0 Control Center',
    icon: fs.existsSync(iconPath) ? iconPath : undefined,
    show: false, // Show gracefully when ready
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
    autoHideMenuBar: true,
  });

  const loadDashboard = () => {
    mainWindow.loadURL(DASHBOARD_URL).then(() => {
      mainWindow.show();
    }).catch(() => {
      setTimeout(loadDashboard, 800);
    });
  };

  loadDashboard();

  // Minimize to tray on close unless quitting
  mainWindow.on('close', (event) => {
    if (!isQuitting) {
      event.preventDefault();
      mainWindow.hide();
    }
    return false;
  });

  // Open external links in default browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });
}

function createTray() {
  try {
    const root = getAppRoot();
    const iconPath = path.join(root, 'public', 'ag2r-icon.png');
    let icon = null;

    if (fs.existsSync(iconPath)) {
      icon = nativeImage.createFromPath(iconPath).resize({ width: 18, height: 18 });
    } else {
      icon = nativeImage.createEmpty();
    }

    tray = new Tray(icon);
    tray.setToolTip('AG2RN — Antigravity 2.0 Remote');

    const contextMenu = Menu.buildFromTemplate([
      {
        label: 'Abrir Panel de Control',
        click: () => {
          if (mainWindow) {
            mainWindow.show();
            mainWindow.focus();
          }
        },
      },
      {
        label: 'Abrir en Navegador Web',
        click: () => {
          shell.openExternal(DASHBOARD_URL);
        },
      },
      { type: 'separator' },
      {
        label: 'Lanzar Antigravity 2.0',
        click: async () => {
          try {
            const res = await fetch(`https://localhost:${SERVER_PORT}/api/antigravity/launch`, { method: 'POST' });
            const data = await res.json();
            if (data.ok) {
              dialog.showMessageBox({
                type: 'info',
                title: 'AG2RN',
                message: 'Antigravity 2.0 ha sido lanzado con éxito con CDP habilitado.',
              });
            }
          } catch {}
        },
      },
      {
        label: 'Reiniciar Antigravity 2.0',
        click: async () => {
          try {
            await fetch(`https://localhost:${SERVER_PORT}/restart-antigravity`, { method: 'POST' });
          } catch {}
        },
      },
      { type: 'separator' },
      {
        label: 'Salir de AG2RN',
        click: () => {
          isQuitting = true;
          app.quit();
        },
      },
    ]);

    tray.setContextMenu(contextMenu);

    tray.on('double-click', () => {
      if (mainWindow) {
        mainWindow.show();
        mainWindow.focus();
      }
    });
  } catch (err) {
    console.error('[Desktop] Failed to create System Tray:', err);
  }
}

// Single Instance Lock
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.show();
      mainWindow.focus();
    }
  });

  app.whenReady().then(async () => {
    await startInternalServer();
    createTray();
    createWindow();

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  });

  app.on('before-quit', () => {
    isQuitting = true;
  });
}
