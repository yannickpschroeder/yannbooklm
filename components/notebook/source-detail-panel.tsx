"use client"

import { useState, useRef, useEffect } from "react"
import { useTranslations } from "next-intl"
import {
  ChevronLeft,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  FileText,
  Globe,
  Sparkles,
} from "lucide-react"
import { FaYoutube } from "react-icons/fa"
import Markdown from "react-markdown"
import remarkGfm from "remark-gfm"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { resolveS3ImagesInContent } from "@/lib/s3-image-url"
import type { CitationChunk } from "@/lib/types/chat"

function CitationSourceIcon({ type }: { type: string }) {
  if (type === "youtube") return <FaYoutube className="size-4 shrink-0 text-red-500" />
  if (type === "url") return <Globe className="size-4 shrink-0 text-blue-400" />
  return <FileText className="size-4 shrink-0 text-red-400" />
}

function buildSourceLink(chunk: CitationChunk) {
  if (chunk.sourceType === "youtube" && chunk.url && chunk.positionStart != null) {
    const id = chunk.url.match(/(?:youtube\.com\/watch\?.*v=|youtu\.be\/)([\w-]{11})/)?.[1]
    if (id) {
      const m = Math.floor(chunk.positionStart / 60)
      const s = String(chunk.positionStart % 60).padStart(2, "0")
      return {
        href: `https://www.youtube.com/watch?v=${id}&t=${chunk.positionStart}`,
        label: `${m}:${s}`,
      }
    }
  }
  if (chunk.sourceType === "pdf" && chunk.pageNumber != null) {
    return { href: null, label: `Seite ${chunk.pageNumber}` }
  }
  if (chunk.url) {
    try {
      return { href: chunk.url, label: new URL(chunk.url).hostname }
    } catch {
      /* noop */
    }
  }
  return null
}

const mdComponents: React.ComponentProps<typeof Markdown>["components"] = {
  p(props) { const { node: _n, children, ...rest } = props; return <p className="mb-3 last:mb-0" {...rest}>{children}</p> },
  img(props) { const { node: _n, src, alt, ...rest } = props; return <img src={typeof src === "string" ? src : undefined} alt={alt ?? ""} className="my-3 w-full rounded-md object-cover" {...rest} /> },
  ul(props) { const { node: _n, children, ...rest } = props; return <ul className="mb-3 list-disc space-y-1 pl-4 last:mb-0" {...rest}>{children}</ul> },
  ol(props) { const { node: _n, children, ...rest } = props; return <ol className="mb-3 list-decimal space-y-1 pl-4 last:mb-0" {...rest}>{children}</ol> },
  li(props) { const { node: _n, children, ...rest } = props; return <li {...rest}>{children}</li> },
  strong(props) { const { node: _n, children, ...rest } = props; return <strong className="font-semibold" {...rest}>{children}</strong> },
}

function MdContent({ children }: { children: string }) {
  return (
    <Markdown remarkPlugins={[remarkGfm]} components={mdComponents}>
      {resolveS3ImagesInContent(children)}
    </Markdown>
  )
}

export function SourceDetailPanel({
  chunk,
  onClose,
  onTopicClick,
  highlightText,
}: {
  chunk: CitationChunk
  onClose: () => void
  onTopicClick?: (topic: string) => void
  highlightText?: string | null
}) {
  const t = useTranslations("sourceDetail")
  const link = buildSourceLink(chunk)
  const [summaryOpen, setSummaryOpen] = useState(false)
  const highlightRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (highlightRef.current && highlightText) {
      highlightRef.current.scrollIntoView({ behavior: "smooth", block: "center" })
    }
  }, [highlightText, chunk.id])

  const contentParts: [string, string, string] | null = (() => {
    if (!highlightText) return null
    const idx = chunk.content.indexOf(highlightText)
    if (idx === -1) return null
    return [chunk.content.slice(0, idx), highlightText, chunk.content.slice(idx + highlightText.length)]
  })()

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="flex h-12 shrink-0 items-center gap-2 border-b px-3">
        <Button
          variant="ghost"
          size="icon"
          className="size-7 shrink-0"
          onClick={onClose}
          aria-label={t("back")}
        >
          <ChevronLeft className="size-4" />
        </Button>
        <CitationSourceIcon type={chunk.sourceType} />
        <span
          aria-label={`source title - ${chunk.sourceTitle}`}
          className="min-w-0 flex-1 truncate text-sm font-medium"
          title={chunk.sourceTitle}
        >
          {chunk.sourceTitle}
        </span>
      </div>

      <Separator />

      {chunk.sourceSummary && (
        <div className="shrink-0 px-3 py-2">
          <div className="overflow-hidden rounded-lg bg-violet-500/10 ring-1 ring-violet-500/20">
            <button
              onClick={() => setSummaryOpen((p) => !p)}
              className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm hover:bg-violet-500/10"
            >
              <Sparkles className="size-3.5 shrink-0 text-violet-400" />
              <span className="flex-1 font-medium text-violet-100">{t("summary")}</span>
              {summaryOpen ? (
                <ChevronUp className="size-3.5 shrink-0 text-violet-400" />
              ) : (
                <ChevronDown className="size-3.5 shrink-0 text-violet-400" />
              )}
            </button>
            {summaryOpen && (
              <div className="text-foreground max-h-64 overflow-y-auto border-t border-violet-500/20 p-5 text-sm leading-relaxed">
                <Markdown remarkPlugins={[remarkGfm]}>{chunk.sourceSummary}</Markdown>
                {chunk.sourceTopics && chunk.sourceTopics.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {chunk.sourceTopics.map((topic) => (
                      <button
                        key={topic}
                        onClick={() => onTopicClick?.(topic)}
                        className="rounded-full border border-violet-500/30 bg-violet-500/15 px-2.5 py-0.5 text-xs text-violet-300 transition-colors hover:bg-violet-500/25"
                      >
                        {topic}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      <div className="text-foreground flex-1 overflow-y-auto px-4 py-4 text-sm leading-relaxed">
        {contentParts ? (
          <>
            {contentParts[0] && <MdContent>{contentParts[0]}</MdContent>}
            <div
              ref={highlightRef}
              className="my-2 rounded-md border border-yellow-500/40 bg-yellow-500/10 px-3 py-2"
            >
              <MdContent>{contentParts[1]}</MdContent>
            </div>
            {contentParts[2] && <MdContent>{contentParts[2]}</MdContent>}
          </>
        ) : (
          <MdContent>{chunk.content}</MdContent>
        )}
      </div>

      <Separator />

      <div className="shrink-0 px-4 py-3">
        {link?.href ? (
          <a
            href={link.href}
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary flex items-center gap-1.5 text-xs hover:underline"
          >
            <ExternalLink className="size-3" />
            {t("viewSource")}
          </a>
        ) : link ? (
          <span className="text-muted-foreground text-xs">{link.label}</span>
        ) : null}
      </div>
    </div>
  )
}
