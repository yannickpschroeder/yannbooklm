/**
 * Exports child chunk embeddings from the dev DB into test fixture files.
 * Usage: npx tsx scripts/export-embeddings.ts <source-title-fragment> <output-fixture>
 *
 * Example:
 *   npx tsx scripts/export-embeddings.ts kreta tests/fixtures/kreta-embeddings.json
 */
import postgres from "postgres"
import fs from "fs"
import path from "path"
import { config } from "dotenv"

config()

const [, , titleFragment, outputFile] = process.argv
if (!titleFragment || !outputFile) {
  console.error("Usage: npx tsx scripts/export-embeddings.ts <title-fragment> <output-file>")
  process.exit(1)
}

async function main() {
  const sql = postgres(process.env.DATABASE_URL!, { max: 1 })

  try {
    const rows = await sql<{ content: string; embedding: string }[]>`
      SELECT cc.content, cc.embedding::text
      FROM child_chunks cc
      JOIN sources s ON s.id = cc.source_id
      WHERE lower(s.title) LIKE ${"%" + titleFragment.toLowerCase() + "%"}
      ORDER BY cc.position_start
    `

    if (rows.length === 0) {
      console.error(`No child chunks found for title fragment: "${titleFragment}"`)
      console.error("Make sure the source has been ingested in the dev environment first.")
      process.exit(1)
    }

    const fixtures = rows.map((r) => ({
      content: r.content,
      embedding: r.embedding,
    }))

    const outPath = path.resolve(outputFile)
    fs.writeFileSync(outPath, JSON.stringify(fixtures, null, 2))
    console.log(`✓ Exported ${rows.length} embeddings → ${outPath}`)
  } finally {
    await sql.end()
  }
}

main().catch((err) => { console.error(err); process.exit(1) })
