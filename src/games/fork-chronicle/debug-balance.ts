/**
 * Debug script to check faction balance for epochs
 */

import { loadTerritories, loadEpoch } from "./src/utils/data-loader";

function calculateFactionAdvantage(
  territories: string[],
  allTerritories: Record<string, any>
): number {
  const totalTerritories = Object.keys(allTerritories).length;
  const territoryScore = territories.length / totalTerritories;

  // Calculate global strength
  const globalStrength = Object.values(allTerritories).reduce(
    (sum: number, t: any) => sum + t.strength,
    0
  );
  const factionStrength = territories.reduce(
    (sum: number, tId: string) => sum + allTerritories[tId].strength,
    0
  );
  const strengthScore = factionStrength / globalStrength;

  // Calculate global resources
  const globalResources = Object.values(allTerritories).reduce(
    (sum: number, t: any) => sum + t.resources.food + t.resources.industry + t.resources.tech,
    0
  );
  const factionResources = territories.reduce(
    (sum: number, tId: string) => {
      const t = allTerritories[tId];
      return sum + t.resources.food + t.resources.industry + t.resources.tech;
    },
    0
  );
  const resourceScore = factionResources / globalResources;

  return territoryScore * 0.5 + strengthScore * 0.3 + resourceScore * 0.2;
}

const epochs = ["1914_brink", "1945_aftermath", "1991_unipolar"];

for (const epochId of epochs) {
  console.log(`\n═══ ${epochId} ═══`);
  const epoch = loadEpoch(epochId);
  const territories = loadTerritories();

  const territoriesMap: Record<string, any> = {};
  for (const t of territories) {
    territoriesMap[t.id] = t;
  }

  // Override strengths from epoch
  for (const [tId, strength] of Object.entries(epoch.startingStrengths)) {
    if (territoriesMap[tId]) {
      territoriesMap[tId].strength = strength;
    }
  }

  // Group territories by faction
  const factionTerritories: Record<string, string[]> = {
    faction_1: [],
    faction_2: [],
    faction_3: [],
    faction_4: [],
  };

  for (const [tId, factionId] of Object.entries(epoch.startingTerritoryControl)) {
    factionTerritories[factionId].push(tId);
  }

  console.log("\nTerritory counts:");
  for (const [factionId, tIds] of Object.entries(factionTerritories)) {
    console.log(`  ${factionId}: ${tIds.length} territories`);
  }

  // Calculate advantages
  const advantages: Record<string, number> = {};
  for (const [factionId, tIds] of Object.entries(factionTerritories)) {
    advantages[factionId] = calculateFactionAdvantage(tIds, territoriesMap);
  }

  console.log("\nAdvantage scores:");
  for (const [factionId, score] of Object.entries(advantages)) {
    console.log(`  ${factionId}: ${score.toFixed(4)}`);
  }

  // Check ratios
  console.log("\nAdvantage ratios:");
  const factionIds = Object.keys(advantages);
  let maxRatio = 0;
  let maxRatioPair = "";
  for (let i = 0; i < factionIds.length; i++) {
    for (let j = 0; j < factionIds.length; j++) {
      if (i !== j) {
        const ratio = advantages[factionIds[i]] / advantages[factionIds[j]];
        console.log(`  ${factionIds[i]} / ${factionIds[j]}: ${ratio.toFixed(4)}`);
        if (ratio > maxRatio) {
          maxRatio = ratio;
          maxRatioPair = `${factionIds[i]} / ${factionIds[j]}`;
        }
      }
    }
  }

  console.log(`\nMax ratio: ${maxRatio.toFixed(4)} (${maxRatioPair})`);
  console.log(`Passes 60% threshold? ${maxRatio <= 1.6 ? "YES" : "NO"}`);
}
