"use client"

import { useState } from "react"
import { toast } from "sonner"
import { Globe, Loader2 } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

type State = "idle" | "processing" | "done" | "error"

function isValidUrl(value: string): boolean {
  try {
    const u = new URL(value)
    return u.protocol === "http:" || u.protocol === "https:"
  } catch {
    return false
  }
}

export function AddUrlDialog({
  notebookId,
  open,
  onOpenChange,
}: {
  notebookId: string
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const [url, setUrl] = useState("")
  const [state, setState] = useState<State>("idle")

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!isValidUrl(url)) {
      toast.error("Bitte eine gültige http/https-URL eingeben")
      return
    }

    setState("processing")
    try {
      const res = await fetch("/api/sources", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notebookId, type: "url", url }),
      })
      if (!res.ok) {
        const { error } = (await res.json()) as { error?: string }
        throw new Error(error ?? "Unbekannter Fehler")
      }
      const { sourceId } = (await res.json()) as { sourceId: string }
      await pollStatus(sourceId)
      setState("done")
      toast.success("Webseite wurde hinzugefügt")
      setUrl("")
      onOpenChange(false)
      window.location.reload()
    } catch (err) {
      console.error(err)
      setState("error")
      toast.error(err instanceof Error ? err.message : "Fehler beim Hinzufügen der URL")
    }
  }

  async function pollStatus(sourceId: string) {
    for (let i = 0; i < 120; i++) {
      await new Promise((r) => setTimeout(r, 2000))
      const res = await fetch(`/api/sources/${sourceId}/status`)
      if (!res.ok) continue
      const { status } = (await res.json()) as { status: string }
      if (status === "ready") return
      if (status === "error") throw new Error("Ingestion fehlgeschlagen")
    }
    throw new Error("Timeout beim Verarbeiten der URL")
  }

  const isLoading = state === "processing"

  return (
    <Dialog open={open} onOpenChange={isLoading ? undefined : onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Webseite hinzufügen</DialogTitle>
        </DialogHeader>

        {state === "processing" ? (
          <div className="flex flex-col items-center gap-4 py-8">
            <Loader2 className="size-10 animate-spin text-primary" />
            <div className="space-y-1 text-center">
              <p className="text-sm font-medium">Webseite wird verarbeitet…</p>
              <p className="text-xs text-muted-foreground">
                Inhalt wird gelesen und indiziert
              </p>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
              <div className="h-full w-full animate-pulse bg-primary" />
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label htmlFor="url" className="text-sm font-medium">URL</label>
              <div className="relative">
                <Globe className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
                <Input
                  id="url"
                  type="url"
                  placeholder="https://example.com/artikel"
                  value={url}
                  onChange={(e) => {
                    setUrl(e.target.value)
                    if (state === "error") setState("idle")
                  }}
                  className="pl-9"
                  required
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Unterstützt Blog-Posts, Artikel und Dokumentation.
                JavaScript-gerenderte SPAs werden möglicherweise nicht vollständig
                unterstützt.
              </p>
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Abbrechen
              </Button>
              <Button type="submit" disabled={!url || isLoading}>
                Hinzufügen
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}
