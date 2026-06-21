"use client"

import { useState } from "react"
import { useTranslations } from "next-intl"
import { Check } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export type ChatMode = "standard" | "learning" | "custom"
export type ChatLength = "standard" | "longer" | "shorter"

export interface ChatConfig {
  mode: ChatMode
  length: ChatLength
}

interface Props {
  open: boolean
  onOpenChange: (v: boolean) => void
  config: ChatConfig
  onSave: (config: ChatConfig) => void
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex items-center gap-1.5 rounded-full border px-4 py-1.5 text-sm transition-colors",
        active
          ? "border-primary bg-primary text-primary-foreground"
          : "border-border bg-transparent hover:bg-muted",
      )}
    >
      {active && <Check className="size-3.5" />}
      {children}
    </button>
  )
}

const MODE_DESCRIPTIONS: Record<ChatMode, string> = {
  standard: "configureModeStandardDesc",
  learning: "configureModeLearningDesc",
  custom: "configureModeCustomDesc",
}

export function ChatConfigModal({ open, onOpenChange, config, onSave }: Props) {
  const t = useTranslations("chat")
  const tCommon = useTranslations("common")
  const [mode, setMode] = useState<ChatMode>(config.mode)
  const [length, setLength] = useState<ChatLength>(config.length)

  function handleSave() {
    onSave({ mode, length })
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("configureTitle")}</DialogTitle>
        </DialogHeader>

        <p className="text-muted-foreground text-sm">{t("configureDescription")}</p>

        <div className="flex flex-col gap-5">
          {/* Mode */}
          <div className="flex flex-col gap-3">
            <p className="text-sm font-semibold">{t("configureGoalLabel")}</p>
            <div className="flex flex-wrap gap-2">
              <Chip active={mode === "standard"} onClick={() => setMode("standard")}>
                {t("configureModeStandard")}
              </Chip>
              <Chip active={mode === "learning"} onClick={() => setMode("learning")}>
                {t("configureModeLearning")}
              </Chip>
              <Chip active={mode === "custom"} onClick={() => setMode("custom")}>
                {t("configureModeCustom")}
              </Chip>
            </div>
            <p className="text-muted-foreground text-sm">
              {t(MODE_DESCRIPTIONS[mode] as Parameters<typeof t>[0])}
            </p>
          </div>

          {/* Length */}
          <div className="flex flex-col gap-3">
            <p className="text-sm font-semibold">{t("configureLengthLabel")}</p>
            <div className="flex flex-wrap gap-2">
              <Chip active={length === "standard"} onClick={() => setLength("standard")}>
                {t("configureLengthStandard")}
              </Chip>
              <Chip active={length === "longer"} onClick={() => setLength("longer")}>
                {t("configureLengthLonger")}
              </Chip>
              <Chip active={length === "shorter"} onClick={() => setLength("shorter")}>
                {t("configureLengthShorter")}
              </Chip>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button onClick={handleSave}>{tCommon("save")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
