const { execFileSync } = require("node:child_process");

const checks = [
  ["node", ["--check", "web/app-logic.js"]],
  ["node", ["--check", "web/app.js"]],
  ["python", ["-m", "py_compile", "scripts/fetch_player_bios.py"]],
  ["python", ["-m", "py_compile", "scripts/generate_nba_players.py"]],
  ["python", ["scripts/test_fetch_player_bios_logic.py"]],
  ["node", ["scripts/test_personal_rank_logic.js"]],
  ["node", ["scripts/test_web_ui_logic.js"]],
  ["node", ["scripts/test_export_and_sort_logic.js"]],
];

for (const [command, args] of checks) {
  execFileSync(command, args, { stdio: "inherit" });
}

console.log("all tests ok");
