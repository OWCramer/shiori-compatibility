// Totals per game from the players' reports, for the site and the daily status update.

import { gameReports, gamesSet, ratings, redis, type Report } from "./_lib/store.js";

export interface GameStats {
  appID: number;
  name: string;
  engine: string;
  players: number;
  hours: number;
  ratings: Record<string, number>;
}

export async function GET(): Promise<Response> {
  const ids = await redis.smembers(gamesSet);
  const games: GameStats[] = [];
  for (const id of ids) {
    const reports = Object.values((await redis.hgetall<Record<string, Report>>(gameReports(Number(id)))) ?? {});
    if (reports.length === 0) continue;
    const latest = reports.reduce((a, b) => (a.at > b.at ? a : b));
    const counts = Object.fromEntries(ratings.map((r) => [r, reports.filter((x) => x.rating === r).length]));
    games.push({
      appID: latest.appID,
      name: latest.name,
      engine: latest.engine,
      players: reports.length,
      hours: Math.round(reports.reduce((sum, r) => sum + r.minutes, 0) / 6) / 10,
      ratings: counts,
    });
  }
  games.sort((a, b) => a.appID - b.appID);
  return Response.json({ games }, { headers: { "Cache-Control": "public, s-maxage=600" } });
}
