import { defineConfig, devices } from "@playwright/test";

const MOCK_PORT = 5099;
const APP_PORT = 3100;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: `http://127.0.0.1:${APP_PORT}`,
    trace: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: [
    {
      command: "node mock-api/server.mjs",
      env: { PORT: String(MOCK_PORT) },
      url: `http://127.0.0.1:${MOCK_PORT}/health/live`,
      reuseExistingServer: !process.env.CI,
    },
    {
      command: `npm run build && npx next start -p ${APP_PORT} -H 127.0.0.1`,
      env: {
        API_BASE_URL: `http://127.0.0.1:${MOCK_PORT}`,
        COOKIE_SECURE: "false",
      },
      url: `http://127.0.0.1:${APP_PORT}/api/health`,
      timeout: 240_000,
      reuseExistingServer: !process.env.CI,
    },
  ],
});
