import { expect, test } from "@playwright/test";
import { installFirebaseMock, readMockOrders } from "./support/firebase-mock.js";

const ONE_PIXEL_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9ZfGQAAAAASUVORK5CYII=",
  "base64"
);

test.beforeEach(async ({ page }) => {
  await installFirebaseMock(page);
});

test("startsidan leder kunden till beställningsformuläret", async ({ page }) => {
  await page.goto("/");

  await expect(page).toHaveURL(/\/kund\.html$/);
  await expect(page.getByRole("heading", { name: "Vad vill du beställa?" })).toBeVisible();
  await expect(page.locator("#customerOrderForm")).toBeVisible();
});

test("filväljaren visar valda bilder och kan ta bort dem", async ({ page }) => {
  await page.goto("/kund.html");

  const trigger = page.locator(".customer-file-trigger");
  const fileInput = page.locator("#customerDesignImages");

  await expect(trigger).toContainText("Välj bilder");
  await expect(page.locator("#customerFileStatus")).toHaveText("Inga bilder valda");

  const triggerBox = await trigger.boundingBox();
  expect(triggerBox?.height).toBeGreaterThanOrEqual(44);

  await fileInput.setInputFiles({
    name: "inspiration.png",
    mimeType: "image/png",
    buffer: ONE_PIXEL_PNG
  });

  await expect(page.locator("#customerFileStatus")).toHaveText("1 bild vald");
  await expect(page.locator(".customer-preview-thumb")).toBeVisible();

  await page.getByRole("button", { name: "Ta bort bild 1" }).click();

  await expect(page.locator("#customerFileStatus")).toHaveText("Inga bilder valda");
  await expect(page.locator("#customerImagePreview")).toBeHidden();
});

test("kunden kan skicka en beställning för hämtning", async ({ page }) => {
  await page.goto("/kund.html");

  await page.getByLabel("Namn").fill("Maja Test");
  await page.getByLabel("Telefon eller e-post").fill("maja@example.com");
  await page.getByLabel("Behandling eller produkt").fill("Rosa press-on naglar");
  await page.getByLabel("Leveranssätt").selectOption("Hämtas");
  await page.getByLabel("Färg, form och övriga önskemål").fill("Kort mandelform");

  await expect(page.locator("#customerAddressGroup")).toBeHidden();
  await page.getByRole("button", { name: "Skicka beställning" }).click();

  await expect(page.locator("#customerSuccess")).toBeVisible();
  await expect(page.locator("#customerOrderReference")).toContainText("Referens:");

  const orders = await readMockOrders(page);
  expect(orders).toHaveLength(1);
  expect(orders[0]).toMatchObject({
    customer: "Maja Test",
    deliveryMethod: "Hämtas",
    product: "Rosa press-on naglar",
    status: "Ny"
  });
});
