/**
 * Test suite for personality drift system
 * Tests: All 7 drift rules, clamping, accumulation
 */

import { initializeGame } from "../src/engine/setup";
import { driftPersonalities, getDriftStatistics } from "../src/engine/personality-drift";
import type { GameConfig } from "../src/types/game-state";
import type { Agent } from "../src/types/agent";

/**
 * Test 1: Lost territory increases aggression
 */
async function testLostTerritoryRule() {
  console.log("\n[TEST 1] Lost territory increases aggression");

  const config: GameConfig = {
    epochId: "1914_brink",
    factionCount: 4,
    players: [],
    eventPackIds: ["base"],
    seed: "drift-test-001"
  };

  const state = await initializeGame(config);

  const faction1 = state.factions["faction_1"];
  const agent = faction1.agents[0];

  const initialAggression = agent.personality.aggression;

  // Simulate a territory loss by adding it to history
  state.currentTurn = 2;
  state.history.push({
    turn: 1,
    era: 1,
    phase: "agent_action",
    events: ["⚔️  faction_2 conqueror 1 conquered Egypt from Faction 1 (100 vs 50, roll: 75)"],
    agentDecisions: [],
    stateSnapshot: {}
  });

  // Apply drift
  const { driftEvents } = driftPersonalities(state);

  // Verify aggression increased
  const finalAggression = agent.personality.aggression;
  if (finalAggression <= initialAggression) {
    throw new Error(`Expected aggression to increase, got ${initialAggression} → ${finalAggression}`);
  }

  // Verify the drift event was recorded
  const lostTerritoryEvents = driftEvents.filter((e) => e.rule === "lost_territory");
  if (lostTerritoryEvents.length === 0) {
    throw new Error("Expected lost_territory drift event");
  }

  console.log(`✅ Lost territory increased aggression: ${initialAggression.toFixed(2)} → ${finalAggression.toFixed(2)}`);
}

/**
 * Test 2: Betrayal increases aggression and decreases loyalty
 */
async function testBetrayalRule() {
  console.log("\n[TEST 2] Betrayal increases aggression and decreases loyalty");

  const config: GameConfig = {
    epochId: "1914_brink",
    factionCount: 4,
    players: [],
    eventPackIds: ["base"],
    seed: "drift-test-002"
  };

  const state = await initializeGame(config);

  const faction1 = state.factions["faction_1"];
  const agent = faction1.agents[0];

  const initialAggression = agent.personality.aggression;
  const initialLoyalty = agent.personality.loyalty;

  // Add betrayal to agent's memory
  state.currentTurn = 2;
  agent.memory.push({
    turn: 1,
    targetAgentId: "betrayer_agent",
    interactionType: "betrayal",
    outcome: "suffered"
  });

  // Apply drift
  driftPersonalities(state);

  const finalAggression = agent.personality.aggression;
  const finalLoyalty = agent.personality.loyalty;

  // Verify aggression increased
  if (finalAggression !== initialAggression + 0.10) {
    throw new Error(`Expected aggression +0.10, got ${finalAggression - initialAggression}`);
  }

  // Verify loyalty decreased
  if (finalLoyalty !== initialLoyalty - 0.08) {
    throw new Error(`Expected loyalty -0.08, got ${finalLoyalty - initialLoyalty}`);
  }

  console.log(`✅ Betrayal drift: aggression +0.10, loyalty -0.08`);
}

/**
 * Test 3: Long alliance increases loyalty
 */
async function testLongAllianceRule() {
  console.log("\n[TEST 3] Long alliance (3+ eras) increases loyalty");

  const config: GameConfig = {
    epochId: "1914_brink",
    factionCount: 4,
    players: [],
    eventPackIds: ["base"],
    seed: "drift-test-003"
  };

  const state = await initializeGame(config);

  const faction1 = state.factions["faction_1"];
  const agent = faction1.agents[0];

  const initialLoyalty = agent.personality.loyalty;

  // Create an alliance that's been active for 3 eras (15 turns)
  state.currentTurn = 20;
  state.alliances.push({
    id: "alliance_long",
    factionIds: ["faction_1", "faction_2"],
    formedOnTurn: 5, // 15 turns ago = 3 eras
    terms: [{ type: "defense_pact", duration: null }],
    trustScore: 80,
    status: "active"
  });

  // Apply drift
  driftPersonalities(state);

  const finalLoyalty = agent.personality.loyalty;

  // Verify loyalty increased
  if (finalLoyalty <= initialLoyalty) {
    throw new Error(`Expected loyalty to increase, got ${initialLoyalty} → ${finalLoyalty}`);
  }

  console.log(`✅ Long alliance increased loyalty: ${initialLoyalty.toFixed(2)} → ${finalLoyalty.toFixed(2)}`);
}

/**
 * Test 4: Successful attack increases aggression and expansionism
 */
async function testSuccessfulAttackRule() {
  console.log("\n[TEST 4] Successful attack increases aggression and expansionism");

  const config: GameConfig = {
    epochId: "1914_brink",
    factionCount: 4,
    players: [],
    eventPackIds: ["base"],
    seed: "drift-test-004"
  };

  const state = await initializeGame(config);

  const faction1 = state.factions["faction_1"];
  const agent = faction1.agents[0];

  const initialAggression = agent.personality.aggression;
  const initialExpansionism = agent.personality.expansionism;

  // Add successful attack to agent's memory
  state.currentTurn = 2;
  agent.memory.push({
    turn: 1,
    targetAgentId: "defender_agent",
    interactionType: "attack",
    outcome: "succeeded"
  });

  // Apply drift
  driftPersonalities(state);

  const finalAggression = agent.personality.aggression;
  const finalExpansionism = agent.personality.expansionism;

  // Verify aggression increased
  if (finalAggression !== initialAggression + 0.03) {
    throw new Error(`Expected aggression +0.03, got ${finalAggression - initialAggression}`);
  }

  // Verify expansionism increased
  if (finalExpansionism !== initialExpansionism + 0.04) {
    throw new Error(`Expected expansionism +0.04, got ${finalExpansionism - initialExpansionism}`);
  }

  console.log(`✅ Successful attack drift: aggression +0.03, expansionism +0.04`);
}

/**
 * Test 5: Failed attack decreases aggression and risk tolerance
 */
async function testFailedAttackRule() {
  console.log("\n[TEST 5] Failed attack decreases aggression and risk tolerance");

  const config: GameConfig = {
    epochId: "1914_brink",
    factionCount: 4,
    players: [],
    eventPackIds: ["base"],
    seed: "drift-test-005"
  };

  const state = await initializeGame(config);

  const faction1 = state.factions["faction_1"];
  const agent = faction1.agents[0];

  const initialAggression = agent.personality.aggression;
  const initialRiskTolerance = agent.personality.riskTolerance;

  // Add failed attack to agent's memory
  state.currentTurn = 2;
  agent.memory.push({
    turn: 1,
    targetAgentId: "defender_agent",
    interactionType: "attack",
    outcome: "failed"
  });

  // Apply drift
  driftPersonalities(state);

  const finalAggression = agent.personality.aggression;
  const finalRiskTolerance = agent.personality.riskTolerance;

  // Verify aggression decreased
  if (finalAggression !== initialAggression - 0.05) {
    throw new Error(`Expected aggression -0.05, got ${finalAggression - initialAggression}`);
  }

  // Verify risk tolerance decreased
  if (finalRiskTolerance !== initialRiskTolerance - 0.04) {
    throw new Error(`Expected riskTolerance -0.04, got ${finalRiskTolerance - initialRiskTolerance}`);
  }

  console.log(`✅ Failed attack drift: aggression -0.05, riskTolerance -0.04`);
}

/**
 * Test 6: High reputation (>80) increases loyalty
 */
async function testHighReputationRule() {
  console.log("\n[TEST 6] High reputation (>80) increases loyalty");

  const config: GameConfig = {
    epochId: "1914_brink",
    factionCount: 4,
    players: [],
    eventPackIds: ["base"],
    seed: "drift-test-006"
  };

  const state = await initializeGame(config);

  const faction1 = state.factions["faction_1"];
  const agent = faction1.agents[0];

  const initialLoyalty = agent.personality.loyalty;

  // Set faction reputation to 85
  faction1.reputation = 85;

  // Apply drift
  driftPersonalities(state);

  const finalLoyalty = agent.personality.loyalty;

  // Verify loyalty increased
  if (finalLoyalty !== initialLoyalty + 0.02) {
    throw new Error(`Expected loyalty +0.02, got ${finalLoyalty - initialLoyalty}`);
  }

  console.log(`✅ High reputation increased loyalty: ${initialLoyalty.toFixed(2)} → ${finalLoyalty.toFixed(2)}`);
}

/**
 * Test 7: Low reputation (<30) increases risk tolerance
 */
async function testLowReputationRule() {
  console.log("\n[TEST 7] Low reputation (<30) increases risk tolerance");

  const config: GameConfig = {
    epochId: "1914_brink",
    factionCount: 4,
    players: [],
    eventPackIds: ["base"],
    seed: "drift-test-007"
  };

  const state = await initializeGame(config);

  const faction1 = state.factions["faction_1"];
  const agent = faction1.agents[0];

  const initialRiskTolerance = agent.personality.riskTolerance;

  // Set faction reputation to 25
  faction1.reputation = 25;

  // Apply drift
  driftPersonalities(state);

  const finalRiskTolerance = agent.personality.riskTolerance;

  // Verify risk tolerance increased
  if (finalRiskTolerance !== initialRiskTolerance + 0.06) {
    throw new Error(`Expected riskTolerance +0.06, got ${finalRiskTolerance - initialRiskTolerance}`);
  }

  console.log(`✅ Low reputation increased riskTolerance: ${initialRiskTolerance.toFixed(2)} → ${finalRiskTolerance.toFixed(2)}`);
}

/**
 * Test 8: Values never exceed 1.0 or drop below 0.0 after 50 turns
 */
async function testClampingAfter50Turns() {
  console.log("\n[TEST 8] Values clamped to [0.0, 1.0] after 50 turns of drift");

  const config: GameConfig = {
    epochId: "1914_brink",
    factionCount: 4,
    players: [],
    eventPackIds: ["base"],
    seed: "drift-test-008"
  };

  const state = await initializeGame(config);

  const faction1 = state.factions["faction_1"];
  const agent = faction1.agents[0];

  // Set extreme starting values
  agent.personality.aggression = 0.95;
  agent.personality.expansionism = 0.05;
  agent.personality.loyalty = 0.90;
  agent.personality.riskTolerance = 0.10;

  // Simulate 50 turns of drift with various events
  for (let turn = 1; turn <= 50; turn++) {
    state.currentTurn = turn + 1;

    // Add various memory events
    if (turn % 5 === 0) {
      agent.memory.push({
        turn,
        targetAgentId: "target",
        interactionType: "attack",
        outcome: "succeeded"
      });
    }

    if (turn % 7 === 0) {
      agent.memory.push({
        turn,
        targetAgentId: "target",
        interactionType: "attack",
        outcome: "failed"
      });
    }

    if (turn % 10 === 0) {
      agent.memory.push({
        turn,
        targetAgentId: "betrayer",
        interactionType: "betrayal",
        outcome: "suffered"
      });
    }

    // Vary faction reputation
    faction1.reputation = 50 + (turn % 60) - 30;

    driftPersonalities(state);
  }

  // Verify all values are within bounds
  const personality = agent.personality;

  if (personality.aggression < 0.0 || personality.aggression > 1.0) {
    throw new Error(`aggression out of bounds: ${personality.aggression}`);
  }

  if (personality.expansionism < 0.0 || personality.expansionism > 1.0) {
    throw new Error(`expansionism out of bounds: ${personality.expansionism}`);
  }

  if (personality.loyalty < 0.0 || personality.loyalty > 1.0) {
    throw new Error(`loyalty out of bounds: ${personality.loyalty}`);
  }

  if (personality.riskTolerance < 0.0 || personality.riskTolerance > 1.0) {
    throw new Error(`riskTolerance out of bounds: ${personality.riskTolerance}`);
  }

  console.log(`✅ All values clamped after 50 turns:`);
  console.log(`   aggression: ${personality.aggression.toFixed(2)}`);
  console.log(`   expansionism: ${personality.expansionism.toFixed(2)}`);
  console.log(`   loyalty: ${personality.loyalty.toFixed(2)}`);
  console.log(`   riskTolerance: ${personality.riskTolerance.toFixed(2)}`);
}

/**
 * Test 9: Betrayed agent measurably more aggressive after 5 turns
 */
async function testBetrayedAgentAccumulation() {
  console.log("\n[TEST 9] Betrayed agent becomes more aggressive after 5 turns");

  const config: GameConfig = {
    epochId: "1914_brink",
    factionCount: 4,
    players: [],
    eventPackIds: ["base"],
    seed: "drift-test-009"
  };

  const state = await initializeGame(config);

  const faction1 = state.factions["faction_1"];
  const agent = faction1.agents[0];

  const initialAggression = agent.personality.aggression;

  // Simulate 5 betrayals over 5 turns
  for (let turn = 1; turn <= 5; turn++) {
    state.currentTurn = turn + 1;

    agent.memory.push({
      turn,
      targetAgentId: `betrayer_${turn}`,
      interactionType: "betrayal",
      outcome: "suffered"
    });

    driftPersonalities(state);
  }

  const finalAggression = agent.personality.aggression;
  const expectedIncrease = 0.10 * 5; // +0.10 per betrayal

  // Allow for small floating point errors
  const actualIncrease = finalAggression - initialAggression;
  if (Math.abs(actualIncrease - expectedIncrease) > 0.01) {
    throw new Error(`Expected aggression +${expectedIncrease}, got +${actualIncrease}`);
  }

  console.log(`✅ Betrayed agent aggression: ${initialAggression.toFixed(2)} → ${finalAggression.toFixed(2)} (+${actualIncrease.toFixed(2)})`);
}

/**
 * Test 10: High reputation agent more loyal after 5 turns
 */
async function testHighReputationAccumulation() {
  console.log("\n[TEST 10] High reputation agent becomes more loyal after 5 turns");

  const config: GameConfig = {
    epochId: "1914_brink",
    factionCount: 4,
    players: [],
    eventPackIds: ["base"],
    seed: "drift-test-010"
  };

  const state = await initializeGame(config);

  const faction1 = state.factions["faction_1"];
  const agent = faction1.agents[0];

  const initialLoyalty = agent.personality.loyalty;

  // Set high reputation
  faction1.reputation = 90;

  // Simulate 5 turns
  for (let turn = 1; turn <= 5; turn++) {
    state.currentTurn = turn + 1;
    driftPersonalities(state);
  }

  const finalLoyalty = agent.personality.loyalty;
  const expectedIncrease = 0.02 * 5; // +0.02 per turn

  const actualIncrease = finalLoyalty - initialLoyalty;
  if (Math.abs(actualIncrease - expectedIncrease) > 0.01) {
    throw new Error(`Expected loyalty +${expectedIncrease}, got +${actualIncrease}`);
  }

  console.log(`✅ High reputation agent loyalty: ${initialLoyalty.toFixed(2)} → ${finalLoyalty.toFixed(2)} (+${actualIncrease.toFixed(2)})`);
}

/**
 * Run all drift tests
 */
export async function runAllDriftTests() {
  console.log("╔════════════════════════════════════════════════════════════════╗");
  console.log("║  Personality Drift System - Test Suite                       ║");
  console.log("╚════════════════════════════════════════════════════════════════╝");

  try {
    await testLostTerritoryRule();
    await testBetrayalRule();
    await testLongAllianceRule();
    await testSuccessfulAttackRule();
    await testFailedAttackRule();
    await testHighReputationRule();
    await testLowReputationRule();
    await testClampingAfter50Turns();
    await testBetrayedAgentAccumulation();
    await testHighReputationAccumulation();

    console.log("\n╔════════════════════════════════════════════════════════════════╗");
    console.log("║  ✅ ALL DRIFT TESTS PASSED (10/10)                            ║");
    console.log("╚════════════════════════════════════════════════════════════════╝\n");
  } catch (error) {
    console.error("\n❌ TEST FAILED:");
    console.error(error);
    process.exit(1);
  }
}

// Run tests if this file is executed directly
if (require.main === module) {
  runAllDriftTests();
}
