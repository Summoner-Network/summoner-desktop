/**
 * Historical Event data types for Fork: A Chronicle of Alternate Histories
 * Section 1: Data Schemas - HistoricalEvent
 */

export type EventSource = "historical" | "counterfactual" | "community" | "future_projection";

export type EffectType =
  | "strength_delta" // ±N to territory strength
  | "resource_delta" // ±N to a resource
  | "control_transfer" // Transfer territory to a faction or neutral
  | "alliance_break" // Force dissolution of a specific alliance
  | "reputation_delta" // ±N to faction reputation
  | "spawn_territory" // Add a new territory to the map
  | "tech_boost"; // Multiply tech resource for a territory or faction

export interface EventEffect {
  type: EffectType;
  targetType: "territory" | "faction" | "global";
  targetId?: string; // Specific territory or faction; if null, applies globally
  magnitude: number; // Effect size, interpreted per EffectType
  description: string; // Human-readable description for audit log
}

export type EventTier = 1 | 2 | 3;

export interface HistoricalEvent {
  id: string;
  title: string; // e.g. "Byzantine Empire Survives"
  description: string; // Flavor text for UI display
  era: number | null; // If null, can fire in any era
  source: EventSource;
  tier: EventTier; // 1 (local, 10 IP), 2 (regional, 25 IP), 3 (global, 50 IP)
  ipCost: number; // IP cost to play this card
  effects: EventEffect[];
  rippleEffects: EventEffect[]; // Secondary effects that fire 1 era later
  probability: number; // 0.0–1.0, base draw probability from deck
  // Wikipedia metadata (optional)
  wikiYear?: number;
  wikiText?: string;
  wikiThumbnail?: string;
  wikiThumbnailDataUrl?: string;
}

export interface ActiveEvent {
  event: HistoricalEvent;
  activatedOnTurn: number;
  expiresOnTurn: number | null; // null = permanent
}
