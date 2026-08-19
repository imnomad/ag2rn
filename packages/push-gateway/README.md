# AG2RN Push Gateway (Serverless)

Un microservicio serverless (Cloudflare Worker / Vercel Edge) **Zero-Knowledge** para el reenvío seguro de notificaciones push nativas a dispositivos **iOS (Apple APNs)** y **Android (Google FCM)**.

---

## 🔒 Privacidad Zero-Knowledge

El Push Gateway es **estatalmente nulo (stateless)**:
* No almacena base de datos con tokens ni mensajes.
* No tiene acceso al código del proyecto ni a las conversaciones.
* Solo actúa como un transportador cifrado entre tu servidor AG2RN y los servidores de Apple/Google.

---

## 🛠️ Configuración de Producción

### 1. Variables de Entorno y Secretos (Cloudflare Worker)

Configura los siguientes secretos mediante `wrangler secret put`:

#### Para Apple APNs (iOS):
1. **`APNS_KEY_ID`**: ID de la clave APNs de 10 caracteres (de Apple Developer Portal -> Keys).
2. **`APNS_TEAM_ID`**: ID de tu equipo Apple Developer de 10 caracteres.
3. **`APNS_PRIVATE_KEY`**: Contenido de tu archivo `.p8` (formato PEM de clave privada).
4. **`APNS_TOPIC`**: Bundle ID de la app iOS (por defecto `com.ag2rn.app`).

#### Para Google FCM (Android):
1. **`FCM_SERVER_KEY`**: Server Key o clave de cuenta de servicio de Firebase Console.

---

## 🚀 Despliegue en 1 Clic

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
