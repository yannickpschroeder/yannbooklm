import { test, expect } from "./fixtures"

async function tryDeleteNotebook(page: import("@playwright/test").Page, name: string) {
  await page.goto("/de/app")
  const card = page.locator('[data-slot="card"]').filter({ hasText: name })
  if (!(await card.isVisible({ timeout: 3_000 }).catch(() => false))) return
  await card.hover()
  await card.locator('[data-slot="dropdown-menu-trigger"]').click({ force: true })
  await page.getByText("Löschen").click()
  await page.getByRole("button", { name: "Ja, löschen" }).click()
}

test.describe("Notebooks CRUD", () => {
  // Track both names in case test fails mid-rename
  let createdName = ""
  let renamedName = ""

  test.afterEach(async ({ page }) => {
    if (renamedName) await tryDeleteNotebook(page, renamedName)
    if (createdName) await tryDeleteNotebook(page, createdName)
    createdName = ""
    renamedName = ""
  })

  test("create, rename and delete a notebook", async ({ page }) => {
    createdName = "E2E Test Notizbuch"
    renamedName = "Umbenanntes Notizbuch"

    await page.goto("/de/app")

    // Create
    await page.getByRole("button", { name: "Neues Notizbuch" }).click()
    await page.getByPlaceholder("Name des Notizbuchs").fill(createdName)
    await page.getByRole("dialog").getByRole("button", { name: "Erstellen" }).click()
    await expect(page.getByText(createdName)).toBeVisible()

    // Rename — force-click the hidden trigger (opacity-0 until hover)
    const card = page.locator('[data-slot="card"]').filter({ hasText: createdName })
    await card.hover()
    await card.locator('[data-slot="dropdown-menu-trigger"]').click({ force: true })
    await page.getByText("Umbenennen").click()
    const input = page.getByPlaceholder("Name des Notizbuchs")
    await input.clear()
    await input.fill(renamedName)
    await page.getByRole("dialog").getByRole("button", { name: "Speichern" }).click()
    await expect(page.getByText(renamedName)).toBeVisible()
    await expect(page.getByText(createdName)).not.toBeVisible()
    createdName = "" // rename succeeded — only renamedName needs cleanup now

    // Open notebook detail
    await page.getByText("Notizbuch öffnen").first().click()
    await expect(page).toHaveURL(/\/de\/app\/.+/)
    await page.goto("/de/app")

    // Delete (in-test — afterEach is the safety net)
    const renamedCard = page.locator('[data-slot="card"]').filter({ hasText: renamedName })
    await renamedCard.hover()
    await renamedCard.locator('[data-slot="dropdown-menu-trigger"]').click({ force: true })
    await page.getByText("Löschen").click()
    await expect(page.getByRole("alertdialog")).toBeVisible()
    await page.getByRole("button", { name: "Ja, löschen" }).click()
    await expect(page.getByText(renamedName)).not.toBeVisible()
    renamedName = "" // deleted in-test — afterEach does nothing
  })
})
