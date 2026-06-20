"use client"

import { useState, useRef, useEffect } from "react"
import { useChat } from "@ai-sdk/react"
import { DefaultChatTransport, isTextUIPart } from "ai"
import { ArrowRight, X, ExternalLink, FileText, Globe, Loader2 } from "lucide-react"
import { FaYoutube } from "react-icons/fa"
import Markdown from "react-markdown"
import remarkGfm from "remark-gfm"
import rehypeRaw from "rehype-raw"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import type { ChatMessage, CitationChunk } from "@/lib/types/chat"

// ─── Citation badge ────────────────────────────────────────────────────────────

function CitationBadge({
  citation,
  active,
  onClick,
}: {
  citation: CitationChunk
  active: boolean
  onClick: () => void
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

// ─── Markdown with inline citation badges ──────────────────────────────────────

function AssistantContent({
  text,
  citations,
  activeCitation,
  onCiteClick,
}: {
  text: string
  citations: CitationChunk[]
  activeCitation: CitationChunk | null
  onCiteClick: (c: CitationChunk) => void
}) {
  // Only inject citation markup when we have metadata to back it up;
  // otherwise [N] stays as plain text so it doesn't silently disappear.
  const processed =
    citations.length > 0
      ? text.replace(/\[(\d+)\]/g, '<cite data-idx="$1"></cite>')
      : text

  return (
    <Markdown
      remarkPlugins={[remarkGfm]}
      rehypePlugins={[rehypeRaw]}
      components={{
        // Inline citation badge
        cite(props) {
          const { node: _node, ...rest } = props
          const idx = (rest as Record<string, string>)["data-idx"]
          if (!idx) return null
          const citation = citations[parseInt(idx) - 1]
          if (!citation) return null
          return (
            <CitationBadge
              citation={citation}
              active={activeCitation?.id === citation.id}
              onClick={() => onCiteClick(citation)}
            />
          )
        },
        // Markdown element styling
        p(props) {
          const { node: _node, children, ...rest } = props
          return <p className="mb-3 last:mb-0" {...rest}>{children}</p>
        },
        ul(props) {
          const { node: _node, children, ...rest } = props
          return <ul className="mb-3 list-disc space-y-1 pl-5 last:mb-0" {...rest}>{children}</ul>
        },
        ol(props) {
          const { node: _node, children, ...rest } = props
          return <ol className="mb-3 list-decimal space-y-1 pl-5 last:mb-0" {...rest}>{children}</ol>
        },
        li(props) {
          const { node: _node, children, ...rest } = props
          return <li {...rest}>{children}</li>
        },
        h1(props) {
          const { node: _node, children, ...rest } = props
          return <h1 className="mb-2 mt-4 text-base font-semibold first:mt-0" {...rest}>{children}</h1>
        },
        h2(props) {
          const { node: _node, children, ...rest } = props
          return <h2 className="mb-2 mt-4 text-sm font-semibold first:mt-0" {...rest}>{children}</h2>
        },
        h3(props) {
          const { node: _node, children, ...rest } = props
          return <h3 className="mb-1 mt-3 text-sm font-medium first:mt-0" {...rest}>{children}</h3>
        },
        blockquote(props) {
          const { node: _node, children, ...rest } = props
          return (
            <blockquote
              className="mb-3 border-l-2 border-muted-foreground/30 pl-4 text-muted-foreground last:mb-0"
              {...rest}
            >
              {children}
            </blockquote>
          )
        },
        code(props) {
          const { node: _node, children, className, ...rest } = props
          const isBlock = Boolean(className?.startsWith("language-"))
          if (isBlock) {
            return (
              <code className="block overflow-x-auto rounded-md bg-muted px-3 py-2 text-xs" {...rest}>
                {children}
              </code>
            )
          }
          return (
            <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs" {...rest}>{children}</code>
          )
        },
        pre(props) {
          const { node: _node, children, ...rest } = props
          return <pre className="mb-3 last:mb-0" {...rest}>{children}</pre>
        },
        strong(props) {
          const { node: _node, children, ...rest } = props
          return <strong className="font-semibold" {...rest}>{children}</strong>
        },
        em(props) {
          const { node: _node, children, ...rest } = props
          return <em className="italic" {...rest}>{children}</em>
        },
        a(props) {
          const { node: _node, children, href, ...rest } = props
          return (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary underline underline-offset-2 hover:no-underline"
              {...rest}
            >
              {children}
            </a>
          )
        },
        hr(props) {
          const { node: _node, ...rest } = props
          return <hr className="my-4 border-border" {...rest} />
        },
      }}
    >
      {processed}
    </Markdown>
  )
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
        const m = Math.floor(citation.positionStart / 60)
        const s = String(citation.positionStart % 60).padStart(2, "0")
        return {
          href: `https://www.youtube.com/watch?v=${videoId}&t=${citation.positionStart}`,
          label: `${m}:${s}`,
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
    citation.sourceType === "youtube" ? FaYoutube : citation.sourceType === "url" ? Globe : FileText

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
  initialMessages,
}: {
  notebookId: string
  readySourceCount: number
  initialMessages?: ChatMessage[]
}) {
  const [input, setInput] = useState("")
  const [activeCitation, setActiveCitation] = useState<CitationChunk | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)

  const { messages, sendMessage, status } = useChat<ChatMessage>({
    transport: new DefaultChatTransport({
      api: "/api/chat",
      body: { notebookId },
    }),
    messages: initialMessages,
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
        {/* Messages */}
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
                const fullText = textParts.map((p) => p.text).join("")

                if (msg.role === "user") {
                  return (
                    <div key={msg.id} className="flex justify-end">
                      <div className="max-w-[80%] rounded-2xl rounded-tr-sm bg-primary px-4 py-2.5 text-sm text-primary-foreground">
                        {fullText}
                      </div>
                    </div>
                  )
                }

                const uniqueCitations = [
                  ...new Map(citations.map((c) => [c.id, c])).values(),
                ]

                return (
                  <div key={msg.id} className="flex flex-col gap-2">
                    <div className="text-sm leading-relaxed">
                      <AssistantContent
                        text={fullText}
                        citations={citations}
                        activeCitation={activeCitation}
                        onCiteClick={handleCiteClick}
                      />
                    </div>
                    {uniqueCitations.length > 0 && (
                      <div className="flex flex-wrap items-center gap-1">
                        <span className="text-xs text-muted-foreground">Quellen:</span>
                        {uniqueCitations.map((c) => (
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

              {isStreaming && messages[messages.length - 1]?.role !== "assistant" && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Loader2 className="size-4 animate-spin" />
                  <span className="text-sm">Denkt nach…</span>
                </div>
              )}

              <div ref={bottomRef} />
            </div>
          )}
        </div>

        {/* Input */}
        <div className="shrink-0 border-t p-4">
          <form onSubmit={handleSubmit}>
            <div className="flex items-center gap-2 rounded-xl border bg-muted/40 px-4 py-3">
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={readySourceCount === 0 ? "Keine Quellen verfügbar…" : "Text eingeben…"}
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

      {/* Citation preview */}
      {activeCitation && (
        <div className="w-80 shrink-0 border-l bg-background">
          <CitationPreview citation={activeCitation} onClose={() => setActiveCitation(null)} />
        </div>
      )}
    </div>
  )
}
