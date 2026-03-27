/**
 * IPC bridge between Fork game engine and Electron main process
 * Section 17.1: Electron Desktop App Integration
 *
 * [STUB] In MVP this is a stub. In v1.0 this wires Fork's MapRenderPayload
 * to the existing Summoner map component via Electron IPC.
 */

import type { MapRenderPayload } from "../src/types/map-render";
import type { EraCard } from "../src/types/game-state";
import type { AgentDecision } from "../src/types/agent";
import type { PlayerAction } from "../src/types/player";

export interface ForkElectronBridge {
  // Send updated map state to the existing desktop map component
  sendMapUpdate(payload: MapRenderPayload): void;

  // Send era card to the existing Summoner Analytics panel
  sendEraCard(card: EraCard): void;

  // Send agent decision to the existing agent activity feed
  sendAgentDecision(decision: AgentDecision): void;

  // Listen for player actions coming from the desktop UI
  onPlayerAction(handler: (action: PlayerAction) => void): void;
}

/**
 * MVP stub — logs to console, replace with real IPC in v1.0
 *
 * Integration path for v1.0:
 * 1. Claude Code scans existing src/ for the map component IPC channel name
 * 2. Replace stub methods with real ipcRenderer.send() / ipcRenderer.on() calls
 * 3. Add a "Launch Fork" button to the existing Electron app nav
 * 4. Fork game panel opens as a new BrowserWindow or tab within the existing shell
 */
export const forkBridge: ForkElectronBridge = {
  sendMapUpdate: (payload) => {
    console.log("[Fork] Map update:", {
      territoryCount: Object.keys(payload.territories).length,
      factionCount: Object.keys(payload.factionColors).length,
      highlighted: payload.highlightedTerritories?.length || 0
    });
  },

  sendEraCard: (card) => {
    console.log("[Fork] Era card:", {
      era: card.era,
      leader: card.leaderFaction,
      turns: card.turns
    });
  },

  sendAgentDecision: (decision) => {
    console.log("[Fork] Agent decision:", {
      agent: decision.agentId,
      faction: decision.factionId,
      action: decision.action.type,
      rationale: decision.rationale
    });
  },

  onPlayerAction: (handler) => {
    console.log("[Fork] Player action handler registered");
    // In v1.0, this would be:
    // ipcRenderer.on('fork:player-action', (event, action) => handler(action));
  }
};
