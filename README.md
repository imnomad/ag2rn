# AG2RN — Antigravity 2.0 Remote Native

[![Antigravity 2.0](https://img.shields.io/badge/Antigravity_2.0-Compatible-blue?style=for-the-badge&logo=google)](https://antigravity.google)
[![Platform](https://img.shields.io/badge/Platform-Windows%20|%20macOS%20|%20Linux%20|%20iOS%20|%20Android-green?style=for-the-badge)](#-arquitectura)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=for-the-badge)](./LICENSE)
[![Buy Me A Coffee](https://img.shields.io/badge/Buy%20Me%20A%20Coffee-Donate-orange?style=for-the-badge&logo=buy-me-a-coffee&logoColor=black)](https://buymeacoffee.com/imnomad)

**AG2RN** (*Antigravity 2.0 Remote Native*) is a complete native cross-platform companion suite for **Google Antigravity 2.0**. It lets developers monitor AI coding sessions, review plans, answer interactive questions, approve terminal commands, and chat with their autonomous agents directly from their **iOS** and **Android** devices from anywhere in the world.

---

<table align="center">
  <tr>
    <td align="center"><img src="docs/chat-implementation-plan-card.png" alt="Live Chat & Plan Approval" width="160" /><br><sub>Live Chat & Plan Approval</sub></td>
    <td align="center"><img src="docs/code-diff-view.png" alt="Code Review" width="160" /><br><sub>Code Review</sub></td>
    <td align="center"><img src="docs/command-permission-overlay.png" alt="Command Approvals" width="160" /><br><sub>Command Approvals</sub></td>
    <td align="center"><img src="docs/ask-question-choices.png" alt="Interactive Questions" width="160" /><br><sub>Interactive Questions</sub></td>
  </tr>
</table>

---

## 🌟 ¿Qué es AG2RN?

A diferencia de la versión original (que operaba como un script de terminal con una PWA web), **AG2RN** es un ecosistema de software completo compuesto por:

1. **🖥️ Servidor de Escritorio con UI (Windows, macOS, Linux):**
   * Aplicación nativa y liviana con interfaz visual y soporte para bandeja del sistema (**System Tray**).
   * **Detección automática** del ejecutable de Antigravity 2.0 y del puerto CDP (`DevToolsActivePort`).
   * **Lanzamiento con un clic:** Inicia y gestiona Antigravity 2.0 con `--remote-debugging-port` de forma transparente.
   * **Túnel Seguro Integrado (Zero-Config):** Sin necesidad de configurar puertos de router ni terminales.
   * **Generador de Código QR de Emparejamiento:** Vincula tu teléfono en menos de 3 segundos.

2. **📱 Aplicaciones Móviles Nativas (iOS en App Store & Android en Google Play):**
   * **Escáner QR integrado** para vincular servidores al instante.
   * **Seguridad Biométrica:** Desbloqueo opcional por **Face ID**, **Touch ID** o **Huella Dactilar**.
   * **Almacenamiento Seguro:** Tokens y credenciales protegidos en **iOS Keychain** y **Android Keystore**.
   * **Notificaciones Push Nativas e Interactivas (APNs / FCM):** Aprueba o rechaza comandos de terminal directamente desde la pantalla de bloqueo sin abrir la app.
   * **Sincronización en tiempo real:** Visualización fluida de diffs de código, tarjetas de planes paso a paso y conversaciones.

---

## 🏗️ Arquitectura del Sistema

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           1. TU COMPUTADORA (Host)                              │
│                                                                                 │
│  ┌─────────────────────────┐               ┌─────────────────────────────────┐  │
│  │     Antigravity 2.0     │   CDP Port    │       AG2RN Desktop Server      │  │
│  │   (Agent Orchestrator)  │◄─────────────►│        (Tauri v2 + Rust)        │  │
│  └─────────────────────────┘  (Auto 9000)  │  ┌───────────────────────────┐  │  │
│                                            │  │   Dashboard & System Tray │  │  │
│                                            │  ├───────────────────────────┤  │  │
│                                            │  │   CDP Bridge Core Engine  │  │  │
│                                            │  ├───────────────────────────┤  │  │
│                                            │  │   Embedded Tunnel Daemon  │  │  │
│                                            │  └─────────────┬─────────────┘  │  │
└────────────────────────────────────────────┼────────────────┼────────────────┘  │
                                             │                │                   │
                     ┌───────────────────────┘                └──────────────┐    │
                     │                                                       │    │
                     ▼ WSS / TLS Encrypted                                   ▼    │
     ┌────────────────────────────────┐                    ┌───────────────────┐  │
     │      2. AG2RN Mobile App       │                    │ 3. Cloud Relay    │  │
     │      (iOS & Android)           │                    │ (Push Gateway)    │  │
     │                                │                    └─────────┬─────────┘  │
     │  • QR Scanner / Pairing        │                              │ APNs / FCM │
     │  • Face ID / Biometrics        │                              │ (Alerta)   │
     │  • Live Chat & Diff Canvas     │◄─────────────────────────────┘            │
     │  • Interactive Permission Push │                                           │
     └────────────────────────────────┘                                           │
```

---

## 🚀 Inicio Rápido (Desarrollo)

### Prerrequisitos
- **Node.js 18+**
- **Antigravity 2.0** instalado en tu sistema

### 1. Clonar el repositorio
```bash
git clone https://github.com/imnomad/ag2rn.git
cd ag2rn
npm install
```

### 2. Iniciar el servidor Core
```bash
# Inicia el servidor puente con detección automática multiplataforma
node server.js
```

### 3. Ejecutar los tests de ciclo de vida
```bash
node packages/core/test/lifecycle.test.js
```

---

## 📁 Estructura del Monorepo

```
ag2rn/
├── packages/
│   ├── core/                  # Motor de captura CDP, WebSocket y API de Antigravity 2.0
│   │   ├── src/
│   │   │   ├── cdp-scripts/   # Scripts inyectados al DOM de Antigravity 2.0
│   │   │   ├── lifecycle/     # Detección y gestión de procesos (Win, Mac, Linux)
│   │   │   ├── tunnel/        # Gestor de túneles seguros (Cloudflare / Local IP)
│   │   │   ├── pairing/       # Generador de claves efímeras y payloads QR
│   │   │   └── server.js      # Servidor Express + WebSocket
│   │   └── test/              # Tests unitarios del core
│   │
│   ├── desktop/               # App de escritorio con UI (Tauri v2 + React)
│   │   ├── src-tauri/         # Rust backend, System Tray, Sidecar manager
│   │   └── src/               # UI del Dashboard (Estado, QR, Clientes conectados, Logs)
│   │
│   ├── mobile/                # App móvil nativa (Capacitor iOS & Android)
│   │   ├── ios/               # Proyecto nativo Xcode / Swift (APNs, Keychain, FaceID)
│   │   ├── android/           # Proyecto nativo Android Studio (FCM, Keystore, Biometrics)
│   │   └── src/               # Frontend móvil optimizado + Escáner QR + Visor CDP
│   │
│   └── push-gateway/          # Microservicio Serverless para APNs & FCM
│
└── README.md
```

---

## 📱 Características Principales

* **Supervisión en Tiempo Real:** Visualiza las respuestas del agente, logs de razonamiento y subtareas a medida que ocurren.
* **Aprobación de Permisos Remota:** Autoriza o deniega la ejecución de comandos en la terminal desde cualquier lugar.
* **Preguntas Interactivas (`ask_question`):** Responde preguntas aclaratorias seleccionando opciones predefinidas o escribiendo texto personalizado.
* **Revisión de Diffs de Código:** Navega por los archivos modificados con resaltado de sintaxis antes de que los cambios se confirmen.
* **Comandos Slash (`/btw`, `/grill-me`, `/teamwork-preview`):** Dispara flujos avanzados de Antigravity 2.0 directamente desde tu teléfono.
* **Notificaciones Push con Acciones Rápidas:** Entérate al instante cuando el agente requiera tu atención sin necesidad de tener la app abierta.

---

## 🗺️ Roadmap de Publicación

- [x] **Fase 1:** Motor Core Multi-OS (Detección de Antigravity 2.0 en Windows, macOS y Linux + Protocolo QR).
- [ ] **Fase 2:** Aplicación de Escritorio con UI en **Tauri v2** (System Tray, túnel embebido y panel de emparejamiento).
- [ ] **Fase 3:** Aplicación Móvil Nativa para **iOS (App Store)** y **Android (Google Play)** con Capacitor.
- [ ] **Fase 4:** Push Notification Gateway Serverless (APNs + FCM con acciones interactivas).
- [ ] **Fase 5:** Publicación en **Apple App Store** y **Google Play Store**.

---

## ☕ Apoya el Proyecto / Support

Si encuentras útil **AG2RN** y deseas apoyar su desarrollo continuo:

<a href="https://buymeacoffee.com/imnomad" target="_blank"><img src="https://cdn.buymeacoffee.com/buttons/v2/default-yellow.png" alt="Buy Me A Coffee" height="48" style="height: 48px !important;"></a>

---

## 📄 Licencia

MIT License — consulta [LICENSE](./LICENSE) para más detalles.
Basado y evolucionado a partir de [AG2R](https://github.com/the-future-company/ag2r).
