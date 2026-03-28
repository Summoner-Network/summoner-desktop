/**
 * Turn loop and phase progression for Fork: A Chronicle of Alternate Histories
 * Section 3: Turn Structure
 */

import type { GameState, GamePhase, TurnRecord } from "../types/game-state";
import type { FactionId } from "../types/faction";
import {
  emitAgentDecision,
  emitTerritoryChanged,
  emitAllianceFormed,
  emitAllianceBroken,
  emitEventInjected,
  emitEraSummary,
  emitGameOver,
  emitBetResolved,
  emitPatronActivated,
} from "../analytics/analytics-emitter";
import { calculateOdds, resolveBets, awardInfluencePoints } from "./betting";
import { processRippleEffects, applyEventEffects, queueRippleEffects, expireUnplayedCards } from "./events";
import { createAgentIntelligence } from "./agent-intelligence";
import { resolveNegotiations } from "./negotiation";
import { resolveActions } from "./combat";
import { applyPatronBenefits, applyPatronEraEffects } from "./patron";
import { driftPersonalities } from "./personality-drift";
import { generateEraCard } from "./era-summary";
import { generateStateHash } from "../analytics/summoner-analytics-bridge";

/**
 * Phase progression order per spec:
 * [event_reveal] → [player_actions] → [agent_deliberation] → [agent_negotiation]
 * → [agent_action] → [resolution] → (if turn % 5 == 0: [era_summary])
 *
 * Special cases:
 * - Turn 1: Skip event_reveal, start with player_actions
 * - Every 5 turns: Insert era_summary after resolution
 * - Game over: Stop loop
 */

/**
 * Get the next phase in the turn sequence
 */
function getNextPhase(state: GameState): GamePhase {
  const currentPhase = state.phase;

  switch (currentPhase) {
    case "setup":
      // After setup, go to player_actions (event_reveal is skipped on turn 1)
      return "player_actions";

    case "event_reveal":
      return "player_actions";

    case "player_actions":
      return "agent_deliberation";

    case "agent_deliberation":
      return "agent_negotiation";

    case "agent_negotiation":
      return "agent_action";

    case "agent_action":
      return "resolution";

    case "resolution":
      // Check if we need era summary (every 5 turns)
      if (state.currentTurn % 5 === 0) {
        return "era_summary";
      }
      // Otherwise, check for game over, then loop back to event_reveal
      if (state.winner !== null) {
        return "game_over";
      }
      return "event_reveal";

    case "era_summary":
      // After era summary, check for game over or continue
      if (state.winner !== null) {
        return "game_over";
      }
      return "event_reveal";

    case "game_over":
      return "game_over";

    default:
      throw new Error(`Unknown phase: ${currentPhase}`);
  }
}

/**
 * Log a message to the current turn's event log
 */
function logEvent(state: GameState, message: string): void {
  console.log(`[Turn ${state.currentTurn}, Era ${state.currentEra}] ${state.phase}: ${message}`);
}

/**
 * Create a turn record snapshot
 */
function createTurnRecord(state: GameState, events: string[]): TurnRecord {
  return {
    turn: state.currentTurn,
    era: state.currentEra,
    phase: state.phase,
    events,
    agentDecisions: [],
    stateSnapshot: {
      currentTurn: state.currentTurn,
      currentEra: state.currentEra,
      phase: state.phase,
      winner: state.winner
    }
  };
}

/**
 * Phase 1: Event Reveal
 * [RULE] Skip on turn 1
 */
function phaseEventReveal(state: GameState): GameState {
  logEvent(state, "Revealing world event");

  const events: string[] = [];

  // Process ripple effects at the start of each era (turn % 5 == 1)
  if (state.currentTurn % 5 === 1 && state.currentTurn > 1) {
    const rippleResults = processRippleEffects(state);
    if (rippleResults.length > 0) {
      events.push(...rippleResults);
      rippleResults.forEach((result) => logEvent(state, result));
    }
  }

  // Draw top card from event deck and display publicly
  if (state.eventDeck.length > 0) {
    const event = state.eventDeck.shift()!;
    state.eventDiscard.push(event);

    events.push(`World event revealed: ${event.title}`);
    logEvent(state, `Revealed: ${event.title}`);

    // Apply effects immediately
    const effectResults = applyEventEffects(event, state);
    events.push(...effectResults);
    effectResults.forEach((result) => logEvent(state, result));

    // Queue ripple effects for next era
    const rippleResults = queueRippleEffects(event, state);
    events.push(...rippleResults);
    rippleResults.forEach((result) => logEvent(state, result));
  } else {
    events.push("No events remaining in deck");
    logEvent(state, "Event deck is empty");
  }

  // Append to history
  state.history.push(createTurnRecord(state, events));

  return state;
}

/**
 * Phase 2: Player Actions Window
 * Duration: 60 seconds (configurable)
 * Players can place bets, play event cards, make patron commitments
 */
function phasePlayerActions(state: GameState): GameState {
  logEvent(state, "Player actions window open");

  const events: string[] = ["Player actions window opened"];

  // Reset actionsThisTurn for all players
  Object.values(state.playerStates).forEach((player) => {
    player.actionsThisTurn = [];
  });

  // [SPEC] Section 7: Calculate and store odds at the start of Phase 2
  const oddsSnapshot = calculateOdds(state);
  state.oddsHistory.push(oddsSnapshot);

  logEvent(state, "Odds calculated and updated");
  events.push("Odds updated for betting");

  // Player action handling is event-driven in the full implementation
  // For simulation/testing, players can call playEventCard() directly during this phase
  // In the real game, this phase would wait for player inputs via WebSocket

  logEvent(state, "Waiting for player actions...");
  events.push("Players may now act");

  state.history.push(createTurnRecord(state, events));

  return state;
}

/**
 * Phase 3: Agent Deliberation
 * Each agent evaluates current state and produces an AgentAction
 */
async function phaseAgentDeliberation(state: GameState): Promise<GameState> {
  logEvent(state, "Agents deliberating");

  const events: string[] = ["Agent deliberation phase"];

  // Import agent intelligence (Step 6)
  const intelligence = createAgentIntelligence("rule-based");

  const agentDecisions: import("../types/agent").AgentDecision[] = [];

  // Each agent deliberates independently
  for (const faction of Object.values(state.factions)) {
    for (const agent of faction.agents) {
      try {
        const { action, rationale } = await intelligence.deliberate(agent, state);

        const decision = {
          agentId: agent.id,
          factionId: faction.id,
          action,
          rationale
        };

        agentDecisions.push(decision);

        // Emit to Summoner Analytics
        emitAgentDecision(state, decision);
      } catch (error) {
        events.push(`⚠️  ${agent.name} failed to deliberate: ${error}`);
      }
    }
  }

  events.push(`${agentDecisions.length} agents completed deliberation`);
  logEvent(state, `${agentDecisions.length} agents produced decisions`);

  // Store decisions in current turn record
  const turnRecord = createTurnRecord(state, events);
  turnRecord.agentDecisions = agentDecisions;
  state.history.push(turnRecord);

  return state;
}

/**
 * Phase 4: Agent Negotiation
 * Agents broadcast and respond to alliance proposals
 */
function phaseAgentNegotiation(state: GameState): GameState {
  logEvent(state, "Agent negotiation phase");

  const events: string[] = ["Alliance negotiation phase"];

  // Get agent decisions from the most recent deliberation phase (Step 7)
  const recentDeliberations = state.history
    .slice()
    .reverse()
    .find((record) => record.phase === "agent_deliberation");

  const agentDecisions = recentDeliberations?.agentDecisions || [];

  if (agentDecisions.length > 0) {
    // Import and use negotiation resolution
    const { alliances, results } = resolveNegotiations(agentDecisions, state);

    // Merge results into events
    events.push(...results);
    results.forEach((result) => logEvent(state, result));

    if (alliances.length > 0) {
      events.push(`${alliances.length} new alliance(s) formed this turn`);
    }
  } else {
    events.push("No alliance proposals this turn");
    logEvent(state, "No alliance proposals to process");
  }

  state.history.push(createTurnRecord(state, events));

  return state;
}

/**
 * Phase 5: Agent Action
 * Execute all AgentAction values (attacks, reinforcements, investments)
 */
function phaseAgentAction(state: GameState): GameState {
  logEvent(state, "Agent action execution");

  const events: string[] = ["Agent actions being executed"];

  // Get agent decisions from the most recent deliberation phase
  // In MVP, we don't have actual deliberations yet, so this will be empty
  // This will be populated in Step 6 when we implement agent deliberation
  const recentDeliberations = state.history
    .slice()
    .reverse()
    .find((record) => record.phase === "agent_deliberation");

  const agentDecisions = recentDeliberations?.agentDecisions || [];

  if (agentDecisions.length > 0) {
    // Import and use combat resolution (Step 4: Territory control + attack resolution)
    const { state: updatedState, results } = resolveActions(agentDecisions, state);

    // Merge results into events
    events.push(...results);
    results.forEach((result) => logEvent(state, result));

    // Update state reference
    Object.assign(state, updatedState);
  } else {
    events.push("No agent actions to execute");
    logEvent(state, "No agent actions this turn");
  }

  state.history.push(createTurnRecord(state, events));

  return state;
}

/**
 * Phase 6: Resolution
 * Apply territory changes, recalculate resources, evaluate bets, check win condition
 */
async function phaseResolution(state: GameState): Promise<GameState> {
  logEvent(state, "Resolving turn outcomes");

  const events: string[] = ["Turn resolution phase"];

  // TODO: Step 1 - Apply territory control changes
  // TODO: Step 2 - Recalculate faction resources
  // TODO: Step 3 - Fire ripple effects

  // Step 4 - Resolve bets
  const { resolvedBets, results: betResults } = resolveBets(state);
  if (betResults.length > 0) {
    events.push(...betResults);
    betResults.forEach((result) => logEvent(state, result));
  }

  // Award influence points to players
  const ipResults = awardInfluencePoints(state, events);
  if (ipResults.length > 0) {
    events.push(...ipResults);
    ipResults.forEach((result) => logEvent(state, result));
  }

  // Apply patron benefits (increment patronBacking)
  const patronResults = applyPatronBenefits(state);
  if (patronResults.length > 0) {
    events.push(...patronResults);
    patronResults.forEach((result) => logEvent(state, result));
  }

  // Apply personality drift to all agents
  const { results: driftResults } = driftPersonalities(state);
  if (driftResults.length > 0) {
    events.push(...driftResults);
    driftResults.forEach((result) => logEvent(state, result));
  }

  // TODO: Step 7 - Check win condition (moved to phaseEraSummary)
  // TODO: Step 8 - Append full TurnRecord

  events.push("Recalculating faction resources");

  state.history.push(createTurnRecord(state, events));

  // Advance turn counter
  state.currentTurn += 1;

  // Capture hash for the new turn (for events in era_summary and beyond)
  state.currentTurnStateHash = await generateStateHash(state);

  return state;
}

/**
 * Phase 7: Era Summary
 * Fires every 5 turns, produces EraCard and narrative summary
 */
async function phaseEraSummary(state: GameState): Promise<GameState> {
  logEvent(state, "Generating era summary");

  const events: string[] = [`Era ${state.currentEra} summary`];

  // TODO: Implement full era summary generation (Step 12: Era summary + narrative)
  // For now, just log

  events.push(`Era ${state.currentEra} complete`);
  events.push(`Turns ${state.currentTurn - 4} to ${state.currentTurn}`);

  logEvent(state, `Era ${state.currentEra} complete`);

  // Generate EraCard for this era
  const eraCard = generateEraCard(state, state.currentEra);
  state.eraCards.push(eraCard);

  // Log narrative summary
  events.push(`\n📖 Era ${state.currentEra} Summary:`);
  events.push(eraCard.narrativeSummary);
  events.push(`   Leader: ${state.factions[eraCard.leaderFaction].name}`);
  events.push(`   Biggest gain: ${state.factions[eraCard.biggestGain.factionId].name} (+${eraCard.biggestGain.territoriesGained})`);
  if (eraCard.biggestLoss.territoriesLost > 0) {
    events.push(`   Biggest loss: ${state.factions[eraCard.biggestLoss.factionId].name} (-${eraCard.biggestLoss.territoriesLost})`);
  }
  events.push(`   MVP: ${eraCard.mvpAgent.agentId ? eraCard.mvpAgent.agentId : 'None'} (${eraCard.mvpAgent.reason})`);

  logEvent(state, `Era ${state.currentEra} narrative generated`);

  // Expire unplayed event cards
  const expireResults = expireUnplayedCards(state);
  if (expireResults.length > 0) {
    events.push(...expireResults);
    expireResults.forEach((result) => logEvent(state, result));
  }

  // Apply patron era effects (resource bonuses, reputation shield costs, etc.)
  const patronEraResults = applyPatronEraEffects(state);
  if (patronEraResults.length > 0) {
    events.push(...patronEraResults);
    patronEraResults.forEach((result) => logEvent(state, result));
  }

  // Recapture hash after patron effects so era_summary event has correct hash
  state.currentTurnStateHash = await generateStateHash(state);

  // Emit to Summoner Analytics AFTER all state modifications
  emitEraSummary(state, eraCard);

  // Replenish player event cards
  Object.values(state.playerStates).forEach((player) => {
    if (state.eventDeck.length > 0 && !player.currentDrawnCard) {
      const card = state.eventDeck.shift()!;
      player.currentDrawnCard = card;
      events.push(`${player.playerId} drew a new event card (${card.tier === 1 ? "Tier 1" : card.tier === 2 ? "Tier 2" : "Tier 3"})`);
    }
  });

  // [RULE] Check win condition at the end of each era
  const winner = checkWinCondition(state);
  if (winner) {
    state.winner = winner;
    events.push(`🏆 ${state.factions[winner].name} wins the game!`);
    logEvent(state, `Winner: ${state.factions[winner].name}`);

    // Emit to Summoner Analytics
    emitGameOver(state, winner);
  }

  state.history.push(createTurnRecord(state, events));

  // Advance era counter
  state.currentEra += 1;

  // Recapture hash so next executeTurn uses consistent hash
  // (next executeTurn will start with event_reveal phase)
  state.currentTurnStateHash = await generateStateHash(state);

  return state;
}

/**
 * Check win condition at the end of each era
 * [RULE] A faction wins when it controls ≥70% of territories for 2 consecutive eras
 * [RULE] If no faction achieves 70% after 20 eras, faction with most territories wins
 *        Tiebreaker: highest reputation score
 */
function checkWinCondition(state: GameState): FactionId | null {
  const totalTerritories = Object.keys(state.territories).length;
  const threshold = 0.7; // 70%
  const maxEras = 20;

  // Calculate territory percentages for all factions
  const factionTerritoryPercentages: Record<FactionId, number> = {};
  Object.values(state.factions).forEach((faction) => {
    factionTerritoryPercentages[faction.id] = faction.territories.length / totalTerritories;
  });

  // Find faction with ≥70% control (if any)
  let dominantFaction: FactionId | null = null;
  for (const [factionId, percentage] of Object.entries(factionTerritoryPercentages)) {
    if (percentage >= threshold) {
      dominantFaction = factionId;
      break; // Only one faction can have ≥70% at a time
    }
  }

  // Check for 2 consecutive eras of dominance
  if (dominantFaction && dominantFaction === state.lastEraDominantFaction) {
    // Same faction has had ≥70% for 2 consecutive eras
    return dominantFaction;
  }

  // Update tracking for next era
  state.lastEraDominantFaction = dominantFaction;

  // [RULE] If 20 eras have passed, faction with most territories wins
  if (state.currentEra >= maxEras) {
    let maxTerritories = 0;
    let winningFaction: FactionId | null = null;

    Object.values(state.factions).forEach((faction) => {
      const territoryCount = faction.territories.length;
      if (
        territoryCount > maxTerritories ||
        (territoryCount === maxTerritories &&
          winningFaction &&
          faction.reputation > state.factions[winningFaction].reputation)
      ) {
        maxTerritories = territoryCount;
        winningFaction = faction.id;
      }
    });

    return winningFaction;
  }

  return null;
}

/**
 * Execute one phase of the game
 */
async function executePhase(state: GameState): Promise<GameState> {
  const phase = state.phase;

  switch (phase) {
    case "event_reveal":
      return phaseEventReveal(state);

    case "player_actions":
      return phasePlayerActions(state);

    case "agent_deliberation":
      return await phaseAgentDeliberation(state);

    case "agent_negotiation":
      return phaseAgentNegotiation(state);

    case "agent_action":
      return phaseAgentAction(state);

    case "resolution":
      return await phaseResolution(state);

    case "era_summary":
      return await phaseEraSummary(state);

    case "game_over":
      logEvent(state, "Game over");
      return state;

    default:
      throw new Error(`Cannot execute unknown phase: ${phase}`);
  }
}

/**
 * Advance to the next phase
 */
function advancePhase(state: GameState): GameState {
  const nextPhase = getNextPhase(state);
  state.phase = nextPhase;

  logEvent(state, `Advancing to phase: ${nextPhase}`);

  return state;
}

/**
 * Execute one complete turn (all phases until back to event_reveal or game_over)
 */
export async function executeTurn(state: GameState): Promise<GameState> {
  const startingTurn = state.currentTurn;

  // Execute current phase
  state = await executePhase(state);

  // Keep advancing through phases until we loop back or hit game_over
  while (state.phase !== "game_over") {
    state = advancePhase(state);
    state = await executePhase(state);

    // If we've looped back to event_reveal, we're done with this turn
    if (state.phase === "event_reveal" && state.currentTurn > startingTurn) {
      break;
    }
  }

  return state;
}

/**
 * Main game loop entry point
 * Runs the game until phase = "game_over"
 *
 * @param state - Initial game state from initializeGame()
 * @param maxTurns - Maximum turns to run (safety limit, default 100)
 * @returns Final game state
 */
export async function runGame(state: GameState, maxTurns: number = 100): Promise<GameState> {
  console.log("\n=== Starting Fork: A Chronicle of Alternate Histories ===\n");
  console.log(`Epoch: ${state.epoch.name}`);
  console.log(`Seed: ${state.seed}`);
  console.log(`Factions: ${Object.keys(state.factions).length}`);
  console.log(`Players: ${Object.keys(state.playerStates).length}\n`);

  let turnCount = 0;

  while (state.phase !== "game_over" && turnCount < maxTurns) {
    console.log(`\n--- Turn ${state.currentTurn} ---`);

    state = await executeTurn(state);
    turnCount++;

    // Safety check
    if (turnCount >= maxTurns) {
      console.log(`\n⚠️  Reached maximum turn limit (${maxTurns})`);
      state.phase = "game_over";
      break;
    }
  }

  console.log("\n=== Game Over ===\n");

  if (state.winner) {
    console.log(`🏆 Winner: ${state.factions[state.winner].name}`);
    console.log(`Total turns: ${state.currentTurn - 1}`);
    console.log(`Total eras: ${state.currentEra - 1}`);
  } else {
    console.log("No winner determined");
  }

  console.log(`History entries: ${state.history.length}\n`);

  return state;
}

/**
 * Run a single phase and return updated state
 * Useful for testing and step-by-step execution
 */
export async function stepPhase(state: GameState): Promise<GameState> {
  state = await executePhase(state);
  state = advancePhase(state);
  return state;
}
