/**
 * Betting system demonstration simulation
 * Shows player bets and odds progression over 25 turns
 */

import { initializeGame } from "../src/engine/setup";
import { runGame } from "../src/engine/turn-loop";
import { placeBet } from "../src/engine/betting";
import type { GameConfig } from "../src/types/game-state";

// Configure the simulation with one player
const config: GameConfig = {
  epochId: "1914_brink",
  factionCount: 4,
  players: [
    { playerId: "player1", displayName: "The Gambler", startingInfluencePoints: 100 }
  ],
  eventPackIds: ["base"],
  seed: "fork-test-001"
};

console.log("╔════════════════════════════════════════════════════════════════╗");
console.log("║  Fork Chronicle - Betting System Demonstration               ║");
console.log("╚════════════════════════════════════════════════════════════════╝");
console.log();
console.log("Configuration:");
console.log(`  Epoch: ${config.epochId}`);
console.log(`  Factions: ${config.factionCount}`);
console.log(`  Players: ${config.players.length}`);
console.log(`  Seed: ${config.seed}`);
console.log();

// Initialize game
const initialState = initializeGame(config);

console.log("════════════════════════════════════════════════════════════════");
console.log("  INITIAL FACTION SETUP");
console.log("════════════════════════════════════════════════════════════════");
console.log();

// Find factions with Diplomat and Conqueror agents
let diplomatFactionId: string | null = null;
let conquerorFactionId: string | null = null;

Object.values(initialState.factions).forEach((faction) => {
  console.log(`${faction.name} [${faction.color}]`);
  console.log(`  Territories: ${faction.territories.length}`);
  console.log(`  Agents:`);
  faction.agents.forEach((agent) => {
    console.log(`    - ${agent.name} (${agent.archetype})`);
    if (agent.archetype === "diplomat" && !diplomatFactionId) {
      diplomatFactionId = faction.id;
    }
    if (agent.archetype === "conqueror" && !conquerorFactionId) {
      conquerorFactionId = faction.id;
    }
  });
  console.log();
});

if (!diplomatFactionId || !conquerorFactionId) {
  throw new Error("Could not find Diplomat or Conqueror factions");
}

console.log("════════════════════════════════════════════════════════════════");
console.log("  PLACING BETS AT TURN 1");
console.log("════════════════════════════════════════════════════════════════");
console.log();

// Get initial odds (before player_actions phase advances the game)
const { calculateOdds } = require("../src/engine/betting");
const turn1Odds = calculateOdds(initialState);

const diplomatOdds = turn1Odds.odds.faction_wins[diplomatFactionId];
const conquerorOdds = turn1Odds.odds.first_continent[conquerorFactionId];

console.log(`Diplomat Faction: ${initialState.factions[diplomatFactionId].name} (${diplomatFactionId})`);
console.log(`  faction_wins odds: ${diplomatOdds}x`);
console.log();
console.log(`Conqueror Faction: ${initialState.factions[conquerorFactionId].name} (${conquerorFactionId})`);
console.log(`  first_continent odds: ${conquerorOdds}x`);
console.log();

// Place bets
const bet1 = placeBet("player1", "faction_wins", diplomatFactionId, 20, initialState);
const bet2 = placeBet("player1", "first_continent", conquerorFactionId, 20, initialState);

if (!bet1.success || !bet2.success) {
  throw new Error(`Failed to place bets: ${bet1.error || bet2.error}`);
}

console.log("Bets Placed:");
console.log(`  1. faction_wins on ${initialState.factions[diplomatFactionId].name}: 20 IP @ ${diplomatOdds}x odds`);
console.log(`  2. first_continent on ${initialState.factions[conquerorFactionId].name}: 20 IP @ ${conquerorOdds}x odds`);
console.log();
console.log(`Player IP remaining: ${initialState.playerStates["player1"].influencePoints}`);
console.log();

console.log("════════════════════════════════════════════════════════════════");
console.log("  RUNNING SIMULATION");
console.log("════════════════════════════════════════════════════════════════");
console.log();

// Run the game
async function runSimulation() {
  const maxTurns = 25;
  const finalState = await runGame(initialState, maxTurns);

  console.log();
  console.log("════════════════════════════════════════════════════════════════");
  console.log("  ODDS PROGRESSION");
  console.log("════════════════════════════════════════════════════════════════");
  console.log();

  // Show odds at turns 1, 15, and 25
  const oddsAtTurns = [1, 15, 25];

  oddsAtTurns.forEach((turn) => {
    const oddsSnapshot = finalState.oddsHistory.find((o) => o.turn === turn);
    if (oddsSnapshot) {
      console.log(`Turn ${turn}:`);

      // Show all faction odds
      const factionOdds = Object.entries(oddsSnapshot.odds.faction_wins).map(([factionId, odds]) => ({
        factionId,
        name: finalState.factions[factionId as any].name,
        odds,
        territories: finalState.factions[factionId as any].territories.length
      })).sort((a, b) => a.odds - b.odds); // Sort by odds (lowest = favorite)

      factionOdds.forEach((faction) => {
        const marker = faction.factionId === diplomatFactionId ? " [BET]" :
                       faction.factionId === conquerorFactionId ? " [BET]" : "";
        console.log(`  ${faction.name}: ${faction.odds}x odds, ${faction.territories} territories${marker}`);
      });

      const lowestOdds = factionOdds[0].odds;
      const highestOdds = factionOdds[factionOdds.length - 1].odds;
      const spread = (highestOdds / lowestOdds).toFixed(1);
      console.log(`  → Odds spread: ${spread}x (${highestOdds}x / ${lowestOdds}x)`);
      console.log();
    }
  });

  console.log("════════════════════════════════════════════════════════════════");
  console.log("  FINAL STATE");
  console.log("════════════════════════════════════════════════════════════════");
  console.log();

  console.log(`Total Turns: ${finalState.currentTurn - 1}`);
  console.log(`Total Eras: ${finalState.currentEra - 1}`);
  console.log(`Winner: ${finalState.winner ? finalState.factions[finalState.winner].name : "None"}`);
  console.log();

  // Show final faction standings
  console.log("FINAL FACTION STANDINGS:");
  console.log();

  const factionStandings = Object.values(finalState.factions)
    .map((faction) => ({
      id: faction.id,
      name: faction.name,
      territories: faction.territories.length,
      reputation: faction.reputation
    }))
    .sort((a, b) => b.territories - a.territories);

  factionStandings.forEach((faction, index) => {
    console.log(`${index + 1}. ${faction.name}`);
    console.log(`   Territories: ${faction.territories}`);
    console.log(`   Reputation: ${faction.reputation}`);
    console.log();
  });

  // Show player bet results
  console.log("PLAYER BET RESULTS:");
  console.log();

  const player = finalState.playerStates["player1"];
  console.log(`Player: ${config.players[0].displayName}`);
  console.log(`Final Influence Points: ${player.influencePoints}`);
  console.log(`Open Bets: ${player.bets.length}`);
  console.log();

  if (player.bets.length > 0) {
    console.log("Active Bets:");
    player.bets.forEach((bet, index) => {
      console.log(`  ${index + 1}. ${bet.betType} on ${bet.targetId}: ${bet.stake} IP @ ${bet.odds}x (placed turn ${bet.placedOnTurn})`);
    });
    console.log();
  }

  // Calculate potential payout
  const bet1Payout = diplomatOdds * 20;
  const bet2Payout = conquerorOdds * 20;

  console.log("Potential Payouts:");
  console.log(`  Bet 1 (${diplomatFactionId} wins): ${bet1Payout.toFixed(1)} IP`);
  console.log(`  Bet 2 (${conquerorFactionId} first continent): ${bet2Payout.toFixed(1)} IP`);
  console.log();

  // Check continent control at turns 1, 10, and 25
  console.log("CONTINENT CONTROL DIAGNOSTIC:");
  console.log();

  const continents = new Set(Object.values(finalState.territories).map((t) => t.continent));
  const checkTurns = [1, 15, 25];

  checkTurns.forEach((turn) => {
    console.log(`Turn ${turn}:`);

    continents.forEach((continent) => {
      const continentTerritories = Object.values(finalState.territories).filter(
        (t) => t.continent === continent
      );
      const controllers = new Map<string, number>();
      continentTerritories.forEach((t) => {
        if (t.controlledBy) {
          controllers.set(t.controlledBy, (controllers.get(t.controlledBy) || 0) + 1);
        }
      });

      const totalInContinent = continentTerritories.length;
      const controlStatus: string[] = [];

      controllers.forEach((count, factionId) => {
        const percentage = ((count / totalInContinent) * 100).toFixed(0);
        controlStatus.push(`${finalState.factions[factionId].name}: ${count}/${totalInContinent} (${percentage}%)`);

        if (count === totalInContinent) {
          controlStatus.push("✓ FULLY CONTROLLED");
        }
      });

      console.log(`  ${continent}: ${controlStatus.join(", ")}`);
    });

    console.log();
  });

  console.log();
  console.log("════════════════════════════════════════════════════════════════");
  console.log("  SIMULATION COMPLETE");
  console.log("════════════════════════════════════════════════════════════════");
}

// Run the simulation
runSimulation().catch((error) => {
  console.error("Simulation failed:", error);
  process.exit(1);
});
