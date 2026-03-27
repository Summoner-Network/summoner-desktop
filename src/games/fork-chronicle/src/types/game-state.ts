/**
 * GameState data types for Fork: A Chronicle of Alternate Histories
 * Section 1: Data Schemas - GameState & related types
 */

import type { Epoch } from "./epoch";
import type { Territory } from "./territory";
import type { Faction, FactionId } from "./faction";
import type { Alliance } from "./alliance";
import type { HistoricalEvent, ActiveEvent } from "./event";
import type { PlayerState, PlayerConfig } from "./player";
import type { AgentDecision } from "./agent";
import type { SummonerAnalyticsBridge } from "../analytics/summoner-analytics-bridge";

export type GamePhase =
  | "setup"
  | "event_reveal"
  | "player_actions" // Bet / Roll / Back window
  | "agent_deliberation"
  | "agent_negotiation"
  | "agent_action"
  | "resolution"
  | "era_summary" // Fires every 5 turns
  | "game_over";

export interface TurnRecord {
  turn: number;
  era: number;
  phase: GamePhase;
  events: string[]; // Human-readable log entries
  agentDecisions: AgentDecision[];
  stateSnapshot: Partial<GameState>;
}

export interface GameState {
  gameId: string;
  seed: string; // Random seed for reproducibility
  epoch: Epoch;
  currentTurn: number;
  currentEra: number; // Era = every 5 turns
  phase: GamePhase;
  territories: Record<string, Territory>;
  factions: Record<FactionId, Faction>;
  alliances: Alliance[];
  eventDeck: HistoricalEvent[]; // Shuffled at game start
  eventDiscard: HistoricalEvent[];
  activeEvents: ActiveEvent[]; // Currently in effect
  playerStates: Record<string, PlayerState>;
  history: TurnRecord[]; // Append-only audit log
  oddsHistory: OddsSnapshot[]; // Odds snapshots for each turn (for sparkline display)
  eraCards: EraCard[]; // Era summaries for chronicle
  winner: FactionId | null;
  lastEraDominantFaction: FactionId | null; // Tracks faction with ≥70% in previous era
  analytics: SummonerAnalyticsBridge; // Analytics bridge for audit trail
  currentTurnStateHash: string; // State hash for current turn (set at turn start)
}

export interface GameConfig {
  epochId: string;
  factionCount: 2 | 3 | 4;
  players: PlayerConfig[];
  eventPackIds: string[]; // ["base"] for MVP; community packs added later
  seed?: string; // Optional fixed seed for replays
  victoryConditionId?: string; // defaults to "territory_majority"
}

export interface EraCard {
  era: number;
  turns: number[];
  leaderFaction: FactionId;
  biggestGain: { factionId: FactionId; territoriesGained: number };
  biggestLoss: { factionId: FactionId; territoriesLost: number };
  alliancesFormed: number;
  alliancesBroken: number;
  eventsInjected: number;
  mvpAgent: { agentId: string; reason: string };
  narrativeSummary: string;
}

export interface OddsSnapshot {
  turn: number;
  odds: Record<string, Record<string, number>>; // betType → targetId → multiplier
}
