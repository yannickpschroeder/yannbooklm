import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { SignInWithGitHub, SignInWithGoogle } from "@/components/auth/sign-in-button"
import { BookOpen } from "lucide-react"

export default async function LoginPage() {
  const session = await auth()
  if (session) redirect("/app")

  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <div className="mx-auto mb-2 flex size-10 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <BookOpen className="size-5" />
          </div>
          <CardTitle className="text-xl">YannBookLM</CardTitle>
          <CardDescription>Sign in to access your notebooks</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <SignInWithGoogle />
          <div className="flex items-center gap-2">
            <Separator className="flex-1" />
            <span className="text-xs text-muted-foreground">or</span>
            <Separator className="flex-1" />
          </div>
          <SignInWithGitHub />
        </CardContent>
      </Card>
    </main>
  )
}
