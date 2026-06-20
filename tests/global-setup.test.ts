import { execSync } from "child_process"
import postgres from "postgres"
import { randomUUID } from "crypto"
import fs from "fs"
import path from "path"
import { encode } from "next-auth/jwt"
import {
  S3Client,
  CreateBucketCommand,
  PutBucketCorsCommand,
} from "@aws-sdk/client-s3"

export const TEST_USER_EMAIL = "playwright-local@yannbooklm.test"
export const TEST_USER_NAME = "Playwright Local"
export const TEST_BUCKET = "test-bucket"

export default async function globalSetup() {
  // 1. Start Docker services
  console.log("[setup] Starting Docker services…")
  execSync("docker compose -f docker-compose.test.yml up -d --wait", {
    stdio: "inherit",
    cwd: path.join(__dirname, ".."),
  })

  // 2. Run DB migrations
  console.log("[setup] Running DB migrations…")
  execSync("npm run db:push", {
    stdio: "inherit",
    env: {
      ...process.env,
      DATABASE_URL:
        "postgresql://postgres:postgres@localhost:5433/yannbooklm_test",
    },
    cwd: path.join(__dirname, ".."),
  })

  // 3. Create test user + JWT cookie
  const sql = postgres(
    "postgresql://postgres:postgres@localhost:5433/yannbooklm_test",
    { max: 1 }
  )
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
  fs.writeFileSync(
    path.join(__dirname, ".auth-state.local.json"),
    JSON.stringify(state, null, 2)
  )

  // 4. Set up LocalStack S3 bucket
  console.log("[setup] Creating LocalStack S3 bucket…")
  const s3 = new S3Client({
    region: "eu-central-1",
    endpoint: "http://localhost:4566",
    forcePathStyle: true,
    credentials: { accessKeyId: "test", secretAccessKey: "test" },
  })
  await s3.send(new CreateBucketCommand({ Bucket: TEST_BUCKET }))
  await s3.send(
    new PutBucketCorsCommand({
      Bucket: TEST_BUCKET,
      CORSConfiguration: {
        CORSRules: [
          {
            AllowedOrigins: ["http://localhost:3001"],
            AllowedMethods: ["PUT", "GET"],
            AllowedHeaders: ["*"],
          },
        ],
      },
    })
  )

  console.log(
    `[setup] Done — test user: ${TEST_USER_EMAIL} (userId: ${userId!})`
  )
}
