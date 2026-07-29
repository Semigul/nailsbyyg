import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI
    ? [["line"], ["html", { open: "never" }]]
    : "list",
  use: {
    baseURL: "http://127.0.0.1:4173",
    colorScheme: "light",
    screenshot: "only-on-failure",
    trace: "on-first-retry",
    video: "retain-on-failure",
    viewport: { width: 390, height: 844 }
  },
  webServer: {
    command: "python3 -m http.server 4173",
    url: "http://127.0.0.1:4173/kund.html",
    reuseExistingServer: !process.env.CI,
    timeout: 15_000
  }
});
