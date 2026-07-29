import { expect, test } from "@playwright/test";
import { readFile } from "node:fs/promises";
import {
  installFirebaseMock,
  readMockMarketplaceItems,
  readMockOrders
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

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/kund.html");
  const marketplaceCard = page.locator(".marketplace-card");
  const marketplaceLink = marketplaceCard.getByRole("link", {
    name: "Se sakerna i Loppishörnan"
  });
  await expect(marketplaceCard.getByRole("link")).toHaveCount(1);
  await expect(page.locator("#marketplaceGrid")).toHaveCount(0);
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
  await checkout.getByRole("button", { name: "Reservera och beställ" }).click();

  await expect(page.locator("#marketplaceSuccess")).toBeVisible();
  await expect(page.locator("#marketplaceSwishInstructions")).toContainText("0701234567");

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
  await newOrder.getByRole("button", { name: "Redigera" }).click();
  await page.getByLabel("Betalningsstatus").selectOption("Betald");
  await page.getByLabel("Swish-referens").fill("MAJA-150");
  await page.getByRole("button", { name: "Spara order" }).click();

  await expect(newOrder).toContainText("Betalning: Betald");
  await expect(newOrder).toContainText("Swish: MAJA-150");
  expect(await readMockMarketplaceItems(page)).toMatchObject([{ status: "sold" }]);

  await newOrder.getByRole("button", { name: "Redigera" }).click();
  await page.getByLabel("Betalningsstatus").selectOption("Återbetald");
  await page.getByRole("button", { name: "Spara order" }).click();
  expect(await readMockMarketplaceItems(page)).toMatchObject([{ status: "available" }]);
});

test("Firestore-reglerna låter admin synka alla loppisvaror men visar bara tillgängliga varor offentligt", async () => {
  const rules = await readFile(new URL("../../firestore.rules", import.meta.url), "utf8");

  expect(rules).toContain(
    'allow read: if isAdmin() || resource.data.status == "available";'
  );
  expect(rules).not.toContain(
    'allow read: if resource.data.status in ["available", "reserved", "sold"];'
  );
});
