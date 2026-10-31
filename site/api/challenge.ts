// A one-time challenge for registering an install's App Attest key (good for 5 minutes).

import { randomBytes } from "node:crypto";
import { redis } from "./_lib/store.js";

export async function POST(): Promise<Response> {
  const challenge = randomBytes(32).toString("base64url");
  await redis.set(`challenge:${challenge}`, 1, { ex: 300 });
  return Response.json({ challenge });
}
