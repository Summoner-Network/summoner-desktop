/**
 * Alliance data types for Fork: A Chronicle of Alternate Histories
 * Section 1: Data Schemas - Alliance
 */

import type { FactionId } from "./faction";
import type { AllianceTerm } from "./agent";

export interface Alliance {
  id: string;
  factionIds: FactionId[]; // 2+ factions
  formedOnTurn: number;
  terms: AllianceTerm[];
  trustScore: number; // 0–100, degrades if terms are violated
  status: "active" | "broken" | "expired";
}
