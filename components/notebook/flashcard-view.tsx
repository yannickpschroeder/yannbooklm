"use client"

import { useState, useEffect } from "react"
import { useTranslations } from "next-intl"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { ChevronLeft, ChevronRight, ChevronDown, RotateCcw, X, Check } from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

export type FlashCard = { front: string; back: string }
export type FlashcardUsedSource = { id: string; title: string; type: string }
export type FlashcardData = {
  cards: FlashCard[]
  topics: string[]
  suggestions: string[]
  usedSources?: FlashcardUsedSource[]
}

type CardRating = "known" | "unknown" | "skipped" | null

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${s.toString().padStart(2, "0")}`
}

function CircleProgress({ known, total }: { known: number; total: number }) {
  const pct = total > 0 ? Math.round((known / total) * 100) : 0
  const r = 52
  const circ = 2 * Math.PI * r
  const dash = (pct / 100) * circ
  return (
    <div className="relative flex size-32 items-center justify-center">
      <svg className="-rotate-90" width="128" height="128">
        <circle
          cx="64"
          cy="64"
          r={r}
          fill="none"
          className="stroke-muted-foreground/25"
          strokeWidth="10"
        />
        <circle
          cx="64"
          cy="64"
          r={r}
          fill="none"
          className="stroke-primary"
          strokeWidth="10"
          strokeDasharray={`${dash} ${circ}`}
          strokeLinecap="round"
        />
      </svg>
      <div className="absolute flex flex-col items-center">
        <span className="text-2xl font-bold">
          {known}/{total}
        </span>
        <span className="text-muted-foreground text-sm">{pct}%</span>
      </div>
    </div>
  )
}

export function FlashcardView({
  data,
  outputId,
  onNewDeckFromTopic,
  readOnly = false,
}: {
  data: FlashcardData
  notebookId?: string
  outputId: string
  onNewDeckFromTopic?: (topic: string, outputId: string) => void
  readOnly?: boolean
}) {
  const t = useTranslations("flashcards")
  const [queue, setQueue] = useState<number[]>(() => data.cards.map((_, i) => i))
  const [position, setPosition] = useState(0)
  const [flipped, setFlipped] = useState(false)
  const [ratings, setRatings] = useState<CardRating[]>(() => data.cards.map(() => null))
  const [mode, setMode] = useState<"study" | "results">("study")
  const [selectedSuggestion, setSelectedSuggestion] = useState<string | null>(null)
  const [startTime, setStartTime] = useState<number>(() => Date.now())
  const [elapsedSeconds, setElapsedSeconds] = useState(0)

  useEffect(() => {
    if (mode !== "study") return
    const iv = setInterval(
      () => setElapsedSeconds(Math.floor((Date.now() - startTime) / 1000)),
      1000
    )
    return () => clearInterval(iv)
  }, [mode, startTime])

  const cardOriginalIndex = queue[position] ?? 0
  const card = data.cards[cardOriginalIndex]

  const queueRatings = queue.map((i) => ratings[i])
  const stats = {
    known: queueRatings.filter((r) => r === "known").length,
    unknown: queueRatings.filter((r) => r === "unknown").length,
    skipped: queueRatings.filter((r) => r === "skipped").length,
  }

  function advance() {
    if (position < queue.length - 1) {
      setPosition(position + 1)
      setFlipped(false)
    } else {
      setElapsedSeconds(Math.floor((Date.now() - startTime) / 1000))
      setMode("results")
    }
  }

  function rate(r: "known" | "unknown") {
    setRatings((prev) => prev.map((v, i) => (i === cardOriginalIndex ? r : v)))
    advance()
  }

  function skipCard() {
    setRatings((prev) => prev.map((v, i) => (i === cardOriginalIndex ? "skipped" : v)))
    advance()
  }

  function navigate(dir: -1 | 1) {
    const next = position + dir
    if (next < 0 || next >= queue.length) return
    setPosition(next)
    setFlipped(false)
  }

  function restartSubset(subset: "all" | "unknown" | "skipped") {
    let newQueue: number[]
    if (subset === "all") {
      newQueue = data.cards.map((_, i) => i)
    } else {
      const target = subset === "unknown" ? "unknown" : "skipped"
      newQueue = data.cards.map((_, i) => i).filter((i) => ratings[i] === target)
      if (newQueue.length === 0) return
    }
    const newRatings = [...ratings]
    newQueue.forEach((i) => {
      newRatings[i] = null
    })
    setRatings(newRatings)
    setQueue(newQueue)
    setPosition(0)
    setFlipped(false)
    setMode("study")
    setStartTime(Date.now())
    setElapsedSeconds(0)
    setSelectedSuggestion(null)
  }

  // ── Results screen ──────────────────────────────────────────────────────────
  if (mode === "results") {
    return (
      <div
        className={cn("flex flex-1 flex-col gap-6 overflow-y-auto p-5", readOnly && "items-center")}
      >
        <h2 className="text-xl font-bold">{t("resultsTitle")}</h2>

        <div className="flex items-center gap-6">
          <CircleProgress known={stats.known} total={queue.length} />
          <div className="flex flex-col gap-2 text-sm">
            <div className="flex items-center gap-3">
              <span className="text-muted-foreground w-32">{t("known")}</span>
              <span className="font-semibold text-green-500">{stats.known}</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-muted-foreground w-32">{t("unknown")}</span>
              <span className="text-destructive font-semibold">{stats.unknown}</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-muted-foreground w-32">{t("skipped")}</span>
              <span className="font-semibold">{stats.skipped}</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-muted-foreground w-32">{t("time")}</span>
              <span className="font-semibold">{formatTime(elapsedSeconds)}</span>
            </div>
          </div>
        </div>

        {!readOnly && (
          <div className="flex gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger className="hover:bg-muted inline-flex h-8 items-center gap-1.5 rounded-md border px-3 text-sm font-medium transition-colors">
                <RotateCcw className="size-3.5" />
                {t("practiceAgain")}
                <ChevronDown className="size-3" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                <DropdownMenuItem onClick={() => restartSubset("all")}>
                  {t("practiceAll")}
                </DropdownMenuItem>
                <DropdownMenuItem
                  disabled={stats.unknown === 0}
                  onClick={() => restartSubset("unknown")}
                >
                  {t("practiceUnknown")}
                </DropdownMenuItem>
                <DropdownMenuItem
                  disabled={stats.skipped === 0}
                  onClick={() => restartSubset("skipped")}
                >
                  {t("practiceSkipped")}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )}

        <div className={readOnly ? "flex flex-col gap-4" : "grid grid-cols-2 gap-4"}>
          <div>
            <h3 className="mb-2 text-sm font-semibold">{t("topicsCovered")}</h3>
            <ul className="space-y-1">
              {data.topics.map((topic) => (
                <li key={topic} className="text-muted-foreground text-sm">
                  • {topic}
                </li>
              ))}
            </ul>
          </div>
          {!readOnly && onNewDeckFromTopic && (
            <div>
              <h3 className="mb-2 text-sm font-semibold">{t("learnMore")}</h3>
              <p className="text-muted-foreground mb-2 text-xs">{t("learnMoreHint")}</p>
              <div className="flex flex-col gap-1.5">
                {data.suggestions.map((s) => (
                  <button
                    key={s}
                    onClick={() => setSelectedSuggestion(s === selectedSuggestion ? null : s)}
                    className={cn(
                      "rounded-md border px-3 py-2 text-left text-xs transition-colors",
                      s === selectedSuggestion
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border hover:bg-muted"
                    )}
                  >
                    {s}
                  </button>
                ))}
                <Button
                  size="sm"
                  className="mt-1"
                  disabled={!selectedSuggestion}
                  onClick={() =>
                    selectedSuggestion && onNewDeckFromTopic(selectedSuggestion, outputId)
                  }
                >
                  {t("createNewDeck")}
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    )
  }

  // ── Study screen ────────────────────────────────────────────────────────────
  const progressPct = queue.length > 0 ? (position / queue.length) * 100 : 0

  return (
    <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-5">
      {/* Progress bar */}
      <div className="flex items-center gap-2">
        <div className="bg-muted h-1.5 flex-1 overflow-hidden rounded-full">
          <div
            className="bg-primary h-full rounded-full transition-all duration-300"
            style={{ width: `${progressPct}%` }}
          />
        </div>
        <span className="text-muted-foreground shrink-0 text-xs">
          {position + 1}/{queue.length}
        </span>
      </div>

      {/* 3D Flip Card — click anywhere to flip */}
      <div
        style={{ perspective: "1200px" }}
        className="cursor-pointer"
        onClick={() => setFlipped((f) => !f)}
      >
        <div
          className="relative min-h-48 w-full"
          style={{
            transformStyle: "preserve-3d",
            WebkitTransformStyle: "preserve-3d",
            transition: "transform 0.5s",
            transform: flipped ? "rotateY(180deg)" : "rotateY(0deg)",
          }}
        >
          {/* Front */}
          <div
            className="bg-card absolute inset-0 flex flex-col items-center justify-center rounded-xl border p-6"
            style={{ backfaceVisibility: "hidden", WebkitBackfaceVisibility: "hidden" }}
          >
            <span className="text-muted-foreground mb-3 text-xs font-medium tracking-wider uppercase">
              {t("frontLabel")}
            </span>
            <p className="text-center text-base leading-relaxed font-medium">{card?.front}</p>
          </div>
          {/* Back */}
          <div
            className="bg-card absolute inset-0 flex flex-col items-center justify-center rounded-xl border p-6"
            style={{
              backfaceVisibility: "hidden",
              WebkitBackfaceVisibility: "hidden",
              transform: "rotateY(180deg)",
            }}
          >
            <span className="text-muted-foreground mb-3 text-xs font-medium tracking-wider uppercase">
              {t("backLabel")}
            </span>
            <p className="text-center text-base leading-relaxed">{card?.back}</p>
          </div>
        </div>
      </div>

      {/* Action bar: ← [✗ N] [✓ N] → */}
      <div className="mt-auto flex items-center justify-center gap-3 border-t pt-4">
        {/* Back arrow */}
        <button
          disabled={position === 0}
          onClick={() => navigate(-1)}
          className="bg-card hover:bg-muted flex size-10 items-center justify-center rounded-full border transition-colors disabled:pointer-events-none disabled:opacity-30"
        >
          <ChevronLeft className="size-5" />
        </button>

        {/* ✗ Not known */}
        <button
          disabled={!flipped}
          onClick={() => rate("unknown")}
          className={cn(
            "flex h-12 min-w-16 items-center justify-center gap-2 rounded-full border px-4 font-medium transition-colors",
            flipped
              ? "border-destructive/40 bg-destructive/10 text-destructive hover:bg-destructive/20"
              : "border-muted bg-muted/30 text-muted-foreground opacity-40"
          )}
        >
          <X className="size-4" />
          <span className="text-sm">{stats.unknown}</span>
        </button>

        {/* ✓ Known */}
        <button
          disabled={!flipped}
          onClick={() => rate("known")}
          className={cn(
            "flex h-12 min-w-16 items-center justify-center gap-2 rounded-full border px-4 font-medium transition-colors",
            flipped
              ? "border-green-500/40 bg-green-500/10 text-green-500 hover:bg-green-500/20"
              : "border-muted bg-muted/30 text-muted-foreground opacity-40"
          )}
        >
          <Check className="size-4" />
          <span className="text-sm">{stats.known}</span>
        </button>

        {/* Skip / forward arrow */}
        <button
          disabled={position === queue.length}
          onClick={skipCard}
          className="bg-card hover:bg-muted flex size-10 items-center justify-center rounded-full border transition-colors disabled:pointer-events-none disabled:opacity-30"
        >
          <ChevronRight className="size-5" />
        </button>
      </div>

      {/* Progress dots */}
      <div className="flex justify-center gap-1 pb-1">
        {queue.map((origIdx, pos) => {
          const r = ratings[origIdx]
          return (
            <div
              key={pos}
              className={cn(
                "size-1.5 rounded-full transition-colors",
                pos === position
                  ? "bg-primary"
                  : r === "known"
                    ? "bg-green-500"
                    : r === "unknown"
                      ? "bg-destructive"
                      : r === "skipped"
                        ? "bg-muted-foreground"
                        : "bg-muted"
              )}
            />
          )
        })}
      </div>
    </div>
  )
}
