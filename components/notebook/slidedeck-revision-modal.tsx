"use client"

import { useState } from "react"
import { useTranslations } from "next-intl"
import { X, Play, Share2, MoreHorizontal, ChevronDown } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import type { SlideData } from "@/lib/google-slides-export"
import type { SlidedeckUsedSource } from "./slidedeck-modal"

type SlidedeckRevisionModalProps = {
  slideData: SlideData & { usedSources?: SlidedeckUsedSource[]; language?: string; slidesUrl?: string }
  presentationTitle: string
  onClose: () => void
  onRevise: (instructions: Record<number, string>) => void
  isRevising?: boolean
  onStartViewer?: () => void
}

export function SlidedeckRevisionModal({
  slideData,
  presentationTitle,
  onClose,
  onRevise,
  isRevising,
  onStartViewer,
}: SlidedeckRevisionModalProps) {
  const t = useTranslations("studio")
  const [currentIndex, setCurrentIndex] = useState(0)
  const [pendingChanges, setPendingChanges] = useState<Record<number, string>>({})
  const [changeInput, setChangeInput] = useState("")

  const currentSlide = slideData.slides[currentIndex]
  const isTitleSlide = currentIndex === 0
  const pendingCount = Object.values(pendingChanges).filter((v) => v.trim()).length

  function selectSlide(index: number) {
    if (changeInput.trim()) {
      setPendingChanges((prev) => ({ ...prev, [currentIndex]: changeInput }))
    } else {
      setPendingChanges((prev) => {
        const next = { ...prev }
        delete next[currentIndex]
        return next
      })
    }
    setCurrentIndex(index)
    setChangeInput(pendingChanges[index] ?? "")
  }

  function handleInputChange(value: string) {
    setChangeInput(value)
    if (value.trim()) {
      setPendingChanges((prev) => ({ ...prev, [currentIndex]: value }))
    } else {
      setPendingChanges((prev) => {
        const next = { ...prev }
        delete next[currentIndex]
        return next
      })
    }
  }

  function handleRevise() {
    const all = { ...pendingChanges }
    if (changeInput.trim()) all[currentIndex] = changeInput
    onRevise(all)
  }

  if (!currentSlide) return null

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[#1b1b2e]">
      {/* Header */}
      <div className="flex h-14 shrink-0 items-center justify-between border-b border-white/10 px-5">
        <div className="flex items-center gap-3">
          <span className="text-sm font-semibold text-white">{presentationTitle}</span>
          {(slideData.usedSources?.length ?? 0) > 0 && (
            <button
              className="rounded-full bg-white/10 px-2.5 py-1 text-[11px] text-white/60 transition-colors hover:bg-white/15"
            >
              {t("slidedeckSourcesChip", { count: slideData.usedSources!.length })}
            </button>
          )}
        </div>
        <div className="flex items-center gap-0.5">
          <Button
            variant="ghost"
            size="icon"
            className="size-8 text-white/50 hover:bg-white/10 hover:text-white"
            onClick={onStartViewer}
            title={t("slidedeckPresent")}
          >
            <Play className="size-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="size-8 text-white/50 hover:bg-white/10 hover:text-white"
            onClick={() => {
              if (slideData.slidesUrl) {
                if (navigator.share) navigator.share({ url: slideData.slidesUrl }).catch(() => undefined)
                else navigator.clipboard.writeText(slideData.slidesUrl)
              }
            }}
            title={t("share")}
          >
            <Share2 className="size-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="size-8 text-white/50 hover:bg-white/10 hover:text-white"
            onClick={onClose}
          >
            <X className="size-4" />
          </Button>
          <Button variant="ghost" size="icon" className="size-8 text-white/50 hover:bg-white/10 hover:text-white">
            <MoreHorizontal className="size-4" />
          </Button>
        </div>
      </div>

      {/* Main: preview + thumbnails */}
      <div className="flex flex-1 overflow-hidden">
        {/* Slide preview */}
        <div className="flex flex-1 items-center justify-center p-8">
          <div
            className={cn(
              "flex w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl",
              "aspect-video",
              isTitleSlide ? "items-center justify-center p-14 text-center" : "justify-start p-10"
            )}
          >
            <p
              className={cn(
                "font-bold leading-tight text-gray-900",
                isTitleSlide ? "text-4xl" : "mb-6 text-2xl"
              )}
            >
              {currentSlide.title}
            </p>
            {currentSlide.bullets.length > 0 && (
              isTitleSlide ? (
                <p className="mt-3 text-lg leading-relaxed text-gray-500">
                  {currentSlide.bullets.join(" · ")}
                </p>
              ) : (
                <ul className="space-y-3">
                  {currentSlide.bullets.map((b, i) => (
                    <li key={i} className="flex items-start gap-3 text-base leading-snug text-gray-700">
                      <span className="mt-2 size-1.5 shrink-0 rounded-full bg-gray-400" />
                      {b}
                    </li>
                  ))}
                </ul>
              )
            )}
          </div>
        </div>

        {/* Thumbnail strip */}
        <div className="w-48 shrink-0 overflow-y-auto border-l border-white/10 py-3">
          {slideData.slides.map((slide, i) => (
            <button
              key={i}
              onClick={() => selectSlide(i)}
              className={cn(
                "flex w-full flex-col items-start gap-1.5 px-3 py-2 text-left transition-colors",
                i === currentIndex ? "bg-white/10" : "hover:bg-white/5"
              )}
            >
              <span className="text-[10px] text-white/40">{i + 1}</span>
              {/* Mini slide preview */}
              <div
                className={cn(
                  "w-full overflow-hidden rounded-md border-2 bg-white",
                  i === currentIndex ? "border-blue-400" : "border-transparent"
                )}
                style={{ aspectRatio: "16/9" }}
              >
                <div
                  className={cn(
                    "flex h-full w-full flex-col overflow-hidden p-1.5",
                    i === 0 && "items-center justify-center text-center"
                  )}
                >
                  <p className="line-clamp-2 text-[6px] font-bold leading-tight text-gray-900">
                    {slide.title}
                  </p>
                  {slide.bullets.length > 0 && (
                    <div className="mt-0.5 space-y-px overflow-hidden">
                      {slide.bullets.slice(0, i === 0 ? 2 : 4).map((b, j) => (
                        <p key={j} className="line-clamp-1 text-[4.5px] leading-tight text-gray-500">
                          {i !== 0 ? `• ${b}` : b}
                        </p>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              {pendingChanges[i]?.trim() && (
                <span className="rounded-full bg-blue-500/20 px-1.5 py-0.5 text-[9px] font-medium text-blue-400">
                  {t("slidedeckRevisionChanged")}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Bottom bar */}
      <div className="shrink-0 border-t border-white/10 px-6 py-4">
        <p className="mb-2 text-sm font-medium text-white/80">
          {t("slidedeckRevisionSlideLabel", { n: currentIndex + 1 })}
        </p>
        <textarea
          className="w-full resize-none rounded-lg border border-white/20 bg-white/5 px-3 py-2 text-sm text-white outline-none placeholder:text-white/30 focus:border-white/40"
          rows={2}
          placeholder={t("slidedeckRevisionPlaceholder")}
          value={changeInput}
          onChange={(e) => handleInputChange(e.target.value)}
        />
        <div className="mt-3 flex items-center justify-end gap-3">
          <button className="flex items-center gap-1 text-sm text-white/50 hover:text-white/70">
            {t("slidedeckPendingChanges", { count: pendingCount })}
            <ChevronDown className="size-3.5" />
          </button>
          <Button
            variant="ghost"
            className="text-white/60 hover:bg-white/10 hover:text-white"
            onClick={onClose}
          >
            {t("slidedeckRevisionCancel")}
          </Button>
          <Button
            className="bg-white text-gray-900 hover:bg-white/90 disabled:opacity-40"
            disabled={pendingCount === 0 || isRevising}
            onClick={handleRevise}
          >
            {isRevising ? t("slidedeckRevisionCreating") : t("slidedeckRevisionCreate")}
          </Button>
        </div>
      </div>
    </div>
  )
}
