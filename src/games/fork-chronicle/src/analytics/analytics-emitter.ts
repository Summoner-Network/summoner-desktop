/**
 * Analytics event emitters for Fork: A Chronicle of Alternate Histories
 * Helper functions to emit events to Summoner Analytics bridge
 */

import type { GameState } from "../types/game-state";
import type { AgentDecision } from "../types/agent";
import type { EraCard } from "../types/game-state";
import { generateStateHash } from "./summoner-analytics-bridge";
import type { SummonerAnalyticsEvent } from "./summoner-analytics-bridge";

/**
 * Emit agent decision event
 */
export function emitAgentDecision(state: GameState, decision: AgentDecision): void {
  const stateHash = state.currentTurnStateHash;

  const event: SummonerAnalyticsEvent = {
    gameId: state.gameId,
    turn: state.currentTurn,
    era: state.currentEra,
    eventType: "agent_decision",
    payload: {
      agentId: decision.agentId,
      factionId: decision.factionId,
      turn: state.currentTurn,
      era: state.currentEra,
      action: decision.action,
      rationale: decision.rationale,
      stateHash,
    },
    timestamp: Date.now(),
    stateHash,
  };

  state.analytics.emit(event);
}

/**
 * Emit territory changed event
 */
export function emitTerritoryChanged(
  state: GameState,
  territoryId: string,
  fromFaction: string | null,
  toFaction: string
): void {
  const stateHash = state.currentTurnStateHash;

  const event: SummonerAnalyticsEvent = {
    gameId: state.gameId,
    turn: state.currentTurn,
    era: state.currentEra,
    eventType: "territory_changed",
    payload: {
      territoryId,
      fromFaction,
      toFaction,
    },
    timestamp: Date.now(),
    stateHash,
  };

  state.analytics.emit(event);
}

/**
 * Emit alliance formed event
 */
export function emitAllianceFormed(
  state: GameState,
  allianceId: string,
  factionIds: string[]
): void {
  const stateHash = state.currentTurnStateHash;

  const event: SummonerAnalyticsEvent = {
    gameId: state.gameId,
    turn: state.currentTurn,
    era: state.currentEra,
    eventType: "alliance_formed",
    payload: {
      allianceId,
      factionIds,
    },
    timestamp: Date.now(),
    stateHash,
  };

  state.analytics.emit(event);
}

/**
 * Emit alliance broken event
 */
export function emitAllianceBroken(
  state: GameState,
  allianceId: string,
  reason: string
): void {
  const stateHash = state.currentTurnStateHash;

  const event: SummonerAnalyticsEvent = {
    gameId: state.gameId,
    turn: state.currentTurn,
    era: state.currentEra,
    eventType: "alliance_broken",
    payload: {
      allianceId,
      reason,
    },
    timestamp: Date.now(),
    stateHash,
  };

  state.analytics.emit(event);
}

/**
 * Emit event injected event
 */
export function emitEventInjected(
  state: GameState,
  playerId: string,
  eventId: string,
  eventTitle: string
): void {
  const stateHash = state.currentTurnStateHash;

  const event: SummonerAnalyticsEvent = {
    gameId: state.gameId,
    turn: state.currentTurn,
    era: state.currentEra,
    eventType: "event_injected",
    payload: {
      playerId,
      eventId,
      eventTitle,
    },
    timestamp: Date.now(),
    stateHash,
  };

  state.analytics.emit(event);
}

/**
 * Emit era summary event
 */
export function emitEraSummary(state: GameState, eraCard: EraCard): void {
  const stateHash = state.currentTurnStateHash;

  const event: SummonerAnalyticsEvent = {
    gameId: state.gameId,
    turn: state.currentTurn,
    era: state.currentEra,
    eventType: "era_summary",
    payload: {
      era: eraCard.era,
      leaderFaction: eraCard.leaderFaction,
      narrativeSummary: eraCard.narrativeSummary,
    },
    timestamp: Date.now(),
    stateHash,
  };

  state.analytics.emit(event);
}

/**
 * Emit game over event
 */
export function emitGameOver(state: GameState, winner: string | null): void {
  const stateHash = state.currentTurnStateHash;

  const event: SummonerAnalyticsEvent = {
    gameId: state.gameId,
    turn: state.currentTurn,
    era: state.currentEra,
    eventType: "game_over",
    payload: {
      winner,
      totalTurns: state.currentTurn,
      totalEras: state.currentEra,
    },
    timestamp: Date.now(),
    stateHash,
  };

  state.analytics.emit(event);
}

/**
 * Emit bet resolved event
 */
export function emitBetResolved(
  state: GameState,
  playerId: string,
  betType: string,
  targetId: string,
  won: boolean,
  payout: number
): void {
  const stateHash = state.currentTurnStateHash;

  const event: SummonerAnalyticsEvent = {
    gameId: state.gameId,
    turn: state.currentTurn,
    era: state.currentEra,
    eventType: "bet_resolved",
    payload: {
      playerId,
      betType,
      targetId,
      won,
      payout,
    },
    timestamp: Date.now(),
    stateHash,
  };

  state.analytics.emit(event);
}

/**
 * Emit patron activated event
 */
export function emitPatronActivated(
  state: GameState,
  playerId: string,
  factionId: string,
  benefit: string
): void {
  const stateHash = state.currentTurnStateHash;

  const event: SummonerAnalyticsEvent = {
    gameId: state.gameId,
    turn: state.currentTurn,
    era: state.currentEra,
    eventType: "patron_activated",
    payload: {
      playerId,
      factionId,
      benefit,
    },
    timestamp: Date.now(),
    stateHash,
  };

  state.analytics.emit(event);
}
