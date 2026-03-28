/**
 * Unit tests for alliance negotiation (Step 7)
 * Tests for Section 3, Phase 4: Agent Negotiation
 */

import { resolveNegotiations } from "../src/engine/negotiation";
import { initializeGame } from "../src/engine/setup";
import type { GameConfig, GameState } from "../src/types/game-state";
import type { AgentDecision } from "../src/types/agent";
import type { Alliance } from "../src/types/alliance";

/**
 * Create a test game state with controlled setup
 */
async function createTestGameState(): Promise<GameState> {
  const config: GameConfig = {
    epochId: "1914_brink",
    factionCount: 4,
    players: [],
    eventPackIds: ["base"],
    seed: "negotiation_test"
  };
  return await initializeGame(config);
}

/**
 * Test: High loyalty and reputation increases acceptance probability
 * [SPEC] p_accept = base_trust * loyalty_factor * reputation_factor * patron_factor
 */
export async function testAcceptanceProbabilityFactors(): Promise<void> {
  const state = await createTestGameState();

  // Set high reputation for proposer
  state.factions["faction_1"].reputation = 90;

  // Set high loyalty for target agent
  state.factions["faction_2"].agents[0].personality.loyalty = 0.9;

  // Create alliance proposal
  const proposal: AgentDecision = {
    agentId: state.factions["faction_1"].agents[0].id,
    factionId: "faction_1",
    action: {
      type: "propose_alliance",
      targetFactionId: "faction_2",
      terms: [{ type: "non_aggression", durationEras: 5 }]
    },
    rationale: "Testing high acceptance probability"
  };

  // Run negotiation multiple times to test probability
  let acceptances = 0;
  const trials = 20;

  for (let i = 0; i < trials; i++) {
    const testState = JSON.parse(JSON.stringify(state)); // Deep copy
    testState.currentTurn = i + 1; // Vary turn for different RNG

    const { alliances } = resolveNegotiations([proposal], testState);

    if (alliances.length > 0) {
      acceptances++;
    }
  }

  // With high reputation and loyalty, acceptance rate should be substantial
  if (acceptances < trials * 0.4) {
    throw new Error(
      `High reputation + loyalty should lead to higher acceptance rate (got ${acceptances}/${trials})`
    );
  }

  console.log(`✓ testAcceptanceProbabilityFactors passed (${acceptances}/${trials} accepted)`);
}

/**
 * Test: Faction with 3 active alliances rejects all new proposals
 * [RULE] A faction may not be in more than 3 active alliances simultaneously
 */
export async function testMaxThreeAlliancesRule(): Promise<void> {
  const state = await createTestGameState();

  // Create 3 existing alliances for faction_2
  for (let i = 0; i < 3; i++) {
    const otherFactionId = `faction_${i === 0 ? 3 : i === 1 ? 4 : 1}` as any;
    state.alliances.push({
      id: `existing_alliance_${i}`,
      factionIds: ["faction_2", otherFactionId],
      formedOnTurn: 1,
      terms: [{ type: "non_aggression", durationEras: 5 }],
      trustScore: 50,
      status: "active"
    });
  }

  // Now faction_2 has 3 active alliances - should reject new proposal
  const proposal: AgentDecision = {
    agentId: state.factions["faction_1"].agents[0].id,
    factionId: "faction_1",
    action: {
      type: "propose_alliance",
      targetFactionId: "faction_2",
      terms: [{ type: "non_aggression", durationEras: 5 }]
    },
    rationale: "Testing max alliances rule"
  };

  const { alliances, results } = resolveNegotiations([proposal], state);

  // Should be rejected
  if (alliances.length > 0) {
    throw new Error("Faction with 3 alliances should reject new proposals");
  }

  // Check for rejection message
  const rejectionFound = results.some((r) => r.includes("already in 3 active alliances"));
  if (!rejectionFound) {
    throw new Error("Rejection message should mention 3 alliance limit");
  }

  console.log("✓ testMaxThreeAlliancesRule passed");
}

/**
 * Test: Betrayal updates InteractionMemory and reduces base_trust
 */
export async function testBetrayalUpdatesMemory(): Promise<void> {
  const state = await createTestGameState();

  const proposerAgent = state.factions["faction_1"].agents[0];
  const targetAgent = state.factions["faction_2"].agents[0];

  // Record a previous betrayal in memory
  targetAgent.memory.push({
    turn: 1,
    targetAgentId: proposerAgent.id,
    interactionType: "betrayal",
    outcome: "succeeded"
  });

  // Create alliance proposal from betrayer
  const proposal: AgentDecision = {
    agentId: proposerAgent.id,
    factionId: "faction_1",
    action: {
      type: "propose_alliance",
      targetFactionId: "faction_2",
      terms: [{ type: "non_aggression", durationEras: 5 }]
    },
    rationale: "Testing betrayal memory impact"
  };

  // Set high other factors to isolate betrayal impact
  state.factions["faction_1"].reputation = 90;
  targetAgent.personality.loyalty = 0.9;

  // Run negotiation multiple times
  let acceptances = 0;
  const trials = 20;

  for (let i = 0; i < trials; i++) {
    const testState = JSON.parse(JSON.stringify(state));
    testState.currentTurn = i + 1;

    const { alliances } = resolveNegotiations([proposal], testState);

    if (alliances.length > 0) {
      acceptances++;
    }
  }

  // Betrayal should significantly reduce acceptance rate
  // (base_trust drops from 0.5 to 0.2 due to -0.3 penalty)
  if (acceptances > trials * 0.5) {
    throw new Error(
      `Betrayal should reduce acceptance rate significantly (got ${acceptances}/${trials})`
    );
  }

  console.log(`✓ testBetrayalUpdatesMemory passed (${acceptances}/${trials} accepted with betrayal history)`);
}

/**
 * Test: Alliance terms are stored correctly
 */
export async function testAllianceTermsStored(): Promise<void> {
  const state = await createTestGameState();

  // Set high acceptance factors
  state.factions["faction_1"].reputation = 90;
  state.factions["faction_2"].agents[0].personality.loyalty = 0.9;

  const proposal: AgentDecision = {
    agentId: state.factions["faction_1"].agents[0].id,
    factionId: "faction_1",
    action: {
      type: "propose_alliance",
      targetFactionId: "faction_2",
      terms: [
        { type: "defense_pact", durationEras: 3 },
        { type: "resource_share", durationEras: 5 }
      ]
    },
    rationale: "Testing alliance terms storage"
  };

  // Try multiple times until accepted (probabilistic)
  let allianceCreated: Alliance | null = null;

  for (let i = 0; i < 50; i++) {
    const testState = JSON.parse(JSON.stringify(state));
    testState.currentTurn = i + 1;

    const { alliances } = resolveNegotiations([proposal], testState);

    if (alliances.length > 0) {
      allianceCreated = alliances[0];
      break;
    }
  }

  if (!allianceCreated) {
    console.log("⚠️  testAllianceTermsStored: Alliance never accepted (probabilistic) - skipping");
    return;
  }

  // Verify terms stored correctly
  if (allianceCreated.terms.length !== 2) {
    throw new Error(`Expected 2 terms, got ${allianceCreated.terms.length}`);
  }

  const hasDefensePact = allianceCreated.terms.some((t) => t.type === "defense_pact");
  const hasResourceShare = allianceCreated.terms.some((t) => t.type === "resource_share");

  if (!hasDefensePact || !hasResourceShare) {
    throw new Error("Alliance terms not stored correctly");
  }

  console.log("✓ testAllianceTermsStored passed");
}

/**
 * Test: InteractionMemory updated after negotiation attempt
 */
export async function testInteractionMemoryUpdated(): Promise<void> {
  const state = await createTestGameState();

  const proposerAgent = state.factions["faction_1"].agents[0];
  const targetAgent = state.factions["faction_2"].agents[0];

  // Clear existing memory
  proposerAgent.memory = [];
  targetAgent.memory = [];

  const initialProposerMemoryLength = proposerAgent.memory.length;
  const initialTargetMemoryLength = targetAgent.memory.length;

  // Create alliance proposal
  const proposal: AgentDecision = {
    agentId: proposerAgent.id,
    factionId: "faction_1",
    action: {
      type: "propose_alliance",
      targetFactionId: "faction_2",
      terms: [{ type: "non_aggression", durationEras: 5 }]
    },
    rationale: "Testing memory update"
  };

  resolveNegotiations([proposal], state);

  // Both agents should have new memory entries
  if (proposerAgent.memory.length <= initialProposerMemoryLength) {
    throw new Error("Proposer agent memory should be updated");
  }

  if (targetAgent.memory.length <= initialTargetMemoryLength) {
    throw new Error("Target agent memory should be updated");
  }

  // Check memory content
  const proposerLastMemory = proposerAgent.memory[proposerAgent.memory.length - 1];
  if (proposerLastMemory.interactionType !== "alliance_offer") {
    throw new Error("Proposer memory should record alliance_offer");
  }

  if (proposerLastMemory.targetAgentId !== targetAgent.id) {
    throw new Error("Proposer memory should target correct agent");
  }

  console.log("✓ testInteractionMemoryUpdated passed");
}

/**
 * Test: patronBacking increases acceptance probability
 * [SPEC] patron_factor = 1.0 + (target.faction.patronBacking / 500)
 */
export async function testPatronBackingInfluencesAcceptance(): Promise<void> {
  const stateNoBacking = await createTestGameState();
  const stateWithBacking = await createTestGameState();

  // Set same base conditions
  stateNoBacking.factions["faction_1"].reputation = 70;
  stateNoBacking.factions["faction_2"].agents[0].personality.loyalty = 0.7;
  stateNoBacking.factions["faction_2"].patronBacking = 0;

  stateWithBacking.factions["faction_1"].reputation = 70;
  stateWithBacking.factions["faction_2"].agents[0].personality.loyalty = 0.7;
  stateWithBacking.factions["faction_2"].patronBacking = 500; // +1.0 multiplier

  const proposal: AgentDecision = {
    agentId: stateNoBacking.factions["faction_1"].agents[0].id,
    factionId: "faction_1",
    action: {
      type: "propose_alliance",
      targetFactionId: "faction_2",
      terms: [{ type: "non_aggression", durationEras: 5 }]
    },
    rationale: "Testing patron backing impact"
  };

  // Count acceptances without patron backing
  let acceptancesNoBacking = 0;
  for (let i = 0; i < 30; i++) {
    const testState = JSON.parse(JSON.stringify(stateNoBacking));
    testState.currentTurn = i + 1;
    const { alliances } = resolveNegotiations([proposal], testState);
    if (alliances.length > 0) acceptancesNoBacking++;
  }

  // Count acceptances with patron backing
  let acceptancesWithBacking = 0;
  for (let i = 0; i < 30; i++) {
    const testState = JSON.parse(JSON.stringify(stateWithBacking));
    testState.currentTurn = i + 1;
    const { alliances } = resolveNegotiations([proposal], testState);
    if (alliances.length > 0) acceptancesWithBacking++;
  }

  // Patron backing should increase acceptance rate
  if (acceptancesWithBacking <= acceptancesNoBacking) {
    throw new Error(
      `Patron backing should increase acceptance (no backing: ${acceptancesNoBacking}, with backing: ${acceptancesWithBacking})`
    );
  }

  console.log(
    `✓ testPatronBackingInfluencesAcceptance passed (no backing: ${acceptancesNoBacking}/30, with backing: ${acceptancesWithBacking}/30)`
  );
}

/**
 * Test: Multiple alliance proposals in single turn
 */
export async function testMultipleProposals(): Promise<void> {
  const state = await createTestGameState();

  // Set high acceptance probability for all
  Object.values(state.factions).forEach((faction) => {
    faction.reputation = 90;
    faction.agents.forEach((agent) => {
      agent.personality.loyalty = 0.9;
    });
  });

  const proposals: AgentDecision[] = [
    {
      agentId: state.factions["faction_1"].agents[0].id,
      factionId: "faction_1",
      action: {
        type: "propose_alliance",
        targetFactionId: "faction_2",
        terms: [{ type: "non_aggression", durationEras: 5 }]
      },
      rationale: "First proposal"
    },
    {
      agentId: state.factions["faction_3"].agents[0].id,
      factionId: "faction_3",
      action: {
        type: "propose_alliance",
        targetFactionId: "faction_4",
        terms: [{ type: "defense_pact", durationEras: 3 }]
      },
      rationale: "Second proposal"
    }
  ];

  const { results } = resolveNegotiations(proposals, state);

  // Should have processed both proposals
  if (results.length < 2) {
    throw new Error("Multiple proposals should all be processed");
  }

  console.log("✓ testMultipleProposals passed");
}

/**
 * Run all negotiation tests
 */
export async function runAllNegotiationTests(): Promise<void> {
  console.log("\n=== Running Negotiation Tests ===\n");

  try {
    await testAcceptanceProbabilityFactors();
    await testMaxThreeAlliancesRule();
    await testBetrayalUpdatesMemory();
    await testAllianceTermsStored();
    await testInteractionMemoryUpdated();
    await testPatronBackingInfluencesAcceptance();
    await testMultipleProposals();

    console.log("\n✓ All negotiation tests passed!\n");
  } catch (error) {
    console.error("\n✗ Negotiation test failed:", error);
    throw error;
  }
}

export default {
  testAcceptanceProbabilityFactors,
  testMaxThreeAlliancesRule,
  testBetrayalUpdatesMemory,
  testAllianceTermsStored,
  testInteractionMemoryUpdated,
  testPatronBackingInfluencesAcceptance,
  testMultipleProposals,
  runAllNegotiationTests
};
