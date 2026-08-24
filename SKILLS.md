# Skills for Similar Projects

Use this guide when building another lightweight data project that turns a public or semi-structured data source into a ranked CSV plus a local exploration UI.

## Project Shape

Start with a small, reproducible folder structure:

```text
data/
scripts/
web/
README.md
requirements.txt
```

Keep generated outputs in `data/`, repeatable scripts in `scripts/`, and the browser interface in `web/`.

Prefer a boring, inspectable stack until the project proves it needs more:

- Python for data fetching, cleaning, scoring, and CSV generation.
- A plain static HTML/CSS/JS web app for read-only exploration.
- LocalStorage for small personal-only UI annotations.
- A local server only when browser file access or relative paths make it useful.

## Data Pipeline Pattern

Separate the pipeline into clear stages:

1. Fetch source data.
2. Normalize source fields into project-owned row names.
3. Apply manual override files.
4. Compute derived fields.
5. Deduplicate rows by stable ID first, then by normalized name.
6. Sort rows by the project ranking.
7. Write the main CSV.
8. Write a review CSV with scoring ingredients.
9. Write optional enrichment caches for slower detail fields.
10. Write browser-ready data for the web UI.

The main CSV should stay clean and user-facing. Put supporting fields, reasons, raw statistics, and debug values in a separate review CSV.

## Source-of-Truth Choices

Choose stable identifiers early. For NBA work, NBA.com/stats `player_id` is the stable ID.

When a public API is flaky or slow:

- Use a maintained client library when available.
- Keep a no-network sync path from existing CSV outputs to the web UI.
- Do not make the browser depend on a live API call for basic exploration.

For this project, `nba_api` is the data client, while `scripts/sync_web_data.py` can refresh `web/players-data.js` from the local CSV without touching the network.

When a detail endpoint is slower than the main list endpoint, cache it separately. In this project, `scripts/fetch_player_bios.py` writes `data/player_bios.csv`: most bio fields come from the season player index, while birthdate and still-missing profile fields are fetched from individual profile endpoints and can be filled progressively with `--limit`.

## Scoring and Ranking

Use two different concepts when needed:

- Hidden scoring ingredients: probability-like or model-like values that help generate a default order but are not necessarily ready for users.
- Index ranking: the default ordering users see first, which can combine availability, quality, role, or production.

Keep score formulas auditable even when the score is not shown in the UI. Save the score inputs in the review CSV so a surprising rank can be explained without rereading the code.

Useful ranking safeguards:

- Weight unstable metrics by sample size.
- Mark unsigned or unavailable-team players with `NA` (`Not Available`) and discount them because they still need a roster path.
- Cap or dampen developmental/supplemental players.
- Use manual overrides for news, injuries, and context that raw stats cannot know.
- Preserve cached enrichment data when an API request fails so a partial refresh does not wipe known values.

In this project, the index ranking combines hidden active likelihood, prior-season production, Net Rating compared with league average, and a playing-time sample weight. The likelihood value remains in the pipeline for future refinement but is intentionally hidden from the site until it is more trustworthy.

## Manual Override Files

Use small CSV override files instead of hardcoding exceptions:

```text
data/experience_overrides.csv
data/active_likelihood_overrides.csv
data/free_agents.csv
data/index_overrides.csv
```

Design overrides so they are easy to edit by hand:

- Include the stable ID.
- Include the player name for readability.
- Include only the field being overridden.

Keep enrichment caches separate from manual override files. A cache like `data/player_bios.csv` should be regenerable from source data and safe to refresh, while override files should represent intentional human judgment.

If the UI can create an override file, keep that export narrow and generator-friendly. In this project, the browser `Index CSV` export writes `index`, `player_name`, and `player_id` so the next data generation can apply a curated order while skipped players keep their generated order.

## Web Explorer Pattern

For an MVP explorer, build the real work surface first:

- Search.
- Filters for important categorical fields.
- Sort options that match the project workflow.
- A dense table that stays readable.
- Fast personal annotation controls.
- Export paths that match the user's next real task.

Avoid adding authentication, database storage, or large edit screens until there is a concrete need. Lightweight edits and exports can belong in the MVP when they are central to the workflow, as ranks, team overrides, Seed, Reset, and Export are in this project.

For personal annotations, localStorage is enough at first. Key saved values by stable ID so sorting, filtering, and regenerated data do not break the user's notes.

When personal annotations must stay ordered, encode the invariant in one update helper. For example, a personal rank list should normalize to contiguous integer ranks after every add, move, or delete instead of relying on each event handler to remember the rule.

Use time-saving commands when a workflow is repetitive. In this project, `Seed` fills empty ranks through a requested target count using the default index order, which gives users a fast starting point before manual adjustments.

## UI Lessons

For data-heavy tools, keep the interface quiet and efficient:

- Use compact controls and a sticky table header.
- Avoid a marketing-style landing page.
- Make the first screen the actual explorer.
- Use a consistent design language for typography, color, elevation, and control shape.
- Keep table rows stable in height so filtering and editing do not visually jump.
- Keep mobile tables ruthless: show only columns needed for the current workflow, compress secondary columns, and move filters or extras into a menu when results should remain the first thing users see.
- Replace mobile horizontal table scrolling with a detail path when the table becomes wider than the device can comfortably read. In this project, tapping a player opens a view-aware details dialog with Player Info or 2025-26 stats.
- Prefer identifying columns that users can recognize quickly. For player lists, age, height, school/club, country, and draft slot are more useful in the table than internal IDs, while IDs can remain in exports and generated data.
- On mobile, keep the highest-frequency navigation visible. For this project, Menu, Info/Stats view switching, and dark mode live in the top row, while lower-frequency filters and utility buttons live behind the slide-down menu.

## Accessibility Pattern

Treat accessibility as part of the MVP, not as a final polish pass:

- Prefer native controls: `button`, `input`, `select`, `table`, `thead`, `tbody`, `th`, and `td`.
- Keep every control labeled through visible label text or an explicit `aria-label`.
- Use real table headers with `scope="col"` so screen readers can connect cells to columns.
- For sortable columns, expose the current sort with `aria-sort`.
- Keep focus states visible and consistent; define the focus style once as a reusable token.
- Make mobile menus announce open/closed state with `aria-expanded`.
- Use `aria-expanded` for collapsible desktop panels too, and keep the controlled region's label broad enough to describe all of its actions.
- For modal details, move focus into the dialog when it opens and restore focus to the launching control when it closes.
- If visual labels are compressed on mobile, preserve meaningful accessible text in the DOM.
- Recheck color contrast after any palette or theme change, especially muted text and colored status indicators.

## DRY Frontend Pattern

Avoid repeating behavior rules across event handlers:

- Store defaults in named constants, not scattered string literals.
- Keep column definitions in arrays and render headers/rows from those definitions.
- Use small helpers for repeated DOM creation, formatting, persistence, sorting, and normalization.
- Put localStorage reads and writes behind helper functions so the storage strategy can change later.
- Keep view-specific behavior explicit. For example, editable team controls belong to the Player Info view, while fantasy stats stay read-focused.
- Keep duplicate responsive controls synced through one state helper. For example, desktop and mobile theme switches should update the same theme state and saved preference.
- Keep repeated detail displays data-driven. Define the fields once for each view, then render the table, modal, and export rows through shared formatting helpers where possible.
- Prefer one shared CSS custom property for repeated colors, focus rings, shadows, and design tokens.
- Add a tiny logic test when a helper protects an important invariant, such as no-gap rank ordering.
- Keep export field lists, filenames, and empty-state display values in named constants so file download, clipboard copy, and table rendering do not drift.

## Future Upgrade Path

Good next upgrades usually come in this order:

1. Add more transparent review details in the UI.
2. Add edit screens for override CSVs.
3. Move localStorage annotations into a local file or small database.
4. Add source snapshots so generated rankings can be compared over time.
5. Add tests around scoring, deduping, browser data generation, and key UI invariants.

When upgrading, preserve the simple generated CSV contract unless there is a strong reason to change it.
