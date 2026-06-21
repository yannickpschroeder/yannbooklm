import { auth } from "@/lib/auth"
import { NextResponse, after } from "next/server"
import { anthropic } from "@ai-sdk/anthropic"
import { generateObject } from "ai"
import { z } from "zod"
import { db } from "@/db"
import { studioOutputs, notebooks, parentChunks, sources } from "@/db/schema"
import { and, eq } from "drizzle-orm"
import { polly } from "@/lib/polly/client"
import { s3, S3_BUCKET } from "@/lib/s3/client"
import { SynthesizeSpeechCommand, Engine, VoiceId, OutputFormat } from "@aws-sdk/client-polly"
import { PutObjectCommand } from "@aws-sdk/client-s3"

export const maxDuration = 300

// ─── Voices ───────────────────────────────────────────────────────────────────

const VOICE_A: VoiceId = "Vicki"
const VOICE_B: VoiceId = "Daniel"

// ─── Types ────────────────────────────────────────────────────────────────────

export type AudioFormat = "detailed-analysis" | "summary" | "critical-review" | "discussion"
export type AudioLength = "short" | "standard"

const ScriptSchema = z.object({
  turns: z.array(
    z.object({
      speaker: z.enum(["A", "B"]),
      text: z.string().min(1),
    })
  ).min(4).max(30),
})

export type AudioTurn = { speaker: "A" | "B"; text: string }
export type AudioData = {
  turns: AudioTurn[]
  s3Key: string
  usedSources: { id: string; title: string; type: string }[]
  format?: AudioFormat
  language?: string
  length?: AudioLength
  focusTopic?: string
}

// ─── Prompt builder ───────────────────────────────────────────────────────────

function buildPrompt(
  content: string,
  format: AudioFormat,
  language: string,
  length: AudioLength,
  focusTopic?: string
): string {
  const wordCount = length === "short" ? "400–500 Wörter (ca. 1,5 Minuten)" : "800–1000 Wörter (ca. 3 Minuten)"

  const formatInstructions: Record<AudioFormat, string> = {
    "detailed-analysis": "eine lebhafte Unterhaltung, bei der die Themen in den Quellen analysiert und miteinander in Zusammenhang gebracht werden",
    "summary": "eine kompakte Übersicht, die die wichtigsten Informationen aus den Quellen schnell vermittelt",
    "critical-review": "eine sachkundige, konstruktive Bewertung der Quellen, die Stärken und Schwächen benennt",
    "discussion": "eine aufschlussreiche Diskussion, die die Quellen aus verschiedenen Perspektiven beleuchtet",
  }

  const focusInstruction = focusTopic
    ? `\nSchwerpunkt: ${focusTopic}`
    : ""

  return `Du bist zwei Podcast-Hosts (Host A und Host B). Erstelle ein Dialogskript im Stil von: ${formatInstructions[format]}.

Regeln:
- Gesamtlänge: ${wordCount}
- Abwechselnde Redner: mindestens 4, maximal 30 Turns
- Jeder Turn: vollständige Sätze, natürlich gesprochen
- Kein Intro/Outro wie "Willkommen" oder "Tschüss"
- Schreibe ausschließlich auf ${language}
- Keine Nennung von Hostnamen in den Turns selbst${focusInstruction}

Quellen:
${content}`
}

// ─── Source fetcher ───────────────────────────────────────────────────────────

async function getSourceContent(notebookId: string) {
  const rows = await db
    .select({
      content: parentChunks.content,
      id: sources.id,
      title: sources.title,
      type: sources.type,
    })
    .from(parentChunks)
    .innerJoin(sources, eq(sources.id, parentChunks.sourceId))
    .where(and(eq(sources.notebookId, notebookId), eq(sources.status, "ready"), eq(sources.enabled, true)))
    .limit(60)

  if (rows.length === 0) return { content: "", usedSources: [] }

  const seen = new Set<string>()
  const usedSources: { id: string; title: string; type: string }[] = []
  for (const r of rows) {
    if (!seen.has(r.id)) {
      seen.add(r.id)
      usedSources.push({ id: r.id, title: r.title, type: r.type })
    }
  }

  return { content: rows.map((c) => `[${c.title}]\n${c.content}`).join("\n\n---\n\n"), usedSources }
}

// ─── TTS helper ───────────────────────────────────────────────────────────────

async function synthesizeTurn(text: string, voice: VoiceId): Promise<Buffer> {
  const { AudioStream } = await polly.send(
    new SynthesizeSpeechCommand({
      Text: text,
      VoiceId: voice,
      Engine: Engine.NEURAL,
      OutputFormat: OutputFormat.MP3,
    })
  )

  if (!AudioStream) throw new Error("No audio stream from Polly")

  const chunks: Uint8Array[] = []
  for await (const chunk of AudioStream as AsyncIterable<Uint8Array>) {
    chunks.push(chunk)
  }
  return Buffer.concat(chunks)
}

// ─── Background job ───────────────────────────────────────────────────────────

async function runAudioGeneration(
  outputId: string,
  notebookId: string,
  format: AudioFormat,
  language: string,
  length: AudioLength,
  focusTopic?: string
) {
  try {
    const { content, usedSources } = await getSourceContent(notebookId)
    if (!content) {
      await db.update(studioOutputs).set({ status: "error" }).where(eq(studioOutputs.id, outputId))
      return
    }

    const { object } = await generateObject({
      model: anthropic("claude-sonnet-4-6"),
      schema: ScriptSchema,
      prompt: buildPrompt(content, format, language, length, focusTopic),
    })

    const buffers = await Promise.all(
      object.turns.map((turn) =>
        synthesizeTurn(turn.text, turn.speaker === "A" ? VOICE_A : VOICE_B)
      )
    )
    const combined = Buffer.concat(buffers)

    const s3Key = `audio/${outputId}/full.mp3`
    await s3.send(
      new PutObjectCommand({
        Bucket: S3_BUCKET,
        Key: s3Key,
        Body: combined,
        ContentType: "audio/mpeg",
      })
    )

    const data: AudioData = { turns: object.turns, s3Key, usedSources, format, language, length, focusTopic }

    await db
      .update(studioOutputs)
      .set({ status: "ready", title: "Audio Overview", data, createdAt: new Date() })
      .where(eq(studioOutputs.id, outputId))
  } catch (err) {
    console.error("[audio] generation failed:", err)
    await db.update(studioOutputs).set({ status: "error" }).where(eq(studioOutputs.id, outputId))
  }
}

// ─── Route ────────────────────────────────────────────────────────────────────

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const {
    notebookId,
    outputId,
    format = "detailed-analysis",
    language = "Deutsch",
    length = "standard",
    focusTopic,
  } = (await req.json()) as {
    notebookId: string
    outputId?: string
    format?: AudioFormat
    language?: string
    length?: AudioLength
    focusTopic?: string
  }

  const [notebook] = await db
    .select({ id: notebooks.id })
    .from(notebooks)
    .where(and(eq(notebooks.id, notebookId), eq(notebooks.userId, session.user.id)))
    .limit(1)

  if (!notebook) return NextResponse.json({ error: "Notebook not found" }, { status: 404 })

  const [hasSource] = await db
    .select({ id: sources.id })
    .from(sources)
    .where(and(eq(sources.notebookId, notebookId), eq(sources.status, "ready"), eq(sources.enabled, true)))
    .limit(1)

  if (!hasSource) return NextResponse.json({ error: "NO_SOURCES" }, { status: 422 })

  let jobOutputId: string

  if (outputId) {
    await db
      .update(studioOutputs)
      .set({ status: "generating", data: null, createdAt: new Date() })
      .where(and(eq(studioOutputs.id, outputId), eq(studioOutputs.notebookId, notebookId)))
    jobOutputId = outputId
  } else {
    const [created] = await db
      .insert(studioOutputs)
      .values({ notebookId, type: "audio", status: "generating" })
      .returning()
    jobOutputId = created.id
  }

  after(() => runAudioGeneration(jobOutputId, notebookId, format, language, length, focusTopic))

  return NextResponse.json({ outputId: jobOutputId }, { status: 202 })
}
