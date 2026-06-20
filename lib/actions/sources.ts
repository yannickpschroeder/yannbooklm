"use server"

import { auth } from "@/lib/auth"
import { db } from "@/db"
import { sources, notebooks } from "@/db/schema"
import { and, eq } from "drizzle-orm"
import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { DeleteObjectCommand } from "@aws-sdk/client-s3"
import { s3, S3_BUCKET } from "@/lib/s3/client"

async function requireUser() {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")
  return session.user.id
}

export async function renameSource(sourceId: string, notebookId: string, title: string) {
  const userId = await requireUser()

  const [source] = await db
    .select({ id: sources.id })
    .from(sources)
    .innerJoin(notebooks, eq(sources.notebookId, notebooks.id))
    .where(and(eq(sources.id, sourceId), eq(notebooks.userId, userId)))
    .limit(1)

  if (!source) return

  await db.update(sources).set({ title }).where(eq(sources.id, sourceId))
  revalidatePath(`/[locale]/app/${notebookId}`, "page")
}

export async function toggleSourceEnabled(sourceId: string, notebookId: string, enabled: boolean) {
  const userId = await requireUser()

  const [source] = await db
    .select({ id: sources.id })
    .from(sources)
    .innerJoin(notebooks, eq(sources.notebookId, notebooks.id))
    .where(and(eq(sources.id, sourceId), eq(notebooks.userId, userId)))
    .limit(1)

  if (!source) return

  await db.update(sources).set({ enabled }).where(eq(sources.id, sourceId))
  revalidatePath(`/[locale]/app/${notebookId}`, "page")
}

export async function deleteSource(sourceId: string, notebookId: string) {
  const userId = await requireUser()

  const [source] = await db
    .select({ id: sources.id, s3Key: sources.s3Key })
    .from(sources)
    .innerJoin(notebooks, eq(sources.notebookId, notebooks.id))
    .where(and(eq(sources.id, sourceId), eq(notebooks.userId, userId)))
    .limit(1)

  if (!source) return

  if (source.s3Key) {
    await s3.send(new DeleteObjectCommand({ Bucket: S3_BUCKET, Key: source.s3Key }))
  }

  await db.delete(sources).where(eq(sources.id, sourceId))
  revalidatePath(`/[locale]/app/${notebookId}`, "page")
}
