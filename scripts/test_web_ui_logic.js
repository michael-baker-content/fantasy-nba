const {
  formatFantasyValue,
  matchesPositionFilter,
  normalizeSearchText,
  searchablePlayerText,
  experienceValue,
} = require("../web/app-logic.js");

const PLAYER_SEARCH_ALIASES = {
  "Nikola Jokic": ["Jokic", "Joker"],
  "Shai Gilgeous-Alexander": ["SGA", "Shai"],
  "Victor Wembanyama": ["Wemby", "Wembanyama"],
};

function assertEqual(name, actual, expected) {
  if (actual !== expected) {
    throw new Error(`${name}: expected ${expected}, received ${actual}`);
  }
}

assertEqual("F includes F-C", matchesPositionFilter("F-C", "F"), true);
assertEqual("F includes G-F", matchesPositionFilter("G-F", "F"), true);
assertEqual("F-C does not include F", matchesPositionFilter("F", "F-C"), false);
assertEqual("combo positions stay exact", matchesPositionFilter("F-C", "F-C"), true);
assertEqual("Rookie maps to rookie", experienceValue("Rookie"), "rookie");
assertEqual("Veteran maps to veteran", experienceValue("Veteran"), "veteran");
assertEqual("missing count with data", formatFantasyValue(null, "number", true), "0");
assertEqual("missing percent with data", formatFantasyValue(null, "percent", true), "—");
assertEqual("missing stat without data", formatFantasyValue(null, "number", false), "");
assertEqual(
  "nickname alias matches",
  searchablePlayerText("Victor Wembanyama", PLAYER_SEARCH_ALIASES).includes("wemby"),
  true,
);
assertEqual(
  "initial alias matches",
  searchablePlayerText("Shai Gilgeous-Alexander", PLAYER_SEARCH_ALIASES).includes("sga"),
  true,
);
assertEqual("accent-insensitive search", normalizeSearchText("Jokić"), "jokic");

console.log("web ui logic ok");
