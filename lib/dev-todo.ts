export function devTodo(feature: string) {
  if (process.env.NODE_ENV !== "development") return
  fetch("/api/dev/todo", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message: feature }),
  }).catch(() => undefined)
}
