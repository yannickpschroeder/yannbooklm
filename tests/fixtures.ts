import { test as base } from "@playwright/test"
import fs from "fs"
import path from "path"

function readAuthState() {
  return JSON.parse(fs.readFileSync(path.join(__dirname, ".auth-state.json"), "utf-8"))
}

export const test = base.extend<object, object>({
  context: [
    async ({ context }, use) => {
      await context.addCookies(readAuthState().cookies)
      await use(context)
    },
    { scope: "test" },
  ],
})

export { expect } from "@playwright/test"
