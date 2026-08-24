from __future__ import annotations

import csv
import json
from pathlib import Path

from nba_api.stats.endpoints import leaguedashplayerstats, playerindex


SEASON = "2026-27"
PREVIOUS_SEASON = "2025-26"
ROOKIE_FROM_YEAR = "2026"
PROJECT_ROOT = Path(__file__).resolve().parents[1]
DATA_DIR = PROJECT_ROOT / "data"
WEB_DIR = PROJECT_ROOT / "web"
OUTPUT_FILE = DATA_DIR / "nba_2026_27_likely_players.csv"
REVIEW_OUTPUT_FILE = DATA_DIR / "nba_2026_27_likely_players_review.csv"
WEB_DATA_FILE = WEB_DIR / "players-data.js"
EXPERIENCE_OVERRIDES_FILE = DATA_DIR / "experience_overrides.csv"
LIKELIHOOD_OVERRIDES_FILE = DATA_DIR / "active_likelihood_overrides.csv"
FREE_AGENTS_FILE = DATA_DIR / "free_agents.csv"
MIN_FREE_AGENT_GAMES = 10
MIN_FREE_AGENT_CONTRIBUTION = 6

OUTPUT_FIELDS = [
    "index",
    "player_name",
    "team_abbreviation",
    "position",
    "player_id",
    "experience",
    "active_likelihood",
]

REVIEW_FIELDS = OUTPUT_FIELDS + [
    "roster_bucket",
    "likelihood_reason",
    "index_score",
    "previous_gp",
    "previous_min",
    "previous_pts",
    "previous_reb",
    "previous_ast",
    "previous_netrtg",
    "netrtg_delta",
    "netrtg_sample_weight",
    "previous_pie",
    "previous_usg_pct",
    "draft_year",
    "draft_round",
    "draft_number",
    "supplemental_status",
]


def fetch_player_index_rows(season: str) -> list[dict[str, object]]:
    endpoint = playerindex.PlayerIndex(
        league_id="00",
        season=season,
        timeout=60,
    )
    normalized = endpoint.get_normalized_dict()
    return normalized.get("PlayerIndex") or next(iter(normalized.values()))


def fetch_player_stat_rows(season: str) -> list[dict[str, object]]:
    endpoint = leaguedashplayerstats.LeagueDashPlayerStats(
        league_id_nullable="00",
        season=season,
        per_mode_detailed="PerGame",
        timeout=60,
    )
    normalized = endpoint.get_normalized_dict()
    return normalized.get("LeagueDashPlayerStats") or next(iter(normalized.values()))


def fetch_player_total_rows(season: str) -> list[dict[str, object]]:
    endpoint = leaguedashplayerstats.LeagueDashPlayerStats(
        league_id_nullable="00",
        season=season,
        per_mode_detailed="Totals",
        timeout=60,
    )
    normalized = endpoint.get_normalized_dict()
    return normalized.get("LeagueDashPlayerStats") or next(iter(normalized.values()))


def fetch_player_advanced_rows(season: str) -> list[dict[str, object]]:
    endpoint = leaguedashplayerstats.LeagueDashPlayerStats(
        league_id_nullable="00",
        season=season,
        per_mode_detailed="PerGame",
        measure_type_detailed_defense="Advanced",
        timeout=60,
    )
    normalized = endpoint.get_normalized_dict()
    return normalized.get("LeagueDashPlayerStats") or next(iter(normalized.values()))


def read_lookup_csv(path: Path, value_field: str) -> dict[str, str]:
    if not path.exists():
        return {}

    with path.open(newline="", encoding="utf-8") as file:
        rows = csv.DictReader(file)
        return {
            str(row["player_id"]).strip(): row[value_field].strip()
            for row in rows
            if row.get("player_id") and row.get(value_field)
        }


def normalize_experience(value: object) -> str:
    return "Rookie" if str(value or "").strip().lower() == "rookie" else "Veteran"


def infer_experience(player: dict[str, object], overrides: dict[str, str]) -> str:
    player_id = str(player["PERSON_ID"])
    if player_id in overrides:
        return normalize_experience(overrides[player_id])

    from_year = str(player.get("FROM_YEAR") or "")
    if from_year == ROOKIE_FROM_YEAR:
        return "Rookie"

    return "Veteran"


def as_float(value: object, default: float = 0) -> float:
    try:
        if value in {None, ""}:
            return default
        return float(value)
    except (TypeError, ValueError):
        return default


def as_int(value: object, default: int = 0) -> int:
    try:
        if value in {None, ""}:
            return default
        return int(float(value))
    except (TypeError, ValueError):
        return default


def clamp_score(value: float) -> float:
    return round(max(0, min(1, value)), 2)


def minutes_sample_weight(previous_player: dict[str, object] | None) -> float:
    if not previous_player:
        return 0

    minutes_played = as_float(previous_player.get("GP")) * as_float(previous_player.get("MIN"))
    return min(1, minutes_played / 1200)


def league_average_netrtg(advanced_players: list[dict[str, object]]) -> float:
    weighted_total = 0.0
    total_weight = 0.0

    for player in advanced_players:
        weight = as_float(player.get("GP")) * as_float(player.get("MIN"))
        weighted_total += as_float(player.get("NET_RATING")) * weight
        total_weight += weight

    return weighted_total / total_weight if total_weight else 0


def draft_based_rookie_score(player: dict[str, object]) -> float:
    draft_round = as_int(player.get("DRAFT_ROUND"))
    draft_number = as_int(player.get("DRAFT_NUMBER"))

    if draft_round == 1 and draft_number:
        if draft_number <= 14:
            return 0.85
        return 0.75
    if draft_round == 2 and draft_number:
        if draft_number <= 45:
            return 0.6
        return 0.5
    return 0.45


def previous_contribution_score(previous_player: dict[str, object] | None) -> float:
    if not previous_player:
        return 0.55

    contribution = (
        as_float(previous_player.get("PTS"))
        + as_float(previous_player.get("REB"))
        + as_float(previous_player.get("AST"))
    )

    if contribution >= 30:
        return 0.98
    if contribution >= 20:
        return 0.95
    if contribution >= 12:
        return 0.9
    if contribution >= 6:
        return 0.8
    if contribution > 0:
        return 0.68
    return 0.55


def free_agent_score(previous_player: dict[str, object] | None) -> float:
    previous_score = previous_contribution_score(previous_player)

    if previous_score >= 0.98:
        return 0.7
    if previous_score >= 0.95:
        return 0.65
    if previous_score >= 0.9:
        return 0.58
    if previous_score >= 0.8:
        return 0.45
    if previous_score >= 0.68:
        return 0.35
    return 0.25


def contribution(player: dict[str, object] | None) -> float:
    if not player:
        return 0

    return (
        as_float(player.get("PTS"))
        + as_float(player.get("REB"))
        + as_float(player.get("AST"))
    )


def likely_free_agent_candidate(previous_player: dict[str, object]) -> bool:
    return (
        as_int(previous_player.get("GP")) >= MIN_FREE_AGENT_GAMES
        or contribution(previous_player) >= MIN_FREE_AGENT_CONTRIBUTION
    )


def likelihood_reason(
    player: dict[str, object],
    previous_stats_by_id: dict[int, dict[str, object]],
    overrides: dict[str, str],
) -> tuple[float, str]:
    player_id = int(player["PERSON_ID"])
    if str(player_id) in overrides:
        return clamp_score(as_float(overrides[str(player_id)])), "manual override"

    previous_player = previous_stats_by_id.get(player_id)
    supplemental_status = as_int(player.get("SUPPLEMENTAL_STATUS"))

    if str(player.get("FROM_YEAR") or "") == ROOKIE_FROM_YEAR and not previous_player:
        score = draft_based_rookie_score(player)
        reason = "rookie draft slot"
    else:
        score = previous_contribution_score(previous_player)
        reason = "prior NBA production"

    if supplemental_status == 1:
        score = min(score, 0.55)
        reason = "supplemental roster status"
        if previous_player and previous_contribution_score(previous_player) >= 0.8:
            score = 0.62
            reason = "prior NBA production capped by supplemental roster status"

    return clamp_score(score), reason


def review_fields(
    previous_player: dict[str, object] | None,
    previous_advanced_player: dict[str, object] | None = None,
    league_avg_netrtg: float = 0,
    player: dict[str, object] | None = None,
) -> dict[str, object]:
    player = player or {}
    previous_player = previous_player or {}
    previous_advanced_player = previous_advanced_player or {}
    netrtg = as_float(previous_advanced_player.get("NET_RATING"))
    sample_weight = minutes_sample_weight(previous_player)
    netrtg_delta = (netrtg - league_avg_netrtg) * sample_weight if previous_advanced_player else 0

    return {
        "previous_gp": as_int(previous_player.get("GP")),
        "previous_min": as_float(previous_player.get("MIN")),
        "previous_pts": as_float(previous_player.get("PTS")),
        "previous_reb": as_float(previous_player.get("REB")),
        "previous_ast": as_float(previous_player.get("AST")),
        "previous_netrtg": round(netrtg, 2) if previous_advanced_player else "",
        "netrtg_delta": round(netrtg_delta, 2),
        "netrtg_sample_weight": round(sample_weight, 2),
        "previous_pie": round(as_float(previous_advanced_player.get("PIE")), 3)
        if previous_advanced_player
        else "",
        "previous_usg_pct": round(as_float(previous_advanced_player.get("USG_PCT")), 3)
        if previous_advanced_player
        else "",
        "draft_year": player.get("DRAFT_YEAR") or "",
        "draft_round": player.get("DRAFT_ROUND") or "",
        "draft_number": player.get("DRAFT_NUMBER") or "",
        "supplemental_status": as_int(player.get("SUPPLEMENTAL_STATUS")),
    }


def index_score(
    row: dict[str, object],
    previous_player: dict[str, object] | None,
    previous_advanced_player: dict[str, object] | None,
    league_avg_netrtg: float,
) -> float:
    previous_player = previous_player or {}
    previous_advanced_player = previous_advanced_player or {}
    netrtg_delta = 0.0

    if previous_advanced_player:
        netrtg_delta = (
            as_float(previous_advanced_player.get("NET_RATING")) - league_avg_netrtg
        ) * minutes_sample_weight(previous_player)

    score = (
        as_float(row.get("active_likelihood")) * 100
        + netrtg_delta * 0.30
        + as_float(previous_player.get("PTS")) * 2.20
        + as_float(previous_player.get("REB")) * 0.40
        + as_float(previous_player.get("AST")) * 0.55
        + as_float(previous_advanced_player.get("PIE")) * 25
        + as_float(previous_advanced_player.get("USG_PCT")) * 6
    )
    return round(score, 4)


def fantasy_fields(previous_total_player: dict[str, object] | None) -> dict[str, object]:
    previous_total_player = previous_total_player or {}
    return {
        "fantasy_fg_pct": previous_total_player.get("FG_PCT") or "",
        "fantasy_fgm": previous_total_player.get("FGM") or "",
        "fantasy_fga": previous_total_player.get("FGA") or "",
        "fantasy_ft_pct": previous_total_player.get("FT_PCT") or "",
        "fantasy_ftm": previous_total_player.get("FTM") or "",
        "fantasy_fta": previous_total_player.get("FTA") or "",
        "fantasy_fg3m": previous_total_player.get("FG3M") or "",
        "fantasy_pts": previous_total_player.get("PTS") or "",
        "fantasy_reb": previous_total_player.get("REB") or "",
        "fantasy_ast": previous_total_player.get("AST") or "",
        "fantasy_stl": previous_total_player.get("STL") or "",
        "fantasy_blk": previous_total_player.get("BLK") or "",
        "fantasy_tov": previous_total_player.get("TOV") or "",
    }


def normalize_team_abbreviation(value: object) -> str:
    abbreviation = str(value or "").strip().upper()
    return abbreviation if abbreviation else "NA"


def nba_player_rows(
    previous_stats_by_id: dict[int, dict[str, object]],
    previous_advanced_by_id: dict[int, dict[str, object]],
    previous_totals_by_id: dict[int, dict[str, object]],
    league_avg_netrtg: float,
) -> list[dict[str, object]]:
    players = fetch_player_index_rows(SEASON)
    experience_overrides = read_lookup_csv(EXPERIENCE_OVERRIDES_FILE, "experience")
    likelihood_overrides = read_lookup_csv(LIKELIHOOD_OVERRIDES_FILE, "active_likelihood")

    active_players = [
        player
        for player in players
        if str(player.get("ROSTER_STATUS") or "") in {"1", "1.0"}
        and int(player.get("IS_DEFUNCT") or 0) == 0
    ]

    rows = []
    for player in active_players:
        active_likelihood, reason = likelihood_reason(
            player,
            previous_stats_by_id,
            likelihood_overrides,
        )
        previous_player = previous_stats_by_id.get(int(player["PERSON_ID"]))
        previous_advanced_player = previous_advanced_by_id.get(int(player["PERSON_ID"]))
        previous_total_player = previous_totals_by_id.get(int(player["PERSON_ID"]))
        row = {
            "player_name": f"{player['PLAYER_FIRST_NAME']} {player['PLAYER_LAST_NAME']}",
            "team_abbreviation": normalize_team_abbreviation(player["TEAM_ABBREVIATION"]),
            "position": str(player.get("POSITION") or "").strip(),
            "player_id": int(player["PERSON_ID"]),
            "experience": infer_experience(player, experience_overrides),
            "active_likelihood": active_likelihood,
            "roster_bucket": (
                "supplemental" if as_int(player.get("SUPPLEMENTAL_STATUS")) == 1 else "standard"
            ),
            "likelihood_reason": reason,
            **review_fields(previous_player, previous_advanced_player, league_avg_netrtg, player),
            **fantasy_fields(previous_total_player),
        }
        row["index_score"] = index_score(
            row,
            previous_player,
            previous_advanced_player,
            league_avg_netrtg,
        )
        rows.append(
            row
        )

    return rows


def automatic_free_agent_rows(
    current_player_ids: set[int],
    previous_stats_by_id: dict[int, dict[str, object]],
    previous_advanced_by_id: dict[int, dict[str, object]],
    previous_totals_by_id: dict[int, dict[str, object]],
    previous_index_by_id: dict[int, dict[str, object]],
    likelihood_overrides: dict[str, str],
    league_avg_netrtg: float,
) -> list[dict[str, object]]:
    rows = []
    for player_id, previous_player in previous_stats_by_id.items():
        if player_id in current_player_ids:
            continue
        if not likely_free_agent_candidate(previous_player):
            continue

        score = free_agent_score(previous_player)
        reason = "recent NBA production discounted for not available status"
        if str(player_id) in likelihood_overrides:
            score = clamp_score(as_float(likelihood_overrides[str(player_id)]))
            reason = "manual override"

        previous_index = previous_index_by_id.get(player_id, {})
        previous_advanced_player = previous_advanced_by_id.get(player_id)
        previous_total_player = previous_totals_by_id.get(player_id)
        row = {
            "player_name": str(previous_player["PLAYER_NAME"]),
            "team_abbreviation": "NA",
            "position": str(previous_index.get("POSITION") or "").strip(),
            "player_id": player_id,
            "experience": "Veteran",
            "active_likelihood": clamp_score(score),
            "roster_bucket": "not_available_auto",
            "likelihood_reason": reason,
            **review_fields(previous_player, previous_advanced_player, league_avg_netrtg),
            **fantasy_fields(previous_total_player),
        }
        row["index_score"] = index_score(
            row,
            previous_player,
            previous_advanced_player,
            league_avg_netrtg,
        )
        rows.append(row)

    return rows


def manual_free_agent_rows() -> list[dict[str, object]]:
    if not FREE_AGENTS_FILE.exists():
        return []

    rows = []
    with FREE_AGENTS_FILE.open(newline="", encoding="utf-8") as file:
        reader = csv.DictReader(file)
        for row in reader:
            player_name = (row.get("player_name") or "").strip()
            if not player_name:
                continue

            rows.append(
                {
                    "player_name": player_name,
                    "team_abbreviation": normalize_team_abbreviation(row.get("team_abbreviation")),
                    "position": (row.get("position") or "").strip(),
                    "player_id": int((row.get("player_id") or "0").strip() or 0),
                    "experience": normalize_experience(row.get("experience") or "Veteran"),
                    "active_likelihood": clamp_score(
                        as_float(row.get("active_likelihood"), default=0.35)
                    ),
                    "roster_bucket": "not_available_manual",
                    "likelihood_reason": "manual not available input",
                    "index_score": 0,
                    **review_fields(None),
                    **fantasy_fields(None),
                }
            )

    return rows


def dedupe_rows(rows: list[dict[str, object]]) -> list[dict[str, object]]:
    seen_ids: set[int] = set()
    seen_names: set[str] = set()
    deduped = []

    for row in rows:
        player_id = int(row["player_id"])
        name_key = str(row["player_name"]).casefold()

        if player_id and player_id in seen_ids:
            continue
        if not player_id and name_key in seen_names:
            continue

        if player_id:
            seen_ids.add(player_id)
        seen_names.add(name_key)
        deduped.append(row)

    return deduped


def write_csv(rows: list[dict[str, object]]) -> None:
    DATA_DIR.mkdir(exist_ok=True)
    with OUTPUT_FILE.open("w", newline="", encoding="utf-8") as file:
        writer = csv.DictWriter(file, fieldnames=OUTPUT_FIELDS)
        writer.writeheader()
        for index, row in enumerate(rows, start=1):
            writer.writerow({field: {"index": index, **row}.get(field, "") for field in OUTPUT_FIELDS})


def write_review_csv(rows: list[dict[str, object]]) -> None:
    DATA_DIR.mkdir(exist_ok=True)
    with REVIEW_OUTPUT_FILE.open("w", newline="", encoding="utf-8") as file:
        writer = csv.DictWriter(file, fieldnames=REVIEW_FIELDS)
        writer.writeheader()
        for index, row in enumerate(rows, start=1):
            writer.writerow({field: {"index": index, **row}.get(field, "") for field in REVIEW_FIELDS})


def write_web_data(rows: list[dict[str, object]]) -> None:
    WEB_DIR.mkdir(exist_ok=True)
    clean_rows = []
    for index, row in enumerate(rows, start=1):
        indexed_row = {"index": index, **row}
        clean_rows.append(
            {
                "index": indexed_row.get("index", ""),
                "player_name": indexed_row.get("player_name", ""),
                "team_abbreviation": indexed_row.get("team_abbreviation", ""),
                "position": indexed_row.get("position", ""),
                "player_id": indexed_row.get("player_id", ""),
                "experience": indexed_row.get("experience", ""),
                "active_likelihood": indexed_row.get("active_likelihood", ""),
                "fantasy_fg_pct": indexed_row.get("fantasy_fg_pct", ""),
                "fantasy_fgm": indexed_row.get("fantasy_fgm", ""),
                "fantasy_fga": indexed_row.get("fantasy_fga", ""),
                "fantasy_ft_pct": indexed_row.get("fantasy_ft_pct", ""),
                "fantasy_ftm": indexed_row.get("fantasy_ftm", ""),
                "fantasy_fta": indexed_row.get("fantasy_fta", ""),
                "fantasy_fg3m": indexed_row.get("fantasy_fg3m", ""),
                "fantasy_pts": indexed_row.get("fantasy_pts", ""),
                "fantasy_reb": indexed_row.get("fantasy_reb", ""),
                "fantasy_ast": indexed_row.get("fantasy_ast", ""),
                "fantasy_stl": indexed_row.get("fantasy_stl", ""),
                "fantasy_blk": indexed_row.get("fantasy_blk", ""),
                "fantasy_tov": indexed_row.get("fantasy_tov", ""),
            }
        )

    payload = json.dumps(clean_rows, ensure_ascii=False)
    WEB_DATA_FILE.write_text(
        f"window.NBA_PLAYER_DATA = {payload};\n",
        encoding="utf-8",
    )


def main() -> None:
    previous_players = fetch_player_stat_rows(PREVIOUS_SEASON)
    previous_total_players = fetch_player_total_rows(PREVIOUS_SEASON)
    previous_advanced_players = fetch_player_advanced_rows(PREVIOUS_SEASON)
    previous_stats_by_id = {
        int(player["PLAYER_ID"]): player for player in previous_players
    }
    previous_advanced_by_id = {
        int(player["PLAYER_ID"]): player for player in previous_advanced_players
    }
    previous_totals_by_id = {
        int(player["PLAYER_ID"]): player for player in previous_total_players
    }
    avg_netrtg = league_average_netrtg(previous_advanced_players)
    current_rows = nba_player_rows(
        previous_stats_by_id,
        previous_advanced_by_id,
        previous_totals_by_id,
        avg_netrtg,
    )
    current_player_ids = {int(row["player_id"]) for row in current_rows if int(row["player_id"])}
    previous_index_by_id = {
        int(player["PERSON_ID"]): player for player in fetch_player_index_rows(PREVIOUS_SEASON)
    }
    likelihood_overrides = read_lookup_csv(LIKELIHOOD_OVERRIDES_FILE, "active_likelihood")
    rows = (
        current_rows
        + automatic_free_agent_rows(
            current_player_ids,
            previous_stats_by_id,
            previous_advanced_by_id,
            previous_totals_by_id,
            previous_index_by_id,
            likelihood_overrides,
            avg_netrtg,
        )
        + manual_free_agent_rows()
    )
    rows = dedupe_rows(rows)
    rows.sort(
        key=lambda row: (
            -as_float(row.get("index_score")),
            str(row["team_abbreviation"]),
            str(row["player_name"]),
        )
    )
    write_csv(rows)
    write_review_csv(rows)
    write_web_data(rows)
    print(f"Wrote {len(rows)} players to {OUTPUT_FILE}")
    print(f"Wrote review details to {REVIEW_OUTPUT_FILE}")
    print(f"Wrote web data to {WEB_DATA_FILE}")


if __name__ == "__main__":
    main()
