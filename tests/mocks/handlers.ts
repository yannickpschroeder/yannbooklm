import { http, HttpResponse } from "msw"
import fs from "fs"
import path from "path"
import kretaEmbeddings from "../fixtures/kreta-embeddings.json"
import korfuEmbeddings from "../fixtures/korfu-embeddings.json"

const korfuHtml = fs.readFileSync(
  path.join(__dirname, "../fixtures/korfu.html"),
  "utf-8"
)

type RawFixture = { content: string; embedding: string | number[] }
type EmbeddingFixture = { content: string; embedding: number[] }

function parseFixtures(raw: RawFixture[]): EmbeddingFixture[] {
  return raw.map((r) => ({
    content: r.content,
    embedding: typeof r.embedding === "string" ? JSON.parse(r.embedding) : r.embedding,
  }))
}

const allFixtures: EmbeddingFixture[] = [
  ...parseFixtures(kretaEmbeddings as RawFixture[]),
  ...parseFixtures(korfuEmbeddings as RawFixture[]),
]

function lookupEmbedding(content: string): number[] {
  const fixture = allFixtures.find((f) => f.content === content)
  if (!fixture) {
    throw new Error(
      `[MSW] No fixture embedding found for content (first 80 chars): "${content.slice(0, 80)}…"\n` +
        `Fixtures are out of sync — re-export embeddings from the database.`
    )
  }
  return fixture.embedding
}

export const handlers = [
  // ── Voyage AI ────────────────────────────────────────────────────────────────
  http.post("https://api.voyageai.com/v1/embeddings", async ({ request }) => {
    const body = (await request.json()) as { input: string[] }
    const embeddings = body.input.map((text) => lookupEmbedding(text))
    return HttpResponse.json({
      data: embeddings.map((embedding, index) => ({ embedding, index, object: "embedding" })),
      model: "voyage-4-lite",
      usage: { total_tokens: 0 },
    })
  }),

  // ── Korfu test page ───────────────────────────────────────────────────────────
  http.get(
    "https://www.griechenland-urlaub.net/sehenswuerdigkeiten/insel_korfu.html",
    () => new HttpResponse(korfuHtml, { headers: { "Content-Type": "text/html; charset=utf-8" } })
  ),

  // ── Jina AI (URL fallback) — should not be called in tests ───────────────────
  http.get("https://r.jina.ai/*", () =>
    HttpResponse.json({ error: "Jina AI should not be called in tests" }, { status: 500 })
  ),
]
