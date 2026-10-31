// Apple App Attest: only real installs of Shiori can send reports.
// https://developer.apple.com/documentation/devicecheck/validating-apps-that-connect-to-your-server

import { createHash, createPublicKey, createVerify, X509Certificate } from "node:crypto";
import { decode } from "cbor-x";
import { APPLE_ROOT } from "./root.js";

const sha256 = (...parts: Buffer[]) => createHash("sha256").update(Buffer.concat(parts)).digest();

/** "TEAMID.com.owencramer.vnhub", set in the project's environment. */
function appID(): string {
  const id = process.env.APP_ATTEST_APP_ID;
  if (!id) throw new Error("APP_ATTEST_APP_ID isn't set");
  return id;
}

/** Production keys (TestFlight, App Store) and development keys (Xcode installs). */
const AAGUIDS = [Buffer.from("appattest\0\0\0\0\0\0\0"), Buffer.from("appattestdevelop")];

interface AuthData {
  rpIdHash: Buffer;
  counter: number;
  aaguid?: Buffer;
  credentialId?: Buffer;
}

function parseAuthData(data: Buffer, attested: boolean): AuthData {
  const parsed: AuthData = { rpIdHash: data.subarray(0, 32), counter: data.readUInt32BE(33) };
  if (attested) {
    parsed.aaguid = data.subarray(37, 53);
    const length = data.readUInt16BE(53);
    parsed.credentialId = data.subarray(55, 55 + length);
  }
  return parsed;
}

/** The App Attest nonce extension's value in the certificate's DER (an OCTET STRING holding
 * SEQUENCE { [1] { OCTET STRING nonce } }): the nonce is its last 32 bytes. */
function nonceExtension(cert: X509Certificate): Buffer | undefined {
  const oid = Buffer.from("06092a864886f763640802", "hex"); // 1.2.840.113635.100.8.2
  const raw = cert.raw;
  const at = raw.indexOf(oid);
  if (at < 0) return undefined;
  const octet = raw.indexOf(0x04, at + oid.length);
  return raw.subarray(octet + 2, octet + 2 + raw[octet + 1]);
}

export interface AttestedKey {
  publicKey: string; // SPKI PEM
  counter: number;
}

/** Checks an attestation for `keyId` made over SHA256(`challenge`); returns the key to keep. */
export function verifyAttestation(attestationB64: string, keyIdB64: string, challenge: string): AttestedKey {
  const object = decode(Buffer.from(attestationB64, "base64")) as {
    fmt: string;
    attStmt: { x5c: Uint8Array[] };
    authData: Uint8Array;
  };
  if (object.fmt !== "apple-appattest") throw new Error("not an App Attest attestation");
  const [leaf, intermediate] = object.attStmt.x5c.map((der) => new X509Certificate(Buffer.from(der)));
  const root = new X509Certificate(APPLE_ROOT);
  if (!intermediate.verify(root.publicKey) || !leaf.verify(intermediate.publicKey)) throw new Error("certificate chain");
  const now = Date.now();
  for (const cert of [leaf, intermediate]) {
    if (now < Date.parse(cert.validFrom) || now > Date.parse(cert.validTo)) throw new Error("certificate dates");
  }

  const authData = Buffer.from(object.authData);
  const clientDataHash = sha256(Buffer.from(challenge, "utf8"));
  const nonce = sha256(authData, clientDataHash);
  const ext = nonceExtension(leaf);
  if (!ext || !ext.subarray(ext.length - 32).equals(nonce)) throw new Error("nonce");

  const jwk = leaf.publicKey.export({ format: "jwk" }) as { x: string; y: string };
  const point = Buffer.concat([Buffer.from([4]), Buffer.from(jwk.x, "base64url"), Buffer.from(jwk.y, "base64url")]);
  const keyId = Buffer.from(keyIdB64, "base64");
  if (!sha256(point).equals(keyId)) throw new Error("key id");

  const parsed = parseAuthData(authData, true);
  if (!parsed.rpIdHash.equals(sha256(Buffer.from(appID())))) throw new Error("app id");
  if (parsed.counter !== 0) throw new Error("counter");
  if (!AAGUIDS.some((id) => id.equals(parsed.aaguid!))) throw new Error("aaguid");
  if (!parsed.credentialId!.equals(keyId)) throw new Error("credential id");

  return { publicKey: leaf.publicKey.export({ format: "pem", type: "spki" }).toString(), counter: 0 };
}

/** Checks an assertion over `body` by the key; returns its new counter. */
export function verifyAssertion(assertionB64: string, body: Buffer, key: AttestedKey): number {
  const object = decode(Buffer.from(assertionB64, "base64")) as { signature: Uint8Array; authenticatorData: Uint8Array };
  const authData = Buffer.from(object.authenticatorData);
  const nonce = sha256(authData, sha256(body));
  const verifier = createVerify("SHA256");
  verifier.update(nonce);
  if (!verifier.verify(createPublicKey(key.publicKey), Buffer.from(object.signature))) throw new Error("signature");
  const parsed = parseAuthData(authData, false);
  if (!parsed.rpIdHash.equals(sha256(Buffer.from(appID())))) throw new Error("app id");
  if (parsed.counter <= key.counter) throw new Error("counter");
  return parsed.counter;
}
