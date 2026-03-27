/**
 * Player data types for Fork: A Chronicle of Alternate Histories
 * Section 1: Data Schemas - PlayerAction & PlayerState
 */

import type { FactionId } from "./faction";
import type { HistoricalEvent } from "./event";

export type BetType =
  | "faction_wins" // Target faction wins the game
  | "faction_controls_continent" // Target faction controls a full continent by game end
  | "alliance_breaks" // Named alliance breaks before game ends
  | "first_continent" // Target faction is first to control any full continent
  | "faction_eliminated"; // Target faction is eliminated

export interface BetAction {
  type: "bet";
  playerId: string;
  betType: BetType;
  targetId: string; // FactionId or other target depending on betType
  stake: number; // Points wagered
  odds: number; // Snapshot odds at time of bet
  placedOnTurn: number;
}

export interface EventInjectionAction {
  type: "event_injection";
  playerId: string;
  eventId: string; // Must be from player's current drawn card
  injectedOnTurn: number;
  cost: number; // Influence points spent (varies by event tier)
}

export type PatronBenefit =
  | "resource_bonus" // +10 to one resource per era
  | "reputation_shield" // Reputation cannot drop below 30 while patron active
  | "negotiation_edge"; // +15 to all negotiation rolls for 2 eras

export interface PatronAction {
  type: "patron_backing";
  playerId: string;
  targetFactionId: FactionId;
  investmentAmount: number; // Influence points committed
  benefit: PatronBenefit;
}

export type PlayerAction = BetAction | EventInjectionAction | PatronAction;

export interface PlayerState {
  playerId: string;
  influencePoints: number; // Currency for all player actions
  currentDrawnCard: HistoricalEvent | null; // Secret until played
  bets: BetAction[];
  patronCommitments: PatronAction[];
  actionsThisTurn: PlayerAction[];
}

export interface PlayerConfig {
  playerId: string;
  displayName: string;
  startingInfluencePoints: number; // Default: 100
}

export type DirectorTitle =
  | "the_kingmaker" // Won primarily through patron backing
  | "the_arsonist" // Injected 3+ Tier 3 events
  | "the_oracle" // Won 4+ bets in a single game
  | "the_historian" // Backed the winning faction from turn 1
  | "the_contrarian" // Backed an underdog (opening odds > 4.0) that won
  | "the_patron" // Patron-backed faction won the game
  | "the_director"; // Default title

export interface PlayerScore {
  playerId: string;
  influencePointsEarned: number;
  betsWon: number;
  betsLost: number;
  netBettingReturn: number; // IP won minus IP wagered
  patronEffectiveness: number; // % of turns patron faction gained territory
  eventsInjected: number;
  tier3EventsPlayed: number;
  directorTitle: DirectorTitle;
  totalScore: number;
}
