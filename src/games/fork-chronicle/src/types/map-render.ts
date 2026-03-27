/**
 * Map rendering payload types for Fork: A Chronicle of Alternate Histories
 * Section 9: Map Rendering Contract
 */

import type { FactionId } from "./faction";

export interface MapRenderPayload {
  territories: Record<
    string,
    {
      controlledBy: FactionId | null;
      strength: number;
      contested: boolean;
      activeEffects: string[];
    }
  >;
  factionColors: Record<FactionId, string>;
  highlightedTerritories?: string[]; // For event effect animations
}
