"use client"

import { useState } from "react"
import { useTranslations } from "next-intl"
import Markdown from "react-markdown"
import remarkGfm from "remark-gfm"
import rehypeRaw from "rehype-raw"
import { FileText, Globe, ExternalLink, ChevronsRightLeft } from "lucide-react"
import { FaYoutube } from "react-icons/fa"
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card"
import { Separator } from "@/components/ui/separator"
import { cn } from "@/lib/utils"
import { openSourceView } from "@/lib/source-view-event"
import { resolveS3ImagesInContent } from "@/lib/s3-image-url"
import type { CitationChunk } from "@/lib/types/chat"

export { openSourceView }

const VISIBLE_THRESHOLD = 2

export function SourceIcon({ type, className }: { type: string; className?: string }) {
  if (type === "youtube") return <FaYoutube className={cn("text-red-500", className)} />
  if (type === "url") return <Globe className={cn("text-blue-400", className)} />
  return <FileText className={cn("text-red-400", className)} />
}

export function CitationHoverContent({ citation }: { citation: CitationChunk }) {
  return (
    <div className="bg-popover flex w-72 flex-col overflow-hidden rounded-md border shadow-md">
      <div className="flex items-center gap-2 px-3 py-2.5">
        <SourceIcon type={citation.sourceType} className="size-4 shrink-0" />
        <span className="truncate text-sm font-medium">{citation.sourceTitle}</span>
      </div>
      <Separator />
      <div className="text-muted-foreground max-h-56 overflow-y-auto px-3 py-2.5 text-xs leading-relaxed">
        <Markdown remarkPlugins={[remarkGfm]}>
          {resolveS3ImagesInContent(citation.content)}
        </Markdown>
      </div>
      <Separator />
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

function ExpandCollapseButton({ expanded, onToggle, inline }: { expanded: boolean; onToggle: () => void; inline?: boolean }) {
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

export function CitationBadge({ citation, active, onClick }: { citation: CitationChunk; active: boolean; onClick: () => void }) {
  return (
    <HoverCard>
      <HoverCardTrigger render={<span className="inline-flex" />} delay={300} closeDelay={100}>
        <button
          onClick={onClick}
          className={cn(
            "inline-flex size-[18px] items-center justify-center rounded-full text-[10px] leading-none font-semibold transition-colors",
            active ? "bg-primary text-primary-foreground" : "bg-primary/10 text-primary hover:bg-primary/20"
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

function InlineCitationGroup({ badges, activeCitation, onCiteClick }: { badges: CitationChunk[]; activeCitation: CitationChunk | null; onCiteClick: (c: CitationChunk) => void }) {
  const [expanded, setExpanded] = useState(false)
  const collapsible = badges.length >= 3

  return (
    <span className="inline-flex items-center gap-0.5 align-middle">
      <CitationBadge citation={badges[0]} active={activeCitation?.id === badges[0].id} onClick={() => onCiteClick(badges[0])} />
      {collapsible && (
        <button
          onClick={() => setExpanded((p) => !p)}
          className="inline-flex h-[18px] items-center rounded-full bg-muted px-1 align-middle text-[10px] font-medium text-muted-foreground hover:bg-muted/80"
        >
          {expanded ? <ChevronsRightLeft className="size-3" /> : "···"}
        </button>
      )}
      {(expanded || !collapsible) &&
        badges.slice(1).map((c) => (
          <CitationBadge key={c.id} citation={c} active={activeCitation?.id === c.id} onClick={() => onCiteClick(c)} />
        ))}
    </span>
  )
}

export function CitationBadgeRow({ citations, activeCitation, onCiteClick }: { citations: CitationChunk[]; activeCitation: CitationChunk | null; onCiteClick: (c: CitationChunk) => void }) {
  const t = useTranslations("chat")
  const [expanded, setExpanded] = useState(false)
  const hasMore = citations.length > VISIBLE_THRESHOLD
  const visible = hasMore && !expanded ? citations.slice(0, VISIBLE_THRESHOLD) : citations

  return (
    <div className="flex flex-wrap items-center gap-1">
      <span className="text-muted-foreground text-xs">{t("citationsLabel")}</span>
      {visible.map((c) => (
        <CitationBadge key={c.id} citation={c} active={activeCitation?.id === c.id} onClick={() => onCiteClick(c)} />
      ))}
      {hasMore && <ExpandCollapseButton expanded={expanded} onToggle={() => setExpanded((p) => !p)} />}
    </div>
  )
}

export function AssistantContent({ text, citations, activeCitation, onCiteClick }: { text: string; citations: CitationChunk[]; activeCitation: CitationChunk | null; onCiteClick: (c: CitationChunk) => void }) {
  const byOrigIndex = new Map(citations.map((c) => [c.index, c]))

  // Collect referenced original indices in first-appearance order.
  // Handles both [N] and [N, M] (comma-separated inside one bracket pair).
  const seenOrder: number[] = []
  const seenSet = new Set<number>()
  for (const match of text.matchAll(/\[(\d+(?:,\s*\d+)*)\]/g)) {
    for (const part of match[1].split(",")) {
      const n = parseInt(part.trim())
      if (!seenSet.has(n) && byOrigIndex.has(n)) {
        seenOrder.push(n)
        seenSet.add(n)
      }
    }
  }

  // Map original index → sequential display index (1, 2, 3…)
  const toDisplay = new Map(seenOrder.map((n, i) => [n, i + 1]))
  const displayCitations = seenOrder.map((n) => ({ ...byOrigIndex.get(n)!, index: toDisplay.get(n)! }))
  const byDisplayIndex = new Map(displayCitations.map((c) => [c.index, c]))

  // Renumber text: [N, M] → [d(N)][d(M)], [N] → [d(N)], drop unresolved refs
  const renumbered =
    citations.length > 0
      ? text
          .replace(/\[(\d+(?:,\s*\d+)+)\]/g, (_, inner: string) =>
            inner
              .split(",")
              .map((s) => {
                const d = toDisplay.get(parseInt(s.trim()))
                return d != null ? `[${d}]` : ""
              })
              .filter(Boolean)
              .join(""),
          )
          .replace(/\[(\d+)\]/g, (_, s) => {
            const d = toDisplay.get(parseInt(s))
            return d != null ? `[${d}]` : ""
          })
      : text

  // Convert consecutive [N][M]… → <cite data-indices> and lone [N] → <cite data-idx>
  const processed =
    citations.length > 0
      ? renumbered
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
            const badges = attrs["data-indices"].split(",").map((i) => byDisplayIndex.get(parseInt(i))).filter(Boolean) as CitationChunk[]
            if (badges.length === 0) return null
            return <InlineCitationGroup badges={badges} activeCitation={activeCitation} onCiteClick={onCiteClick} />
          }
          const idx = attrs["data-idx"]
          if (!idx) return null
          const citation = byDisplayIndex.get(parseInt(idx))
          if (!citation) return null
          return <CitationBadge citation={citation} active={activeCitation?.id === citation.id} onClick={() => onCiteClick(citation)} />
        },
        p(props) { const { node: _node, children, ...rest } = props; return <p className="mb-3 last:mb-0" {...rest}>{children}</p> },
        ul(props) { const { node: _node, children, ...rest } = props; return <ul className="mb-3 list-disc space-y-1 pl-5 last:mb-0" {...rest}>{children}</ul> },
        ol(props) { const { node: _node, children, ...rest } = props; return <ol className="mb-3 list-decimal space-y-1 pl-5 last:mb-0" {...rest}>{children}</ol> },
        li(props) { const { node: _node, children, ...rest } = props; return <li {...rest}>{children}</li> },
        h1(props) { const { node: _node, children, ...rest } = props; return <h1 className="mt-4 mb-2 text-base font-semibold first:mt-0" {...rest}>{children}</h1> },
        h2(props) { const { node: _node, children, ...rest } = props; return <h2 className="mt-4 mb-2 text-sm font-semibold first:mt-0" {...rest}>{children}</h2> },
        h3(props) { const { node: _node, children, ...rest } = props; return <h3 className="mt-3 mb-1 text-sm font-medium first:mt-0" {...rest}>{children}</h3> },
        blockquote(props) { const { node: _node, children, ...rest } = props; return <blockquote className="border-muted-foreground/30 text-muted-foreground mb-3 border-l-2 pl-4 last:mb-0" {...rest}>{children}</blockquote> },
        code(props) {
          const { node: _node, children, className, ...rest } = props
          const isBlock = Boolean(className?.startsWith("language-"))
          if (isBlock) return <code className="bg-muted block overflow-x-auto rounded-md px-3 py-2 text-xs" {...rest}>{children}</code>
          return <code className="bg-muted rounded px-1 py-0.5 font-mono text-xs" {...rest}>{children}</code>
        },
        pre(props) { const { node: _node, children, ...rest } = props; return <pre className="mb-3 last:mb-0" {...rest}>{children}</pre> },
        strong(props) { const { node: _node, children, ...rest } = props; return <strong className="font-semibold" {...rest}>{children}</strong> },
        em(props) { const { node: _node, children, ...rest } = props; return <em className="italic" {...rest}>{children}</em> },
        a(props) { const { node: _node, children, href, ...rest } = props; return <a href={href} target="_blank" rel="noopener noreferrer" className="text-primary underline underline-offset-2 hover:no-underline" {...rest}>{children}</a> },
        hr(props) { const { node: _node, ...rest } = props; return <hr className="border-border my-4" {...rest} /> },
        img(props) { const { node: _node, src, alt, ...rest } = props; return <img src={typeof src === "string" ? src : undefined} alt={alt ?? ""} className="my-3 max-w-full rounded-md" {...rest} /> },
      }}
    >
      {resolveS3ImagesInContent(processed)}
    </Markdown>
  )
}
