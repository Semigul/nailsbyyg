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
  await expect(page.locator(".customer-order-card > .section-kicker")).toHaveText("Nagelhörnan");
  await expect(page.locator(".customer-delivery-time")).not.toContainText("💅");
  await expect(page.locator("#marketplacePromo")).toBeHidden();
  await expect(page.locator(".brand-logo")).toHaveCSS("border-top-width", "0px");
  await expect(page.locator(".brand-logo")).toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
  await expect(page.locator(".brand-logo")).toHaveCSS("box-shadow", "none");
  const logoMarkup = await page.evaluate(async () => {
    const logoUrl = document.querySelector(".brand-logo img")?.src;
    return logoUrl ? (await fetch(logoUrl)).text() : "";
  });
  expect(logoMarkup).not.toMatch(/<rect[^>]*fill=["']#fff9f6["']/i);
  await expect(page.locator("#customerOrderForm")).toBeVisible();
});

test("adminlänken ligger diskret längst ned på kundsidan", async ({ page }) => {
  await page.goto("/kund.html");

  const orderCard = page.locator(".customer-order-card");
  const adminLink = page.getByRole("link", { name: "Öppna admininloggning" });
  const orderCardBox = await orderCard.boundingBox();
  const adminLinkBox = await adminLink.boundingBox();

  await expect(adminLink).toBeVisible();
  expect(adminLinkBox?.y).toBeGreaterThan((orderCardBox?.y || 0) + (orderCardBox?.height || 0));
  await expect(adminLink).toHaveCSS("opacity", "0.42");
});

test("kunden kan läsa integritetspolicy och köp- och beställningsvillkor", async ({ page }) => {
  await page.goto("/kund.html");

  const privacyLink = page.getByRole("link", { name: "Integritetspolicy" });
  const termsLink = page.getByRole("link", { name: "Köp- och beställningsvillkor" });

  await expect(privacyLink).toBeVisible();
  await expect(termsLink).toBeVisible();
  expect((await privacyLink.boundingBox())?.height).toBeGreaterThanOrEqual(44);
  expect((await termsLink.boundingBox())?.height).toBeGreaterThanOrEqual(44);
  await expect(privacyLink).toHaveCSS("opacity", "0.62");
  await expect(privacyLink).toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
  await expect(privacyLink).toHaveCSS("border-top-width", "0px");

  await privacyLink.click();
  await expect(page).toHaveURL(/\/integritet\.html$/);
  await expect(page.getByRole("heading", { level: 1, name: "Integritetspolicy" })).toBeVisible();
  await expect(page.locator(".legal-updated")).toHaveText("Senast uppdaterad: 30 juli 2026");
  await expect(page.locator(".legal-card section")).toHaveCount(12);
  await expect(page.locator("#barn")).toContainText(
    "En kund under 18 år måste göra beställningen med sin vårdnadshavares godkännande"
  );
  await expect(page.locator("body")).toHaveJSProperty("scrollWidth", 390);

  await page.getByRole("link", { name: "Läs köp- och beställningsvillkoren" }).click();
  await expect(page).toHaveURL(/\/kopvillkor\.html$/);
  await expect(page.getByRole("heading", {
    level: 1,
    name: "Köp- och beställningsvillkor"
  })).toBeVisible();
  await expect(page.locator(".legal-card section")).toHaveCount(14);
  await expect(page.locator("#leverans")).toContainText("Beräknad leveranstid: 1–5 veckor");
  await expect(page.locator("body")).toHaveJSProperty("scrollWidth", 390);

  await page.getByRole("link", { name: "Tillbaka till beställningen" }).click();
  await expect(page).toHaveURL(/\/kund\.html$/);
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
  const notificationRequestPromise = page.waitForRequest((request) =>
    request.url() === "https://push.e2e.test/v1/order-notifications"
    && request.method() === "POST"
  );
  await page.getByRole("button", { name: "Skicka beställning" }).click();

  await expect(page.locator("#customerSuccess")).toBeVisible();
  await expect(page.locator("#customerOrderReference")).toContainText("Referens:");
  const notificationRequest = await notificationRequestPromise;
  expect(notificationRequest.headers().authorization).toBe("Bearer e2e-token");
  expect(notificationRequest.postDataJSON().orderId).toMatch(/^order-e2e-/);

  const orders = await readMockOrders(page);
  expect(orders).toHaveLength(1);
  expect(orders[0]).toMatchObject({
    customer: "Maja Test",
    deliveryMethod: "Hämtas",
    product: "Rosa press-on naglar",
    status: "Ny"
  });
});
