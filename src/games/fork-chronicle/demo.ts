/**
 * Demo runner for Fork: A Chronicle of Alternate Histories
 * Shows the game running with the current implementation
 *
 * Execute with: npx tsx src/games/fork-chronicle/demo.ts
 */

import { initializeGame } from "./src/engine/setup";
import { runGame } from "./src/engine/turn-loop";
import type { GameConfig } from "./src/types/game-state";

// Create a demo game
const config: GameConfig = {
  epochId: "1914_brink",
  factionCount: 4,
  players: [
    { playerId: "player1", displayName: "Director Alpha", startingInfluencePoints: 100 },
    { playerId: "player2", displayName: "Director Beta", startingInfluencePoints: 100 }
  ],
  eventPackIds: ["base"],
  seed: "demo_game_1914"
};

console.log("\n╔══════════════════════════════════════════════════════════╗");
console.log("║  Fork: A Chronicle of Alternate Histories - Demo        ║");
console.log("╚══════════════════════════════════════════════════════════╝\n");

console.log("Initializing game...\n");
const initialState = initializeGame(config);

console.log("Game initialized successfully!");
console.log(`  Game ID: ${initialState.gameId}`);
console.log(`  Seed: ${initialState.seed}`);
console.log(`  Epoch: ${initialState.epoch.name} (${initialState.epoch.year})`);
console.log(`  Factions: ${Object.keys(initialState.factions).length}`);
console.log(`  Players: ${Object.keys(initialState.playerStates).length}`);
console.log(`  Territories: ${Object.keys(initialState.territories).length}`);
console.log(`  Event deck: ${initialState.eventDeck.length} cards`);

// Show faction starting positions
console.log("\nFaction starting positions:");
Object.values(initialState.factions).forEach((faction) => {
  console.log(`  ${faction.name} (${faction.color}):`);
  console.log(`    Territories: ${faction.territories.length}`);
  console.log(`    Agents: ${faction.agents.length}`);
  console.log(`    Resources: Food ${faction.resources.food}, Industry ${faction.resources.industry}, Tech ${faction.resources.tech}`);
});

console.log("\n" + "─".repeat(60));
console.log("Starting game simulation (limited to 10 turns)...");
console.log("─".repeat(60));

// Run the game for 10 turns
const finalState = runGame(initialState, 10);

console.log("\n" + "═".repeat(60));
console.log("Game simulation complete!");
console.log("═".repeat(60));
console.log(`  Final turn: ${finalState.currentTurn - 1}`);
console.log(`  Final era: ${finalState.currentEra}`);
console.log(`  History entries: ${finalState.history.length}`);
console.log(`  Event deck remaining: ${finalState.eventDeck.length} cards`);
console.log(`  Events in discard: ${finalState.eventDiscard.length}`);

// Show final faction standings
console.log("\nFinal faction standings:");
Object.values(finalState.factions).forEach((faction) => {
  console.log(`  ${faction.name}:`);
  console.log(`    Territories: ${faction.territories.length}`);
  console.log(`    Reputation: ${faction.reputation}`);
});

console.log("\n✓ Demo complete!\n");
console.log("Next steps:");
console.log("  • Step 4: Implement territory control & attack resolution");
console.log("  • Step 5: Implement win condition checks");
console.log("  • Step 6: Implement agent deliberation logic");
console.log("  • Step 7: Implement alliance negotiation");
console.log("\n");
