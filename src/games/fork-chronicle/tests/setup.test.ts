/**
 * Unit tests for game setup and initialization
 * Tests for Section 2: Game Setup
 */

import { initializeGame } from "../src/engine/setup";
import type { GameConfig } from "../src/types/game-state";
import { SeededRandom } from "../src/utils/random";

/**
 * Test: Basic game initialization
 */
export async function testBasicInitialization(): Promise<void> {
  const config: GameConfig = {
    epochId: "1914_brink",
    factionCount: 4,
    players: [
      { playerId: "player1", displayName: "Player 1", startingInfluencePoints: 100 }
    ],
    eventPackIds: ["base"],
    seed: "test_seed_123"
  };

  const gameState = await initializeGame(config);

  // Verify basic structure
  if (!gameState.gameId) throw new Error("Game ID not set");
  if (gameState.seed !== "test_seed_123") throw new Error("Seed mismatch");
  if (gameState.currentTurn !== 1) throw new Error("Should start at turn 1");
  if (gameState.currentEra !== 1) throw new Error("Should start at era 1");
  if (gameState.phase !== "player_actions") {
    throw new Error(`Phase should be player_actions, got ${gameState.phase}`);
  }

  // Verify factions created
  const factionCount = Object.keys(gameState.factions).length;
  if (factionCount !== 4) {
    throw new Error(`Expected 4 factions, got ${factionCount}`);
  }

  // Verify territories loaded
  const territoryCount = Object.keys(gameState.territories).length;
  if (territoryCount === 0) {
    throw new Error("No territories loaded");
  }

  // Verify event deck shuffled
  if (gameState.eventDeck.length === 0) {
    throw new Error("Event deck is empty");
  }

  // Verify player state initialized
  if (!gameState.playerStates["player1"]) {
    throw new Error("Player state not initialized");
  }

  if (gameState.playerStates["player1"].influencePoints !== 100) {
    throw new Error("Starting influence points incorrect");
  }

  console.log("✓ testBasicInitialization passed");
}

/**
 * Test: Seed reproducibility
 * Same seed should produce identical game state after 10 turns
 */
export async function testSeedReproducibility(): Promise<void> {
  const config: GameConfig = {
    epochId: "1914_brink",
    factionCount: 3,
    players: [
      { playerId: "player1", displayName: "Player 1", startingInfluencePoints: 100 }
    ],
    eventPackIds: ["base"],
    seed: "reproducibility_test_42"
  };

  const gameState1 = await initializeGame(config);
  const gameState2 = await initializeGame(config);

  // Verify faction territories match
  const faction1_game1 = gameState1.factions["faction_1"].territories.sort();
  const faction1_game2 = gameState2.factions["faction_1"].territories.sort();

  if (JSON.stringify(faction1_game1) !== JSON.stringify(faction1_game2)) {
    throw new Error("Faction territories differ between games with same seed");
  }

  // Verify event deck order matches
  if (gameState1.eventDeck.length !== gameState2.eventDeck.length) {
    throw new Error("Event deck length differs");
  }

  for (let i = 0; i < Math.min(5, gameState1.eventDeck.length); i++) {
    if (gameState1.eventDeck[i].id !== gameState2.eventDeck[i].id) {
      throw new Error(`Event deck mismatch at index ${i}`);
    }
  }

  // Verify agent personalities match
  const agent1_game1 = gameState1.factions["faction_1"].agents[0];
  const agent1_game2 = gameState2.factions["faction_1"].agents[0];

  if (
    Math.abs(agent1_game1.personality.aggression - agent1_game2.personality.aggression) > 0.001
  ) {
    throw new Error("Agent personalities differ between games with same seed");
  }

  console.log("✓ testSeedReproducibility passed");
}

/**
 * Test: Faction balance check
 * Verify that no faction starts with >60% advantage over another
 */
export async function testFactionBalance(): Promise<void> {
  const config: GameConfig = {
    epochId: "1914_brink",
    factionCount: 4,
    players: [
      { playerId: "player1", displayName: "Player 1", startingInfluencePoints: 100 }
    ],
    eventPackIds: ["base"],
    seed: "balance_test_789"
  };

  const gameState = await initializeGame(config);

  // Calculate advantages for all factions
  const calculateAdvantage = (factionId: string): number => {
    const faction = gameState.factions[factionId];
    const totalTerritories = Object.keys(gameState.territories).length;

    const territoryScore = faction.territories.length / totalTerritories;

    const globalStrength = Object.values(gameState.territories).reduce(
      (sum, t) => sum + t.strength,
      0
    );
    const factionStrength = faction.territories.reduce(
      (sum, tId) => sum + gameState.territories[tId].strength,
      0
    );
    const strengthScore = factionStrength / globalStrength;

    const globalResources = Object.values(gameState.territories).reduce(
      (sum, t) => sum + t.resources.food + t.resources.industry + t.resources.tech,
      0
    );
    const factionResources = faction.territories.reduce((sum, tId) => {
      const t = gameState.territories[tId];
      return sum + t.resources.food + t.resources.industry + t.resources.tech;
    }, 0);
    const resourceScore = factionResources / globalResources;

    return territoryScore * 0.5 + strengthScore * 0.3 + resourceScore * 0.2;
  };

  const factionIds = Object.keys(gameState.factions);
  const advantages = factionIds.map((id) => ({
    id,
    advantage: calculateAdvantage(id)
  }));

  // Check all pairs
  for (let i = 0; i < advantages.length; i++) {
    for (let j = 0; j < advantages.length; j++) {
      if (i !== j) {
        const ratio = advantages[i].advantage / advantages[j].advantage;
        if (ratio > 1.6) {
          throw new Error(
            `Faction ${advantages[i].id} has ${ratio.toFixed(2)}x advantage over ${
              advantages[j].id
            }, exceeds 60% limit`
          );
        }
      }
    }
  }

  console.log("✓ testFactionBalance passed");
}

/**
 * Test: Agent personality constraints
 * [RULE] Personality values are uniform random within 0.2–0.8 per trait
 */
export async function testAgentPersonalityConstraints(): Promise<void> {
  const config: GameConfig = {
    epochId: "1914_brink",
    factionCount: 4,
    players: [
      { playerId: "player1", displayName: "Player 1", startingInfluencePoints: 100 }
    ],
    eventPackIds: ["base"],
    seed: "personality_test_456"
  };

  const gameState = await initializeGame(config);

  // Check all agents
  Object.values(gameState.factions).forEach((faction) => {
    faction.agents.forEach((agent) => {
      const { aggression, loyalty, riskTolerance, expansionism } = agent.personality;

      if (aggression < 0.2 || aggression > 0.8) {
        throw new Error(`Agent ${agent.id} aggression out of range: ${aggression}`);
      }
      if (loyalty < 0.2 || loyalty > 0.8) {
        throw new Error(`Agent ${agent.id} loyalty out of range: ${loyalty}`);
      }
      if (riskTolerance < 0.2 || riskTolerance > 0.8) {
        throw new Error(`Agent ${agent.id} riskTolerance out of range: ${riskTolerance}`);
      }
      if (expansionism < 0.2 || expansionism > 0.8) {
        throw new Error(`Agent ${agent.id} expansionism out of range: ${expansionism}`);
      }
    });
  });

  console.log("✓ testAgentPersonalityConstraints passed");
}

/**
 * Test: Each faction has 2-4 agents
 */
export async function testFactionAgentCount(): Promise<void> {
  const config: GameConfig = {
    epochId: "1914_brink",
    factionCount: 4,
    players: [
      { playerId: "player1", displayName: "Player 1", startingInfluencePoints: 100 }
    ],
    eventPackIds: ["base"],
    seed: "agent_count_test"
  };

  const gameState = await initializeGame(config);

  Object.values(gameState.factions).forEach((faction) => {
    const agentCount = faction.agents.length;
    if (agentCount < 2 || agentCount > 4) {
      throw new Error(`Faction ${faction.id} has ${agentCount} agents, expected 2-4`);
    }
  });

  console.log("✓ testFactionAgentCount passed");
}

/**
 * Test: Player dealt event card from deck
 */
export async function testPlayerEventCardDealt(): Promise<void> {
  const config: GameConfig = {
    epochId: "1914_brink",
    factionCount: 2,
    players: [
      { playerId: "player1", displayName: "Player 1", startingInfluencePoints: 100 },
      { playerId: "player2", displayName: "Player 2", startingInfluencePoints: 100 }
    ],
    eventPackIds: ["base"],
    seed: "card_deal_test"
  };

  const gameState = await initializeGame(config);

  // Each player should have a drawn card
  if (!gameState.playerStates["player1"].currentDrawnCard) {
    throw new Error("Player 1 did not receive a card");
  }
  if (!gameState.playerStates["player2"].currentDrawnCard) {
    throw new Error("Player 2 did not receive a card");
  }

  // Cards should be different
  const card1 = gameState.playerStates["player1"].currentDrawnCard.id;
  const card2 = gameState.playerStates["player2"].currentDrawnCard.id;
  if (card1 === card2) {
    throw new Error("Players received the same card");
  }

  console.log("✓ testPlayerEventCardDealt passed");
}

/**
 * Test: Seeded RNG utility
 */
export function testSeededRandom(): void {
  const rng1 = new SeededRandom("test_seed");
  const rng2 = new SeededRandom("test_seed");

  const values1 = [rng1.next(), rng1.next(), rng1.next()];
  const values2 = [rng2.next(), rng2.next(), rng2.next()];

  for (let i = 0; i < values1.length; i++) {
    if (Math.abs(values1[i] - values2[i]) > 0.0001) {
      throw new Error(`RNG values differ at index ${i}: ${values1[i]} vs ${values2[i]}`);
    }
  }

  // Test shuffle reproducibility
  const arr1 = rng1.shuffle([1, 2, 3, 4, 5]);
  const rng3 = new SeededRandom("test_seed");
  rng3.next();
  rng3.next();
  rng3.next();
  const arr2 = rng3.shuffle([1, 2, 3, 4, 5]);

  if (JSON.stringify(arr1) !== JSON.stringify(arr2)) {
    throw new Error("Shuffle not reproducible");
  }

  console.log("✓ testSeededRandom passed");
}

/**
 * Run all tests
 */
export async function runAllTests(): Promise<void> {
  console.log("\n=== Running Fork Chronicle Setup Tests ===\n");

  try {
    testSeededRandom();
    await testBasicInitialization();
    await testSeedReproducibility();
    await testFactionBalance();
    await testAgentPersonalityConstraints();
    await testFactionAgentCount();
    await testPlayerEventCardDealt();

    console.log("\n✓ All tests passed!\n");
  } catch (error) {
    console.error("\n✗ Test failed:", error);
    throw error;
  }
}

// Export for use in other test files
export default {
  testBasicInitialization,
  testSeedReproducibility,
  testFactionBalance,
  testAgentPersonalityConstraints,
  testFactionAgentCount,
  testPlayerEventCardDealt,
  testSeededRandom,
  runAllTests
};
