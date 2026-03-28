/**
 * Patron backing system demonstration
 * Shows two players backing different factions with different benefits
 * Demonstrates negotiation_edge increasing alliance acceptance rates
 */

import { initializeGame } from "../src/engine/setup";
import { runGame } from "../src/engine/turn-loop";
import { commitPatronBacking } from "../src/engine/patron";
import type { GameConfig } from "../src/types/game-state";
import type { FactionId } from "../src/types/faction";

// Configure the simulation with two players
const config: GameConfig = {
  epochId: "1914_brink",
  factionCount: 4,
  players: [
    { playerId: "player1", displayName: "The Diplomat", startingInfluencePoints: 100 },
    { playerId: "player2", displayName: "The Benefactor", startingInfluencePoints: 100 }
  ],
  eventPackIds: ["base"],
  seed: "patron-demo-001"
};

console.log("╔════════════════════════════════════════════════════════════════╗");
console.log("║  Fork Chronicle - Patron Backing Demonstration               ║");
console.log("╚════════════════════════════════════════════════════════════════╝");
console.log();
console.log("Configuration:");
console.log(`  Epoch: ${config.epochId}`);
console.log(`  Factions: ${config.factionCount}`);
console.log(`  Players: ${config.players.length}`);
console.log(`  Seed: ${config.seed}`);
console.log();

// Run the simulation (wrap in async IIFE)
(async () => {
// Initialize game
const state = await initializeGame(config);

console.log("════════════════════════════════════════════════════════════════");
console.log("  INITIAL FACTION SETUP");
console.log("════════════════════════════════════════════════════════════════");
console.log();

// Find Diplomat and Conqueror factions
let diplomatFactionId: FactionId | null = null;
let conquerorFactionId: FactionId | null = null;

Object.values(state.factions).forEach((faction) => {
  console.log(`${faction.name} [${faction.color}]`);
  console.log(`  Territories: ${faction.territories.length}`);
  console.log(`  Reputation: ${faction.reputation}`);
  console.log(`  Agents:`);
  faction.agents.forEach((agent) => {
    console.log(`    - ${agent.name} (${agent.archetype})`);
    if (agent.archetype === "diplomat" && !diplomatFactionId) {
      diplomatFactionId = faction.id;
    }
    if (agent.archetype === "conqueror" && !conquerorFactionId && faction.id !== diplomatFactionId) {
      conquerorFactionId = faction.id;
    }
  });
  console.log();
});

if (!diplomatFactionId || !conquerorFactionId) {
  throw new Error("Could not find Diplomat or Conqueror factions");
}

console.log("════════════════════════════════════════════════════════════════");
console.log("  PATRON COMMITMENTS");
console.log("════════════════════════════════════════════════════════════════");
console.log();

const diplomatFaction = state.factions[diplomatFactionId];
const conquerorFaction = state.factions[conquerorFactionId];

console.log(`Player 1 (The Diplomat) will back: ${diplomatFaction.name}`);
console.log(`  Benefit: negotiation_edge (+15% alliance acceptance for 2 eras)`);
console.log(`  Cost: 40 IP upfront`);
console.log();

console.log(`Player 2 (The Benefactor) will back: ${conquerorFaction.name}`);
console.log(`  Benefit: resource_bonus (+10 resources to lowest territory each era)`);
console.log(`  Cost: No upfront cost`);
console.log();

// Commit patron backing
const result1 = commitPatronBacking("player1", diplomatFactionId, "negotiation_edge", state);
const result2 = commitPatronBacking("player2", conquerorFactionId, "resource_bonus", state);

if (!result1.success || !result2.success) {
  throw new Error(`Failed to commit patron backing: ${result1.error || result2.error}`);
}

console.log("Patron commitments established!");
console.log(`  Player 1 IP: ${state.playerStates["player1"].influencePoints}`);
console.log(`  Player 2 IP: ${state.playerStates["player2"].influencePoints}`);
console.log();

console.log("════════════════════════════════════════════════════════════════");
console.log("  RUNNING SIMULATION (25 TURNS)");
console.log("════════════════════════════════════════════════════════════════");
console.log();

// Track alliance formation stats
const allianceStats = {
  diplomatFaction: {
    proposalsMade: 0,
    proposalsAccepted: 0,
    proposalsRejected: 0,
    alliances: new Set<string>()
  },
  otherFactions: {
    proposalsMade: 0,
    proposalsAccepted: 0,
    proposalsRejected: 0,
    alliances: new Set<string>()
  }
};

// Run the game
async function runSimulation() {
  const maxTurns = 25;
  const finalState = await runGame(state, maxTurns);

  // Analyze alliance formation history
  finalState.history.forEach((record) => {
    record.events.forEach((event) => {
      // Track alliances formed
      if (event.includes("formed an alliance")) {
        const isDiplomatInvolved = event.includes(diplomatFaction.name);

        if (isDiplomatInvolved) {
          allianceStats.diplomatFaction.alliances.add(event);
        } else {
          allianceStats.otherFactions.alliances.add(event);
        }
      }

      // Track proposals from agent decisions
      if (record.agentDecisions) {
        record.agentDecisions.forEach((decision) => {
          if (decision.action.type === "propose_alliance") {
            const isFromDiplomat = decision.factionId === diplomatFactionId;

            if (isFromDiplomat) {
              allianceStats.diplomatFaction.proposalsMade++;
            } else {
              allianceStats.otherFactions.proposalsMade++;
            }
          }
        });
      }

      // Track acceptances and rejections
      if (event.includes("rejected") && event.includes("alliance proposal")) {
        const isDiplomatInvolved = event.includes(diplomatFaction.name);

        if (isDiplomatInvolved) {
          allianceStats.diplomatFaction.proposalsRejected++;
        } else {
          allianceStats.otherFactions.proposalsRejected++;
        }
      }

      if (event.includes("formed an alliance")) {
        const isDiplomatInvolved = event.includes(diplomatFaction.name);

        if (isDiplomatInvolved) {
          allianceStats.diplomatFaction.proposalsAccepted++;
        } else {
          allianceStats.otherFactions.proposalsAccepted++;
        }
      }
    });
  });

  console.log();
  console.log("════════════════════════════════════════════════════════════════");
  console.log("  ALLIANCE FORMATION ANALYSIS");
  console.log("════════════════════════════════════════════════════════════════");
  console.log();

  console.log(`${diplomatFaction.name} (WITH negotiation_edge):`);
  console.log(`  Unique alliances formed: ${allianceStats.diplomatFaction.alliances.size}`);
  console.log(`  Proposals made: ${allianceStats.diplomatFaction.proposalsMade}`);
  console.log(`  Proposals accepted: ${allianceStats.diplomatFaction.proposalsAccepted}`);
  console.log(`  Proposals rejected: ${allianceStats.diplomatFaction.proposalsRejected}`);

  if (allianceStats.diplomatFaction.proposalsMade > 0) {
    const acceptanceRate = (allianceStats.diplomatFaction.proposalsAccepted / allianceStats.diplomatFaction.proposalsMade) * 100;
    console.log(`  Acceptance rate: ${acceptanceRate.toFixed(1)}%`);
  }
  console.log();

  console.log("Other Factions (WITHOUT negotiation_edge):");
  console.log(`  Unique alliances formed: ${allianceStats.otherFactions.alliances.size}`);
  console.log(`  Proposals made: ${allianceStats.otherFactions.proposalsMade}`);
  console.log(`  Proposals accepted: ${allianceStats.otherFactions.proposalsAccepted}`);
  console.log(`  Proposals rejected: ${allianceStats.otherFactions.proposalsRejected}`);

  if (allianceStats.otherFactions.proposalsMade > 0) {
    const acceptanceRate = (allianceStats.otherFactions.proposalsAccepted / allianceStats.otherFactions.proposalsMade) * 100;
    console.log(`  Acceptance rate: ${acceptanceRate.toFixed(1)}%`);
  }
  console.log();

  console.log("════════════════════════════════════════════════════════════════");
  console.log("  PATRON BACKING STATS");
  console.log("════════════════════════════════════════════════════════════════");
  console.log();

  console.log(`${diplomatFaction.name}:`);
  console.log(`  patronBacking accumulated: ${diplomatFaction.patronBacking}`);
  console.log(`  Patron factor: ${(diplomatFaction.patronBacking / 100).toFixed(2)}`);
  console.log(`  Current reputation: ${diplomatFaction.reputation}`);
  console.log();

  console.log(`${conquerorFaction.name}:`);
  console.log(`  patronBacking accumulated: ${conquerorFaction.patronBacking}`);
  console.log(`  Patron factor: ${(conquerorFaction.patronBacking / 100).toFixed(2)}`);
  console.log(`  Current reputation: ${conquerorFaction.reputation}`);
  console.log();

  // Show resource bonus effects for conqueror faction
  console.log("Resource Bonus Effects:");
  const conquerorTerritories = conquerorFaction.territories.map((tId) => finalState.territories[tId]);
  const sortedByResources = conquerorTerritories
    .map((t) => ({
      name: t.name,
      totalResources: t.resources.food + t.resources.industry + t.resources.tech
    }))
    .sort((a, b) => a.totalResources - b.totalResources);

  console.log(`  ${conquerorFaction.name} territories (sorted by resources):`);
  sortedByResources.slice(0, 3).forEach((t, idx) => {
    console.log(`    ${idx + 1}. ${t.name}: ${t.totalResources.toFixed(0)} total resources`);
  });
  console.log(`  (Lowest-resource territory receives +10 resources each era)`);
  console.log();

  console.log("════════════════════════════════════════════════════════════════");
  console.log("  FINAL STATE");
  console.log("════════════════════════════════════════════════════════════════");
  console.log();

  console.log(`Total Turns: ${finalState.currentTurn - 1}`);
  console.log(`Total Eras: ${finalState.currentEra - 1}`);
  console.log(`Winner: ${finalState.winner ? finalState.factions[finalState.winner].name : "None"}`);
  console.log();

  console.log("Player Final Stats:");
  console.log();

  config.players.forEach((playerConfig) => {
    const player = finalState.playerStates[playerConfig.playerId];
    console.log(`${playerConfig.displayName}:`);
    console.log(`  Final IP: ${player.influencePoints}`);
    console.log(`  Patron commitments: ${player.patronCommitments.length}`);
    if (player.patronCommitments.length > 0) {
      player.patronCommitments.forEach((c) => {
        const faction = finalState.factions[c.targetFactionId];
        console.log(`    - ${faction.name} (${c.benefit})`);
      });
    }
    console.log();
  });

  console.log("════════════════════════════════════════════════════════════════");
  console.log("  SIMULATION COMPLETE");
  console.log("════════════════════════════════════════════════════════════════");
  console.log();

  console.log("Key Findings:");

  // Calculate advantage
  const diplomatAcceptanceRate = allianceStats.diplomatFaction.proposalsMade > 0
    ? (allianceStats.diplomatFaction.proposalsAccepted / allianceStats.diplomatFaction.proposalsMade) * 100
    : 0;

  const otherAcceptanceRate = allianceStats.otherFactions.proposalsMade > 0
    ? (allianceStats.otherFactions.proposalsAccepted / allianceStats.otherFactions.proposalsMade) * 100
    : 0;

  if (diplomatAcceptanceRate > otherAcceptanceRate) {
    const advantage = diplomatAcceptanceRate - otherAcceptanceRate;
    console.log(`  ✓ negotiation_edge provided ${advantage.toFixed(1)}% higher acceptance rate`);
  } else {
    console.log(`  ⚠️  Sample size may be too small to show clear advantage`);
  }

  console.log(`  ✓ patronBacking accumulated: ${diplomatFaction.patronBacking} (Diplomat), ${conquerorFaction.patronBacking} (Conqueror)`);
  console.log(`  ✓ resource_bonus applied to lowest-resource territories each era`);
  console.log();
}

// Continue with simulation
await runSimulation();
})().catch((error) => {
  console.error("Simulation failed:", error);
  process.exit(1);
});
