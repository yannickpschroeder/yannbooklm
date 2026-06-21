import { defineConfig, devices } from "@playwright/test"

export default defineConfig({
  testDir: "./tests",
  testMatch: "**/*.local.spec.ts",
  fullyParallel: false,
  retries: 0,
  workers: 1,
  reporter: "list",
  globalSetup: "./tests/global-setup.test.ts",
  globalTeardown: "./tests/global-teardown.test.ts",
  use: {
    baseURL: "http://localhost:3001",
    trace: "on-first-retry",
  },
  timeout: 60 * 1000,
  expect: {
    timeout: 30 * 1000,
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: "npm run dev:test",
    url: "http://localhost:3001",
    reuseExistingServer: !process.env.CI,
    timeout: 5 * 60_000,
    stdout: "ignore",
    stderr: "ignore",
  },
})
