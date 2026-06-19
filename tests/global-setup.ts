import postgres from "postgres"
import { randomUUID } from "crypto"
import fs from "fs"
import path from "path"
import { config } from "dotenv"
import { encode } from "next-auth/jwt"

config()

export const TEST_USER_EMAIL = "playwright@yannbooklm.test"
export const TEST_USER_NAME = "Playwright Test"

export default async function globalSetup() {
  const sql = postgres(process.env.DATABASE_URL!, { max: 1 })

  let userId: string

  try {
    const [user] = await sql<{ id: string }[]>`
      INSERT INTO users (id, name, email, email_verified)
      VALUES (${randomUUID()}, ${TEST_USER_NAME}, ${TEST_USER_EMAIL}, NOW())
      ON CONFLICT (email) DO UPDATE SET name = ${TEST_USER_NAME}
      RETURNING id
    `
    userId = user.id
  } finally {
    await sql.end()
  }

  // Create a real NextAuth JWT (same format as the app uses)
  const token = await encode({
    token: {
      sub: userId,
      name: TEST_USER_NAME,
      email: TEST_USER_EMAIL,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60,
      jti: randomUUID(),
    },
    secret: process.env.AUTH_SECRET!,
    salt: "authjs.session-token",
  })

  const state = {
    cookies: [
      {
        name: "authjs.session-token",
        value: token,
        domain: "localhost",
        path: "/",
        httpOnly: true,
        secure: false,
        sameSite: "Lax" as const,
      },
    ],
    origins: [],
  }

  fs.writeFileSync(path.join(__dirname, ".auth-state.json"), JSON.stringify(state, null, 2))
  console.log(`[playwright] Test user ready: ${TEST_USER_EMAIL} (userId: ${userId})`)
}
