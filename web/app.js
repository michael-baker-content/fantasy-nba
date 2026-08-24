const CSV_PATH = "../data/nba_2026_27_likely_players.csv";
const PERSONAL_RANK_KEY = "nba-player-explorer.personal-ranks.v1";
const TEAM_OVERRIDE_KEY = "nba-player-explorer.team-overrides.v1";
const THEME_KEY = "nba-player-explorer.theme.v1";
const EXPORT_FILE_NAME = "my_nba_rankings.csv";
const INDEX_OVERRIDE_EXPORT_FILE_NAME = "index_overrides.csv";
const FULL_CSV_EXPORT_FILE_NAME = "nba_player_ranker_full_export.csv";
const FULL_XLSX_EXPORT_FILE_NAME = "nba_player_ranker_full_export.xlsx";
const FULL_JSON_EXPORT_FILE_NAME = "nba_player_ranker_full_export.json";
const EMPTY_INFO_VALUE = "—";
const EXPORT_FIELDS = ["rank", "name", "team", "position"];
const INDEX_OVERRIDE_EXPORT_FIELDS = ["index", "player_name", "player_id"];
const FULL_EXPORT_FIELDS = [
  "rank",
  "index",
  "name",
  "team",
  "original_team",
  "position",
  "nba_player_id",
  "experience",
  "age",
  "birthdate",
  "height",
  "college",
  "country",
  "draft_year",
  "draft_round",
  "draft_number",
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
  seedPersonalRanks,
  screenStepRankValue,
  updatePersonalRank: updatePersonalRankMap,
  sortPlayers: sortPlayerList,
  sortFantasyPlayers: sortFantasyPlayerList,
  fantasyValue,
  hasFantasyData,
  formatFantasyValue,
  rowsToCsv,
  rankedExportRows: buildRankedExportRows,
  indexOverrideExportRows: buildIndexOverrideExportRows,
  fullExportRows: buildFullExportRows,
  virtualWindow,
} = window.NbaRankerLogic;
const DESKTOP_VIRTUAL_ROW_HEIGHT = 52;
const MOBILE_VIRTUAL_ROW_HEIGHT = 46;
const VIRTUAL_OVERSCAN_ROWS = 12;
const STATUS_DISMISS_DELAY_MS = 1000;
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
};

const playerSortOptions = [
  { value: "index-asc", label: "Default" },
  { value: "personal-rank-asc", label: "Rank" },
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
  search: document.querySelector("#search-input"),
  team: document.querySelector("#team-filter"),
  position: document.querySelector("#position-filter"),
  experience: document.querySelector("#experience-filter"),
  sort: document.querySelector("#sort-select"),
  reset: document.querySelector("#reset-button"),
  seed: document.querySelector("#seed-button"),
  export: document.querySelector("#export-button"),
  exportMenu: document.querySelector("#export-menu"),
  exportFile: document.querySelector("#export-file-button"),
  exportCopy: document.querySelector("#export-copy-button"),
  exportIndexOverride: document.querySelector("#export-index-override-button"),
  exportFullCsv: document.querySelector("#export-full-csv-button"),
  exportFullXlsx: document.querySelector("#export-full-xlsx-button"),
  exportFullJson: document.querySelector("#export-full-json-button"),
  exportStatus: document.querySelector("#export-status"),
  top: document.querySelector("#top-button"),
  themeToggles: [...document.querySelectorAll(".theme-toggle input")],
  resetDialog: document.querySelector("#reset-dialog"),
  resetFilters: document.querySelector("#reset-filters-button"),
  deleteSavedData: document.querySelector("#delete-saved-data-button"),
  playerDetailDialog: document.querySelector("#player-detail-dialog"),
  playerDetailTitle: document.querySelector("#player-detail-title"),
  playerDetailSubtitle: document.querySelector("#player-detail-subtitle"),
  playerDetailList: document.querySelector("#player-detail-list"),
  playerDetailClose: document.querySelector("#player-detail-close-button"),
  desktopFilterToggle: document.querySelector("#desktop-filter-toggle"),
  mobileMenuToggle: document.querySelector("#mobile-menu-toggle"),
  mobileMenuIcon: document.querySelector(".mobile-menu-icon"),
  mobileMenuLabel: document.querySelector(".mobile-menu-label"),
  viewTabs: [...document.querySelectorAll(".view-tab")],
};

const fantasyColumns = [
  { key: "index", label: "Index", type: "number", direction: "asc", className: "col-index" },
  { key: "personalRank", label: "Rank", type: "personalRank", direction: "asc", className: "col-rank" },
  { key: "playerName", label: "Player", type: "text", direction: "asc", className: "col-player" },
  { key: "team", label: "Team", type: "team", className: "col-team", sortable: false },
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

const fantasySortOptions = fantasyColumns
  .filter((column) => column.sortable !== false)
  .flatMap((column) => [
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
let lastRenderedScrollTop = 0;
let statusDismissTimer = null;
let lastPlayerDetailTrigger = null;
let ignoreNextPlayerDetailClick = false;
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
  { label: "Age", className: "col-age" },
  { label: "Height", className: "col-height" },
  { label: "Background", className: "col-college" },
  { label: "Country", className: "col-country" },
  { label: "Draft", className: "col-draft" },
  { label: "Experience", className: "col-experience" },
];

function virtualRowHeight() {
  return window.matchMedia("(max-width: 640px)").matches
    ? MOBILE_VIRTUAL_ROW_HEIGHT
    : DESKTOP_VIRTUAL_ROW_HEIGHT;
}

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
    age: row.age,
    birthdate: row.birthdate,
    height: row.height,
    college: row.college,
    country: row.country,
    draftYear: row.draft_year,
    draftRound: row.draft_round,
    draftNumber: row.draft_number,
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
  const savedTheme = localStorage.getItem(THEME_KEY);
  if (savedTheme === "dark" || savedTheme === "light") {
    return savedTheme;
  }

  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function applyTheme(theme) {
  const isDark = theme === "dark";

  document.body.dataset.theme = theme;
  els.themeToggles.forEach((toggle) => {
    toggle.checked = isDark;
    toggle.setAttribute("aria-checked", String(isDark));
  });
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
    "NA",
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

function personalRankById(playerId) {
  const value = state.personalRanks[String(playerId)];
  const rank = Number(value);
  return Number.isFinite(rank) && rank > 0 ? rank : null;
}

function nextPersonalRank() {
  return nextPersonalRankFromMap(state.personalRanks);
}

function personalRankCount() {
  return Math.max(0, nextPersonalRank() - 1);
}

function updatePersonalRank(playerId, value) {
  state.personalRanks = updatePersonalRankMap(state.personalRanks, playerId, value);
  savePersonalRanks();
}

function seedRanks() {
  closeExportMenu();

  const currentCount = personalRankCount();
  const defaultCount = Math.min(state.players.length, currentCount > 0 ? currentCount + 20 : 20);
  const response = window.prompt(
    "Seed ranks through what number? Existing ranks stay in place; empty ranks are filled by default index order.",
    String(defaultCount),
  );

  if (response === null) {
    return;
  }

  const targetCount = Math.floor(Number(response));
  if (!Number.isFinite(targetCount) || targetCount < 1) {
    setExportStatus("Enter a positive whole number to seed ranks.");
    return;
  }

  const cappedTargetCount = Math.min(targetCount, state.players.length);
  const before = JSON.stringify(normalizePersonalRanks(state.personalRanks));
  state.personalRanks = seedPersonalRanks(state.personalRanks, state.players, cappedTargetCount);
  savePersonalRanks();
  applyFilters();

  if (JSON.stringify(state.personalRanks) === before) {
    setExportStatus(`Ranks are already seeded through ${cappedTargetCount}.`);
  } else {
    setExportStatus(`Seeded ranks through ${cappedTargetCount}.`);
  }
}

function movePersonalRankByScreenStep(input, direction) {
  const currentRank = personalRankById(input.dataset.playerId);
  if (currentRank === null) {
    return false;
  }

  const nativeStepValue = direction === "up" ? currentRank + 1 : currentRank - 1;
  const nextRank = screenStepRankValue(currentRank, nativeStepValue, personalRankCount());
  input.value = String(nextRank);
  updatePersonalRank(input.dataset.playerId, input.value);
  delete input.dataset.autofilledRank;
  input.dataset.stepStartValue = input.value;
  applyFilters({ preserveScroll: true });
  return true;
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
  return {
    search: normalizeSearchText(els.search.value.trim()),
    team: els.team.value,
    position: els.position.value,
    experience: els.experience.value,
    sort: state.playerSort,
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

function isMobileViewport() {
  return window.matchMedia("(max-width: 720px)").matches;
}

function filterPlayers() {
  const filters = currentFilters();

  const filtered = state.players.filter((player) => {
    const matchesSearch = player.searchableText.includes(filters.search);
    const matchesTeam = !filters.team || displayedTeam(player) === filters.team;
    const matchesPosition = matchesPositionFilter(player.position, filters.position);
    const matchesExperience = !filters.experience || experienceValue(player) === filters.experience;

    return (
      matchesSearch &&
      matchesTeam &&
      matchesPosition &&
      matchesExperience
    );
  });

  state.filtered =
    state.view === "fantasy"
      ? sortFantasyPlayers(filtered)
      : sortPlayers(filtered, filters.sort);
}

function appendTextCell(row, value, className = "") {
  const cell = document.createElement("td");
  cell.textContent = value ?? "";
  if (className) {
    cell.className = className;
  }
  if (className.includes("player-cell") && value) {
    cell.title = String(value);
    cell.setAttribute("aria-label", String(value));
  }
  row.append(cell);
}

function appendPlayerCell(row, player) {
  const cell = document.createElement("td");
  const button = document.createElement("button");
  const detailLabel = `Click for expanded details for ${player.playerName}`;

  cell.className = "col-player player-cell";
  button.className = "player-detail-button";
  button.type = "button";
  button.textContent = player.playerName;
  button.title = detailLabel;
  button.dataset.playerId = personalRankKey(player);
  button.setAttribute("aria-label", detailLabel);
  cell.append(button);
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

function draftLabel(player) {
  const year = String(player.draftYear || "").trim();
  const round = String(player.draftRound || "").trim();
  const number = String(player.draftNumber || "").trim();

  if (!year) {
    return "";
  }
  if (year.toLowerCase() === "undrafted") {
    return "Undrafted";
  }

  if (round && number && round.toLowerCase() !== "undrafted") {
    return `${year} R${round} P${number}`;
  }

  return year;
}

function infoValue(value) {
  const text = String(value ?? "").trim();
  return text && text !== "-" ? text : EMPTY_INFO_VALUE;
}

function playerRow(player) {
  const tr = document.createElement("tr");

  appendTextCell(tr, player.index, "col-index number-cell");
  appendPersonalRankCell(tr, player);
  appendPlayerCell(tr, player);
  appendTeamCell(tr, player);
  appendTextCell(tr, infoValue(player.position), "col-position");
  appendTextCell(tr, infoValue(player.age), "col-age number-cell");
  appendTextCell(tr, infoValue(player.height), "col-height");
  appendTextCell(tr, infoValue(player.college), "col-college");
  appendTextCell(tr, infoValue(player.country), "col-country");
  appendTextCell(tr, infoValue(draftLabel(player)), "col-draft");
  appendTextCell(tr, experienceLabel(player), "col-experience");

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
      appendPlayerCell(tr, player);
      return;
    }
    if (column.type === "team") {
      appendTextCell(tr, displayedTeam(player), column.className);
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
    if (column.sortable === false) {
      header.textContent = column.label;
      row.append(header);
      return;
    }

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
  if (els.visibleCount) {
    els.visibleCount.textContent = String(state.filtered.length);
  }
  if (els.totalCount) {
    els.totalCount.textContent = String(state.players.length);
  }
}

function visibleColumnCount() {
  return state.view === "fantasy" ? fantasyColumns.length : playerColumns.length;
}

function virtualSpacerRow(height) {
  const row = document.createElement("tr");
  const cell = document.createElement("td");

  row.className = "virtual-spacer-row";
  cell.colSpan = visibleColumnCount();
  cell.style.height = `${height}px`;
  row.append(cell);

  return row;
}

function renderVirtualRows({ scrollTop = els.tableWrap.scrollTop } = {}) {
  if (els.tableWrap.hidden) {
    return;
  }

  const windowedRows = virtualWindow(
    state.filtered.length,
    scrollTop,
    els.tableWrap.clientHeight,
    virtualRowHeight(),
    VIRTUAL_OVERSCAN_ROWS,
  );
  const rowBuilder = state.view === "fantasy" ? fantasyRow : playerRow;
  const rows = [];

  if (windowedRows.beforeHeight > 0) {
    rows.push(virtualSpacerRow(windowedRows.beforeHeight));
  }

  rows.push(...state.filtered.slice(windowedRows.start, windowedRows.end).map(rowBuilder));

  if (windowedRows.afterHeight > 0) {
    rows.push(virtualSpacerRow(windowedRows.afterHeight));
  }

  els.body.replaceChildren(...rows);
  els.tableWrap.scrollTop = scrollTop;
}

function renderTable({ preserveScroll = false } = {}) {
  const scrollTop = preserveScroll ? els.tableWrap.scrollTop : 0;
  const scrollLeft = preserveScroll ? els.tableWrap.scrollLeft : 0;
  const activePlayerId = preserveScroll
    ? document.activeElement?.closest(".personal-rank-input")?.dataset.playerId
    : null;

  els.tableWrap.dataset.view = state.view;
  syncSortSelectOptions();
  lastRenderedScrollTop = scrollTop;
  if (!preserveScroll) {
    els.body.replaceChildren();
  }

  if (state.view === "fantasy") {
    renderFantasyHeader();
  } else {
    renderPlayerHeader();
  }

  els.tableWrap.hidden = state.filtered.length === 0;
  els.tableScrollbar.hidden = state.filtered.length === 0;
  els.empty.hidden = state.filtered.length !== 0;
  renderVirtualRows({ scrollTop });
  syncTableScrollPosition(scrollLeft);
  if (activePlayerId) {
    const activeInput = els.body.querySelector(
      `.personal-rank-input[data-player-id="${CSS.escape(activePlayerId)}"]`,
    );
    activeInput?.focus({ preventScroll: true });
  }
  if (preserveScroll) {
    requestAnimationFrame(() => {
      els.tableWrap.scrollTop = scrollTop;
      syncTableScrollPosition(scrollLeft);
      lastRenderedScrollTop = scrollTop;
    });
  }
  requestAnimationFrame(updateTableScrollbar);
}

function updateTableScrollbar() {
  const table = els.tableWrap.querySelector("table");
  if (!table || els.tableWrap.hidden) {
    els.tableScrollbar.hidden = true;
    return;
  }

  const hasHorizontalOverflow = table.scrollWidth > els.tableWrap.clientWidth + 1;
  els.tableScrollbar.hidden = !hasHorizontalOverflow;
  if (!hasHorizontalOverflow) {
    syncTableScrollPosition(0);
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

function hasActiveTextSelection() {
  const selection = window.getSelection?.();
  return Boolean(selection && !selection.isCollapsed && selection.toString());
}

function isSelectableTableTextTarget(target) {
  return Boolean(target.closest("td, th"));
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

  if (hasActiveTextSelection()) {
    endTableDrag();
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
  if (isMobileViewport()) {
    return;
  }

  if (
    isInteractiveTableTarget(event.target) ||
    (event.pointerType === "mouse" && isSelectableTableTextTarget(event.target))
  ) {
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
  if (isMobileViewport()) {
    return;
  }

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

function applyFilters(options = {}) {
  filterPlayers();
  renderSummary();
  renderTable(options);
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

function playerById(playerId) {
  return state.players.find((player) => personalRankKey(player) === String(playerId));
}

function detailValue(value) {
  return infoValue(value);
}

function detailItem(label, value) {
  const wrapper = document.createElement("div");
  const term = document.createElement("dt");
  const description = document.createElement("dd");

  term.textContent = label;
  description.textContent = value;
  wrapper.append(term, description);
  return wrapper;
}

function playerInfoDetails(player) {
  return [
    ["Index", String(player.index)],
    ["Rank", detailValue(personalRank(player))],
    ["Team", detailValue(displayedTeam(player))],
    ["Position", detailValue(player.position)],
    ["Age", detailValue(player.age)],
    ["Height", detailValue(player.height)],
    ["Background", detailValue(player.college)],
    ["Country", detailValue(player.country)],
    ["Draft", detailValue(draftLabel(player))],
    ["Experience", experienceLabel(player)],
  ];
}

function playerFantasyDetails(player) {
  const playerHasFantasyData = hasFantasyData(player);
  return fantasyColumns
    .filter((column) => !["index", "playerName"].includes(column.key))
    .map((column) => {
      if (column.type === "personalRank") {
        return ["Rank", detailValue(personalRank(player))];
      }
      if (column.type === "team") {
        return ["Team", detailValue(displayedTeam(player))];
      }

      return [
        column.label,
        detailValue(
          formatFantasyValue(
            fantasyValue(player, column.key),
            column.type,
            playerHasFantasyData && fantasyStatKeys.has(column.key),
          ),
        ),
      ];
    });
}

function openPlayerDetail(playerId) {
  const player = playerById(playerId);
  if (!player) {
    return;
  }

  els.playerDetailTitle.textContent = player.playerName;
  els.playerDetailSubtitle.textContent =
    state.view === "fantasy" ? "Player Stats (2025-26)" : "Player Info";
  els.playerDetailList.replaceChildren(
    ...(state.view === "fantasy" ? playerFantasyDetails(player) : playerInfoDetails(player))
      .map(([label, value]) => detailItem(label, value)),
  );

  if (typeof els.playerDetailDialog.showModal === "function") {
    els.playerDetailDialog.showModal();
    els.playerDetailClose.focus();
  }
}

function restorePlayerDetailFocus() {
  lastPlayerDetailTrigger?.focus({ preventScroll: true });
  lastPlayerDetailTrigger = null;
}

function deleteSavedAppData() {
  localStorage.removeItem(PERSONAL_RANK_KEY);
  localStorage.removeItem(TEAM_OVERRIDE_KEY);
  localStorage.removeItem(THEME_KEY);
  state.personalRanks = {};
  state.teamOverrides = {};
  applyTheme(loadTheme());
  els.team.value = DEFAULT_FILTERS.team;
  setupFilters();
  resetSorts();
  closeResetDialog();
  setFilterPanelOpen(false);
  closeMobileMenu();
  setExportStatus("");
}

function setFilterPanelOpen(isOpen) {
  document.body.classList.toggle("filters-panel-collapsed", !isOpen);
  els.desktopFilterToggle.setAttribute("aria-expanded", String(isOpen));
  els.desktopFilterToggle.textContent = isOpen ? "Hide Controls" : "Show Controls";
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

function indexOverrideExportRows() {
  return buildIndexOverrideExportRows(state.players, { personalRank });
}

function indexOverrideExportCsv() {
  return rowsToCsv(INDEX_OVERRIDE_EXPORT_FIELDS, indexOverrideExportRows());
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
  if (statusDismissTimer) {
    clearTimeout(statusDismissTimer);
    statusDismissTimer = null;
  }
  els.exportStatus.textContent = message;
}

function scheduleStatusDismiss() {
  if (!els.exportStatus.textContent || statusDismissTimer) {
    return;
  }

  statusDismissTimer = window.setTimeout(() => {
    els.exportStatus.textContent = "";
    statusDismissTimer = null;
  }, STATUS_DISMISS_DELAY_MS);
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

function downloadIndexOverrideCsv() {
  downloadTextFile(
    indexOverrideExportCsv(),
    INDEX_OVERRIDE_EXPORT_FILE_NAME,
    "text/csv;charset=utf-8",
  );
  setExportStatus("Index CSV Exported.");
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
  [els.search, els.team, els.position, els.experience].forEach((control) =>
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
  els.seed.addEventListener("click", seedRanks);
  els.export.addEventListener("click", toggleExportMenu);
  els.exportFile.addEventListener("click", downloadRankedCsv);
  els.exportCopy.addEventListener("click", copyRankedCsvToClipboard);
  els.exportIndexOverride.addEventListener("click", downloadIndexOverrideCsv);
  els.exportFullCsv.addEventListener("click", downloadFullCsv);
  els.exportFullXlsx.addEventListener("click", downloadFullXlsx);
  els.exportFullJson.addEventListener("click", downloadFullJson);
  els.top.addEventListener("click", scrollResultsToTop);
  els.tableWrap.addEventListener("scroll", () => {
    scheduleStatusDismiss();
    syncHorizontalScroll(els.tableWrap, els.tableScrollbar);
    if (Math.abs(els.tableWrap.scrollTop - lastRenderedScrollTop) >= virtualRowHeight() / 2) {
      lastRenderedScrollTop = els.tableWrap.scrollTop;
      renderVirtualRows();
    }
  });
  els.tableScrollbar.addEventListener("scroll", () => {
    scheduleStatusDismiss();
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
  window.addEventListener("resize", () => {
    renderVirtualRows();
    updateTableScrollbar();
  });
  els.themeToggles.forEach((toggle) => {
    toggle.addEventListener("change", () => {
      const theme = toggle.checked ? "dark" : "light";
      applyTheme(theme);
      saveTheme(theme);
    });
  });
  els.mobileMenuToggle.addEventListener("click", () => {
    setMobileMenuOpen(!document.body.classList.contains("mobile-menu-open"));
  });
  els.desktopFilterToggle.addEventListener("click", () => {
    setFilterPanelOpen(document.body.classList.contains("filters-panel-collapsed"));
  });
  els.playerDetailDialog.addEventListener("click", (event) => {
    if (event.target === els.playerDetailDialog) {
      els.playerDetailDialog.close();
    }
  });
  els.playerDetailDialog.addEventListener("close", restorePlayerDetailFocus);
  document.addEventListener("click", (event) => {
    scheduleStatusDismiss();
    if (!event.target.closest(".export-menu")) {
      closeExportMenu();
    }
    if (ignoreNextPlayerDetailClick && !event.target.closest(".player-detail-button")) {
      ignoreNextPlayerDetailClick = false;
    }
  });
  document.addEventListener("input", scheduleStatusDismiss);
  document.addEventListener("keydown", scheduleStatusDismiss);
  document.addEventListener("wheel", scheduleStatusDismiss, { passive: true });
  document.addEventListener("touchstart", scheduleStatusDismiss, { passive: true });
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

  els.body.addEventListener("click", (event) => {
    const button = event.target.closest(".player-detail-button");
    if (!button) {
      return;
    }

    if (ignoreNextPlayerDetailClick) {
      ignoreNextPlayerDetailClick = false;
      return;
    }

    lastPlayerDetailTrigger = button;
    openPlayerDetail(button.dataset.playerId);
  });

  els.body.addEventListener("pointerdown", (event) => {
    const input = event.target.closest(".personal-rank-input");
    if (!input) {
      return;
    }

    input.dataset.stepStartValue = input.value.trim();
  });

  els.body.addEventListener("input", (event) => {
    const input = event.target.closest(".personal-rank-input");
    if (!input || event.inputType) {
      return;
    }

    const stepStartValue = Number(input.dataset.stepStartValue);
    const nativeStepValue = Number(input.value);
    if (
      !Number.isFinite(stepStartValue) ||
      !Number.isFinite(nativeStepValue) ||
      Math.abs(nativeStepValue - stepStartValue) !== 1
    ) {
      input.dataset.stepStartValue = input.value.trim();
      return;
    }

    input.value = String(
      screenStepRankValue(stepStartValue, nativeStepValue, personalRankCount()),
    );
    updatePersonalRank(input.dataset.playerId, input.value);
    delete input.dataset.autofilledRank;
    input.dataset.screenStepHandled = "true";
    input.dataset.stepStartValue = input.value;
    applyFilters({ preserveScroll: true });
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

    if (input.dataset.screenStepHandled === "true") {
      delete input.dataset.screenStepHandled;
      return;
    }

    updatePersonalRank(input.dataset.playerId, input.value);
    delete input.dataset.autofilledRank;
    applyFilters({ preserveScroll: true });
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

    input.dataset.stepStartValue = input.value.trim();
    requestAnimationFrame(() => input.select());
  });

  els.body.addEventListener("focusout", (event) => {
    const input = event.target.closest(".personal-rank-input");
    if (!input || input.dataset.autofilledRank !== "true") {
      return;
    }

    ignoreNextPlayerDetailClick = true;
    delete input.dataset.autofilledRank;
  });

  els.body.addEventListener("keydown", (event) => {
    const input = event.target.closest(".personal-rank-input");
    if (!input) {
      return;
    }

    if (event.key === "ArrowUp" || event.key === "ArrowDown") {
      event.preventDefault();
      movePersonalRankByScreenStep(input, event.key === "ArrowUp" ? "up" : "down");
      return;
    }

    if (event.key === "Enter") {
      input.blur();
    }
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
      syncTableScrollPosition(0);
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
