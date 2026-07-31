import { expect, test } from "@playwright/test";
import { readFile } from "node:fs/promises";
import {
  installFirebaseMock,
  readMockMarketplaceItems,
  readMockOrders,
  readMockPublicSettings
} from "./support/firebase-mock.js";

const ONE_PIXEL_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9ZfGQAAAAASUVORK5CYII=",
  "base64"
);

test.beforeEach(async ({ page }) => {
  await installFirebaseMock(page);
  await page.route("https://api.cloudinary.com/**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        secure_url: "https://res.cloudinary.com/e2e/image/upload/v1/marketplace/skridskor.png",
        public_id: "marketplace/skridskor"
      })
    });
  });
});

test("marknadsplatsköp reserveras, blir en ny order och hanteras med Swish", async ({ page }) => {
  await page.goto("/admin.html");
  await page.getByLabel("E-post", { exact: true }).fill("admin@example.com");
  await page.getByLabel("Lösenord").fill("hemligt123");
  await page.getByRole("button", { name: "Logga in" }).click();
  await expect(page.locator("#connectionBadge")).toHaveText("Firebase synkad");

  await expect(page.locator("#marketplaceItemForm")).toHaveCount(0);
  const marketplaceAdminLink = page.getByRole("link", {
    name: "Hantera begagnade saker"
  });
  const visibilityToggle = page.getByRole("switch", {
    name: "Visa Loppishörnan för kunder"
  });
  await expect(marketplaceAdminLink).toBeVisible();
  await expect(visibilityToggle).not.toBeChecked();
  await visibilityToggle.check();
  await expect(page.locator("#marketplaceVisibilityMessage")).toHaveText(
    "Loppishörnan är synlig för kunder."
  );
  expect(await readMockPublicSettings(page)).toMatchObject({
    marketplace: { visible: true }
  });

  await marketplaceAdminLink.click();
  await expect(page).toHaveURL(/\/loppis-admin\.html$/);
  await expect(page.locator("#marketplaceAdminAuthCard")).toBeHidden();
  await expect(page.locator("#marketplaceAdminConnectionBadge")).toHaveText("Firebase synkad");

  const itemForm = page.locator("#marketplaceItemForm");
  await itemForm.getByLabel("Namn på varan").fill("Rosa skridskor");
  await itemForm.getByLabel("Beskrivning").fill("Fina och använda några gånger.");
  await itemForm.getByLabel("Vad kostar varan? (kr)").fill("150");
  await itemForm.getByLabel("Frakt (kr)").fill("59");
  await itemForm.getByLabel("Bild på varan").setInputFiles({
    name: "skridskor.png",
    mimeType: "image/png",
    buffer: ONE_PIXEL_PNG
  });
  await itemForm.getByRole("button", { name: "Publicera vara" }).click();

  const adminItem = page.locator(".marketplace-admin-item");
  await expect(adminItem).toContainText("Rosa skridskor");
  await expect(adminItem).toContainText("Tillgänglig");
  await adminItem.getByRole("button", { name: "Redigera" }).click();
  await itemForm.getByLabel("Beskrivning").fill("Fina och bara använda några gånger.");
  await itemForm.getByRole("button", { name: "Spara ändringar" }).click();
  await expect.poll(async () => (await readMockMarketplaceItems(page))[0]?.description)
    .toBe("Fina och bara använda några gånger.");

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/kund.html");
  const marketplaceCard = page.locator("#marketplacePromo");
  const marketplaceLink = marketplaceCard.getByRole("link", {
    name: "Se sakerna i Loppishörnan"
  });
  await expect(marketplaceCard).toBeVisible();
  await expect(marketplaceCard.getByRole("link")).toHaveCount(1);
  await expect(page.locator("#marketplaceGrid")).toHaveCount(0);
  expect(
    await marketplaceLink.evaluate((element) =>
      Number.parseFloat(getComputedStyle(element).borderRadius)
    )
  ).toBeGreaterThanOrEqual(13);
  await marketplaceLink.click();
  await expect(page).toHaveURL(/\/loppis\.html$/);
  await expect(page.getByRole("heading", {
    level: 1,
    name: "Begagnat som söker ett nytt hem"
  })).toBeVisible();

  const customerItem = page.locator(".marketplace-item");
  await expect(customerItem).toContainText("Rosa skridskor");
  const buyButtonBox = await customerItem.getByRole("button", { name: "Beställ" }).boundingBox();
  expect(buyButtonBox?.height).toBeGreaterThanOrEqual(44);
  await expect(page.locator("body")).toHaveJSProperty("scrollWidth", 390);
  await customerItem.getByRole("button", { name: "Beställ" }).click();

  const checkout = page.locator("#marketplaceOrderForm");
  await checkout.getByLabel("Vem beställer?").fill("Maja Marknad");
  await checkout.getByLabel("Hur når vi dig?").fill("maja@example.com");
  await checkout.getByLabel("Hur vill du få varan?").selectOption("Hämtas");
  const notificationRequestPromise = page.waitForRequest((request) =>
    request.url() === "https://push.e2e.test/v1/order-notifications"
    && request.method() === "POST"
  );
  await checkout.getByRole("button", { name: "Reservera och beställ" }).click();

  await expect(page.locator("#marketplaceSuccess")).toBeVisible();
  await expect(page.locator("#marketplaceSwishInstructions")).toContainText("0701234567");
  const notificationRequest = await notificationRequestPromise;
  expect(notificationRequest.postDataJSON().orderId).toMatch(/^order-e2e-/);

  expect(await readMockOrders(page)).toMatchObject([{
    customer: "Maja Marknad",
    product: "Rosa skridskor",
    status: "Ny",
    orderType: "marketplace",
    paymentStatus: "Väntar på Swish",
    price: 150,
    shippingCost: 0
  }]);
  expect(await readMockMarketplaceItems(page)).toMatchObject([{
    title: "Rosa skridskor",
    status: "reserved"
  }]);

  await page.goto("/admin.html");
  const newOrder = page.locator('.kanban-column[data-status="Ny"] .order-item');
  await expect(newOrder).toContainText("Marknadsplats • Betalning: Väntar på Swish");
  await newOrder.locator(".order-card-toggle").click();
  await newOrder.getByRole("button", { name: "Redigera" }).click();
  await page.getByLabel("Betalningsstatus").selectOption("Betald");
  await page.getByLabel("Swish-referens").fill("MAJA-150");
  await page.getByRole("button", { name: "Spara order" }).click();

  await expect(newOrder).toContainText("Betalning: Betald");
  await expect(newOrder).toContainText("Swish: MAJA-150");
  expect(await readMockMarketplaceItems(page)).toMatchObject([{ status: "sold" }]);

  await newOrder.locator(".order-card-toggle").click();
  await newOrder.getByRole("button", { name: "Redigera" }).click();
  await page.getByLabel("Betalningsstatus").selectOption("Återbetald");
  await page.getByRole("button", { name: "Spara order" }).click();
  expect(await readMockMarketplaceItems(page)).toMatchObject([{ status: "available" }]);
});

test("Loppishörnan är dold som standard och adminsidan är inloggningsskyddad", async ({
  page
}) => {
  await page.goto("/kund.html");
  await expect(page.locator("#marketplacePromo")).toBeHidden();
  await expect(page.getByRole("link", { name: "Se sakerna i Loppishörnan" })).toBeHidden();

  await page.goto("/loppis.html");
  await expect(page.locator("#marketplaceStatus")).toHaveText(
    "Loppishörnan är stängd just nu. Titta gärna in igen!"
  );
  await expect(page.locator("#marketplaceGrid")).toBeHidden();

  await page.goto("/loppis-admin.html");
  await expect(page.locator("#marketplaceAdminAuthCard")).toBeVisible();
  await expect(page.locator(".marketplace-admin-content").first()).toBeHidden();

  await page.getByLabel("E-post", { exact: true }).fill("admin@example.com");
  await page.getByLabel("Lösenord").fill("hemligt123");
  await page.getByRole("button", { name: "Logga in" }).click();

  await expect(page.locator("#marketplaceAdminAuthCard")).toBeHidden();
  await expect(page.locator("#marketplaceAdminConnectionBadge")).toHaveText("Firebase synkad");
  await expect(page.locator("#marketplaceItemForm")).toBeVisible();
  await expect(page.locator("body")).toHaveJSProperty("scrollWidth", 390);

  const itemForm = page.locator("#marketplaceItemForm");
  await itemForm.getByLabel("Namn på varan").fill("Testjacka");
  await itemForm.getByLabel("Beskrivning").fill("En vara som ska kunna tas bort.");
  await itemForm.getByLabel("Vad kostar varan? (kr)").fill("50");
  await itemForm.getByLabel("Frakt (kr)").fill("0");
  await itemForm.getByLabel("Bild på varan").setInputFiles({
    name: "jacka.png",
    mimeType: "image/png",
    buffer: ONE_PIXEL_PNG
  });
  await itemForm.getByRole("button", { name: "Publicera vara" }).click();
  await expect(page.locator(".marketplace-admin-item")).toContainText("Testjacka");

  page.once("dialog", (dialog) => dialog.accept());
  await page.locator(".marketplace-admin-item")
    .getByRole("button", { name: "Ta bort" })
    .click();
  await expect(page.locator(".marketplace-admin-item")).toHaveCount(0);
  expect(await readMockMarketplaceItems(page)).toHaveLength(0);
});

test("Firestore-reglerna låter admin synka alla loppisvaror men visar bara tillgängliga varor offentligt", async () => {
  const rules = await readFile(new URL("../../firestore.rules", import.meta.url), "utf8");

  expect(rules).toContain("match /publicSettings/{settingId}");
  expect(rules).toContain('allow get: if settingId == "marketplace";');
  expect(rules).toContain('resource.data.status == "available"');
  expect(rules).toContain("/documents/publicSettings/marketplace");
  expect(rules).toContain(".data.visible == true");
  expect(rules).not.toContain(
    'allow read: if resource.data.status in ["available", "reserved", "sold"];'
  );
});
