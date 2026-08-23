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

function assertEqual(name, actual, expected) {
  const actualJson = JSON.stringify(actual);
  const expectedJson = JSON.stringify(expected);
  if (actualJson !== expectedJson) {
    throw new Error(`${name}: expected ${expectedJson}, received ${actualJson}`);
  }
}

assertEqual("clamps gaps", updatePersonalRank({ A: 1 }, "B", "3"), { A: 1, B: 2 });
assertEqual("inserts at top", updatePersonalRank({ A: 1, B: 2, C: 3 }, "D", "1"), {
  D: 1,
  A: 2,
  B: 3,
  C: 4,
});
assertEqual("moves down", updatePersonalRank({ A: 1, B: 2, C: 3 }, "A", "3"), {
  B: 1,
  C: 2,
  A: 3,
});
assertEqual("clears and shifts", updatePersonalRank({ A: 1, B: 2, C: 3 }, "B", ""), {
  A: 1,
  C: 2,
});

console.log("personal rank logic ok");
