"use client"

import { useState } from "react"
import { useTranslations } from "next-intl"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { RefreshCw, FileText, Globe, AlignLeft, Check } from "lucide-react"
import { FaYoutube } from "react-icons/fa"
import { cn } from "@/lib/utils"
import { openSourceById } from "@/lib/source-view-event"
import type { AudioFormat, AudioLength } from "@/app/api/studio/audio/route"

type View = "sources" | "customize"
type UsedSource = { id: string; title: string; type: string }

const SOURCE_ICONS: Record<string, React.ReactNode> = {
  pdf: <FileText className="size-3.5 text-red-500" />,
  url: <Globe className="size-3.5 text-blue-500" />,
  youtube: <FaYoutube className="size-3.5 text-red-500" />,
  text: <AlignLeft className="size-3.5 text-blue-400" />,
}

const LANGUAGES = [
  "Deutsch", "English", "Español", "Français", "Italiano", "Português",
  "Nederlands", "Dansk", "Svenska", "Norsk", "Suomi", "Polski",
  "Čeština", "Русский", "日本語", "한국어", "中文", "العربية",
]

interface GenerateParams {
  format: AudioFormat
  language: string
  length: AudioLength
  focusTopic?: string
}

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  usedSources: UsedSource[]
  currentFormat?: AudioFormat
  currentLanguage?: string
  currentLength?: AudioLength
  onGenerate: (params: GenerateParams) => void
}

export function AudioSourcesModal({
  open,
  onOpenChange,
  usedSources,
  currentFormat,
  currentLanguage,
  currentLength,
  onGenerate,
}: Props) {
  const t = useTranslations("studio")
  const [view, setView] = useState<View>("sources")
  const [format, setFormat] = useState<AudioFormat>(currentFormat ?? "detailed-analysis")
  const [language, setLanguage] = useState(currentLanguage ?? "Deutsch")
  const [length, setLength] = useState<AudioLength>(currentLength ?? "standard")
  const [focusTopic, setFocusTopic] = useState("")

  function handleGenerate() {
    onOpenChange(false)
    onGenerate({ format, language, length, focusTopic: focusTopic.trim() || undefined })
    setView("sources")
  }

  function handleOpenChange(val: boolean) {
    if (!val) setView("sources")
    onOpenChange(val)
  }

  const formats: { id: AudioFormat; title: string; description: string }[] = [
    {
      id: "detailed-analysis",
      title: t("audioFormatDetailedTitle"),
      description: t("audioFormatDetailedDesc"),
    },
    {
      id: "summary",
      title: t("audioFormatSummaryTitle"),
      description: t("audioFormatSummaryDesc"),
    },
    {
      id: "critical-review",
      title: t("audioFormatCriticalTitle"),
      description: t("audioFormatCriticalDesc"),
    },
    {
      id: "discussion",
      title: t("audioFormatDiscussionTitle"),
      description: t("audioFormatDiscussionDesc"),
    },
  ]

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-3xl">
        {view === "sources" ? (
          <>
            <DialogHeader>
              <div className="flex items-center gap-2">
                <FileText className="size-4" />
                <DialogTitle>{t("audioSourcesTitle")}</DialogTitle>
              </div>
              <button
                onClick={() => setView("customize")}
                className="hover:bg-muted absolute top-4 right-12 -mt-[6px] -mr-[8px] h-[26px] w-[26px] rounded-sm p-1 opacity-70 hover:opacity-100"
                aria-label={t("audioCustomizeAria")}
              >
                <RefreshCw className="size-4" />
              </button>
            </DialogHeader>
            <div className="flex flex-wrap gap-2 py-2">
              {usedSources.length === 0 ? (
                <p className="text-muted-foreground text-sm">{t("audioNoSourcesSaved")}</p>
              ) : (
                usedSources.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => {
                      onOpenChange(false)
                      openSourceById(s.id)
                    }}
                    className="bg-muted/50 hover:bg-muted flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs transition-colors"
                  >
                    {SOURCE_ICONS[s.type] ?? <FileText className="size-3.5" />}
                    {s.title}
                  </button>
                ))
              )}
            </div>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>{t("audioCustomizeTitle")}</DialogTitle>
            </DialogHeader>
            <div className="flex flex-col gap-5 py-2">
              {/* Format cards */}
              <div>
                <p className="mb-3 text-sm font-medium">{t("audioFormatLabel")}</p>
                <div className="grid grid-cols-4 gap-3">
                  {formats.map((f) => (
                    <button
                      key={f.id}
                      onClick={() => setFormat(f.id)}
                      className={cn(
                        "relative flex flex-col gap-1.5 rounded-xl border-2 p-3 text-left transition-colors",
                        format === f.id
                          ? "border-primary bg-primary/5 dark:bg-primary/10"
                          : "border-border hover:border-muted-foreground/30"
                      )}
                    >
                      {format === f.id && (
                        <Check className="text-primary absolute top-2 right-2 size-3.5" />
                      )}
                      <span className="text-sm font-medium leading-tight">{f.title}</span>
                      <span className="text-muted-foreground text-[11px] leading-relaxed">
                        {f.description}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Language + Length row */}
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <p className="mb-2 text-sm font-medium">{t("audioLanguageLabel")}</p>
                  <select
                    value={language}
                    onChange={(e) => setLanguage(e.target.value)}
                    className="border-input bg-background text-foreground focus:ring-ring w-full rounded-md border px-3 py-2 text-sm outline-none focus:ring-1"
                  >
                    {LANGUAGES.map((l) => (
                      <option key={l} value={l}>{l}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <p className="mb-2 text-sm font-medium">{t("audioLengthLabel")}</p>
                  <div className="flex gap-2">
                    {(["short", "standard"] as AudioLength[]).map((l) => (
                      <button
                        key={l}
                        onClick={() => setLength(l)}
                        className={cn(
                          "flex items-center gap-1.5 rounded-full border px-4 py-2 text-sm transition-colors",
                          length === l
                            ? "border-primary bg-primary text-primary-foreground"
                            : "border-border hover:bg-muted"
                        )}
                      >
                        {length === l && <Check className="size-3" />}
                        {l === "short" ? t("audioLengthShort") : t("audioLengthStandard")}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Focus topic */}
              <div>
                <p className="mb-2 text-sm font-medium">{t("audioTopicLabel")}</p>
                <textarea
                  value={focusTopic}
                  onChange={(e) => setFocusTopic(e.target.value)}
                  placeholder={t("audioTopicPlaceholder")}
                  className="focus:ring-ring border-input bg-background min-h-24 w-full rounded-md border px-3 py-2 text-sm outline-none focus:ring-1"
                />
              </div>

              <div className="flex justify-end">
                <Button onClick={handleGenerate}>{t("audioGenerate")}</Button>
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
