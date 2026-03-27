/**
 * Fork: A Chronicle of Alternate Histories
 * Type definitions barrel export
 *
 * This file exports all type definitions from Section 1 of the spec.
 */

// Territory types
export type { Continent, ResourceBundle, Modifier, Territory } from "./territory";

// Faction types
export type { FactionId, FactionStats, Faction } from "./faction";

// Agent types
export type {
  AgentArchetype,
  PersonalityProfile,
  InteractionMemory,
  Agent,
  AgentAction,
  AllianceTerm,
  AgentDecision
} from "./agent";

// Event types
export type {
  EventSource,
  EffectType,
  EventEffect,
  HistoricalEvent,
  ActiveEvent
} from "./event";

// Alliance types
export type { Alliance } from "./alliance";

// Player types
export type {
  BetType,
  BetAction,
  EventInjectionAction,
  PatronBenefit,
  PatronAction,
  PlayerAction,
  PlayerState,
  PlayerConfig,
  DirectorTitle,
  PlayerScore
} from "./player";

// Epoch types
export type { UnlockCondition, Epoch } from "./epoch";

// GameState types
export type {
  GamePhase,
  TurnRecord,
  GameState,
  GameConfig,
  EraCard,
  OddsSnapshot
} from "./game-state";

// Map rendering types
export type { MapRenderPayload } from "./map-render";
