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

function deterministicEmbedding(content: string): number[] {
  // Deterministic fake embedding from content hash — allows unknown chunks through
  // without breaking ingestion. Results won't be semantically meaningful, but the
  // pipeline flow (ingest → chunk → embed → store → query) is fully exercised.
  const DIMS = 1024
  const emb = new Array<number>(DIMS).fill(0)
  for (let i = 0; i < content.length; i++) {
    emb[i % DIMS] += content.charCodeAt(i)
  }
  const norm = Math.sqrt(emb.reduce((s, v) => s + v * v, 0)) || 1
  return emb.map((v) => v / norm)
}

function lookupEmbedding(content: string): number[] {
  const fixture = allFixtures.find((f) => f.content === content)
  return fixture ? fixture.embedding : deterministicEmbedding(content)
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

  // ── Anthropic Claude API ──────────────────────────────────────────────────────
  http.post("https://api.anthropic.com/v1/messages", async ({ request }) => {
    const body = (await request.json()) as {
      stream?: boolean
      messages?: { content: string }[]
    }
    const isStreaming = body.stream === true

    // Detect summary requests (non-streaming, from generateSourceMeta)
    if (!isStreaming) {
      return HttpResponse.json({
        id: "msg_test_summary",
        type: "message",
        role: "assistant",
        content: [
          {
            type: "text",
            text: JSON.stringify({
              summary: "Dies ist ein **Reiseführer** über eine griechische Insel mit **Sehenswürdigkeiten**, **Kultur** und **praktischen Reisetipps**.",
              topics: ["Was sind die Sehenswürdigkeiten?", "Wie ist das Klima?", "Welche Strände gibt es?"],
            }),
          },
        ],
        model: "claude-sonnet-4-6",
        stop_reason: "end_turn",
        usage: { input_tokens: 100, output_tokens: 50 },
      })
    }

    // Streaming chat response — SSE format (ai-sdk/anthropic expects this)
    const encoder = new TextEncoder()
    const stream = new ReadableStream({
      start(controller) {
        const events = [
          `event: message_start\ndata: ${JSON.stringify({ type: "message_start", message: { id: "msg_test", type: "message", role: "assistant", content: [], model: "claude-sonnet-4-6", stop_reason: null, usage: { input_tokens: 100, output_tokens: 0 } } })}\n\n`,
          `event: content_block_start\ndata: ${JSON.stringify({ type: "content_block_start", index: 0, content_block: { type: "text", text: "" } })}\n\n`,
          `event: content_block_delta\ndata: ${JSON.stringify({ type: "content_block_delta", index: 0, delta: { type: "text_delta", text: "Kreta hat viele Sehenswürdigkeiten. Der Palast von Knossos ist besonders bekannt. [1] Auch die Samaria-Schlucht ist sehr beeindruckend. [1]" } })}\n\n`,
          `event: content_block_stop\ndata: ${JSON.stringify({ type: "content_block_stop", index: 0 })}\n\n`,
          `event: message_delta\ndata: ${JSON.stringify({ type: "message_delta", delta: { stop_reason: "end_turn", stop_sequence: null }, usage: { output_tokens: 30 } })}\n\n`,
          `event: message_stop\ndata: ${JSON.stringify({ type: "message_stop" })}\n\n`,
        ]
        for (const event of events) {
          controller.enqueue(encoder.encode(event))
        }
        controller.close()
      },
    })

    return new HttpResponse(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
      },
    })
  }),
]
