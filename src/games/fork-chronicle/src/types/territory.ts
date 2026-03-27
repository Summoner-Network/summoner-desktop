/**
 * Territory data types for Fork: A Chronicle of Alternate Histories
 * Section 1: Data Schemas - Territory
 */

export type Continent =
  | "europe"
  | "asia"
  | "africa"
  | "north_america"
  | "south_america"
  | "oceania"
  | "middle_east";

export interface ResourceBundle {
  food: number; // 0–100
  industry: number; // 0–100
  tech: number; // 0–100
}

export interface Modifier {
  type: string;
  value: number;
  source: string;
  expiresOnTurn?: number | null;
}

export interface Territory {
  id: string; // ISO 3166-1 alpha-3 country code e.g. "FRA"
  name: string; // Display name e.g. "France"
  continent: Continent;
  adjacencies: string[]; // List of adjacent territory IDs (land borders + sea lanes)
  resources: ResourceBundle; // Starting resource values
  strength: number; // Military strength 1–100
  controlledBy: string | null; // FactionId | null
  contestedBy: string | null; // FactionId | null - Set during attack resolution
  historicalModifiers: Modifier[];
}
