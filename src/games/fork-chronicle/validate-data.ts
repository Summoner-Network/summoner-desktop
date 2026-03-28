/**
 * Data validation script for Track 2 content polish
 */

import { loadTerritories, loadEpoch, loadEvents } from "./src/utils/data-loader";
import { initializeGame } from "./src/engine/setup";
import { executeTurn } from "./src/engine/turn-loop";

async function validateData() {
  console.log("═══════════════════════════════════════════");
  console.log("VALIDATING FORK CHRONICLE DATA FILES");
  console.log("═══════════════════════════════════════════\n");

  // Load data
  const territories = loadTerritories();
  const events = loadEvents(["base"]);
  const epochs = ["1914_brink", "1945_aftermath", "1991_unipolar"];

  console.log(`✓ Loaded ${territories.length} territories`);
  console.log(`✓ Loaded ${events.length} events`);
  console.log(`✓ Found ${epochs.length} epochs\n`);

  // Validate each epoch
  for (const epochId of epochs) {
    console.log(`\n═══ Validating ${epochId} ═══`);
    const epoch = loadEpoch(epochId);

    // Check territory coverage
    const assignedTerritories = Object.keys(epoch.startingTerritoryControl);
    const strengthDefined = Object.keys(epoch.startingStrengths);

    console.log(`Faction-assigned territories: ${assignedTerritories.length}`);
    console.log(`Territories with strengths: ${strengthDefined.length}`);
    console.log(`Total unique territories: ${territories.length}`);

    // Check for orphaned territories
    const territoryIds = territories.map(t => t.id);
    const missing = territoryIds.filter(id => !strengthDefined.includes(id));
    if (missing.length > 0) {
      console.log(`⚠️  Missing strength definitions: ${missing.join(", ")}`);
    }

    // Neutral territories
    const neutral = territoryIds.filter(id => !assignedTerritories.includes(id));
    if (neutral.length > 0) {
      console.log(`Neutral territories (${neutral.length}): ${neutral.join(", ")}`);
    }

    console.log(`Total coverage: ${assignedTerritories.length + neutral.length}/${territories.length}`);

    if (assignedTerritories.length + neutral.length === territories.length) {
      console.log("✓ All territories accounted for");
    } else {
      console.log("✗ Territory count mismatch!");
    }

    // Validate event pool
    const invalidEvents = epoch.eventPool.filter(
      eventId => !events.find(e => e.id === eventId)
    );
    if (invalidEvents.length > 0) {
      console.log(`✗ Invalid event IDs: ${invalidEvents.join(", ")}`);
    } else {
      console.log(`✓ All ${epoch.eventPool.length} events valid`);
    }
  }

  console.log("\n═══════════════════════════════════════════");
  console.log("RUNNING 25-TURN SIMULATIONS");
  console.log("═══════════════════════════════════════════\n");

  for (const epochId of epochs) {
    console.log(`\n══════ ${epochId.toUpperCase()} ══════`);

    try {
      const state = initializeGame({
        seed: `validate-${epochId}`,
        factionCount: 4,
        players: [{ playerId: "validator", displayName: "Validator", startingInfluencePoints: 100 }],
        epochId,
        eventPackIds: ["base"],
      });

      console.log(`Turn 1: ${state.currentTurn}, Era: ${state.currentEra}`);

      // Run 25 turns
      for (let i = 0; i < 25; i++) {
        await executeTurn(state);
      }

      console.log(`Completed: Turn ${state.currentTurn}, Era: ${state.currentEra}`);
      console.log(`Phase: ${state.phase}`);
      console.log(`Winner: ${state.winner || "none"}`);
      console.log(`Era cards generated: ${state.eraCards.length}`);

      // Show Era 1 narrative
      if (state.eraCards.length > 0) {
        console.log(`\n📖 ERA 1 NARRATIVE (${epochId}):`);
        console.log(`"${state.eraCards[0].narrativeSummary}"`);
      }

      console.log(`✓ ${epochId} simulation completed successfully`);
    } catch (error: any) {
      console.log(`✗ ${epochId} simulation failed: ${error.message}`);
    }
  }

  console.log("\n═══════════════════════════════════════════");
  console.log("VALIDATION COMPLETE");
  console.log("═══════════════════════════════════════════");
}

validateData();
