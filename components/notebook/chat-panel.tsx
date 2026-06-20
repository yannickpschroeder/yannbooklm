"use client"

import { useState, useRef, useEffect } from "react"
import { useChat } from "@ai-sdk/react"
import { DefaultChatTransport, isTextUIPart } from "ai"
import { ArrowRight, FileText, Globe, Loader2, ExternalLink } from "lucide-react"
import { FaYoutube } from "react-icons/fa"
import Markdown from "react-markdown"
import remarkGfm from "remark-gfm"
import rehypeRaw from "rehype-raw"
import { Button } from "@/components/ui/button"
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card"
import { Separator } from "@/components/ui/separator"
import { cn } from "@/lib/utils"
import { openSourceView } from "@/lib/source-view-event"
import type { ChatMessage, CitationChunk } from "@/lib/types/chat"

// ─── Source icon helper ────────────────────────────────────────────────────────

function SourceIcon({ type, className }: { type: string; className?: string }) {
  if (type === "youtube") return <FaYoutube className={cn("text-red-500", className)} />
  if (type === "url") return <Globe className={cn("text-blue-400", className)} />
  return <FileText className={cn("text-red-400", className)} />
}

// ─── Citation hover card ───────────────────────────────────────────────────────

function CitationHoverContent({ citation }: { citation: CitationChunk }) {
  return (
    <div className="bg-popover flex w-72 flex-col overflow-hidden rounded-md border shadow-md">
      {/* Section 1: Source name */}
      <div className="flex items-center gap-2 px-3 py-2.5">
        <SourceIcon type={citation.sourceType} className="size-4 shrink-0" />
        <span className="truncate text-sm font-medium">{citation.sourceTitle}</span>
      </div>

      <Separator />

      {/* Section 2: Content */}
      <div className="text-muted-foreground max-h-56 overflow-y-auto px-3 py-2.5 text-xs leading-relaxed">
        <Markdown remarkPlugins={[remarkGfm]}>{citation.content}</Markdown>
      </div>

      <Separator />

      {/* Section 3: Quelle anzeigen */}
      <button
        className="text-primary flex items-center gap-1.5 px-3 py-2 text-xs hover:underline"
        onClick={() => openSourceView(citation)}
      >
        <ExternalLink className="size-3" />
        Quelle anzeigen
      </button>
    </div>
  )
}

// ─── Shared expand/collapse logic ─────────────────────────────────────────────

const VISIBLE_THRESHOLD = 2

function ExpandCollapseButton({
  expanded,
  onToggle,
  inline,
}: {
  expanded: boolean
  onToggle: () => void
  inline?: boolean
}) {
  return (
    <button
      onClick={onToggle}
      className={cn(
        "bg-muted text-muted-foreground hover:bg-muted/80 items-center rounded-full text-[10px] font-medium",
        inline ? "inline-flex h-[18px] px-1.5 align-middle" : "inline-flex h-[18px] px-1.5"
      )}
    >
      {expanded ? "⟨ ⟩" : "···"}
    </button>
  )
}

// Inline group for consecutive [1][2][3] inside message text
function InlineCitationGroup({
  badges,
  activeCitation,
  onCiteClick,
}: {
  badges: CitationChunk[]
  activeCitation: CitationChunk | null
  onCiteClick: (c: CitationChunk) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const hasMore = badges.length > VISIBLE_THRESHOLD
  const visible = hasMore && !expanded ? badges.slice(0, VISIBLE_THRESHOLD) : badges

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
        <ExpandCollapseButton expanded={expanded} onToggle={() => setExpanded((p) => !p)} inline />
      )}
    </span>
  )
}

// Footer row below assistant message
function CitationBadgeRow({
  citations,
  activeCitation,
  onCiteClick,
}: {
  citations: CitationChunk[]
  activeCitation: CitationChunk | null
  onCiteClick: (c: CitationChunk) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const hasMore = citations.length > VISIBLE_THRESHOLD
  const visible = hasMore && !expanded ? citations.slice(0, VISIBLE_THRESHOLD) : citations

  return (
    <div className="flex flex-wrap items-center gap-1">
      <span className="text-muted-foreground text-xs">Quellen:</span>
      {visible.map((c) => (
        <CitationBadge
          key={c.id}
          citation={c}
          active={activeCitation?.id === c.id}
          onClick={() => onCiteClick(c)}
        />
      ))}
      {hasMore && (
        <ExpandCollapseButton expanded={expanded} onToggle={() => setExpanded((p) => !p)} />
      )}
    </div>
  )
}

// ─── Citation badge with hover card ───────────────────────────────────────────

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
    <HoverCard>
      {/* render as span so base-ui can attach hover handlers without wrapping a button in an <a> */}
      <HoverCardTrigger render={<span className="inline-flex" />} delay={300} closeDelay={100}>
        <button
          onClick={onClick}
          className={cn(
            "inline-flex size-[18px] items-center justify-center rounded-full text-[10px] leading-none font-semibold transition-colors",
            active
              ? "bg-primary text-primary-foreground"
              : "bg-primary/10 text-primary hover:bg-primary/20"
          )}
          title={citation.sourceTitle}
        >
          {citation.index}
        </button>
      </HoverCardTrigger>
      <HoverCardContent side="top" align="center" className="w-auto p-0">
        <CitationHoverContent citation={citation} />
      </HoverCardContent>
    </HoverCard>
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
  // Group consecutive [N][M][K] into a single cite element with data-indices
  const processed =
    citations.length > 0
      ? text
          .replace(/(\[\d+\])(\s*\[\d+\])+/g, (match) => {
            const indices = [...match.matchAll(/\[(\d+)\]/g)].map((m) => m[1])
            return `<cite data-indices="${indices.join(",")}"></cite>`
          })
          .replace(/\[(\d+)\]/g, '<cite data-idx="$1"></cite>')
      : text

  return (
    <Markdown
      remarkPlugins={[remarkGfm]}
      rehypePlugins={[rehypeRaw]}
      components={{
        cite(props) {
          const { node: _node, ...rest } = props
          const attrs = rest as Record<string, string>

          if (attrs["data-indices"]) {
            const badges = attrs["data-indices"]
              .split(",")
              .map((i) => citations[parseInt(i) - 1])
              .filter(Boolean) as CitationChunk[]
            if (badges.length === 0) return null
            return (
              <InlineCitationGroup
                badges={badges}
                activeCitation={activeCitation}
                onCiteClick={onCiteClick}
              />
            )
          }

          const idx = attrs["data-idx"]
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
        p(props) {
          const { node: _node, children, ...rest } = props
          return (
            <p className="mb-3 last:mb-0" {...rest}>
              {children}
            </p>
          )
        },
        ul(props) {
          const { node: _node, children, ...rest } = props
          return (
            <ul className="mb-3 list-disc space-y-1 pl-5 last:mb-0" {...rest}>
              {children}
            </ul>
          )
        },
        ol(props) {
          const { node: _node, children, ...rest } = props
          return (
            <ol className="mb-3 list-decimal space-y-1 pl-5 last:mb-0" {...rest}>
              {children}
            </ol>
          )
        },
        li(props) {
          const { node: _node, children, ...rest } = props
          return <li {...rest}>{children}</li>
        },
        h1(props) {
          const { node: _node, children, ...rest } = props
          return (
            <h1 className="mt-4 mb-2 text-base font-semibold first:mt-0" {...rest}>
              {children}
            </h1>
          )
        },
        h2(props) {
          const { node: _node, children, ...rest } = props
          return (
            <h2 className="mt-4 mb-2 text-sm font-semibold first:mt-0" {...rest}>
              {children}
            </h2>
          )
        },
        h3(props) {
          const { node: _node, children, ...rest } = props
          return (
            <h3 className="mt-3 mb-1 text-sm font-medium first:mt-0" {...rest}>
              {children}
            </h3>
          )
        },
        blockquote(props) {
          const { node: _node, children, ...rest } = props
          return (
            <blockquote
              className="border-muted-foreground/30 text-muted-foreground mb-3 border-l-2 pl-4 last:mb-0"
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
              <code
                className="bg-muted block overflow-x-auto rounded-md px-3 py-2 text-xs"
                {...rest}
              >
                {children}
              </code>
            )
          }
          return (
            <code className="bg-muted rounded px-1 py-0.5 font-mono text-xs" {...rest}>
              {children}
            </code>
          )
        },
        pre(props) {
          const { node: _node, children, ...rest } = props
          return (
            <pre className="mb-3 last:mb-0" {...rest}>
              {children}
            </pre>
          )
        },
        strong(props) {
          const { node: _node, children, ...rest } = props
          return (
            <strong className="font-semibold" {...rest}>
              {children}
            </strong>
          )
        },
        em(props) {
          const { node: _node, children, ...rest } = props
          return (
            <em className="italic" {...rest}>
              {children}
            </em>
          )
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
          return <hr className="border-border my-4" {...rest} />
        },
      }}
    >
      {processed}
    </Markdown>
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
    const next = activeCitation?.id === c.id ? null : c
    setActiveCitation(next)
    if (next) openSourceView(next)
  }

  return (
    <div className="flex flex-1 overflow-hidden">
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-6">
          {messages.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center gap-2 text-center">
              <p className="text-muted-foreground text-sm">
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
                      <div className="bg-primary text-primary-foreground max-w-[80%] rounded-2xl rounded-tr-sm px-4 py-2.5 text-sm">
                        {fullText}
                      </div>
                    </div>
                  )
                }

                const uniqueCitations = [...new Map(citations.map((c) => [c.id, c])).values()]

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
                <div className="text-muted-foreground flex items-center gap-2">
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
            <div className="bg-muted/40 flex items-center gap-2 rounded-xl border px-4 py-3">
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={readySourceCount === 0 ? "Keine Quellen verfügbar…" : "Text eingeben…"}
                disabled={readySourceCount === 0 || isStreaming}
                className="placeholder:text-muted-foreground flex-1 bg-transparent text-sm outline-none disabled:cursor-not-allowed disabled:opacity-50"
              />
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground text-xs">
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
            <p className="text-muted-foreground/60 mt-2 text-center text-xs">
              YannBookLM kann Fehler machen. Überprüfe wichtige Informationen.
            </p>
          </form>
        </div>
      </div>
    </div>
  )
}
