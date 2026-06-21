"use client"

import { useState } from "react"
import { useTranslations } from "next-intl"
import { Link2, Link2Off, MessageSquare, Layers, Check } from "lucide-react"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import type { NotebookShareScope } from "@/db/schema"

const SCOPE_OPTIONS: { scope: NotebookShareScope; icon: React.ElementType; labelKey: string }[] = [
  { scope: "sources_chat",        icon: MessageSquare, labelKey: "shareScope_sources_chat" },
  { scope: "sources_chat_studio", icon: Layers,        labelKey: "shareScope_sources_chat_studio" },
]

export function SharePopover({
  notebookId,
  initialToken,
  initialScope,
  children,
}: {
  notebookId: string
  initialToken: string | null
  initialScope: string | null
  children: React.ReactNode
}) {
  const t = useTranslations("header")
  const [token, setToken] = useState<string | null>(initialToken)
  const [activeScope, setActiveScope] = useState<NotebookShareScope>(
    (initialScope as NotebookShareScope) ?? "sources_chat"
  )
  const [loadingScope, setLoadingScope] = useState<NotebookShareScope | null>(null)
  const [copiedScope, setCopiedScope] = useState<NotebookShareScope | null>(null)

  async function handleScopeClick(scope: NotebookShareScope) {
    setLoadingScope(scope)
    try {
      const res = await fetch(`/api/notebooks/${notebookId}/share`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scope }),
      })
      if (!res.ok) throw new Error()
      const { token: newToken } = (await res.json()) as { token: string }
      setToken(newToken)
      setActiveScope(scope)
      const url = `${window.location.origin}/share/n/${newToken}`
      await navigator.clipboard.writeText(url)
      setCopiedScope(scope)
      toast.success(t("shareLinkCopied"))
      setTimeout(() => setCopiedScope(null), 2000)
    } catch {
      toast.error(t("shareError"))
    } finally {
      setLoadingScope(null)
    }
  }

  async function handleRevoke() {
    try {
      await fetch(`/api/notebooks/${notebookId}/share`, { method: "DELETE" })
      setToken(null)
      toast.success(t("shareRevoked"))
    } catch {
      toast.error(t("shareError"))
    }
  }

  return (
    <Popover>
      <PopoverTrigger render={children as React.ReactElement} />
      <PopoverContent align="end" className="w-72 p-0">
        <div className="px-3 pt-3 pb-1">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{t("shareModalTitle")}</p>
        </div>

        <div className="flex flex-col py-1">
          {SCOPE_OPTIONS.map(({ scope, icon: Icon, labelKey }) => {
            const isActive = token && activeScope === scope
            const isCopied = copiedScope === scope
            const isLoading = loadingScope === scope

            return (
              <button
                key={scope}
                onClick={() => handleScopeClick(scope)}
                disabled={isLoading !== false && loadingScope !== null}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 text-left text-sm transition-colors hover:bg-accent disabled:opacity-50",
                  isActive && "text-foreground"
                )}
              >
                <span className={cn(
                  "flex size-8 shrink-0 items-center justify-center rounded-md border",
                  isActive ? "border-primary/30 bg-primary/10 text-primary" : "border-border bg-muted/50 text-muted-foreground"
                )}>
                  <Icon className="size-4" />
                </span>
                <span className="flex-1 leading-tight">
                  {t(labelKey as Parameters<typeof t>[0])}
                </span>
                {isCopied
                  ? <Check className="size-3.5 shrink-0 text-green-500" />
                  : isActive
                    ? <Link2 className="size-3.5 shrink-0 text-muted-foreground" />
                    : null}
              </button>
            )
          })}
        </div>

        <div className="border-t px-3 py-2">
          <p className="text-xs text-muted-foreground">{t("shareNote")}</p>
        </div>

        {token && (
          <div className="border-t px-3 py-2">
            <button
              onClick={handleRevoke}
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-destructive transition-colors"
            >
              <Link2Off className="size-3.5" />
              {t("shareRevokeLink")}
            </button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  )
}
