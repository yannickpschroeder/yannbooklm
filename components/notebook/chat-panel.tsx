"use client"

import { useState, useRef, useEffect } from "react"
import { useChat } from "@ai-sdk/react"
import { DefaultChatTransport, isTextUIPart } from "ai"
import { ArrowRight, X, ExternalLink, FileText, Globe, Loader2 } from "lucide-react"
import { FaYoutube } from "react-icons/fa"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import type { ChatMessage, CitationChunk } from "@/lib/types/chat"

// ─── Citation badge helpers ────────────────────────────────────────────────────

function CitationBadge({
  citation,
  onClick,
  active,
}: {
  citation: CitationChunk
  onClick: () => void
  active: boolean
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "inline-flex size-[18px] items-center justify-center rounded-full text-[10px] font-semibold leading-none transition-colors",
        active
          ? "bg-primary text-primary-foreground"
          : "bg-primary/10 text-primary hover:bg-primary/20",
      )}
      title={citation.sourceTitle}
    >
      {citation.index}
    </button>
  )
}

type BadgeGroup = {
  key: string
  badges: CitationChunk[]
}

function CitationBadgeGroup({
  group,
  activeCitation,
  onCiteClick,
}: {
  group: BadgeGroup
  activeCitation: CitationChunk | null
  onCiteClick: (c: CitationChunk) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const visible = expanded ? group.badges : group.badges.slice(0, 3)
  const hasMore = group.badges.length > 3

  return (
    <span className="inline-flex items-center gap-0.5 align-middle">
      {visible.map((c) => (
        <CitationBadge
          key={c.id}
          citation={c}
          active={activeCitation?.id === c.id}
          onClick={() => onCiteClick(c)}
        />
      ))}
      {hasMore && (
        <button
          onClick={() => setExpanded((p) => !p)}
          className="inline-flex h-[18px] items-center rounded-full bg-muted px-1.5 text-[10px] font-medium text-muted-foreground hover:bg-muted/80"
        >
          {expanded ? "⟨ ⟩" : "···"}
        </button>
      )}
    </span>
  )
}

function renderAssistantText(
  text: string,
  citations: CitationChunk[],
  activeCitation: CitationChunk | null,
  onCiteClick: (c: CitationChunk) => void,
) {
  // Split on sequences of consecutive [N] markers
  const segments = text.split(/(\[\d+\](?:\s*\[\d+\])*)/g)

  return segments.map((seg, i) => {
    const badgeMatches = [...seg.matchAll(/\[(\d+)\]/g)]
    if (badgeMatches.length === 0) {
      return <span key={i}>{seg}</span>
    }

    const badges = badgeMatches
      .map((m) => citations[parseInt(m[1]) - 1])
      .filter(Boolean) as CitationChunk[]

    if (badges.length === 0) return <span key={i}>{seg}</span>

    return (
      <CitationBadgeGroup
        key={i}
        group={{ key: `group-${i}`, badges }}
        activeCitation={activeCitation}
        onCiteClick={onCiteClick}
      />
    )
  })
}

// ─── Citation preview panel ───────────────────────────────────────────────────

function CitationPreview({
  citation,
  onClose,
}: {
  citation: CitationChunk
  onClose: () => void
}) {
  const sourceLink = (() => {
    if (citation.sourceType === "youtube" && citation.url && citation.positionStart != null) {
      const videoId = citation.url.match(/(?:youtube\.com\/watch\?.*v=|youtu\.be\/)([\w-]{11})/)?.[1]
      if (videoId) {
        return {
          href: `https://www.youtube.com/watch?v=${videoId}&t=${citation.positionStart}`,
          label: `${Math.floor(citation.positionStart / 60)}:${String(citation.positionStart % 60).padStart(2, "0")}`,
        }
      }
    }
    if (citation.sourceType === "pdf" && citation.pageNumber != null) {
      return { href: null, label: `Seite ${citation.pageNumber}` }
    }
    if (citation.url) {
      try {
        return { href: citation.url, label: new URL(citation.url).hostname }
      } catch {
        return null
      }
    }
    return null
  })()

  const SourceIcon =
    citation.sourceType === "youtube"
      ? FaYoutube
      : citation.sourceType === "url"
        ? Globe
        : FileText

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="flex h-12 shrink-0 items-center justify-between border-b px-3">
        <div className="flex min-w-0 items-center gap-2">
          <SourceIcon
            className={cn(
              "size-4 shrink-0",
              citation.sourceType === "youtube"
                ? "text-red-500"
                : citation.sourceType === "url"
                  ? "text-blue-400"
                  : "text-red-400",
            )}
          />
          <span className="truncate text-sm font-medium" title={citation.sourceTitle}>
            {citation.sourceTitle}
          </span>
        </div>
        <Button variant="ghost" size="icon" className="size-7 shrink-0" onClick={onClose}>
          <X className="size-4" />
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 text-sm leading-relaxed text-muted-foreground">
        {citation.content}
      </div>

      {sourceLink && (
        <div className="shrink-0 border-t px-4 py-3">
          {sourceLink.href ? (
            <a
              href={sourceLink.href}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-xs text-primary hover:underline"
            >
              <ExternalLink className="size-3" />
              {sourceLink.label}
            </a>
          ) : (
            <span className="text-xs text-muted-foreground">{sourceLink.label}</span>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Main ChatPanel ───────────────────────────────────────────────────────────

export function ChatPanel({
  notebookId,
  readySourceCount,
}: {
  notebookId: string
  readySourceCount: number
}) {
  const [input, setInput] = useState("")
  const [activeCitation, setActiveCitation] = useState<CitationChunk | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)

  const { messages, sendMessage, status } = useChat<ChatMessage>({
    transport: new DefaultChatTransport({
      api: "/api/chat",
      body: { notebookId },
    }),
  })

  const isStreaming = status === "streaming" || status === "submitted"

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const text = input.trim()
    if (!text || isStreaming || readySourceCount === 0) return
    setInput("")
    setActiveCitation(null)
    sendMessage({ text })
  }

  function handleCiteClick(c: CitationChunk) {
    setActiveCitation((prev) => (prev?.id === c.id ? null : c))
  }

  return (
    <div className="flex flex-1 overflow-hidden">
      {/* Chat column */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Messages area */}
        <div className="flex-1 overflow-y-auto px-4 py-6">
          {messages.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center gap-2 text-center">
              <p className="text-sm text-muted-foreground">
                {readySourceCount === 0
                  ? "Füge Quellen hinzu um den Chat zu starten"
                  : "Stelle eine Frage zu deinen Quellen"}
              </p>
            </div>
          ) : (
            <div className="mx-auto max-w-2xl space-y-6">
              {messages.map((msg) => {
                const textParts = msg.parts.filter(isTextUIPart)
                const citations = msg.metadata?.citations ?? []

                if (msg.role === "user") {
                  return (
                    <div key={msg.id} className="flex justify-end">
                      <div className="max-w-[80%] rounded-2xl rounded-tr-sm bg-primary px-4 py-2.5 text-sm text-primary-foreground">
                        {textParts.map((p) => p.text).join("")}
                      </div>
                    </div>
                  )
                }

                const fullText = textParts.map((p) => p.text).join("")

                return (
                  <div key={msg.id} className="flex flex-col gap-1">
                    <div className="text-sm leading-relaxed text-foreground">
                      {citations.length > 0
                        ? renderAssistantText(fullText, citations, activeCitation, handleCiteClick)
                        : fullText}
                    </div>
                    {citations.length > 0 && (
                      <div className="mt-1 flex flex-wrap items-center gap-1">
                        <span className="text-xs text-muted-foreground">Quellen:</span>
                        {[...new Map(citations.map((c) => [c.id, c])).values()].map((c) => (
                          <CitationBadge
                            key={c.id}
                            citation={c}
                            active={activeCitation?.id === c.id}
                            onClick={() => handleCiteClick(c)}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}

              {isStreaming &&
                messages[messages.length - 1]?.role !== "assistant" && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Loader2 className="size-4 animate-spin" />
                    <span className="text-sm">Denkt nach…</span>
                  </div>
                )}

              <div ref={bottomRef} />
            </div>
          )}
        </div>

        {/* Input area */}
        <div className="shrink-0 border-t p-4">
          <form onSubmit={handleSubmit}>
            <div className="flex items-center gap-2 rounded-xl border bg-muted/40 px-4 py-3">
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={
                  readySourceCount === 0 ? "Keine Quellen verfügbar…" : "Text eingeben…"
                }
                disabled={readySourceCount === 0 || isStreaming}
                className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50"
              />
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">
                  {readySourceCount} {readySourceCount === 1 ? "Quelle" : "Quellen"}
                </span>
                <Button
                  type="submit"
                  size="icon"
                  className="size-7 rounded-full"
                  disabled={!input.trim() || readySourceCount === 0 || isStreaming}
                >
                  {isStreaming ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <ArrowRight className="size-4" />
                  )}
                </Button>
              </div>
            </div>
            <p className="mt-2 text-center text-xs text-muted-foreground/60">
              YannBookLM kann Fehler machen. Überprüfe wichtige Informationen.
            </p>
          </form>
        </div>
      </div>

      {/* Citation preview panel */}
      {activeCitation && (
        <div className="w-80 shrink-0 border-l bg-background">
          <CitationPreview citation={activeCitation} onClose={() => setActiveCitation(null)} />
        </div>
      )}
    </div>
  )
}
