/**
 * Faction data types for Fork: A Chronicle of Alternate Histories
 * Section 1: Data Schemas - Faction
 */

import type { Agent } from "./agent";
import type { ResourceBundle } from "./territory";

export type FactionId = string; // e.g. "eastern_coalition"

export interface FactionStats {
  territoriesControlled: number;
  alliances: FactionId[];
  roundsInLead: number;
  betrayalsCommitted: number;
  betrayalsSuffered: number;
}

export interface Faction {
  id: FactionId;
  name: string; // Display name
  color: string; // Hex color for map rendering
  agents: Agent[];
  territories: string[]; // Controlled territory IDs
  resources: ResourceBundle;
  reputation: number; // 0–100, affects negotiation outcomes
  patronBacking: number; // Accumulated patron investment points
  stats: FactionStats;
}
