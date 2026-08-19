// packages/desktop/src/main.js
// AG2RN Desktop Application & System Tray Server for Windows, macOS and Linux

import { app, BrowserWindow, Tray, Menu, nativeImage, shell, dialog } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';
import http from 'http';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let mainWindow = null;
let tray = null;
let isQuitting = false;
const SERVER_PORT = process.env.PORT || 3000;
const DASHBOARD_URL = `https://localhost:${SERVER_PORT}/dashboard`;

// Ignore self-signed certs for local HTTPS connection
app.commandLine.appendSwitch('ignore-certificate-errors');

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1100,
    height: 760,
    minWidth: 800,
    minHeight: 600,
    backgroundColor: '#090e17',
    title: 'AG2RN — Antigravity 2.0 Control Center',
    icon: path.join(__dirname, '../../../public/ag2r-icon.png'),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
    autoHideMenuBar: true,
  });

  mainWindow.loadURL(DASHBOARD_URL).catch(() => {
    // Retry if server is still starting
    setTimeout(() => {
      if (mainWindow) mainWindow.loadURL(DASHBOARD_URL);
    }, 1500);
  });

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
  const iconPath = path.join(__dirname, '../../../public/ag2r-icon.png');
  const icon = nativeImage.createFromPath(iconPath).resize({ width: 18, height: 18 });

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
      label: 'Abrir en Navegador',
      click: () => {
        shell.openExternal(DASHBOARD_URL);
      },
    },
    { type: 'separator' },
    {
      label: 'Lanzar Antigravity 2.0',
      click: async () => {
        try {
          const res = await fetch(`http://localhost:${SERVER_PORT}/api/antigravity/launch`, { method: 'POST' });
          const data = await res.json();
          if (data.ok) {
            dialog.showMessageBox({
              type: 'info',
              title: 'AG2RN',
              message: 'Antigravity 2.0 ha sido lanzado con éxito.',
            });
          }
        } catch {}
      },
    },
    {
      label: 'Reiniciar Antigravity 2.0',
      click: async () => {
        try {
          await fetch(`http://localhost:${SERVER_PORT}/restart-antigravity`, { method: 'POST' });
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

  app.whenReady().then(() => {
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
