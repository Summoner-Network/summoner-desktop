/**
 * End-to-end simulation of Fork: A Chronicle of Alternate Histories
 * Runs a complete game to demonstrate agent behavior and narrative generation
 */

import { initializeGame } from "../src/engine/setup";
import { runGame } from "../src/engine/turn-loop";
import type { GameConfig } from "../src/types/game-state";

// Configure the simulation
const config: GameConfig = {
  epochId: "1914_brink",
  factionCount: 4,
  players: [],
  eventPackIds: ["base"],
  seed: "fork-test-001"
};

console.log("╔════════════════════════════════════════════════════════════════╗");
console.log("║  Fork: A Chronicle of Alternate Histories - Full Simulation   ║");
console.log("╚════════════════════════════════════════════════════════════════╝");
console.log();
console.log("Configuration:");
console.log(`  Epoch: ${config.epochId}`);
console.log(`  Factions: ${config.factionCount}`);
console.log(`  Seed: ${config.seed}`);
console.log(`  Duration: 5 eras (25 turns) or until win condition`);
console.log();

// Run the simulation (wrap in async IIFE)
(async () => {
// Initialize game
const initialState = await initializeGame(config);

console.log("════════════════════════════════════════════════════════════════");
console.log("  INITIAL STATE");
console.log("════════════════════════════════════════════════════════════════");
console.log();

// Display faction information
Object.values(initialState.factions).forEach((faction) => {
  console.log(`${faction.name} [${faction.color}]`);
  console.log(`  Territories: ${faction.territories.length} (${faction.territories.join(", ")})`);
  console.log(`  Reputation: ${faction.reputation}`);
  console.log(`  Agents:`);
  faction.agents.forEach((agent) => {
    console.log(`    - ${agent.name} (${agent.archetype})`);
    console.log(
      `      Personality: aggression=${agent.personality.aggression.toFixed(
        2
      )}, loyalty=${agent.personality.loyalty.toFixed(
        2
      )}, risk=${agent.personality.riskTolerance.toFixed(
        2
      )}, expansion=${agent.personality.expansionism.toFixed(2)}`
    );
  });
  console.log();
});

console.log("════════════════════════════════════════════════════════════════");
console.log("  SIMULATION START");
console.log("════════════════════════════════════════════════════════════════");
console.log();

// Run the game
async function runSimulation() {
  // Calculate target turns (5 eras = 25 turns)
  const targetEras = 5;
  const turnsPerEra = 5;
  const maxTurns = targetEras * turnsPerEra;

  const finalState = await runGame(initialState, maxTurns);

  console.log();
  console.log("════════════════════════════════════════════════════════════════");
  console.log("  FINAL STATE");
  console.log("════════════════════════════════════════════════════════════════");
  console.log();

  console.log(`Total Turns: ${finalState.currentTurn - 1}`);
  console.log(`Total Eras: ${finalState.currentEra - 1}`);
  console.log(`Winner: ${finalState.winner ? finalState.factions[finalState.winner].name : "None"}`);
  console.log();

  // Display final faction standings
  console.log("FINAL FACTION STANDINGS:");
  console.log();

  const factionStandings = Object.values(finalState.factions)
    .map((faction) => ({
      name: faction.name,
      territories: faction.territories.length,
      reputation: faction.reputation,
      alliances: faction.stats.alliances.length,
      betrayals: faction.stats.betrayalsCommitted
    }))
    .sort((a, b) => b.territories - a.territories);

  factionStandings.forEach((faction, index) => {
    console.log(`${index + 1}. ${faction.name}`);
    console.log(`   Territories: ${faction.territories}`);
    console.log(`   Reputation: ${faction.reputation}`);
    console.log(`   Active Alliances: ${faction.alliances}`);
    console.log(`   Betrayals: ${faction.betrayals}`);
    console.log();
  });

  // Display alliance summary
  console.log("ALLIANCES:");
  console.log();

  const activeAlliances = finalState.alliances.filter((a) => a.status === "active");
  const brokenAlliances = finalState.alliances.filter((a) => a.status === "broken");

  if (activeAlliances.length > 0) {
    console.log("Active:");
    activeAlliances.forEach((alliance) => {
      const factionNames = alliance.factionIds.map((id) => finalState.factions[id].name);
      const termTypes = alliance.terms.map((t) => t.type).join(", ");
      console.log(
        `  - ${factionNames.join(" & ")}: ${termTypes} (trust: ${alliance.trustScore}%)`
      );
    });
    console.log();
  }

  if (brokenAlliances.length > 0) {
    console.log("Broken:");
    brokenAlliances.forEach((alliance) => {
      const factionNames = alliance.factionIds.map((id) => finalState.factions[id].name);
      console.log(`  - ${factionNames.join(" & ")}`);
    });
    console.log();
  }

  // Display notable events from history
  console.log("NOTABLE EVENTS:");
  console.log();

  // Extract territory changes
  const territoryChanges = finalState.history
    .flatMap((record) => record.events)
    .filter((event) => event.includes("conquered") || event.includes("defended"));

  if (territoryChanges.length > 0) {
    console.log("Territory Changes:");
    territoryChanges.slice(0, 10).forEach((event) => console.log(`  ${event}`));
    if (territoryChanges.length > 10) {
      console.log(`  ... and ${territoryChanges.length - 10} more`);
    }
    console.log();
  }

  // Extract alliance formations
  const allianceFormations = finalState.history
    .flatMap((record) => record.events)
    .filter((event) => event.includes("🤝") || event.includes("formed an alliance"));

  if (allianceFormations.length > 0) {
    console.log("Alliance Formations:");
    allianceFormations.forEach((event) => console.log(`  ${event}`));
    console.log();
  }

  // Extract betrayals
  const betrayals = finalState.history
    .flatMap((record) => record.events)
    .filter((event) => event.includes("💔") || event.includes("broke alliance"));

  if (betrayals.length > 0) {
    console.log("Alliance Betrayals:");
    betrayals.forEach((event) => console.log(`  ${event}`));
    console.log();
  }

  console.log("════════════════════════════════════════════════════════════════");
  console.log("  SIMULATION COMPLETE");
  console.log("════════════════════════════════════════════════════════════════");
}

// Continue with simulation
await runSimulation();
})().catch((error) => {
  console.error("Simulation failed:", error);
  process.exit(1);
});
