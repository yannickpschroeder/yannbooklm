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
  timeout: 10 * 60 * 1000, // 10 min per test (ingestion can be slow)
  expect: {
    timeout: 10 * 60 * 1000,
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: "npm run dev -- --port 3001",
    url: "http://localhost:3001",
    reuseExistingServer: false,
    timeout: 60_000,
    stdout: "ignore",
    stderr: "ignore",
    env: {
      DATABASE_URL:
        "postgresql://postgres:postgres@localhost:5433/yannbooklm_test",
      S3_ENDPOINT: "http://localhost:4566",
      AWS_S3_BUCKET: "test-bucket",
      AWS_ACCESS_KEY_ID: "test",
      AWS_SECRET_ACCESS_KEY: "test",
      AWS_REGION: "eu-central-1",
      E2E_TEST: "true",
      VOYAGE_API_KEY: "test",
    },
  },
})
