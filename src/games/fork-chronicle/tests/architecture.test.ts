/**
 * Unit tests for forward architecture interfaces
 * Tests for Section 17: Forward Architecture
 */

import {
  createAgentIntelligence,
  RuleBasedIntelligence,
  ClaudeIntelligence,
  RemoteAgentIntelligence,
  createRemoteAgentIntelligence
} from "../src/engine/agent-intelligence";
import { forkBridge } from "../electron/bridge";
import type { MapRenderPayload } from "../src/types/map-render";
import type { EraCard } from "../src/types/game-state";
import type { AgentDecision } from "../src/types/agent";

/**
 * Test: AgentIntelligence interface exists and factory works
 */
export function testAgentIntelligenceFactory(): void {
  // Rule-based should be default
  const ruleBasedIntel = createAgentIntelligence("rule-based");

  if (!(ruleBasedIntel instanceof RuleBasedIntelligence)) {
    throw new Error("Factory should return RuleBasedIntelligence for 'rule-based' mode");
  }

  console.log("✓ testAgentIntelligenceFactory passed");
}

/**
 * Test: Claude intelligence requires API key
 */
export function testClaudeIntelligenceRequiresApiKey(): void {
  // Save original env
  const originalKey = process.env.ANTHROPIC_API_KEY;

  try {
    // Clear API key
    delete process.env.ANTHROPIC_API_KEY;

    // Should throw error
    let errorThrown = false;
    try {
      createAgentIntelligence("claude");
    } catch (error) {
      if (error instanceof Error && error.message.includes("ANTHROPIC_API_KEY")) {
        errorThrown = true;
      }
    }

    if (!errorThrown) {
      throw new Error("Should throw error when ANTHROPIC_API_KEY is missing");
    }

    console.log("✓ testClaudeIntelligenceRequiresApiKey passed");
  } finally {
    // Restore original env
    if (originalKey) {
      process.env.ANTHROPIC_API_KEY = originalKey;
    }
  }
}

/**
 * Test: Remote agent intelligence can be created
 */
export function testRemoteAgentIntelligenceCreation(): void {
  const remoteIntel = createRemoteAgentIntelligence(
    "did:summoner:fra-paris-01",
    "https://relay.paris.summoner.org"
  );

  if (!(remoteIntel instanceof RemoteAgentIntelligence)) {
    throw new Error("Should create RemoteAgentIntelligence instance");
  }

  console.log("✓ testRemoteAgentIntelligenceCreation passed");
}

/**
 * Test: Electron bridge interface exists and logs
 */
export function testElectronBridgeStub(): void {
  // Test that bridge methods exist and don't throw
  const mockMapPayload: MapRenderPayload = {
    territories: {
      USA: {
        controlledBy: "faction_1",
        strength: 75,
        contested: false,
        activeEffects: []
      }
    },
    factionColors: {
      faction_1: "#FF6B6B"
    }
  };

  const mockEraCard: EraCard = {
    era: 1,
    turns: [1, 2, 3, 4, 5],
    leaderFaction: "faction_1",
    biggestGain: { factionId: "faction_1", territoriesGained: 2 },
    biggestLoss: { factionId: "faction_2", territoriesLost: 1 },
    alliancesFormed: 1,
    alliancesBroken: 0,
    eventsInjected: 2,
    mvpAgent: { agentId: "agent_1", reason: "Strategic conquest" },
    narrativeSummary: "The era saw rapid expansion."
  };

  const mockAgentDecision: AgentDecision = {
    agentId: "agent_1",
    factionId: "faction_1",
    action: { type: "pass" },
    rationale: "Consolidating position"
  };

  // These should not throw
  forkBridge.sendMapUpdate(mockMapPayload);
  forkBridge.sendEraCard(mockEraCard);
  forkBridge.sendAgentDecision(mockAgentDecision);
  forkBridge.onPlayerAction(() => {});

  console.log("✓ testElectronBridgeStub passed");
}

/**
 * Test: All intelligence classes implement the interface
 */
export function testAllIntelligenceImplementations(): void {
  const ruleBasedIntel = new RuleBasedIntelligence();
  const claudeIntel = new ClaudeIntelligence("test-key");
  const remoteIntel = new RemoteAgentIntelligence(
    "did:test",
    "https://test.example.com"
  );

  // All should have deliberate method
  if (typeof ruleBasedIntel.deliberate !== "function") {
    throw new Error("RuleBasedIntelligence missing deliberate method");
  }
  if (typeof claudeIntel.deliberate !== "function") {
    throw new Error("ClaudeIntelligence missing deliberate method");
  }
  if (typeof remoteIntel.deliberate !== "function") {
    throw new Error("RemoteAgentIntelligence missing deliberate method");
  }

  console.log("✓ testAllIntelligenceImplementations passed");
}

/**
 * Run all architecture tests
 */
export function runAllArchitectureTests(): void {
  console.log("\n=== Running Architecture Tests ===\n");

  try {
    testAgentIntelligenceFactory();
    testClaudeIntelligenceRequiresApiKey();
    testRemoteAgentIntelligenceCreation();
    testAllIntelligenceImplementations();
    testElectronBridgeStub();

    console.log("\n✓ All architecture tests passed!\n");
  } catch (error) {
    console.error("\n✗ Architecture test failed:", error);
    throw error;
  }
}

export default {
  testAgentIntelligenceFactory,
  testClaudeIntelligenceRequiresApiKey,
  testRemoteAgentIntelligenceCreation,
  testAllIntelligenceImplementations,
  testElectronBridgeStub,
  runAllArchitectureTests
};
