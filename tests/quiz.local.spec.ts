import type { Page } from "@playwright/test"
import { test, expect } from "./fixtures.local"

const MOCK_QUIZ_ID = "mock-quiz-e2e-abc123"

const MOCK_QUIZ_OUTPUT = {
  id: MOCK_QUIZ_ID,
  notebookId: "placeholder",
  type: "quiz",
  title: null,
  shareToken: null,
  s3Key: null,
  createdAt: new Date().toISOString(),
  data: {
    questions: [
      { question: "Was ist 2+2?", options: ["3", "4", "5", "6"], correct: 1, explanation: "2+2 ergibt 4." },
    ],
    topics: ["Mathematik"],
    suggestions: ["Algebra"],
    usedSources: [{ id: "src-001", title: "Mathe-Buch.pdf", type: "pdf" }],
  },
}

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

/** Mocks POST /api/studio/quiz and optional PATCH for the mock quiz id. */
async function mockQuizApi(page: Page, opts: { delayMs?: number; patchResponse?: object } = {}) {
  await page.route("**/api/studio/quiz", async (route) => {
    if (route.request().method() !== "POST") { await route.continue(); return }
    if (opts.delayMs) await new Promise((r) => setTimeout(r, opts.delayMs))
    await route.fulfill({ json: MOCK_QUIZ_OUTPUT, status: 201 })
  })
  if (opts.patchResponse !== undefined) {
    await page.route(`**/api/studio/quiz/${MOCK_QUIZ_ID}`, async (route) => {
      if (route.request().method() !== "PATCH") { await route.continue(); return }
      await route.fulfill({ json: opts.patchResponse, status: 200 })
    })
  }
}

const studioSidebar = (page: Page) => page.locator("aside").last()

async function createMockQuizAndWait(page: Page) {
  await studioSidebar(page).getByRole("button", { name: "Quiz" }).click()
  const quizItem = studioSidebar(page).locator("li").filter({ hasText: "Quiz" }).first()
  await expect(quizItem).toBeVisible({ timeout: 10_000 })
  return quizItem
}

// @local
test.describe("Quiz @local", () => {
  let notebookName = ""

  test.afterEach(async ({ page }) => {
    if (notebookName) {
      await tryDeleteNotebook(page, notebookName)
      notebookName = ""
    }
  })

  test("Quiz erstellen zeigt Spinner in Ergebnisliste", async ({ page }) => {
    await mockQuizApi(page, { delayMs: 4_000 })
    notebookName = "E2E Quiz Spinner"
    await createNotebook(page, notebookName)

    await studioSidebar(page).getByRole("button", { name: "Quiz" }).click()

    const spinner = studioSidebar(page).locator('[class*="animate-spin"]').first()
    await expect(spinner).toBeVisible({ timeout: 5_000 })
  })

  test("Quiz umbenennen", async ({ page }) => {
    await mockQuizApi(page, {
      patchResponse: { ...MOCK_QUIZ_OUTPUT, title: "Mein Quiz" },
    })
    notebookName = "E2E Quiz Umbenennen"
    await createNotebook(page, notebookName)

    const quizItem = await createMockQuizAndWait(page)

    await quizItem.hover()
    await quizItem.locator('[data-slot="dropdown-menu-trigger"]').click({ force: true })
    await page.getByText("Umbenennen").click()

    const input = page.getByRole("textbox")
    await input.clear()
    await input.fill("Mein Quiz")
    await page.getByRole("button", { name: "Speichern" }).click()

    await expect(studioSidebar(page).getByText("Mein Quiz")).toBeVisible({ timeout: 5_000 })
  })

  test("Quiz löschen", async ({ page }) => {
    await mockQuizApi(page)
    await page.route(`**/api/studio/quiz/${MOCK_QUIZ_ID}`, async (route) => {
      if (route.request().method() !== "DELETE") { await route.continue(); return }
      await route.fulfill({ status: 204 })
    })
    notebookName = "E2E Quiz Löschen"
    await createNotebook(page, notebookName)

    const quizItem = await createMockQuizAndWait(page)

    await quizItem.hover()
    await quizItem.locator('[data-slot="dropdown-menu-trigger"]').click({ force: true })
    await page.getByText("Löschen").click()

    await expect(studioSidebar(page).getByText("Noch keine Ergebnisse")).toBeVisible({ timeout: 5_000 })
  })

  test("Modal 'Prompt und Quellen ansehen' zeigt Quellen-Chips", async ({ page }) => {
    await mockQuizApi(page)
    notebookName = "E2E Quiz Quellen Modal"
    await createNotebook(page, notebookName)

    const quizItem = await createMockQuizAndWait(page)

    await quizItem.hover()
    await quizItem.locator('[data-slot="dropdown-menu-trigger"]').click({ force: true })
    await page.getByText("Prompt und Quellen ansehen").click()

    await expect(page.getByRole("dialog")).toBeVisible({ timeout: 5_000 })
    await expect(page.getByText("Mathe-Buch.pdf")).toBeVisible()
  })

  test("Klick auf ↺ öffnet Anpassen-Ansicht, Generieren schließt Modal", async ({ page }) => {
    await mockQuizApi(page)
    notebookName = "E2E Quiz Anpassen"
    await createNotebook(page, notebookName)

    const quizItem = await createMockQuizAndWait(page)

    await quizItem.hover()
    await quizItem.locator('[data-slot="dropdown-menu-trigger"]').click({ force: true })
    await page.getByText("Prompt und Quellen ansehen").click()

    await expect(page.getByRole("dialog")).toBeVisible({ timeout: 5_000 })

    // Click ↺ to open customize view
    await page.getByRole("button", { name: "Quiz anpassen" }).click()
    await expect(page.getByText("Anzahl der Fragen")).toBeVisible()
    await expect(page.getByText("Schwierigkeitsgrad")).toBeVisible()

    // Mock regenerate and click Generieren
    await page.route("**/api/studio/quiz", async (route) => {
      if (route.request().method() !== "POST") { await route.continue(); return }
      await route.fulfill({ json: { ...MOCK_QUIZ_OUTPUT, id: "mock-quiz-regen" }, status: 201 })
    })

    await page.getByRole("button", { name: "Generieren" }).click()

    await expect(page.getByRole("dialog")).not.toBeVisible({ timeout: 5_000 })
  })
})
