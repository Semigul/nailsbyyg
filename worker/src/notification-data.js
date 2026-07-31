const ORDER_ID_PATTERN = /^[A-Za-z0-9_-]{6,120}$/;
const VALID_ORDER_SOURCES = new Set(["customer", "marketplace"]);

export function validateOrderId(value) {
  const orderId = clean(value);
  return ORDER_ID_PATTERN.test(orderId) ? orderId : "";
}

export function validateAdminId(value) {
  const adminId = clean(value);
  return adminId.length > 0 && adminId.length <= 128 ? adminId : "";
}

export function validatePushSubscription(value) {
  const endpoint = clean(value?.endpoint);
  const p256dh = clean(value?.keys?.p256dh);
  const auth = clean(value?.keys?.auth);

  if (
    !endpoint.startsWith("https://")
    || endpoint.length > 2000
    || !p256dh
    || p256dh.length > 200
    || !auth
    || auth.length > 200
  ) {
    return null;
  }

  return {
    endpoint,
    expirationTime: Number.isFinite(Number(value?.expirationTime))
      ? Number(value.expirationTime)
      : null,
    keys: {
      p256dh,
      auth
    }
  };
}

export function readCustomerOrderDocument(orderId, document) {
  const id = validateOrderId(orderId);
  const source = readStringField(document, "source");
  const customerId = readStringField(document, "customerId");

  if (!id || !customerId || !VALID_ORDER_SOURCES.has(source)) {
    return null;
  }

  return {
    id,
    source,
    product: readStringField(document, "product") || "Beställning",
    quantity: Math.max(1, readNumberField(document, "quantity") || 1)
  };
}

export function buildOrderNotification(order) {
  const reference = order.id.slice(0, 8).toUpperCase();

  return {
    title: "Ny beställning",
    body: `${order.product}, ${order.quantity} st • Referens ${reference}`,
    tag: `new-order-${order.id}`,
    orderId: order.id
  };
}

export function isAllowedOrigin(origin, configuredOrigins) {
  if (!origin) {
    return true;
  }

  let parsedOrigin;

  try {
    parsedOrigin = new URL(origin);
  } catch {
    return false;
  }

  if (
    parsedOrigin.protocol === "http:"
    && (parsedOrigin.hostname === "localhost" || parsedOrigin.hostname === "127.0.0.1")
  ) {
    return true;
  }

  const allowedOrigins = String(configuredOrigins || "")
    .split(",")
    .map((value) => clean(value))
    .filter(Boolean);

  return allowedOrigins.includes(parsedOrigin.origin);
}

function readStringField(document, fieldName) {
  return clean(document?.fields?.[fieldName]?.stringValue);
}

function readNumberField(document, fieldName) {
  const field = document?.fields?.[fieldName];
  const value = field?.integerValue ?? field?.doubleValue;
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function clean(value) {
  return String(value || "").trim();
}
