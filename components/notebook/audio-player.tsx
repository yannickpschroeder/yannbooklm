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

  const [url, setUrl] = useState<string>("")
  const [loadingUrl, setLoadingUrl] = useState(true)
  const [playing, setPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [scriptOpen, setScriptOpen] = useState(false)

  useEffect(() => {
    setLoadingUrl(true)
    fetch(`/api/studio/audio/${outputId}`)
      .then((r) => r.json())
      .then((d) => {
        setUrl(d.url ?? "")
        setLoadingUrl(false)
      })
  }, [outputId])

  useEffect(() => {
    const audio = audioRef.current
    if (!audio || !url) return
    audio.src = url
    audio.load()
  }, [url])

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
      setPlaying(false)
    }
    function onPause() {
      setPlaying(false)
    }
    function onPlay() {
      setPlaying(true)
    }

    audio.addEventListener("timeupdate", onTimeUpdate)
    audio.addEventListener("durationchange", onDurationChange)
    audio.addEventListener("ended", onEnded)
    audio.addEventListener("pause", onPause)
    audio.addEventListener("play", onPlay)
    return () => {
      audio.removeEventListener("timeupdate", onTimeUpdate)
      audio.removeEventListener("durationchange", onDurationChange)
      audio.removeEventListener("ended", onEnded)
      audio.removeEventListener("pause", onPause)
      audio.removeEventListener("play", onPlay)
    }
  }, [])

  function togglePlay() {
    const audio = audioRef.current
    if (!audio) return
    if (playing) audio.pause()
    else audio.play().catch(() => {})
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

  return (
    <div className="flex flex-col gap-4 p-4">
      <audio ref={audioRef} />

      {/* Progress bar */}
      <div className="flex flex-col gap-1">
        <input
          type="range"
          min={0}
          max={duration || 1}
          value={currentTime}
          onChange={handleSeek}
          className="h-1.5 w-full cursor-pointer accent-violet-500"
          disabled={loadingUrl || !url}
        />
        <div className="text-muted-foreground flex justify-between text-[10px]">
          <span>{formatTime(currentTime)}</span>
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
          disabled={loadingUrl || !url}
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
            <div key={i} className="flex gap-2 text-xs leading-relaxed">
              <span
                className={cn(
                  "a mt-0.5 shrink-0 content-center rounded-full px-1.5 py-0.5 text-[10px] font-semibold",
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
