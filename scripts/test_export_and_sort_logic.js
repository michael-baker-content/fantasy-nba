const {
  fullExportRows,
  indexOverrideExportRows,
  rankedExportRows,
  rowsToCsv,
  sortFantasyPlayers,
  sortPlayers,
} = require("../web/app-logic.js");

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

const players = [
  {
    index: 1,
    playerName: "Alpha Guard",
    team: "AAA",
    position: "G",
    playerId: "101",
    experience: "Veteran",
    age: "28",
    birthdate: "1998-01-01",
    height: "6-4",
    college: "Alpha State",
    country: "USA",
    draftYear: "2020",
    draftRound: "1",
    draftNumber: "10",
    fantasy: { fgPct: 0.5, fgm: 10, fga: 20, ftPct: 0.8, ftm: 8, fta: 10, fg3m: 4, pts: 30, reb: 2, ast: 7, stl: 1, blk: 0, tov: 5 },
  },
  {
    index: 2,
    playerName: "Beta Forward",
    team: "BBB",
    position: "F",
    playerId: "102",
    experience: "Rookie",
    age: "20",
    birthdate: "2006-02-02",
    height: "6-8",
    college: "Beta Tech",
    country: "Canada",
    draftYear: "2026",
    draftRound: "2",
    draftNumber: "34",
    fantasy: { fgPct: 0.4, fgm: 6, fga: 15, ftPct: null, ftm: null, fta: null, fg3m: 1, pts: 12, reb: 10, ast: 1, stl: 2, blk: 1, tov: 1 },
  },
  {
    index: 3,
    playerName: "Comma, Center",
    team: "CCC",
    position: "C",
    playerId: "103",
    experience: "Veteran",
    age: "",
    birthdate: "",
    height: "",
    college: "",
    country: "",
    draftYear: "",
    draftRound: "",
    draftNumber: "",
    fantasy: { fgPct: null, fgm: null, fga: null, ftPct: null, ftm: null, fta: null, fg3m: null, pts: null, reb: null, ast: null, stl: null, blk: null, tov: null },
  },
];

const ranks = { 102: 1, 101: 2 };
const teamOverrides = { 101: "ZZZ" };
const helpers = {
  personalRank: (player) => ranks[player.playerId] ?? null,
  displayedTeam: (player) => teamOverrides[player.playerId] || player.team,
};

function assertEqual(name, actual, expected) {
  const actualJson = JSON.stringify(actual);
  const expectedJson = JSON.stringify(expected);
  if (actualJson !== expectedJson) {
    throw new Error(`${name}: expected ${expectedJson}, received ${actualJson}`);
  }
}

assertEqual(
  "rank sort puts ranked players first",
  sortPlayers(players, "personal-rank-asc", helpers).map((player) => player.playerId),
  ["102", "101", "103"],
);

assertEqual(
  "team sort uses edited team value",
  sortPlayers(players, "team-desc", helpers).map((player) => player.playerId),
  ["101", "103", "102"],
);

assertEqual(
  "turnover default asc puts lower turnovers first and blanks last",
  sortFantasyPlayers(players, { key: "tov", direction: "asc" }, helpers.personalRank).map(
    (player) => player.playerId,
  ),
  ["102", "101", "103"],
);

assertEqual(
  "fantasy stat desc puts blanks last",
  sortFantasyPlayers(players, { key: "pts", direction: "desc" }, helpers.personalRank).map(
    (player) => player.playerId,
  ),
  ["101", "102", "103"],
);

assertEqual("ranked export includes only ranked players", rankedExportRows(players, helpers), [
  { rank: 1, name: "Beta Forward", team: "BBB", position: "F" },
  { rank: 2, name: "Alpha Guard", team: "ZZZ", position: "G" },
]);

assertEqual("index override export includes stable ids", indexOverrideExportRows(players, helpers), [
  { index: 1, player_name: "Beta Forward", player_id: "102" },
  { index: 2, player_name: "Alpha Guard", player_id: "101" },
]);

assertEqual(
  "ranked csv escapes commas",
  rowsToCsv(EXPORT_FIELDS, [
    { rank: 1, name: "Comma, Center", team: "CCC", position: "C" },
  ]),
  'rank,name,team,position\r\n1,"Comma, Center",CCC,C',
);

const fullRows = fullExportRows(players.slice(0, 2), helpers);
assertEqual("full export preserves edited team", fullRows[0].team, "ZZZ");
assertEqual("full export preserves original team", fullRows[0].original_team, "AAA");
assertEqual("full export labels experience", fullRows[1].experience, "Rookie");
assertEqual("full export includes bio fields", fullRows[0].college, "Alpha State");
assertEqual("full csv includes all full export headers", rowsToCsv(FULL_EXPORT_FIELDS, fullRows).startsWith(FULL_EXPORT_FIELDS.join(",")), true);

console.log("export and sort logic ok");
