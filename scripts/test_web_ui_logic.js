const EMPTY_COUNTING_STAT = "0";
const EMPTY_PERCENTAGE_STAT = "—";
const PLAYER_SEARCH_ALIASES = {
  "Nikola Jokic": ["Jokic", "Joker"],
  "Shai Gilgeous-Alexander": ["SGA", "Shai"],
  "Victor Wembanyama": ["Wemby", "Wembanyama"],
};

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

function matchesPositionFilter(playerPosition, selectedPosition) {
  if (!selectedPosition) {
    return true;
  }

  if (selectedPosition.includes("-")) {
    return playerPosition === selectedPosition;
  }

  return playerPosition.split("-").includes(selectedPosition);
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

function assertEqual(name, actual, expected) {
  if (actual !== expected) {
    throw new Error(`${name}: expected ${expected}, received ${actual}`);
  }
}

assertEqual("F includes F-C", matchesPositionFilter("F-C", "F"), true);
assertEqual("F includes G-F", matchesPositionFilter("G-F", "F"), true);
assertEqual("F-C does not include F", matchesPositionFilter("F", "F-C"), false);
assertEqual("combo positions stay exact", matchesPositionFilter("F-C", "F-C"), true);
assertEqual("missing count with data", formatFantasyValue(null, "number", true), "0");
assertEqual("missing percent with data", formatFantasyValue(null, "percent", true), "—");
assertEqual("missing stat without data", formatFantasyValue(null, "number", false), "");
assertEqual("nickname alias matches", searchablePlayerText("Victor Wembanyama").includes("wemby"), true);
assertEqual("initial alias matches", searchablePlayerText("Shai Gilgeous-Alexander").includes("sga"), true);
assertEqual("accent-insensitive search", normalizeSearchText("Jokić"), "jokic");

console.log("web ui logic ok");
