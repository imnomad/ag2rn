# AG2RN Push Gateway (Serverless)

A stateless, **Zero-Knowledge** serverless microservice (Cloudflare Worker / Vercel Edge) for securely forwarding native push notifications to **iOS (Apple APNs)** and **Android (Google FCM)** devices.

---

## 🔒 Zero-Knowledge Privacy

The Push Gateway is **stateless**:
* It stores no database of tokens or message history.
* It has zero access to project source code or conversation transcripts.
* It acts strictly as an encrypted forwarder between your local AG2RN host and official Apple/Google push notification servers.

---

## 🛠️ Production Configuration

### 1. Environment Variables & Secrets (Cloudflare Worker)

Configure the following secrets using `wrangler secret put`:

#### For Apple APNs (iOS):
1. **`APNS_KEY_ID`**: 10-character APNs Key ID (from Apple Developer Portal -> Keys).
2. **`APNS_TEAM_ID`**: 10-character Apple Developer Team ID.
3. **`APNS_PRIVATE_KEY`**: Contents of your `.p8` file (PEM private key format).
4. **`APNS_TOPIC`**: iOS app bundle ID (defaults to `com.ag2rn.app`).

#### For Google FCM (Android):
1. **`FCM_SERVER_KEY`**: Server Key or Service Account credentials from Firebase Console.

---

## 🚀 1-Click Deployment

```bash
cd packages/push-gateway
npm install
npx wrangler deploy
```

---

## 📡 API Endpoint

### `POST /push/dispatch`

**Headers:**
```http
Content-Type: application/json
```

**Request Body:**
```json
{
  "deviceTokens": [
    { "token": "apns-device-token-hex-123...", "platform": "ios" },
    { "token": "fcm-registration-token-456...", "platform": "android" }
  ],
  "payload": {
    "title": "AG2RN",
    "body": "Command approval | npm test",
    "category": "PERMISSION_APPROVAL",
    "conversationId": "conv-uuid-123",
    "url": "https://..."
  }
}
```
