import { JSDOM } from "jsdom"
import { Readability } from "@mozilla/readability"
import type { PdfPage } from "./pdf"

const BROWSER_HEADERS: Record<string, string> = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "de-DE,de;q=0.9,en-US;q=0.8,en;q=0.7",
  Referer: "https://www.google.com/",
}

export interface WebContent {
  title: string
  pages: PdfPage[]
}

export async function scrapeUrl(url: string): Promise<WebContent> {
  try {
    const result = await fetchWithReadability(url)
    if (result) return result
  } catch (err) {
    console.warn(`[web] Direct fetch failed for ${url}, trying Jina AI:`, err)
  }
  return fetchWithJina(url)
}

async function fetchWithReadability(url: string): Promise<WebContent> {
  const res = await fetch(url, {
    headers: BROWSER_HEADERS,
    signal: AbortSignal.timeout(15_000),
  })

  if (res.status === 403 || res.status === 429 || res.status === 503) {
    throw new Error(`Bot-protected: HTTP ${res.status}`)
  }
  if (!res.ok) throw new Error(`HTTP ${res.status}`)

  const html = await res.text()
  const dom = new JSDOM(html, { url })
  const reader = new Readability(dom.window.document)
  const article = reader.parse()

  if (!article?.textContent || article.textContent.trim().length < 200) {
    throw new Error("Content too short — likely bot detection or empty page")
  }

  return {
    title: article.title || new URL(url).hostname,
    pages: textToPages(article.textContent),
  }
}

async function fetchWithJina(url: string): Promise<WebContent> {
  const jinaBase = process.env.JINA_BASE_URL ?? "https://r.jina.ai"
  const jinaUrl = `${jinaBase}/${url}`
  const res = await fetch(jinaUrl, {
    headers: { Accept: "text/plain", "X-Return-Format": "text" },
    signal: AbortSignal.timeout(30_000),
  })

  if (!res.ok) throw new Error(`Jina AI fallback failed: HTTP ${res.status}`)

  const text = await res.text()
  if (text.trim().length < 50) throw new Error("Jina returned empty content")

  let title = new URL(url).hostname
  let content = text
  const titleMatch = text.match(/^Title:\s*(.+)/m)
  if (titleMatch) {
    title = titleMatch[1].trim()
    content = text.replace(/^Title:.*\n?/m, "").trim()
  }

  return { title, pages: textToPages(content) }
}

function textToPages(text: string): PdfPage[] {
  const paragraphs = text
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter((p) => p.length > 10)

  if (paragraphs.length === 0) return [{ text, pageNumber: 1 }]
  return paragraphs.map((p, i) => ({ text: p, pageNumber: i + 1 }))
}
