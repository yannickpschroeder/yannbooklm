"use client"

import { useRef, useState } from "react"
import { useTranslations } from "next-intl"
import { toast } from "sonner"
import { Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { createNotebook } from "@/lib/actions/notebooks"
import { buttonVariants } from "@/components/ui/button"

export function CreateNotebookDialog() {
  const t = useTranslations("notebooks")
  const tc = useTranslations("common")
  const [open, setOpen] = useState(false)
  const [pending, setPending] = useState(false)
  const formRef = useRef<HTMLFormElement>(null)

  async function handleSubmit(formData: FormData) {
    const name = (formData.get("name") as string).trim()
    if (!name) return
    setPending(true)
    try {
      await createNotebook(formData)
      setOpen(false)
      formRef.current?.reset()
      toast.success(t("createSuccess"))
    } finally {
      setPending(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        className={buttonVariants({ variant: "default" }) + " gap-2"}
      >
        <Plus className="size-4" />
        {t("create")}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("createTitle")}</DialogTitle>
          <DialogDescription>{t("createDescription")}</DialogDescription>
        </DialogHeader>
        <form ref={formRef} action={handleSubmit}>
          <Input name="name" placeholder={t("namePlaceholder")} autoFocus className="mt-2" />
          <DialogFooter className="mt-4">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              {tc("cancel")}
            </Button>
            <Button type="submit" disabled={pending}>
              {tc("create")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
