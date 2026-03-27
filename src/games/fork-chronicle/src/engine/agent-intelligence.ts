/**
 * Agent intelligence backends for Fork: A Chronicle of Alternate Histories
 * Section 17.2: Claude-Powered Agents (v1.1)
 * Section 17.3: Geographically Distributed Agents (v2.0)
 *
 * [RULE] The agentDeliberate() function in the game engine must call
 * AgentIntelligence.deliberate() — never implement deliberation logic inline.
 * This keeps the swap from rule-based to Claude-powered a one-line config change.
 */

import type { Agent, AgentAction, AgentArchetype, AllianceTerm } from "../types/agent";
import type { GameState } from "../types/game-state";
import type { FactionId } from "../types/faction";
import { SeededRandom } from "../utils/random";

/**
 * AgentIntelligence defines the deliberation backend.
 * Swap rule-based for Claude-powered without changing any calling code.
 */
export interface AgentIntelligence {
  deliberate(agent: Agent, state: GameState): Promise<{ action: AgentAction; rationale: string }>;
}

// ── MVP: Rule-based (implement in Step 6) ──────────────────────────────────

/**
 * Rule-based agent intelligence using archetype weights
 * Implements the decision weights from Section 3, Phase 3
 */
export class RuleBasedIntelligence implements AgentIntelligence {
  // Base decision weights by archetype (from spec Section 3, Phase 3)
  private readonly archetypeWeights: Record<
    AgentArchetype,
    { attack: number; alliance: number; invest: number; reinforce: number }
  > = {
    conqueror: { attack: 0.5, alliance: 0.1, invest: 0.1, reinforce: 0.3 },
    diplomat: { attack: 0.1, alliance: 0.5, invest: 0.2, reinforce: 0.2 },
    economist: { attack: 0.1, alliance: 0.2, invest: 0.5, reinforce: 0.2 },
    historian: { attack: 0.2, alliance: 0.3, invest: 0.2, reinforce: 0.3 }
  };

  async deliberate(
    agent: Agent,
    state: GameState
  ): Promise<{ action: AgentAction; rationale: string }> {
    const faction = state.factions[agent.factionId];
    const rng = new SeededRandom(state.seed + state.currentTurn + agent.id);

    // Get base weights for this archetype
    const baseWeights = this.archetypeWeights[agent.archetype];

    // Apply personality modifiers
    // Attack weight influenced by aggression and risk tolerance
    // Alliance weight influenced by loyalty
    // Invest weight influenced by expansionism
    // Reinforce weight influenced by loyalty
    const personalityModifiedWeights = {
      attack: baseWeights.attack * agent.personality.aggression * agent.personality.riskTolerance,
      alliance: baseWeights.alliance * agent.personality.loyalty,
      invest: baseWeights.invest * agent.personality.expansionism,
      reinforce: baseWeights.reinforce * agent.personality.loyalty
    };

    // Apply patronBacking bonus (from spec: multiplied by patronBacking bonus)
    // patronBacking is an accumulated score, normalize it to a reasonable multiplier
    const patronMultiplier = 1.0 + faction.patronBacking / 500;
    const finalWeights = {
      attack: personalityModifiedWeights.attack * patronMultiplier,
      alliance: personalityModifiedWeights.alliance * patronMultiplier,
      invest: personalityModifiedWeights.invest * patronMultiplier,
      reinforce: personalityModifiedWeights.reinforce * patronMultiplier
    };

    // Select action type based on weights (weighted random selection)
    const totalWeight =
      finalWeights.attack + finalWeights.alliance + finalWeights.invest + finalWeights.reinforce;

    const roll = rng.nextFloat(0, totalWeight);
    let cumulative = 0;
    let selectedActionType: "attack" | "alliance" | "invest" | "reinforce" = "reinforce";

    cumulative += finalWeights.attack;
    if (roll <= cumulative) {
      selectedActionType = "attack";
    } else {
      cumulative += finalWeights.alliance;
      if (roll <= cumulative) {
        selectedActionType = "alliance";
      } else {
        cumulative += finalWeights.invest;
        if (roll <= cumulative) {
          selectedActionType = "invest";
        } else {
          selectedActionType = "reinforce";
        }
      }
    }

    // Generate specific action based on selected type
    switch (selectedActionType) {
      case "attack":
        return this.generateAttackAction(agent, state, rng);
      case "alliance":
        return this.generateAllianceAction(agent, state, rng);
      case "invest":
        return this.generateInvestAction(agent, state, rng);
      case "reinforce":
        return this.generateReinforceAction(agent, state, rng);
    }
  }

  /**
   * Generate an attack action against a neighboring enemy territory
   */
  private generateAttackAction(
    agent: Agent,
    state: GameState,
    rng: SeededRandom
  ): { action: AgentAction; rationale: string } {
    const faction = state.factions[agent.factionId];

    // Find all adjacent enemy territories
    const adjacentEnemies: Array<{ from: string; target: string; targetFaction: FactionId }> = [];

    faction.territories.forEach((terrId) => {
      const territory = state.territories[terrId];
      territory.adjacencies.forEach((adjId) => {
        const adjacent = state.territories[adjId];
        if (adjacent.controlledBy && adjacent.controlledBy !== agent.factionId) {
          // Check if there's an active non-aggression or defense pact
          const hasProtectivePact = state.alliances.some(
            (alliance) =>
              alliance.status === "active" &&
              alliance.factionIds.includes(agent.factionId) &&
              alliance.factionIds.includes(adjacent.controlledBy!) &&
              alliance.terms.some(
                (term) => term.type === "non_aggression" || term.type === "defense_pact"
              )
          );

          if (!hasProtectivePact) {
            adjacentEnemies.push({
              from: terrId,
              target: adjId,
              targetFaction: adjacent.controlledBy
            });
          }
        }
      });
    });

    // If no valid targets, fall back to pass
    if (adjacentEnemies.length === 0) {
      return {
        action: { type: "pass" },
        rationale: "Our strategic position offers no advantageous opportunities for expansion at this moment."
      };
    }

    // Select attack target with continent affinity weighting for Conquerors
    let selectedAttack;

    if (agent.archetype === "conqueror") {
      // Calculate continent control bonus for each target
      const targetWeights = adjacentEnemies.map((attack) => {
        const targetTerritory = state.territories[attack.target];
        const continent = targetTerritory.continent;

        // Count faction's territories in this continent
        const factionTerritoriesInContinent = faction.territories.filter(
          (tId) => state.territories[tId].continent === continent
        ).length;

        // Count total territories in this continent
        const totalTerritoriesInContinent = Object.values(state.territories).filter(
          (t) => t.continent === continent
        ).length;

        // Calculate continent control bonus
        const continentControlBonus =
          (factionTerritoriesInContinent / totalTerritoriesInContinent) * 0.3;

        // Base weight of 1.0, plus continent bonus
        return 1.0 + continentControlBonus;
      });

      // Weighted random selection
      selectedAttack = rng.weightedChoice(adjacentEnemies, targetWeights);
    } else {
      // Non-conquerors use uniform random selection
      selectedAttack = rng.choice(adjacentEnemies);
    }

    // Determine attack strength based on personality
    const baseStrength = 5;
    const strengthModifier = agent.personality.aggression * agent.personality.riskTolerance;
    const strength = Math.max(1, Math.floor(baseStrength * strengthModifier * 2));

    // Generate rationale in political/historical language
    const targetTerritory = state.territories[selectedAttack.target];
    const targetFactionName = state.factions[selectedAttack.targetFaction].name;

    const rationales = [
      `The time has come to secure ${targetTerritory.name} and expand our sphere of influence against ${targetFactionName}.`,
      `${targetFactionName}'s control of ${targetTerritory.name} threatens our strategic interests and must be challenged.`,
      `Our position demands we contest ${targetFactionName}'s hold on ${targetTerritory.name} before they grow stronger.`,
      `The balance of power requires we move against ${targetTerritory.name} while ${targetFactionName} remains vulnerable.`
    ];

    const rationale = rng.choice(rationales);

    return {
      action: {
        type: "attack",
        fromTerritoryId: selectedAttack.from,
        targetTerritoryId: selectedAttack.target,
        strength
      },
      rationale
    };
  }

  /**
   * Generate an alliance proposal to a potential partner
   */
  private generateAllianceAction(
    agent: Agent,
    state: GameState,
    rng: SeededRandom
  ): { action: AgentAction; rationale: string } {
    const faction = state.factions[agent.factionId];

    // Find factions not currently allied with
    const currentAlliances = state.alliances.filter(
      (a) => a.status === "active" && a.factionIds.includes(agent.factionId)
    );

    const alliedFactionIds = new Set<FactionId>();
    currentAlliances.forEach((alliance) => {
      alliance.factionIds.forEach((factionId) => {
        if (factionId !== agent.factionId) {
          alliedFactionIds.add(factionId);
        }
      });
    });

    // [RULE] A faction may not be in more than 3 active alliances simultaneously
    if (currentAlliances.length >= 3) {
      return {
        action: { type: "pass" },
        rationale:
          "Our existing diplomatic commitments preclude additional entanglements at this juncture."
      };
    }

    const potentialPartners = Object.keys(state.factions).filter(
      (factionId) => factionId !== agent.factionId && !alliedFactionIds.has(factionId)
    ) as FactionId[];

    if (potentialPartners.length === 0) {
      return {
        action: { type: "pass" },
        rationale: "All potential partners are already bound to us through existing accords."
      };
    }

    // Select random potential partner
    const targetFactionId = rng.choice(potentialPartners);
    const targetFaction = state.factions[targetFactionId];

    // Choose alliance terms based on archetype
    const terms: AllianceTerm[] = [];

    if (agent.archetype === "diplomat" || agent.personality.loyalty > 0.6) {
      // Diplomats prefer defense pacts
      terms.push({ type: "defense_pact", durationEras: 3 });
    } else if (agent.archetype === "conqueror") {
      // Conquerors prefer joint attacks
      terms.push({ type: "joint_attack", durationEras: 2 });
    } else {
      // Default to non-aggression
      terms.push({ type: "non_aggression", durationEras: 5 });
    }

    // Generate rationale
    const rationales = [
      `An accord with ${targetFaction.name} would strengthen both our positions in these uncertain times.`,
      `The shifting balance of power demands we seek common cause with ${targetFaction.name}.`,
      `Our interests align with ${targetFaction.name} — a formal understanding would serve us both.`,
      `Strategic cooperation with ${targetFaction.name} offers advantages neither of us can ignore.`
    ];

    const rationale = rng.choice(rationales);

    return {
      action: {
        type: "propose_alliance",
        targetFactionId,
        terms
      },
      rationale
    };
  }

  /**
   * Generate an investment action in a controlled territory
   */
  private generateInvestAction(
    agent: Agent,
    state: GameState,
    rng: SeededRandom
  ): { action: AgentAction; rationale: string } {
    const faction = state.factions[agent.factionId];

    if (faction.territories.length === 0) {
      return {
        action: { type: "pass" },
        rationale: "Without territorial holdings, economic development remains beyond our reach."
      };
    }

    // Select random territory to invest in
    const territoryId = rng.choice(faction.territories);
    const territory = state.territories[territoryId];

    // Choose resource type based on territory's weakest resource
    const resources = territory.resources;
    const resourceTypes = ["food", "industry", "tech"] as const;

    let weakestResource: keyof typeof resources = "food";
    let weakestValue = resources.food;

    if (resources.industry < weakestValue) {
      weakestResource = "industry";
      weakestValue = resources.industry;
    }
    if (resources.tech < weakestValue) {
      weakestResource = "tech";
    }

    // Investment amount based on faction resources
    const amount = Math.max(5, Math.floor(faction.resources[weakestResource] * 0.1));

    // Generate rationale
    const resourceDescriptions = {
      food: "agricultural production",
      industry: "industrial capacity",
      tech: "technological development"
    };

    const rationales = [
      `We must invest in ${territory.name}'s ${resourceDescriptions[weakestResource]} to secure our economic foundation.`,
      `Strengthening ${resourceDescriptions[weakestResource]} in ${territory.name} will yield dividends for our broader ambitions.`,
      `${territory.name} requires focused development of its ${resourceDescriptions[weakestResource]} infrastructure.`,
      `Our long-term prosperity demands we bolster ${territory.name}'s ${resourceDescriptions[weakestResource]}.`
    ];

    const rationale = rng.choice(rationales);

    return {
      action: {
        type: "invest",
        territoryId,
        resourceType: weakestResource,
        amount
      },
      rationale
    };
  }

  /**
   * Generate a reinforce action for a vulnerable territory
   */
  private generateReinforceAction(
    agent: Agent,
    state: GameState,
    rng: SeededRandom
  ): { action: AgentAction; rationale: string } {
    const faction = state.factions[agent.factionId];

    if (faction.territories.length === 0) {
      return {
        action: { type: "pass" },
        rationale: "Without territories to defend, our focus must turn to other strategic priorities."
      };
    }

    // Find territories with enemy neighbors (vulnerable border territories)
    const vulnerableTerritories: string[] = [];

    faction.territories.forEach((terrId) => {
      const territory = state.territories[terrId];
      const hasEnemyNeighbor = territory.adjacencies.some((adjId) => {
        const adjacent = state.territories[adjId];
        return adjacent.controlledBy && adjacent.controlledBy !== agent.factionId;
      });

      if (hasEnemyNeighbor) {
        vulnerableTerritories.push(terrId);
      }
    });

    // If no vulnerable territories, reinforce a random one
    const targetTerritoryId =
      vulnerableTerritories.length > 0
        ? rng.choice(vulnerableTerritories)
        : rng.choice(faction.territories);

    const territory = state.territories[targetTerritoryId];

    // Reinforcement amount based on territory strength gap
    const amount = Math.max(5, Math.floor((100 - territory.strength) * 0.2));

    // Generate rationale
    const rationales = [
      `We must fortify ${territory.name} to safeguard our position against potential threats.`,
      `Consolidating our defenses in ${territory.name} is essential for maintaining territorial integrity.`,
      `${territory.name} requires reinforcement to deter any adversaries who might test our resolve.`,
      `Strengthening ${territory.name}'s defenses will ensure our borders remain secure.`
    ];

    const rationale = rng.choice(rationales);

    return {
      action: {
        type: "reinforce",
        territoryId: targetTerritoryId,
        amount
      },
      rationale
    };
  }
}

// ── v1.1: Claude-powered (stub only — do not implement in MVP) ──────────────

/**
 * Claude-powered agent intelligence using Anthropic API
 * [STUB] This is a stub for v1.1 — do not implement in MVP
 */
export class ClaudeIntelligence implements AgentIntelligence {
  private apiKey: string;
  private model = "claude-sonnet-4-20250514";

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async deliberate(
    agent: Agent,
    state: GameState
  ): Promise<{ action: AgentAction; rationale: string }> {
    // v1.1 implementation:
    // 1. Serialize relevant GameState slice (agent's territories, neighbors,
    //    active alliances, recent events, interaction memory)
    // 2. Build prompt from agent archetype + personality + game state
    // 3. Call Anthropic API with JSON response format
    // 4. Parse response into AgentAction + rationale
    // 5. Validate action is legal given current game state
    throw new Error("ClaudeIntelligence not implemented until v1.1");
  }

  private buildPrompt(agent: Agent, state: GameState): string {
    // Prompt template for v1.1 — defines agent voice by archetype
    const archetypeVoice: Record<AgentArchetype, string> = {
      conqueror:
        "You are an aggressive military strategist who prioritizes territorial expansion above all else.",
      diplomat:
        "You are a careful alliance-builder who values long-term trust and stable coalitions.",
      economist:
        "You are a resource optimizer who expands through trade leverage and economic control.",
      historian:
        "You are an opportunist who studies historical patterns to inject chaos at the right moment."
    };

    return `
You are ${agent.name}, a ${agent.archetype} agent controlling ${agent.homeTerritory}.
${archetypeVoice[agent.archetype]}

Your personality:
- Aggression: ${agent.personality.aggression.toFixed(2)}
- Loyalty: ${agent.personality.loyalty.toFixed(2)}
- Risk tolerance: ${agent.personality.riskTolerance.toFixed(2)}
- Expansionism: ${agent.personality.expansionism.toFixed(2)}

Current turn: ${state.currentTurn}, Era: ${state.currentEra}
Your faction controls: ${state.factions[agent.factionId].territories.join(", ")}
Your faction reputation: ${state.factions[agent.factionId].reputation}
Active alliances: ${
      state.alliances
        .filter((a) => a.factionIds.includes(agent.factionId) && a.status === "active")
        .map((a) => a.id)
        .join(", ") || "none"
    }

Recent interaction memory:
${agent.memory
  .slice(-5)
  .map((m) => `- Turn ${m.turn}: ${m.interactionType} with ${m.targetAgentId} → ${m.outcome}`)
  .join("\n")}

Choose exactly one action. Respond with valid JSON matching this schema:
{
  "action": { "type": "...", ...AgentAction fields },
  "rationale": "1-2 sentences explaining your decision in political/historical language"
}

Do not use game-mechanics language. Write rationale as a statesman would speak.
    `.trim();
  }
}

// ── v2.0: Geographically distributed (stub only) ────────────────────────────

/**
 * Remote agent intelligence via geographically distributed Summoner agents
 * [STUB] This is a stub for v2.0 — do not implement in MVP
 *
 * In v2.0, each agent runs as a real Summoner agent on a VPS physically located
 * in the country it represents. Agent coordination uses the live SPLT protocol
 * across real geographic boundaries.
 */
export class RemoteAgentIntelligence implements AgentIntelligence {
  private agentDID: string; // e.g. "did:summoner:fra-paris-01"
  private relayEndpoint: string; // e.g. "https://relay.paris.summoner.org"

  constructor(agentDID: string, relayEndpoint: string) {
    this.agentDID = agentDID;
    this.relayEndpoint = relayEndpoint;
  }

  async deliberate(
    agent: Agent,
    state: GameState
  ): Promise<{ action: AgentAction; rationale: string }> {
    // v2.0 implementation:
    // 1. Serialize GameState slice
    // 2. Send to remote agent via SPLT structured message
    // 3. Await AgentAction response (with timeout + fallback to rule-based)
    // 4. Verify response signature against agent DID
    // 5. Return verified AgentAction + rationale
    throw new Error("RemoteAgentIntelligence not implemented until v2.0");
  }
}

// ── Factory — controls which intelligence backend is active ─────────────────

/**
 * Create an agent intelligence backend
 *
 * One-line upgrade path from MVP → v1.1:
 * ```typescript
 * const intelligence = createAgentIntelligence('rule-based'); // MVP
 * const intelligence = createAgentIntelligence('claude');     // v1.1
 * ```
 */
export function createAgentIntelligence(mode: "rule-based" | "claude"): AgentIntelligence {
  if (mode === "claude") {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error("ANTHROPIC_API_KEY required for Claude-powered agents");
    }
    return new ClaudeIntelligence(apiKey);
  }
  return new RuleBasedIntelligence();
}

/**
 * Create a remote agent intelligence backend for v2.0
 * [STUB] Not used in MVP
 */
export function createRemoteAgentIntelligence(
  agentDID: string,
  relayEndpoint: string
): AgentIntelligence {
  return new RemoteAgentIntelligence(agentDID, relayEndpoint);
}
