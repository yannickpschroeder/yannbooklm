import { PollyClient } from "@aws-sdk/client-polly"

export const polly = new PollyClient({
  region: process.env.AWS_REGION ?? "eu-central-1",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
})
