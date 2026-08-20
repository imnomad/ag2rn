// packages/desktop/src/main.js
// AG2RN Desktop Application & System Tray Server for Windows, macOS and Linux

import { app, BrowserWindow, Tray, Menu, nativeImage, shell, dialog } from 'electron';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import fs from 'fs';
import { findAvailablePort } from '../../core/src/tunnel/port-finder.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Global Error Handler so fatal errors are caught gracefully
process.on('uncaughtException', (err) => {
  if (err.message && err.message.includes('EADDRINUSE')) {
    console.log('[Desktop] Port in use notice (non-fatal):', err.message);
    return;
  }
  console.error('[Fatal Desktop Error]', err);
  try {
    dialog.showErrorBox('AG2RN - Unexpected Error', `${err.message}\n\n${err.stack || ''}`);
  } catch {}
});

process.on('unhandledRejection', (reason) => {
  console.error('[Unhandled Rejection]', reason);
});

let mainWindow = null;
let tray = null;
let isQuitting = false;
let SERVER_PORT = parseInt(process.env.PORT || '3820');

function getDashboardUrl() {
  return `https://localhost:${SERVER_PORT}/dashboard`;
}

// Ignore self-signed certs for local HTTPS connection
app.commandLine.appendSwitch('ignore-certificate-errors');

// Resolve the root directory of the application
function getAppRoot() {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, 'app');
  }
  return path.resolve(__dirname, '../../../');
}

// Check if server is already responding on a port
async function isServerRunning(port) {
  try {
    const res = await fetch(`https://localhost:${port}/api/status`);
    return res.status === 200 || res.status === 401;
  } catch {
    return false;
  }
}

// Start the internal AG2RN Express + WebSocket + CDP server
async function startInternalServer() {
  try {
    const isRunning = await isServerRunning(SERVER_PORT);
    if (isRunning) {
      console.log('[Desktop] Server is already active on port', SERVER_PORT);
      return;
    }

    const root = getAppRoot();
    const serverPath = path.join(root, 'server.js');
    console.log('[Desktop] Bootstrapping core server at:', serverPath);

    if (fs.existsSync(serverPath)) {
      const serverUrl = pathToFileURL(serverPath).href;
      await import(serverUrl);
      console.log('[Desktop] Internal AG2RN Core Server started successfully on port', SERVER_PORT);
    } else {
      console.error('[Desktop] server.js not found at:', serverPath);
    }
  } catch (err) {
    if (err.message && err.message.includes('EADDRINUSE')) {
      console.log('[Desktop] Port already active (attached cleanly)');
      return;
    }
    console.error('[Desktop] Server bootstrap notice:', err.message);
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
    mainWindow.loadURL(getDashboardUrl()).then(() => {
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
        label: 'Open Control Center',
        click: () => {
          if (mainWindow) {
            mainWindow.show();
            mainWindow.focus();
          }
        },
      },
      {
        label: 'Open in Web Browser',
        click: () => {
          shell.openExternal(getDashboardUrl());
        },
      },
      { type: 'separator' },
      {
        label: 'Launch Antigravity 2.0',
        click: async () => {
          try {
            const res = await fetch(`https://localhost:${SERVER_PORT}/api/antigravity/launch`, { method: 'POST' });
            const data = await res.json();
            if (data.ok) {
              dialog.showMessageBox({
                type: 'info',
                title: 'AG2RN',
                message: 'Antigravity 2.0 has been launched successfully with CDP enabled.',
              });
            }
          } catch {}
        },
      },
      {
        label: 'Restart Antigravity 2.0',
        click: async () => {
          try {
            await fetch(`https://localhost:${SERVER_PORT}/restart-antigravity`, { method: 'POST' });
          } catch {}
        },
      },
      { type: 'separator' },
      {
        label: 'Quit AG2RN',
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
    const alreadyRunning = await isServerRunning(SERVER_PORT);
    if (!alreadyRunning) {
      SERVER_PORT = await findAvailablePort(SERVER_PORT);
      process.env.PORT = String(SERVER_PORT);
      await startInternalServer();
    } else {
      console.log('[Desktop] Existing AG2RN server detected on port', SERVER_PORT);
    }

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
