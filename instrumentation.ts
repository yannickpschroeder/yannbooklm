export async function register() {
  if (process.env.E2E_TEST !== "true") return
  if (process.env.NEXT_RUNTIME !== "nodejs") return

  const { setupServer } = await import("msw/node")
  const { handlers } = await import("./tests/mocks/handlers")
  const server = setupServer(...handlers)
  server.listen({ onUnhandledRequest: "bypass" })
  console.log("[msw] Node server started for E2E_TEST mode")
}
