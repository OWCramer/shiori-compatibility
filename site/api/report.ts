// An install's report for one game: the body is signed by its App Attest key
// (headers X-Key-ID and X-Assertion). The install's latest report per game is kept.

import { verifyAssertion } from "./_lib/attest.js";
import { gameReports, gamesSet, keyRecord, loadKey, parseReport, redis, withinLimit } from "./_lib/store.js";

export async function POST(request: Request): Promise<Response> {
  const keyId = request.headers.get("x-key-id");
  const assertion = request.headers.get("x-assertion");
  const body = Buffer.from(await request.arrayBuffer());
  if (!keyId || !assertion || body.length > 4_000) return new Response("bad request", { status: 400 });
  const key = await loadKey(keyId);
  if (!key) return new Response("unknown key", { status: 401 });
  if (!(await withinLimit(keyId))) return new Response("too many", { status: 429 });
  try {
    key.counter = verifyAssertion(assertion, body, key);
  } catch (error) {
    return new Response(`assertion: ${(error as Error).message}`, { status: 403 });
  }
  let report;
  try {
    report = parseReport(JSON.parse(body.toString("utf8")));
  } catch {
    report = null;
  }
  if (!report) return new Response("bad report", { status: 400 });
  await redis.set(keyRecord(keyId), key);
  await redis.hset(gameReports(report.appID), { [keyId]: report });
  await redis.sadd(gamesSet, report.appID);
  return new Response(null, { status: 204 });
}
