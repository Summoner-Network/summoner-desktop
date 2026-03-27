/**
 * Era summary and narrative generation for Fork: A Chronicle of Alternate Histories
 * Sections 3 (Era Summary), 8 (Narrative Engine), 11 (Chronicle Export), 12 (Player Scoring)
 */

import type { GameState, EraCard, TurnRecord } from "../types/game-state";
import type { FactionId } from "../types/faction";
import type { DirectorTitle, PlayerScore } from "../types/player";

/**
 * Generate EraCard for the current era
 * [SPEC] Section 3: Era Summary
 */
export function generateEraCard(state: GameState, eraNumber: number): EraCard {
  const eraStartTurn = (eraNumber - 1) * 5 + 1;
  const eraEndTurn = eraNumber * 5;

  // Get history for this era
  const eraHistory = state.history.filter((r) => r.turn >= eraStartTurn && r.turn <= eraEndTurn);

  // Find leader faction (most territories)
  let leaderFaction: FactionId = "faction_1";
  let maxTerritories = 0;
  Object.values(state.factions).forEach((faction) => {
    if (faction.territories.length > maxTerritories) {
      maxTerritories = faction.territories.length;
      leaderFaction = faction.id;
    }
  });

  // Track territory changes per faction
  const territoryChanges = new Map<FactionId, { gained: number; lost: number }>();
  Object.keys(state.factions).forEach((factionId) => {
    territoryChanges.set(factionId as FactionId, { gained: 0, lost: 0 });
  });

  // Count alliances formed and broken this era
  let alliancesFormed = 0;
  let alliancesBroken = 0;

  // Count player-injected events
  let eventsInjected = 0;

  // Track agent actions for MVP
  const agentActions = new Map<string, { attacks: number; alliances: number; investments: number }>();

  // Analyze era history
  eraHistory.forEach((record) => {
    record.events.forEach((event) => {
      // Track conquests
      if (event.includes("conquered")) {
        const conquestMatch = event.match(/faction_(\d+).*conquered.*from Faction (\d+)/);
        if (conquestMatch) {
          const winnerFactionId = `faction_${conquestMatch[1]}` as FactionId;
          const loserFactionId = `faction_${conquestMatch[2]}` as FactionId;

          const winnerChange = territoryChanges.get(winnerFactionId);
          const loserChange = territoryChanges.get(loserFactionId);

          if (winnerChange) winnerChange.gained += 1;
          if (loserChange) loserChange.lost += 1;
        }
      }

      // Track alliances
      if (event.includes("formed an alliance")) {
        alliancesFormed += 1;
      }

      if (event.includes("broke alliance")) {
        alliancesBroken += 1;
      }

      // Track player events
      if (event.includes("plays event card")) {
        eventsInjected += 1;
      }
    });

    // Analyze agent decisions for MVP
    record.agentDecisions.forEach((decision) => {
      const agentId = decision.agentId;

      if (!agentActions.has(agentId)) {
        agentActions.set(agentId, { attacks: 0, alliances: 0, investments: 0 });
      }

      const stats = agentActions.get(agentId)!;

      if (decision.action.type === "attack") {
        stats.attacks += 1;
      } else if (decision.action.type === "propose_alliance") {
        stats.alliances += 1;
      } else if (decision.action.type === "invest_resources") {
        stats.investments += 1;
      }
    });
  });

  // Find biggest gain/loss
  let biggestGain = { factionId: leaderFaction, territoriesGained: 0 };
  let biggestLoss = { factionId: leaderFaction, territoriesLost: 0 };

  territoryChanges.forEach((change, factionId) => {
    if (change.gained > biggestGain.territoriesGained) {
      biggestGain = { factionId, territoriesGained: change.gained };
    }
    if (change.lost > biggestLoss.territoriesLost) {
      biggestLoss = { factionId, territoriesLost: change.lost };
    }
  });

  // Find MVP agent
  let mvpAgent = { agentId: "", reason: "No significant actions this era" };
  let maxActions = 0;

  agentActions.forEach((stats, agentId) => {
    const totalActions = stats.attacks + stats.alliances + stats.investments;
    if (totalActions > maxActions) {
      maxActions = totalActions;

      const reasons = [];
      if (stats.attacks > 0) reasons.push(`${stats.attacks} attack${stats.attacks > 1 ? 's' : ''}`);
      if (stats.alliances > 0) reasons.push(`${stats.alliances} alliance${stats.alliances > 1 ? 's' : ''}`);
      if (stats.investments > 0) reasons.push(`${stats.investments} investment${stats.investments > 1 ? 's' : ''}`);

      mvpAgent = {
        agentId,
        reason: reasons.join(", ")
      };
    }
  });

  // Generate narrative summary
  const narrativeSummary = generateNarrativeSummary(
    {
      era: eraNumber,
      turns: [eraStartTurn, eraEndTurn],
      leaderFaction,
      biggestGain,
      biggestLoss,
      alliancesFormed,
      alliancesBroken,
      eventsInjected,
      mvpAgent,
      narrativeSummary: "" // Will be filled
    },
    eraHistory,
    state
  );

  return {
    era: eraNumber,
    turns: [eraStartTurn, eraEndTurn],
    leaderFaction,
    biggestGain,
    biggestLoss,
    alliancesFormed,
    alliancesBroken,
    eventsInjected,
    mvpAgent,
    narrativeSummary
  };
}

/**
 * Sanitize text to remove game mechanics terms
 */
function sanitizeNarrativeText(text: string): string {
  const forbiddenTerms = [
    "IP", "strength", "territory_share", "faction_id", "p_accept",
    "AgentAction", "patronBacking", "riskTolerance", "aggression", "loyalty",
    "reputation"  // Appears in parenthetical notes
  ];

  let sanitized = text;

  // Remove parenthetical notes that often contain game mechanics
  sanitized = sanitized.replace(/\s*\([^)]*\)/g, '');

  // Check if any forbidden terms remain
  forbiddenTerms.forEach(term => {
    // Use word boundaries to avoid false positives like "Philippines"
    const regex = new RegExp(`\\b${term}\\b`, 'gi');
    sanitized = sanitized.replace(regex, '');
  });

  return sanitized.trim();
}

/**
 * Generate narrative summary using template system
 * [SPEC] Section 8: Narrative Engine
 */
function generateNarrativeSummary(eraCard: EraCard, history: TurnRecord[], state: GameState): string {
  const parts: string[] = [];

  // Get faction names
  const leaderName = state.factions[eraCard.leaderFaction].name;
  const totalTerritories = Object.keys(state.territories).length;
  const leaderTerritories = state.factions[eraCard.leaderFaction].territories.length;
  const leaderPercentage = Math.round((leaderTerritories / totalTerritories) * 100);

  // Determine dominant action type
  let dominantAction: "conquest" | "diplomacy" | "stability" = "stability";

  if (eraCard.biggestGain.territoriesGained >= 3) {
    dominantAction = "conquest";
  } else if (eraCard.alliancesFormed >= 2) {
    dominantAction = "diplomacy";
  }

  // Opening sentence
  if (dominantAction === "conquest") {
    const conqueredTerritories = state.factions[eraCard.biggestGain.factionId].territories
      .slice(0, 2)
      .map((tId) => state.territories[tId].name);

    if (conqueredTerritories.length > 0) {
      const territoryList = conqueredTerritories.join(" and ");
      const continent = state.territories[state.factions[eraCard.biggestGain.factionId].territories[0]]?.continent || "the region";

      parts.push(
        `${state.factions[eraCard.biggestGain.factionId].name} extended its dominion across ${territoryList}, reshaping the balance of power in ${continent}.`
      );
    } else {
      parts.push(`${leaderName} consolidated its position during this period of expansion.`);
    }
  } else if (dominantAction === "diplomacy") {
    // Find alliance partners from history
    const allianceEvent = history
      .flatMap((r) => r.events)
      .find((e) => e.includes("formed an alliance"));

    if (allianceEvent) {
      // Extract faction names from alliance event
      const match = allianceEvent.match(/(.+) and (.+) formed an alliance/);
      if (match) {
        parts.push(
          `This era was defined by the alliance between ${match[1]} and ${match[2]}, forging a coalition that would test the resolve of their rivals.`
        );
      } else {
        parts.push(`A period of diplomatic maneuvering saw new alliances reshape the geopolitical landscape.`);
      }
    } else {
      parts.push(`Diplomatic efforts dominated this era as factions sought to secure their positions through negotiation.`);
    }
  } else {
    const leaderContinent = state.territories[state.factions[eraCard.leaderFaction].territories[0]]?.continent || "the known world";
    parts.push(
      `A period of consolidation settled over the world as ${leaderName} tightened its grip on ${leaderContinent}.`
    );
  }

  // Alliance breaking (if occurred)
  if (eraCard.alliancesBroken > 0) {
    const betrayalEvent = history
      .flatMap((r) => r.events)
      .find((e) => e.includes("broke alliance"));

    if (betrayalEvent) {
      const match = betrayalEvent.match(/faction_\d+ \w+ \d+ broke alliance .* by attacking ally (.+)/);
      if (match) {
        const victimName = sanitizeNarrativeText(match[1]);
        if (victimName.length > 0) {
          parts.push(
            `The fragile peace shattered when a former ally turned aggressor, leaving ${victimName} exposed on several fronts.`
          );
        } else {
          parts.push(`Long-standing pacts collapsed under the weight of competing ambitions.`);
        }
      } else {
        parts.push(`Long-standing pacts collapsed under the weight of competing ambitions.`);
      }
    }
  }

  // Event sentence (if major event fired)
  const majorEvent = history
    .flatMap((r) => r.events)
    .find((e) => e.includes("🎴 Event:"));

  if (majorEvent) {
    // Extract only the event title, stopping before any game mechanics details
    // Stop at parentheses, numbers with units, or excessive detail
    const eventMatch = majorEvent.match(/🎴 Event: ([A-Za-z\s,'-.]+?)(?:\s*[\(:\d]|$)/);
    if (eventMatch) {
      const eventTitle = eventMatch[1].trim();
      // Only include if it doesn't contain forbidden words
      const forbiddenTerms = ["IP", "strength", "territory_share", "faction_id", "p_accept"];
      const hasForbiddenWord = forbiddenTerms.some(term =>
        eventTitle.toLowerCase().includes(term.toLowerCase())
      );

      if (!hasForbiddenWord && eventTitle.length > 0) {
        parts.push(
          `${eventTitle} sent shockwaves across the globe, forcing every major power to reconsider its position.`
        );
      }
    }
  }

  // Closing sentence
  if (leaderPercentage >= 50) {
    parts.push(
      `${leaderName} now stands as the dominant power, controlling ${leaderPercentage}% of the known world.`
    );
  } else if (state.currentEra >= 15) {
    const erasRemaining = 20 - state.currentEra;
    parts.push(
      `With ${erasRemaining} era${erasRemaining > 1 ? 's' : ''} remaining, the final shape of this alternate history grows clearer with each passing season.`
    );
  } else {
    parts.push(`No single power has yet achieved supremacy — the world remains a dangerous chessboard.`);
  }

  // Join parts and sanitize the final narrative
  let narrative = parts.join(" ");

  // Apply final sanitization to remove any game mechanics language that may have leaked through
  narrative = sanitizeNarrativeText(narrative);

  // Verify no forbidden words remain (for debugging)
  const forbiddenWords = ["strength", "IP", "territory_share", "p_accept", "faction_id", "AgentAction", "patronBacking", "riskTolerance", "aggression", "loyalty"];
  for (const word of forbiddenWords) {
    if (narrative.toLowerCase().includes(word.toLowerCase())) {
      console.warn(`⚠️  WARNING: Narrative still contains forbidden word "${word}" after sanitization`);
      console.warn(`   Full narrative: ${narrative}`);
    }
  }

  return narrative;
}

/**
 * Calculate player score and assign Director title
 * [SPEC] Section 12: Player Scoring
 */
export function calculatePlayerScore(
  playerId: string,
  state: GameState,
  openingOdds: Record<FactionId, number>
): PlayerScore {
  const player = state.playerStates[playerId];

  if (!player) {
    throw new Error(`Player ${playerId} not found`);
  }

  // Count bets won/lost
  let betsWon = 0;
  let betsLost = 0;
  let netBettingReturn = 0;

  // Analyze betting history from game history
  state.history.forEach((record) => {
    record.events.forEach((event) => {
      if (event.includes(playerId) && event.includes("won bet")) {
        betsWon += 1;
        // Extract payout from event message
        const payoutMatch = event.match(/(\d+\.?\d*) IP \(.*\)/);
        if (payoutMatch) {
          netBettingReturn += parseFloat(payoutMatch[1]);
        }
      } else if (event.includes(playerId) && event.includes("lost bet")) {
        betsLost += 1;
        // Extract stake from event message
        const stakeMatch = event.match(/-(\d+) IP/);
        if (stakeMatch) {
          netBettingReturn -= parseInt(stakeMatch[1]);
        }
      }
    });
  });

  // Calculate patron effectiveness
  let patronEffectiveness = 0;
  const patronCommitment = player.patronCommitments[0];

  if (patronCommitment) {
    const backedFaction = state.factions[patronCommitment.targetFactionId];
    if (backedFaction) {
      // Count turns where backed faction gained territory
      let turnsWithGain = 0;
      const totalTurns = state.currentTurn - 1;

      state.history.forEach((record) => {
        const gained = record.events.some(
          (e) => e.includes("conquered") && e.includes(backedFaction.name)
        );
        if (gained) turnsWithGain += 1;
      });

      patronEffectiveness = totalTurns > 0 ? (turnsWithGain / totalTurns) * 100 : 0;
    }
  }

  // Count events injected
  const eventsInjected = state.history
    .flatMap((r) => r.events)
    .filter((e) => e.includes(playerId) && e.includes("plays event card")).length;

  // Count Tier 3 events
  const tier3EventsPlayed = player.actionsThisTurn.filter(
    (a) => a.type === "event_injection"
  ).length;

  // Determine Director title
  let directorTitle: DirectorTitle = "the_director"; // Default

  // Check each title condition
  if (patronCommitment && state.winner === patronCommitment.targetFactionId) {
    const backedFaction = state.factions[patronCommitment.targetFactionId];
    if (backedFaction.patronBacking > 50) {
      directorTitle = "the_kingmaker";
    } else {
      directorTitle = "the_patron";
    }

    // Check if backed from turn 1
    const firstCommitment = state.history.find((r) =>
      r.events.some((e) => e.includes(playerId) && e.includes("backing"))
    );
    if (firstCommitment && firstCommitment.turn === 1) {
      directorTitle = "the_historian";
    }

    // Check if was underdog
    const openingOddsForFaction = openingOdds[patronCommitment.targetFactionId];
    if (openingOddsForFaction && openingOddsForFaction > 4.0) {
      directorTitle = "the_contrarian";
    }
  }

  if (tier3EventsPlayed >= 3) {
    directorTitle = "the_arsonist";
  }

  if (betsWon >= 4) {
    directorTitle = "the_oracle";
  }

  // Calculate total score
  const totalScore =
    player.influencePoints +
    betsWon * 50 +
    netBettingReturn +
    Math.floor(patronEffectiveness) +
    eventsInjected * 25;

  return {
    playerId,
    influencePointsEarned: player.influencePoints,
    betsWon,
    betsLost,
    netBettingReturn,
    patronEffectiveness,
    eventsInjected,
    tier3EventsPlayed,
    directorTitle,
    totalScore
  };
}

/**
 * Export complete chronicle
 * [SPEC] Section 11: Chronicle Export
 */
export interface ForkChronicle {
  eraCards: EraCard[];
  fullNarrative: string;
  replayData: TurnRecord[];
  playerScores: PlayerScore[];
  winner: FactionId | null;
  totalTurns: number;
  totalEras: number;
}

export function exportChronicle(
  state: GameState,
  eraCards: EraCard[],
  openingOdds: Record<FactionId, number>
): ForkChronicle {
  // Concatenate all narratives
  const fullNarrative = eraCards
    .map((card, idx) => `Era ${idx + 1} (Turns ${card.turns[0]}-${card.turns[1]}):\n\n${card.narrativeSummary}`)
    .join("\n\n");

  // Calculate player scores
  const playerScores = Object.keys(state.playerStates).map((playerId) =>
    calculatePlayerScore(playerId, state, openingOdds)
  );

  return {
    eraCards,
    fullNarrative,
    replayData: state.history,
    playerScores,
    winner: state.winner,
    totalTurns: state.currentTurn - 1,
    totalEras: state.currentEra - 1
  };
}
