import { readFile } from "node:fs/promises";
import { expect, test } from "@playwright/test";
import {
  installFirebaseMock,
  readMockOrders
} from "./support/firebase-mock.js";

test.beforeEach(async ({ page }) => {
  await installFirebaseMock(page);
  await page.goto("/admin.html");
  await page.getByLabel("E-post", { exact: true }).fill("admin@example.com");
  await page.getByLabel("Lösenord").fill("hemligt123");
  await page.getByRole("button", { name: "Logga in" }).click();
  await expect(page.locator("#connectionBadge")).toHaveText("Firebase synkad");
});

test("admin kan skapa, flytta, redigera och ta bort en order", async ({ page }) => {
  await page.getByLabel("Kundens namn").fill("Nora Test");
  await page.getByLabel("Telefon eller e-post").fill("0701234567");
  await page.getByLabel("Behandling eller produkt").fill("Gelénaglar");
  await page.getByLabel("Vikt inkl. emballage (g)").fill("85");
  await page.getByRole("button", { name: "Spara order" }).click();

  const newColumn = page.locator('.kanban-column[data-status="Ny"]');
  const newCard = newColumn.locator(".order-item");
  await expect(newCard).toContainText("Nora Test • Gelénaglar");
  await expect(newCard.locator(".order-card-details")).toBeHidden();
  await expect(newCard.locator(".order-card-toggle")).toHaveAttribute("aria-expanded", "false");
  await newCard.locator(".order-card-toggle").click();
  await expect(newCard.locator(".order-card-details")).toBeVisible();

  await newCard.getByRole("button", { name: "Flytta vidare" }).click();
  const activeColumn = page.locator('.kanban-column[data-status="Pågår"]');
  const activeCard = activeColumn.locator(".order-item");
  await expect(activeCard).toContainText("Nora Test • Gelénaglar");

  await activeCard.locator(".order-card-toggle").click();
  await activeCard.getByRole("button", { name: "Redigera" }).click();
  await expect(page.locator("#formTitle")).toHaveText("Redigera order");
  await page.getByLabel("Behandling eller produkt").fill("Gelénaglar med chrome");
  await page.getByRole("button", { name: "Spara order" }).click();
  await expect(activeCard).toContainText("Gelénaglar med chrome");

  page.once("dialog", (dialog) => dialog.accept());
  await activeCard.locator(".order-card-toggle").click();
  await activeCard.getByRole("button", { name: "Ta bort" }).click();
  await expect(activeCard).toHaveCount(0);
  expect(await readMockOrders(page)).toHaveLength(0);
});

test("admin ser pris inklusive frakt innan ordern sparas", async ({ page }) => {
  await page.getByLabel("Antal").fill("2");
  await page.getByLabel("Pris (kr)").fill("150");
  await page.getByLabel("Vikt inkl. emballage (g)").fill("85");

  await expect(page.locator("#shippingEstimate")).toHaveText("44 kr");
  await expect(page.locator("#totalEstimate")).toHaveText("344 kr");
  await expect(page.locator("#totalEstimateHint")).toHaveText("2 × 150 kr + 44 kr frakt.");

  await page.getByLabel("Leveranssätt").selectOption("Hämtas");

  await expect(page.locator("#shippingEstimate")).toHaveText("0 kr");
  await expect(page.locator("#totalEstimate")).toHaveText("300 kr");
  await expect(page.locator("#totalEstimateHint")).toHaveText("2 × 150 kr, utan frakt.");
});

test("admin kan arkivera och återställa en order från det dolda arkivet", async ({ page }) => {
  await page.getByLabel("Kundens namn").fill("Alicia Arkiv");
  await page.getByLabel("Behandling eller produkt").fill("Press-on set");
  await page.getByRole("button", { name: "Spara order" }).click();

  const newColumn = page.locator('.kanban-column[data-status="Ny"]');
  await expect(newColumn.locator(".order-item")).toContainText("Alicia Arkiv");

  page.once("dialog", (dialog) => dialog.accept());
  await newColumn.locator(".order-card-toggle").click();
  await newColumn.getByRole("button", { name: "Arkivera" }).click();

  await expect(newColumn.locator(".order-item")).toHaveCount(0);
  await expect(page.locator("#totalCount")).toHaveText("0");
  await expect(page.locator("#archiveCount")).toHaveText("1");

  await page.locator("#archivePanel summary").click();
  const archivedCard = page.locator("#archiveOrders .order-item");
  await expect(archivedCard).toContainText("Alicia Arkiv");
  await archivedCard.locator(".order-card-toggle").click();
  await archivedCard.getByRole("button", { name: "Återställ" }).click();

  await expect(page.locator("#archiveCount")).toHaveText("0");
  await expect(newColumn.locator(".order-item")).toContainText("Alicia Arkiv");
  expect(await readMockOrders(page)).toMatchObject([{ archivedAt: null }]);
});

test("orderflöde, arkiv och mobilnotiser ligger kompakt i rätt ordning", async ({ page }) => {
  const orderFlow = page.locator(".orders-card");
  const orderForm = page.locator(".form-card");
  const adminTools = page.locator(".admin-tools-footer");
  const notificationCard = page.locator("#notificationCard");

  await expect(orderFlow.locator("#archivePanel")).toHaveCount(1);
  await expect(adminTools.locator("#notificationCard")).toHaveCount(1);

  const layout = await page.evaluate(() => {
    const orderFlowElement = document.querySelector(".orders-card");
    const orderFormElement = document.querySelector(".form-card");
    const marketplaceLink = document.querySelector(".admin-marketplace-link");
    const notificationElement = document.querySelector("#notificationCard");

    return {
      orderFlowBeforeForm: Boolean(
        orderFlowElement?.compareDocumentPosition(orderFormElement)
        & Node.DOCUMENT_POSITION_FOLLOWING
      ),
      notificationAfterMarketplace: Boolean(
        marketplaceLink?.compareDocumentPosition(notificationElement)
        & Node.DOCUMENT_POSITION_FOLLOWING
      )
    };
  });
  const notificationBox = await notificationCard.boundingBox();

  expect(layout).toEqual({
    orderFlowBeforeForm: true,
    notificationAfterMarketplace: true
  });
  expect(notificationBox?.height).toBeLessThan(110);
});

test("orderstatus kan flyttas med en touchvänlig kontroll på iPhone-storlek", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 3000 });
  await page.getByLabel("Kundens namn").fill("Mobil Test");
  await page.getByLabel("Behandling eller produkt").fill("Mobil design");
  await page.getByRole("button", { name: "Spara order" }).click();

  const newColumn = page.locator('.kanban-column[data-status="Ny"]');
  const card = newColumn.locator(".order-item");
  const dragArea = card.locator(".order-drag-handle");

  await expect(dragArea).toBeVisible();
  const dragAreaBox = await dragArea.boundingBox();
  expect(dragAreaBox?.height).toBeGreaterThanOrEqual(44);

  await page.evaluate(() => {
    const handle = document.querySelector('[data-status="Ny"] .order-drag-handle');
    const target = document.querySelector('[data-status="Klar"]');
    const startBox = handle.getBoundingClientRect();
    const targetBox = target.getBoundingClientRect();
    const pointer = {
      bubbles: true,
      pointerId: 13,
      pointerType: "touch",
      clientX: startBox.left + startBox.width / 2,
      clientY: startBox.top + startBox.height / 2
    };

    handle.dispatchEvent(new PointerEvent("pointerdown", pointer));
    handle.dispatchEvent(new PointerEvent("pointermove", {
      ...pointer,
      clientX: targetBox.left + targetBox.width / 2,
      clientY: targetBox.top + targetBox.height / 2
    }));
    handle.dispatchEvent(new PointerEvent("pointerup", {
      ...pointer,
      clientX: targetBox.left + targetBox.width / 2,
      clientY: targetBox.top + targetBox.height / 2
    }));
  });

  const doneColumn = page.locator('.kanban-column[data-status="Klar"]');
  const doneCard = doneColumn.locator(".order-item");
  await expect(doneCard).toContainText("Mobil Test");
  await doneCard.locator(".order-card-toggle").click();

  await doneCard
    .getByLabel("Flytta order för Mobil Test till status")
    .selectOption("Levererad");
  const deliveredColumn = page.locator('.kanban-column[data-status="Levererad"]');
  await expect(deliveredColumn.locator(".order-item")).toContainText("Mobil Test");
  expect(await readMockOrders(page)).toMatchObject([{ status: "Levererad" }]);
});

test("vald ordervy finns kvar efter omladdning", async ({ page }) => {
  await page.getByRole("button", { name: "Lista" }).click();
  await expect(page.getByRole("button", { name: "Lista" })).toHaveAttribute("aria-pressed", "true");

  await page.reload();

  await expect(page.locator("#adminAuthCard")).toBeHidden();
  await expect(page.getByRole("button", { name: "Lista" })).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator("body")).toHaveJSProperty("scrollWidth", 390);
});

test("admin förblir inloggad efter omladdning på en privat enhet", async ({ page }) => {
  await page.reload();

  await expect(page.locator("#connectionBadge")).toHaveText("Firebase synkad");
  await expect(page.locator("#adminAuthCard")).toBeHidden();
  await expect(page.getByRole("button", { name: "Logga ut" })).toBeVisible();
});

test("kundsidan ersätter inte en sparad adminsession", async ({ page }) => {
  await page.goto("/kund.html");

  await expect(page.locator("#customerOrderForm")).toBeVisible();
  await expect
    .poll(() =>
      page.evaluate(() => globalThis.__NAILSBYYG_E2E_FIREBASE__.auth.currentUser?.uid)
    )
    .toBe("admin-e2e");

  await page.goto("/admin.html");
  await expect(page.locator("#adminAuthCard")).toBeHidden();
});

test("logga ut rensar den sparade sessionen", async ({ page }) => {
  await page.getByRole("button", { name: "Logga ut" }).click();
  await expect(page.locator("#adminAuthCard")).toBeVisible();

  await page.reload();

  await expect(page.locator("#adminAuthCard")).toBeVisible();
  await expect(page.getByRole("button", { name: "Logga in" })).toBeVisible();
});

test("utan håll mig inloggad används bara webbläsarsessionen", async ({ page }) => {
  await page.getByRole("button", { name: "Logga ut" }).click();
  await page.getByLabel("Håll mig inloggad").uncheck();
  await page.getByLabel("E-post", { exact: true }).fill("admin@example.com");
  await page.getByLabel("Lösenord").fill("hemligt123");
  await page.getByRole("button", { name: "Logga in" }).click();
  await expect(page.locator("#connectionBadge")).toHaveText("Firebase synkad");

  const storedSession = await page.evaluate(() => ({
    local: localStorage.getItem("nailsbyyg.e2e.auth.local"),
    session: sessionStorage.getItem("nailsbyyg.e2e.auth.session")
  }));

  expect(storedSession.local).toBeNull();
  expect(storedSession.session).toContain("admin-e2e");
});

test("admin kan aktivera och stänga av notiser för nya kundbeställningar", async ({ page }) => {
  await page.addInitScript(() => {
    globalThis.__NAILSBYYG_E2E_PUSH_SUBSCRIPTION__ = null;
    globalThis.__NAILSBYYG_E2E_NOTIFICATION_PERMISSION__ = "default";

    const subscription = {
      endpoint: "https://push.example/admin-device",
      toJSON() {
        return {
          endpoint: this.endpoint,
          keys: {
            p256dh: "test-p256dh-key",
            auth: "test-auth-key"
          }
        };
      },
      async unsubscribe() {
        globalThis.__NAILSBYYG_E2E_PUSH_SUBSCRIPTION__ = null;
        return true;
      }
    };
    const registration = {
      pushManager: {
        async getSubscription() {
          return globalThis.__NAILSBYYG_E2E_PUSH_SUBSCRIPTION__;
        },
        async subscribe() {
          globalThis.__NAILSBYYG_E2E_PUSH_SUBSCRIPTION__ = subscription;
          return subscription;
        }
      }
    };

    Object.defineProperty(globalThis, "PushManager", {
      configurable: true,
      value: function PushManager() {}
    });
    Object.defineProperty(globalThis, "Notification", {
      configurable: true,
      value: {
        get permission() {
          return globalThis.__NAILSBYYG_E2E_NOTIFICATION_PERMISSION__;
        },
        async requestPermission() {
          globalThis.__NAILSBYYG_E2E_NOTIFICATION_PERMISSION__ = "granted";
          return "granted";
        }
      }
    });
    Object.defineProperty(navigator, "serviceWorker", {
      configurable: true,
      value: {
        async getRegistration() {
          return globalThis.__NAILSBYYG_E2E_PUSH_SUBSCRIPTION__
            ? registration
            : undefined;
        },
        async register() {
          return registration;
        }
      }
    });
  });
  await page.reload();
  await expect(page.locator("#adminAuthCard")).toBeHidden();
  const subscribeRequestPromise = page.waitForRequest((request) =>
    request.url() === "https://push.e2e.test/v1/subscriptions"
    && request.method() === "POST"
  );
  await page.getByRole("button", { name: "Aktivera notiser" }).click();
  await expect(page.locator("#notificationStatus")).toContainText("Notiser är aktiverade");

  const subscribeRequest = await subscribeRequestPromise;
  expect(subscribeRequest.headers().authorization).toBe("Bearer e2e-token");
  expect(subscribeRequest.postDataJSON()).toMatchObject({
    adminId: "admin-e2e",
    subscription: {
      endpoint: "https://push.example/admin-device",
      keys: {
        p256dh: "test-p256dh-key",
        auth: "test-auth-key"
      }
    }
  });

  const unsubscribeRequestPromise = page.waitForRequest((request) =>
    request.url() === "https://push.e2e.test/v1/subscriptions"
    && request.method() === "DELETE"
  );
  await page.getByRole("button", { name: "Stäng av notiser" }).click();
  await expect(page.locator("#notificationStatus")).toContainText("Notiser är avstängda");
  const unsubscribeRequest = await unsubscribeRequestPromise;
  expect(unsubscribeRequest.postDataJSON()).toMatchObject({
    adminId: "admin-e2e",
    endpoint: "https://push.example/admin-device"
  });
});

test("adminvyn har en installerbar hemskärmsapp", async ({ page }) => {
  await expect(page.locator('link[rel="manifest"]')).toHaveAttribute(
    "href",
    "./manifest.webmanifest"
  );
  await expect(page.locator('link[rel="apple-touch-icon"]')).toHaveAttribute(
    "href",
    "./assets/icons/admin-app-192.png"
  );

  const manifest = JSON.parse(
    await readFile(new URL("../../manifest.webmanifest", import.meta.url), "utf8")
  );
  expect(manifest).toMatchObject({
    name: "Nailsbyy.g Admin",
    start_url: "./admin.html",
    display: "standalone"
  });
  expect(manifest.icons).toEqual(expect.arrayContaining([
    expect.objectContaining({ sizes: "192x192", type: "image/png" }),
    expect.objectContaining({ sizes: "512x512", type: "image/png" })
  ]));
});

test("kundens egen order kan verifieras utan att orderlistan öppnas", async () => {
  const rules = await readFile(new URL("../../firestore.rules", import.meta.url), "utf8");

  expect(rules).toContain("allow get: if isAdmin()");
  expect(rules).toContain("resource.data.customerId == request.auth.uid");
  expect(rules).toContain("allow list, update, delete: if isAdmin();");
  expect(rules).not.toContain("match /pushSubscriptions/{subscriptionId}");
});
