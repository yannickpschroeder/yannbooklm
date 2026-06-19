"use server"

import { auth } from "@/lib/auth"
import { db } from "@/db"
import { notebooks } from "@/db/schema"
import { and, eq } from "drizzle-orm"
import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { z } from "zod"

async function requireUser() {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")
  return session.user.id
}

const nameSchema = z.string().min(1).max(100)

export async function createNotebook(formData: FormData) {
  const userId = await requireUser()
  const name = nameSchema.parse(formData.get("name"))

  await db.insert(notebooks).values({ userId, name })
  revalidatePath("/[locale]/app", "page")
}

export async function renameNotebook(id: string, formData: FormData) {
  const userId = await requireUser()
  const name = nameSchema.parse(formData.get("name"))

  await db
    .update(notebooks)
    .set({ name, updatedAt: new Date() })
    .where(and(eq(notebooks.id, id), eq(notebooks.userId, userId)))

  revalidatePath("/[locale]/app", "page")
}

export async function deleteNotebook(id: string) {
  const userId = await requireUser()

  await db
    .delete(notebooks)
    .where(and(eq(notebooks.id, id), eq(notebooks.userId, userId)))

  revalidatePath("/[locale]/app", "page")
}
