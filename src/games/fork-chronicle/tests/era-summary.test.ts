/**
 * Test suite for era summary and narrative system
 * Tests: EraCard generation, narrative templates, Chronicle export, Director titles
 */

import { initializeGame } from "../src/engine/setup";
import { runGame } from "../src/engine/turn-loop";
import { generateEraCard, calculatePlayerScore, exportChronicle } from "../src/engine/era-summary";
import type { GameConfig } from "../src/types/game-state";
import type { FactionId } from "../src/types/faction";

/**
 * Test 1: EraCard fields all populated correctly
 */
async function testEraCardPopulation() {
  console.log("\n[TEST 1] EraCard fields all populated correctly");

  const config: GameConfig = {
    epochId: "1914_brink",
    factionCount: 4,
    players: [],
    eventPackIds: ["base"],
    seed: "era-test-001"
  };

  const state = await initializeGame(config);

  // Run 5 turns to complete an era
  await runGame(state, 5);

  // Should have 1 era card
  if (state.eraCards.length !== 1) {
    throw new Error(`Expected 1 era card, got ${state.eraCards.length}`);
  }

  const eraCard = state.eraCards[0];

  // Verify all fields are populated
  if (!eraCard.leaderFaction) {
    throw new Error("leaderFaction not set");
  }

  if (!eraCard.narrativeSummary || eraCard.narrativeSummary.length === 0) {
    throw new Error("narrativeSummary not generated");
  }

  if (eraCard.era !== 1) {
    throw new Error(`Expected era 1, got ${eraCard.era}`);
  }

  if (eraCard.turns.length !== 2) {
    throw new Error("turns array should have start and end");
  }

  console.log(`✅ EraCard complete:`);
  console.log(`   Era: ${eraCard.era}`);
  console.log(`   Leader: ${eraCard.leaderFaction}`);
  console.log(`   Alliances formed: ${eraCard.alliancesFormed}`);
  console.log(`   Narrative: ${eraCard.narrativeSummary.substring(0, 80)}...`);
}

/**
 * Test 2: Narrative never contains game-mechanics language
 */
async function testNarrativeLanguage() {
  console.log("\n[TEST 2] Narrative avoids game-mechanics language");

  const config: GameConfig = {
    epochId: "1914_brink",
    factionCount: 4,
    players: [],
    eventPackIds: ["base"],
    seed: "era-test-002"
  };

  const state = await initializeGame(config);

  // Run 10 turns to get 2 era cards
  await runGame(state, 10);

  const forbiddenWords = [
    "strength",
    "IP",
    "territory_share",
    "p_accept",
    "faction_id",
    "AgentAction",
    "patronBacking",
    "riskTolerance",
    "aggression",
    "loyalty"
  ];

  state.eraCards.forEach((eraCard, idx) => {
    const narrative = eraCard.narrativeSummary.toLowerCase();

    forbiddenWords.forEach((word) => {
      if (narrative.includes(word.toLowerCase())) {
        throw new Error(`Era ${idx + 1} narrative contains forbidden word: "${word}"`);
      }
    });
  });

  console.log(`✅ All ${state.eraCards.length} narratives use proper historical language`);
}

/**
 * Test 3: fullNarrative is coherent concatenation
 */
async function testChronicleExport() {
  console.log("\n[TEST 3] Chronicle export produces coherent full narrative");

  const config: GameConfig = {
    epochId: "1914_brink",
    factionCount: 4,
    players: [],
    eventPackIds: ["base"],
    seed: "era-test-003"
  };

  const state = await initializeGame(config);

  // Run 15 turns to get 3 era cards
  await runGame(state, 15);

  const openingOdds: Record<FactionId, number> = {
    faction_1: 2.5,
    faction_2: 2.5,
    faction_3: 2.5,
    faction_4: 2.5
  };

  const chronicle = exportChronicle(state, state.eraCards, openingOdds);

  // Verify chronicle structure
  if (chronicle.eraCards.length !== 3) {
    throw new Error(`Expected 3 era cards, got ${chronicle.eraCards.length}`);
  }

  if (!chronicle.fullNarrative || chronicle.fullNarrative.length === 0) {
    throw new Error("fullNarrative not generated");
  }

  // Verify all era narratives are in the full narrative
  state.eraCards.forEach((card) => {
    if (!chronicle.fullNarrative.includes(card.narrativeSummary)) {
      throw new Error(`Full narrative missing Era ${card.era} summary`);
    }
  });

  // Verify proper paragraph breaks
  const paragraphs = chronicle.fullNarrative.split("\n\n");
  if (paragraphs.length < 3) {
    throw new Error("Full narrative should have paragraph breaks between eras");
  }

  console.log(`✅ Chronicle exported with ${chronicle.eraCards.length} eras`);
  console.log(`   Full narrative: ${chronicle.fullNarrative.length} characters`);
  console.log(`   Total turns: ${chronicle.totalTurns}`);
}

/**
 * Test 4: Director title "the_oracle" assigns correctly
 */
async function testOracleTitle() {
  console.log("\n[TEST 4] Director title 'the_oracle' assigns for 4+ bet wins");

  const config: GameConfig = {
    epochId: "1914_brink",
    factionCount: 4,
    players: [{ playerId: "player1", displayName: "Test Player", startingInfluencePoints: 100 }],
    eventPackIds: ["base"],
    seed: "era-test-004"
  };

  const state = await initializeGame(config);

  // Simulate 4 bet wins in history
  state.history.push({
    turn: 1,
    era: 1,
    phase: "resolution",
    events: [
      "💰 player1 won bet (faction_wins on faction_1): 20 IP → 40.0 IP (2.0x odds)",
      "💰 player1 won bet (faction_wins on faction_2): 20 IP → 40.0 IP (2.0x odds)",
      "💰 player1 won bet (faction_wins on faction_3): 20 IP → 40.0 IP (2.0x odds)",
      "💰 player1 won bet (faction_wins on faction_4): 20 IP → 40.0 IP (2.0x odds)"
    ],
    agentDecisions: [],
    stateSnapshot: {}
  });

  const openingOdds: Record<FactionId, number> = {
    faction_1: 2.5,
    faction_2: 2.5,
    faction_3: 2.5,
    faction_4: 2.5
  };

  const score = calculatePlayerScore("player1", state, openingOdds);

  if (score.betsWon !== 4) {
    throw new Error(`Expected 4 bets won, got ${score.betsWon}`);
  }

  if (score.directorTitle !== "the_oracle") {
    throw new Error(`Expected 'the_oracle', got '${score.directorTitle}'`);
  }

  console.log(`✅ the_oracle title assigned (${score.betsWon} bets won)`);
}

/**
 * Test 5: Director title "the_contrarian" only triggers with odds > 4.0
 */
async function testContrarianTitle() {
  console.log("\n[TEST 5] Director title 'the_contrarian' requires opening odds > 4.0");

  const config: GameConfig = {
    epochId: "1914_brink",
    factionCount: 4,
    players: [{ playerId: "player1", displayName: "Test Player", startingInfluencePoints: 100 }],
    eventPackIds: ["base"],
    seed: "era-test-005"
  };

  const state = await initializeGame(config);

  // Commit patron backing
  const { commitPatronBacking } = require("../src/engine/patron");
  commitPatronBacking("player1", "faction_1", "resource_bonus", state);

  // Set winner to backed faction
  state.winner = "faction_1";

  // Test with LOW opening odds (should NOT be contrarian)
  const lowOdds: Record<FactionId, number> = {
    faction_1: 2.0, // Low odds = favorite
    faction_2: 3.5,
    faction_3: 3.5,
    faction_4: 3.5
  };

  let score = calculatePlayerScore("player1", state, lowOdds);

  if (score.directorTitle === "the_contrarian") {
    throw new Error("Should NOT be contrarian with opening odds 2.0");
  }

  // Test with HIGH opening odds (should be contrarian)
  const highOdds: Record<FactionId, number> = {
    faction_1: 5.0, // High odds = underdog
    faction_2: 2.0,
    faction_3: 2.0,
    faction_4: 2.0
  };

  score = calculatePlayerScore("player1", state, highOdds);

  if (score.directorTitle !== "the_contrarian") {
    throw new Error(`Expected 'the_contrarian' with odds 5.0, got '${score.directorTitle}'`);
  }

  console.log(`✅ the_contrarian title correctly checks opening odds > 4.0`);
}

/**
 * Test 6: Director title "the_kingmaker" requires patronBacking > 50
 */
async function testKingmakerTitle() {
  console.log("\n[TEST 6] Director title 'the_kingmaker' requires patronBacking > 50");

  const config: GameConfig = {
    epochId: "1914_brink",
    factionCount: 4,
    players: [{ playerId: "player1", displayName: "Test Player", startingInfluencePoints: 100 }],
    eventPackIds: ["base"],
    seed: "era-test-006"
  };

  const state = await initializeGame(config);

  // Commit patron backing
  const { commitPatronBacking } = require("../src/engine/patron");
  commitPatronBacking("player1", "faction_1", "resource_bonus", state);

  // Set winner to backed faction
  state.winner = "faction_1";

  // Test with LOW patronBacking (should be "the_patron")
  state.factions["faction_1"].patronBacking = 30;

  const openingOdds: Record<FactionId, number> = {
    faction_1: 2.5,
    faction_2: 2.5,
    faction_3: 2.5,
    faction_4: 2.5
  };

  let score = calculatePlayerScore("player1", state, openingOdds);

  if (score.directorTitle !== "the_patron") {
    throw new Error(`Expected 'the_patron' with patronBacking 30, got '${score.directorTitle}'`);
  }

  // Test with HIGH patronBacking (should be "the_kingmaker")
  state.factions["faction_1"].patronBacking = 60;

  score = calculatePlayerScore("player1", state, openingOdds);

  if (score.directorTitle !== "the_kingmaker") {
    throw new Error(`Expected 'the_kingmaker' with patronBacking 60, got '${score.directorTitle}'`);
  }

  console.log(`✅ the_kingmaker title correctly requires patronBacking > 50`);
}

/**
 * Run all era summary tests
 */
export async function runAllEraSummaryTests() {
  console.log("╔════════════════════════════════════════════════════════════════╗");
  console.log("║  Era Summary & Narrative Engine - Test Suite                 ║");
  console.log("╚════════════════════════════════════════════════════════════════╝");

  try {
    await testEraCardPopulation();
    await testNarrativeLanguage();
    await testChronicleExport();
    await testOracleTitle();
    await testContrarianTitle();
    await testKingmakerTitle();

    console.log("\n╔════════════════════════════════════════════════════════════════╗");
    console.log("║  ✅ ALL ERA SUMMARY TESTS PASSED (6/6)                        ║");
    console.log("╚════════════════════════════════════════════════════════════════╝\n");
  } catch (error) {
    console.error("\n❌ TEST FAILED:");
    console.error(error);
    process.exit(1);
  }
}

// Run tests if this file is executed directly
if (require.main === module) {
  runAllEraSummaryTests();
}
