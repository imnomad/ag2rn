# AG2RN — Antigravity 2.0 Remote Native

[![Antigravity 2.0](https://img.shields.io/badge/Antigravity_2.0-Compatible-blue?style=for-the-badge&logo=google)](https://antigravity.google)
[![Platform](https://img.shields.io/badge/Platform-Windows%20|%20macOS%20|%20Linux%20|%20iOS%20|%20Android-green?style=for-the-badge)](#-system-architecture)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=for-the-badge)](./LICENSE)

**AG2RN** (*Antigravity 2.0 Remote Native*) is a complete native cross-platform companion and remote bridge suite for **Google Antigravity 2.0**. It allows developers to monitor autonomous AI coding sessions, review implementation plans, answer interactive interview questions, approve terminal command executions, and chat with their AI agents directly from their **iOS** and **Android** mobile devices or desktop companion from anywhere in the world.

---

<table align="center">
  <tr>
    <td align="center"><img src="docs/chat-implementation-plan-card.png" alt="Live Chat & Plan Approval" width="160" /><br><sub>Live Chat & Plan Approval</sub></td>
    <td align="center"><img src="docs/code-diff-view.png" alt="Code Review" width="160" /><br><sub>Code Review & Diffs</sub></td>
    <td align="center"><img src="docs/command-permission-overlay.png" alt="Command Approvals" width="160" /><br><sub>Command Approvals</sub></td>
    <td align="center"><img src="docs/ask-question-choices.png" alt="Interactive Questions" width="160" /><br><sub>Interactive Questions</sub></td>
    <td align="center"><img src="docs/push-notification-native.png" alt="Native Push Notifications" width="160" /><br><sub>Push Notifications</sub></td>
  </tr>
</table>

---

## 🌟 What is AG2RN?

Unlike standard web wrappers or terminal scripts, **AG2RN** is an integrated multi-tier software ecosystem built for modern developer workflows:

1. **🖥️ Desktop Control Center (Windows, macOS, Linux):**
   * Lightweight desktop application with a visual dashboard and **System Tray** integration.
   * **Automatic detection** of Antigravity 2.0 executable installations and active CDP ports (`DevToolsActivePort`).
   * **1-Click Launch & Auto-Attach:** Starts and manages Antigravity 2.0 with `--remote-debugging-port` transparently.
   * **Embedded Zero-Config Tunneling:** Integrated Cloudflare Quick Tunnel and local network discovery for zero-port-forwarding connectivity.
   * **QR Pairing Protocol:** Generate secure, ephemeral QR codes to link your mobile devices in under 3 seconds.

2. **📱 Native Mobile Companion Apps (iOS & Android):**
   * **Integrated QR Scanner:** Point your camera to pair instantly with your desktop host.
   * **Biometric Authentication:** Secure your session with **Face ID**, **Touch ID**, or **Fingerprint Unlock**.
   * **Secure Credential Vault:** Authorization tokens encrypted within **iOS Keychain** and **Android Keystore**.
   * **Actionable Native Push Notifications (APNs / FCM):** Approve or reject terminal commands and review agent questions directly from your lock screen without opening the app.
   * **Real-time Synchronization:** View live reasoning streams, step-by-step implementation plans, code diffs, and queued messages.

3. **☁️ Serverless Push Gateway (Cloudflare Worker / Edge):**
   * **Stateless Zero-Knowledge architecture:** Delivers APNs and FCM notifications without storing user code, session content, or private keys.

---

## 🏗️ System Architecture

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                            1. YOUR COMPUTER (Host)                              │
│                                                                                 │
│  ┌─────────────────────────┐               ┌─────────────────────────────────┐  │
│  │     Antigravity 2.0     │   CDP Port    │       AG2RN Desktop Server      │  │
│  │   (Agent Orchestrator)  │◄─────────────►│     (Electron + System Tray)    │  │
│  └─────────────────────────┘  (Auto 9000)  │  ┌───────────────────────────┐  │  │
│                                            │  │   Control Panel Dashboard │  │  │
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
     │  • QR Scanner & Auto-Pairing   │                              │ APNs / FCM │
     │  • Biometric Security (FaceID) │                              │ (Alert)    │
     │  • Live Chat & Diff Canvas     │◄─────────────────────────────┘            │
     │  • Interactive Permission Push │                                           │
     └────────────────────────────────┘                                           │
```

---

## 🚀 Quickstart (Development & Setup)

### Prerequisites
- **Node.js 18+**
- **Google Antigravity 2.0** installed on your system

### 1. Clone the Repository
```bash
git clone https://github.com/imnomad/ag2rn.git
cd ag2rn
npm install
```

### 2. Start the Core Server
```bash
# Starts the Express + WebSocket bridge server with cross-platform auto-detection
npm start
```

### 3. Launch Desktop Control Center
```bash
# Launches the Electron desktop UI with System Tray support
npm run desktop
```

### 4. Build Mobile Web Distribution
```bash
# Syncs web assets to the Capacitor mobile client directory
npm run mobile:build
```

### 5. Run Unit Tests
```bash
# Executes lifecycle detection, pairing protocol, and tunnel tests
npm test
```

---

## 📁 Monorepo Structure

```
ag2rn/
├── packages/
│   ├── core/                  # CDP capture engine, WebSocket bridge, lifecycle & pairing
│   │   ├── src/
│   │   │   ├── cdp-scripts/   # DOM injection scripts evaluated in Antigravity 2.0
│   │   │   ├── lifecycle/     # Process detection and launcher (Win, macOS, Linux)
│   │   │   ├── tunnel/        # Cloudflare & local network tunnel discovery
│   │   │   └── pairing/       # Ephemeral token generation and QR payload builder
│   │   └── test/              # Unit tests for core lifecycle and pairing
│   │
│   ├── desktop/               # Desktop application (Electron + Dashboard UI + System Tray)
│   │   ├── src/
│   │   │   └── main.js        # Electron main process, tray menu, and single-instance lock
│   │   └── package.json
│   │
│   ├── mobile/                # Native mobile companion (Capacitor iOS & Android)
│   │   ├── ios/               # Native Xcode / Swift workspace (APNs, Keychain, Face ID)
│   │   ├── android/           # Native Android Studio project (FCM, Keystore, Biometrics)
│   │   ├── www/               # Synchronized mobile distribution assets
│   │   └── build-mobile.js    # Asset synchronization build script
│   │
│   └── push-gateway/          # Stateless Serverless Gateway for APNs & FCM push alerts
│       ├── src/
│       │   └── index.js       # Cloudflare Worker / Edge push dispatcher
│       └── wrangler.toml
│
├── public/                    # Web client assets, Dashboard UI, icons and styles
├── server.js                  # Main server entrypoint (Express + WebSocket + CDP Bridge)
└── README.md
```

---

## 📱 Key Capabilities

* **Real-time Monitoring:** Watch agent responses, step-by-step thinking logs, and background subagent tasks as they happen.
* **Remote Terminal Permission Approvals:** Authorize or deny dangerous command execution on your host terminal from your phone.
* **Interactive Interviews (`ask_question`):** Answer clarifying questions by tapping pre-defined choice chips or typing custom answers.
* **Code Diff Reviewer:** Inspect file diffs with syntax highlighting and collapsible changes before commits are made.
* **Antigravity Slash Commands:** Trigger specialized workflows such as `/btw` side-questions, `/grill-me` interviews, and `/teamwork-preview`.
* **Actionable Native Push Notifications:** Receive instant lock-screen alerts whenever an agent requests terminal permissions or design feedback.

---

## 🗺️ Roadmap

- [x] **Phase 1:** Multi-OS Core Engine (Antigravity 2.0 detection on Windows, macOS, Linux + QR Protocol).
- [x] **Phase 2:** Desktop Control Center with System Tray, embedded tunneling, and QR dashboard.
- [x] **Phase 3:** Native Mobile Companion for **iOS** and **Android** with Capacitor and Biometric security.
- [x] **Phase 4:** Serverless Push Notification Gateway (APNs + FCM with interactive notifications).
- [ ] **Phase 5:** Distribution packaging for Apple App Store and Google Play Store.

---

## 📄 License

MIT License — see [LICENSE](./LICENSE) for details.
Based on and evolved from [AG2R](https://github.com/the-future-company/ag2r).
