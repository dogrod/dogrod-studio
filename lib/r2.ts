import { S3Client } from "@aws-sdk/client-s3";

import { getEnv } from "@/lib/env";

const env = getEnv();

let client: S3Client | null = null;

export function getR2Client() {
  if (!client) {
    client = new S3Client({
      region: "auto",
      endpoint: env.R2_ENDPOINT,
      credentials: {
        accessKeyId: env.R2_ACCESS_KEY_ID,
        secretAccessKey: env.R2_SECRET_ACCESS_KEY,
      },
    });
  }
  return client;
}

export function getR2Bucket() {
  return env.R2_BUCKET;
}

export function getR2PublicBaseUrl() {
  return env.R2_PUBLIC_BASE_URL.replace(/\/+$/, "");
}
