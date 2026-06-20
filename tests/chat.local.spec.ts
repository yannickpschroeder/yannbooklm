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

async function deleteNotebook(page: Page, name: string) {
  await page.goto("/de/app")
  const card = page.locator('[data-slot="card"]').filter({ hasText: name })
  await card.hover()
  await card.locator('[data-slot="dropdown-menu-trigger"]').click({ force: true })
  await page.getByText("Löschen").click()
  await page.getByRole("button", { name: "Ja, löschen" }).click()
  await expect(page.getByText(name)).not.toBeVisible()
}

async function ingestPdf(page: Page, pdfPath: string, titleFragment: string) {
  await page.getByRole("button", { name: "Quellen hinzufügen" }).click()
  const [fileChooser] = await Promise.all([
    page.waitForEvent("filechooser"),
    page.getByRole("button", { name: "Dateien hochladen" }).click(),
  ])
  await fileChooser.setFiles(pdfPath)
  await expect(
    page.locator("aside").getByText(titleFragment, { exact: false })
  ).toBeVisible({ timeout: 10 * 60 * 1000 })
}

// @local
test.describe("RAG Chat @local", () => {
  test("Frage stellen und Antwort mit Zitat-Badge erhalten", async ({ page }) => {
    await createNotebook(page, "E2E Chat Test")
    await ingestPdf(page, KRETA_PDF, "kreta")

    const input = page.getByPlaceholder("Text eingeben…")
    await input.fill("Was sind die wichtigsten Sehenswürdigkeiten auf Kreta?")
    await page.keyboard.press("Enter")

    // Wait for streaming to complete — assistant message with at least one citation badge
    await expect(page.locator('[title]').filter({ hasText: /^\d+$/ }).first()).toBeVisible({
      timeout: 60_000,
    })

    await deleteNotebook(page, "E2E Chat Test")
  })

  test("Zitat-Badge klicken öffnet Quellendetail", async ({ page }) => {
    await createNotebook(page, "E2E Citation Test")
    await ingestPdf(page, KRETA_PDF, "kreta")

    const input = page.getByPlaceholder("Text eingeben…")
    await input.fill("Was sind die wichtigsten Sehenswürdigkeiten auf Kreta?")
    await page.keyboard.press("Enter")

    // Wait for citation badge
    const badge = page.locator('[title]').filter({ hasText: /^\d+$/ }).first()
    await expect(badge).toBeVisible({ timeout: 60_000 })

    // Click badge — source detail panel should open
    await badge.click()
    await expect(page.locator("aside").getByTitle(/kreta/i)).toBeVisible({ timeout: 10_000 })

    await deleteNotebook(page, "E2E Citation Test")
  })

  test("Quelle in Sidebar klicken öffnet Detailansicht", async ({ page }) => {
    await createNotebook(page, "E2E Source Detail Test")
    await ingestPdf(page, KRETA_PDF, "kreta")

    // Click the source title button in the sidebar
    const sourceButton = page.locator("aside button").filter({ hasText: /kreta/i }).first()
    await sourceButton.click()

    // Detail panel: back button + source title visible
    await expect(page.getByTitle("Zurück zu Quellen")).toBeVisible({ timeout: 10_000 })
    await expect(page.locator("aside").getByText(/kreta/i).first()).toBeVisible()

    await deleteNotebook(page, "E2E Source Detail Test")
  })

  test("Topic-Badge klicken sendet Frage an Chat", async ({ page }) => {
    await createNotebook(page, "E2E Topic Badge Test")
    await ingestPdf(page, KRETA_PDF, "kreta")

    // Open source detail to reveal topic badges
    const sourceButton = page.locator("aside button").filter({ hasText: /kreta/i }).first()
    await sourceButton.click()
    await expect(page.getByTitle("Zurück zu Quellen")).toBeVisible({ timeout: 10_000 })

    // Expand Quellenübersicht to see topic badges
    await page.getByText("Quellenübersicht").click()
    const topicBadge = page.locator("aside button.rounded-full").first()
    await expect(topicBadge).toBeVisible({ timeout: 10_000 })

    const topicText = await topicBadge.textContent()

    // Click topic badge — question should appear as user message in chat
    await topicBadge.click()
    await expect(page.getByText(topicText!, { exact: false })).toBeVisible({ timeout: 30_000 })

    await deleteNotebook(page, "E2E Topic Badge Test")
  })
})
