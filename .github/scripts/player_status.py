"""Folds the players' reports (compat.ocramer.com/api/stats) into the engine files.

Every game with reports gets its totals in `players`. Once at least THRESHOLD players have
rated a game, their majority sets its status (a tie counts as the worse rating), whatever the
file said before; a game that isn't listed yet is added. "complete" stays complete while the
majority says it works.
"""
import datetime, json, os, sys, urllib.request

STATS = os.environ.get("STATS_URL", "https://compat.ocramer.com/api/stats")
# Cloudflare in front of compat.ocramer.com refuses urllib's default user agent.
HEADERS = {"User-Agent": "shiori-compatibility (+https://github.com/OWCramer/shiori-compatibility)"}
THRESHOLD = 3
STATUS = {"works": "plays", "issues": "boots", "broken": "unsupported"}
ORDER = ["broken", "issues", "works"]  # worst first: ties go to the worse

def majority(ratings):
    best = max(ratings.get(r, 0) for r in ORDER)
    return next(r for r in ORDER if ratings.get(r, 0) == best)

def main():
    with urllib.request.urlopen(urllib.request.Request(STATS, headers=HEADERS), timeout=30) as response:
        stats = json.load(response)["games"]
    today = datetime.date.today().isoformat()
    files = {}
    for game in stats:
        path = f"engines/{game['engine']}.json"
        if not os.path.exists(path):
            continue
        data = files.setdefault(path, json.load(open(path)))
        entries = {g["appID"]: g for g in data["games"]}
        ratings = {r: game["ratings"].get(r, 0) for r in ORDER}
        rated = sum(ratings.values())
        entry = entries.get(game["appID"])
        if entry is None:
            if rated < THRESHOLD:
                continue
            entry = {"appID": game["appID"], "name": game["name"], "status": "boots",
                     "notes": "Added from player reports."}
            data["games"].append(entry)
        entry["players"] = {"count": game["players"], "hours": game["hours"], **ratings}
        if rated >= THRESHOLD:
            verdict = majority(ratings)
            status = STATUS[verdict]
            if not (entry["status"] == "complete" and verdict == "works") and entry["status"] != status:
                entry["status"] = status
                entry["source"] = "players"
                entry["tested"] = today
    for path, data in files.items():
        with open(path, "w") as f:
            f.write(json.dumps(data, indent=2, ensure_ascii=False) + "\n")
    print(f"{len(stats)} games with reports; {len(files)} engine files touched")

if __name__ == "__main__":
    sys.exit(main())
