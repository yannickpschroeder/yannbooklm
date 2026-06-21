"use client"

import { useEffect, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { Play, Pause, ChevronDown, ChevronUp } from "lucide-react"
import { cn } from "@/lib/utils"
import type { AudioData } from "@/app/api/studio/audio/route"
import { useTranslations } from "next-intl"

export function SharedAudioClient({ shareToken, data }: { shareToken: string; data: AudioData }) {
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const t = useTranslations("audio")
  const [url, setUrl] = useState("")
  const [playing, setPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [scriptOpen, setScriptOpen] = useState(false)

  useEffect(() => {
    fetch(`/api/share/audio/${shareToken}`)
      .then((r) => r.json())
      .then((d) => setUrl(d.url ?? ""))
  }, [shareToken])

  useEffect(() => {
    const audio = audioRef.current
    if (!audio || !url) return
    audio.src = url
    audio.load()
  }, [url])

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return
    const onTimeUpdate = () => setCurrentTime(audio.currentTime)
    const onDurationChange = () => setDuration(audio.duration || 0)
    const onEnded = () => setPlaying(false)
    const onPause = () => setPlaying(false)
    const onPlay = () => setPlaying(true)
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
    return `${Math.floor(s / 60)}:${Math.floor(s % 60)
      .toString()
      .padStart(2, "0")}`
  }

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-6 px-6 py-10">
      <audio ref={audioRef} />

      <div className="flex flex-col gap-1">
        <input
          type="range"
          min={0}
          max={duration || 1}
          value={currentTime}
          onChange={handleSeek}
          className="h-1.5 w-full cursor-pointer accent-violet-500"
          disabled={!url}
        />
        <div className="text-muted-foreground flex justify-between text-xs">
          <span>{formatTime(currentTime)}</span>
          <span>{formatTime(duration)}</span>
        </div>
      </div>

      <div className="flex justify-center">
        <Button
          size="icon"
          variant="outline"
          className="size-14 rounded-full"
          onClick={togglePlay}
          disabled={!url}
        >
          {playing ? <Pause className="size-6" /> : <Play className="size-6" />}
        </Button>
      </div>

      <button
        onClick={() => setScriptOpen((o) => !o)}
        className="text-muted-foreground hover:text-foreground flex items-center gap-1 self-center text-sm transition-colors"
      >
        {scriptOpen ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
        {scriptOpen ? "Skript ausblenden" : "Skript anzeigen"}
      </button>

      {scriptOpen && (
        <div className="border-border flex flex-col gap-3 rounded-lg border p-4">
          {data.turns.map((turn, i) => (
            <div key={i} className="flex gap-3 text-sm leading-relaxed">
              <span
                className={cn(
                  "mt-0.5 shrink-0 content-center rounded-full px-2 py-0.5 text-xs font-semibold",
                  turn.speaker === "A"
                    ? "bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300"
                    : "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300"
                )}
              >
                {turn.speaker === "A" ? t("hostA") : t("hostB")}
              </span>
              <p>{turn.text}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
