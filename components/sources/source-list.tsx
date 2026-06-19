"use client"

import { useTranslations } from "next-intl"
import { toast } from "sonner"
import { useState } from "react"
import { FileText, Trash2, AlertCircle, CheckCircle2, Loader2, Clock } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { deleteSource } from "@/lib/actions/sources"
import type { Source } from "@/db/schema"

function StatusIcon({ status }: { status: Source["status"] }) {
  switch (status) {
    case "ready":
      return <CheckCircle2 className="size-3.5 text-green-500" />
    case "processing":
      return <Loader2 className="size-3.5 animate-spin text-blue-500" />
    case "error":
      return <AlertCircle className="size-3.5 text-destructive" />
    default:
      return <Clock className="size-3.5 text-muted-foreground" />
  }
}

export function SourceList({
  sources,
  notebookId,
}: {
  sources: Source[]
  notebookId: string
}) {
  const t = useTranslations("sources")
  const tc = useTranslations("common")
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  async function handleDelete() {
    if (!deletingId) return
    setPending(true)
    try {
      await deleteSource(deletingId, notebookId)
      toast.success(t("deleteSource"))
    } finally {
      setPending(false)
      setDeletingId(null)
    }
  }

  if (sources.length === 0) {
    return (
      <div className="flex flex-col items-center gap-1.5 px-4 py-8 text-center">
        <p className="text-sm font-medium text-muted-foreground">{t("noSources")}</p>
        <p className="text-xs text-muted-foreground">{t("noSourcesHint")}</p>
      </div>
    )
  }

  return (
    <>
      <ul className="space-y-1 p-2">
        {sources.map((source) => (
          <li
            key={source.id}
            className="group flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-muted"
          >
            <FileText className="size-4 shrink-0 text-muted-foreground" />
            <span className="flex-1 truncate text-sm">{source.title}</span>
            <StatusIcon status={source.status} />
            <Button
              variant="ghost"
              size="icon"
              className="size-6 shrink-0 opacity-0 transition-opacity group-hover:opacity-100"
              onClick={() => setDeletingId(source.id)}
            >
              <Trash2 className="size-3.5" />
            </Button>
          </li>
        ))}
      </ul>

      <AlertDialog open={!!deletingId} onOpenChange={(open) => !open && setDeletingId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("deleteSource")}</AlertDialogTitle>
            <AlertDialogDescription>{t("deleteSourceDescription")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{tc("cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={pending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {tc("delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
