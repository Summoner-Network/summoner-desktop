/**
 * Personality drift system for Fork: A Chronicle of Alternate Histories
 * Section 6: Agent Personality Drift
 */

import type { GameState } from "../types/game-state";
import type { Agent } from "../types/agent";
import type { FactionId } from "../types/faction";

/**
 * Track territory changes for drift calculations
 */
interface TerritoryChange {
  factionId: FactionId;
  gained: number;
  lost: number;
}

/**
 * Track drift events for statistics
 */
export interface DriftEvent {
  agentId: string;
  rule: string;
  trait: string;
  change: number;
}

/**
 * Clamp a trait value to the valid range [0.0, 1.0]
 */
function clampTrait(value: number): number {
  return Math.max(0.0, Math.min(1.0, value));
}

/**
 * Apply personality drift rules to an agent
 * [SPEC] Section 6: All drift rules
 */
function applyDrift(
  agent: Agent,
  factionId: FactionId,
  state: GameState,
  territoryChanges: Map<FactionId, TerritoryChange>
): DriftEvent[] {
  const driftEvents: DriftEvent[] = [];
  const currentTurn = state.currentTurn;
  const faction = state.factions[factionId];

  // RULE 1: Lost territory this turn
  const changes = territoryChanges.get(factionId);
  if (changes && changes.lost > 0) {
    agent.personality.aggression += 0.05;
    driftEvents.push({
      agentId: agent.id,
      rule: "lost_territory",
      trait: "aggression",
      change: 0.05
    });
  }

  // RULE 2: Was betrayed this turn (alliance broken by other party)
  // Check agent's memory for recent betrayals
  const recentBetrayal = agent.memory.find(
    (m) => m.turn === currentTurn - 1 && m.interactionType === "betrayal"
  );

  if (recentBetrayal) {
    agent.personality.aggression += 0.10;
    agent.personality.loyalty -= 0.08;
    driftEvents.push({
      agentId: agent.id,
      rule: "betrayed",
      trait: "aggression",
      change: 0.10
    });
    driftEvents.push({
      agentId: agent.id,
      rule: "betrayed",
      trait: "loyalty",
      change: -0.08
    });
  }

  // RULE 3: Alliance held for 3+ eras
  // Find oldest active alliance
  const factionAlliances = state.alliances.filter(
    (a) => a.status === "active" && a.factionIds.includes(factionId)
  );

  factionAlliances.forEach((alliance) => {
    const erasSinceFormed = Math.floor((currentTurn - alliance.formedOnTurn) / 5);
    if (erasSinceFormed >= 3) {
      agent.personality.loyalty += 0.05;
      driftEvents.push({
        agentId: agent.id,
        rule: "long_alliance",
        trait: "loyalty",
        change: 0.05
      });
    }
  });

  // RULE 4: Attack succeeded this turn
  // Check agent's memory for recent successful attacks
  const recentSuccessfulAttack = agent.memory.find(
    (m) => m.turn === currentTurn - 1 && m.interactionType === "attack" && m.outcome === "succeeded"
  );

  if (recentSuccessfulAttack) {
    agent.personality.aggression += 0.03;
    agent.personality.expansionism += 0.04;
    driftEvents.push({
      agentId: agent.id,
      rule: "attack_succeeded",
      trait: "aggression",
      change: 0.03
    });
    driftEvents.push({
      agentId: agent.id,
      rule: "attack_succeeded",
      trait: "expansionism",
      change: 0.04
    });
  }

  // RULE 5: Attack failed this turn
  // Check agent's memory for recent failed attacks
  const recentFailedAttack = agent.memory.find(
    (m) => m.turn === currentTurn - 1 && m.interactionType === "attack" && m.outcome === "failed"
  );

  if (recentFailedAttack) {
    agent.personality.aggression -= 0.05;
    agent.personality.riskTolerance -= 0.04;
    driftEvents.push({
      agentId: agent.id,
      rule: "attack_failed",
      trait: "aggression",
      change: -0.05
    });
    driftEvents.push({
      agentId: agent.id,
      rule: "attack_failed",
      trait: "riskTolerance",
      change: -0.04
    });
  }

  // RULE 6: Faction reputation > 80
  if (faction.reputation > 80) {
    agent.personality.loyalty += 0.02;
    driftEvents.push({
      agentId: agent.id,
      rule: "high_reputation",
      trait: "loyalty",
      change: 0.02
    });
  }

  // RULE 7: Faction reputation < 30
  if (faction.reputation < 30) {
    agent.personality.riskTolerance += 0.06;
    driftEvents.push({
      agentId: agent.id,
      rule: "low_reputation",
      trait: "riskTolerance",
      change: 0.06
    });
  }

  // Clamp all trait values to [0.0, 1.0]
  agent.personality.aggression = clampTrait(agent.personality.aggression);
  agent.personality.expansionism = clampTrait(agent.personality.expansionism);
  agent.personality.loyalty = clampTrait(agent.personality.loyalty);
  agent.personality.riskTolerance = clampTrait(agent.personality.riskTolerance);

  return driftEvents;
}

/**
 * Calculate territory changes for all factions this turn
 */
function calculateTerritoryChanges(state: GameState): Map<FactionId, TerritoryChange> {
  const changes = new Map<FactionId, TerritoryChange>();

  // Initialize all factions
  Object.keys(state.factions).forEach((factionId) => {
    changes.set(factionId as FactionId, { factionId: factionId as FactionId, gained: 0, lost: 0 });
  });

  // Look at recent history for territory transfers
  const recentTurn = state.history
    .slice()
    .reverse()
    .find((record) => record.turn === state.currentTurn - 1);

  if (recentTurn) {
    recentTurn.events.forEach((event) => {
      // Parse conquest events
      if (event.includes("conquered")) {
        // Format: "faction_X agent conquered Territory from Faction Y"
        const conquestMatch = event.match(/faction_(\d+).*conquered.*from Faction (\d+)/);
        if (conquestMatch) {
          const winnerFactionId = `faction_${conquestMatch[1]}` as FactionId;
          const loserFactionId = `faction_${conquestMatch[2]}` as FactionId;

          const winnerChange = changes.get(winnerFactionId);
          const loserChange = changes.get(loserFactionId);

          if (winnerChange) {
            winnerChange.gained += 1;
          }
          if (loserChange) {
            loserChange.lost += 1;
          }
        }
      }
    });
  }

  return changes;
}

/**
 * Apply personality drift to all agents
 * Called at end of Resolution phase each turn
 */
export function driftPersonalities(state: GameState): { results: string[]; driftEvents: DriftEvent[] } {
  const results: string[] = [];
  const allDriftEvents: DriftEvent[] = [];

  // Calculate territory changes
  const territoryChanges = calculateTerritoryChanges(state);

  // Apply drift to all agents
  Object.values(state.factions).forEach((faction) => {
    faction.agents.forEach((agent) => {
      const driftEvents = applyDrift(agent, faction.id, state, territoryChanges);

      if (driftEvents.length > 0) {
        allDriftEvents.push(...driftEvents);

        // Log significant drift (optional, can be verbose)
        // results.push(`${agent.name} personality drifted (${driftEvents.length} changes)`);
      }
    });
  });

  // Summary message if any drift occurred
  if (allDriftEvents.length > 0) {
    results.push(`🎭 Personality drift: ${allDriftEvents.length} trait changes across ${new Set(allDriftEvents.map(e => e.agentId)).size} agents`);
  }

  return { results, driftEvents: allDriftEvents };
}

/**
 * Get drift statistics from a list of drift events
 */
export function getDriftStatistics(driftEvents: DriftEvent[]): {
  ruleFrequency: Record<string, number>;
  traitChanges: Record<string, { total: number; positive: number; negative: number }>;
} {
  const ruleFrequency: Record<string, number> = {};
  const traitChanges: Record<string, { total: number; positive: number; negative: number }> = {};

  driftEvents.forEach((event) => {
    // Count rule frequency
    ruleFrequency[event.rule] = (ruleFrequency[event.rule] || 0) + 1;

    // Count trait changes
    if (!traitChanges[event.trait]) {
      traitChanges[event.trait] = { total: 0, positive: 0, negative: 0 };
    }

    traitChanges[event.trait].total += Math.abs(event.change);
    if (event.change > 0) {
      traitChanges[event.trait].positive += event.change;
    } else {
      traitChanges[event.trait].negative += Math.abs(event.change);
    }
  });

  return { ruleFrequency, traitChanges };
}
