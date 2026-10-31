// Player reports in Upstash Redis (the Vercel Marketplace integration sets the variables).

import { Redis } from "@upstash/redis";
import type { AttestedKey } from "./attest.js";

export const redis = new Redis({
  url: process.env.KV_REST_API_URL ?? process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.KV_REST_API_TOKEN ?? process.env.UPSTASH_REDIS_REST_TOKEN!,
});

export const engines = ["renpy", "kirikiri", "artemis", "siglus", "luca", "catsystem2"] as const;
export const ratings = ["works", "issues", "broken"] as const;
export type Rating = (typeof ratings)[number];

/** One install's latest report for one game. The install is its App Attest key. */
export interface Report {
  appID: number;
  name: string;
  engine: (typeof engines)[number];
  engineVersion?: string;
  appVersion: string;
  device: string;
  os: string;
  minutes: number;
  sessions: number;
  failures: number;
  rating?: Rating;
  at: string;
}

export const keyRecord = (keyId: string) => `key:${keyId}`;
export const gameReports = (appID: number) => `reports:${appID}`;
export const gamesSet = "games";

export async function loadKey(keyId: string): Promise<AttestedKey | null> {
  return redis.get<AttestedKey>(keyRecord(keyId));
}

/** At most `limit` requests a day per install. */
export async function withinLimit(keyId: string, limit = 60): Promise<boolean> {
  const day = new Date().toISOString().slice(0, 10);
  const name = `rate:${keyId}:${day}`;
  const count = await redis.incr(name);
  if (count === 1) await redis.expire(name, 86400);
  return count <= limit;
}

/** A report as sent, checked field by field; null if anything's off. */
export function parseReport(value: unknown): Report | null {
  if (typeof value !== "object" || value === null) return null;
  const v = value as Record<string, unknown>;
  const text = (s: unknown, max: number) => (typeof s === "string" && s.length > 0 ? s.slice(0, max) : undefined);
  const count = (n: unknown, max: number) =>
    typeof n === "number" && Number.isInteger(n) && n >= 0 && n <= max ? n : undefined;
  const appID = count(v.appID, 10_000_000);
  const name = text(v.name, 120);
  const engine = engines.find((e) => e === v.engine);
  const appVersion = text(v.appVersion, 20);
  const device = text(v.device, 40);
  const os = text(v.os, 20);
  const minutes = count(v.minutes, 1_000_000);
  const sessions = count(v.sessions, 100_000);
  const failures = count(v.failures, 100_000);
  const rating = v.rating === undefined ? undefined : ratings.find((r) => r === v.rating);
  if (!appID || !name || !engine || !appVersion || !device || !os) return null;
  if (minutes === undefined || sessions === undefined || failures === undefined) return null;
  if (v.rating !== undefined && !rating) return null;
  return {
    appID, name, engine, engineVersion: text(v.engineVersion, 20), appVersion, device, os,
    minutes, sessions, failures, rating, at: new Date().toISOString(),
  };
}
