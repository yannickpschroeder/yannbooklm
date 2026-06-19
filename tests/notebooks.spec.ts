import { test, expect } from "./fixtures"

test.describe("Notebooks CRUD", () => {
  test("create, rename and delete a notebook", async ({ page }) => {
    await page.goto("/de/app")

    // Create
    await page.getByRole("button", { name: "Neues Notizbuch" }).click()
    await page.getByPlaceholder("Name des Notizbuchs").fill("E2E Test Notizbuch")
    await page.getByRole("dialog").getByRole("button", { name: "Erstellen" }).click()
    await expect(page.getByText("E2E Test Notizbuch")).toBeVisible()

    // Rename — force-click the hidden trigger (opacity-0 until hover)
    const card = page.locator('[data-slot="card"]').filter({ hasText: "E2E Test Notizbuch" })
    await card.hover()
    await card.locator('[data-slot="dropdown-menu-trigger"]').click({ force: true })
    await page.getByText("Umbenennen").click()
    const input = page.getByPlaceholder("Name des Notizbuchs")
    await input.clear()
    await input.fill("Umbenanntes Notizbuch")
    await page.getByRole("dialog").getByRole("button", { name: "Speichern" }).click()
    await expect(page.getByText("Umbenanntes Notizbuch")).toBeVisible()
    await expect(page.getByText("E2E Test Notizbuch")).not.toBeVisible()

    // Open notebook detail
    await page.getByText("Notizbuch öffnen").first().click()
    await expect(page).toHaveURL(/\/de\/app\/.+/)
    await page.goto("/de/app")

    // Delete
    const renamedCard = page.locator('[data-slot="card"]').filter({ hasText: "Umbenanntes Notizbuch" })
    await renamedCard.hover()
    await renamedCard.locator('[data-slot="dropdown-menu-trigger"]').click({ force: true })
    await page.getByText("Löschen").click()
    await expect(page.getByRole("alertdialog")).toBeVisible()
    await page.getByRole("button", { name: "Ja, löschen" }).click()
    await expect(page.getByText("Umbenanntes Notizbuch")).not.toBeVisible()
  })
})
