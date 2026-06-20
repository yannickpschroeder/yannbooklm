import path from "path"
import type { Page } from "@playwright/test"
import { test, expect } from "./fixtures.local"

const KORFU_URL =
  "https://www.griechenland-urlaub.net/sehenswuerdigkeiten/insel_korfu.html"
const KRETA_PDF = path.join(__dirname, "fixtures/kreta-reisefuehrer.pdf")
const YOUTUBE_URL = "https://www.youtube.com/watch?v=dQw4w9WgXcQ"

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
  return page.url().split("/").pop()!
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

// @local
test.describe("Sources @local", () => {
  let notebookName = ""

  test.afterEach(async ({ page }) => {
    if (notebookName) {
      await tryDeleteNotebook(page, notebookName)
      notebookName = ""
    }
  })

  test("URL-Quelle hinzufügen und indizieren", async ({ page }) => {
    notebookName = "E2E URL Test"
    await createNotebook(page, notebookName)

    await page.getByRole("button", { name: "Quellen hinzufügen" }).click()
    await page.getByRole("button", { name: "Websites" }).click()
    await page.getByPlaceholder("https://example.com/artikel").fill(KORFU_URL)
    await page.getByRole("button", { name: "Hinzufügen" }).click()

    await expect(
      page.locator("aside").getByText("Korfu", { exact: false })
    ).toBeVisible({ timeout: 10 * 60 * 1000 })
  })

  test("PDF-Quelle hochladen und indizieren", async ({ page }) => {
    notebookName = "E2E PDF Test"
    await createNotebook(page, notebookName)

    await page.getByRole("button", { name: "Quellen hinzufügen" }).click()
    const [fileChooser] = await Promise.all([
      page.waitForEvent("filechooser"),
      page.getByRole("button", { name: "Dateien hochladen" }).click(),
    ])
    await fileChooser.setFiles(KRETA_PDF)

    await expect(
      page.locator("aside").getByText("kreta-reisefuehrer", { exact: false })
    ).toBeVisible({ timeout: 10 * 60 * 1000 })
  })

  test("Quelle umbenennen", async ({ page }) => {
    notebookName = "E2E Rename Test"
    await createNotebook(page, notebookName)

    await page.getByRole("button", { name: "Quellen hinzufügen" }).click()
    await page.getByRole("button", { name: "Websites" }).click()
    await page.getByPlaceholder("https://example.com/artikel").fill(KORFU_URL)
    await page.getByRole("button", { name: "Hinzufügen" }).click()
    await expect(
      page.locator("aside").getByText("Korfu", { exact: false })
    ).toBeVisible({ timeout: 10 * 60 * 1000 })

    const sourceItem = page.locator("aside li").filter({ hasText: "Korfu" })
    await sourceItem.hover()
    await sourceItem.getByRole("button", { name: "Optionen" }).click()
    await page.getByText("Quelle umbenennen").click()
    await page.getByRole("textbox").clear()
    await page.getByRole("textbox").fill("Korfu Reiseführer")
    await page.getByRole("button", { name: "Speichern" }).click()

    await expect(page.locator("aside").getByText("Korfu Reiseführer")).toBeVisible()
    await expect(page.locator("aside").getByText("Korfu und seine", { exact: false })).not.toBeVisible()
  })

  test("YouTube-Quelle hinzufügen und indizieren", async ({ page }) => {
    notebookName = "E2E YouTube Test"
    await createNotebook(page, notebookName)

    await page.getByRole("button", { name: "Quellen hinzufügen" }).click()
    await page.getByRole("button", { name: "Websites" }).click()
    await page.getByPlaceholder("https://example.com/artikel").fill(YOUTUBE_URL)
    await page.getByRole("button", { name: "Hinzufügen" }).click()

    await expect(
      page.locator("aside").getByText("Kreta Reiseführer", { exact: false })
    ).toBeVisible({ timeout: 10 * 60 * 1000 })
  })

  test("Quelle löschen", async ({ page }) => {
    notebookName = "E2E Delete Test"
    await createNotebook(page, notebookName)

    await page.getByRole("button", { name: "Quellen hinzufügen" }).click()
    await page.getByRole("button", { name: "Websites" }).click()
    await page.getByPlaceholder("https://example.com/artikel").fill(KORFU_URL)
    await page.getByRole("button", { name: "Hinzufügen" }).click()
    await expect(
      page.locator("aside").getByText("Korfu", { exact: false })
    ).toBeVisible({ timeout: 10 * 60 * 1000 })

    const sourceItem = page.locator("aside li").filter({ hasText: "Korfu" })
    await sourceItem.hover()
    await sourceItem.getByRole("button", { name: "Optionen" }).click()
    await page.getByText("Quelle entfernen").click()

    await expect(page.locator("aside").getByText("Korfu", { exact: false })).not.toBeVisible()
  })
})
