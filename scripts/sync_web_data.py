from __future__ import annotations

import csv
import json
import re
from pathlib import Path


PROJECT_ROOT = Path(__file__).resolve().parents[1]
CSV_FILE = PROJECT_ROOT / "data" / "nba_2026_27_likely_players.csv"
BIOS_FILE = PROJECT_ROOT / "data" / "player_bios.csv"
WEB_DATA_FILE = PROJECT_ROOT / "web" / "players-data.js"
BIO_FIELDS = [
    "birthdate",
    "age",
    "height",
    "college",
    "country",
    "draft_year",
    "draft_round",
    "draft_number",
]
FANTASY_FIELDS = [
    "fantasy_fg_pct",
    "fantasy_fgm",
    "fantasy_fga",
    "fantasy_ft_pct",
    "fantasy_ftm",
    "fantasy_fta",
    "fantasy_fg3m",
    "fantasy_pts",
    "fantasy_reb",
    "fantasy_ast",
    "fantasy_stl",
    "fantasy_blk",
    "fantasy_tov",
]
WEB_FIELDS = [
    "index",
    "player_name",
    "team_abbreviation",
    "position",
    "player_id",
    "experience",
    *BIO_FIELDS,
    *FANTASY_FIELDS,
]


def read_existing_fantasy_fields() -> dict[str, dict[str, object]]:
    if not WEB_DATA_FILE.exists():
        return {}

    text = WEB_DATA_FILE.read_text(encoding="utf-8")
    match = re.search(r"window\.NBA_PLAYER_DATA\s*=\s*(.*);\s*$", text, re.S)
    if not match:
        return {}

    rows = json.loads(match.group(1))
    return {
        str(row.get("player_id")): {field: row.get(field, "") for field in FANTASY_FIELDS}
        for row in rows
        if row.get("player_id")
    }


def read_bio_fields() -> dict[str, dict[str, str]]:
    if not BIOS_FILE.exists():
        return {}

    with BIOS_FILE.open(newline="", encoding="utf-8") as file:
        return {
            str(row.get("player_id")): {field: row.get(field, "") for field in BIO_FIELDS}
            for row in csv.DictReader(file)
            if row.get("player_id")
        }


def main() -> None:
    with CSV_FILE.open(newline="", encoding="utf-8") as file:
        rows = list(csv.DictReader(file))

    fantasy_by_id = read_existing_fantasy_fields()
    bios_by_id = read_bio_fields()
    for row in rows:
        player_id = str(row.get("player_id"))
        row.update(bios_by_id.get(player_id, {}))
        row.update(fantasy_by_id.get(player_id, {}))

    clean_rows = [{field: row.get(field, "") for field in WEB_FIELDS} for row in rows]
    payload = json.dumps(clean_rows, ensure_ascii=False)
    WEB_DATA_FILE.write_text(
        f"window.NBA_PLAYER_DATA = {payload};\n",
        encoding="utf-8",
    )
    print(f"Wrote {len(rows)} players to {WEB_DATA_FILE}")


if __name__ == "__main__":
    main()
