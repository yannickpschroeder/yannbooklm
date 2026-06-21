"use client"

import { useEffect, useRef, useState } from "react"
import { useTranslations } from "next-intl"
import { Button } from "@/components/ui/button"
import { Play, Pause, ChevronDown, ChevronUp } from "lucide-react"
import { cn } from "@/lib/utils"
import type { AudioData } from "@/app/api/studio/audio/route"

interface Props {
  outputId: string
  data: AudioData
}

export function AudioPlayer({ outputId, data }: Props) {
  const t = useTranslations("audio")
  const audioRef = useRef<HTMLAudioElement | null>(null)

  const [urls, setUrls] = useState<string[]>([])
  const [loadingUrls, setLoadingUrls] = useState(true)
  const [currentIdx, setCurrentIdx] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [scriptOpen, setScriptOpen] = useState(false)

  useEffect(() => {
    setLoadingUrls(true)
    fetch(`/api/studio/audio/${outputId}`)
      .then((r) => r.json())
      .then((d) => {
        setUrls(d.urls ?? [])
        setLoadingUrls(false)
      })
  }, [outputId])

  useEffect(() => {
    const audio = audioRef.current
    if (!audio || urls.length === 0) return

    audio.src = urls[currentIdx] ?? ""
    audio.load()

    if (playing) {
      audio.play().catch(() => setPlaying(false))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentIdx, urls])

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return

    function onTimeUpdate() {
      setCurrentTime(audio!.currentTime)
    }
    function onDurationChange() {
      setDuration(audio!.duration || 0)
    }
    function onEnded() {
      if (currentIdx < urls.length - 1) {
        setCurrentIdx((i) => i + 1)
      } else {
        setPlaying(false)
        setCurrentIdx(0)
      }
    }

    audio.addEventListener("timeupdate", onTimeUpdate)
    audio.addEventListener("durationchange", onDurationChange)
    audio.addEventListener("ended", onEnded)
    return () => {
      audio.removeEventListener("timeupdate", onTimeUpdate)
      audio.removeEventListener("durationchange", onDurationChange)
      audio.removeEventListener("ended", onEnded)
    }
  }, [currentIdx, urls.length])

  function togglePlay() {
    const audio = audioRef.current
    if (!audio) return
    if (playing) {
      audio.pause()
      setPlaying(false)
    } else {
      audio.play().catch(() => {})
      setPlaying(true)
    }
  }

  function handleSeek(e: React.ChangeEvent<HTMLInputElement>) {
    const audio = audioRef.current
    if (!audio) return
    audio.currentTime = Number(e.target.value)
  }

  function formatTime(s: number) {
    if (!isFinite(s)) return "0:00"
    const m = Math.floor(s / 60)
    const sec = Math.floor(s % 60)
    return `${m}:${sec.toString().padStart(2, "0")}`
  }

  const currentTurn = data.turns[currentIdx]

  return (
    <div className="flex flex-col gap-4 p-4">
      <audio ref={audioRef} />

      {/* Speaker indicator */}
      <div className="flex items-center gap-3">
        <div
          className={cn(
            "flex size-10 shrink-0 items-center justify-center rounded-full text-sm font-semibold",
            currentTurn?.speaker === "A"
              ? "bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300"
              : "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300"
          )}
        >
          {currentTurn?.speaker === "A" ? t("hostA") : t("hostB")}
        </div>
        <p className="text-muted-foreground line-clamp-3 text-xs leading-relaxed">
          {currentTurn?.text ?? ""}
        </p>
      </div>

      {/* Progress bar */}
      <div className="flex flex-col gap-1">
        <input
          type="range"
          min={0}
          max={duration || 1}
          value={currentTime}
          onChange={handleSeek}
          className="h-1.5 w-full cursor-pointer accent-violet-500"
          disabled={loadingUrls}
        />
        <div className="text-muted-foreground flex justify-between text-[10px]">
          <span>{formatTime(currentTime)}</span>
          <span>
            {t("segmentOf", { current: currentIdx + 1, total: data.segments.length })}
          </span>
          <span>{formatTime(duration)}</span>
        </div>
      </div>

      {/* Controls */}
      <div className="flex justify-center">
        <Button
          size="icon"
          variant="outline"
          className="size-12 rounded-full"
          onClick={togglePlay}
          disabled={loadingUrls || urls.length === 0}
        >
          {playing ? <Pause className="size-5" /> : <Play className="size-5" />}
        </Button>
      </div>

      {/* Script toggle */}
      <button
        onClick={() => setScriptOpen((o) => !o)}
        className="text-muted-foreground hover:text-foreground flex items-center gap-1 self-center text-xs transition-colors"
      >
        {scriptOpen ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />}
        {scriptOpen ? t("scriptHide") : t("scriptShow")}
      </button>

      {scriptOpen && (
        <div className="border-border flex flex-col gap-3 rounded-lg border p-3">
          {data.turns.map((turn, i) => (
            <div
              key={i}
              className={cn(
                "flex gap-2 rounded-lg px-2 py-1.5 text-xs leading-relaxed transition-colors",
                i === currentIdx && "bg-violet-50 dark:bg-violet-900/20"
              )}
            >
              <span
                className={cn(
                  "mt-0.5 shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-semibold",
                  turn.speaker === "A"
                    ? "bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300"
                    : "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300"
                )}
              >
                {turn.speaker === "A" ? t("hostA") : t("hostB")}
              </span>
              <p className="text-foreground">{turn.text}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
