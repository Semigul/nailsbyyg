import { expect, test } from "@playwright/test";
import { installFirebaseMock } from "./support/firebase-mock.js";

test("kundsidan hämtar aktuell Firebase- och Cloudinary-konfiguration utan gammal cache", async ({ page }) => {
  await installFirebaseMock(page, { injectFirebaseConfig: false });
  let requestedConfigUrl = "";

  await page.route("**/firebase.config.js?*", async (route) => {
    requestedConfigUrl = route.request().url();
    await route.fulfill({
      status: 200,
      contentType: "application/javascript",
      body: `
        window.FIREBASE_CONFIG = {
          apiKey: "e2e-api-key",
          authDomain: "e2e.local",
          projectId: "e2e-project",
          appId: "e2e-app"
        };
        window.CLOUDINARY_CONFIG = {
          cloudName: "e2e-cloud",
          uploadPreset: "e2e-preset",
          folder: "nailsbyyg-orders"
        };
      `
    });
  });

  await page.goto("/kund.html");

  await expect(page.locator("#customerOrderForm")).toBeVisible();
  expect(new URL(requestedConfigUrl).searchParams.get("v")).toMatch(/^\d+$/);
});
