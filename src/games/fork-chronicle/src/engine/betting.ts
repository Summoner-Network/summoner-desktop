/**
 * Betting system and odds engine for Fork: A Chronicle of Alternate Histories
 * Sections 5.1 and 7: Betting System & Odds Calculation
 */

import type { GameState, OddsSnapshot } from "../types/game-state";
import type { BetAction, BetType } from "../types/player";
import type { FactionId } from "../types/faction";
import { emitBetResolved } from "../analytics/analytics-emitter";

/**
 * Calculate odds for all bet types based on current game state
 * [SPEC] Section 7: Odds Calculation
 *
 * Relative-strength model:
 * - dominance_ratio = faction_territory_share / average_territory_share
 * - average_territory_share = 1 / faction_count
 * - odds(faction) = base_payout / dominance_ratio
 * - base_payout = 2.5 (neutral anchor)
 * - favorite_cap: minimum payout 1.3x
 * - underdog_floor: maximum payout 6.0x
 */
export function calculateOdds(state: GameState): OddsSnapshot {
  const totalTerritories = Object.keys(state.territories).length;
  const totalFactions = Object.keys(state.factions).length;
  const averageTerritoryShare = 1 / totalFactions;
  const basePayout = 2.5;

  const odds: Record<string, Record<string, number>> = {
    faction_wins: {},
    faction_controls_continent: {},
    first_continent: {},
    faction_eliminated: {},
    alliance_breaks: {}
  };

  // Calculate faction_wins odds for each faction
  Object.values(state.factions).forEach((faction) => {
    const territoryShare = faction.territories.length / totalTerritories;

    // Avoid division by zero - if faction has no territories, odds are maximum
    if (territoryShare === 0) {
      odds.faction_wins[faction.id] = 6.0;
      return;
    }

    const dominanceRatio = territoryShare / averageTerritoryShare;
    const baseOdds = basePayout / dominanceRatio;

    // Apply caps: minimum 1.3x (favorite_cap), maximum 6.0x (underdog_floor)
    const cappedOdds = Math.max(1.3, Math.min(6.0, baseOdds));

    odds.faction_wins[faction.id] = Math.round(cappedOdds * 10) / 10; // Round to 1 decimal
  });

  // faction_controls_continent and first_continent use same base formula
  Object.values(state.factions).forEach((faction) => {
    const territoryShare = faction.territories.length / totalTerritories;

    if (territoryShare === 0) {
      odds.faction_controls_continent[faction.id] = 6.0;
      odds.first_continent[faction.id] = 6.0;
      return;
    }

    const dominanceRatio = territoryShare / averageTerritoryShare;
    const baseOdds = basePayout / dominanceRatio;
    const cappedOdds = Math.max(1.3, Math.min(6.0, baseOdds));

    odds.faction_controls_continent[faction.id] = Math.round(cappedOdds * 10) / 10;
    odds.first_continent[faction.id] = Math.round(cappedOdds * 10) / 10;
  });

  // faction_eliminated odds (inverse of faction_wins - stronger factions less likely to be eliminated)
  Object.values(state.factions).forEach((faction) => {
    const territoryShare = faction.territories.length / totalTerritories;

    if (territoryShare === 0) {
      // Already eliminated - don't offer odds (bet would have already resolved)
      // Set to minimum odds as placeholder
      odds.faction_eliminated[faction.id] = 1.3;
      return;
    }

    // Inverse calculation - more territories = higher odds (less likely to win the bet)
    // Use dominance ratio directly instead of inverting
    const dominanceRatio = territoryShare / averageTerritoryShare;
    const baseOdds = dominanceRatio * basePayout;
    const cappedOdds = Math.max(1.3, Math.min(6.0, baseOdds));

    odds.faction_eliminated[faction.id] = Math.round(cappedOdds * 10) / 10;
  });

  // alliance_breaks odds based on alliance trust score
  state.alliances.forEach((alliance) => {
    if (alliance.status === "active") {
      // Lower trust = higher chance of breaking = lower odds (better payout)
      // Formula: odds = (trust_score / 100) * 5.0, capped
      const trustFactor = alliance.trustScore / 100;
      const baseOdds = 5.0 / Math.max(0.2, trustFactor); // Avoid very high odds
      const cappedOdds = Math.max(1.3, Math.min(6.0, baseOdds));

      odds.alliance_breaks[alliance.id] = Math.round(cappedOdds * 10) / 10;
    }
  });

  return {
    turn: state.currentTurn,
    odds
  };
}

/**
 * Check if a continent is fully controlled by a single faction
 */
function checkContinentControl(
  factionId: FactionId,
  continent: string,
  state: GameState
): boolean {
  // Get all territories in the continent
  const continentTerritories = Object.values(state.territories).filter(
    (t) => t.continent === continent
  );

  if (continentTerritories.length === 0) {
    return false;
  }

  // Check if all territories are controlled by the faction
  return continentTerritories.every((t) => t.controlledBy === factionId);
}

/**
 * Get all continents controlled by any faction
 */
function getControlledContinents(state: GameState): Map<FactionId, string[]> {
  const continentControl = new Map<FactionId, string[]>();

  // Get unique continents
  const continents = new Set(
    Object.values(state.territories).map((t) => t.continent)
  );

  continents.forEach((continent) => {
    Object.values(state.factions).forEach((faction) => {
      if (checkContinentControl(faction.id, continent, state)) {
        if (!continentControl.has(faction.id)) {
          continentControl.set(faction.id, []);
        }
        continentControl.get(faction.id)!.push(continent);
      }
    });
  });

  return continentControl;
}

/**
 * Resolve all bets based on current game state
 * Returns: { resolvedBets, results }
 */
export function resolveBets(
  state: GameState
): { resolvedBets: BetAction[]; results: string[] } {
  const resolvedBets: BetAction[] = [];
  const results: string[] = [];

  // Track which continents have been claimed for first_continent bets
  const firstContinentClaimed = new Map<string, FactionId>();

  Object.values(state.playerStates).forEach((player) => {
    player.bets.forEach((bet) => {
      let resolved = false;
      let won = false;

      switch (bet.betType) {
        case "faction_wins": {
          // Resolves at game over
          if (state.phase === "game_over" && state.winner !== null) {
            resolved = true;
            won = bet.targetId === state.winner;
          }
          break;
        }

        case "faction_controls_continent": {
          // Resolves when faction controls a full continent
          // Extract continent from targetId (format: "factionId_continentId")
          const [factionId, continentId] = bet.targetId.split("_");
          if (continentId && checkContinentControl(factionId as FactionId, continentId, state)) {
            resolved = true;
            won = true;
          }
          break;
        }

        case "alliance_breaks": {
          // Resolves when alliance status = "broken"
          const alliance = state.alliances.find((a) => a.id === bet.targetId);
          if (alliance && alliance.status === "broken") {
            resolved = true;
            won = true;
          }
          break;
        }

        case "first_continent": {
          // Resolves when first faction controls any full continent
          const continentControl = getControlledContinents(state);

          // Check if any faction has a continent
          if (continentControl.size > 0) {
            // Find the earliest faction to control a continent
            // (In practice, we resolve when we first detect ANY faction has a continent)
            const firstFaction = Array.from(continentControl.keys())[0];

            resolved = true;
            won = bet.targetId === firstFaction;
          }
          break;
        }

        case "faction_eliminated": {
          // Resolves when faction has 0 territories
          const faction = state.factions[bet.targetId as FactionId];
          if (faction && faction.territories.length === 0) {
            resolved = true;
            won = true;
          }
          break;
        }
      }

      if (resolved) {
        resolvedBets.push(bet);

        if (won) {
          const payout = bet.stake * bet.odds;
          player.influencePoints += payout;

          results.push(
            `💰 ${player.playerId} won bet (${bet.betType} on ${bet.targetId}): ${bet.stake} IP → ${payout.toFixed(1)} IP (${bet.odds}x odds)`
          );

          // Emit to Summoner Analytics
          emitBetResolved(state, player.playerId, bet.betType, bet.targetId, true, payout);
        } else {
          // Consolation prize
          player.influencePoints += 2;

          results.push(
            `💸 ${player.playerId} lost bet (${bet.betType} on ${bet.targetId}): -${bet.stake} IP (+2 IP consolation)`
          );

          // Emit to Summoner Analytics
          emitBetResolved(state, player.playerId, bet.betType, bet.targetId, false, 2);
        }
      }
    });

    // Remove resolved bets from player's active bets
    player.bets = player.bets.filter((bet) => !resolvedBets.includes(bet));
  });

  return { resolvedBets, results };
}

/**
 * Place a bet for a player
 * [RULE] Maximum 5 open bets per player at any time
 * [RULE] Mid-game hedge bets use current odds, not opening odds
 */
export function placeBet(
  playerId: string,
  betType: BetType,
  targetId: string,
  stake: number,
  state: GameState
): { success: boolean; error?: string } {
  const player = state.playerStates[playerId];

  if (!player) {
    return { success: false, error: "Player not found" };
  }

  // [RULE] Maximum 5 open bets per player
  if (player.bets.length >= 5) {
    return { success: false, error: "Maximum 5 open bets per player" };
  }

  // Check if player has enough IP
  if (player.influencePoints < stake) {
    return { success: false, error: "Insufficient influence points" };
  }

  // Get current odds
  const oddsSnapshot = calculateOdds(state);
  const currentOdds = oddsSnapshot.odds[betType]?.[targetId];

  if (!currentOdds) {
    return { success: false, error: "Invalid bet target" };
  }

  // Deduct stake from player's IP
  player.influencePoints -= stake;

  // Create bet action with current odds (hedge bets use current odds)
  const bet: BetAction = {
    type: "bet",
    playerId,
    betType,
    targetId,
    stake,
    odds: currentOdds,
    placedOnTurn: state.currentTurn
  };

  player.bets.push(bet);
  player.actionsThisTurn.push(bet);

  return { success: true };
}

/**
 * Award influence points to players at the end of each turn
 * [SPEC] Section 3 Phase 2: Base IP earnings per turn
 *
 * +5 base
 * +3 if backed faction gained territory
 * +2 if backed faction formed alliance
 * +5 if played event card affecting 3+ territories
 * +10 bet win
 * +2 bet loss consolation
 */
export function awardInfluencePoints(state: GameState, turnEvents: string[]): string[] {
  const results: string[] = [];

  Object.values(state.playerStates).forEach((player) => {
    let earned = 0;

    // +5 base per turn
    earned += 5;

    // TODO: +3 if backed faction gained territory (requires tracking previous turn state)
    // TODO: +2 if backed faction formed alliance (requires tracking alliances formed this turn)
    // TODO: +5 if played event card affecting 3+ territories (requires event injection tracking)

    player.influencePoints += earned;

    if (earned > 0) {
      results.push(`📈 ${player.playerId} earned ${earned} IP this turn (total: ${player.influencePoints})`);
    }
  });

  return results;
}
