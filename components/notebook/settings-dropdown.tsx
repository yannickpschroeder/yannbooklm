"use client"

import { useState } from "react"
import { useTranslations } from "next-intl"
import { useTheme } from "next-themes"
import { Settings, MessageSquare, Globe, Sun, Moon, Monitor, Check } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
} from "@/components/ui/dropdown-menu"
import { FeedbackModal } from "./feedback-modal"
import { OutputLanguageModal } from "./output-language-modal"

export function SettingsDropdown({
  notebookId,
  outputLanguage,
}: {
  notebookId: string
  outputLanguage: string | null
}) {
  const t = useTranslations("settings")
  const { theme, setTheme } = useTheme()
  const [feedbackOpen, setFeedbackOpen] = useState(false)
  const [langOpen, setLangOpen] = useState(false)
  const [currentLang, setCurrentLang] = useState<string | null>(outputLanguage)

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger className="inline-flex h-8 items-center gap-1.5 rounded-md px-3 text-xs font-medium transition-colors hover:bg-accent hover:text-accent-foreground">
          <Settings className="size-3.5" />
          {t("title")}
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-52">
          <DropdownMenuItem onClick={() => setFeedbackOpen(true)}>
            <MessageSquare className="mr-2 size-4" />
            {t("feedback")}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setLangOpen(true)}>
            <Globe className="mr-2 size-4" />
            {t("outputLanguage")}
            {currentLang && (
              <span className="ml-auto text-xs text-muted-foreground">{currentLang.toUpperCase()}</span>
            )}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>
              {theme === "dark" ? (
                <Moon className="mr-2 size-4" />
              ) : theme === "light" ? (
                <Sun className="mr-2 size-4" />
              ) : (
                <Monitor className="mr-2 size-4" />
              )}
              {t("theme")}
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent>
              <DropdownMenuItem onClick={() => setTheme("light")}>
                <Sun className="mr-2 size-4" />
                {t("themeLight")}
                {theme === "light" && <Check className="ml-auto size-3.5" />}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setTheme("dark")}>
                <Moon className="mr-2 size-4" />
                {t("themeDark")}
                {theme === "dark" && <Check className="ml-auto size-3.5" />}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setTheme("system")}>
                <Monitor className="mr-2 size-4" />
                {t("themeSystem")}
                {theme === "system" && <Check className="ml-auto size-3.5" />}
              </DropdownMenuItem>
            </DropdownMenuSubContent>
          </DropdownMenuSub>
        </DropdownMenuContent>
      </DropdownMenu>

      <FeedbackModal open={feedbackOpen} onOpenChange={setFeedbackOpen} />
      <OutputLanguageModal
        open={langOpen}
        onOpenChange={setLangOpen}
        notebookId={notebookId}
        currentLanguage={currentLang}
        onSaved={setCurrentLang}
      />
    </>
  )
}
