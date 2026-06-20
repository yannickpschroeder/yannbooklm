import { execSync } from "child_process"
import fs from "fs"
import path from "path"

export default async function globalTeardown() {
  execSync("docker compose -f docker-compose.test.yml down -v", {
    stdio: "inherit",
    cwd: path.join(__dirname, ".."),
  })
  const stateFile = path.join(__dirname, ".auth-state.local.json")
  if (fs.existsSync(stateFile)) fs.unlinkSync(stateFile)
}
