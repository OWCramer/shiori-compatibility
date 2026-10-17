# Shiori compatibility

Which Steam visual novels play in Shiori, the iOS and iPadOS app that downloads the PC games you own and runs them with native engine runtimes.

One file per engine in `engines/`, one entry per game, keyed by its Steam app id. Shiori reads these files to show a game's status on its page, and [the site](https://compat.ocramer.com) is built from them.

| Status | Meaning |
| --- | --- |
| `complete` | Everything the PC version has works. |
| `plays` | Playable from start to end; some extras may be missing (the notes say which). |
| `boots` | Reaches its title or first scene; not yet played through. |
| `unsupported` | Doesn't start, and the notes say why (an engine Shiori doesn't run, encryption without keys, DRM). |

## Reporting a game

[Report a game](https://github.com/OWCramer/shiori-compatibility/issues/new?template=report.yml) with the issue form: the game, its Steam app id, engine, status, the devices you played on and a short note. Once a maintainer labels the report `accepted`, an Action opens a pull request that writes it into the engine's file, with your GitHub name as its `source`.

Not sure which engine a game uses? Shiori's game page shows it after the download.

You can also open a pull request yourself. Each entry looks like this:

```json
{
  "appID": 2699690,
  "name": "Harmonia Full HD Edition",
  "status": "plays",
  "tested": "2026-10-10",
  "source": "your-github-name",
  "devices": ["iPhone Air", "iPad Pro 11-inch (M4)"],
  "notes": "What works, what doesn't, and anything a player should know (a beta branch to pick, a setting to change)."
}
```

- `source` is `shiori` for the maintainers' own tests, and your GitHub name for yours.
- `branch` names a Steam beta branch to play instead of the default build.
- `profile` (Luca System) is the screen profile Shiori uses for the game.
- `schema.json` checks the files; keep entries sorted as they are and the notes short.

## Site

[compat.ocramer.com](https://compat.ocramer.com) is built from `engines/` by the Astro site in `site/` and deployed on Vercel.

The list is dedicated to the public domain under [CC0 1.0](LICENSE): by contributing you agree to the same.
