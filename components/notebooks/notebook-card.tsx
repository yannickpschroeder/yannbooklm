"use client"

import { useState, useRef } from "react"
import { useTranslations } from "next-intl"
import { useLocale } from "next-intl"
import { toast } from "sonner"
import { MoreHorizontal, Pencil, Trash2, BookOpen } from "lucide-react"
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Link } from "@/i18n/navigation"
import { renameNotebook, deleteNotebook } from "@/lib/actions/notebooks"
import { buttonVariants } from "@/components/ui/button"
import type { Notebook } from "@/db/schema"

export function NotebookCard({ notebook }: { notebook: Notebook }) {
  const t = useTranslations("notebooks")
  const tc = useTranslations("common")
  const locale = useLocale()
  const [renameOpen, setRenameOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [pending, setPending] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  async function handleRename(formData: FormData) {
    setPending(true)
    try {
      await renameNotebook(notebook.id, formData)
      setRenameOpen(false)
      toast.success(t("renameSuccess"))
    } finally {
      setPending(false)
    }
  }

  async function handleDelete() {
    setPending(true)
    try {
      await deleteNotebook(notebook.id)
      toast.success(t("deleteSuccess"))
    } finally {
      setPending(false)
    }
  }

  const updatedAt = new Date(notebook.updatedAt).toLocaleDateString(locale, {
    day: "numeric",
    month: "short",
    year: "numeric",
  })

  return (
    <>
      <Card className="group flex flex-col transition-shadow hover:shadow-md">
        <CardHeader className="flex flex-row items-start justify-between gap-2 pb-2">
          <CardTitle className="line-clamp-2 text-base leading-snug">{notebook.name}</CardTitle>
          <DropdownMenu>
            <DropdownMenuTrigger
              className={buttonVariants({ variant: "ghost", size: "icon" }) + " size-7 shrink-0 opacity-0 transition-opacity group-hover:opacity-100"}
            >
              <MoreHorizontal className="size-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setRenameOpen(true)}>
                <Pencil className="mr-2 size-4" />
                {t("rename")}
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => setDeleteOpen(true)}
                className="text-destructive focus:text-destructive"
              >
                <Trash2 className="mr-2 size-4" />
                {t("delete")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </CardHeader>
        <CardContent className="flex-1" />
        <CardFooter className="flex items-center justify-between pt-0">
          <span className="text-xs text-muted-foreground">{updatedAt}</span>
          <Link
            href={`/app/${notebook.id}`}
            className={buttonVariants({ variant: "ghost", size: "sm" }) + " gap-1.5"}
          >
            <BookOpen className="size-3.5" />
            {t("openNotebook")}
          </Link>
        </CardFooter>
      </Card>

      {/* Rename Dialog */}
      <Dialog open={renameOpen} onOpenChange={setRenameOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("renameTitle")}</DialogTitle>
            <DialogDescription>{t("createDescription")}</DialogDescription>
          </DialogHeader>
          <form action={handleRename}>
            <Input
              ref={inputRef}
              name="name"
              defaultValue={notebook.name}
              placeholder={t("namePlaceholder")}
              autoFocus
              className="mt-2"
            />
            <DialogFooter className="mt-4">
              <Button type="button" variant="outline" onClick={() => setRenameOpen(false)}>
                {tc("cancel")}
              </Button>
              <Button type="submit" disabled={pending}>
                {tc("save")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("deleteTitle")}</AlertDialogTitle>
            <AlertDialogDescription>{t("deleteDescription")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{tc("cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={pending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {t("deleteConfirm")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
