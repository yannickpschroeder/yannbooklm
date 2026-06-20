import path from "path"
import type { Page } from "@playwright/test"
import { test, expect } from "./fixtures.local"

const KRETA_PDF = path.join(__dirname, "fixtures/kreta-reisefuehrer.pdf")

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

async function ingestPdf(page: Page, pdfPath: string) {
  await page.getByRole("button", { name: "Quellen hinzufügen" }).click()
  const [fileChooser] = await Promise.all([
    page.waitForEvent("filechooser"),
    page.getByRole("button", { name: "Dateien hochladen" }).click(),
  ])
  await fileChooser.setFiles(pdfPath)

  await page.getByRole("dialog").waitFor({ state: "detached" })

  // The page reloads automatically when the source becomes ready.
  // readySourceCount > 0 only after that reload — so this is the true readiness signal.
  // Ingestion (upload → parse → embed) can take up to a few minutes; use explicit timeout.
  await expect(page.getByPlaceholder("Text eingeben", { exact: false })).not.toBeDisabled({
    timeout: 5 * 60_000,
  })
}

// @local
test.describe("RAG Chat @local", () => {
  let notebookName = ""

  test.afterEach(async ({ page }) => {
    if (notebookName) {
      await tryDeleteNotebook(page, notebookName)
      notebookName = ""
    }
  })

  test("Frage stellen und Antwort mit Zitat-Badge erhalten", async ({ page }) => {
    notebookName = "E2E Chat Test"
    // Clean up any notebook left over from a failed previous run
    await tryDeleteNotebook(page, notebookName)
    await createNotebook(page, notebookName)
    await ingestPdf(page, KRETA_PDF)

    const input = page.getByPlaceholder("Text eingeben", { exact: false })
    await input.fill("Was sind die wichtigsten Sehenswürdigkeiten auf Kreta?")
    await page.keyboard.press("Enter")

    // Wait for streaming to complete — assistant message with at least one citation badge
    await expect(page.locator("[title]").filter({ hasText: /^\d+$/ }).first()).toBeVisible({
      timeout: 60_000,
    })
  })

  test("Zitat-Badge klicken öffnet Quellendetail", async ({ page }) => {
    notebookName = "E2E Citation Test"
    await tryDeleteNotebook(page, notebookName)
    await createNotebook(page, notebookName)
    await ingestPdf(page, KRETA_PDF)

    const input = page.getByPlaceholder("Text eingeben", { exact: false })
    await input.fill("Was sind die wichtigsten Sehenswürdigkeiten auf Kreta?")
    await page.keyboard.press("Enter")

    const badge = page.locator("[title]").filter({ hasText: /^\d+$/ }).first()
    await expect(badge).toBeVisible({ timeout: 60_000 })

    await badge.click()
    await expect(page.locator("aside").getByTitle(/kreta/i)).toBeVisible({ timeout: 10_000 })
  })

  test("Quelle in Sidebar klicken öffnet Detailansicht", async ({ page }) => {
    notebookName = "E2E Source Detail Test"
    await tryDeleteNotebook(page, notebookName)
    await createNotebook(page, notebookName)
    await ingestPdf(page, KRETA_PDF)

    const sourceButton = page.locator("aside button").filter({ hasText: /kreta/i }).first()
    await sourceButton.click()

    await expect(page.getByTitle("Zurück zu Quellen")).toBeVisible({ timeout: 10_000 })
    await expect(page.locator("aside").getByText(/kreta/i).first()).toBeVisible()
  })

  test("Topic-Badge klicken sendet Frage an Chat", async ({ page }) => {
    notebookName = "E2E Topic Badge Test"
    await tryDeleteNotebook(page, notebookName)
    await createNotebook(page, notebookName)
    await ingestPdf(page, KRETA_PDF)

    const sourceButton = page.locator("aside button").filter({ hasText: /kreta/i }).first()
    await sourceButton.click()
    await expect(page.getByTitle("Zurück zu Quellen")).toBeVisible({ timeout: 10_000 })

    await page.getByText("Quellenübersicht").click()
    const topicBadge = page.locator("aside button.rounded-full").first()
    await expect(topicBadge).toBeVisible({ timeout: 10_000 })

    const topicText = await topicBadge.textContent()
    await topicBadge.click()

    // Restrict to the chat message bubble (bg-primary) to avoid matching the sidebar badge
    await expect(
      page.locator(".bg-primary").filter({ hasText: topicText! })
    ).toBeVisible({ timeout: 30_000 })
  })
})
