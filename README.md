# Basketball Player CSV

This project builds a CSV of players likely to play in the 2026-27 NBA season.

For a reusable playbook based on this project, see [SKILLS.md](SKILLS.md).

The generated file is:

```text
data/nba_2026_27_likely_players.csv
```

The generator also writes a review file:

```text
data/nba_2026_27_likely_players_review.csv
```

Columns:

```text
index,player_name,team_abbreviation,position,player_id,prev_league,active_likelihood,fantasy_*
```

The `fantasy_*` columns include prior-season raw fantasy totals and stored FG/FT made-attempted inputs used by the web explorer.

## How to Generate

From this folder:

```powershell
python -m venv .venv
.\.venv\Scripts\python -m pip install -r requirements.txt
```

Then:

```powershell
.\.venv\Scripts\python scripts/generate_nba_players.py
```

The script uses the maintained `nba_api` package, which reads NBA.com/stats data and preserves NBA.com/stats player IDs.

## Manual Inputs

Three optional CSV files live in `data/`:

- `prev_league_overrides.csv`: use this when a player's previous league should be something more specific than the script can infer.
- `active_likelihood_overrides.csv`: use this when news, injury context, or roster knowledge should override the automatic likelihood score.
- `free_agents.csv`: use this to include additional unsigned players who are still plausible NBA players.

The script also automatically adds free-agent candidates when a player appeared in the previous season's NBA stats feed, is not on the upcoming-season roster feed, and clears a modest recent-playing-time threshold.

For players who were already in the NBA last season, `prev_league` is `NBA`.
For incoming players with no known professional history, `prev_league` defaults to `rookie`.

## Active Likelihood

`active_likelihood` is a 0 to 1 estimate of how likely the player is to be active for at least one NBA game in the upcoming season.

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

## Index Ranking

The `index` field is assigned after sorting by an internal ranking score. The score combines active likelihood with prior-season production and Net Rating (`NET_RATING`) compared with the prior-season league average.

The Net Rating adjustment is weighted by playing-time sample so small-minute outliers have less influence. The review CSV includes `index_score`, `previous_netrtg`, `netrtg_delta`, and `netrtg_sample_weight` for auditing.

## Web Explorer

Run the local read-only explorer from this folder:

```powershell
python scripts/serve_web.py
```

Then open:

```text
http://127.0.0.1:8765/web/
```

The explorer reads the generated browser data and supports search, team, position, previous league, likelihood range, and sorting filters.

The `Rank` field is saved in browser localStorage, keyed by NBA player ID. Personal ranks stay local to the browser, are kept in contiguous integer order with no gaps, and are not written back to the CSV yet.

Team edits in the player outlook view are also saved in browser localStorage, keyed by NBA player ID. The original CSV team remains the default, and switching a player back to that default removes the override.

The `Export` button downloads ranked players only, sorted by `Rank`, with the fields `rank`, `name`, `team`, and `position`. Exported team values use localStorage team edits. The `Top` button scrolls the current filtered and sorted result set back to the top without changing view state.

The generator also writes `web/players-data.js`, so the explorer can be opened directly from `web/index.html` if the local server is inconvenient.

The explorer has two views:

- `Player outlook`: the main player universe with active likelihood and team context.
- `Fantasy totals`: prior-season fantasy totals, including FG%, FT%, 3PM, points, rebounds, assists, steals, blocks, and turnovers. FG/FT makes and attempts are stored in browser data for later use but are not displayed.

The mobile layout is tuned against an iPhone 15-sized viewport. On narrow screens, player search and results are visible by default, while views, filters, likelihood controls, export, top, and reset move into a slide-down menu. The mobile player outlook table keeps the index column as a compact `#` cue for default sorting but hides the index values to save space.

The explorer includes a dark mode switch. The selected theme is saved in browser localStorage and applies only to that browser.

## Accessibility and Maintainability

The explorer favors native HTML controls and semantic table markup. Labels are explicit, the mobile menu exposes `aria-expanded`, fantasy stat sort headers expose `aria-sort`, and focus states use a shared Material-style focus token.

The browser code keeps repeatable UI configuration in small constants, including default filters and column definitions. Local edits remain isolated behind helper functions so future storage changes can be made without rewriting the table rendering.

If you already have a current CSV and only need to refresh the web data file, run:

```powershell
python scripts/sync_web_data.py
```

The sync script preserves existing fantasy fields from `web/players-data.js` when it refreshes from the clean CSV.

## GitHub Pages

This project can be published as a static GitHub Pages site from the repository root.

Before committing, make sure the browser data file is current:

```powershell
python scripts/sync_web_data.py
```

Or, if you want to refresh from NBA.com/stats first:

```powershell
.\.venv\Scripts\python scripts/generate_nba_players.py
```

Then commit these static site files:

```text
index.html
.nojekyll
web/index.html
web/styles.css
web/app.js
web/players-data.js
```

In GitHub:

1. Open the repository settings.
2. Go to `Pages`.
3. Set `Source` to `Deploy from a branch`.
4. Select the branch you want to publish, usually `main`.
5. Set the folder to `/ (root)`.
6. Save.

The root page redirects to `web/`, and the explorer runs fully in the browser. Personal ranks and team edits use each visitor's browser localStorage, so they are private to that browser and are not shared through GitHub.

## Local Git Setup

This folder is prepared as a local git repository on the `main` branch. To publish it yourself:

```powershell
git status
git remote add origin https://github.com/YOUR-USER/YOUR-REPO.git
git push -u origin main
```

After pushing, enable GitHub Pages from the repository root as described above.

The generated CSV files in `data/` are ignored by git, while `web/players-data.js` is committed for the static site. This lets GitHub Pages run without a live NBA API call.

## Progress So Far

This project now includes:

- A repeatable NBA.com/stats data pipeline through `nba_api`.
- A clean player CSV with active likelihood and ranked index.
- A review CSV with scoring inputs and audit fields.
- Manual override files for previous league, likelihood, and extra free agents.
- A static web explorer with filters, sorting, likelihood range, and local personal ranks.
- A Material-inspired responsive UI using Roboto, native controls, and accessible table states.
- A no-network sync script for refreshing browser data from the generated CSV.
