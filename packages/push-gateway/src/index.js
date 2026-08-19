// packages/push-gateway/src/index.js
// Stateless Zero-Knowledge Push Notification Gateway for AG2RN (APNs & FCM)

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // CORS Headers
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-AG2RN-Secret',
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    // Health check
    if (url.pathname === '/health' || url.pathname === '/') {
      return new Response(JSON.stringify({ status: 'ok', service: 'ag2rn-push-gateway', version: '2.0.0' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Push Dispatch Endpoint
    if (url.pathname === '/push/dispatch' && request.method === 'POST') {
      try {
        const body = await request.json();
        const { deviceTokens, payload } = body;

        if (!deviceTokens || !Array.isArray(deviceTokens) || deviceTokens.length === 0) {
          return new Response(JSON.stringify({ error: 'deviceTokens array is required' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        if (!payload || !payload.title || !payload.body) {
          return new Response(JSON.stringify({ error: 'payload with title and body is required' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        const results = { apns: { sent: 0, failed: 0 }, fcm: { sent: 0, failed: 0 } };

        // Dispatch to APNs (iOS devices) and FCM (Android devices)
        for (const tokenItem of deviceTokens) {
          const { token, platform } = tokenItem;

          if (platform === 'ios') {
            const apnsSuccess = await sendApnsNotification(token, payload, env);
            if (apnsSuccess) results.apns.sent++;
            else results.apns.failed++;
          } else if (platform === 'android') {
            const fcmSuccess = await sendFcmNotification(token, payload, env);
            if (fcmSuccess) results.fcm.sent++;
            else results.fcm.failed++;
          }
        }

        return new Response(JSON.stringify({ ok: true, results }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      } catch (err) {
        return new Response(JSON.stringify({ ok: false, error: err.message }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    return new Response('Not Found', { status: 404, headers: corsHeaders });
  },
};

/**
 * Dispatches an APNs HTTP/2 notification to an iOS device.
 */
async function sendApnsNotification(deviceToken, payload, env) {
  const useSandbox = env.APNS_USE_SANDBOX === 'true';
  const apnsHost = useSandbox ? 'api.sandbox.push.apple.com' : 'api.push.apple.com';
  const topic = env.APNS_TOPIC || 'com.ag2rn.app';

  // If APNs private key is configured, generate JWT bearer token
  let jwtToken = '';
  if (env.APNS_PRIVATE_KEY && env.APNS_KEY_ID && env.APNS_TEAM_ID) {
    try {
      jwtToken = await generateApnsJwt(env.APNS_KEY_ID, env.APNS_TEAM_ID, env.APNS_PRIVATE_KEY);
    } catch (e) {
      console.error('[APNs] JWT generation error:', e.message);
    }
  }

  const apnsPayload = {
    aps: {
      alert: {
        title: payload.title,
        body: payload.body,
      },
      badge: 1,
      sound: 'default',
      category: payload.category || 'PERMISSION_APPROVAL',
      'mutable-content': 1,
    },
    conversationId: payload.conversationId,
    url: payload.url,
    tag: payload.tag,
  };

  try {
    const res = await fetch(`https://${apnsHost}/3/device/${deviceToken}`, {
      method: 'POST',
      headers: {
        'apns-topic': topic,
        'apns-push-type': 'alert',
        'apns-priority': '10',
        'apns-expiration': '0',
        ...(jwtToken ? { authorization: `bearer ${jwtToken}` } : {}),
      },
      body: JSON.stringify(apnsPayload),
    });

    return res.ok || res.status === 200;
  } catch (err) {
    console.error('[APNs] Dispatch failed:', err.message);
    return false;
  }
}

/**
 * Dispatches an FCM notification to an Android device.
 */
async function sendFcmNotification(deviceToken, payload, env) {
  const serverKey = env.FCM_SERVER_KEY;
  if (!serverKey) return false;

  const fcmPayload = {
    to: deviceToken,
    priority: 'high',
    notification: {
      title: payload.title,
      body: payload.body,
      sound: 'default',
      click_action: 'FLUTTER_NOTIFICATION_CLICK',
    },
    data: {
      conversationId: payload.conversationId || '',
      url: payload.url || '',
      tag: payload.tag || '',
      category: payload.category || 'PERMISSION_APPROVAL',
    },
  };

  try {
    const res = await fetch('https://fcm.googleapis.com/fcm/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `key=${serverKey}`,
      },
      body: JSON.stringify(fcmPayload),
    });

    return res.ok;
  } catch (err) {
    console.error('[FCM] Dispatch failed:', err.message);
    return false;
  }
}

/**
 * Generates an APNs authentication token (JWT signed with ECDSA P-256 / SHA-256)
 * using the standard Web Crypto API supported in Cloudflare Workers and Node.js.
 */
async function generateApnsJwt(keyId, teamId, privateKeyPem) {
  const header = { alg: 'ES256', kid: keyId };
  const now = Math.floor(Date.now() / 1000);
  const claims = { iss: teamId, iat: now };

  const encodeBase64Url = (obj) => {
    const str = JSON.stringify(obj);
    return btoa(str).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  };

  const headerB64 = encodeBase64Url(header);
  const claimsB64 = encodeBase64Url(claims);
  const unsignedToken = `${headerB64}.${claimsB64}`;

  // Clean PEM formatting to binary DER
  const pemHeader = '-----BEGIN PRIVATE KEY-----';
  const pemFooter = '-----END PRIVATE KEY-----';
  const cleanPem = privateKeyPem
    .replace(pemHeader, '')
    .replace(pemFooter, '')
    .replace(/\s+/g, '');
  const binaryDer = Uint8Array.from(atob(cleanPem), (c) => c.charCodeAt(0));

  const cryptoKey = await crypto.subtle.importKey(
    'pkcs8',
    binaryDer.buffer,
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['sign']
  );

  const encoder = new TextEncoder();
  const signature = await crypto.subtle.sign(
    { name: 'ECDSA', hash: { name: 'SHA-256' } },
    cryptoKey,
    encoder.encode(unsignedToken)
  );

  const sigB64 = btoa(String.fromCharCode(...new Uint8Array(signature)))
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');

  return `${unsignedToken}.${sigB64}`;
}
