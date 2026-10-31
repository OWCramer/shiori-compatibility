// Registers an install: its App Attest key, attested over a challenge from /api/challenge.

import { verifyAttestation } from "./_lib/attest.js";
import { keyRecord, redis } from "./_lib/store.js";

export async function POST(request: Request): Promise<Response> {
  let body: { keyId?: string; attestation?: string; challenge?: string };
  try {
    body = await request.json();
  } catch {
    return new Response("bad request", { status: 400 });
  }
  const { keyId, attestation, challenge } = body;
  if (!keyId || !attestation || !challenge || keyId.length > 100 || attestation.length > 20_000) {
    return new Response("bad request", { status: 400 });
  }
  if ((await redis.getdel(`challenge:${challenge}`)) === null) return new Response("challenge", { status: 403 });
  try {
    const key = verifyAttestation(attestation, keyId, challenge);
    await redis.set(keyRecord(keyId), key);
    return new Response(null, { status: 204 });
  } catch (error) {
    return new Response(`attestation: ${(error as Error).message}`, { status: 403 });
  }
}
