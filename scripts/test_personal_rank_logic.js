const {
  nextPersonalRank,
  screenStepRankValue,
  seedPersonalRanks,
  updatePersonalRank,
} = require("../web/app-logic.js");

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
assertEqual("next rank starts at one", nextPersonalRank({}), 1);
assertEqual("next rank follows current sequence", nextPersonalRank({ A: 1, B: 2, C: 3 }), 4);
assertEqual("next rank ignores invalid entries", nextPersonalRank({ A: 1, B: 0, C: "nope" }), 2);
assertEqual("spinner up moves rank up visually", screenStepRankValue(3, 4, 5), 2);
assertEqual("spinner down moves rank down visually", screenStepRankValue(3, 2, 5), 4);
assertEqual("spinner up clamps at top", screenStepRankValue(1, 2, 5), 1);
assertEqual("spinner down clamps at bottom", screenStepRankValue(5, 4, 5), 5);
assertEqual(
  "seed fills empty ranks by index",
  seedPersonalRanks(
    { C: 1 },
    [
      { playerId: "B", index: 2 },
      { playerId: "A", index: 1 },
      { playerId: "C", index: 3 },
    ],
    3,
  ),
  { C: 1, A: 2, B: 3 },
);
assertEqual(
  "seed does not overwrite enough existing ranks",
  seedPersonalRanks({ A: 1, B: 2 }, [{ playerId: "C", index: 1 }], 2),
  { A: 1, B: 2 },
);

console.log("personal rank logic ok");
