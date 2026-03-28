/**
 * Event injection and effect application engine
 * Section 5.2: Event Injection System
 */

import type { GameState } from "../types/game-state";
import type { HistoricalEvent, EventEffect } from "../types/event";
import type { FactionId } from "../types/faction";
import { emitEventInjected } from "../analytics/analytics-emitter";
import { applyReputationFloor } from "./patron";
import { safeAddIP } from "./betting";

/**
 * Apply a single event effect to the game state
 */
function applyEffect(effect: EventEffect, state: GameState): string[] {
  const results: string[] = [];

  switch (effect.type) {
    case "strength_delta": {
      if (effect.targetType === "territory" && effect.targetId) {
        // Apply to specific territory
        const territory = state.territories[effect.targetId];
        if (territory) {
          territory.strength += effect.magnitude;
          territory.strength = Math.max(0, territory.strength); // Floor at 0
          results.push(`${effect.description}: ${territory.name} strength ${effect.magnitude > 0 ? "+" : ""}${effect.magnitude}`);
        }
      } else if (effect.targetType === "faction" && effect.targetId) {
        // Apply to all territories controlled by faction
        const faction = state.factions[effect.targetId as FactionId];
        if (faction) {
          faction.territories.forEach((tId) => {
            const territory = state.territories[tId];
            territory.strength += effect.magnitude;
            territory.strength = Math.max(0, territory.strength);
          });
          results.push(`${effect.description}: ${faction.name} territories strength ${effect.magnitude > 0 ? "+" : ""}${effect.magnitude}`);
        }
      } else if (effect.targetType === "global") {
        // Apply to all territories globally
        Object.values(state.territories).forEach((territory) => {
          territory.strength += effect.magnitude;
          territory.strength = Math.max(0, territory.strength);
        });
        results.push(`${effect.description}: Global strength ${effect.magnitude > 0 ? "+" : ""}${effect.magnitude}`);
      }
      break;
    }

    case "resource_delta": {
      if (effect.targetType === "territory" && effect.targetId) {
        // Apply to specific territory
        const territory = state.territories[effect.targetId];
        if (territory) {
          territory.resources.food += effect.magnitude;
          territory.resources.food = Math.max(0, territory.resources.food);
          results.push(`${effect.description}: ${territory.name} food ${effect.magnitude > 0 ? "+" : ""}${effect.magnitude}`);
        }
      } else if (effect.targetType === "faction" && effect.targetId) {
        // Apply to all territories controlled by faction
        const faction = state.factions[effect.targetId as FactionId];
        if (faction) {
          faction.territories.forEach((tId) => {
            const territory = state.territories[tId];
            territory.resources.food += effect.magnitude;
            territory.resources.food = Math.max(0, territory.resources.food);
          });
          results.push(`${effect.description}: ${faction.name} resources ${effect.magnitude > 0 ? "+" : ""}${effect.magnitude}`);
        }
      } else if (effect.targetType === "global") {
        // Apply to all territories globally
        Object.values(state.territories).forEach((territory) => {
          territory.resources.food += effect.magnitude;
          territory.resources.food = Math.max(0, territory.resources.food);
        });
        results.push(`${effect.description}: Global resources ${effect.magnitude > 0 ? "+" : ""}${effect.magnitude}`);
      }
      break;
    }

    case "reputation_delta": {
      if (effect.targetType === "faction" && effect.targetId) {
        // Apply to specific faction
        const faction = state.factions[effect.targetId as FactionId];
        if (faction) {
          faction.reputation += effect.magnitude;
          faction.reputation = Math.max(0, Math.min(100, faction.reputation)); // Clamp 0-100

          // Apply reputation floor if negative change (patron benefit)
          if (effect.magnitude < 0) {
            applyReputationFloor(effect.targetId as FactionId, state);
          }

          results.push(`${effect.description}: ${faction.name} reputation ${effect.magnitude > 0 ? "+" : ""}${effect.magnitude}`);
        }
      } else if (effect.targetType === "global") {
        // Apply to all factions
        Object.values(state.factions).forEach((faction) => {
          faction.reputation += effect.magnitude;
          faction.reputation = Math.max(0, Math.min(100, faction.reputation));

          // Apply reputation floor if negative change (patron benefit)
          if (effect.magnitude < 0) {
            applyReputationFloor(faction.id, state);
          }
        });
        results.push(`${effect.description}: Global reputation ${effect.magnitude > 0 ? "+" : ""}${effect.magnitude}`);
      }
      break;
    }

    case "tech_boost": {
      if (effect.targetType === "territory" && effect.targetId) {
        // Apply multiplier to specific territory
        const territory = state.territories[effect.targetId];
        if (territory) {
          territory.resources.tech *= effect.magnitude;
          results.push(`${effect.description}: ${territory.name} tech ×${effect.magnitude}`);
        }
      } else if (effect.targetType === "faction" && effect.targetId) {
        // Apply to all territories controlled by faction
        const faction = state.factions[effect.targetId as FactionId];
        if (faction) {
          faction.territories.forEach((tId) => {
            const territory = state.territories[tId];
            territory.resources.tech *= effect.magnitude;
          });
          results.push(`${effect.description}: ${faction.name} tech ×${effect.magnitude}`);
        }
      } else if (effect.targetType === "global") {
        // Apply to all territories globally
        Object.values(state.territories).forEach((territory) => {
          territory.resources.tech *= effect.magnitude;
        });
        results.push(`${effect.description}: Global tech ×${effect.magnitude}`);
      }
      break;
    }

    case "control_transfer": {
      if (effect.targetType === "territory" && effect.targetId) {
        const territory = state.territories[effect.targetId];
        if (territory) {
          const oldController = territory.controlledBy;
          const newController = effect.magnitude === 0 ? null : `faction_${effect.magnitude}` as FactionId;

          // Remove from old faction
          if (oldController) {
            const oldFaction = state.factions[oldController];
            oldFaction.territories = oldFaction.territories.filter((tId) => tId !== effect.targetId);
          }

          // Add to new faction
          if (newController && state.factions[newController]) {
            const newFaction = state.factions[newController];
            newFaction.territories.push(effect.targetId);
            territory.controlledBy = newController;
            results.push(`${effect.description}: ${territory.name} transferred to ${newFaction.name}`);
          } else {
            // Set to neutral
            territory.controlledBy = null;
            results.push(`${effect.description}: ${territory.name} now neutral`);
          }
        }
      }
      break;
    }

    case "alliance_break": {
      // Find and break the specified alliance
      const alliance = state.alliances.find((a) => a.id === effect.targetId);
      if (alliance && alliance.status === "active") {
        alliance.status = "broken";
        alliance.trustScore = 0;
        results.push(`${effect.description}: Alliance ${alliance.id} broken`);
      }
      break;
    }

    case "spawn_territory": {
      // This is a complex operation - for MVP, just log
      results.push(`${effect.description}: Territory spawn (not implemented)`);
      break;
    }
  }

  return results;
}

/**
 * Apply all effects from a historical event
 * Returns array of result messages
 */
export function applyEventEffects(event: HistoricalEvent, state: GameState): string[] {
  const results: string[] = [];

  results.push(`🎴 Event: ${event.title}`);
  results.push(`   ${event.description}`);

  // Apply immediate effects
  event.effects.forEach((effect) => {
    const effectResults = applyEffect(effect, state);
    results.push(...effectResults.map((r) => `   ${r}`));
  });

  return results;
}

/**
 * Queue ripple effects for execution at the start of next era
 * Ripple effects are stored in activeEvents with expiresOnTurn set to next era start
 */
export function queueRippleEffects(event: HistoricalEvent, state: GameState): string[] {
  const results: string[] = [];

  if (event.rippleEffects.length > 0) {
    // Calculate next era start turn
    const nextEraTurn = Math.ceil((state.currentTurn + 1) / 5) * 5 + 1;

    // Create a synthetic event for ripple effects
    const rippleEvent: HistoricalEvent = {
      ...event,
      id: `${event.id}_ripple`,
      title: `${event.title} (Ripple)`,
      effects: event.rippleEffects,
      rippleEffects: [] // Ripples don't have further ripples
    };

    // Add to active events
    state.activeEvents.push({
      event: rippleEvent,
      activatedOnTurn: state.currentTurn,
      expiresOnTurn: nextEraTurn
    });

    results.push(`   ⏱️  Ripple effects queued for turn ${nextEraTurn}`);
  }

  return results;
}

/**
 * Process all ripple effects that are ready to fire this turn
 * Called at the start of each era
 */
export function processRippleEffects(state: GameState): string[] {
  const results: string[] = [];
  const currentTurn = state.currentTurn;

  // Find all active events that expire this turn
  const readyEvents = state.activeEvents.filter(
    (ae) => ae.expiresOnTurn === currentTurn
  );

  if (readyEvents.length > 0) {
    results.push(`\n🌊 Ripple Effects Firing:`);

    readyEvents.forEach((activeEvent) => {
      const effectResults = applyEventEffects(activeEvent.event, state);
      results.push(...effectResults);
    });

    // Remove processed events from activeEvents
    state.activeEvents = state.activeEvents.filter(
      (ae) => ae.expiresOnTurn !== currentTurn
    );
  }

  return results;
}

/**
 * Play an event card from a player's hand
 * [RULE] Player must have the card in currentDrawnCard
 * [RULE] Player must have sufficient IP (ipCost)
 * [RULE] Cannot play on Turn 1
 * [RULE] Card is discarded after play
 * [RULE] Card expires at end of current era if unplayed
 */
export function playEventCard(
  playerId: string,
  state: GameState
): { success: boolean; error?: string; results?: string[] } {
  const player = state.playerStates[playerId];

  if (!player) {
    return { success: false, error: "Player not found" };
  }

  // [RULE] Cannot play on Turn 1
  if (state.currentTurn === 1) {
    return { success: false, error: "Cannot play event cards on Turn 1" };
  }

  // Check if player has a card
  if (!player.currentDrawnCard) {
    return { success: false, error: "No event card in hand" };
  }

  const event = player.currentDrawnCard;

  // Check if player has enough IP
  if (player.influencePoints < event.ipCost) {
    return {
      success: false,
      error: `Insufficient IP (need ${event.ipCost}, have ${player.influencePoints})`
    };
  }

  // Deduct IP cost
  player.influencePoints = safeAddIP(player.influencePoints, -event.ipCost);

  // Apply event effects
  const results: string[] = [];
  results.push(`\n💳 ${playerId} plays event card (${event.ipCost} IP):`);

  const effectResults = applyEventEffects(event, state);
  results.push(...effectResults);

  // Queue ripple effects
  const rippleResults = queueRippleEffects(event, state);
  results.push(...rippleResults);

  // Discard the card
  state.eventDiscard.push(event);
  player.currentDrawnCard = null;

  // Record action
  player.actionsThisTurn.push({
    type: "event_injection",
    playerId,
    eventId: event.id,
    injectedOnTurn: state.currentTurn,
    cost: event.ipCost
  });

  // Emit to Summoner Analytics
  emitEventInjected(state, playerId, event.id, event.title);

  return { success: true, results };
}

/**
 * Expire unplayed event cards at end of era
 * Called during era_summary phase
 */
export function expireUnplayedCards(state: GameState): string[] {
  const results: string[] = [];

  Object.values(state.playerStates).forEach((player) => {
    if (player.currentDrawnCard) {
      results.push(`   ⏰ ${player.playerId}'s card expired: ${player.currentDrawnCard.title}`);

      // Move card to discard
      state.eventDiscard.push(player.currentDrawnCard);
      player.currentDrawnCard = null;
    }
  });

  return results;
}
