"""Turns a "Report a game" issue into an entry in its engine's file.

Reads the issue form's body from ISSUE_BODY, the reporter from ISSUE_AUTHOR and the date from ISSUE_DATE (YYYY-MM-DD).
Updates the game in place if it's already listed (moving it if the engine changed), otherwise adds it to the end.
Prints a one-line summary for the pull request.
"""

import json
import os
import re
import sys
from pathlib import Path

ENGINES = Path(__file__).resolve().parents[2] / "engines"

ENGINE_KEYS = {
    "Ren'Py": ("renpy", "Ren'Py"),
    "KiriKiri": ("kirikiri", "KiriKiri Z (KiriKit)"),
    "Artemis": ("artemis", "Artemis (ArtemisKit)"),
    "SiglusEngine": ("siglus", "SiglusEngine (siglus_rs)"),
    "Luca System": ("luca", "Luca System (LucaKit)"),
    "CatSystem2": ("catsystem2", "CatSystem2 (CatSystemKit)"),
    "ONScripter": ("onscripter", "ONScripter"),
}
STATUSES = ("complete", "plays", "boots", "unsupported")


def fail(message: str) -> None:
    print(message, file=sys.stderr)
    sys.exit(1)


def sections(body: str) -> dict[str, str]:
    """Issue forms render each field as "### Label" followed by its value."""
    found = {}
    for block in re.split(r"^### ", body, flags=re.M)[1:]:
        label, _, value = block.partition("\n")
        value = value.strip()
        found[label.strip()] = "" if value == "_No response_" else value
    return found


def load(path: Path) -> dict:
    return json.loads(path.read_text())


def save(path: Path, data: dict) -> None:
    path.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n")


def main() -> None:
    form = sections(os.environ["ISSUE_BODY"])

    name = form.get("Game", "").strip()
    match = re.search(r"(?:/app/)?(\d+)", form.get("Steam app id", ""))
    if not name or not match:
        fail("The report needs a game name and a Steam app id.")
    app_id = int(match.group(1))

    engine_label = form.get("Engine", "")
    if engine_label not in ENGINE_KEYS:
        fail(f"Unknown engine: {engine_label!r}.")
    engine, engine_name = ENGINE_KEYS[engine_label]

    status = form.get("Status", "").split(" ")[0].lower()
    if status not in STATUSES:
        fail(f"Unknown status: {form.get('Status')!r}.")

    entry = {
        "appID": app_id,
        "name": name,
        "status": status,
        "tested": os.environ["ISSUE_DATE"],
        "source": os.environ["ISSUE_AUTHOR"],
    }
    devices = [d.strip() for d in form.get("Devices", "").split(",") if d.strip()]
    if devices:
        entry["devices"] = devices
    if form.get("Steam beta branch"):
        entry["branch"] = form["Steam beta branch"].strip()
    notes = " ".join(form.get("Notes", "").split())
    if notes:
        entry["notes"] = notes

    target = ENGINES / f"{engine}.json"
    target_data = load(target) if target.exists() else {"engine": engine, "name": engine_name, "games": []}

    # Find an existing entry, in this engine's file or another one.
    for path in sorted(ENGINES.glob("*.json")):
        data = target_data if path == target else load(path)
        for i, game in enumerate(data["games"]):
            if game["appID"] != app_id:
                continue
            if path == target:
                # Keep maintainer-only fields (garbro, profile) the form doesn't ask for.
                kept = {k: v for k, v in game.items() if k in ("garbro", "profile")}
                data["games"][i] = {"appID": app_id, "name": name, **kept, **entry}
                save(target, data)
                print(f"Updates {name} ({app_id}) in engines/{engine}.json: {status}.")
                return
            del data["games"][i]
            save(path, data)
            target_data["games"].append(entry)
            save(target, target_data)
            print(f"Moves {name} ({app_id}) from engines/{path.name} to engines/{engine}.json: {status}.")
            return

    target_data["games"].append(entry)
    save(target, target_data)
    print(f"Adds {name} ({app_id}) to engines/{engine}.json: {status}.")


if __name__ == "__main__":
    main()
