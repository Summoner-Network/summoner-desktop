/**
 * Agent data types for Fork: A Chronicle of Alternate Histories
 * Section 1: Data Schemas - Agent
 */

import type { FactionId } from "./faction";

export type AgentArchetype = "conqueror" | "diplomat" | "economist" | "historian";

export interface PersonalityProfile {
  aggression: number; // 0.0–1.0
  loyalty: number; // 0.0–1.0
  riskTolerance: number; // 0.0–1.0
  expansionism: number; // 0.0–1.0
}

// [RULE] Personality values are set at game initialization and drift ±0.1 per era
// based on outcomes. A diplomat who is betrayed twice raises aggression by 0.15.

export interface InteractionMemory {
  turn: number;
  targetAgentId: string;
  interactionType: "alliance_offer" | "attack" | "trade" | "betrayal";
  outcome: "accepted" | "rejected" | "succeeded" | "failed";
}

export interface Agent {
  id: string;
  name: string;
  factionId: FactionId;
  archetype: AgentArchetype;
  homeTerritory: string; // Starting territory ID
  personality: PersonalityProfile;
  reputation: number; // 0–100, individual reputation score
  memory: InteractionMemory[];
}

export type AgentAction =
  | { type: "reinforce"; territoryId: string; amount: number }
  | { type: "attack"; fromTerritoryId: string; targetTerritoryId: string; strength: number }
  | { type: "propose_alliance"; targetFactionId: FactionId; terms: AllianceTerm[] }
  | { type: "break_alliance"; allianceId: string }
  | { type: "invest"; territoryId: string; resourceType: keyof import("./territory").ResourceBundle; amount: number }
  | { type: "pass" };

export interface AllianceTerm {
  type: "non_aggression" | "resource_share" | "joint_attack" | "defense_pact";
  durationEras: number | "indefinite";
}

export interface AgentDecision {
  agentId: string;
  factionId: FactionId;
  action: AgentAction;
  rationale: string; // Plain-language explanation for UI display
}
