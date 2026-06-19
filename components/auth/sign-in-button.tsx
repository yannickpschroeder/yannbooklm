"use client"

import { signIn } from "next-auth/react"
import { Button } from "@/components/ui/button"
import { FaGithub, FaGoogle } from "react-icons/fa"

export function SignInWithGoogle() {
  return (
    <Button
      variant="outline"
      className="w-full gap-2"
      onClick={() => signIn("google", { callbackUrl: "/app" })}
    >
      <FaGoogle className="size-4" />
      Continue with Google
    </Button>
  )
}

export function SignInWithGitHub() {
  return (
    <Button
      variant="outline"
      className="w-full gap-2"
      onClick={() => signIn("github", { callbackUrl: "/app" })}
    >
      <FaGithub className="size-4" />
      Continue with GitHub
    </Button>
  )
}
