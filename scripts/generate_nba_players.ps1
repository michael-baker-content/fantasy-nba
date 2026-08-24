param(
  [Parameter(ValueFromRemainingArguments = $true)]
  [string[]] $GeneratorArgs
)

$ErrorActionPreference = "Stop"
$ProjectRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
$Python = Join-Path $ProjectRoot ".venv\Scripts\python.exe"

if (-not (Test-Path $Python)) {
  Write-Error "Missing .venv. Run: python -m venv .venv; .\.venv\Scripts\python -m pip install -r requirements.txt"
}

& $Python (Join-Path $PSScriptRoot "generate_nba_players.py") @GeneratorArgs
