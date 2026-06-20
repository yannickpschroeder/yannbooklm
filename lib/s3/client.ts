import { S3Client } from "@aws-sdk/client-s3"

export const s3 = new S3Client({
  region: process.env.AWS_REGION ?? "eu-central-1",
  ...(process.env.S3_ENDPOINT ? {
    endpoint: process.env.S3_ENDPOINT,
    forcePathStyle: true,
  } : {}),
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
  // AWS SDK v3 adds CRC32 checksums by default; LocalStack rejects them
  requestChecksumCalculation: "WHEN_REQUIRED",
  responseChecksumValidation: "WHEN_REQUIRED",
})

export const S3_BUCKET = (process.env.AWS_S3_BUCKET ?? process.env.S3_BUCKET)!
