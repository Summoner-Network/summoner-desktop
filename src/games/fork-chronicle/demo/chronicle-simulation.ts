/**
 * Full Chronicle Simulation for Fork: A Chronicle of Alternate Histories
 * Runs a complete game and exports the final Chronicle with narratives and player scores
 */

import { initializeGame } from "../src/engine/setup";
import { runGame } from "../src/engine/turn-loop";
import { exportChronicle } from "../src/engine/era-summary";
import type { GameConfig } from "../src/types/game-state";
import type { FactionId } from "../src/types/faction";

// Configure the simulation
const config: GameConfig = {
  epochId: "1914_brink",
  factionCount: 4,
  players: [
    { playerId: "player1", displayName: "The Observer", startingInfluencePoints: 100 }
  ],
  eventPackIds: ["base"],
  seed: "chronicle-demo-001"
};

console.log("╔════════════════════════════════════════════════════════════════╗");
console.log("║  Fork Chronicle - Complete Chronicle Export Demonstration     ║");
console.log("╚════════════════════════════════════════════════════════════════╝");
console.log();
console.log("Configuration:");
console.log(`  Epoch: ${config.epochId}`);
console.log(`  Factions: ${config.factionCount}`);
console.log(`  Players: ${config.players.length}`);
console.log(`  Seed: ${config.seed}`);
console.log(`  Duration: Run until victory or 100 turns`);
console.log();

// Run the simulation
async function runChronicleSimulation() {
  // Initialize game
  const state = await initializeGame(config);

  // Capture opening odds for player scoring
  const openingOdds: Record<FactionId, number> = {
    faction_1: 2.5,
    faction_2: 2.5,
    faction_3: 2.5,
    faction_4: 2.5
  };

  console.log("════════════════════════════════════════════════════════════════");
  console.log("  RUNNING SIMULATION");
  console.log("════════════════════════════════════════════════════════════════");
  console.log();

  // Run game to completion (up to 100 turns)
  const finalState = await runGame(state, 100);

  console.log();
  console.log("════════════════════════════════════════════════════════════════");
  console.log("  CHRONICLE EXPORT");
  console.log("════════════════════════════════════════════════════════════════");
  console.log();

  // Export the complete chronicle
  const chronicle = exportChronicle(finalState, finalState.eraCards, openingOdds);

  // Display game summary
  console.log(`📊 GAME SUMMARY`);
  console.log(`   Total Turns: ${chronicle.totalTurns}`);
  console.log(`   Total Eras: ${chronicle.totalEras}`);
  console.log(`   Winner: ${chronicle.winner ? finalState.factions[chronicle.winner].name : "None (game limit reached)"}`);
  console.log();

  // Display full narrative
  console.log("════════════════════════════════════════════════════════════════");
  console.log("  📖 COMPLETE CHRONICLE NARRATIVE");
  console.log("════════════════════════════════════════════════════════════════");
  console.log();
  console.log(chronicle.fullNarrative);
  console.log();

  // Display era cards summary
  console.log("════════════════════════════════════════════════════════════════");
  console.log("  📇 ERA CARDS SUMMARY");
  console.log("════════════════════════════════════════════════════════════════");
  console.log();

  chronicle.eraCards.forEach((card) => {
    console.log(`Era ${card.era} (Turns ${card.turns[0]}-${card.turns[1]}):`);
    console.log(`  Leader: ${finalState.factions[card.leaderFaction].name}`);
    console.log(`  Biggest Gain: ${finalState.factions[card.biggestGain.factionId].name} (+${card.biggestGain.territoriesGained} territories)`);
    if (card.biggestLoss.territoriesLost > 0) {
      console.log(`  Biggest Loss: ${finalState.factions[card.biggestLoss.factionId].name} (-${card.biggestLoss.territoriesLost} territories)`);
    }
    console.log(`  Alliances Formed: ${card.alliancesFormed}`);
    console.log(`  Alliances Broken: ${card.alliancesBroken}`);
    console.log(`  Events Injected: ${card.eventsInjected}`);
    if (card.mvpAgent.agentId) {
      console.log(`  MVP Agent: ${card.mvpAgent.agentId} (${card.mvpAgent.reason})`);
    }
    console.log();
  });

  // Display player scores
  if (chronicle.playerScores.length > 0) {
    console.log("════════════════════════════════════════════════════════════════");
    console.log("  🏆 PLAYER SCORES & DIRECTOR TITLES");
    console.log("════════════════════════════════════════════════════════════════");
    console.log();

    chronicle.playerScores.forEach((score) => {
      const player = config.players.find((p) => p.playerId === score.playerId);
      console.log(`${player?.displayName || score.playerId}:`);
      console.log(`  Director Title: "${score.directorTitle}"`);
      console.log(`  Total Score: ${score.totalScore}`);
      console.log(`  Influence Points: ${score.influencePointsEarned}`);
      console.log(`  Bets Won: ${score.betsWon} / Lost: ${score.betsLost}`);
      console.log(`  Net Betting Return: ${score.netBettingReturn.toFixed(1)} IP`);
      console.log(`  Patron Effectiveness: ${score.patronEffectiveness.toFixed(1)}%`);
      console.log(`  Events Injected: ${score.eventsInjected}`);
      console.log(`  Tier 3 Events Played: ${score.tier3EventsPlayed}`);
      console.log();
    });
  }

  // Display final faction standings
  console.log("════════════════════════════════════════════════════════════════");
  console.log("  🎯 FINAL FACTION STANDINGS");
  console.log("════════════════════════════════════════════════════════════════");
  console.log();

  const factionStandings = Object.values(finalState.factions)
    .map((faction) => ({
      id: faction.id,
      name: faction.name,
      territories: faction.territories.length,
      reputation: faction.reputation,
      patronBacking: faction.patronBacking
    }))
    .sort((a, b) => b.territories - a.territories);

  factionStandings.forEach((faction, index) => {
    const medal = index === 0 ? "🥇" : index === 1 ? "🥈" : index === 2 ? "🥉" : "  ";
    console.log(`${medal} ${index + 1}. ${faction.name}`);
    console.log(`     Territories: ${faction.territories}`);
    console.log(`     Reputation: ${faction.reputation}`);
    console.log(`     Patron Backing: ${faction.patronBacking}`);
    console.log();
  });

  console.log("════════════════════════════════════════════════════════════════");
  console.log("  ✅ CHRONICLE EXPORT COMPLETE");
  console.log("════════════════════════════════════════════════════════════════");
}

// Run the simulation
runChronicleSimulation().catch((error) => {
  console.error("\n❌ Simulation failed:", error);
  process.exit(1);
});
