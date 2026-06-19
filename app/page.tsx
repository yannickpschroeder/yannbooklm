import { redirect } from "next/navigation"

// next-intl middleware redirects / → /de automatically.
// This fallback ensures direct hits to / also work.
export default function RootPage() {
  redirect("/de")
}
