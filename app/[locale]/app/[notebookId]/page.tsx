import { auth } from "@/lib/auth"
import { redirect, notFound } from "next/navigation"
import { db } from "@/db"
import { notebooks } from "@/db/schema"
import { and, eq } from "drizzle-orm"

export default async function NotebookPage({
  params,
}: {
  params: Promise<{ notebookId: string; locale: string }>
}) {
  const { notebookId } = await params
  const session = await auth()
  if (!session?.user?.id) redirect("/login")

  const [notebook] = await db
    .select()
    .from(notebooks)
    .where(and(eq(notebooks.id, notebookId), eq(notebooks.userId, session.user.id)))
    .limit(1)

  if (!notebook) notFound()

  return (
    <div className="flex h-[calc(100vh-3.5rem)] items-center justify-center text-muted-foreground">
      <p>{notebook.name} — coming in Issue #8</p>
    </div>
  )
}
