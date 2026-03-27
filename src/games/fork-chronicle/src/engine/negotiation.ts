/**
 * Alliance negotiation resolution for Fork: A Chronicle of Alternate Histories
 * Section 3, Phase 4: Agent Negotiation
 */

import type { GameState } from "../types/game-state";
import type { AgentDecision } from "../types/agent";
import type { Alliance } from "../types/alliance";
import type { FactionId } from "../types/faction";
import { SeededRandom } from "../utils/random";
import { emitAllianceFormed } from "../analytics/analytics-emitter";
import { hasNegotiationEdge, applyReputationFloor } from "./patron";

/**
 * Calculate base trust between two agents based on interaction history
 * [SPEC] base_trust = 0.6 (default) | modified by InteractionMemory
 *
 * Trust modifiers:
 * - Previous alliance_offer accepted: +0.1
 * - Previous alliance_offer rejected: -0.05
 * - Previous betrayal: -0.3
 * - Previous successful cooperation: +0.15
 */
function calculateBaseTrust(
  proposerAgentId: string,
  targetAgentId: string,
  state: GameState
): number {
  const targetAgent = Object.values(state.factions)
    .flatMap((f) => f.agents)
    .find((a) => a.id === targetAgentId);

  if (!targetAgent) {
    return 0.6; // Default trust (raised from 0.5 to 0.6)
  }

  let baseTrust = 0.6; // Raised from 0.5 to 0.6

  // Check interaction memory for past dealings with proposer
  targetAgent.memory.forEach((interaction) => {
    if (interaction.targetAgentId === proposerAgentId) {
      switch (interaction.interactionType) {
        case "alliance_offer":
          if (interaction.outcome === "accepted") {
            baseTrust += 0.1;
          } else if (interaction.outcome === "rejected") {
            baseTrust -= 0.05;
          }
          break;
        case "betrayal":
          baseTrust -= 0.3; // Betrayal severely damages trust
          break;
        case "attack":
          if (interaction.outcome === "failed") {
            baseTrust -= 0.2; // Failed attack shows hostility
          }
          break;
        case "trade":
          if (interaction.outcome === "succeeded") {
            baseTrust += 0.15; // Successful cooperation builds trust
          }
          break;
      }
    }
  });

  // Clamp to 0-1 range
  return Math.max(0, Math.min(1, baseTrust));
}

/**
 * Resolve all alliance negotiation proposals
 * [IMPLEMENT] resolveNegotiations(proposals: AgentDecision[], state: GameState): { alliances: Alliance[], results: string[] }
 *
 * Negotiation resolution:
 * 1. Group all propose_alliance actions by target faction
 * 2. For each proposal, calculate acceptance probability
 * 3. Roll against p_accept — if accepted, create new Alliance
 * 4. [RULE] A faction may not be in more than 3 active alliances simultaneously
 * 5. Return all negotiation outcomes with rationale strings
 */
export function resolveNegotiations(
  decisions: AgentDecision[],
  state: GameState
): { alliances: Alliance[]; results: string[] } {
  const rng = new SeededRandom(state.seed + state.currentTurn + "_negotiation");
  const newAlliances: Alliance[] = [];
  const results: string[] = [];

  // Filter for alliance proposals only
  const proposals = decisions.filter((d) => d.action.type === "propose_alliance");

  if (proposals.length === 0) {
    return { alliances: [], results: [] };
  }

  // Process each proposal
  proposals.forEach((decision) => {
    const { agentId, factionId, action } = decision;

    if (action.type !== "propose_alliance") {
      return; // Type guard
    }

    const { targetFactionId, terms } = action;

    // Get agent and faction references
    const proposerAgent = state.factions[factionId].agents.find((a) => a.id === agentId);
    if (!proposerAgent) {
      results.push(`⚠️  Proposer agent ${agentId} not found`);
      return;
    }

    const proposerFaction = state.factions[factionId];
    const targetFaction = state.factions[targetFactionId];

    if (!targetFaction) {
      results.push(`⚠️  Target faction ${targetFactionId} not found`);
      return;
    }

    // [RULE] A faction may not be in more than 3 active alliances simultaneously
    const proposerActiveAlliances = state.alliances.filter(
      (a) => a.status === "active" && a.factionIds.includes(factionId)
    ).length;

    const targetActiveAlliances = state.alliances.filter(
      (a) => a.status === "active" && a.factionIds.includes(targetFactionId)
    ).length;

    if (proposerActiveAlliances >= 3) {
      results.push(
        `⛔ ${proposerFaction.name} cannot form new alliance (already in 3 active alliances)`
      );
      return;
    }

    if (targetActiveAlliances >= 3) {
      results.push(
        `⛔ ${targetFaction.name} rejected ${proposerFaction.name}'s alliance proposal (already in 3 active alliances)`
      );

      // Record rejection in memory
      proposerAgent.memory.push({
        turn: state.currentTurn,
        targetAgentId: targetFaction.agents[0]?.id || "unknown",
        interactionType: "alliance_offer",
        outcome: "rejected"
      });

      return;
    }

    // Check if alliance already exists between these factions
    const existingAlliance = state.alliances.find(
      (a) =>
        a.status === "active" &&
        a.factionIds.includes(factionId) &&
        a.factionIds.includes(targetFactionId)
    );

    if (existingAlliance) {
      results.push(
        `ℹ️  ${proposerFaction.name} and ${targetFaction.name} already have an active alliance`
      );
      return;
    }

    // Calculate acceptance probability
    // p_accept = base_trust * loyalty_factor * reputation_factor * patron_factor

    // Select a representative target agent (first agent for simplicity)
    const targetAgent = targetFaction.agents[0];
    if (!targetAgent) {
      results.push(`⚠️  ${targetFaction.name} has no agents to consider proposal`);
      return;
    }

    const baseTrust = calculateBaseTrust(proposerAgent.id, targetAgent.id, state);
    const loyaltyFactor = targetAgent.personality.loyalty;
    const reputationFactor = proposerFaction.reputation / 100;
    const patronFactor = 1.0 + targetFaction.patronBacking / 500;

    // Calculate archetype affinity bonus
    // [RULE] Diplomat proposer: +0.15 to p_accept
    // [RULE] Diplomat target: +0.10 to p_accept
    let archetypeBonus = 0;
    if (proposerAgent.archetype === "diplomat") {
      archetypeBonus += 0.15;
    }
    if (targetAgent.archetype === "diplomat") {
      archetypeBonus += 0.10;
    }

    // Check for negotiation_edge patron benefit
    // [RULE] +0.15 to p_accept if proposer or target faction has active negotiation_edge
    let negotiationEdgeBonus = 0;
    if (hasNegotiationEdge(factionId, state) || hasNegotiationEdge(targetFactionId, state)) {
      negotiationEdgeBonus = 0.15;
    }

    const acceptanceProbability = baseTrust * loyaltyFactor * reputationFactor * patronFactor + archetypeBonus + negotiationEdgeBonus;

    // Clamp to 0-1 range
    const pAccept = Math.max(0, Math.min(1, acceptanceProbability));

    // Roll for acceptance
    const roll = rng.nextFloat(0, 1);
    const accepted = roll <= pAccept;

    if (accepted) {
      // Create new alliance
      const alliance: Alliance = {
        id: `alliance_${state.currentTurn}_${factionId}_${targetFactionId}`,
        factionIds: [factionId, targetFactionId],
        formedOnTurn: state.currentTurn,
        terms,
        trustScore: Math.floor(pAccept * 100),
        status: "active"
      };

      newAlliances.push(alliance);
      state.alliances.push(alliance);

      // Emit to Summoner Analytics
      emitAllianceFormed(state, alliance.id, alliance.factionIds);

      // Update faction stats
      proposerFaction.stats.alliances.push(targetFactionId);
      targetFaction.stats.alliances.push(factionId);

      // Record successful negotiation in memory
      proposerAgent.memory.push({
        turn: state.currentTurn,
        targetAgentId: targetAgent.id,
        interactionType: "alliance_offer",
        outcome: "accepted"
      });

      targetAgent.memory.push({
        turn: state.currentTurn,
        targetAgentId: proposerAgent.id,
        interactionType: "alliance_offer",
        outcome: "accepted"
      });

      // Generate result message
      const termDescriptions = terms.map((term) => {
        switch (term.type) {
          case "non_aggression":
            return "non-aggression pact";
          case "defense_pact":
            return "mutual defense agreement";
          case "joint_attack":
            return "joint military action";
          case "resource_share":
            return "resource sharing arrangement";
        }
      });

      results.push(
        `🤝 ${proposerFaction.name} and ${targetFaction.name} formed an alliance (${termDescriptions.join(", ")}) [trust: ${alliance.trustScore}%]`
      );
    } else {
      // Record rejection in memory
      proposerAgent.memory.push({
        turn: state.currentTurn,
        targetAgentId: targetAgent.id,
        interactionType: "alliance_offer",
        outcome: "rejected"
      });

      targetAgent.memory.push({
        turn: state.currentTurn,
        targetAgentId: proposerAgent.id,
        interactionType: "alliance_offer",
        outcome: "rejected"
      });

      results.push(
        `🚫 ${targetFaction.name} rejected ${proposerFaction.name}'s alliance proposal (acceptance: ${(pAccept * 100).toFixed(1)}%, roll: ${(roll * 100).toFixed(1)}%)`
      );
    }
  });

  return { alliances: newAlliances, results };
}

/**
 * Break an alliance and apply reputation penalty
 * [RULE] Breaking a non_aggression or defense_pact triggers alliance dissolution + -20 reputation penalty
 *
 * This is called when friendly fire is detected (handled in combat.ts)
 */
export function breakAlliance(
  allianceId: string,
  breakingFactionId: FactionId,
  state: GameState
): void {
  const alliance = state.alliances.find((a) => a.id === allianceId);

  if (!alliance) {
    throw new Error(`Alliance ${allianceId} not found`);
  }

  alliance.status = "broken";

  // Apply -20 reputation penalty
  const breakingFaction = state.factions[breakingFactionId];
  breakingFaction.reputation = Math.max(0, breakingFaction.reputation - 20);

  // Apply reputation floor (patron benefit)
  applyReputationFloor(breakingFactionId, state);

  // Update betrayal stats
  breakingFaction.stats.betrayalsCommitted += 1;

  // Update betrayal stats for all other factions in the alliance
  alliance.factionIds.forEach((factionId) => {
    if (factionId !== breakingFactionId) {
      state.factions[factionId].stats.betrayalsSuffered += 1;

      // Record betrayal in interaction memory
      const betrayedFaction = state.factions[factionId];
      const breakingAgents = breakingFaction.agents;
      const betrayedAgents = betrayedFaction.agents;

      // Record betrayal for all agents involved
      betrayedAgents.forEach((betrayedAgent) => {
        breakingAgents.forEach((breakingAgent) => {
          betrayedAgent.memory.push({
            turn: state.currentTurn,
            targetAgentId: breakingAgent.id,
            interactionType: "betrayal",
            outcome: "succeeded" // From betrayer's perspective
          });
        });
      });
    }
  });

  // Remove from faction alliance lists
  alliance.factionIds.forEach((factionId) => {
    const faction = state.factions[factionId];
    faction.stats.alliances = faction.stats.alliances.filter((allyId) => {
      return !alliance.factionIds.includes(allyId) || allyId === factionId;
    });
  });
}
