from __future__ import annotations

import argparse
import csv
import time
from datetime import date, datetime
from pathlib import Path

from nba_api.stats.endpoints import commonplayerinfo, playerindex


SEASON = "2026-27"
PROJECT_ROOT = Path(__file__).resolve().parents[1]
DATA_DIR = PROJECT_ROOT / "data"
PLAYER_FILE = DATA_DIR / "nba_2026_27_likely_players.csv"
OUTPUT_FILE = DATA_DIR / "player_bios.csv"
BIO_FIELDS = [
    "player_id",
    "player_name",
    "birthdate",
    "age",
    "height",
    "college",
    "country",
    "draft_year",
    "draft_round",
    "draft_number",
]


def clean(value: object) -> str:
    return "" if value is None else str(value).strip()


def safe_print(message: str) -> None:
    print(message.encode("ascii", "backslashreplace").decode("ascii"), flush=True)


def iso_birthdate(value: object) -> str:
    text = clean(value)
    if not text:
        return ""

    return text.split("T", 1)[0]


def age_from_birthdate(value: str, today: date) -> str:
    if not value:
        return ""

    try:
        born = datetime.strptime(value, "%Y-%m-%d").date()
    except ValueError:
        return ""

    age = today.year - born.year - ((today.month, today.day) < (born.month, born.day))
    return str(age) if age >= 0 else ""


def read_players() -> list[dict[str, str]]:
    with PLAYER_FILE.open(newline="", encoding="utf-8") as file:
        return list(csv.DictReader(file))


def read_existing_bios() -> dict[str, dict[str, str]]:
    if not OUTPUT_FILE.exists():
        return {}

    with OUTPUT_FILE.open(newline="", encoding="utf-8") as file:
        return {
            clean(row.get("player_id")): {field: clean(row.get(field)) for field in BIO_FIELDS}
            for row in csv.DictReader(file)
            if clean(row.get("player_id"))
        }


def read_player_index_bios() -> dict[str, dict[str, object]]:
    endpoint = playerindex.PlayerIndex(
        league_id="00",
        season=SEASON,
        timeout=60,
    )
    normalized = endpoint.get_normalized_dict()
    rows = normalized.get("PlayerIndex") or next(iter(normalized.values()))
    return {clean(row.get("PERSON_ID")): row for row in rows if clean(row.get("PERSON_ID"))}


def fetch_common_info(player_id: str) -> dict[str, object]:
    endpoint = commonplayerinfo.CommonPlayerInfo(player_id=player_id, timeout=60)
    normalized = endpoint.get_normalized_dict()
    rows = normalized.get("CommonPlayerInfo") or []
    return rows[0] if rows else {}


def build_bio(
    player_id: str,
    player_name: str,
    today: date,
    index_info: dict[str, object] | None,
    birthdate: str = "",
    api_player_name: str = "",
    common_info: dict[str, object] | None = None,
) -> dict[str, str]:
    info = index_info or {}
    common = common_info or {}
    return {
        "player_id": player_id,
        "player_name": api_player_name or clean(info.get("PLAYER_NAME")) or player_name,
        "birthdate": birthdate,
        "age": age_from_birthdate(birthdate, today),
        "height": clean(info.get("HEIGHT")) or clean(common.get("HEIGHT")),
        "college": clean(info.get("COLLEGE")) or clean(common.get("SCHOOL")),
        "country": clean(info.get("COUNTRY")) or clean(common.get("COUNTRY")),
        "draft_year": clean(info.get("DRAFT_YEAR")) or clean(common.get("DRAFT_YEAR")),
        "draft_round": clean(info.get("DRAFT_ROUND")) or clean(common.get("DRAFT_ROUND")),
        "draft_number": clean(info.get("DRAFT_NUMBER")) or clean(common.get("DRAFT_NUMBER")),
    }


def write_bios(rows: list[dict[str, str]]) -> None:
    DATA_DIR.mkdir(exist_ok=True)
    with OUTPUT_FILE.open("w", newline="", encoding="utf-8") as file:
        writer = csv.DictWriter(file, fieldnames=BIO_FIELDS)
        writer.writeheader()
        writer.writerows(rows)


def main() -> None:
    parser = argparse.ArgumentParser(description="Fetch cached NBA player bio data.")
    parser.add_argument("--refresh", action="store_true", help="Refetch players already in the cache.")
    parser.add_argument("--limit", type=int, default=0, help="Fetch birthdates for at most this many uncached rows.")
    parser.add_argument("--sleep", type=float, default=0.35, help="Seconds to pause between API calls.")
    parser.add_argument("--skip-birthdates", action="store_true", help="Only use the season player index fields.")
    args = parser.parse_args()

    players = read_players()
    existing = read_existing_bios()
    try:
        index_bios = read_player_index_bios()
    except Exception as error:
        index_bios = {}
        safe_print(f"Season player index unavailable; preserving cached bio fields where possible: {error}")
    today = date.today()
    fetched = 0
    output_by_id: dict[str, dict[str, str]] = {}

    for player in players:
        player_id = clean(player.get("player_id"))
        player_name = clean(player.get("player_name"))
        if not player_id or player_id == "0":
            continue

        index_info = index_bios.get(player_id)
        existing_row = existing.get(player_id)
        existing_birthdate = clean(existing_row.get("birthdate")) if existing_row else ""

        if not args.refresh and player_id in existing:
            output_by_id[player_id] = (
                existing_row
                if not index_info
                else build_bio(
                    player_id,
                    player_name,
                    today,
                    index_info,
                    existing_birthdate,
                    clean(existing_row.get("player_name")),
                )
            )
            if existing_birthdate or args.skip_birthdates:
                continue

        if args.skip_birthdates or (args.limit and fetched >= args.limit):
            output_by_id[player_id] = existing_row or build_bio(player_id, player_name, today, index_info, existing_birthdate)
            continue

        try:
            common_info = fetch_common_info(player_id)
            birthdate = iso_birthdate(common_info.get("BIRTHDATE"))
            api_player_name = clean(common_info.get("DISPLAY_FIRST_LAST"))
            output_by_id[player_id] = build_bio(
                player_id,
                player_name,
                today,
                index_info,
                birthdate,
                api_player_name,
                common_info,
            )
            fetched += 1
            safe_print(f"Fetched {output_by_id[player_id]['player_name']} ({player_id})")
        except Exception as error:
            output_by_id[player_id] = {
                "player_id": player_id,
                "player_name": player_name,
                "birthdate": "",
                "age": "",
                "height": "",
                "college": "",
                "country": "",
                "draft_year": "",
                "draft_round": "",
                "draft_number": "",
            }
            safe_print(f"Skipped {player_name} ({player_id}): {error}")

        if args.sleep > 0:
            time.sleep(args.sleep)

    rows = [output_by_id[clean(player.get("player_id"))] for player in players if clean(player.get("player_id")) in output_by_id]
    write_bios(rows)
    safe_print(f"Wrote {len(rows)} bios to {OUTPUT_FILE}; fetched {fetched} this run.")


if __name__ == "__main__":
    main()
