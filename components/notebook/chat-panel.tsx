"use client"

import { useState, useRef, useEffect } from "react"
import { useChat } from "@ai-sdk/react"
import { useTranslations } from "next-intl"
import { DefaultChatTransport, isTextUIPart } from "ai"
import { ArrowRight, BookmarkPlus, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { openSourceView } from "@/lib/source-view-event"
import { NOTE_FROM_CHAT_EVENT } from "@/components/notebook/studio-sidebar"
import { AssistantContent, CitationBadgeRow } from "@/components/notebook/chat-citations"
import type { ChatMessage, CitationChunk } from "@/lib/types/chat"

// ─── Save as note button ──────────────────────────────────────────────────────

function SaveAsNoteButton({ messageId, content }: { messageId: string; content: string }) {
  const t = useTranslations("notes")

  function handleClick() {
    const clean = content.replace(/\[\d+\]/g, "").trim()
    window.dispatchEvent(
      new CustomEvent(NOTE_FROM_CHAT_EVENT, {
        detail: { content: clean, sourceMessageId: messageId },
      })
    )
  }

  return (
    <button
      onClick={handleClick}
      title={t("saveAsNote")}
      className="ml-auto opacity-0 transition-opacity group-hover:opacity-100 text-muted-foreground hover:text-foreground"
    >
      <BookmarkPlus className="size-3.5" />
    </button>
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
  const [activeSourceCount, setActiveSourceCount] = useState(readySourceCount)
  const bottomRef = useRef<HTMLDivElement>(null)

  const { messages, sendMessage, status } = useChat<ChatMessage>({
    transport: new DefaultChatTransport({
      api: "/api/chat",
      body: { notebookId },
    }),
    messages: initialMessages,
  })

  const isStreaming = status === "streaming" || status === "submitted"
  const tChat = useTranslations("chat")

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  useEffect(() => {
    function onCountChange(e: Event) {
      setActiveSourceCount((e as CustomEvent<{ count: number }>).detail.count)
    }
    window.addEventListener("notebook:source-count-change", onCountChange)
    return () => window.removeEventListener("notebook:source-count-change", onCountChange)
  }, [])

  useEffect(() => {
    function onAsk(e: Event) {
      const text = (e as CustomEvent<{ text: string }>).detail?.text?.trim()
      if (!text || isStreaming || activeSourceCount === 0) return
      setInput("")
      setActiveCitation(null)
      sendMessage({ text })
    }
    window.addEventListener("notebook:ask", onAsk)
    return () => window.removeEventListener("notebook:ask", onAsk)
  }, [isStreaming, activeSourceCount, sendMessage])

  useEffect(() => {
    function onSetInput(e: Event) {
      const text = (e as CustomEvent<{ text: string }>).detail?.text
      if (typeof text === "string") setInput(text)
    }
    window.addEventListener("notebook:set-input", onSetInput)
    return () => window.removeEventListener("notebook:set-input", onSetInput)
  }, [])

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const text = input.trim()
    if (!text || isStreaming || activeSourceCount === 0) return
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
                {activeSourceCount === 0
                  ? tChat("noSourcesHint")
                  : tChat("askQuestion")}
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
                  <div key={msg.id} className="group flex flex-col gap-2">
                    <div className="text-sm leading-relaxed">
                      <AssistantContent
                        text={fullText}
                        citations={citations}
                        activeCitation={activeCitation}
                        onCiteClick={handleCiteClick}
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      {uniqueCitations.length > 0 && (
                        <CitationBadgeRow
                          citations={uniqueCitations}
                          activeCitation={activeCitation}
                          onCiteClick={handleCiteClick}
                        />
                      )}
                      <SaveAsNoteButton messageId={msg.id} content={fullText} />
                    </div>
                  </div>
                )
              })}

              {isStreaming && messages[messages.length - 1]?.role !== "assistant" && (
                <div className="text-muted-foreground flex items-center gap-2">
                  <Loader2 className="size-4 animate-spin" />
                  <span className="text-sm">{tChat("thinking")}</span>
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
                placeholder={activeSourceCount === 0 ? tChat("noSourcesPlaceholder") : tChat("inputPlaceholder")}
                disabled={activeSourceCount === 0 || isStreaming}
                className="placeholder:text-muted-foreground flex-1 bg-transparent text-sm outline-none disabled:cursor-not-allowed disabled:opacity-50"
              />
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground text-xs">
                  {activeSourceCount} {activeSourceCount === 1 ? tChat("sourceCountSingular") : tChat("sourceCountPlural")}
                </span>
                <Button
                  type="submit"
                  size="icon"
                  className="size-7 rounded-full"
                  disabled={!input.trim() || activeSourceCount === 0 || isStreaming}
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
              {tChat("disclaimer")}
            </p>
          </form>
        </div>
      </div>
    </div>
  )
}
