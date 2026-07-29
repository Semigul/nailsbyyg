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

test("admin kan arkivera och återställa en order från det dolda arkivet", async ({ page }) => {
  await page.getByLabel("Kundens namn").fill("Alicia Arkiv");
  await page.getByLabel("Behandling eller produkt").fill("Press-on set");
  await page.getByRole("button", { name: "Spara order" }).click();

  const newColumn = page.locator('.kanban-column[data-status="Ny"]');
  await expect(newColumn.locator(".order-item")).toContainText("Alicia Arkiv");

  page.once("dialog", (dialog) => dialog.accept());
  await newColumn.getByRole("button", { name: "Arkivera" }).click();

  await expect(newColumn.locator(".order-item")).toHaveCount(0);
  await expect(page.locator("#totalCount")).toHaveText("0");
  await expect(page.locator("#archiveCount")).toHaveText("1");

  await page.locator("#archivePanel summary").click();
  const archivedCard = page.locator("#archiveOrders .order-item");
  await expect(archivedCard).toContainText("Alicia Arkiv");
  await archivedCard.getByRole("button", { name: "Återställ" }).click();

  await expect(page.locator("#archiveCount")).toHaveText("0");
  await expect(newColumn.locator(".order-item")).toContainText("Alicia Arkiv");
  expect(await readMockOrders(page)).toMatchObject([{ archivedAt: null }]);
});

test("orderstatus kan flyttas med en touchvänlig kontroll på iPhone-storlek", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 3000 });
  await page.getByLabel("Kundens namn").fill("Mobil Test");
  await page.getByLabel("Behandling eller produkt").fill("Mobil design");
  await page.getByRole("button", { name: "Spara order" }).click();

  const newColumn = page.locator('.kanban-column[data-status="Ny"]');
  const card = newColumn.locator(".order-item");
  const dragHandle = card.getByRole("button", { name: "Dra ordern till en annan status" });

  await expect(dragHandle).toBeVisible();
  const handleBox = await dragHandle.boundingBox();
  expect(handleBox?.height).toBeGreaterThanOrEqual(44);

  await page.evaluate(() => {
    const handle = document.querySelector('[data-status="Ny"] [data-drag-handle]');
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
  await expect(doneColumn.locator(".order-item")).toContainText("Mobil Test");

  await doneColumn
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
