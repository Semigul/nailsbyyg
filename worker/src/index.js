import { DurableObject } from "cloudflare:workers";
import webpush from "web-push";
import {
  buildOrderNotification,
  isAllowedOrigin,
  readCustomerOrderDocument,
  validateAdminId,
  validateOrderId,
  validatePushSubscription
} from "./notification-data.js";

const JSON_HEADERS = {
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "no-store"
};
const SUBSCRIPTIONS_KEY = "push-subscriptions";
const NOTIFIED_ORDER_PREFIX = "notified-order:";
const MAX_SUBSCRIPTIONS = 20;
const STALE_PUSH_STATUS_CODES = new Set([404, 410]);

export class OrderNotificationHub extends DurableObject {
  async fetch(request) {
    const url = new URL(request.url);

    if (url.pathname === "/subscriptions" && request.method === "POST") {
      const subscription = validatePushSubscription(await readJson(request));

      if (!subscription) {
        return json({ error: "Invalid push subscription" }, 400);
      }

      const subscriptions = await this.ctx.storage.get(SUBSCRIPTIONS_KEY) || [];
      const nextSubscriptions = [
        ...subscriptions.filter((item) => item.endpoint !== subscription.endpoint),
        subscription
      ].slice(-MAX_SUBSCRIPTIONS);

      await this.ctx.storage.put(SUBSCRIPTIONS_KEY, nextSubscriptions);
      return json({ ok: true });
    }

    if (url.pathname === "/subscriptions" && request.method === "DELETE") {
      const endpoint = String((await readJson(request))?.endpoint || "").trim();
      const subscriptions = await this.ctx.storage.get(SUBSCRIPTIONS_KEY) || [];
      const nextSubscriptions = subscriptions.filter((item) => item.endpoint !== endpoint);

      await this.ctx.storage.put(SUBSCRIPTIONS_KEY, nextSubscriptions);
      return json({ ok: true });
    }

    if (url.pathname === "/order-notifications" && request.method === "POST") {
      const order = await readJson(request);
      const notificationKey = `${NOTIFIED_ORDER_PREFIX}${order?.id || ""}`;
      const alreadyNotified = await this.ctx.storage.get(notificationKey);

      if (alreadyNotified) {
        return json({ ok: true, duplicate: true, delivered: 0 });
      }

      const subscriptions = await this.ctx.storage.get(SUBSCRIPTIONS_KEY) || [];

      if (subscriptions.length === 0) {
        return json({ ok: true, delivered: 0, reason: "no-subscriptions" }, 202);
      }

      webpush.setVapidDetails(
        this.env.VAPID_SUBJECT,
        this.env.VAPID_PUBLIC_KEY,
        this.env.VAPID_PRIVATE_KEY
      );

      const payload = JSON.stringify(buildOrderNotification(order));
      const results = await Promise.allSettled(
        subscriptions.map((subscription) =>
          webpush.sendNotification(subscription, payload, {
            TTL: 300,
            urgency: "high",
            topic: order.id.slice(0, 32)
          })
        )
      );
      const staleEndpoints = new Set();
      let delivered = 0;
      let temporaryFailures = 0;

      results.forEach((result, index) => {
        if (result.status === "fulfilled") {
          delivered += 1;
          return;
        }

        const statusCode = Number(result.reason?.statusCode || 0);

        if (STALE_PUSH_STATUS_CODES.has(statusCode)) {
          staleEndpoints.add(subscriptions[index].endpoint);
        } else {
          temporaryFailures += 1;
        }
      });

      if (staleEndpoints.size > 0) {
        await this.ctx.storage.put(
          SUBSCRIPTIONS_KEY,
          subscriptions.filter((item) => !staleEndpoints.has(item.endpoint))
        );
      }

      if (delivered === 0 && temporaryFailures > 0) {
        return json({ error: "Push delivery failed temporarily" }, 503);
      }

      if (delivered > 0) {
        await this.ctx.storage.put(notificationKey, Date.now());
      }

      return json({
        ok: true,
        delivered,
        removed: staleEndpoints.size
      });
    }

    return json({ error: "Not found" }, 404);
  }
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin") || "";
    const corsHeaders = createCorsHeaders(origin, env);

    if (!isAllowedOrigin(origin, env.ALLOWED_ORIGINS)) {
      return json({ error: "Origin not allowed" }, 403);
    }

    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: corsHeaders
      });
    }

    const url = new URL(request.url);

    if (url.pathname === "/v1/config" && request.method === "GET") {
      const publicKey = String(env.VAPID_PUBLIC_KEY || "").trim();

      if (!/^[A-Za-z0-9_-]{80,120}$/.test(publicKey)) {
        return withCors(json({ error: "Push is not configured" }, 503), corsHeaders);
      }

      const response = json({ publicKey });
      response.headers.set("Cache-Control", "public, max-age=3600");
      return withCors(response, corsHeaders);
    }

    if (url.pathname === "/v1/subscriptions" && request.method === "POST") {
      const token = getBearerToken(request);
      const body = await readJson(request);
      const adminId = validateAdminId(body?.adminId);
      const subscription = validatePushSubscription(body?.subscription);

      if (!token || !adminId || !subscription) {
        return withCors(json({ error: "Invalid request" }, 400), corsHeaders);
      }

      const isAdmin = await verifyAdmin(env, token, adminId);

      if (!isAdmin) {
        return withCors(json({ error: "Admin access required" }, 403), corsHeaders);
      }

      return relayHubResponse(
        await notificationHub(env).fetch("https://internal/subscriptions", {
          method: "POST",
          body: JSON.stringify(subscription)
        }),
        corsHeaders
      );
    }

    if (url.pathname === "/v1/subscriptions" && request.method === "DELETE") {
      const token = getBearerToken(request);
      const body = await readJson(request);
      const adminId = validateAdminId(body?.adminId);
      const endpoint = String(body?.endpoint || "").trim();

      if (!token || !adminId || !endpoint.startsWith("https://")) {
        return withCors(json({ error: "Invalid request" }, 400), corsHeaders);
      }

      const isAdmin = await verifyAdmin(env, token, adminId);

      if (!isAdmin) {
        return withCors(json({ error: "Admin access required" }, 403), corsHeaders);
      }

      return relayHubResponse(
        await notificationHub(env).fetch("https://internal/subscriptions", {
          method: "DELETE",
          body: JSON.stringify({ endpoint })
        }),
        corsHeaders
      );
    }

    if (url.pathname === "/v1/order-notifications" && request.method === "POST") {
      const token = getBearerToken(request);
      const body = await readJson(request);
      const orderId = validateOrderId(body?.orderId);

      if (!token || !orderId) {
        return withCors(json({ error: "Invalid request" }, 400), corsHeaders);
      }

      const firestoreOrder = await fetchFirestoreDocument(env, token, "orders", orderId);

      if (!firestoreOrder.ok) {
        const status = firestoreOrder.status === 404 ? 404 : 403;
        return withCors(json({ error: "Order access denied" }, status), corsHeaders);
      }

      const order = readCustomerOrderDocument(orderId, await firestoreOrder.json());

      if (!order) {
        return withCors(json({ error: "Order cannot trigger notifications" }, 400), corsHeaders);
      }

      return relayHubResponse(
        await notificationHub(env).fetch("https://internal/order-notifications", {
          method: "POST",
          body: JSON.stringify(order)
        }),
        corsHeaders
      );
    }

    return withCors(json({ error: "Not found" }, 404), corsHeaders);
  }
};

function notificationHub(env) {
  const id = env.ORDER_NOTIFICATION_HUB.idFromName("greta");
  return env.ORDER_NOTIFICATION_HUB.get(id);
}

async function verifyAdmin(env, token, adminId) {
  const response = await fetchFirestoreDocument(env, token, "admins", adminId);

  if (!response.ok) {
    return false;
  }

  const document = await response.json();
  return document?.fields?.role?.stringValue === "admin";
}

function fetchFirestoreDocument(env, token, collectionName, documentId) {
  const projectId = String(env.FIREBASE_PROJECT_ID || "").trim();

  if (!/^[a-z0-9-]{6,40}$/.test(projectId)) {
    return Promise.resolve(new Response(null, { status: 503 }));
  }

  const url = new URL(
    `https://firestore.googleapis.com/v1/projects/${projectId}`
    + `/databases/(default)/documents/${collectionName}/${encodeURIComponent(documentId)}`
  );

  return fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json"
    }
  });
}

function getBearerToken(request) {
  const match = request.headers.get("Authorization")?.match(/^Bearer\s+(.+)$/i);
  return String(match?.[1] || "").trim();
}

function createCorsHeaders(origin, env) {
  const headers = new Headers({
    "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Authorization, Content-Type",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin"
  });

  if (origin && isAllowedOrigin(origin, env.ALLOWED_ORIGINS)) {
    headers.set("Access-Control-Allow-Origin", origin);
  }

  return headers;
}

function withCors(response, corsHeaders) {
  corsHeaders.forEach((value, key) => response.headers.set(key, value));
  return response;
}

async function relayHubResponse(response, corsHeaders) {
  const result = new Response(response.body, {
    status: response.status,
    headers: response.headers
  });
  return withCors(result, corsHeaders);
}

async function readJson(request) {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

function json(value, status = 200) {
  return new Response(JSON.stringify(value), {
    status,
    headers: JSON_HEADERS
  });
}
