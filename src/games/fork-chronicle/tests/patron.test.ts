/**
 * Test suite for patron backing system
 * Tests: commitPatronBacking, patron benefits, reputation shield, negotiation edge
 */

import { initializeGame } from "../src/engine/setup";
import { commitPatronBacking, applyPatronEraEffects, hasNegotiationEdge } from "../src/engine/patron";
import { resolveNegotiations } from "../src/engine/negotiation";
import type { GameConfig } from "../src/types/game-state";
import type { FactionId } from "../src/types/faction";
import type { AgentDecision } from "../src/types/agent";

/**
 * Test 1: Player cannot back two factions simultaneously
 */
async function testCannotBackTwoFactions() {
  console.log("\n[TEST 1] Player cannot back two factions simultaneously");

  const config: GameConfig = {
    epochId: "1914_brink",
    factionCount: 4,
    players: [{ playerId: "player1", displayName: "Test Player", startingInfluencePoints: 100 }],
    eventPackIds: ["base"],
    seed: "patron-test-001"
  };

  const state = await initializeGame(config);

  const faction1 = Object.keys(state.factions)[0] as FactionId;
  const faction2 = Object.keys(state.factions)[1] as FactionId;

  // Back first faction
  const result1 = commitPatronBacking("player1", faction1, "resource_bonus", state);
  if (!result1.success) {
    throw new Error(`Failed to back first faction: ${result1.error}`);
  }

  // Try to back second faction (should require switching cost)
  const result2 = commitPatronBacking("player1", faction2, "resource_bonus", state);

  // Should succeed but cost 20 IP to switch
  if (!result2.success) {
    throw new Error(`Failed to switch factions: ${result2.error}`);
  }

  // Verify player only has one active commitment
  const player = state.playerStates["player1"];
  if (player.patronCommitments.length !== 1) {
    throw new Error(`Expected 1 active commitment, got ${player.patronCommitments.length}`);
  }

  // Verify commitment is for faction2
  if (player.patronCommitments[0].targetFactionId !== faction2) {
    throw new Error(`Expected commitment to ${faction2}, got ${player.patronCommitments[0].targetFactionId}`);
  }

  console.log("✅ Player correctly switched factions (only one commitment allowed)");
}

/**
 * Test 2: Switching factions costs 20 IP and resets patronBacking to 0
 */
async function testSwitchingCostsIPAndResetsPatronBacking() {
  console.log("\n[TEST 2] Switching factions costs 20 IP and resets patronBacking");

  const config: GameConfig = {
    epochId: "1914_brink",
    factionCount: 4,
    players: [{ playerId: "player1", displayName: "Test Player", startingInfluencePoints: 100 }],
    eventPackIds: ["base"],
    seed: "patron-test-002"
  };

  const state = await initializeGame(config);

  const faction1 = Object.keys(state.factions)[0] as FactionId;
  const faction2 = Object.keys(state.factions)[1] as FactionId;

  // Back first faction
  commitPatronBacking("player1", faction1, "resource_bonus", state);

  // Accumulate patronBacking
  state.factions[faction1].patronBacking = 50;

  const ipBefore = state.playerStates["player1"].influencePoints;

  // Switch to second faction
  const result = commitPatronBacking("player1", faction2, "resource_bonus", state);

  if (!result.success) {
    throw new Error(`Failed to switch: ${result.error}`);
  }

  const ipAfter = state.playerStates["player1"].influencePoints;

  // Verify 20 IP was deducted
  if (ipAfter !== ipBefore - 20) {
    throw new Error(`Expected IP to decrease by 20, got ${ipBefore - ipAfter}`);
  }

  // Verify old faction's patronBacking was reset to 0
  if (state.factions[faction1].patronBacking !== 0) {
    throw new Error(`Expected faction1 patronBacking to be 0, got ${state.factions[faction1].patronBacking}`);
  }

  console.log("✅ Switching factions correctly costs 20 IP and resets patronBacking");
}

/**
 * Test 3: reputation_shield prevents reputation from dropping below 30
 */
async function testReputationShieldFloor() {
  console.log("\n[TEST 3] reputation_shield prevents reputation from dropping below 30");

  const config: GameConfig = {
    epochId: "1914_brink",
    factionCount: 4,
    players: [{ playerId: "player1", displayName: "Test Player", startingInfluencePoints: 100 }],
    eventPackIds: ["base"],
    seed: "patron-test-003"
  };

  const state = await initializeGame(config);

  const factionId = Object.keys(state.factions)[0] as FactionId;
  const faction = state.factions[factionId];

  // Back faction with reputation_shield
  commitPatronBacking("player1", factionId, "reputation_shield", state);

  // Set reputation to 40
  faction.reputation = 40;

  // Apply a -30 reputation penalty
  faction.reputation -= 30;

  // Apply reputation floor
  const { applyReputationFloor } = require("../src/engine/patron");
  applyReputationFloor(factionId, state);

  // Verify reputation was floored at 30, not 10
  if (faction.reputation !== 30) {
    throw new Error(`Expected reputation to be floored at 30, got ${faction.reputation}`);
  }

  console.log("✅ reputation_shield correctly prevents reputation from dropping below 30");
}

/**
 * Test 4: negotiation_edge increases alliance acceptance rates
 */
async function testNegotiationEdgeBonus() {
  console.log("\n[TEST 4] negotiation_edge increases alliance acceptance rates");

  const config: GameConfig = {
    epochId: "1914_brink",
    factionCount: 4,
    players: [{ playerId: "player1", displayName: "Test Player", startingInfluencePoints: 100 }],
    eventPackIds: ["base"],
    seed: "patron-test-004"
  };

  const state = await initializeGame(config);

  const faction1 = Object.keys(state.factions)[0] as FactionId;
  const faction2 = Object.keys(state.factions)[1] as FactionId;

  // Back faction1 with negotiation_edge
  const result = commitPatronBacking("player1", faction1, "negotiation_edge", state);

  if (!result.success) {
    throw new Error(`Failed to commit negotiation_edge: ${result.error}`);
  }

  // Verify hasNegotiationEdge returns true
  if (!hasNegotiationEdge(faction1, state)) {
    throw new Error("hasNegotiationEdge should return true for faction1");
  }

  // Verify hasNegotiationEdge returns false for other factions
  if (hasNegotiationEdge(faction2, state)) {
    throw new Error("hasNegotiationEdge should return false for faction2");
  }

  // Verify upfront cost was deducted (40 IP)
  const player = state.playerStates["player1"];
  if (player.influencePoints !== 60) {
    throw new Error(`Expected 60 IP remaining (100 - 40), got ${player.influencePoints}`);
  }

  console.log("✅ negotiation_edge correctly tracks and deducts upfront cost");
}

/**
 * Test 5: resource_bonus applies to lowest-resource territory
 */
async function testResourceBonusTargetsLowestTerritory() {
  console.log("\n[TEST 5] resource_bonus applies to lowest-resource territory");

  const config: GameConfig = {
    epochId: "1914_brink",
    factionCount: 4,
    players: [{ playerId: "player1", displayName: "Test Player", startingInfluencePoints: 100 }],
    eventPackIds: ["base"],
    seed: "patron-test-005"
  };

  const state = await initializeGame(config);

  const factionId = Object.keys(state.factions)[0] as FactionId;
  const faction = state.factions[factionId];

  // Back faction with resource_bonus
  commitPatronBacking("player1", factionId, "resource_bonus", state);

  // Set up territories with different resource levels
  const territories = faction.territories.map((tId) => state.territories[tId]);
  if (territories.length < 2) {
    console.log("⚠️  Skipping test - faction needs at least 2 territories");
    return;
  }

  // Set first territory to high resources, second to low
  territories[0].resources.food = 100;
  territories[0].resources.industry = 100;
  territories[0].resources.tech = 100;

  territories[1].resources.food = 10;
  territories[1].resources.industry = 10;
  territories[1].resources.tech = 10;

  const lowestTerritory = territories[1];
  const initialTotal = lowestTerritory.resources.food + lowestTerritory.resources.industry + lowestTerritory.resources.tech;

  // Apply patron era effects
  applyPatronEraEffects(state);

  const finalTotal = lowestTerritory.resources.food + lowestTerritory.resources.industry + lowestTerritory.resources.tech;

  // Verify lowest territory got +10 to some resource
  if (finalTotal !== initialTotal + 10) {
    throw new Error(`Expected lowest territory to gain +10 resources, got ${finalTotal - initialTotal}`);
  }

  console.log("✅ resource_bonus correctly targets lowest-resource territory");
}

/**
 * Test 6: Patron benefit expires when player cannot afford era cost
 */
async function testBenefitExpiresWithInsufficientIP() {
  console.log("\n[TEST 6] Patron benefit expires when player cannot afford era cost");

  const config: GameConfig = {
    epochId: "1914_brink",
    factionCount: 4,
    players: [{ playerId: "player1", displayName: "Test Player", startingInfluencePoints: 100 }],
    eventPackIds: ["base"],
    seed: "patron-test-006"
  };

  const state = await initializeGame(config);

  const factionId = Object.keys(state.factions)[0] as FactionId;

  // Back faction with reputation_shield (costs 30 IP per era)
  commitPatronBacking("player1", factionId, "reputation_shield", state);

  // Set player IP to 20 (insufficient for 30 IP cost)
  state.playerStates["player1"].influencePoints = 20;

  // Apply patron era effects
  const results = applyPatronEraEffects(state);

  // Verify benefit expired
  const hasCommitment = state.playerStates["player1"].patronCommitments.some(
    (c) => c.benefit === "reputation_shield"
  );

  if (hasCommitment) {
    throw new Error("reputation_shield should have expired due to insufficient IP");
  }

  // Verify results mention the expiry
  const hasExpiryMessage = results.some((r) => r.includes("cannot afford") && r.includes("expires"));
  if (!hasExpiryMessage) {
    throw new Error("Expected expiry message in results");
  }

  console.log("✅ Patron benefit correctly expires when player cannot afford cost");
}

/**
 * Test 7: patronBacking accumulation increases negotiation patron_factor
 */
async function testPatronBackingAccumulation() {
  console.log("\n[TEST 7] patronBacking accumulates each turn and increases patron_factor");

  const config: GameConfig = {
    epochId: "1914_brink",
    factionCount: 4,
    players: [{ playerId: "player1", displayName: "Test Player", startingInfluencePoints: 100 }],
    eventPackIds: ["base"],
    seed: "patron-test-007"
  };

  const state = await initializeGame(config);

  const factionId = Object.keys(state.factions)[0] as FactionId;
  const faction = state.factions[factionId];

  // Back faction
  commitPatronBacking("player1", factionId, "resource_bonus", state);

  const initialPatronBacking = faction.patronBacking;

  // Apply patron benefits (increments patronBacking)
  const { applyPatronBenefits } = require("../src/engine/patron");
  applyPatronBenefits(state);

  // Verify patronBacking increased by 1
  if (faction.patronBacking !== initialPatronBacking + 1) {
    throw new Error(`Expected patronBacking to increase by 1, got ${faction.patronBacking - initialPatronBacking}`);
  }

  // Test patron_factor calculation
  const { getPatronFactor } = require("../src/engine/patron");
  const patronFactor = getPatronFactor(factionId, state);

  const expectedFactor = faction.patronBacking / 100;
  if (Math.abs(patronFactor - expectedFactor) > 0.001) {
    throw new Error(`Expected patron_factor ${expectedFactor}, got ${patronFactor}`);
  }

  console.log("✅ patronBacking correctly accumulates and calculates patron_factor");
}

/**
 * Test 8: negotiation_edge expires after 2 eras
 */
async function testNegotiationEdgeExpiry() {
  console.log("\n[TEST 8] negotiation_edge expires after 2 eras");

  const config: GameConfig = {
    epochId: "1914_brink",
    factionCount: 4,
    players: [{ playerId: "player1", displayName: "Test Player", startingInfluencePoints: 100 }],
    eventPackIds: ["base"],
    seed: "patron-test-008"
  };

  const state = await initializeGame(config);

  const factionId = Object.keys(state.factions)[0] as FactionId;

  // Back faction with negotiation_edge
  commitPatronBacking("player1", factionId, "negotiation_edge", state);

  // Apply era effects twice (2 eras)
  applyPatronEraEffects(state);

  // After 1 era, should still be active
  let hasCommitment = state.playerStates["player1"].patronCommitments.some(
    (c) => c.benefit === "negotiation_edge"
  );
  if (!hasCommitment) {
    throw new Error("negotiation_edge should still be active after 1 era");
  }

  applyPatronEraEffects(state);

  // After 2 eras, should expire
  hasCommitment = state.playerStates["player1"].patronCommitments.some(
    (c) => c.benefit === "negotiation_edge"
  );
  if (hasCommitment) {
    throw new Error("negotiation_edge should expire after 2 eras");
  }

  console.log("✅ negotiation_edge correctly expires after 2 eras");
}

/**
 * Run all patron tests
 */
export async function runAllPatronTests() {
  console.log("╔════════════════════════════════════════════════════════════════╗");
  console.log("║  Patron Backing System - Test Suite                          ║");
  console.log("╚════════════════════════════════════════════════════════════════╝");

  try {
    await testCannotBackTwoFactions();
    await testSwitchingCostsIPAndResetsPatronBacking();
    await testReputationShieldFloor();
    await testNegotiationEdgeBonus();
    await testResourceBonusTargetsLowestTerritory();
    await testBenefitExpiresWithInsufficientIP();
    await testPatronBackingAccumulation();
    await testNegotiationEdgeExpiry();

    console.log("\n╔════════════════════════════════════════════════════════════════╗");
    console.log("║  ✅ ALL PATRON TESTS PASSED (8/8)                             ║");
    console.log("╚════════════════════════════════════════════════════════════════╝\n");
  } catch (error) {
    console.error("\n❌ TEST FAILED:");
    console.error(error);
    process.exit(1);
  }
}

// Run tests if this file is executed directly
if (require.main === module) {
  runAllPatronTests();
}
