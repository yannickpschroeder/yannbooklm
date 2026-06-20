import type { Page } from "@playwright/test"
import { test, expect } from "./fixtures.local"

async function createNotebook(page: Page, name: string) {
  await page.goto("/de/app")
  await page.waitForLoadState("domcontentloaded")
  await page.getByRole("button", { name: "Neues Notizbuch" }).click()
  await page.getByPlaceholder("Name des Notizbuchs").fill(name)
  await page.getByRole("dialog").getByRole("button", { name: "Erstellen" }).click()
  const card = page.locator('[data-slot="card"]').filter({ hasText: name }).first()
  await expect(card).toBeVisible({ timeout: 30_000 })
  await card.getByRole("link", { name: "Notizbuch öffnen" }).click()
  await page.waitForURL(/\/de\/app\/.+/)
  const closeBtn = page.getByRole("dialog").getByRole("button", { name: "Schließen" })
  if (await closeBtn.isVisible({ timeout: 5_000 }).catch(() => false)) {
    await closeBtn.click()
  }
}

async function tryDeleteNotebook(page: Page, name: string) {
  await page.goto("/de/app")
  const card = page.locator('[data-slot="card"]').filter({ hasText: name })
  if (!(await card.isVisible({ timeout: 3_000 }).catch(() => false))) return
  await card.hover()
  await card.locator('[data-slot="dropdown-menu-trigger"]').click({ force: true })
  await page.getByText("Löschen").click()
  await page.getByRole("button", { name: "Ja, löschen" }).click()
}

const studioSidebar = (page: Page) => page.locator("aside").last()
const sourceSidebar = (page: Page) => page.locator("aside").first()

// @local
test.describe("Notes @local", () => {
  let notebookName = ""

  test.afterEach(async ({ page }) => {
    if (notebookName) {
      await tryDeleteNotebook(page, notebookName)
      notebookName = ""
    }
  })

  test("Notiz anlegen", async ({ page }) => {
    notebookName = "E2E Notiz Anlegen"
    await createNotebook(page, notebookName)

    await studioSidebar(page).getByRole("button", { name: "Notiz hinzufügen" }).click()

    await expect(studioSidebar(page).getByPlaceholder("Neue Notiz")).toBeVisible()
  })

  test("Notiz löschen", async ({ page }) => {
    notebookName = "E2E Notiz Löschen"
    await createNotebook(page, notebookName)

    await studioSidebar(page).getByRole("button", { name: "Notiz hinzufügen" }).click()
    await expect(studioSidebar(page).getByPlaceholder("Neue Notiz")).toBeVisible()

    await studioSidebar(page).getByRole("button", { name: "Löschen" }).click()

    await expect(studioSidebar(page).getByText("Noch keine Ergebnisse")).toBeVisible()
  })

  test("Notiz als Quelle festlegen und Quelle löschen", async ({ page }) => {
    notebookName = "E2E Notiz Quelle"
    await createNotebook(page, notebookName)

    await studioSidebar(page).getByRole("button", { name: "Notiz hinzufügen" }).click()
    await expect(studioSidebar(page).getByPlaceholder("Neue Notiz")).toBeVisible()

    const editor = page.locator(".ProseMirror").first()
    await editor.click()
    await editor.pressSequentially("Testinhalt für die Quelle")

    // wait for 1s debounce + network
    await page.waitForTimeout(2_500)

    await studioSidebar(page).getByRole("button", { name: "Als Quelle festlegen" }).click()

    await page.waitForLoadState("domcontentloaded")
    await expect(
      sourceSidebar(page).getByText("Neue Notiz", { exact: false })
    ).toBeVisible({ timeout: 30_000 })

    const sourceItem = sourceSidebar(page).locator("li").filter({ hasText: "Neue Notiz" })
    await sourceItem.hover()
    await sourceItem.getByRole("button", { name: "Optionen" }).click()
    await page.getByText("Quelle entfernen").click()

    await expect(
      sourceSidebar(page).getByText("Neue Notiz", { exact: false })
    ).not.toBeVisible({ timeout: 10_000 })
  })
})
