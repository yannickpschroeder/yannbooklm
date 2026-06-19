import postgres from "postgres"
import fs from "fs"
import path from "path"
import { config } from "dotenv"
import { TEST_USER_EMAIL } from "./global-setup"

config()

export default async function globalTeardown() {
  const sql = postgres(process.env.DATABASE_URL!, { max: 1 })
  try {
    await sql`DELETE FROM users WHERE email = ${TEST_USER_EMAIL}`
  } finally {
    await sql.end()
  }

  const stateFile = path.join(__dirname, ".auth-state.json")
  if (fs.existsSync(stateFile)) fs.unlinkSync(stateFile)
}
