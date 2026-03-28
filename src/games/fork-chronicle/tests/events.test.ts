/**
 * Test suite for event injection system
 * Tests: playEventCard, applyEventEffects, ripple effects, card expiry
 */

import { initializeGame } from "../src/engine/setup";
import {
  playEventCard,
  applyEventEffects,
  queueRippleEffects,
  processRippleEffects,
  expireUnplayedCards
} from "../src/engine/events";
import type { GameConfig } from "../src/types/game-state";
import type { HistoricalEvent } from "../src/types/event";

/**
 * Test 1: Player can play event card with sufficient IP
 */
async function testPlayEventCardSuccess() {
  console.log("\n[TEST 1] Play event card successfully");

  const config: GameConfig = {
    epochId: "1914_brink",
    factionCount: 4,
    players: [{ playerId: "player1", displayName: "Test Player", startingInfluencePoints: 100 }],
    eventPackIds: ["base"],
    seed: "event-test-001"
  };

  const state = await initializeGame(config);

  // Manually give player a Tier 1 event card
  const tier1Event: HistoricalEvent = {
    id: "test_event_tier1",
    title: "Test Tier 1 Event",
    description: "A local test event",
    era: null,
    source: "historical",
    tier: 1,
    ipCost: 10,
    effects: [
      {
        type: "strength_delta",
        targetType: "territory",
        targetId: "USA",
        magnitude: 15,
        description: "USA gains strength"
      }
    ],
    rippleEffects: [],
    probability: 1.0
  };

  state.playerStates["player1"].currentDrawnCard = tier1Event;

  // Advance to turn 2 (cannot play on turn 1)
  state.currentTurn = 2;

  const initialIP = state.playerStates["player1"].influencePoints;
  const initialStrength = state.territories["USA"].strength;

  const result = playEventCard("player1", state);

  if (!result.success) {
    throw new Error(`Failed to play event card: ${result.error}`);
  }

  // Verify IP was deducted
  const finalIP = state.playerStates["player1"].influencePoints;
  if (finalIP !== initialIP - 10) {
    throw new Error(`Expected IP to be ${initialIP - 10}, got ${finalIP}`);
  }

  // Verify effect was applied
  const finalStrength = state.territories["USA"].strength;
  if (finalStrength !== initialStrength + 15) {
    throw new Error(`Expected USA strength to be ${initialStrength + 15}, got ${finalStrength}`);
  }

  // Verify card was discarded
  if (state.playerStates["player1"].currentDrawnCard !== null) {
    throw new Error("Card should be discarded after play");
  }

  console.log("✅ Event card played successfully, IP deducted, effects applied");
}

/**
 * Test 2: Cannot play event card on Turn 1
 */
async function testCannotPlayOnTurn1() {
  console.log("\n[TEST 2] Cannot play event card on Turn 1");

  const config: GameConfig = {
    epochId: "1914_brink",
    factionCount: 4,
    players: [{ playerId: "player1", displayName: "Test Player", startingInfluencePoints: 100 }],
    eventPackIds: ["base"],
    seed: "event-test-002"
  };

  const state = await initializeGame(config);

  // Give player an event card
  const event: HistoricalEvent = {
    id: "test_turn1",
    title: "Turn 1 Test",
    description: "Should not be playable",
    era: null,
    source: "historical",
    tier: 1,
    ipCost: 10,
    effects: [],
    rippleEffects: [],
    probability: 1.0
  };

  state.playerStates["player1"].currentDrawnCard = event;

  // Try to play on turn 1
  state.currentTurn = 1;

  const result = playEventCard("player1", state);

  if (result.success) {
    throw new Error("Should not be able to play event card on Turn 1");
  }

  if (!result.error || !result.error.includes("Turn 1")) {
    throw new Error(`Expected Turn 1 error, got: ${result.error}`);
  }

  console.log("✅ Event card blocked on Turn 1");
}

/**
 * Test 3: Cannot play event card with insufficient IP
 */
async function testInsufficientIP() {
  console.log("\n[TEST 3] Cannot play event with insufficient IP");

  const config: GameConfig = {
    epochId: "1914_brink",
    factionCount: 4,
    players: [{ playerId: "player1", displayName: "Test Player", startingInfluencePoints: 5 }],
    eventPackIds: ["base"],
    seed: "event-test-003"
  };

  const state = await initializeGame(config);

  // Give player a Tier 3 event (50 IP cost)
  const tier3Event: HistoricalEvent = {
    id: "test_expensive",
    title: "Expensive Event",
    description: "Costs 50 IP",
    era: null,
    source: "historical",
    tier: 3,
    ipCost: 50,
    effects: [],
    rippleEffects: [],
    probability: 1.0
  };

  state.playerStates["player1"].currentDrawnCard = tier3Event;
  state.currentTurn = 2;

  const result = playEventCard("player1", state);

  if (result.success) {
    throw new Error("Should not be able to play event with insufficient IP");
  }

  if (!result.error || !result.error.includes("Insufficient")) {
    throw new Error(`Expected insufficient IP error, got: ${result.error}`);
  }

  console.log("✅ Event card blocked with insufficient IP");
}

/**
 * Test 4: Global event effects apply to all territories
 */
async function testGlobalEffects() {
  console.log("\n[TEST 4] Global effects apply to all territories");

  const config: GameConfig = {
    epochId: "1914_brink",
    factionCount: 4,
    players: [],
    eventPackIds: ["base"],
    seed: "event-test-004"
  };

  const state = await initializeGame(config);

  const globalEvent: HistoricalEvent = {
    id: "test_global",
    title: "Global Test Event",
    description: "Affects all territories",
    era: null,
    source: "historical",
    tier: 3,
    ipCost: 50,
    effects: [
      {
        type: "strength_delta",
        targetType: "global",
        targetId: undefined,
        magnitude: 10,
        description: "Global strength boost"
      }
    ],
    rippleEffects: [],
    probability: 1.0
  };

  // Record initial strengths
  const initialStrengths: Record<string, number> = {};
  Object.keys(state.territories).forEach((tId) => {
    initialStrengths[tId] = state.territories[tId].strength;
  });

  // Apply event
  applyEventEffects(globalEvent, state);

  // Verify all territories received +10 strength
  Object.keys(state.territories).forEach((tId) => {
    const expected = initialStrengths[tId] + 10;
    const actual = state.territories[tId].strength;
    if (actual !== expected) {
      throw new Error(`Territory ${tId}: expected ${expected} strength, got ${actual}`);
    }
  });

  console.log("✅ Global effect applied to all territories");
}

/**
 * Test 5: Ripple effects queue correctly
 */
async function testRippleEffectsQueue() {
  console.log("\n[TEST 5] Ripple effects queue for next era");

  const config: GameConfig = {
    epochId: "1914_brink",
    factionCount: 4,
    players: [],
    eventPackIds: ["base"],
    seed: "event-test-005"
  };

  const state = await initializeGame(config);

  const eventWithRipple: HistoricalEvent = {
    id: "test_ripple",
    title: "Ripple Test Event",
    description: "Has delayed effects",
    era: null,
    source: "historical",
    tier: 2,
    ipCost: 25,
    effects: [],
    rippleEffects: [
      {
        type: "resource_delta",
        targetType: "global",
        targetId: undefined,
        magnitude: 20,
        description: "Delayed resource boost"
      }
    ],
    probability: 1.0
  };

  // Set current turn to 3 (era 1, mid-era)
  state.currentTurn = 3;
  state.currentEra = 1;

  // Queue ripple effects
  const results = queueRippleEffects(eventWithRipple, state);

  if (results.length === 0) {
    throw new Error("Ripple effects should produce results");
  }

  // Verify ripple was queued
  if (state.activeEvents.length === 0) {
    throw new Error("Ripple effect should be in activeEvents");
  }

  const activeEvent = state.activeEvents[0];
  if (activeEvent.event.effects.length !== 1) {
    throw new Error("Ripple event should have 1 effect");
  }

  // Ripple should fire at turn 6 (next era start: ceil(4/5)*5 + 1 = 6)
  const expectedTurn = 6;
  if (activeEvent.expiresOnTurn !== expectedTurn) {
    throw new Error(`Ripple should expire at turn ${expectedTurn}, got ${activeEvent.expiresOnTurn}`);
  }

  console.log("✅ Ripple effects queued correctly");
}

/**
 * Test 6: Ripple effects process at era start
 */
async function testRippleEffectsProcess() {
  console.log("\n[TEST 6] Ripple effects process at era start");

  const config: GameConfig = {
    epochId: "1914_brink",
    factionCount: 4,
    players: [],
    eventPackIds: ["base"],
    seed: "event-test-006"
  };

  const state = await initializeGame(config);

  // Manually add a ripple effect ready to fire
  const rippleEvent: HistoricalEvent = {
    id: "test_ripple_fire",
    title: "Ripple Fire Test",
    description: "Ready to fire",
    era: null,
    source: "historical",
    tier: 2,
    ipCost: 25,
    effects: [
      {
        type: "resource_delta",
        targetType: "territory",
        targetId: "USA",
        magnitude: 30,
        description: "USA resource boost"
      }
    ],
    rippleEffects: [],
    probability: 1.0
  };

  state.currentTurn = 6; // Era 2 start
  state.activeEvents.push({
    event: rippleEvent,
    activatedOnTurn: 3,
    expiresOnTurn: 6
  });

  const initialFood = state.territories["USA"].resources.food;

  // Process ripple effects
  const results = processRippleEffects(state);

  if (results.length === 0) {
    throw new Error("Should have ripple effects to process");
  }

  // Verify effect was applied
  const finalFood = state.territories["USA"].resources.food;
  if (finalFood !== initialFood + 30) {
    throw new Error(`Expected USA food to be ${initialFood + 30}, got ${finalFood}`);
  }

  // Verify ripple was removed from activeEvents
  if (state.activeEvents.length !== 0) {
    throw new Error("Ripple should be removed after processing");
  }

  console.log("✅ Ripple effects processed at era start");
}

/**
 * Test 7: Unplayed cards expire at era end
 */
async function testCardExpiry() {
  console.log("\n[TEST 7] Unplayed cards expire at era end");

  const config: GameConfig = {
    epochId: "1914_brink",
    factionCount: 4,
    players: [{ playerId: "player1", displayName: "Test Player", startingInfluencePoints: 100 }],
    eventPackIds: ["base"],
    seed: "event-test-007"
  };

  const state = await initializeGame(config);

  // Give player an unplayed card
  const unplayedCard: HistoricalEvent = {
    id: "test_unplayed",
    title: "Unplayed Card",
    description: "Will expire",
    era: null,
    source: "historical",
    tier: 1,
    ipCost: 10,
    effects: [],
    rippleEffects: [],
    probability: 1.0
  };

  state.playerStates["player1"].currentDrawnCard = unplayedCard;

  // Expire cards
  const results = expireUnplayedCards(state);

  if (results.length === 0) {
    throw new Error("Should report card expiry");
  }

  // Verify card was removed
  if (state.playerStates["player1"].currentDrawnCard !== null) {
    throw new Error("Card should be expired (set to null)");
  }

  // Verify card was moved to discard
  const discarded = state.eventDiscard.find((e) => e.id === "test_unplayed");
  if (!discarded) {
    throw new Error("Card should be in discard pile");
  }

  console.log("✅ Unplayed cards expire correctly");
}

/**
 * Test 8: Faction-targeted effects
 */
async function testFactionTargetedEffects() {
  console.log("\n[TEST 8] Faction-targeted effects apply to all faction territories");

  const config: GameConfig = {
    epochId: "1914_brink",
    factionCount: 4,
    players: [],
    eventPackIds: ["base"],
    seed: "event-test-008"
  };

  const state = await initializeGame(config);

  // Find a faction with multiple territories
  const faction = Object.values(state.factions).find((f) => f.territories.length > 1);
  if (!faction) {
    throw new Error("Need a faction with multiple territories for this test");
  }

  const factionEvent: HistoricalEvent = {
    id: "test_faction",
    title: "Faction Test Event",
    description: "Affects one faction",
    era: null,
    source: "historical",
    tier: 2,
    ipCost: 25,
    effects: [
      {
        type: "reputation_delta",
        targetType: "faction",
        targetId: faction.id,
        magnitude: 15,
        description: "Faction reputation boost"
      }
    ],
    rippleEffects: [],
    probability: 1.0
  };

  const initialReputation = faction.reputation;

  // Apply event
  applyEventEffects(factionEvent, state);

  // Verify faction reputation increased
  const finalReputation = state.factions[faction.id].reputation;
  if (finalReputation !== initialReputation + 15) {
    throw new Error(`Expected reputation ${initialReputation + 15}, got ${finalReputation}`);
  }

  console.log("✅ Faction-targeted effects work correctly");
}

/**
 * Run all event tests
 */
export async function runAllEventTests() {
  console.log("╔════════════════════════════════════════════════════════════════╗");
  console.log("║  Event Injection System - Test Suite                         ║");
  console.log("╚════════════════════════════════════════════════════════════════╝");

  try {
    await testPlayEventCardSuccess();
    await testCannotPlayOnTurn1();
    await testInsufficientIP();
    await testGlobalEffects();
    await testRippleEffectsQueue();
    await testRippleEffectsProcess();
    await testCardExpiry();
    await testFactionTargetedEffects();

    console.log("\n╔════════════════════════════════════════════════════════════════╗");
    console.log("║  ✅ ALL EVENT TESTS PASSED (8/8)                              ║");
    console.log("╚════════════════════════════════════════════════════════════════╝\n");
  } catch (error) {
    console.error("\n❌ TEST FAILED:");
    console.error(error);
    process.exit(1);
  }
}

// Run tests if this file is executed directly
if (require.main === module) {
  runAllEventTests();
}
