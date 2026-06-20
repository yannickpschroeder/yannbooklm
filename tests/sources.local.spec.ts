import path from "path"
import type { Page } from "@playwright/test"
import { test, expect } from "./fixtures.local"

const KORFU_URL =
  "https://www.griechenland-urlaub.net/sehenswuerdigkeiten/insel_korfu.html"
const KRETA_PDF = path.join(__dirname, "fixtures/kreta-reisefuehrer.pdf")

// Helper: create a notebook and navigate into it, returns notebookId
async function createNotebook(page: Page, name: string) {
  await page.goto("/de/app")
  await page.getByRole("button", { name: "Neues Notizbuch" }).click()
  await page.getByPlaceholder("Name des Notizbuchs").fill(name)
  await page.getByRole("dialog").getByRole("button", { name: "Erstellen" }).click()
  await expect(page.getByText(name)).toBeVisible()
  const card = page.locator('[data-slot="card"]').filter({ hasText: name })
  await card.getByRole("link", { name: "Notizbuch öffnen" }).click()
  await page.waitForURL(/\/de\/app\/.+/)
  return page.url().split("/").pop()!
}

async function deleteNotebook(page: Page, name: string) {
  await page.goto("/de/app")
  const card = page.locator('[data-slot="card"]').filter({ hasText: name })
  await card.hover()
  await card.locator('[data-slot="dropdown-menu-trigger"]').click({ force: true })
  await page.getByText("Löschen").click()
  await page.getByRole("button", { name: "Ja, löschen" }).click()
  await expect(page.getByText(name)).not.toBeVisible()
}

// @local
test.describe("Sources @local", () => {
  test("URL-Quelle hinzufügen und indizieren", async ({ page }) => {
    await createNotebook(page, "E2E URL Test")

    // Open add-source modal
    await page.getByRole("button", { name: "Quellen hinzufügen" }).click()
    await page.getByRole("button", { name: "Websites" }).click()
    await page.getByPlaceholder("https://example.com/artikel").fill(KORFU_URL)
    await page.getByRole("button", { name: "Hinzufügen" }).click()

    // Wait until source appears as ready in the sidebar
    await expect(
      page.locator("aside").getByText("Korfu", { exact: false })
    ).toBeVisible({ timeout: 10 * 60 * 1000 })

    await deleteNotebook(page, "E2E URL Test")
  })

  test("PDF-Quelle hochladen und indizieren", async ({ page }) => {
    await createNotebook(page, "E2E PDF Test")

    await page.getByRole("button", { name: "Quellen hinzufügen" }).click()
    const [fileChooser] = await Promise.all([
      page.waitForEvent("filechooser"),
      page.getByRole("button", { name: "Dateien hochladen" }).click(),
    ])
    await fileChooser.setFiles(KRETA_PDF)

    // Wait until source appears as ready in the sidebar
    await expect(
      page.locator("aside").getByText("kreta-reisefuehrer", { exact: false })
    ).toBeVisible({ timeout: 10 * 60 * 1000 })

    await deleteNotebook(page, "E2E PDF Test")
  })

  test("Quelle umbenennen", async ({ page }) => {
    await createNotebook(page, "E2E Rename Test")

    // Add URL source first
    await page.getByRole("button", { name: "Quellen hinzufügen" }).click()
    await page.getByRole("button", { name: "Websites" }).click()
    await page.getByPlaceholder("https://example.com/artikel").fill(KORFU_URL)
    await page.getByRole("button", { name: "Hinzufügen" }).click()
    await expect(
      page.locator("aside").getByText("Korfu", { exact: false })
    ).toBeVisible({ timeout: 10 * 60 * 1000 })

    // Rename via 3-dot menu
    const sourceItem = page.locator("aside li").filter({ hasText: "Korfu" })
    await sourceItem.hover()
    await sourceItem.getByRole("button", { name: "Optionen" }).click()
    await page.getByText("Quelle umbenennen").click()
    await page.getByRole("textbox").clear()
    await page.getByRole("textbox").fill("Korfu Reiseführer")
    await page.getByRole("button", { name: "Speichern" }).click()

    await expect(page.locator("aside").getByText("Korfu Reiseführer")).toBeVisible()
    await expect(page.locator("aside").getByText("Korfu und seine", { exact: false })).not.toBeVisible()

    await deleteNotebook(page, "E2E Rename Test")
  })

  test("Quelle löschen", async ({ page }) => {
    await createNotebook(page, "E2E Delete Test")

    await page.getByRole("button", { name: "Quellen hinzufügen" }).click()
    await page.getByRole("button", { name: "Websites" }).click()
    await page.getByPlaceholder("https://example.com/artikel").fill(KORFU_URL)
    await page.getByRole("button", { name: "Hinzufügen" }).click()
    await expect(
      page.locator("aside").getByText("Korfu", { exact: false })
    ).toBeVisible({ timeout: 10 * 60 * 1000 })

    // Delete via 3-dot menu
    const sourceItem = page.locator("aside li").filter({ hasText: "Korfu" })
    await sourceItem.hover()
    await sourceItem.getByRole("button", { name: "Optionen" }).click()
    await page.getByText("Quelle entfernen").click()

    await expect(page.locator("aside").getByText("Korfu", { exact: false })).not.toBeVisible()

    await deleteNotebook(page, "E2E Delete Test")
  })
})
