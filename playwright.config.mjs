import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "tests/e2e",
  timeout: 60_000,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["list"]] : "list",
  use: {
    baseURL: "http://localhost:8765",
    serviceWorkers: "block",
    locale: "pl-PL",
    timezoneId: "Europe/Warsaw",
    ...devices["Pixel 5"],
    viewport: { width: 375, height: 667 },
  },
  webServer: {
    command: "python3 -m http.server 8765",
    url: "http://localhost:8765/index.html",
    reuseExistingServer: !process.env.CI,
    stderr: "ignore",
  },
});
