"use client"

import { useState } from "react"
import { useTranslations } from "next-intl"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { RefreshCw, FileText, Globe, AlignLeft } from "lucide-react"
import { FaYoutube } from "react-icons/fa"
import { openSourceById } from "@/lib/source-view-event"

type View = "sources" | "customize"

type UsedSource = { id: string; title: string; type: string }

const SOURCE_ICONS: Record<string, React.ReactNode> = {
  pdf: <FileText className="size-3.5 text-red-500" />,
  url: <Globe className="size-3.5 text-blue-500" />,
  youtube: <FaYoutube className="size-3.5 text-red-500" />,
  text: <AlignLeft className="size-3.5 text-blue-400" />,
}

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  usedSources: UsedSource[]
  onGenerate: (focusTopic?: string) => void
}

export function MindmapSourcesModal({ open, onOpenChange, usedSources, onGenerate }: Props) {
  const t = useTranslations("studio")
  const [view, setView] = useState<View>("sources")
  const [focusTopic, setFocusTopic] = useState("")

  function handleGenerate() {
    onOpenChange(false)
    onGenerate(focusTopic.trim() || undefined)
    setView("sources")
  }

  function handleOpenChange(val: boolean) {
    if (!val) setView("sources")
    onOpenChange(val)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-lg">
        {view === "sources" ? (
          <>
            <DialogHeader>
              <div className="flex items-center gap-2">
                <FileText className="size-4" />
                <DialogTitle>{t("mindmapSourcesTitle")}</DialogTitle>
              </div>
              <button
                onClick={() => setView("customize")}
                className="hover:bg-muted absolute top-4 right-12 -mt-[6px] -mr-[8px] h-[26px] w-[26px] rounded-sm p-1 opacity-70 hover:opacity-100"
                aria-label={t("mindmapCustomizeAria")}
              >
                <RefreshCw className="size-4" />
              </button>
            </DialogHeader>
            <div className="flex flex-wrap gap-2 py-2">
              {usedSources.length === 0 ? (
                <p className="text-muted-foreground text-sm">{t("mindmapNoSourcesSaved")}</p>
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
              <DialogTitle>{t("mindmapCustomizeTitle")}</DialogTitle>
            </DialogHeader>
            <div className="flex flex-col gap-4 py-2">
              <div>
                <p className="mb-2 text-sm font-medium">{t("mindmapTopicLabel")}</p>
                <textarea
                  value={focusTopic}
                  onChange={(e) => setFocusTopic(e.target.value)}
                  placeholder={t("mindmapTopicPlaceholder")}
                  className="focus:ring-ring border-input bg-background min-h-32 w-full rounded-md border px-3 py-2 text-sm outline-none focus:ring-1"
                />
              </div>
              <div className="flex justify-end">
                <Button onClick={handleGenerate}>{t("mindmapGenerate")}</Button>
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
