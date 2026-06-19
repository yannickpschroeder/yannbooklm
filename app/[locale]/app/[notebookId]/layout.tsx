import { auth } from "@/lib/auth"
import { redirect, notFound } from "next/navigation"
import { db } from "@/db"
import { notebooks } from "@/db/schema"
import { and, eq } from "drizzle-orm"
import { NotebookHeader } from "@/components/notebook/notebook-header"
import { SourceSidebar } from "@/components/notebook/source-sidebar"
import { StudioSidebar } from "@/components/notebook/studio-sidebar"

export default async function NotebookLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ notebookId: string }>
}) {
  const { notebookId } = await params
  const session = await auth()
  if (!session?.user?.id) redirect("/login")

  const [notebook] = await db
    .select({ id: notebooks.id, name: notebooks.name })
    .from(notebooks)
    .where(and(eq(notebooks.id, notebookId), eq(notebooks.userId, session.user.id)))
    .limit(1)

  if (!notebook) notFound()

  return (
    <div className="flex h-screen flex-col overflow-hidden">
      <NotebookHeader notebookName={notebook.name} />
      <div className="flex flex-1 overflow-hidden">
        <SourceSidebar />
        <main className="flex flex-1 overflow-hidden">{children}</main>
        <StudioSidebar />
      </div>
    </div>
  )
}
