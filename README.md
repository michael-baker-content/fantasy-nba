# NBA Player Ranker

NBA Player Ranker is a lightweight fantasy basketball ranking tool. It starts with a generated player list, lets each user add personal ranks in the browser, and exports a clean draft-ready file.

For a reusable playbook based on this project, see [SKILLS.md](SKILLS.md).

## Using the Site

Open the site, search or filter the player list, then enter numbers in the `Rank` column. Ranks are saved in your browser and automatically stay in order with no gaps. If you enter `1` for a player, the existing ranks shift down; if you delete a rank, the ranks below it shift up.

The fastest workflow is:

1. Use `Seed` to autopopulate rankings from the default index.
2. Adjust the players you personally value differently.
3. Use `Export` to save or copy your rankings.

A lazy but useful workflow is even shorter: click `Seed`, enter the number of players your league will use, and immediately export. For example, a 12-team league drafting 13 players per team could seed `156` ranks, then export without filling every rank by hand.

The `Export` menu includes:

- `CSV File (Yahoo!)`: exports only ranked players with `rank`, `name`, `team`, and `position`.
- `CSV To Clipboard (Yahoo!)`: copies that same simple ranked list.
- `CSV File (Complete)`, `XLSX File (Complete)`, and `JSON File (Complete)`: export the current filtered and sorted result set with the extra player, team, fantasy, and identity fields available in the app.
- `New Site Index Data`: exports ranked players as `index`, `player_name`, and `player_id`, suitable for saving as `data/index_overrides.csv`.

Use `Reset` when you want to turn back the clock. `Reset Sorts` returns the sort order to the default for the current view. When `Rank` sort is active, `Refresh Sort` re-runs the current rank ordering after edits. `Delete Saved Data` removes saved ranks, team edits, and theme preference from this browser.

The app has two views:

- `Player Info`: player rank, team, position, age, height, background, country, draft, and Experience context.
- `Fantasy Stats`: prior-season fantasy totals, including FG%, FT%, 3PM, points, rebounds, assists, steals, blocks, and turnovers.

Player search is accent-insensitive and includes curated aliases such as `SGA`, `Wemby`, `Joker`, and `Greek Freak`. Single-position filters are inclusive, so `F` includes `F`, `F-C`, and `G-F`; combo-position filters remain exact, so `F-C` does not include plain `F`.

Team edits in the Player Info view are saved in browser localStorage. The original data remains the default, and switching a player back to that default removes the override. Personal ranks, team edits, and dark mode are private to each browser.

## Basic Installation

Clone the repo, then from the project folder run a local static server:

```powershell
python scripts/serve_web.py
```

Open:

```text
http://127.0.0.1:8765/web/
```

The root `index.html` redirects to `web/`, so the app can also be hosted directly from GitHub Pages.

To run the lightweight checks:

```powershell
node scripts/test_all.js
```

## Data Files

The main generated player file is:

```text
data/nba_2026_27_likely_players.csv
```

The generator also writes a review file:

```text
data/nba_2026_27_likely_players_review.csv
```

The browser reads:

```text
web/players-data.js
```

Optional player biography data is cached separately:

```text
data/player_bios.csv
```

The main player CSV columns are:

```text
index,player_name,team_abbreviation,position,player_id,experience,active_likelihood,fantasy_*
```

The `fantasy_*` columns include prior-season raw fantasy totals and stored FG/FT made-attempted inputs used by the web explorer. The `active_likelihood` field remains in the data pipeline for later use, but likelihood is currently hidden from the site to avoid confusion while that score is still being refined.

## Refreshing Web Data

If the local CSV files are current and you only need to refresh the browser data file, run:

```powershell
python scripts/sync_web_data.py
```

The sync script preserves existing fantasy fields from `web/players-data.js` and merges optional fields from `data/player_bios.csv` when available.

## Generating Player Data

Create a Python environment and install dependencies:

```powershell
python -m venv .venv
.\.venv\Scripts\python -m pip install -r requirements.txt
```

Then run:

```powershell
.\scripts\generate_nba_players.ps1
```

The script uses the maintained `nba_api` package, which reads NBA.com/stats data and preserves NBA.com/stats player IDs.

To refresh the optional Player Info biography cache:

```powershell
.\.venv\Scripts\python scripts/fetch_player_bios.py
python scripts/sync_web_data.py
```

The bio script fills height, background, country, and draft fields from the season player index, then fetches birthdate and other missing profile fields from individual player profiles. It also normalizes otherwise-filled undrafted player rows to show `Undrafted` instead of a blank draft value. NBA.com/stats can be touchy, so smaller batches are often more reliable:

```powershell
.\.venv\Scripts\python scripts/fetch_player_bios.py --limit 25 --sleep 0.5
python scripts/sync_web_data.py
```

By default, cached rows with missing useful bio fields can be revisited. Add `--only-missing-birthdates` if you want the older behavior of fetching individual profiles only when birthdate is blank.

## Manual Inputs

Four optional CSV files live in `data/`:

- `experience_overrides.csv`: force a player's Experience value to `Veteran` or `Rookie`.
- `active_likelihood_overrides.csv`: override the hidden likelihood score when news, injuries, or roster context matter.
- `free_agents.csv`: include additional unsigned players who are still plausible NBA players. Use `NA` (`Not Available`) for players whose team is not available.
- `index_overrides.csv`: reorder the generated index from a browser `New Site Index Data` export. Listed players are moved to the top in exported order; skipped players keep the generator's current order after those listed players.

The script also automatically adds free-agent candidates when a player appeared in the previous season's NBA stats feed, is not on the upcoming-season roster feed, and clears a modest recent-playing-time threshold.

For players who were already in the NBA last season, `experience` is `Veteran`. For incoming players with no known professional history, `experience` defaults to `Rookie`.

## Index Ranking

The `index` field is assigned after sorting by an internal ranking score. The score combines active likelihood with prior-season production and Net Rating (`NET_RATING`) compared with the prior-season league average.

The Net Rating adjustment is weighted by playing-time sample so small-minute outliers have less influence. The review CSV includes `index_score`, `previous_netrtg`, `netrtg_delta`, and `netrtg_sample_weight` for auditing.

To make a personal ranking become the next generated default index, rank players in the browser, choose `Export` -> `New Site Index Data`, and save that file as:

```text
data/index_overrides.csv
```

The next run of `scripts/generate_nba_players.py` will apply that file after the automatic scoring sort. Any unlisted players retain their current generated order after the listed players are placed.

## Active Likelihood

`active_likelihood` is a hidden 0 to 1 estimate of how likely the player is to be active for at least one NBA game in the upcoming season.

The automatic score uses:

- Prior-season NBA production from NBA.com/stats.
- Rookie draft slot.
- Supplemental roster status, which usually indicates a more fringe or developmental roster path.

Examples:

- Established high-production players land near `0.95` to `0.98`.
- Regular rotation players usually land around `0.80` to `0.90`.
- Two-way or developmental players usually land around `0.50` to `0.62`.
- Undrafted or very fringe incoming players usually land around `0.45`.
- Free agents are discounted from their prior-production score because they still need a roster path.

The review CSV includes supporting fields such as `roster_bucket`, `likelihood_reason`, prior-season games/minutes/points/rebounds/assists, draft slot, and supplemental status.

## Interface Notes

The responsive layout has desktop, laptop, tablet, and mobile treatments. On narrow mobile screens, the first row keeps `Menu`, `Info / Stats`, and dark mode available, while player search and results remain visible by default. Additional filters, export, top, reset, and seed controls live in the slide-down menu.

Wide tables include a sticky horizontal scrollbar beneath the visible results so columns can be scrolled left and right without jumping to the final row. The `Rank` and `Player` columns stay pinned while scrolling horizontally. On mobile, horizontal table scrolling is replaced by compact columns and a player detail dialog: tap a player name to see the current view's full info or 2025-26 stats.

The visual style uses Roboto for the interface and Bungee for the `NBA Player Ranker` heading, with Roboto as a fallback. The heading uses a theme-aware fill and stroke so the mark stays readable in both light and dark modes without becoming the loudest control on the page.

## Accessibility and Maintainability

The explorer favors native HTML controls and semantic table markup. Labels are explicit, the mobile menu, desktop controls panel, and export menu expose `aria-expanded`, fantasy stat sort headers expose `aria-sort`, export status messages use an `aria-live` region, and focus states use a shared Material-style focus token. The mobile player detail dialog returns focus to the player name that opened it when closed.

The browser code keeps repeatable UI configuration in small constants, including default filters, column definitions, player search aliases, export fields, and fantasy empty-state display values. Pure browser logic lives in `web/app-logic.js` so rank updates, search matching, sorting, fantasy display, and export row construction can be reused by both the app and the Node test scripts.

## GitHub Pages

This project can be published as a static GitHub Pages site from the repository root.

Before committing, make sure the browser data file is current:

```powershell
python scripts/sync_web_data.py
```

Then commit the static site files, including:

```text
index.html
.nojekyll
web/index.html
web/styles.css
web/app.js
web/app-logic.js
web/players-data.js
```

In GitHub:

1. Open the repository settings.
2. Go to `Pages`.
3. Set `Source` to `Deploy from a branch`.
4. Select the branch you want to publish, usually `main`.
5. Set the folder to `/ (root)`.
6. Save.

The generated CSV files in `data/` are ignored by git, while `web/players-data.js` is committed for the static site. This lets GitHub Pages run without a live NBA API call.
