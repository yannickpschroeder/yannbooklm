import { test, expect } from "@playwright/test"

test.describe("Login page", () => {
  test("shows sign-in options in German", async ({ page }) => {
    await page.goto("/de/login")
    await expect(page.getByText("Mit Google anmelden")).toBeVisible()
    await expect(page.getByText("Mit GitHub anmelden")).toBeVisible()
    await expect(page.getByText("oder")).toBeVisible()
    await expect(page.getByText("English")).toBeVisible()
  })

  test("shows sign-in options in English", async ({ page }) => {
    await page.goto("/en/login")
    await expect(page.getByText("Continue with Google")).toBeVisible()
    await expect(page.getByText("Continue with GitHub")).toBeVisible()
    await expect(page.getByText("or")).toBeVisible()
    await expect(page.getByText("Deutsch")).toBeVisible()
  })
})
