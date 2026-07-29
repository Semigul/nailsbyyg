import { expect, test } from "@playwright/test";
import { installFirebaseMock, readMockOrders } from "./support/firebase-mock.js";

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
  await expect(newColumn.locator(".order-item")).toContainText("Nora Test • Gelénaglar");

  await newColumn.getByRole("button", { name: "Flytta vidare" }).click();
  const activeColumn = page.locator('.kanban-column[data-status="Pågår"]');
  await expect(activeColumn.locator(".order-item")).toContainText("Nora Test • Gelénaglar");

  await activeColumn.getByRole("button", { name: "Redigera" }).click();
  await expect(page.locator("#formTitle")).toHaveText("Redigera order");
  await page.getByLabel("Behandling eller produkt").fill("Gelénaglar med chrome");
  await page.getByRole("button", { name: "Spara order" }).click();
  await expect(activeColumn.locator(".order-item")).toContainText("Gelénaglar med chrome");

  page.once("dialog", (dialog) => dialog.accept());
  await activeColumn.getByRole("button", { name: "Ta bort" }).click();
  await expect(activeColumn.locator(".order-item")).toHaveCount(0);
  expect(await readMockOrders(page)).toHaveLength(0);
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
