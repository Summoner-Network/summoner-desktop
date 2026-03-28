/**
 * Summoner Analytics Bridge for Fork: A Chronicle of Alternate Histories
 * Section 11: Summoner Analytics Integration
 *
 * This bridge connects Fork game events to Summoner's analytics system.
 * In MVP this is an in-memory buffer. In v1.0 this wires to the real
 * Summoner Analytics system via Electron IPC.
 */

import type { GameState } from "../types/game-state";
import type { AgentAction } from "../types/agent";

export type SummonerAnalyticsEventType =
  | "agent_decision"
  | "territory_changed"
  | "alliance_formed"
  | "alliance_broken"
  | "event_injected"
  | "era_summary"
  | "game_over"
  | "bet_resolved"
  | "patron_activated";

export interface SummonerAnalyticsEvent {
  gameId: string;
  turn: number;
  era: number;
  eventType: SummonerAnalyticsEventType;
  payload: unknown;
  timestamp: number;
  stateHash: string;
}

export interface SummonerAnalyticsBridge {
  emit(event: SummonerAnalyticsEvent): void;
  flush(): SummonerAnalyticsEvent[];
  getEventsByType(type: SummonerAnalyticsEventType): SummonerAnalyticsEvent[];
  getEventsByTurn(turn: number): SummonerAnalyticsEvent[];
  exportForReplay(): SummonerAnalyticsEvent[];
}

/**
 * Generate a SHA-256 hash of the relevant GameState slice
 * for replay validation and audit trail
 *
 * Uses Web Crypto API (available in browsers and Electron renderer)
 */
export async function generateStateHash(state: GameState): Promise<string> {
  const relevantState = {
    turn: state.currentTurn,
    territories: state.territories,
    factions: Object.fromEntries(
      Object.entries(state.factions).map(([id, f]) => [
        id,
        { territories: f.territories, reputation: f.reputation },
      ])
    ),
  };

  // Use a deterministic stringification by sorting keys at all levels
  const stateString = JSON.stringify(relevantState, (key, value) => {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      return Object.keys(value)
        .sort()
        .reduce((sorted: any, key) => {
          sorted[key] = value[key];
          return sorted;
        }, {});
    }
    return value;
  });

  // Use Web Crypto API instead of Node.js crypto
  const msgBuffer = new TextEncoder().encode(stateString);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * In-memory implementation of SummonerAnalyticsBridge for MVP
 */
export class InMemorySummonerAnalyticsBridge implements SummonerAnalyticsBridge {
  private events: SummonerAnalyticsEvent[] = [];

  emit(event: SummonerAnalyticsEvent): void {
    this.events.push(event);
  }

  flush(): SummonerAnalyticsEvent[] {
    const flushed = [...this.events];
    this.events = [];
    return flushed;
  }

  getEventsByType(type: SummonerAnalyticsEventType): SummonerAnalyticsEvent[] {
    return this.events.filter((e) => e.eventType === type);
  }

  getEventsByTurn(turn: number): SummonerAnalyticsEvent[] {
    return this.events.filter((e) => e.turn === turn);
  }

  exportForReplay(): SummonerAnalyticsEvent[] {
    return [...this.events];
  }

  /**
   * Get total event count (for testing)
   */
  getEventCount(): number {
    return this.events.length;
  }

  /**
   * Clear all events (for testing)
   */
  clear(): void {
    this.events = [];
  }
}

/**
 * Replay validation report
 */
export interface ReplayValidationReport {
  valid: boolean;
  turnsValidated: number;
  hashMismatches: number;
  firstMismatchTurn: number | null;
}

/**
 * Validate replay data by checking state hash consistency
 */
export function validateReplay(events: SummonerAnalyticsEvent[]): ReplayValidationReport {
  const report: ReplayValidationReport = {
    valid: true,
    turnsValidated: 0,
    hashMismatches: 0,
    firstMismatchTurn: null,
  };

  // Group events by turn
  const eventsByTurn = new Map<number, SummonerAnalyticsEvent[]>();
  events.forEach((event) => {
    if (!eventsByTurn.has(event.turn)) {
      eventsByTurn.set(event.turn, []);
    }
    eventsByTurn.get(event.turn)!.push(event);
  });

  // Validate hash consistency within each turn
  const turns = Array.from(eventsByTurn.keys()).sort((a, b) => a - b);

  for (const turn of turns) {
    const turnEvents = eventsByTurn.get(turn)!;
    const hashes = new Set(turnEvents.map((e) => e.stateHash));

    // All events in a turn should have the same stateHash
    // (they're all from the same game state snapshot)
    if (hashes.size > 1) {
      report.hashMismatches += 1;
      if (report.firstMismatchTurn === null) {
        report.firstMismatchTurn = turn;
      }
      report.valid = false;
    }

    report.turnsValidated += 1;
  }

  return report;
}

/**
 * Agent decision payload for analytics
 */
export interface AgentDecisionPayload {
  agentId: string;
  factionId: string;
  turn: number;
  era: number;
  action: AgentAction;
  rationale: string;
  stateHash: string;
}
