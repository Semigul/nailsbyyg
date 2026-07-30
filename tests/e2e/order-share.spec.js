import { readFile } from "node:fs/promises";
import { expect, test } from "@playwright/test";
import {
  installFirebaseMock,
  readMockOrders,
  readMockOrderShares
} from "./support/firebase-mock.js";

test.beforeEach(async ({ page }) => {
  await installFirebaseMock(page);
  await page.goto("/admin.html");
  await page.getByLabel("E-post", { exact: true }).fill("admin@example.com");
  await page.getByLabel("Lösenord").fill("hemligt123");
  await page.getByRole("button", { name: "Logga in" }).click();
  await expect(page.locator("#connectionBadge")).toHaveText("Firebase synkad");
});

test("admin kan dela en uppdaterad ordersammanställning som fungerar utan inloggning", async ({
  page
}) => {
  await page.getByLabel("Kundens namn").fill("Elsa Kund");
  await page.getByLabel("Telefon eller e-post").fill("elsa@example.com");
  await page.getByLabel("Leveransadress").fill("Testgatan 12\n123 45 Teststad");
  await page.getByLabel("Behandling eller produkt").fill("Rosa press-on set");
  await page.getByLabel("Antal").fill("2");
  await page.getByLabel("Pris (kr)").fill("150");
  await page.getByLabel("Vikt inkl. emballage (g)").fill("85");
  await page.getByLabel("Leveransdatum").fill("2026-08-20");
  await page.getByLabel("Betalningsstatus").selectOption("Väntar på Swish");
  await page.getByLabel("Anteckning (valfritt)").fill("Glitter på ringfingret");
  await page.getByRole("button", { name: "Spara order" }).click();

  let orderCard = page.locator('.kanban-column[data-status="Ny"] .order-item');
  await expect(orderCard).toContainText("Elsa Kund • Rosa press-on set");
  await orderCard.getByRole("button", { name: "Kundlänk" }).click();

  const sharePanel = page.locator("#customerSharePanel");
  await expect(sharePanel).toBeVisible();
  const shareUrl = await page.getByLabel("Kundens länk").inputValue();
  expect(shareUrl).toMatch(/\/bestallning\.html#[a-f0-9]{48}$/);

  let shares = await readMockOrderShares(page);
  expect(shares).toHaveLength(1);
  expect(shares[0]).toMatchObject({
    customer: "Elsa Kund",
    product: "Rosa press-on set",
    quantity: 2,
    unitPrice: 150,
    shippingCost: 44,
    total: 344,
    address: "Testgatan 12\n123 45 Teststad",
    active: true
  });
  expect(shares[0]).not.toHaveProperty("contact");
  expect(shares[0]).not.toHaveProperty("swishReference");

  await page.getByRole("button", { name: "Stäng kundlänken" }).click();
  orderCard = page.locator('.kanban-column[data-status="Ny"] .order-item');
  await orderCard.getByRole("button", { name: "Redigera" }).click();
  await page.getByLabel("Pris (kr)").fill("175");
  await page.getByRole("button", { name: "Spara order" }).click();

  await expect.poll(async () => (await readMockOrderShares(page))[0]?.total).toBe(394);

  await page.getByRole("button", { name: "Logga ut" }).click();
  await expect(page.locator("#adminAuthCard")).toBeVisible();
  await page.goto(shareUrl);

  await expect(page.locator("#orderShareContent")).toBeVisible();
  await expect(page.locator("#sharedProduct")).toHaveText("Rosa press-on set");
  await expect(page.locator("#sharedCustomer")).toHaveText("Elsa Kund");
  await expect(page.locator("#sharedAddress")).toHaveText("Testgatan 12\n123 45 Teststad");
  await expect(page.locator("#sharedDueDate")).toContainText("20 augusti 2026");
  await expect(page.locator("#sharedPaymentStatus")).toHaveText("Väntar på Swish");
  await expect(page.locator("#sharedTotal")).toContainText("394");
  await expect(page.locator("#orderShareStatus")).toBeHidden();
  await expect(page.locator("body")).toHaveJSProperty("scrollWidth", 390);
});

test("admin kan stänga av en kundlänk", async ({ page }) => {
  await page.getByLabel("Kundens namn").fill("Mira Kund");
  await page.getByLabel("Behandling eller produkt").fill("Blått nagelset");
  await page.getByLabel("Pris (kr)").fill("200");
  await page.getByRole("button", { name: "Spara order" }).click();

  const orderCard = page.locator('.kanban-column[data-status="Ny"] .order-item');
  await orderCard.getByRole("button", { name: "Kundlänk" }).click();
  const shareUrl = await page.getByLabel("Kundens länk").inputValue();

  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Stäng av länken" }).click();

  await expect.poll(async () => (await readMockOrderShares(page)).length).toBe(0);
  await expect.poll(async () => (await readMockOrders(page))[0]?.shareToken).toBe("");
  await page.goto(shareUrl);

  await expect(page.locator("#orderShareContent")).toBeHidden();
  await expect(page.locator("#orderShareStatus")).toContainText(
    "Länken är ogiltig, har gått ut eller har stängts av"
  );
});

test("Firestore tillåter bara exakt kundlänk och förbjuder publik listning", async () => {
  const rules = await readFile(new URL("../../firestore.rules", import.meta.url), "utf8");

  expect(rules).toContain("match /orderShares/{shareToken}");
  expect(rules).toContain("allow list: if false;");
  expect(rules).toContain("shareToken.size() == 48");
  expect(rules).toContain("resource.data.expiresAt > request.time.toMillis()");
  expect(rules).toContain("allow create, update, delete: if isAdmin();");
});
