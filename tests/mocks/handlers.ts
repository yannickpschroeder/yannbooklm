import { http, HttpResponse } from "msw"
import fs from "fs"
import path from "path"
import kretaEmbeddings from "../fixtures/kreta-embeddings.json"
import korfuEmbeddings from "../fixtures/korfu-embeddings.json"
import youtubeTestEmbeddings from "../fixtures/youtube-test-embeddings.json"

const korfuHtml = fs.readFileSync(
  path.join(process.cwd(), "tests/fixtures/korfu.html"),
  "utf-8"
)

// Fake transcript XML (srv3 format, t/d in ms)
const YOUTUBE_TEST_VIDEO_ID = "dQw4w9WgXcQ"
const YOUTUBE_TEST_TITLE = "Kreta Reiseführer"
const YOUTUBE_TRANSCRIPT_URL = "https://www.youtube.com/api/timedtext?test=yt-e2e"
const YOUTUBE_TRANSCRIPT_XML = `<?xml version="1.0" encoding="utf-8" ?>
<timedtext>
<body>
<p t="0" d="4000">Kreta ist die größte Insel Griechenlands.</p>
<p t="4000" d="3500">Sie liegt im südlichen Mittelmeer.</p>
<p t="7500" d="5000">Die Insel ist bekannt für ihre langen Sandstrände und das türkisfarbene Wasser.</p>
<p t="12500" d="5000">Das Klima ist mediterran mit heißen, trockenen Sommern und milden Wintern.</p>
<p t="17500" d="5500">Kreta hat eine lange Geschichte, die bis in die minoische Bronzezeit zurückreicht.</p>
<p t="23000" d="5500">Der Palast von Knossos ist eines der bedeutendsten archäologischen Denkmäler der Insel.</p>
<p t="28500" d="4500">Die Hauptstadt Heraklion beherbergt das größte Museum Kretas.</p>
<p t="33000" d="5000">Wanderer schätzen die Samaria-Schlucht, eine der längsten Schluchten Europas.</p>
</body>
</timedtext>`

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
  ...parseFixtures(youtubeTestEmbeddings as RawFixture[]),
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

  // ── YouTube InnerTube API ─────────────────────────────────────────────────────
  http.post("https://www.youtube.com/youtubei/v1/player*", async ({ request }) => {
    const body = (await request.json()) as { videoId?: string }
    if (body.videoId !== YOUTUBE_TEST_VIDEO_ID) {
      return HttpResponse.json({ error: "Unknown test video" }, { status: 404 })
    }
    return HttpResponse.json({
      captions: {
        playerCaptionsTracklistRenderer: {
          captionTracks: [{ baseUrl: YOUTUBE_TRANSCRIPT_URL, languageCode: "de" }],
        },
      },
    })
  }),

  // ── YouTube transcript XML ────────────────────────────────────────────────────
  http.get("https://www.youtube.com/api/timedtext*", () =>
    new HttpResponse(YOUTUBE_TRANSCRIPT_XML, { headers: { "Content-Type": "text/xml; charset=utf-8" } })
  ),

  // ── YouTube oEmbed ────────────────────────────────────────────────────────────
  http.get("https://www.youtube.com/oembed*", () =>
    HttpResponse.json({ title: YOUTUBE_TEST_TITLE })
  ),

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
