"use client"

import { useEffect, useCallback } from "react"
import { X, ChevronLeft, ChevronRight } from "lucide-react"
import { cn } from "@/lib/utils"
import type { SlideData } from "@/lib/google-slides-export"

interface SlidedeckViewerProps {
  slideData: SlideData
  currentIndex: number
  onIndexChange: (index: number) => void
  onClose: () => void
}

export function SlidedeckViewer({ slideData, currentIndex, onIndexChange, onClose }: SlidedeckViewerProps) {
  const total = slideData.slides.length
  const slide = slideData.slides[currentIndex]
  const isTitleSlide = currentIndex === 0

  const goNext = useCallback(() => {
    if (currentIndex < total - 1) onIndexChange(currentIndex + 1)
  }, [currentIndex, total, onIndexChange])

  const goPrev = useCallback(() => {
    if (currentIndex > 0) onIndexChange(currentIndex - 1)
  }, [currentIndex, onIndexChange])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "ArrowRight" || e.key === "ArrowDown" || e.key === " ") {
        e.preventDefault()
        goNext()
      } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
        e.preventDefault()
        goPrev()
      } else if (e.key === "Escape") {
        onClose()
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [goNext, goPrev, onClose])

  if (!slide) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 px-16">
      {/* Close */}
      <button
        className="absolute right-4 top-4 rounded-full p-2 text-white/60 transition-colors hover:bg-white/10 hover:text-white"
        onClick={onClose}
        aria-label="Schließen"
      >
        <X className="size-5" />
      </button>

      {/* Prev */}
      <button
        className="absolute left-4 top-1/2 -translate-y-1/2 rounded-full p-2 text-white/50 transition-colors hover:bg-white/10 hover:text-white disabled:pointer-events-none disabled:opacity-20"
        onClick={goPrev}
        disabled={currentIndex === 0}
        aria-label="Vorherige Folie"
      >
        <ChevronLeft className="size-8" />
      </button>

      {/* Slide card — 16:9 */}
      <div
        className={cn(
          "flex w-full max-w-5xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl",
          "aspect-video",
          isTitleSlide ? "items-center justify-center p-16 text-center" : "justify-start p-12"
        )}
      >
        <p className={cn(
          "font-bold leading-tight text-gray-900",
          isTitleSlide ? "text-4xl" : "mb-7 text-2xl"
        )}>
          {slide.title}
        </p>

        {slide.bullets.length > 0 && (
          isTitleSlide ? (
            <p className="mt-3 text-lg leading-relaxed text-gray-500">
              {slide.bullets.join(" · ")}
            </p>
          ) : (
            <ul className="space-y-4">
              {slide.bullets.map((b, i) => (
                <li key={i} className="flex items-start gap-3 text-[1.05rem] leading-snug text-gray-700">
                  <span className="mt-[0.45rem] size-1.5 shrink-0 rounded-full bg-gray-400" />
                  {b}
                </li>
              ))}
            </ul>
          )
        )}
      </div>

      {/* Next */}
      <button
        className="absolute right-4 top-1/2 -translate-y-1/2 rounded-full p-2 text-white/50 transition-colors hover:bg-white/10 hover:text-white disabled:pointer-events-none disabled:opacity-20"
        onClick={goNext}
        disabled={currentIndex === total - 1}
        aria-label="Nächste Folie"
      >
        <ChevronRight className="size-8" />
      </button>

      {/* Counter */}
      <div className="absolute bottom-5 left-1/2 -translate-x-1/2 text-sm tabular-nums text-white/40">
        {currentIndex + 1} / {total}
      </div>
    </div>
  )
}
