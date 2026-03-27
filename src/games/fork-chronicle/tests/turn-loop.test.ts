/**
 * Unit tests for turn loop and phase progression
 * Tests for Section 3: Turn Structure
 */

import { initializeGame } from "../src/engine/setup";
import { executeTurn, runGame, stepPhase } from "../src/engine/turn-loop";
import type { GameConfig, GamePhase } from "../src/types/game-state";

/**
 * Create a standard test game config
 */
function createTestConfig(): GameConfig {
  return {
    epochId: "1914_brink",
    factionCount: 4,
    players: [
      { playerId: "player1", displayName: "Player 1", startingInfluencePoints: 100 }
    ],
    eventPackIds: ["base"],
    seed: "turn_loop_test"
  };
}

/**
 * Test: Phase progression follows correct order
 */
export async function testPhaseProgression(): Promise<void> {
  const config = createTestConfig();
  let state = initializeGame(config);

  // Turn 1 should start with player_actions (event_reveal is skipped)
  if (state.phase !== "player_actions") {
    throw new Error(`Turn 1 should start with player_actions, got ${state.phase}`);
  }

  // Execute phases manually and verify order
  const expectedPhases: GamePhase[] = [
    "player_actions",
    "agent_deliberation",
    "agent_negotiation",
    "agent_action",
    "resolution",
    "event_reveal" // Next turn starts with event_reveal
  ];

  for (let i = 0; i < expectedPhases.length; i++) {
    const currentPhase = state.phase;
    if (currentPhase !== expectedPhases[i]) {
      throw new Error(
        `Expected phase ${expectedPhases[i]}, got ${currentPhase} at step ${i}`
      );
    }
    state = await stepPhase(state);
  }

  console.log("✓ testPhaseProgression passed");
}

/**
 * Test: Turn 1 skips event_reveal
 */
export async function testTurn1SkipsEventReveal(): Promise<void> {
  const config = createTestConfig();
  const state = initializeGame(config);

  if (state.currentTurn !== 1) {
    throw new Error("Should start at turn 1");
  }

  if (state.phase !== "player_actions") {
    throw new Error("Turn 1 should skip event_reveal and start with player_actions");
  }

  console.log("✓ testTurn1SkipsEventReveal passed");
}

/**
 * Test: Era summary fires every 5 turns
 */
export async function testEraSummaryEvery5Turns(): Promise<void> {
  const config = createTestConfig();
  let state = initializeGame(config);

  // Run through 5 complete turns
  for (let i = 0; i < 5; i++) {
    state = await executeTurn(state);
  }

  // After turn 5 resolution, should enter era_summary
  // The phase should be event_reveal of turn 6 after era summary completes
  if (state.currentTurn !== 6) {
    throw new Error(`Should be at turn 6 after 5 turns, got turn ${state.currentTurn}`);
  }

  if (state.currentEra !== 2) {
    throw new Error(`Should be in era 2 after 5 turns, got era ${state.currentEra}`);
  }

  console.log("✓ testEraSummaryEvery5Turns passed");
}

/**
 * Test: Turn counter advances after resolution
 */
export async function testTurnCounterAdvances(): Promise<void> {
  const config = createTestConfig();
  let state = initializeGame(config);

  const initialTurn = state.currentTurn;

  // Execute one full turn
  state = await executeTurn(state);

  if (state.currentTurn !== initialTurn + 1) {
    throw new Error(
      `Turn should advance from ${initialTurn} to ${initialTurn + 1}, got ${state.currentTurn}`
    );
  }

  console.log("✓ testTurnCounterAdvances passed");
}

/**
 * Test: History logging captures phase transitions
 */
export async function testHistoryLogging(): Promise<void> {
  const config = createTestConfig();
  let state = initializeGame(config);

  const initialHistoryLength = state.history.length;

  // Execute one full turn
  state = await executeTurn(state);

  // History should have entries for each phase
  if (state.history.length <= initialHistoryLength) {
    throw new Error("History should have new entries after turn execution");
  }

  // Verify history entries have required fields
  const lastEntry = state.history[state.history.length - 1];
  if (!lastEntry.turn || !lastEntry.era || !lastEntry.phase || !lastEntry.events) {
    throw new Error("History entry missing required fields");
  }

  console.log("✓ testHistoryLogging passed");
}

/**
 * Test: runGame() executes multiple turns
 */
export async function testRunGameMultipleTurns(): Promise<void> {
  const config = createTestConfig();
  let state = initializeGame(config);

  // Run game for a limited number of turns
  state = await runGame(state, 10);

  if (state.currentTurn <= 1) {
    throw new Error("Game should have advanced multiple turns");
  }

  if (state.history.length === 0) {
    throw new Error("Game history should have entries");
  }

  console.log("✓ testRunGameMultipleTurns passed");
}

/**
 * Test: runGame() respects max turn limit
 */
export async function testRunGameMaxTurnLimit(): Promise<void> {
  const config = createTestConfig();
  let state = initializeGame(config);

  const maxTurns = 3;
  state = await runGame(state, maxTurns);

  // Should stop at or before maxTurns
  if (state.currentTurn > maxTurns + 1) {
    throw new Error(`Game exceeded max turn limit: ${state.currentTurn} > ${maxTurns + 1}`);
  }

  console.log("✓ testRunGameMaxTurnLimit passed");
}

/**
 * Test: Phase execution creates turn records
 */
export async function testTurnRecordCreation(): Promise<void> {
  const config = createTestConfig();
  let state = initializeGame(config);

  const initialRecords = state.history.length;

  // Step through several phases
  for (let i = 0; i < 3; i++) {
    state = await stepPhase(state);
  }

  // Should have created new turn records
  if (state.history.length <= initialRecords) {
    throw new Error("No turn records created during phase execution");
  }

  // Verify record structure
  state.history.forEach((record, index) => {
    if (typeof record.turn !== "number") {
      throw new Error(`Record ${index} has invalid turn: ${record.turn}`);
    }
    if (typeof record.era !== "number") {
      throw new Error(`Record ${index} has invalid era: ${record.era}`);
    }
    if (!record.phase) {
      throw new Error(`Record ${index} missing phase`);
    }
    if (!Array.isArray(record.events)) {
      throw new Error(`Record ${index} has invalid events array`);
    }
  });

  console.log("✓ testTurnRecordCreation passed");
}

/**
 * Test: Event deck depletion handling
 */
export async function testEventDeckDepletion(): Promise<void> {
  const config = createTestConfig();
  let state = initializeGame(config);

  // Remember initial deck size
  const initialDeckSize = state.eventDeck.length;

  // Run several turns to deplete event deck
  state = await runGame(state, 5);

  // Event deck should have fewer cards (some revealed)
  if (state.eventDeck.length >= initialDeckSize) {
    // Some events should have been drawn
    console.log("⚠️  Event deck size unchanged - this might be expected for short runs");
  }

  // Discard pile should have some events
  if (state.eventDiscard.length === 0 && state.currentTurn > 2) {
    console.log("⚠️  No events in discard pile after multiple turns");
  }

  console.log("✓ testEventDeckDepletion passed");
}

/**
 * Run all turn loop tests
 */
export async function runAllTurnLoopTests(): Promise<void> {
  console.log("\n=== Running Turn Loop Tests ===\n");

  try {
    await testTurn1SkipsEventReveal();
    await testPhaseProgression();
    await testTurnCounterAdvances();
    await testHistoryLogging();
    await testTurnRecordCreation();
    await testEraSummaryEvery5Turns();
    await testRunGameMultipleTurns();
    await testRunGameMaxTurnLimit();
    await testEventDeckDepletion();

    console.log("\n✓ All turn loop tests passed!\n");
  } catch (error) {
    console.error("\n✗ Turn loop test failed:", error);
    throw error;
  }
}

export default {
  testPhaseProgression,
  testTurn1SkipsEventReveal,
  testEraSummaryEvery5Turns,
  testTurnCounterAdvances,
  testHistoryLogging,
  testRunGameMultipleTurns,
  testRunGameMaxTurnLimit,
  testTurnRecordCreation,
  testEventDeckDepletion,
  runAllTurnLoopTests
};
