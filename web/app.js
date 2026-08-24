const CSV_PATH = "../data/nba_2026_27_likely_players.csv";
const PERSONAL_RANK_KEY = "nba-player-explorer.personal-ranks.v1";
const TEAM_OVERRIDE_KEY = "nba-player-explorer.team-overrides.v1";
const THEME_KEY = "nba-player-explorer.theme.v1";
const EXPORT_FILE_NAME = "my_nba_rankings.csv";
const FULL_CSV_EXPORT_FILE_NAME = "nba_player_ranker_full_export.csv";
const FULL_XLSX_EXPORT_FILE_NAME = "nba_player_ranker_full_export.xlsx";
const FULL_JSON_EXPORT_FILE_NAME = "nba_player_ranker_full_export.json";
const EXPORT_FIELDS = ["rank", "name", "team", "position"];
const FULL_EXPORT_FIELDS = [
  "rank",
  "index",
  "name",
  "team",
  "original_team",
  "position",
  "nba_player_id",
  "experience",
  "active_likelihood",
  "fantasy_fg_pct",
  "fantasy_fgm",
  "fantasy_fga",
  "fantasy_ft_pct",
  "fantasy_ftm",
  "fantasy_fta",
  "fantasy_3pm",
  "fantasy_points",
  "fantasy_rebounds",
  "fantasy_assists",
  "fantasy_steals",
  "fantasy_blocks",
  "fantasy_turnovers",
];
const {
  normalizeSearchText,
  searchablePlayerText: buildSearchablePlayerText,
  matchesPositionFilter,
  normalizePersonalRanks,
  nextPersonalRank: nextPersonalRankFromMap,
  updatePersonalRank: updatePersonalRankMap,
  sortPlayers: sortPlayerList,
  sortFantasyPlayers: sortFantasyPlayerList,
  hasFantasyData,
  formatFantasyValue,
  rowsToCsv,
  rankedExportRows: buildRankedExportRows,
  fullExportRows: buildFullExportRows,
} = window.NbaRankerLogic;
const CRC32_TABLE = Array.from({ length: 256 }, (_, index) => {
  let value = index;

  for (let bit = 0; bit < 8; bit += 1) {
    value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
  }

  return value >>> 0;
});
const PLAYER_SEARCH_ALIASES = {
  "Anthony Edwards": ["Ant", "Ant-Man"],
  "Bam Adebayo": ["Bam"],
  "Bogdan Bogdanovic": ["Bogi"],
  "Bojan Bogdanovic": ["Bojan"],
  "CJ McCollum": ["CJ"],
  "Deandre Ayton": ["DA"],
  "De'Aaron Fox": ["Fox"],
  "Giannis Antetokounmpo": ["Greek Freak", "Giannis"],
  "Ja Morant": ["Ja"],
  "Jaren Jackson Jr.": ["JJJ"],
  "Jaylen Brown": ["JB"],
  "Jayson Tatum": ["JT"],
  "Jimmy Butler": ["Jimmy Buckets"],
  "Joel Embiid": ["JoJo"],
  "Jonathan Kuminga": ["JK"],
  "Kentavious Caldwell-Pope": ["KCP"],
  "Kevin Durant": ["KD"],
  "Kristaps Porzingis": ["KP"],
  "LeBron James": ["LeBron", "King James"],
  "Luka Doncic": ["Luka"],
  "Nikola Jokic": ["Jokic", "Joker"],
  "OG Anunoby": ["OG"],
  "PJ Washington": ["PJ"],
  "Robert Williams III": ["Time Lord"],
  "Shaedon Sharpe": ["Shae"],
  "Shai Gilgeous-Alexander": ["SGA", "Shai"],
  "Stephen Curry": ["Steph", "Chef Curry"],
  "Tim Hardaway Jr.": ["THJ"],
  "Tyrese Haliburton": ["Hali"],
  "Victor Wembanyama": ["Wemby", "Wembanyama"],
};
const DEFAULT_FILTERS = {
  team: "",
  position: "",
  experience: "",
  sort: "index-asc",
  minLikelihood: "0",
};

const playerSortOptions = [
  { value: "index-asc", label: "Default" },
  { value: "personal-rank-asc", label: "Rank" },
  { value: "likelihood-desc", label: "Likelihood High To Low" },
  { value: "likelihood-asc", label: "Likelihood Low To High" },
  { value: "name-asc", label: "Name A to Z" },
  { value: "name-desc", label: "Name Z to A" },
  { value: "team-asc", label: "Team A to Z" },
  { value: "team-desc", label: "Team Z to A" },
  { value: "position-asc", label: "Position A to Z" },
  { value: "position-desc", label: "Position Z to A" },
];

const experienceOptions = [
  { value: "", label: "Default" },
  { value: "veteran", label: "Veteran" },
  { value: "rookie", label: "Rookie" },
];

const state = {
  players: [],
  filtered: [],
  personalRanks: {},
  teamOverrides: {},
  view: "players",
  playerSort: DEFAULT_FILTERS.sort,
  fantasySort: {
    key: "index",
    direction: "asc",
  },
};

const els = {
  head: document.querySelector("#players-head"),
  body: document.querySelector("#players-body"),
  loading: document.querySelector("#loading-state"),
  empty: document.querySelector("#empty-state"),
  tableWrap: document.querySelector(".table-wrap"),
  tableScrollbar: document.querySelector(".table-scrollbar"),
  tableScrollbarInner: document.querySelector(".table-scrollbar-inner"),
  visibleCount: document.querySelector("#visible-count"),
  totalCount: document.querySelector("#total-count"),
  averageLikelihood: document.querySelector("#average-likelihood"),
  search: document.querySelector("#search-input"),
  team: document.querySelector("#team-filter"),
  position: document.querySelector("#position-filter"),
  experience: document.querySelector("#experience-filter"),
  sort: document.querySelector("#sort-select"),
  minLikelihood: document.querySelector("#min-likelihood"),
  rangeOutput: document.querySelector("#range-output"),
  reset: document.querySelector("#reset-button"),
  export: document.querySelector("#export-button"),
  exportMenu: document.querySelector("#export-menu"),
  exportFile: document.querySelector("#export-file-button"),
  exportCopy: document.querySelector("#export-copy-button"),
  exportFullCsv: document.querySelector("#export-full-csv-button"),
  exportFullXlsx: document.querySelector("#export-full-xlsx-button"),
  exportFullJson: document.querySelector("#export-full-json-button"),
  exportStatus: document.querySelector("#export-status"),
  top: document.querySelector("#top-button"),
  themeToggle: document.querySelector("#theme-toggle"),
  resetDialog: document.querySelector("#reset-dialog"),
  resetFilters: document.querySelector("#reset-filters-button"),
  deleteSavedData: document.querySelector("#delete-saved-data-button"),
  mobileMenuToggle: document.querySelector("#mobile-menu-toggle"),
  mobileMenuIcon: document.querySelector(".mobile-menu-icon"),
  mobileMenuLabel: document.querySelector(".mobile-menu-label"),
  viewTabs: [...document.querySelectorAll(".view-tab")],
};

const fantasyColumns = [
  { key: "index", label: "Index", type: "number", direction: "asc", className: "col-index" },
  { key: "personalRank", label: "Rank", type: "personalRank", direction: "asc", className: "col-rank" },
  { key: "playerName", label: "Player", type: "text", direction: "asc", className: "col-player" },
  { key: "fgPct", label: "FG%", type: "percent", direction: "desc" },
  { key: "ftPct", label: "FT%", type: "percent", direction: "desc" },
  { key: "fg3m", label: "3PM", type: "number", direction: "desc" },
  { key: "pts", label: "PTS", type: "number", direction: "desc" },
  { key: "reb", label: "REB", type: "number", direction: "desc" },
  { key: "ast", label: "AST", type: "number", direction: "desc" },
  { key: "stl", label: "STL", type: "number", direction: "desc" },
  { key: "blk", label: "BLK", type: "number", direction: "desc" },
  { key: "tov", label: "TOV", type: "number", direction: "asc" },
];

const fantasyStatKeys = new Set(fantasyColumns
  .filter((column) => column.type === "number" || column.type === "percent")
  .map((column) => column.key));

function fantasySortLabel(column, direction) {
  const label = column.key === "index" ? "Default" : column.label;

  if (column.type === "text") {
    return `${label} ${direction === "asc" ? "A to Z" : "Z to A"}`;
  }

  if (column.key === "personalRank" || column.key === "index") {
    return `${label} ${direction === "asc" ? "Low To High" : "High To Low"}`;
  }

  return `${label} ${direction === "asc" ? "Low To High" : "High To Low"}`;
}

const fantasySortOptions = fantasyColumns.flatMap((column) => [
  {
    value: `${column.key}:asc`,
    label: fantasySortLabel(column, "asc"),
  },
  {
    value: `${column.key}:desc`,
    label: fantasySortLabel(column, "desc"),
  },
]);

let syncingTableScroll = false;
const tableDrag = {
  active: false,
  dragging: false,
  pointerId: null,
  startX: 0,
  startY: 0,
  scrollLeft: 0,
};

const playerColumns = [
  { label: "Index", className: "col-index" },
  { label: "Rank", className: "col-rank" },
  { label: "Player", className: "col-player" },
  { label: "Team", className: "col-team" },
  { label: "Position", className: "col-position" },
  { label: "NBA ID", className: "col-id" },
  { label: "Experience", className: "col-experience" },
  { label: "Likelihood", className: "col-likelihood" },
];

function parseCsv(text) {
  const rows = [];
  let cell = "";
  let row = [];
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];

    if (char === '"' && quoted && next === '"') {
      cell += '"';
      index += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === "," && !quoted) {
      row.push(cell);
      cell = "";
    } else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && next === "\n") {
        index += 1;
      }
      row.push(cell);
      if (row.some((value) => value !== "")) {
        rows.push(row);
      }
      row = [];
      cell = "";
    } else {
      cell += char;
    }
  }

  if (cell || row.length) {
    row.push(cell);
    rows.push(row);
  }

  const [headers, ...data] = rows;
  return data.map((values) =>
    Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ""])),
  );
}

function toOptionalNumber(value) {
  if (value === "" || value === null || value === undefined) {
    return null;
  }

  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function searchablePlayerText(playerName) {
  return buildSearchablePlayerText(playerName, PLAYER_SEARCH_ALIASES);
}

function toPlayer(row) {
  const playerName = row.player_name;

  return {
    index: Number(row.index),
    playerName,
    searchableText: searchablePlayerText(playerName),
    team: row.team_abbreviation,
    position: row.position,
    playerId: row.player_id,
    experience: row.experience,
    activeLikelihood: Number(row.active_likelihood),
    fantasy: {
      fgPct: toOptionalNumber(row.fantasy_fg_pct),
      fgm: toOptionalNumber(row.fantasy_fgm),
      fga: toOptionalNumber(row.fantasy_fga),
      ftPct: toOptionalNumber(row.fantasy_ft_pct),
      ftm: toOptionalNumber(row.fantasy_ftm),
      fta: toOptionalNumber(row.fantasy_fta),
      fg3m: toOptionalNumber(row.fantasy_fg3m),
      pts: toOptionalNumber(row.fantasy_pts),
      reb: toOptionalNumber(row.fantasy_reb),
      ast: toOptionalNumber(row.fantasy_ast),
      stl: toOptionalNumber(row.fantasy_stl),
      blk: toOptionalNumber(row.fantasy_blk),
      tov: toOptionalNumber(row.fantasy_tov),
    },
  };
}

function loadTeamOverrides() {
  try {
    const saved = JSON.parse(localStorage.getItem(TEAM_OVERRIDE_KEY) || "{}");
    state.teamOverrides = saved && typeof saved === "object" ? saved : {};
  } catch {
    state.teamOverrides = {};
  }
}

function saveTeamOverrides() {
  localStorage.setItem(TEAM_OVERRIDE_KEY, JSON.stringify(state.teamOverrides));
}

function loadPersonalRanks() {
  try {
    const saved = JSON.parse(localStorage.getItem(PERSONAL_RANK_KEY) || "{}");
    state.personalRanks = normalizePersonalRanks(saved && typeof saved === "object" ? saved : {});
    savePersonalRanks();
  } catch {
    state.personalRanks = {};
  }
}

function savePersonalRanks() {
  localStorage.setItem(PERSONAL_RANK_KEY, JSON.stringify(state.personalRanks));
}

function loadTheme() {
  return localStorage.getItem(THEME_KEY) === "dark" ? "dark" : "light";
}

function applyTheme(theme) {
  const isDark = theme === "dark";

  document.body.dataset.theme = theme;
  els.themeToggle.checked = isDark;
  els.themeToggle.setAttribute("aria-checked", String(isDark));
}

function saveTheme(theme) {
  localStorage.setItem(THEME_KEY, theme);
}

function personalRankKey(player) {
  return String(player.playerId || player.playerName);
}

function displayedTeam(player) {
  return state.teamOverrides[personalRankKey(player)] || player.team;
}

function teamOptions() {
  return uniqueSorted([
    ...state.players.map((player) => player.team),
    ...Object.values(state.teamOverrides),
    "FA",
  ]);
}

function setTeamOverride(playerId, value) {
  const player = state.players.find((item) => personalRankKey(item) === String(playerId));
  if (!player) {
    return;
  }

  const cleaned = value.trim().toUpperCase();
  if (!cleaned || cleaned === player.team) {
    delete state.teamOverrides[String(playerId)];
  } else {
    state.teamOverrides[String(playerId)] = cleaned;
  }
  saveTeamOverrides();
}

function personalRank(player) {
  const value = state.personalRanks[personalRankKey(player)];
  const rank = Number(value);
  return Number.isFinite(rank) && rank > 0 ? rank : null;
}

function nextPersonalRank() {
  return nextPersonalRankFromMap(state.personalRanks);
}

function updatePersonalRank(playerId, value) {
  state.personalRanks = updatePersonalRankMap(state.personalRanks, playerId, value);
  savePersonalRanks();
}

function uniqueSorted(values) {
  return [...new Set(values.filter(Boolean))].sort((a, b) => a.localeCompare(b));
}

function fillSelect(select, values, label) {
  select.replaceChildren(new Option(label, ""));
  uniqueSorted(values).forEach((value) => select.add(new Option(value, value)));
}

function fillOptions(select, options) {
  select.replaceChildren(...options.map((option) => new Option(option.label, option.value)));
}

function experienceValue(player) {
  return window.NbaRankerLogic.experienceValue(player.experience);
}

function experienceLabel(player) {
  return window.NbaRankerLogic.experienceLabel(player.experience);
}

function syncSortSelectOptions() {
  const options = state.view === "fantasy" ? fantasySortOptions : playerSortOptions;
  const value =
    state.view === "fantasy"
      ? `${state.fantasySort.key}:${state.fantasySort.direction}`
      : state.playerSort;

  fillOptions(els.sort, options);
  els.sort.value = value;
}

function fantasySortValue(key, direction) {
  return `${key}:${direction}`;
}

function setupFilters() {
  const selectedTeam = els.team.value;
  fillSelect(els.team, state.players.map(displayedTeam), "All Teams");
  if ([...els.team.options].some((option) => option.value === selectedTeam)) {
    els.team.value = selectedTeam;
  }
  fillSelect(els.position, state.players.map((player) => player.position), "All Positions");
  fillOptions(els.experience, experienceOptions);
  syncSortSelectOptions();
}

function currentFilters() {
  const min = Number(els.minLikelihood.value);

  return {
    search: normalizeSearchText(els.search.value.trim()),
    team: els.team.value,
    position: els.position.value,
    experience: els.experience.value,
    sort: state.playerSort,
    min,
    max: 1,
  };
}

function sortPlayers(players, sortKey) {
  return sortPlayerList(players, sortKey, { displayedTeam, personalRank });
}

function sortFantasyPlayers(players) {
  return sortFantasyPlayerList(players, state.fantasySort, personalRank);
}

function setFantasySort(key, direction = null) {
  const column = fantasyColumns.find((item) => item.key === key);
  if (!column) {
    return;
  }

  state.fantasySort.key = column.key;
  state.fantasySort.direction = direction || column.direction;
  els.sort.value = fantasySortValue(column.key, state.fantasySort.direction);
}

function setFantasySortFromValue(value) {
  const [key, direction] = value.split(":");
  setFantasySort(key, direction === "asc" ? "asc" : "desc");
}

function filterPlayers() {
  const filters = currentFilters();

  const filtered = state.players.filter((player) => {
    const matchesSearch = player.searchableText.includes(filters.search);
    const matchesTeam = !filters.team || displayedTeam(player) === filters.team;
    const matchesPosition = matchesPositionFilter(player.position, filters.position);
    const matchesExperience = !filters.experience || experienceValue(player) === filters.experience;
    const matchesLikelihood =
      player.activeLikelihood >= filters.min && player.activeLikelihood <= filters.max;

    return (
      matchesSearch &&
      matchesTeam &&
      matchesPosition &&
      matchesExperience &&
      matchesLikelihood
    );
  });

  state.filtered =
    state.view === "fantasy"
      ? sortFantasyPlayers(filtered)
      : sortPlayers(filtered, filters.sort);
}

function likelihoodClass(value) {
  if (value < 0.5) {
    return "low";
  }
  if (value < 0.75) {
    return "mid";
  }
  return "";
}

function appendTextCell(row, value, className = "") {
  const cell = document.createElement("td");
  cell.textContent = value ?? "";
  if (className) {
    cell.className = className;
  }
  row.append(cell);
}

function appendPersonalRankCell(row, player) {
  const cell = document.createElement("td");
  const input = document.createElement("input");
  const savedPersonalRank = personalRank(player);

  cell.className = "col-rank";
  input.className = "personal-rank-input";
  input.type = "number";
  input.min = "1";
  input.step = "1";
  input.inputMode = "numeric";
  input.value = savedPersonalRank ?? "";
  input.setAttribute("aria-label", `Personal rank for ${player.playerName}`);
  input.dataset.playerId = personalRankKey(player);
  cell.append(input);
  row.append(cell);
}

function appendTeamCell(row, player) {
  const cell = document.createElement("td");
  const select = document.createElement("select");

  cell.className = "col-team";
  select.className = "team-select";
  select.setAttribute("aria-label", `Team for ${player.playerName}`);
  select.dataset.playerId = personalRankKey(player);
  teamOptions().forEach((team) => select.add(new Option(team, team)));
  select.value = displayedTeam(player);

  cell.append(select);
  row.append(cell);
}

function appendLikelihoodCell(row, label, value) {
  const cell = document.createElement("td");
  const wrapper = document.createElement("div");
  const labelEl = document.createElement("span");
  const meter = document.createElement("span");
  const fill = document.createElement("span");

  cell.className = "col-likelihood";
  wrapper.className = "likelihood";
  labelEl.className = "likelihood-value";
  labelEl.textContent = label;
  meter.className = `meter ${likelihoodClass(value)}`;
  meter.setAttribute("role", "meter");
  meter.setAttribute("aria-valuemin", "0");
  meter.setAttribute("aria-valuemax", "1");
  meter.setAttribute("aria-valuenow", String(value));
  meter.setAttribute("aria-label", `Active likelihood ${label}`);
  fill.style.width = `${value * 100}%`;

  meter.append(fill);
  wrapper.append(labelEl, meter);
  cell.append(wrapper);
  row.append(cell);
}

function playerRow(player) {
  const tr = document.createElement("tr");
  const likelihood = player.activeLikelihood.toFixed(2);

  appendTextCell(tr, player.index, "col-index number-cell");
  appendPersonalRankCell(tr, player);
  appendTextCell(tr, player.playerName, "col-player player-cell");
  appendTeamCell(tr, player);
  appendTextCell(tr, player.position, "col-position");
  appendTextCell(tr, player.playerId, "col-id number-cell");
  appendTextCell(tr, experienceLabel(player), "col-experience");
  appendLikelihoodCell(tr, likelihood, player.activeLikelihood);

  return tr;
}

function fantasyRow(player) {
  const tr = document.createElement("tr");
  const playerHasFantasyData = hasFantasyData(player);

  fantasyColumns.forEach((column) => {
    if (column.type === "personalRank") {
      appendPersonalRankCell(tr, player);
      return;
    }
    if (column.key === "playerName") {
      appendTextCell(tr, player.playerName, "col-player player-cell");
      return;
    }

    appendTextCell(
      tr,
      formatFantasyValue(
        fantasyValue(player, column.key),
        column.type,
        playerHasFantasyData && fantasyStatKeys.has(column.key),
      ),
      [column.className, column.type === "text" ? "" : "number-cell"].filter(Boolean).join(" "),
    );
  });

  return tr;
}

function renderPlayerHeader() {
  const row = document.createElement("tr");
  playerColumns.forEach((column) => {
    const header = document.createElement("th");

    header.scope = "col";
    header.className = column.className;
    header.textContent = column.label;
    row.append(header);
  });

  els.head.replaceChildren(row);
}

function sortDirectionText(direction) {
  return direction === "asc" ? "ascending" : "descending";
}

function renderFantasyHeader() {
  const row = document.createElement("tr");

  fantasyColumns.forEach((column) => {
    const header = document.createElement("th");
    const button = document.createElement("button");
    const active = state.fantasySort.key === column.key;

    header.scope = "col";
    if (column.className) {
      header.className = column.className;
    }
    header.setAttribute("aria-sort", active ? sortDirectionText(state.fantasySort.direction) : "none");
    button.className = `table-sort-button${active ? " is-active" : ""}`;
    button.type = "button";
    button.dataset.sortKey = column.key;
    button.textContent = active
      ? `${column.label} ${state.fantasySort.direction === "asc" ? "↑" : "↓"}`
      : column.label;
    button.setAttribute(
      "aria-label",
      active
        ? `Sorted by ${column.label}, ${sortDirectionText(state.fantasySort.direction)}`
        : `Sort by ${column.label}`,
    );
    header.append(button);
    row.append(header);
  });

  els.head.replaceChildren(row);
}

function renderSummary() {
  const totalLikelihood = state.filtered.reduce(
    (sum, player) => sum + player.activeLikelihood,
    0,
  );
  const average = state.filtered.length ? totalLikelihood / state.filtered.length : 0;

  els.visibleCount.textContent = String(state.filtered.length);
  els.totalCount.textContent = String(state.players.length);
  els.averageLikelihood.textContent = average.toFixed(2);
}

function renderTable() {
  els.tableWrap.dataset.view = state.view;
  syncSortSelectOptions();

  if (state.view === "fantasy") {
    renderFantasyHeader();
    els.body.replaceChildren(...state.filtered.map(fantasyRow));
  } else {
    renderPlayerHeader();
    els.body.replaceChildren(...state.filtered.map(playerRow));
  }

  els.tableWrap.hidden = state.filtered.length === 0;
  els.tableScrollbar.hidden = state.filtered.length === 0;
  els.empty.hidden = state.filtered.length !== 0;
  requestAnimationFrame(updateTableScrollbar);
}

function updateTableScrollbar() {
  const table = els.tableWrap.querySelector("table");
  if (!table || els.tableWrap.hidden) {
    return;
  }

  els.tableScrollbarInner.style.width = `${table.scrollWidth}px`;
  els.tableScrollbar.scrollLeft = els.tableWrap.scrollLeft;
}

function syncHorizontalScroll(source, target) {
  if (syncingTableScroll) {
    return;
  }

  syncingTableScroll = true;
  target.scrollLeft = source.scrollLeft;
  requestAnimationFrame(() => {
    syncingTableScroll = false;
  });
}

function syncTableScrollPosition(scrollLeft) {
  els.tableWrap.scrollLeft = scrollLeft;
  els.tableScrollbar.scrollLeft = scrollLeft;
}

function isInteractiveTableTarget(target) {
  return Boolean(target.closest("button, input, select, textarea, a"));
}

function startTableDragAt(x, y, pointerId = null) {
  tableDrag.active = true;
  tableDrag.dragging = false;
  tableDrag.pointerId = pointerId;
  tableDrag.startX = x;
  tableDrag.startY = y;
  tableDrag.scrollLeft = els.tableWrap.scrollLeft;
}

function moveTableDragTo(x, y, event) {
  if (!tableDrag.active) {
    return;
  }

  const deltaX = x - tableDrag.startX;
  const deltaY = y - tableDrag.startY;

  if (!tableDrag.dragging && Math.abs(deltaX) <= 8) {
    return;
  }

  if (!tableDrag.dragging && Math.abs(deltaY) > Math.abs(deltaX)) {
    endTableDrag();
    return;
  }

  tableDrag.dragging = true;
  event.preventDefault();
  syncTableScrollPosition(tableDrag.scrollLeft - deltaX);
}

function startTableDrag(event) {
  if (isInteractiveTableTarget(event.target)) {
    return;
  }

  startTableDragAt(event.clientX, event.clientY, event.pointerId);
}

function moveTableDrag(event) {
  if (!tableDrag.active || event.pointerId !== tableDrag.pointerId) {
    return;
  }

  moveTableDragTo(event.clientX, event.clientY, event);
}

function startTableTouchDrag(event) {
  if (event.touches.length !== 1 || isInteractiveTableTarget(event.target)) {
    return;
  }

  const [touch] = event.touches;
  startTableDragAt(touch.clientX, touch.clientY);
}

function moveTableTouchDrag(event) {
  if (!tableDrag.active || event.touches.length !== 1) {
    return;
  }

  const [touch] = event.touches;
  moveTableDragTo(touch.clientX, touch.clientY, event);
}

function endTableDrag(event) {
  if (event && tableDrag.pointerId !== null && event.pointerId !== tableDrag.pointerId) {
    return;
  }

  tableDrag.active = false;
  tableDrag.dragging = false;
  tableDrag.pointerId = null;
}

function renderRangeLabel() {
  const { min } = currentFilters();
  els.rangeOutput.textContent = `${min.toFixed(2)} And Up`;
}

function applyFilters() {
  renderRangeLabel();
  filterPlayers();
  renderSummary();
  renderTable();
}

function resetSorts() {
  if (state.view === "fantasy") {
    setFantasySort("index", "asc");
  } else {
    state.playerSort = DEFAULT_FILTERS.sort;
    els.sort.value = state.playerSort;
  }
  applyFilters();
}

function openResetDialog() {
  closeExportMenu();
  if (typeof els.resetDialog.showModal === "function") {
    els.resetDialog.showModal();
    return;
  }

  if (window.confirm("Reset the current sort order? Saved ranks and team edits will stay in place.")) {
    resetSorts();
  }
}

function closeResetDialog() {
  if (els.resetDialog.open) {
    els.resetDialog.close();
  }
  els.reset.focus();
}

function deleteSavedAppData() {
  localStorage.removeItem(PERSONAL_RANK_KEY);
  localStorage.removeItem(TEAM_OVERRIDE_KEY);
  localStorage.removeItem(THEME_KEY);
  state.personalRanks = {};
  state.teamOverrides = {};
  applyTheme("light");
  els.team.value = DEFAULT_FILTERS.team;
  setupFilters();
  resetSorts();
  closeResetDialog();
}

function setMobileMenuOpen(isOpen) {
  document.body.classList.toggle("mobile-menu-open", isOpen);
  els.mobileMenuToggle.setAttribute("aria-expanded", String(isOpen));
  els.mobileMenuIcon.textContent = isOpen ? "×" : "☰";
  els.mobileMenuLabel.textContent = isOpen ? "Close Menu" : "Menu";
}

function closeMobileMenu() {
  setMobileMenuOpen(false);
}

function scrollResultsToTop() {
  closeMobileMenu();
  els.tableWrap.scrollTo({ top: 0, left: 0, behavior: "smooth" });
  els.tableScrollbar.scrollTo({ left: 0, behavior: "smooth" });
  document.querySelector(".table-section").scrollIntoView({
    behavior: "smooth",
    block: "start",
  });
}

function rankedExportRows() {
  return buildRankedExportRows(state.players, { personalRank, displayedTeam });
}

function rankedExportCsv() {
  return rowsToCsv(EXPORT_FIELDS, rankedExportRows());
}

function fullExportRows() {
  return buildFullExportRows(state.filtered, { personalRank, displayedTeam });
}

function fullExportCsv() {
  return rowsToCsv(FULL_EXPORT_FIELDS, fullExportRows());
}

function fullExportJson() {
  return JSON.stringify(fullExportRows(), null, 2);
}

function xmlValue(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function excelColumnName(index) {
  let name = "";
  let cursor = index + 1;

  while (cursor > 0) {
    cursor -= 1;
    name = String.fromCharCode(65 + (cursor % 26)) + name;
    cursor = Math.floor(cursor / 26);
  }

  return name;
}

function worksheetXml(rows) {
  const allRows = [FULL_EXPORT_FIELDS, ...rows.map((row) => FULL_EXPORT_FIELDS.map((field) => row[field]))];
  const sheetRows = allRows
    .map((row, rowIndex) => {
      const cells = row
        .map((value, columnIndex) => {
          const ref = `${excelColumnName(columnIndex)}${rowIndex + 1}`;
          if (typeof value === "number" && Number.isFinite(value)) {
            return `<c r="${ref}"><v>${value}</v></c>`;
          }

          return `<c r="${ref}" t="inlineStr"><is><t>${xmlValue(value)}</t></is></c>`;
        })
        .join("");
      return `<row r="${rowIndex + 1}">${cells}</row>`;
    })
    .join("");
  const lastColumn = excelColumnName(FULL_EXPORT_FIELDS.length - 1);
  const lastRow = Math.max(allRows.length, 1);

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <dimension ref="A1:${lastColumn}${lastRow}"/>
  <sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>
  <sheetData>${sheetRows}</sheetData>
</worksheet>`;
}

function crc32(bytes) {
  let crc = -1;

  for (const byte of bytes) {
    crc = (crc >>> 8) ^ CRC32_TABLE[(crc ^ byte) & 0xff];
  }

  return (crc ^ -1) >>> 0;
}

function dateToDosTime(date) {
  const year = Math.max(date.getFullYear(), 1980);
  return {
    time: (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2),
    date: ((year - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate(),
  };
}

function writeUint16(bytes, value) {
  bytes.push(value & 0xff, (value >>> 8) & 0xff);
}

function writeUint32(bytes, value) {
  bytes.push(value & 0xff, (value >>> 8) & 0xff, (value >>> 16) & 0xff, (value >>> 24) & 0xff);
}

function createZip(files) {
  const encoder = new TextEncoder();
  const output = [];
  const centralDirectory = [];
  const timestamp = dateToDosTime(new Date());

  files.forEach((file) => {
    const nameBytes = encoder.encode(file.name);
    const dataBytes = encoder.encode(file.content);
    const checksum = crc32(dataBytes);
    const offset = output.length;

    writeUint32(output, 0x04034b50);
    writeUint16(output, 20);
    writeUint16(output, 0x0800);
    writeUint16(output, 0);
    writeUint16(output, timestamp.time);
    writeUint16(output, timestamp.date);
    writeUint32(output, checksum);
    writeUint32(output, dataBytes.length);
    writeUint32(output, dataBytes.length);
    writeUint16(output, nameBytes.length);
    writeUint16(output, 0);
    output.push(...nameBytes, ...dataBytes);

    writeUint32(centralDirectory, 0x02014b50);
    writeUint16(centralDirectory, 20);
    writeUint16(centralDirectory, 20);
    writeUint16(centralDirectory, 0x0800);
    writeUint16(centralDirectory, 0);
    writeUint16(centralDirectory, timestamp.time);
    writeUint16(centralDirectory, timestamp.date);
    writeUint32(centralDirectory, checksum);
    writeUint32(centralDirectory, dataBytes.length);
    writeUint32(centralDirectory, dataBytes.length);
    writeUint16(centralDirectory, nameBytes.length);
    writeUint16(centralDirectory, 0);
    writeUint16(centralDirectory, 0);
    writeUint16(centralDirectory, 0);
    writeUint16(centralDirectory, 0);
    writeUint32(centralDirectory, 0);
    writeUint32(centralDirectory, offset);
    centralDirectory.push(...nameBytes);
  });

  const centralDirectoryOffset = output.length;
  output.push(...centralDirectory);
  writeUint32(output, 0x06054b50);
  writeUint16(output, 0);
  writeUint16(output, 0);
  writeUint16(output, files.length);
  writeUint16(output, files.length);
  writeUint32(output, centralDirectory.length);
  writeUint32(output, centralDirectoryOffset);
  writeUint16(output, 0);

  return new Uint8Array(output);
}

function fullExportXlsx() {
  const rows = fullExportRows();
  return createZip([
    {
      name: "[Content_Types].xml",
      content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
</Types>`,
    },
    {
      name: "_rels/.rels",
      content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`,
    },
    {
      name: "xl/workbook.xml",
      content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets><sheet name="Players" sheetId="1" r:id="rId1"/></sheets>
</workbook>`,
    },
    {
      name: "xl/_rels/workbook.xml.rels",
      content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
</Relationships>`,
    },
    {
      name: "xl/worksheets/sheet1.xml",
      content: worksheetXml(rows),
    },
  ]);
}

function setExportStatus(message) {
  els.exportStatus.textContent = message;
}

function setExportMenuOpen(isOpen, focusFirstItem = false) {
  els.export.setAttribute("aria-expanded", String(isOpen));
  els.exportMenu.hidden = !isOpen;

  if (isOpen && focusFirstItem) {
    requestAnimationFrame(() => els.exportFile.focus());
  }
}

function toggleExportMenu() {
  setExportMenuOpen(els.exportMenu.hidden, true);
}

function closeExportMenu() {
  setExportMenuOpen(false);
}

function downloadTextFile(text, fileName, type) {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = fileName;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function downloadBytesFile(bytes, fileName, type) {
  const blob = new Blob([bytes], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = fileName;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function downloadRankedCsv() {
  downloadTextFile(rankedExportCsv(), EXPORT_FILE_NAME, "text/csv;charset=utf-8");
  setExportStatus("CSV File Exported.");
  closeExportMenu();
}

function downloadFullCsv() {
  downloadTextFile(fullExportCsv(), FULL_CSV_EXPORT_FILE_NAME, "text/csv;charset=utf-8");
  setExportStatus("Full CSV Exported.");
  closeExportMenu();
}

function downloadFullXlsx() {
  downloadBytesFile(
    fullExportXlsx(),
    FULL_XLSX_EXPORT_FILE_NAME,
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  );
  setExportStatus("Full XLSX Exported.");
  closeExportMenu();
}

function downloadFullJson() {
  downloadTextFile(fullExportJson(), FULL_JSON_EXPORT_FILE_NAME, "application/json;charset=utf-8");
  setExportStatus("Full JSON Exported.");
  closeExportMenu();
}

function copyTextFallback(text) {
  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.top = "-9999px";
  document.body.append(textarea);
  textarea.select();

  try {
    document.execCommand("copy");
  } finally {
    textarea.remove();
  }
}

async function copyRankedCsvToClipboard() {
  const csv = rankedExportCsv();

  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(csv);
    } else {
      copyTextFallback(csv);
    }
    setExportStatus("CSV Copied To Clipboard.");
  } catch {
    setExportStatus("CSV could not be copied.");
  } finally {
    closeExportMenu();
  }
}

function bindEvents() {
  [els.search, els.team, els.position, els.experience, els.minLikelihood].forEach((control) =>
    control.addEventListener("input", applyFilters),
  );
  els.sort.addEventListener("input", () => {
    if (state.view === "fantasy") {
      setFantasySortFromValue(els.sort.value);
    } else {
      state.playerSort = els.sort.value;
    }
    applyFilters();
  });

  els.reset.addEventListener("click", openResetDialog);
  els.resetFilters.addEventListener("click", () => {
    resetSorts();
    closeResetDialog();
  });
  els.deleteSavedData.addEventListener("click", deleteSavedAppData);
  els.export.addEventListener("click", toggleExportMenu);
  els.exportFile.addEventListener("click", downloadRankedCsv);
  els.exportCopy.addEventListener("click", copyRankedCsvToClipboard);
  els.exportFullCsv.addEventListener("click", downloadFullCsv);
  els.exportFullXlsx.addEventListener("click", downloadFullXlsx);
  els.exportFullJson.addEventListener("click", downloadFullJson);
  els.top.addEventListener("click", scrollResultsToTop);
  els.tableWrap.addEventListener("scroll", () => {
    syncHorizontalScroll(els.tableWrap, els.tableScrollbar);
  });
  els.tableScrollbar.addEventListener("scroll", () => {
    syncHorizontalScroll(els.tableScrollbar, els.tableWrap);
  });
  els.tableWrap.addEventListener("pointerdown", startTableDrag);
  els.tableWrap.addEventListener("pointermove", moveTableDrag);
  els.tableWrap.addEventListener("pointerup", endTableDrag);
  els.tableWrap.addEventListener("pointercancel", endTableDrag);
  els.tableWrap.addEventListener("pointerleave", endTableDrag);
  els.tableWrap.addEventListener("touchstart", startTableTouchDrag, { passive: true });
  els.tableWrap.addEventListener("touchmove", moveTableTouchDrag, { passive: false });
  els.tableWrap.addEventListener("touchend", endTableDrag);
  els.tableWrap.addEventListener("touchcancel", endTableDrag);
  window.addEventListener("resize", updateTableScrollbar);
  els.themeToggle.addEventListener("change", () => {
    const theme = els.themeToggle.checked ? "dark" : "light";
    applyTheme(theme);
    saveTheme(theme);
  });
  els.mobileMenuToggle.addEventListener("click", () => {
    setMobileMenuOpen(!document.body.classList.contains("mobile-menu-open"));
  });
  document.addEventListener("click", (event) => {
    if (!event.target.closest(".export-menu")) {
      closeExportMenu();
    }
  });
  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") {
      return;
    }

    if (!els.exportMenu.hidden) {
      closeExportMenu();
      els.export.focus();
      return;
    }

    if (document.body.classList.contains("mobile-menu-open")) {
      closeMobileMenu();
      els.mobileMenuToggle.focus();
    }
  });

  els.body.addEventListener("change", (event) => {
    const teamSelect = event.target.closest(".team-select");
    if (teamSelect) {
      if (state.view !== "players") {
        applyFilters();
        return;
      }

      setTeamOverride(teamSelect.dataset.playerId, teamSelect.value);
      setupFilters();
      applyFilters();
      return;
    }

    const input = event.target.closest(".personal-rank-input");
    if (!input) {
      return;
    }

    updatePersonalRank(input.dataset.playerId, input.value);
    delete input.dataset.autofilledRank;
    applyFilters();
  });

  els.body.addEventListener("focusin", (event) => {
    const input = event.target.closest(".personal-rank-input");
    if (!input) {
      return;
    }

    if (!input.value.trim()) {
      input.value = String(nextPersonalRank());
      input.dataset.autofilledRank = "true";
      updatePersonalRank(input.dataset.playerId, input.value);
    }

    requestAnimationFrame(() => input.select());
  });

  els.body.addEventListener("focusout", (event) => {
    const input = event.target.closest(".personal-rank-input");
    if (!input || input.dataset.autofilledRank !== "true") {
      return;
    }

    delete input.dataset.autofilledRank;
  });

  els.body.addEventListener("keydown", (event) => {
    const input = event.target.closest(".personal-rank-input");
    if (!input || event.key !== "Enter") {
      return;
    }

    input.blur();
  });

  els.head.addEventListener("click", (event) => {
    const button = event.target.closest(".table-sort-button");
    if (!button) {
      return;
    }

    const column = fantasyColumns.find((item) => item.key === button.dataset.sortKey);
    if (!column) {
      return;
    }

    if (state.fantasySort.key === column.key) {
      setFantasySort(column.key, state.fantasySort.direction === "asc" ? "desc" : "asc");
    } else {
      setFantasySort(column.key);
    }

    applyFilters();
  });

  els.viewTabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      if (state.view === tab.dataset.view) {
        return;
      }

      state.view = tab.dataset.view;
      els.viewTabs.forEach((item) => {
        const isActive = item === tab;
        item.classList.toggle("is-active", isActive);
        item.setAttribute("aria-current", isActive ? "page" : "false");
      });
      syncSortSelectOptions();
      closeMobileMenu();
      applyFilters();
    });
  });
}

async function loadPlayers() {
  if (Array.isArray(window.NBA_PLAYER_DATA)) {
    state.players = window.NBA_PLAYER_DATA.map(toPlayer);
    return;
  }

  const response = await fetch(CSV_PATH);
  if (!response.ok) {
    throw new Error(`Unable to load ${CSV_PATH}`);
  }
  const text = await response.text();
  state.players = parseCsv(text).map(toPlayer);
}

async function init() {
  applyTheme(loadTheme());
  loadPersonalRanks();
  loadTeamOverrides();
  bindEvents();

  try {
    await loadPlayers();
    setupFilters();
    els.loading.hidden = true;
    applyFilters();
  } catch (error) {
    els.loading.textContent = "Could Not Load Player Data.";
    console.error(error);
  }
}

init();
