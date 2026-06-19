"use client"

import { signIn } from "next-auth/react"
import { Button } from "@/components/ui/button"
import { FaGithub, FaGoogle } from "react-icons/fa"

export function SignInWithGoogle({ label }: { label: string }) {
  return (
    <Button
      variant="outline"
      className="w-full gap-2"
      onClick={() => signIn("google", { callbackUrl: "/app" })}
    >
      <FaGoogle className="size-4" />
      {label}
    </Button>
  )
}

export function SignInWithGitHub({ label }: { label: string }) {
  return (
    <Button
      variant="outline"
      className="w-full gap-2"
      onClick={() => signIn("github", { callbackUrl: "/app" })}
    >
      <FaGithub className="size-4" />
      {label}
    </Button>
  )
}
