/**
 * Epoch data types for Fork: A Chronicle of Alternate Histories
 * Section 1: Data Schemas - Epoch
 */

import type { FactionId } from "./faction";

export interface UnlockCondition {
  type: string;
  requirement: unknown;
}

export interface Epoch {
  id: string;
  name: string; // e.g. "1914 — The World at the Brink"
  year: number;
  description: string;
  startingTerritoryControl: Record<string, FactionId>; // Pre-assigned at epoch start
  startingStrengths: Record<string, number>;
  eventPool: string[]; // Event IDs valid for this epoch
  unlockCondition: UnlockCondition | null; // null = available from start
}

// [RULE] MVP ships with 3 epochs. Additional epochs are unlocked by win conditions.
// Starting epochs: "1914_brink", "1945_aftermath", "1991_unipolar"
