import type { Page } from "@playwright/test"
import { test, expect } from "./fixtures.local"

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function createNotebook(page: Page, name: string): Promise<string> {
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

/**
 * Opens the share popover, clicks "Chat + Quellen" and captures the token from
 * the API response. Uses waitForResponse so no timing hacks are needed.
 */
async function generateShareToken(page: Page, notebookId: string): Promise<string> {
  await page.getByRole("button", { name: "Freigeben" }).click()

  const [response] = await Promise.all([
    page.waitForResponse(
      (res) =>
        res.url().includes(`/api/notebooks/${notebookId}/share`) &&
        res.request().method() === "POST",
    ),
    page.getByText("Chat + Quellen").first().click(),
  ])

  const { token } = (await response.json()) as { token: string }
  return token
}

// ─── Tests ────────────────────────────────────────────────────────────────────

// @local
test.describe("Share Magic-Link @local", () => {
  let notebookName = ""

  test.afterEach(async ({ page }) => {
    if (notebookName) {
      await tryDeleteNotebook(page, notebookName)
      notebookName = ""
    }
  })

  test("Ungültiger Share-Token zeigt Not-Found-Seite", async ({ browser }) => {
    const ctx = await browser.newContext()
    const publicPage = await ctx.newPage()
    await publicPage.goto("/share/n/dieser-token-existiert-nicht")
    // Next.js notFound() renders the default 404 page
    await expect(publicPage.locator("body")).toContainText("404")
    await ctx.close()
  })

  test("Share-Seite öffnet ohne Auth und zeigt Notizbuchnamen", async ({ page, browser }) => {
    notebookName = "E2E Share Öffnen"
    const notebookId = await createNotebook(page, notebookName)
    const token = await generateShareToken(page, notebookId)
    expect(token).toBeTruthy()

    const ctx = await browser.newContext()
    const publicPage = await ctx.newPage()
    await publicPage.goto(`/share/n/${token}`)

    await expect(publicPage.getByText(notebookName)).toBeVisible({ timeout: 10_000 })
    await expect(publicPage.getByText("· YannBookLM")).toBeVisible()

    await ctx.close()
  })

  test("Share-Seite hat keinerlei Bearbeitungsoptionen im Header", async ({ page, browser }) => {
    notebookName = "E2E Share Header Readonly"
    const notebookId = await createNotebook(page, notebookName)
    const token = await generateShareToken(page, notebookId)

    const ctx = await browser.newContext()
    const publicPage = await ctx.newPage()
    await publicPage.goto(`/share/n/${token}`)
    await expect(publicPage.getByText(notebookName)).toBeVisible({ timeout: 10_000 })

    // Header must not contain owner-only controls
    await expect(publicPage.getByRole("button", { name: "Freigeben" })).not.toBeVisible()
    await expect(publicPage.getByRole("button", { name: "Einstellungen" })).not.toBeVisible()

    // No user avatar dropdown (sign-out etc.)
    await expect(publicPage.locator('[data-slot="avatar"]')).not.toBeVisible()

    // No dropdown-menu triggers anywhere on the page
    const dropdownTriggers = publicPage.locator('[data-slot="dropdown-menu-trigger"]')
    await expect(dropdownTriggers).toHaveCount(0)

    await ctx.close()
  })

  test("Share-Seite hat keinen Quellen-hinzufügen-Button", async ({ page, browser }) => {
    notebookName = "E2E Share Quellen Readonly"
    const notebookId = await createNotebook(page, notebookName)
    const token = await generateShareToken(page, notebookId)

    const ctx = await browser.newContext()
    const publicPage = await ctx.newPage()
    await publicPage.goto(`/share/n/${token}`)
    await expect(publicPage.getByText(notebookName)).toBeVisible({ timeout: 10_000 })

    const sidebar = publicPage.locator("aside").first()

    await expect(sidebar.getByRole("button", { name: /hinzufügen/i })).not.toBeVisible()
    await expect(sidebar.getByRole("button", { name: /löschen/i })).not.toBeVisible()
    await expect(sidebar.getByRole("button", { name: /umbenennen/i })).not.toBeVisible()

    // No enable/disable checkboxes for sources
    await expect(sidebar.locator('input[type="checkbox"]')).toHaveCount(0)

    await ctx.close()
  })

  test("Chat-Input ist vorhanden und aktiviert", async ({ page, browser }) => {
    notebookName = "E2E Share Chat Input"
    const notebookId = await createNotebook(page, notebookName)
    const token = await generateShareToken(page, notebookId)

    const ctx = await browser.newContext()
    const publicPage = await ctx.newPage()
    await publicPage.goto(`/share/n/${token}`)
    await expect(publicPage.getByText(notebookName)).toBeVisible({ timeout: 10_000 })

    const input = publicPage.getByPlaceholder("Frage stellen…")
    await expect(input).toBeVisible()
    await expect(input).toBeEnabled()

    // Submit button is present (type=submit inside the chat form)
    const submitBtn = publicPage.locator('form button[type="submit"]')
    await expect(submitBtn).toBeVisible()

    await ctx.close()
  })

  test("Notebook-App-Route leitet ohne Session zum Login weiter", async ({ page, browser }) => {
    notebookName = "E2E Share Auth Guard"
    const notebookId = await createNotebook(page, notebookName)
    // Generate token so the notebook exists in DB (also tests revocation later)
    await generateShareToken(page, notebookId)

    const ctx = await browser.newContext()
    const publicPage = await ctx.newPage()

    // Authenticated notebook route must NOT be accessible without a session
    await publicPage.goto(`/de/app/${notebookId}`)
    await expect(publicPage).not.toHaveURL(/\/app\//)

    await ctx.close()
  })

  test("Preview-API liefert 404 für Quelle aus einem anderen Notizbuch", async ({ page, browser }) => {
    notebookName = "E2E Share API Guard"
    const notebookId = await createNotebook(page, notebookName)
    const token = await generateShareToken(page, notebookId)

    const ctx = await browser.newContext()
    const publicPage = await ctx.newPage()

    const otherSourceId = "00000000-0000-0000-0000-000000000000"
    const res = await publicPage.goto(
      `/api/share/notebook/${token}/sources/${otherSourceId}/preview`,
    )
    expect(res?.status()).toBe(404)

    await ctx.close()
  })
})
