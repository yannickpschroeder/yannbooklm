import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { db } from "@/db"
import { notebooks } from "@/db/schema"
import { eq, desc } from "drizzle-orm"
import { getTranslations } from "next-intl/server"
import { BookOpen } from "lucide-react"
import { NotebookCard } from "@/components/notebooks/notebook-card"
import { CreateNotebookDialog } from "@/components/notebooks/create-notebook-dialog"

export default async function DashboardPage() {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")

  const userNotebooks = await db
    .select()
    .from(notebooks)
    .where(eq(notebooks.userId, session.user.id))
    .orderBy(desc(notebooks.updatedAt))

  const t = await getTranslations("notebooks")

  return (
    <div className="mx-auto max-w-screen-xl px-4 py-8">
      <div className="mb-8 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">{t("title")}</h1>
        <CreateNotebookDialog />
      </div>

      {userNotebooks.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 py-24 text-center">
          <BookOpen className="size-12 text-muted-foreground/40" />
          <p className="font-medium text-muted-foreground">{t("empty")}</p>
          <p className="text-sm text-muted-foreground">{t("emptyDescription")}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {userNotebooks.map((notebook) => (
            <NotebookCard key={notebook.id} notebook={notebook} />
          ))}
        </div>
      )}
    </div>
  )
}
