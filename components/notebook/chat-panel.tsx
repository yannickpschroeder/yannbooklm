"use client"

import { useState, useRef, useEffect } from "react"
import { useChat } from "@ai-sdk/react"
import { useTranslations } from "next-intl"
import { DefaultChatTransport, isTextUIPart } from "ai"
import { ArrowRight, BookmarkPlus, Check, Copy, Loader2, MoreHorizontal, SlidersHorizontal, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"
import { openSourceView } from "@/lib/source-view-event"
import { NOTE_FROM_CHAT_EVENT } from "@/components/notebook/studio-sidebar"
import { AssistantContent, CitationBadgeRow } from "@/components/notebook/chat-citations"
import { ChatConfigModal, type ChatConfig } from "@/components/notebook/chat-config-modal"
import type { ChatMessage, CitationChunk } from "@/lib/types/chat"

// ─── Message action buttons ───────────────────────────────────────────────────

function MessageActions({ messageId, content }: { messageId: string; content: string }) {
  const tNotes = useTranslations("notes")
  const tChat = useTranslations("chat")
  const [copied, setCopied] = useState(false)

  function handleSaveNote() {
    const clean = content.replace(/\[\d+\]/g, "").trim()
    const title = clean.slice(0, 60).trimEnd() + (clean.length > 60 ? "…" : "")
    window.dispatchEvent(
      new CustomEvent(NOTE_FROM_CHAT_EVENT, {
        detail: { title, content: clean, sourceMessageId: messageId },
      })
    )
  }

  async function handleCopy() {
    const clean = content.replace(/\[\d+\]/g, "").trim()
    await navigator.clipboard.writeText(clean)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="flex items-center gap-1.5 opacity-0 transition-opacity group-hover:opacity-100">
      <button
        onClick={handleSaveNote}
        className="border-border text-muted-foreground hover:border-foreground/30 hover:text-foreground flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs transition-colors"
      >
        <BookmarkPlus className="size-3.5" />
        {tNotes("saveAsNote")}
      </button>
      <button
        onClick={handleCopy}
        title={tChat("copyMessage")}
        className="border-border text-muted-foreground hover:border-foreground/30 hover:text-foreground flex size-6 items-center justify-center rounded-full border transition-colors"
      >
        {copied ? <Check className="size-3 text-green-500" /> : <Copy className="size-3" />}
      </button>
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
  const [activeSourceCount, setActiveSourceCount] = useState(readySourceCount)
  const [configOpen, setConfigOpen] = useState(false)
  const [chatConfig, setChatConfig] = useState<ChatConfig>(() => {
    if (typeof window === "undefined") return { mode: "standard", length: "standard" }
    try {
      const saved = localStorage.getItem(`chat-config-${notebookId}`)
      if (saved) return JSON.parse(saved) as ChatConfig
    } catch {}
    return { mode: "standard", length: "standard" }
  })
  const chatConfigRef = useRef(chatConfig)
  chatConfigRef.current = chatConfig
  const bottomRef = useRef<HTMLDivElement>(null)

  const { messages, sendMessage, status, setMessages } = useChat<ChatMessage>({
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
      const { text, force } = (e as CustomEvent<{ text: string; force?: boolean }>).detail ?? {}
      if (!text?.trim() || isStreaming) return
      if (!force && activeSourceCount === 0) return
      setInput("")
      setActiveCitation(null)
      sendMessage({ text: text.trim() }, { body: { chatMode: chatConfigRef.current.mode, chatLength: chatConfigRef.current.length } })
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
    sendMessage({ text }, { body: { chatMode: chatConfigRef.current.mode, chatLength: chatConfigRef.current.length } })
  }

  async function handleClearHistory() {
    await fetch("/api/chat/clear", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ notebookId }),
    })
    setMessages([])
  }

  function handleCiteClick(c: CitationChunk) {
    const next = activeCitation?.id === c.id ? null : c
    setActiveCitation(next)
    if (next) openSourceView(next)
  }

  return (
    <div className="flex flex-1 overflow-hidden">
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between border-b px-4 py-2">
          <span className="text-sm font-semibold">{tChat("title")}</span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setConfigOpen(true)}
              className="hover:bg-accent flex size-7 shrink-0 items-center justify-center rounded-md transition-colors"
            >
              <SlidersHorizontal className="size-4" />
            </button>
          <DropdownMenu>
            <DropdownMenuTrigger className="hover:bg-accent flex size-7 shrink-0 items-center justify-center rounded-md transition-colors">
              <MoreHorizontal className="size-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                className="text-destructive focus:text-destructive"
                onClick={handleClearHistory}
              >
                <Trash2 className="size-4" />
                {tChat("clearHistory")}
              </DropdownMenuItem>
              <p className="text-muted-foreground px-2 py-1 text-xs">{tChat("clearHistoryHint")}</p>
            </DropdownMenuContent>
          </DropdownMenu>
          </div>
        </div>
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
                    {uniqueCitations.length > 0 && (
                      <CitationBadgeRow
                        citations={uniqueCitations}
                        activeCitation={activeCitation}
                        onCiteClick={handleCiteClick}
                      />
                    )}
                    <MessageActions messageId={msg.id} content={fullText} />
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
      <ChatConfigModal
        open={configOpen}
        onOpenChange={setConfigOpen}
        config={chatConfig}
        onSave={(cfg) => {
          setChatConfig(cfg)
          try {
            localStorage.setItem(`chat-config-${notebookId}`, JSON.stringify(cfg))
          } catch {}
        }}
      />
    </div>
  )
}
