"use client"

import { useState, useEffect, useRef } from "react"
import { useTranslations } from "next-intl"
import { useChat } from "@ai-sdk/react"
import { DefaultChatTransport, isTextUIPart } from "ai"
import { BookOpen, FileText, Globe, Loader2, ChevronLeft } from "lucide-react"
import { FaYoutube, FaMicrophone, FaProjectDiagram, FaTable, FaQuestionCircle, FaSlideshare } from "react-icons/fa"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { onSourceView } from "@/lib/source-view-event"
import { AssistantContent, CitationBadgeRow } from "@/components/notebook/chat-citations"
import { SourceDetailPanel } from "@/components/notebook/source-detail-panel"
import { QuizView } from "@/components/notebook/quiz-view"
import type { Source, StudioOutput } from "@/db/schema"
import type { ChatMessage, CitationChunk } from "@/lib/types/chat"
import type { QuizData } from "@/components/notebook/quiz-view"

function SourceTypeIcon({ type }: { type: Source["type"] }) {
  switch (type) {
    case "youtube": return <FaYoutube className="size-4 shrink-0 text-red-500" />
    case "url":     return <Globe      className="size-4 shrink-0 text-blue-400" />
    default:        return <FileText   className="size-4 shrink-0 text-muted-foreground" />
  }
}

function StudioTypeIcon({ type }: { type: StudioOutput["type"] }) {
  switch (type) {
    case "audio":     return <FaMicrophone     className="size-4 shrink-0 text-violet-400" />
    case "mindmap":   return <FaProjectDiagram className="size-4 shrink-0 text-emerald-400" />
    case "slidedeck": return <FaSlideshare     className="size-4 shrink-0 text-orange-400" />
    case "datatable": return <FaTable          className="size-4 shrink-0 text-sky-400" />
    case "quiz":      return <FaQuestionCircle className="size-4 shrink-0 text-amber-400" />
  }
}

function MindmapView({ data }: { data: Record<string, unknown> }) {
  return (
    <pre className="p-4 text-xs whitespace-pre-wrap text-foreground/80 leading-relaxed">
      {JSON.stringify(data, null, 2)}
    </pre>
  )
}

function DatatableView({ data }: { data: Record<string, unknown> }) {
  const t = useTranslations("share")
  const rows = Array.isArray(data.rows) ? (data.rows as Record<string, unknown>[]) : []
  const headers = rows.length > 0 ? Object.keys(rows[0]) : []

  if (rows.length === 0) return <div className="p-4 text-sm text-muted-foreground">{t("noData")}</div>

  return (
    <div className="overflow-auto p-2">
      <table className="w-full text-xs border-collapse">
        <thead>
          <tr>
            {headers.map((h) => (
              <th key={h} className="border border-border bg-muted px-2 py-1 text-left font-medium">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i}>
              {headers.map((h) => (
                <td key={h} className="border border-border px-2 py-1">{String(row[h] ?? "")}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function StudioSidebar({
  outputs,
  activeOutput,
  onSelect,
  onClose,
}: {
  outputs: StudioOutput[]
  activeOutput: StudioOutput | null
  onSelect: (o: StudioOutput) => void
  onClose: () => void
}) {
  const tHeader = useTranslations("header")
  const tShare = useTranslations("share")
  return (
    <aside
      className={cn(
        "flex shrink-0 flex-col border-l bg-background transition-all duration-200",
        activeOutput ? "flex-1" : "w-72"
      )}
    >
      <div className="flex h-10 shrink-0 items-center gap-1 border-b px-2">
        {activeOutput && (
          <Button variant="ghost" size="icon" className="size-7 shrink-0" onClick={onClose}>
            <ChevronLeft className="size-4" />
          </Button>
        )}
        <span className="flex items-center gap-2 text-xs font-medium px-1">
          {activeOutput ? (
            <>
              <StudioTypeIcon type={activeOutput.type} />
              {activeOutput.title ?? activeOutput.type}
            </>
          ) : (
            tHeader("sharedStudio")
          )}
        </span>
      </div>

      {activeOutput ? (
        <div className="flex-1 overflow-y-auto">
          {activeOutput.type === "quiz" && activeOutput.data ? (
            <QuizView
              key={activeOutput.id}
              data={activeOutput.data as QuizData}
              outputId={activeOutput.id}
              onNewQuizFromTopic={() => {}}
              readOnly
            />
          ) : activeOutput.type === "mindmap" && activeOutput.data ? (
            <MindmapView data={activeOutput.data as Record<string, unknown>} />
          ) : activeOutput.type === "datatable" && activeOutput.data ? (
            <DatatableView data={activeOutput.data as Record<string, unknown>} />
          ) : (
            <div className="p-4 text-sm text-muted-foreground">{tShare("noPreview")}</div>
          )}
        </div>
      ) : (
        <ul className="flex-1 overflow-y-auto p-2 space-y-0.5">
          {outputs.map((output) => (
            <li key={output.id}>
              <button
                onClick={() => onSelect(output)}
                className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm transition-colors hover:bg-muted"
              >
                <StudioTypeIcon type={output.type} />
                <span className="truncate">{output.title ?? output.type}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </aside>
  )
}

export function SharedNotebookClient({
  token,
  notebookName,
  sources,
  studioOutputs,
  includeStudio,
}: {
  token: string
  notebookName: string
  sources: Pick<Source, "id" | "title" | "type" | "status">[]
  studioOutputs: StudioOutput[]
  includeStudio: boolean
}) {
  const tHeader = useTranslations("header")
  const tChat = useTranslations("chat")
  const tShare = useTranslations("share")
  const [input, setInput] = useState("")
  const [activeCitation, setActiveCitation] = useState<CitationChunk | null>(null)
  const [activeChunk, setActiveChunk] = useState<CitationChunk | null>(null)
  const [loadingSourceId, setLoadingSourceId] = useState<string | null>(null)
  const [activeOutput, setActiveOutput] = useState<StudioOutput | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  const { messages, sendMessage, status } = useChat<ChatMessage>({
    transport: new DefaultChatTransport({ api: `/api/share/notebook/${token}/chat` }),
  })

  const isStreaming = status === "streaming" || status === "submitted"

  useEffect(() => {
    return onSourceView((chunk) => {
      if (chunk) setActiveChunk(chunk)
    })
  }, [])

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages.length, isStreaming])

  async function handleSourceClick(src: Pick<Source, "id" | "title" | "type" | "status">) {
    if (src.status !== "ready") return
    setLoadingSourceId(src.id)
    try {
      const res = await fetch(`/api/share/notebook/${token}/sources/${src.id}/preview`)
      if (!res.ok) throw new Error()
      const chunk = (await res.json()) as CitationChunk
      setActiveChunk(chunk)
    } catch {
      /* noop */
    } finally {
      setLoadingSourceId(null)
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const text = input.trim()
    if (!text || isStreaming) return
    setInput("")
    sendMessage({ text })
  }

  function handleCiteClick(c: CitationChunk) {
    setActiveCitation((prev) => (prev?.id === c.id ? null : c))
    setActiveChunk(c)
  }

  const showStudio = includeStudio && studioOutputs.length > 0

  return (
    <div className="flex h-screen flex-col bg-background">
      <header className="flex h-12 shrink-0 items-center border-b px-4 gap-3">
        <BookOpen className="size-4 text-muted-foreground" />
        <span className="text-sm font-semibold">{notebookName}</span>
        <span className="text-xs text-muted-foreground">· YannBookLM</span>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Left sidebar: sources (list ↔ detail) */}
        <aside className="w-80 shrink-0 flex flex-col border-r overflow-hidden">
          {activeChunk ? (
            <SourceDetailPanel
              chunk={activeChunk}
              onClose={() => setActiveChunk(null)}
              onTopicClick={(topic) => setInput(topic)}
            />
          ) : (
            <div className="flex flex-col overflow-y-auto flex-1">
              <div className="flex h-10 shrink-0 items-center border-b px-3">
                <span className="text-xs font-medium text-muted-foreground">{tHeader("sharedSources")}</span>
              </div>
              {sources.length === 0 ? (
                <p className="text-xs text-muted-foreground p-3">{tShare("noSources")}</p>
              ) : (
                <ul className="p-2 space-y-0.5">
                  {sources.map((src) => (
                    <li key={src.id}>
                      <button
                        disabled={src.status !== "ready" || loadingSourceId !== null}
                        onClick={() => handleSourceClick(src)}
                        className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm transition-colors hover:bg-muted disabled:cursor-default disabled:opacity-50"
                      >
                        {loadingSourceId === src.id
                          ? <Loader2 className="size-4 shrink-0 animate-spin text-muted-foreground" />
                          : <SourceTypeIcon type={src.type} />}
                        <span className="truncate">{src.title}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </aside>

        {/* Chat panel */}
        <div className="flex flex-1 flex-col overflow-hidden">
          <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-6">
            {messages.length === 0 ? (
              <div className="flex h-full items-center justify-center">
                <p className="text-sm text-muted-foreground">{tHeader("sharedChatHint")}</p>
              </div>
            ) : (
              <div className="mx-auto max-w-2xl space-y-6">
                {messages.map((msg) => {
                  const text = msg.parts.filter(isTextUIPart).map((p) => p.text).join("")
                  const citations: CitationChunk[] = msg.metadata?.citations ?? []

                  if (msg.role === "user") {
                    return (
                      <div key={msg.id} className="flex justify-end">
                        <div className="bg-primary text-primary-foreground max-w-[80%] rounded-2xl rounded-tr-sm px-4 py-2.5 text-sm">
                          {text}
                        </div>
                      </div>
                    )
                  }

                  const uniqueCitations = [...new Map(citations.map((c) => [c.id, c])).values()]

                  return (
                    <div key={msg.id} className="text-sm leading-relaxed space-y-2">
                      <AssistantContent
                        text={text}
                        citations={citations}
                        activeCitation={activeCitation}
                        onCiteClick={handleCiteClick}
                      />
                      {uniqueCitations.length > 0 && (
                        <CitationBadgeRow
                          citations={uniqueCitations}
                          activeCitation={activeCitation}
                          onCiteClick={handleCiteClick}
                        />
                      )}
                    </div>
                  )
                })}
                {isStreaming && messages[messages.length - 1]?.role !== "assistant" && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Loader2 className="size-4 animate-spin" />
                    <span className="text-sm">{tChat("thinking")}</span>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="shrink-0 border-t p-4">
            <form onSubmit={handleSubmit}>
              <div className="bg-muted/40 flex items-center gap-2 rounded-xl border px-4 py-3">
                <input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder={tShare("chatPlaceholder")}
                  disabled={isStreaming}
                  className="placeholder:text-muted-foreground flex-1 bg-transparent text-sm outline-none disabled:cursor-not-allowed disabled:opacity-50"
                />
                <Button
                  type="submit"
                  size="icon"
                  className="size-7 rounded-full"
                  disabled={!input.trim() || isStreaming}
                >
                  {isStreaming
                    ? <Loader2 className="size-3.5 animate-spin" />
                    : <span className="text-xs">→</span>}
                </Button>
              </div>
            </form>
          </div>
        </div>

        {/* Right sidebar: studio outputs */}
        {showStudio && (
          <StudioSidebar
            outputs={studioOutputs}
            activeOutput={activeOutput}
            onSelect={setActiveOutput}
            onClose={() => setActiveOutput(null)}
          />
        )}
      </div>
    </div>
  )
}
