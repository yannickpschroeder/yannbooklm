"use server"

import { auth } from "@/lib/auth"
import { db } from "@/db"
import { notes, notebooks, messages } from "@/db/schema"
import { and, eq } from "drizzle-orm"
import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"

async function requireUser() {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")
  return session.user.id
}

async function requireNoteOwner(noteId: string, userId: string) {
  const [note] = await db
    .select({ id: notes.id })
    .from(notes)
    .innerJoin(notebooks, eq(notes.notebookId, notebooks.id))
    .where(and(eq(notes.id, noteId), eq(notebooks.userId, userId)))
    .limit(1)
  return note ?? null
}

export async function createNote(notebookId: string, content: string, sourceMessageId?: string) {
  const userId = await requireUser()

  const [notebook] = await db
    .select({ id: notebooks.id })
    .from(notebooks)
    .where(and(eq(notebooks.id, notebookId), eq(notebooks.userId, userId)))
    .limit(1)

  if (!notebook) return null

  // Validate sourceMessageId exists in DB before inserting (FK constraint)
  let validSourceMessageId: string | undefined
  if (sourceMessageId) {
    const [msg] = await db
      .select({ id: messages.id })
      .from(messages)
      .where(eq(messages.id, sourceMessageId))
      .limit(1)
    if (msg) validSourceMessageId = msg.id
  }

  const [note] = await db
    .insert(notes)
    .values({ notebookId, content, sourceMessageId: validSourceMessageId })
    .returning()

  revalidatePath(`/[locale]/app/${notebookId}`, "layout")
  return note
}

export async function updateNote(noteId: string, notebookId: string, content: string) {
  const userId = await requireUser()
  if (!(await requireNoteOwner(noteId, userId))) return

  await db.update(notes).set({ content, updatedAt: new Date() }).where(eq(notes.id, noteId))
  revalidatePath(`/[locale]/app/${notebookId}`, "layout")
}

export async function deleteNote(noteId: string, notebookId: string) {
  const userId = await requireUser()
  if (!(await requireNoteOwner(noteId, userId))) return

  await db.delete(notes).where(eq(notes.id, noteId))
  revalidatePath(`/[locale]/app/${notebookId}`, "layout")
}
