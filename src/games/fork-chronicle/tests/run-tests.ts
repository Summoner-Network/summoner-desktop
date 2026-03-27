/**
 * Test runner for Fork Chronicle
 * Execute with: npx tsx src/games/fork-chronicle/tests/run-tests.ts
 */

import { runAllTests as runSetupTests } from "./setup.test";
import { runAllTurnLoopTests } from "./turn-loop.test";
import { runAllArchitectureTests } from "./architecture.test";
import { runAllCombatTests } from "./combat.test";
import { runAllWinConditionTests } from "./win-condition.test";
import { runAllAgentIntelligenceTests } from "./agent-intelligence.test";
import { runAllNegotiationTests } from "./negotiation.test";
import { runAllBettingTests } from "./betting.test";

// Run all test suites
console.log("════════════════════════════════════════════════════════");
console.log("  Fork: A Chronicle of Alternate Histories - Test Suite");
console.log("════════════════════════════════════════════════════════");

async function runAllTests() {
  try {
    runSetupTests();
    await runAllTurnLoopTests();
    runAllArchitectureTests();
    runAllCombatTests();
    runAllWinConditionTests();
    await runAllAgentIntelligenceTests();
    runAllNegotiationTests();
    runAllBettingTests();

    console.log("════════════════════════════════════════════════════════");
    console.log("  ✓ ALL TEST SUITES PASSED");
    console.log("════════════════════════════════════════════════════════\n");
  } catch (error) {
    console.error("════════════════════════════════════════════════════════");
    console.error("  ✗ TEST SUITE FAILED");
    console.error("════════════════════════════════════════════════════════\n");
    process.exit(1);
  }
}

runAllTests();
