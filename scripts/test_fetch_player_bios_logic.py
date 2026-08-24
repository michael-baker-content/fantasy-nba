from datetime import date
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from scripts.fetch_player_bios import build_bio, has_missing_profile_fields


def assert_equal(label, actual, expected):
    if actual != expected:
        raise AssertionError(f"{label}: expected {expected!r}, got {actual!r}")


undrafted_bio = build_bio(
    "1630559",
    "Austin Reaves",
    today=date(2026, 8, 24),
    index_info={
        "PLAYER_NAME": "Austin Reaves",
        "HEIGHT": "6-5",
        "COLLEGE": "Oklahoma",
        "COUNTRY": "USA",
        "DRAFT_YEAR": "",
        "DRAFT_ROUND": "",
        "DRAFT_NUMBER": "",
    },
    birthdate="1998-05-29",
)

assert_equal("undrafted draft year", undrafted_bio["draft_year"], "Undrafted")
assert_equal("undrafted draft round", undrafted_bio["draft_round"], "")
assert_equal("undrafted draft number", undrafted_bio["draft_number"], "")
assert_equal("undrafted bio completeness", has_missing_profile_fields(undrafted_bio), False)

missing_country_bio = dict(undrafted_bio)
missing_country_bio["country"] = ""
assert_equal("missing country needs refresh", has_missing_profile_fields(missing_country_bio), True)

drafted_missing_pick_bio = dict(undrafted_bio)
drafted_missing_pick_bio["draft_year"] = "2024"
drafted_missing_pick_bio["draft_round"] = "1"
drafted_missing_pick_bio["draft_number"] = ""
assert_equal("drafted missing pick needs refresh", has_missing_profile_fields(drafted_missing_pick_bio), True)

print("fetch player bios logic ok")
