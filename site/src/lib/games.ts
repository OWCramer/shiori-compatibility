// Reads the engine files in the repository root at build time, so the site always matches the list.

export type Status = "complete" | "plays" | "boots" | "unsupported";

export interface Game {
  appID: number;
  name: string;
  status: Status;
  tested?: string;
  source?: string;
  devices?: string[];
  branch?: string;
  garbro?: string;
  profile?: string;
  notes?: string;
}

export interface Engine {
  engine: string;
  name: string;
  runtimes?: string;
  games: Game[];
}

export interface Entry extends Game {
  engine: string;
  engineName: string;
}

export const statuses: Status[] = ["complete", "plays", "boots", "unsupported"];

export const statusInfo: Record<Status, { label: string; meaning: string; dot: string }> = {
  complete: { label: "Complete", meaning: "Everything the PC version has works.", dot: "bg-emerald-500" },
  plays: { label: "Plays", meaning: "Playable from start to end. Some extras may be missing.", dot: "bg-sky-500" },
  boots: { label: "Boots", meaning: "Reaches its title or first scene. Not yet played through.", dot: "bg-amber-500" },
  unsupported: { label: "Unsupported", meaning: "Doesn't start yet. The notes say why.", dot: "bg-zinc-400" },
};

/** The open-source package behind each engine, where there is one. */
export const engineRepos: Record<string, string> = {
  artemis: "https://github.com/OWCramer/ArtemisKit",
  kirikiri: "https://github.com/OWCramer/KiriKit",
  luca: "https://github.com/OWCramer/LucaKit",
  siglus: "https://github.com/OWCramer/SiglusKit",
  catsystem2: "https://github.com/OWCramer/CatSystemKit",
  renpy: "https://github.com/OWCramer/shiori",
};

export const repo = "https://github.com/OWCramer/shiori-compatibility";

const files = import.meta.glob<Engine>("../../../engines/*.json", { eager: true, import: "default" });

/** "KiriKiri Z (KiriKit)" → "KiriKiri Z" for labels; the package name stays in the engine section. */
export const shortName = (name: string) => name.replace(/\s*\(.*\)$/, "");

export const engines: Engine[] = Object.values(files)
  .filter((e) => e.games.length > 0)
  .sort((a, b) => b.games.length - a.games.length || a.name.localeCompare(b.name));

const rank = (s: Status) => statuses.indexOf(s);

export const entries: Entry[] = engines
  .flatMap((e) => e.games.map((g) => ({ ...g, engine: e.engine, engineName: shortName(e.name) })))
  .sort((a, b) => rank(a.status) - rank(b.status) || a.name.localeCompare(b.name));

export const counts = Object.fromEntries(statuses.map((s) => [s, entries.filter((g) => g.status === s).length])) as Record<
  Status,
  number
>;

export const lastTested = entries
  .map((g) => g.tested)
  .filter(Boolean)
  .sort()
  .at(-1);

export const steamStore = (id: number) => `https://store.steampowered.com/app/${id}`;
export const steamHeader = (id: number) => `https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/${id}/header.jpg`;

export const formatDate = (iso: string) =>
  new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
