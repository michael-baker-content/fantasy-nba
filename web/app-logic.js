(function publishAppLogic(root) {
  const EMPTY_COUNTING_STAT = "0";
  const EMPTY_PERCENTAGE_STAT = "—";

  function normalizeSearchText(value) {
    return String(value)
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase();
  }

  function searchablePlayerText(playerName, aliases = {}) {
    return normalizeSearchText([playerName, ...(aliases[playerName] || [])].join(" "));
  }

  function matchesPositionFilter(playerPosition, selectedPosition) {
    if (!selectedPosition) {
      return true;
    }

    if (selectedPosition.includes("-")) {
      return playerPosition === selectedPosition;
    }

    return String(playerPosition || "").split("-").includes(selectedPosition);
  }

  function experienceValue(experience) {
    return String(experience || "").toLowerCase() === "rookie" ? "rookie" : "veteran";
  }

  function experienceLabel(experience) {
    return experienceValue(experience) === "rookie" ? "Rookie" : "Veteran";
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

  function nextPersonalRank(rankMap) {
    return normalizedRankEntries(rankMap).length + 1;
  }

  function updatePersonalRank(rankMap, playerId, value) {
    const cleaned = String(value).trim();
    const remainingIds = normalizedRankEntries(rankMap)
      .map(([rankedPlayerId]) => rankedPlayerId)
      .filter((rankedPlayerId) => rankedPlayerId !== String(playerId));

    if (!cleaned) {
      return Object.fromEntries(
        remainingIds.map((rankedPlayerId, index) => [rankedPlayerId, index + 1]),
      );
    }

    const requestedRank = Math.floor(Number(cleaned));
    if (!Number.isFinite(requestedRank) || requestedRank <= 0) {
      return normalizePersonalRanks(rankMap);
    }

    const insertIndex = Math.min(requestedRank, remainingIds.length + 1) - 1;
    remainingIds.splice(insertIndex, 0, String(playerId));
    return Object.fromEntries(
      remainingIds.map((rankedPlayerId, index) => [rankedPlayerId, index + 1]),
    );
  }

  function comparePersonalRank(a, b, personalRank) {
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

  function sortPlayers(players, sortKey, helpers) {
    const sorted = [...players];
    const byText = (field) => (a, b) => a[field].localeCompare(b[field]);
    const displayedTeam = helpers.displayedTeam;

    const sorters = {
      "index-asc": (a, b) => a.index - b.index,
      "personal-rank-asc": (a, b) => comparePersonalRank(a, b, helpers.personalRank),
      "likelihood-desc": (a, b) =>
        b.activeLikelihood - a.activeLikelihood || a.playerName.localeCompare(b.playerName),
      "likelihood-asc": (a, b) =>
        a.activeLikelihood - b.activeLikelihood || a.playerName.localeCompare(b.playerName),
      "name-asc": byText("playerName"),
      "name-desc": (a, b) => byText("playerName")(b, a),
      "team-asc": (a, b) =>
        displayedTeam(a).localeCompare(displayedTeam(b)) ||
        a.playerName.localeCompare(b.playerName),
      "team-desc": (a, b) =>
        displayedTeam(b).localeCompare(displayedTeam(a)) ||
        a.playerName.localeCompare(b.playerName),
      "position-asc": (a, b) =>
        a.position.localeCompare(b.position) || a.playerName.localeCompare(b.playerName),
      "position-desc": (a, b) =>
        b.position.localeCompare(a.position) || a.playerName.localeCompare(b.playerName),
    };

    return sorted.sort(sorters[sortKey] || sorters["index-asc"]);
  }

  function fantasyValue(player, key, personalRank) {
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

  function sortFantasyPlayers(players, fantasySort, personalRank) {
    const sorted = [...players];
    const { key, direction } = fantasySort;
    const multiplier = direction === "asc" ? 1 : -1;

    return sorted.sort((a, b) => {
      const valueA = fantasyValue(a, key, personalRank);
      const valueB = fantasyValue(b, key, personalRank);

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

  function hasFantasyData(player) {
    return Object.values(player.fantasy).some((value) => Number.isFinite(value));
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

  function csvValue(value) {
    const text = String(value ?? "");
    return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
  }

  function rowsToCsv(fields, rows) {
    return [
      fields.join(","),
      ...rows.map((row) => fields.map((field) => csvValue(row[field])).join(",")),
    ].join("\r\n");
  }

  function rankedExportRows(players, helpers) {
    return players
      .map((player) => ({
        rank: helpers.personalRank(player),
        name: player.playerName,
        team: helpers.displayedTeam(player),
        position: player.position,
      }))
      .filter((row) => row.rank !== null)
      .sort((a, b) => a.rank - b.rank || a.name.localeCompare(b.name));
  }

  function fullExportRows(players, helpers) {
    return players.map((player) => ({
      rank: helpers.personalRank(player) ?? "",
      index: player.index,
      name: player.playerName,
      team: helpers.displayedTeam(player),
      original_team: player.team,
      position: player.position,
      nba_player_id: player.playerId,
      experience: experienceLabel(player.experience),
      active_likelihood: player.activeLikelihood,
      fantasy_fg_pct: player.fantasy.fgPct ?? "",
      fantasy_fgm: player.fantasy.fgm ?? "",
      fantasy_fga: player.fantasy.fga ?? "",
      fantasy_ft_pct: player.fantasy.ftPct ?? "",
      fantasy_ftm: player.fantasy.ftm ?? "",
      fantasy_fta: player.fantasy.fta ?? "",
      fantasy_3pm: player.fantasy.fg3m ?? "",
      fantasy_points: player.fantasy.pts ?? "",
      fantasy_rebounds: player.fantasy.reb ?? "",
      fantasy_assists: player.fantasy.ast ?? "",
      fantasy_steals: player.fantasy.stl ?? "",
      fantasy_blocks: player.fantasy.blk ?? "",
      fantasy_turnovers: player.fantasy.tov ?? "",
    }));
  }

  const api = {
    EMPTY_COUNTING_STAT,
    EMPTY_PERCENTAGE_STAT,
    normalizeSearchText,
    searchablePlayerText,
    matchesPositionFilter,
    experienceValue,
    experienceLabel,
    normalizedRankEntries,
    normalizePersonalRanks,
    nextPersonalRank,
    updatePersonalRank,
    comparePersonalRank,
    sortPlayers,
    fantasyValue,
    sortFantasyPlayers,
    hasFantasyData,
    formatFantasyValue,
    csvValue,
    rowsToCsv,
    rankedExportRows,
    fullExportRows,
  };

  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }

  root.NbaRankerLogic = api;
})(typeof window !== "undefined" ? window : globalThis);
