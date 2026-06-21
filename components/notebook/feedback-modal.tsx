"use client"

import { useState, useEffect } from "react"
import { useTranslations } from "next-intl"
import { Pencil, Trash2 } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"
import type { Feedback } from "@/db/schema"

function feedbackTitle(content: string) {
  const trimmed = content.trim()
  return trimmed.length <= 60 ? trimmed : trimmed.slice(0, 60) + "…"
}

export function FeedbackModal({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const t = useTranslations("settings")
  const tCommon = useTranslations("common")
  const [text, setText] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [items, setItems] = useState<Feedback[]>([])
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editText, setEditText] = useState("")

  useEffect(() => {
    if (!open) return
    fetch("/api/feedback")
      .then((r) => r.json())
      .then((data: Feedback[]) => setItems(data))
      .catch(() => undefined)
  }, [open])

  async function handleSubmit() {
    if (!text.trim()) return
    setSubmitting(true)
    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: text.trim() }),
      })
      if (!res.ok) throw new Error()
      const created = (await res.json()) as Feedback
      setItems((prev) => [created, ...prev])
      setText("")
      toast.success(t("feedbackCreateSuccess"))
    } catch {
      toast.error(t("feedbackError"))
    } finally {
      setSubmitting(false)
    }
  }

  function startEdit(item: Feedback) {
    setEditingId(item.id)
    setEditText(item.content)
  }

  async function saveEdit(id: string) {
    if (!editText.trim()) return
    try {
      const res = await fetch(`/api/feedback/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: editText.trim() }),
      })
      if (!res.ok) throw new Error()
      const updated = (await res.json()) as Feedback
      setItems((prev) => prev.map((f) => (f.id === id ? updated : f)))
      setEditingId(null)
      toast.success(t("feedbackUpdateSuccess"))
    } catch {
      toast.error(t("feedbackError"))
    }
  }

  async function handleDelete(id: string) {
    try {
      await fetch(`/api/feedback/${id}`, { method: "DELETE" })
      setItems((prev) => prev.filter((f) => f.id !== id))
      toast.success(t("feedbackDeleteSuccess"))
    } catch {
      toast.error(t("feedbackError"))
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[80vh] flex-col sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("feedbackModalTitle")}</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-2">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={t("feedbackPlaceholder")}
            rows={4}
            className="w-full resize-none rounded-md border bg-background px-3 py-2 text-sm outline-none placeholder:text-muted-foreground focus:ring-1 focus:ring-ring"
          />
          <Button onClick={handleSubmit} disabled={submitting || !text.trim()} className="self-end">
            {t("feedbackSubmit")}
          </Button>
        </div>

        <div className="mt-2 flex-1 overflow-y-auto">
          {items.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">{t("feedbackEmpty")}</p>
          ) : (
            <ul className="space-y-2">
              {items.map((item) => (
                <li key={item.id} className="group rounded-md border p-3">
                  {editingId === item.id ? (
                    <div className="flex flex-col gap-2">
                      <textarea
                        value={editText}
                        onChange={(e) => setEditText(e.target.value)}
                        rows={3}
                        className="w-full resize-none rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-ring"
                        autoFocus
                      />
                      <div className="flex justify-end gap-2">
                        <Button variant="outline" size="sm" onClick={() => setEditingId(null)}>{tCommon("cancel")}</Button>
                        <Button size="sm" onClick={() => saveEdit(item.id)} disabled={!editText.trim()}>{tCommon("save")}</Button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm">{feedbackTitle(item.content)}</p>
                      <div className="flex shrink-0 gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                        <button onClick={() => startEdit(item)} className="rounded p-1 hover:bg-muted">
                          <Pencil className="size-3.5 text-muted-foreground" />
                        </button>
                        <button onClick={() => handleDelete(item.id)} className="rounded p-1 hover:bg-muted">
                          <Trash2 className="size-3.5 text-destructive" />
                        </button>
                      </div>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
