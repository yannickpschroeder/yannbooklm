import { PollyClient } from "@aws-sdk/client-polly"

export const polly = new PollyClient({
  // Note: Nicht alle Regionen haben Zugriff auf die neuesten KI-Stimmen. AWS_REGION klappt nicht.
  region: "eu-west-1",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
})
