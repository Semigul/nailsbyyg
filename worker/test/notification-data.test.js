import assert from "node:assert/strict";
import test from "node:test";
import {
  buildOrderNotification,
  isAllowedOrigin,
  readCustomerOrderDocument,
  validatePushSubscription
} from "../src/notification-data.js";

test("bara validerade Web Push-prenumerationer sparas", () => {
  assert.deepEqual(validatePushSubscription({
    endpoint: "https://push.example/device",
    keys: {
      p256dh: "p256dh-key",
      auth: "auth-key"
    }
  }), {
    endpoint: "https://push.example/device",
    expirationTime: null,
    keys: {
      p256dh: "p256dh-key",
      auth: "auth-key"
    }
  });
  assert.equal(validatePushSubscription({
    endpoint: "http://insecure.example/device",
    keys: { p256dh: "key", auth: "auth" }
  }), null);
});

test("notisen innehåller orderreferens men inga kunduppgifter", () => {
  const order = readCustomerOrderDocument("abcd1234efgh", {
    fields: {
      customerId: { stringValue: "customer-1" },
      source: { stringValue: "customer" },
      customer: { stringValue: "Kundnamn" },
      contact: { stringValue: "0701234567" },
      product: { stringValue: "Press-on set" },
      quantity: { integerValue: "2" }
    }
  });
  const notification = buildOrderNotification(order);

  assert.deepEqual(notification, {
    title: "Ny beställning",
    body: "Press-on set, 2 st • Referens ABCD1234",
    tag: "new-order-abcd1234efgh",
    orderId: "abcd1234efgh"
  });
  assert.equal(JSON.stringify(notification).includes("0701234567"), false);
  assert.equal(JSON.stringify(notification).includes("Kundnamn"), false);
});

test("adminskapade dokument kan inte utlösa en kundnotis", () => {
  assert.equal(readCustomerOrderDocument("order123", {
    fields: {
      customerId: { stringValue: "admin-1" },
      source: { stringValue: "admin" },
      product: { stringValue: "Manuell order" }
    }
  }), null);
});

test("bara produktionssidan och lokal utveckling tillåts", () => {
  const configured = "https://semigul.github.io";

  assert.equal(isAllowedOrigin("https://semigul.github.io", configured), true);
  assert.equal(isAllowedOrigin("http://127.0.0.1:4173", configured), true);
  assert.equal(isAllowedOrigin("https://attacker.example", configured), false);
});
