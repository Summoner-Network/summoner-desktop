/**
 * Patron backing system for Fork: A Chronicle of Alternate Histories
 * Section 5.3: Patron Backing
 */

import type { GameState } from "../types/game-state";
import type { PatronAction, PatronBenefit } from "../types/player";
import type { FactionId } from "../types/faction";
import { emitPatronActivated } from "../analytics/analytics-emitter";
import { safeAddIP } from "./betting";

/**
 * Commit patron backing to a faction
 * [RULE] A player may only back one faction at a time
 * [RULE] Switching patron targets costs 20 IP and removes all accumulated patronBacking from the old faction
 */
export function commitPatronBacking(
  playerId: string,
  targetFactionId: FactionId,
  benefit: PatronBenefit,
  state: GameState
): { success: boolean; error?: string; results?: string[] } {
  const player = state.playerStates[playerId];

  if (!player) {
    return { success: false, error: "Player not found" };
  }

  const targetFaction = state.factions[targetFactionId];
  if (!targetFaction) {
    return { success: false, error: "Faction not found" };
  }

  const results: string[] = [];

  // Check if player already has a patron commitment
  const existingCommitment = player.patronCommitments.find((c) => c.type === "patron_backing");

  if (existingCommitment) {
    // Player is switching factions
    if (existingCommitment.targetFactionId !== targetFactionId) {
      // [RULE] Switching costs 20 IP
      if (player.influencePoints < 20) {
        return { success: false, error: "Switching factions costs 20 IP (insufficient funds)" };
      }

      player.influencePoints = safeAddIP(player.influencePoints, -20);

      // Remove accumulated patronBacking from old faction
      const oldFaction = state.factions[existingCommitment.targetFactionId];
      if (oldFaction) {
        oldFaction.patronBacking = 0;
        results.push(`🔄 ${playerId} switched from ${oldFaction.name} to ${targetFaction.name} (-20 IP)`);
        results.push(`   ${oldFaction.name} patronBacking reset to 0`);
      }

      // Remove old commitment
      player.patronCommitments = player.patronCommitments.filter(
        (c) => c.targetFactionId !== existingCommitment.targetFactionId
      );
    } else {
      // Player is already backing this faction - just update the benefit if different
      if (existingCommitment.benefit !== benefit) {
        results.push(`🔄 ${playerId} changed benefit for ${targetFaction.name} from ${existingCommitment.benefit} to ${benefit}`);
        existingCommitment.benefit = benefit;

        // Emit to Summoner Analytics
        emitPatronActivated(state, playerId, targetFactionId, benefit);
      } else {
        return { success: false, error: "Already backing this faction with this benefit" };
      }
      return { success: true, results };
    }
  }

  // Calculate upfront cost for negotiation_edge (40 IP for 2 eras)
  if (benefit === "negotiation_edge") {
    if (player.influencePoints < 40) {
      return { success: false, error: "negotiation_edge requires 40 IP upfront" };
    }

    player.influencePoints = safeAddIP(player.influencePoints, -40);
    results.push(`💰 ${playerId} paid 40 IP upfront for negotiation_edge (2 eras)`);
  }

  // Create patron commitment
  const commitment: PatronAction = {
    type: "patron_backing",
    playerId,
    targetFactionId,
    investmentAmount: 0, // Will be tracked via patronBacking on faction
    benefit
  };

  player.patronCommitments.push(commitment);
  player.actionsThisTurn.push(commitment);

  // Emit to Summoner Analytics
  emitPatronActivated(state, playerId, targetFactionId, benefit);

  results.push(`🤝 ${playerId} is now backing ${targetFaction.name} with ${benefit}`);

  return { success: true, results };
}

/**
 * Apply patron benefits each turn
 * Called during resolution phase
 */
export function applyPatronBenefits(state: GameState): string[] {
  const results: string[] = [];

  // Increment patronBacking for all active commitments (happens each turn)
  Object.values(state.playerStates).forEach((player) => {
    player.patronCommitments.forEach((commitment) => {
      const faction = state.factions[commitment.targetFactionId];
      if (faction) {
        faction.patronBacking += 1;
      }
    });
  });

  return results;
}

/**
 * Apply era-based patron benefits
 * Called during era_summary phase
 */
export function applyPatronEraEffects(state: GameState): string[] {
  const results: string[] = [];

  Object.values(state.playerStates).forEach((player) => {
    // Process each active patron commitment
    const activeCommitments = [...player.patronCommitments];

    activeCommitments.forEach((commitment) => {
      const faction = state.factions[commitment.targetFactionId];
      if (!faction) {
        return;
      }

      switch (commitment.benefit) {
        case "resource_bonus": {
          // [BENEFIT] +10 to randomly assigned resource in faction's lowest-resource territory each era
          // Cost: Deducted at era summary (implicit from IP earnings)

          // Find faction's lowest-resource territory
          const factionTerritories = faction.territories.map((tId) => state.territories[tId]);

          if (factionTerritories.length === 0) {
            break;
          }

          // Calculate total resources for each territory
          const territoriesWithTotalResources = factionTerritories.map((t) => ({
            territory: t,
            totalResources: t.resources.food + t.resources.industry + t.resources.tech
          }));

          // Find lowest-resource territory
          const lowestResourceTerritory = territoriesWithTotalResources.reduce((min, curr) =>
            curr.totalResources < min.totalResources ? curr : min
          ).territory;

          // Randomly assign to one of the three resource types
          const resourceTypes: Array<"food" | "industry" | "tech"> = ["food", "industry", "tech"];
          const randomResource = resourceTypes[Math.floor(Math.random() * 3)];

          lowestResourceTerritory.resources[randomResource] += 10;

          results.push(
            `📦 Patron bonus: ${lowestResourceTerritory.name} gains +10 ${randomResource} (backed by ${player.playerId})`
          );
          break;
        }

        case "reputation_shield": {
          // [BENEFIT] Faction reputation cannot drop below 30 while active
          // Cost: 30 IP per era, deducted at era summary

          if (player.influencePoints < 30) {
            // [RULE] If player cannot afford continued patron cost, benefit expires silently
            results.push(`⚠️  ${player.playerId} cannot afford reputation_shield for ${faction.name} (expires)`);
            player.patronCommitments = player.patronCommitments.filter((c) => c !== commitment);
            break;
          }

          player.influencePoints = safeAddIP(player.influencePoints, -30);

          // Ensure reputation is at least 30
          if (faction.reputation < 30) {
            faction.reputation = 30;
            results.push(
              `🛡️  Patron shield: ${faction.name} reputation raised to 30 (backed by ${player.playerId}, -30 IP)`
            );
          } else {
            results.push(
              `🛡️  Patron shield: ${faction.name} reputation protected at ${faction.reputation} (backed by ${player.playerId}, -30 IP)`
            );
          }
          break;
        }

        case "negotiation_edge": {
          // [BENEFIT] +0.15 to all p_accept calculations for 2 eras
          // Cost: 40 IP upfront (already paid at commitment time)

          // Track duration (commitment.investmentAmount used as duration counter)
          commitment.investmentAmount = (commitment.investmentAmount || 0) + 1;

          if (commitment.investmentAmount >= 2) {
            // Benefit expires after 2 eras
            results.push(`⏰ negotiation_edge expired for ${faction.name} (backed by ${player.playerId})`);
            player.patronCommitments = player.patronCommitments.filter((c) => c !== commitment);
          } else {
            results.push(
              `🤝 Patron edge: ${faction.name} has +15% alliance acceptance (backed by ${player.playerId})`
            );
          }
          break;
        }
      }
    });
  });

  return results;
}

/**
 * Check if a faction has an active negotiation_edge benefit
 * Used by negotiation system to apply +0.15 bonus
 */
export function hasNegotiationEdge(factionId: FactionId, state: GameState): boolean {
  return Object.values(state.playerStates).some((player) =>
    player.patronCommitments.some(
      (c) => c.targetFactionId === factionId && c.benefit === "negotiation_edge"
    )
  );
}

/**
 * Apply reputation floor check for reputation_shield
 * Called whenever faction reputation is reduced
 */
export function applyReputationFloor(factionId: FactionId, state: GameState): void {
  const faction = state.factions[factionId];
  if (!faction) {
    return;
  }

  // Check if faction has active reputation_shield
  const hasShield = Object.values(state.playerStates).some((player) =>
    player.patronCommitments.some(
      (c) => c.targetFactionId === factionId && c.benefit === "reputation_shield"
    )
  );

  if (hasShield && faction.reputation < 30) {
    faction.reputation = 30;
  }
}

/**
 * Get the patron factor for negotiation calculations
 * [SPEC] patron_factor = patronBacking / 100
 */
export function getPatronFactor(factionId: FactionId, state: GameState): number {
  const faction = state.factions[factionId];
  if (!faction) {
    return 0;
  }

  return faction.patronBacking / 100;
}
