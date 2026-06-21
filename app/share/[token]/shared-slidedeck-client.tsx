"use client"

import { useState } from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { cn } from "@/lib/utils"
import type { SlideData } from "@/lib/google-slides-export"

export function SharedSlidedeckClient({ data }: { data: SlideData }) {
  const [index, setIndex] = useState(0)
  const slide = data.slides[index]
  const isTitleSlide = index === 0

  if (!slide) return null

  return (
    <div className="flex h-full flex-col items-center justify-center gap-6 px-6 py-8">
      <div
        className={cn(
          "flex w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl",
          "aspect-video",
          isTitleSlide ? "items-center justify-center p-14 text-center" : "justify-start p-10"
        )}
      >
        <p className={cn("font-bold leading-tight text-gray-900", isTitleSlide ? "text-4xl" : "mb-6 text-2xl")}>
          {slide.title}
        </p>
        {slide.bullets.length > 0 && (
          isTitleSlide ? (
            <p className="mt-3 text-lg leading-relaxed text-gray-500">{slide.bullets.join(" · ")}</p>
          ) : (
            <ul className="space-y-3">
              {slide.bullets.map((b, i) => (
                <li key={i} className="flex items-start gap-3 text-base leading-snug text-gray-700">
                  <span className="mt-2 size-1.5 shrink-0 rounded-full bg-gray-400" />
                  {b}
                </li>
              ))}
            </ul>
          )
        )}
      </div>

      <div className="flex items-center gap-4">
        <button
          onClick={() => setIndex((i) => Math.max(0, i - 1))}
          disabled={index === 0}
          className="flex size-9 items-center justify-center rounded-full border transition-colors hover:bg-accent disabled:opacity-30"
        >
          <ChevronLeft className="size-4" />
        </button>
        <span className="text-muted-foreground text-sm">
          {index + 1} / {data.slides.length}
        </span>
        <button
          onClick={() => setIndex((i) => Math.min(data.slides.length - 1, i + 1))}
          disabled={index === data.slides.length - 1}
          className="flex size-9 items-center justify-center rounded-full border transition-colors hover:bg-accent disabled:opacity-30"
        >
          <ChevronRight className="size-4" />
        </button>
      </div>
    </div>
  )
}
