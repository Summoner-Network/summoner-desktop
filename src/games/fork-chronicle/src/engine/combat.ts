/**
 * Combat and action resolution for Fork: A Chronicle of Alternate Histories
 * Section 3, Phase 5: Agent Action
 */

import type { GameState } from "../types/game-state";
import type { AgentAction, AgentDecision } from "../types/agent";
import type { FactionId } from "../types/faction";
import type { Alliance } from "../types/alliance";
import { SeededRandom } from "../utils/random";
import { emitTerritoryChanged, emitAllianceBroken } from "../analytics/analytics-emitter";
import { applyReputationFloor } from "./patron";

/**
 * Result of an attack action
 */
interface AttackResult {
  success: boolean;
  attackerFaction: FactionId;
  defenderFaction: FactionId;
  territoryId: string;
  attackerStrength: number;
  defenderStrength: number;
  roll: number;
  allianceBroken?: string; // Alliance ID if friendly fire occurred
  reputationPenalty?: number;
}

/**
 * Calculate alliance defense bonus for a territory
 * [RULE] alliance_defense_bonus = 0.15 per allied faction that controls an adjacent territory
 */
function calculateAllianceDefenseBonus(
  defendingFactionId: FactionId,
  territoryId: string,
  state: GameState
): number {
  const territory = state.territories[territoryId];
  if (!territory) return 0;

  // Find active alliances for the defending faction
  const activeAlliances = state.alliances.filter(
    (a) => a.status === "active" && a.factionIds.includes(defendingFactionId)
  );

  if (activeAlliances.length === 0) return 0;

  // Get all allied faction IDs
  const alliedFactionIds = new Set<FactionId>();
  activeAlliances.forEach((alliance) => {
    alliance.factionIds.forEach((factionId) => {
      if (factionId !== defendingFactionId) {
        alliedFactionIds.add(factionId);
      }
    });
  });

  // Count how many allied factions control adjacent territories
  let alliedNeighbors = 0;
  territory.adjacencies.forEach((adjacentTerritoryId) => {
    const adjacentTerritory = state.territories[adjacentTerritoryId];
    if (
      adjacentTerritory &&
      adjacentTerritory.controlledBy &&
      alliedFactionIds.has(adjacentTerritory.controlledBy)
    ) {
      alliedNeighbors++;
    }
  });

  return alliedNeighbors * 0.15;
}

/**
 * Check if an attack violates a non-aggression or defense pact alliance
 * Returns the alliance that would be violated, or null if attack is legal
 */
function checkFriendlyFireViolation(
  attackerFactionId: FactionId,
  defenderFactionId: FactionId,
  state: GameState
): Alliance | null {
  // Find active alliances between attacker and defender
  const relevantAlliances = state.alliances.filter(
    (alliance) =>
      alliance.status === "active" &&
      alliance.factionIds.includes(attackerFactionId) &&
      alliance.factionIds.includes(defenderFactionId)
  );

  // Check if any alliance has non-aggression or defense pact terms
  for (const alliance of relevantAlliances) {
    const hasProtectiveTerm = alliance.terms.some(
      (term) => term.type === "non_aggression" || term.type === "defense_pact"
    );
    if (hasProtectiveTerm) {
      return alliance;
    }
  }

  return null;
}

/**
 * Break an alliance and apply reputation penalty
 * [RULE] Attempting to attack an ally triggers break_alliance and applies -20 reputation penalty
 */
function breakAllianceFromFriendlyFire(
  alliance: Alliance,
  attackerFactionId: FactionId,
  state: GameState
): void {
  // Mark alliance as broken
  alliance.status = "broken";

  // Apply -20 reputation penalty to attacking faction
  const attackerFaction = state.factions[attackerFactionId];
  attackerFaction.reputation = Math.max(0, attackerFaction.reputation - 20);

  // Apply reputation floor (patron benefit)
  applyReputationFloor(attackerFactionId, state);

  // Update faction stats
  attackerFaction.stats.betrayalsCommitted += 1;

  // Update betrayals suffered for all other factions in the alliance
  alliance.factionIds.forEach((factionId) => {
    if (factionId !== attackerFactionId) {
      state.factions[factionId].stats.betrayalsSuffered += 1;
    }
  });

  // Emit to Summoner Analytics
  emitAllianceBroken(state, alliance.id, "betrayal");
}

/**
 * Resolve a single attack action
 * Uses the exact formula from Section 3, Phase 5
 */
function resolveAttack(
  action: Extract<AgentAction, { type: "attack" }>,
  attackerFactionId: FactionId,
  state: GameState,
  rng: SeededRandom
): AttackResult {
  const { fromTerritoryId, targetTerritoryId, strength: attackerArmySize } = action;

  // Get territories
  const targetTerritory = state.territories[targetTerritoryId];
  if (!targetTerritory) {
    throw new Error(`Target territory ${targetTerritoryId} does not exist`);
  }

  const defenderFactionId = targetTerritory.controlledBy;
  if (!defenderFactionId) {
    throw new Error(`Territory ${targetTerritoryId} is not controlled by any faction`);
  }

  // Check for friendly fire
  const violatedAlliance = checkFriendlyFireViolation(
    attackerFactionId,
    defenderFactionId,
    state
  );

  let allianceBrokenId: string | undefined;
  let reputationPenalty: number | undefined;

  if (violatedAlliance) {
    // [RULE] Break alliance and apply -20 reputation penalty
    breakAllianceFromFriendlyFire(violatedAlliance, attackerFactionId, state);
    allianceBrokenId = violatedAlliance.id;
    reputationPenalty = -20;
  }

  // Get attacker faction
  const attackerFaction = state.factions[attackerFactionId];

  // Calculate attacker strength
  // Formula: territory.strength * attacker_army_size * (1 + faction.reputation/200)
  const attackerStrength =
    targetTerritory.strength * attackerArmySize * (1 + attackerFaction.reputation / 200);

  // Calculate alliance defense bonus for defender
  const allianceDefenseBonus = calculateAllianceDefenseBonus(
    defenderFactionId,
    targetTerritoryId,
    state
  );

  // Calculate defender strength
  // Formula: territory.strength * (1 + alliance_defense_bonus)
  const defenderStrength = targetTerritory.strength * (1 + allianceDefenseBonus);

  // Roll for outcome
  // Formula: random(0, attacker_strength + defender_strength)
  const totalStrength = attackerStrength + defenderStrength;
  const roll = rng.nextFloat(0, totalStrength);

  // Determine winner
  // Formula: if outcome_roll <= attacker_strength: attacker wins
  const attackerWins = roll <= attackerStrength;

  return {
    success: attackerWins,
    attackerFaction: attackerFactionId,
    defenderFaction: defenderFactionId,
    territoryId: targetTerritoryId,
    attackerStrength,
    defenderStrength,
    roll,
    allianceBroken: allianceBrokenId,
    reputationPenalty
  };
}

/**
 * Apply territory control change from successful attack
 */
function applyTerritoryTransfer(
  territoryId: string,
  fromFactionId: FactionId,
  toFactionId: FactionId,
  state: GameState
): void {
  // Update territory control
  state.territories[territoryId].controlledBy = toFactionId;

  // Update faction territory lists
  const fromFaction = state.factions[fromFactionId];
  const toFaction = state.factions[toFactionId];

  fromFaction.territories = fromFaction.territories.filter((id) => id !== territoryId);
  toFaction.territories.push(territoryId);

  // Update faction stats
  fromFaction.stats.territoriesControlled = fromFaction.territories.length;
  toFaction.stats.territoriesControlled = toFaction.territories.length;

  // Emit to Summoner Analytics
  emitTerritoryChanged(state, territoryId, fromFactionId, toFactionId);
}

/**
 * Pending attack with associated metadata
 */
interface PendingAttack {
  decision: AgentDecision;
  action: Extract<AgentAction, { type: "attack" }>;
  result: AttackResult;
}

/**
 * Resolve all agent actions for the current turn
 * [IMPLEMENT] resolveActions(actions: AgentAction[], state: GameState): GameState
 *
 * Territory ownership changes are resolved atomically:
 * 1. Collect all attack decisions
 * 2. Filter out attacks on territories the faction already controls
 * 3. Resolve conflicts: if multiple factions attack same territory, highest attacker_strength wins
 * 4. Apply all ownership changes simultaneously at the end
 */
export function resolveActions(
  decisions: AgentDecision[],
  state: GameState
): { state: GameState; results: string[] } {
  const rng = new SeededRandom(state.seed + state.currentTurn);
  const results: string[] = [];

  // Track attacks per agent to enforce [RULE] Maximum one attack action per agent per turn
  const attacksPerAgent = new Map<string, number>();

  // Phase 1: Collect and validate all attack decisions
  const pendingAttacks: PendingAttack[] = [];
  const nonAttackDecisions: AgentDecision[] = [];

  decisions.forEach((decision) => {
    if (decision.action.type === "attack") {
      const { agentId, factionId, action } = decision;
      const agent = state.factions[factionId].agents.find((a) => a.id === agentId);

      if (!agent) {
        results.push(`⚠️  Agent ${agentId} not found`);
        return;
      }

      // [RULE] Maximum one attack action per agent per turn
      const attackCount = attacksPerAgent.get(agentId) || 0;
      if (attackCount >= 1) {
        results.push(
          `⚠️  ${agent.name} attempted multiple attacks (max 1 per turn) - action ignored`
        );
        return;
      }
      attacksPerAgent.set(agentId, attackCount + 1);

      // Filter out attacks on territories faction already controls
      const targetTerritory = state.territories[action.targetTerritoryId];
      if (targetTerritory && targetTerritory.controlledBy === factionId) {
        // Silently skip - agent is confused, but don't spam logs
        return;
      }

      // Calculate attack result (but don't apply territory transfer yet)
      const attackResult = resolveAttack(action, factionId, state, rng);

      // Log alliance breaks immediately (they happen regardless of attack success)
      if (attackResult.allianceBroken) {
        results.push(
          `💔 ${agent.name} broke alliance ${attackResult.allianceBroken} by attacking ally ${state.factions[attackResult.defenderFaction].name} (${attackResult.reputationPenalty} reputation)`
        );
      }

      pendingAttacks.push({
        decision,
        action,
        result: attackResult
      });
    } else {
      nonAttackDecisions.push(decision);
    }
  });

  // Phase 2: Resolve conflicts for territories with multiple attackers
  // Group attacks by target territory
  const attacksByTerritory = new Map<string, PendingAttack[]>();
  pendingAttacks.forEach((pending) => {
    const territoryId = pending.action.targetTerritoryId;
    if (!attacksByTerritory.has(territoryId)) {
      attacksByTerritory.set(territoryId, []);
    }
    attacksByTerritory.get(territoryId)!.push(pending);
  });

  // For each territory, determine the winning attacker (if any)
  const successfulAttacks: PendingAttack[] = [];
  attacksByTerritory.forEach((attacks, territoryId) => {
    // Filter to only successful attacks
    const successfulOnes = attacks.filter((a) => a.result.success);

    if (successfulOnes.length === 0) {
      // All attacks failed - log all defenses
      attacks.forEach((pending) => {
        const agent = state.factions[pending.decision.factionId].agents.find(
          (a) => a.id === pending.decision.agentId
        );
        results.push(
          `🛡️  ${state.factions[pending.result.defenderFaction].name} defended ${state.territories[pending.result.territoryId].name} against ${agent?.name}` +
            ` (${pending.result.defenderStrength.toFixed(1)} vs ${pending.result.attackerStrength.toFixed(1)}, roll: ${pending.result.roll.toFixed(1)})`
        );
      });
    } else if (successfulOnes.length === 1) {
      // Single successful attack - straightforward winner
      successfulAttacks.push(successfulOnes[0]);
    } else {
      // Multiple successful attacks on same territory - resolve conflict by attacker_strength
      // Highest attacker_strength wins
      successfulOnes.sort((a, b) => b.result.attackerStrength - a.result.attackerStrength);
      const winner = successfulOnes[0];
      successfulAttacks.push(winner);

      // Log all other attacks as failed (contested)
      successfulOnes.slice(1).forEach((pending) => {
        const agent = state.factions[pending.decision.factionId].agents.find(
          (a) => a.id === pending.decision.agentId
        );
        results.push(
          `⚔️  ${agent?.name}'s attack on ${state.territories[territoryId].name} contested by stronger force (${pending.result.attackerStrength.toFixed(1)} vs ${winner.result.attackerStrength.toFixed(1)})`
        );
      });
    }
  });

  // Phase 3: Apply all successful territory transfers atomically
  successfulAttacks.forEach((pending) => {
    applyTerritoryTransfer(
      pending.result.territoryId,
      pending.result.defenderFaction,
      pending.result.attackerFaction,
      state
    );

    const agent = state.factions[pending.decision.factionId].agents.find(
      (a) => a.id === pending.decision.agentId
    );
    results.push(
      `⚔️  ${agent?.name} conquered ${state.territories[pending.result.territoryId].name} from ${state.factions[pending.result.defenderFaction].name}` +
        ` (${pending.result.attackerStrength.toFixed(1)} vs ${pending.result.defenderStrength.toFixed(1)}, roll: ${pending.result.roll.toFixed(1)})`
    );
  });

  // Phase 4: Process non-attack actions
  nonAttackDecisions.forEach((decision) => {
    const { agentId, factionId, action } = decision;
    const agent = state.factions[factionId].agents.find((a) => a.id === agentId);

    if (!agent) {
      results.push(`⚠️  Agent ${agentId} not found`);
      return;
    }

    switch (action.type) {
      case "reinforce": {
        // TODO: Implement reinforce logic
        results.push(`🔰 ${agent.name} reinforced ${action.territoryId} (+${action.amount})`);
        break;
      }

      case "invest": {
        // TODO: Implement invest logic
        results.push(
          `💰 ${agent.name} invested ${action.amount} ${action.resourceType} in ${action.territoryId}`
        );
        break;
      }

      case "pass": {
        results.push(`⏭️  ${agent.name} passed`);
        break;
      }

      case "propose_alliance":
      case "break_alliance": {
        // These are handled in negotiation phase, not here
        break;
      }
    }
  });

  return { state, results };
}
