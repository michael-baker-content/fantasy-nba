const CSV_PATH = "../data/nba_2026_27_likely_players.csv";
const PERSONAL_RANK_KEY = "nba-player-explorer.personal-ranks.v1";
const TEAM_OVERRIDE_KEY = "nba-player-explorer.team-overrides.v1";
const THEME_KEY = "nba-player-explorer.theme.v1";
const EXPORT_FILE_NAME = "my_nba_rankings.csv";
const EXPORT_FIELDS = ["rank", "name", "team", "position"];
const EMPTY_COUNTING_STAT = "0";
const EMPTY_PERCENTAGE_STAT = "—";
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
  league: "",
  sort: "index-asc",
  minLikelihood: "0",
};

const state = {
  players: [],
  filtered: [],
  personalRanks: {},
  teamOverrides: {},
  view: "players",
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
  league: document.querySelector("#league-filter"),
  sort: document.querySelector("#sort-select"),
  minLikelihood: document.querySelector("#min-likelihood"),
  rangeOutput: document.querySelector("#range-output"),
  reset: document.querySelector("#reset-button"),
  export: document.querySelector("#export-button"),
  exportMenu: document.querySelector("#export-menu"),
  exportFile: document.querySelector("#export-file-button"),
  exportCopy: document.querySelector("#export-copy-button"),
  exportStatus: document.querySelector("#export-status"),
  top: document.querySelector("#top-button"),
  themeToggle: document.querySelector("#theme-toggle"),
  mobileMenuToggle: document.querySelector("#mobile-menu-toggle"),
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

let syncingTableScroll = false;

const playerColumns = [
  { label: "Index", className: "col-index" },
  { label: "Rank", className: "col-rank" },
  { label: "Player", className: "col-player" },
  { label: "Team", className: "col-team" },
  { label: "Position", className: "col-position" },
  { label: "NBA ID", className: "col-id" },
  { label: "Previous league", className: "col-prev-league" },
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

function normalizeSearchText(value) {
  return String(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function playerSearchAliases(playerName) {
  return PLAYER_SEARCH_ALIASES[playerName] || [];
}

function searchablePlayerText(playerName) {
  return normalizeSearchText([playerName, ...playerSearchAliases(playerName)].join(" "));
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
    prevLeague: row.prev_league,
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

function normalizedRankEntries(rankMap) {
  return Object.entries(rankMap)
    .map(([playerId, rank]) => [String(playerId), Number(rank)])
    .filter(([, rank]) => Number.isFinite(rank) && rank > 0)
    .sort(([idA, rankA], [idB, rankB]) => rankA - rankB || idA.localeCompare(idB));
}

function normalizePersonalRanks(rankMap) {
  return Object.fromEntries(
    normalizedRankEntries(rankMap).map(([playerId], index) => [playerId, index + 1]),
  );
}

function rankedPlayerIdsWithout(playerId) {
  return normalizedRankEntries(state.personalRanks)
    .map(([rankedPlayerId]) => rankedPlayerId)
    .filter((rankedPlayerId) => rankedPlayerId !== String(playerId));
}

function updatePersonalRank(playerId, value) {
  const cleaned = value.trim();
  const remainingIds = rankedPlayerIdsWithout(playerId);

  if (!cleaned) {
    state.personalRanks = Object.fromEntries(
      remainingIds.map((rankedPlayerId, index) => [rankedPlayerId, index + 1]),
    );
    savePersonalRanks();
    return;
  }

  const requestedRank = Math.floor(Number(cleaned));
  if (!Number.isFinite(requestedRank) || requestedRank <= 0) {
    return;
  }

  const insertIndex = Math.min(requestedRank, remainingIds.length + 1) - 1;
  remainingIds.splice(insertIndex, 0, String(playerId));
  state.personalRanks = Object.fromEntries(
    remainingIds.map((rankedPlayerId, index) => [rankedPlayerId, index + 1]),
  );
  savePersonalRanks();
}

function uniqueSorted(values) {
  return [...new Set(values.filter(Boolean))].sort((a, b) => a.localeCompare(b));
}

function fillSelect(select, values, label) {
  select.replaceChildren(new Option(label, ""));
  uniqueSorted(values).forEach((value) => select.add(new Option(value, value)));
}

function setupFilters() {
  const selectedTeam = els.team.value;
  fillSelect(els.team, state.players.map(displayedTeam), "All teams");
  if ([...els.team.options].some((option) => option.value === selectedTeam)) {
    els.team.value = selectedTeam;
  }
  fillSelect(els.position, state.players.map((player) => player.position), "All positions");
  fillSelect(els.league, state.players.map((player) => player.prevLeague), "All leagues");
}

function currentFilters() {
  const min = Number(els.minLikelihood.value);

  return {
    search: normalizeSearchText(els.search.value.trim()),
    team: els.team.value,
    position: els.position.value,
    league: els.league.value,
    sort: els.sort.value,
    min,
    max: 1,
  };
}

function matchesPositionFilter(playerPosition, selectedPosition) {
  if (!selectedPosition) {
    return true;
  }

  if (selectedPosition.includes("-")) {
    return playerPosition === selectedPosition;
  }

  return playerPosition.split("-").includes(selectedPosition);
}

function sortPlayers(players, sortKey) {
  const sorted = [...players];
  const byText = (field) => (a, b) => a[field].localeCompare(b[field]);

  const sorters = {
    "index-asc": (a, b) => a.index - b.index,
    "personal-rank-asc": comparePersonalRank,
    "likelihood-desc": (a, b) =>
      b.activeLikelihood - a.activeLikelihood || a.playerName.localeCompare(b.playerName),
    "likelihood-asc": (a, b) =>
      a.activeLikelihood - b.activeLikelihood || a.playerName.localeCompare(b.playerName),
    "name-asc": byText("playerName"),
    "team-asc": (a, b) =>
      displayedTeam(a).localeCompare(displayedTeam(b)) ||
      a.playerName.localeCompare(b.playerName),
    "position-asc": (a, b) =>
      a.position.localeCompare(b.position) || a.playerName.localeCompare(b.playerName),
  };

  return sorted.sort(sorters[sortKey] || sorters["index-asc"]);
}

function comparePersonalRank(a, b) {
  const rankA = personalRank(a);
  const rankB = personalRank(b);

  if (rankA === null && rankB === null) {
    return a.index - b.index;
  }
  if (rankA === null) {
    return 1;
  }
  if (rankB === null) {
    return -1;
  }

  return rankA - rankB || a.index - b.index;
}

function fantasyValue(player, key) {
  if (key === "index") {
    return player.index;
  }
  if (key === "personalRank") {
    return personalRank(player);
  }
  if (key === "playerName") {
    return player.playerName;
  }

  return player.fantasy[key];
}

function hasFantasyData(player) {
  return Object.values(player.fantasy).some((value) => Number.isFinite(value));
}

function sortFantasyPlayers(players) {
  const sorted = [...players];
  const { key, direction } = state.fantasySort;
  const multiplier = direction === "asc" ? 1 : -1;

  return sorted.sort((a, b) => {
    const valueA = fantasyValue(a, key);
    const valueB = fantasyValue(b, key);

    if (typeof valueA === "string" || typeof valueB === "string") {
      return String(valueA || "").localeCompare(String(valueB || "")) * multiplier;
    }
    if (valueA === null && valueB === null) {
      return a.index - b.index;
    }
    if (valueA === null) {
      return 1;
    }
    if (valueB === null) {
      return -1;
    }

    return (valueA - valueB) * multiplier || a.index - b.index;
  });
}

function filterPlayers() {
  const filters = currentFilters();

  const filtered = state.players.filter((player) => {
    const matchesSearch = player.searchableText.includes(filters.search);
    const matchesTeam = !filters.team || displayedTeam(player) === filters.team;
    const matchesPosition = matchesPositionFilter(player.position, filters.position);
    const matchesLeague = !filters.league || player.prevLeague === filters.league;
    const matchesLikelihood =
      player.activeLikelihood >= filters.min && player.activeLikelihood <= filters.max;

    return (
      matchesSearch &&
      matchesTeam &&
      matchesPosition &&
      matchesLeague &&
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
  appendTextCell(tr, player.prevLeague, "col-prev-league");
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

function formatFantasyValue(value, type, fillEmptyFantasyStat = false) {
  if (value === null || value === undefined || value === "") {
    if (!fillEmptyFantasyStat) {
      return "";
    }

    return type === "percent" ? EMPTY_PERCENTAGE_STAT : EMPTY_COUNTING_STAT;
  }
  if (type === "percent") {
    return Number(value).toFixed(3);
  }

  return String(Math.round(Number(value)));
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

function renderRangeLabel() {
  const { min } = currentFilters();
  els.rangeOutput.textContent = `${min.toFixed(2)} and up`;
}

function applyFilters() {
  renderRangeLabel();
  filterPlayers();
  renderSummary();
  renderTable();
}

function resetFilters() {
  els.search.value = "";
  els.team.value = DEFAULT_FILTERS.team;
  els.position.value = DEFAULT_FILTERS.position;
  els.league.value = DEFAULT_FILTERS.league;
  els.sort.value = DEFAULT_FILTERS.sort;
  els.minLikelihood.value = DEFAULT_FILTERS.minLikelihood;
  applyFilters();
}

function closeMobileMenu() {
  document.body.classList.remove("mobile-menu-open");
  els.mobileMenuToggle.setAttribute("aria-expanded", "false");
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

function csvValue(value) {
  const text = String(value ?? "");
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function rankedExportRows() {
  return state.players
    .map((player) => ({
      rank: personalRank(player),
      name: player.playerName,
      team: displayedTeam(player),
      position: player.position,
    }))
    .filter((row) => row.rank !== null)
    .sort((a, b) => a.rank - b.rank || a.name.localeCompare(b.name));
}

function rankedExportCsv() {
  const rows = rankedExportRows();
  return [
    EXPORT_FIELDS.join(","),
    ...rows.map((row) => EXPORT_FIELDS.map((field) => csvValue(row[field])).join(",")),
  ].join("\r\n");
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

function downloadRankedCsv() {
  const csv = rankedExportCsv();
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = EXPORT_FILE_NAME;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  setExportStatus("CSV file exported.");
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
    setExportStatus("CSV copied to clipboard.");
  } catch {
    setExportStatus("CSV could not be copied.");
  } finally {
    closeExportMenu();
  }
}

function bindEvents() {
  [
    els.search,
    els.team,
    els.position,
    els.league,
    els.sort,
    els.minLikelihood,
  ].forEach((control) => control.addEventListener("input", applyFilters));

  els.reset.addEventListener("click", resetFilters);
  els.export.addEventListener("click", toggleExportMenu);
  els.exportFile.addEventListener("click", downloadRankedCsv);
  els.exportCopy.addEventListener("click", copyRankedCsvToClipboard);
  els.top.addEventListener("click", scrollResultsToTop);
  els.tableWrap.addEventListener("scroll", () => {
    syncHorizontalScroll(els.tableWrap, els.tableScrollbar);
  });
  els.tableScrollbar.addEventListener("scroll", () => {
    syncHorizontalScroll(els.tableScrollbar, els.tableWrap);
  });
  window.addEventListener("resize", updateTableScrollbar);
  els.themeToggle.addEventListener("change", () => {
    const theme = els.themeToggle.checked ? "dark" : "light";
    applyTheme(theme);
    saveTheme(theme);
  });
  els.mobileMenuToggle.addEventListener("click", () => {
    const isOpen = document.body.classList.toggle("mobile-menu-open");
    els.mobileMenuToggle.setAttribute("aria-expanded", String(isOpen));
  });
  document.addEventListener("click", (event) => {
    if (!event.target.closest(".export-menu")) {
      closeExportMenu();
    }
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !els.exportMenu.hidden) {
      closeExportMenu();
      els.export.focus();
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
    applyFilters();
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
      state.fantasySort.direction = state.fantasySort.direction === "asc" ? "desc" : "asc";
    } else {
      state.fantasySort.key = column.key;
      state.fantasySort.direction = column.direction;
    }

    applyFilters();
  });

  els.viewTabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      state.view = tab.dataset.view;
      els.viewTabs.forEach((item) => {
        const isActive = item === tab;
        item.classList.toggle("is-active", isActive);
        item.setAttribute("aria-current", isActive ? "page" : "false");
      });
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
    els.loading.textContent = "Could not load player data.";
    console.error(error);
  }
}

init();
