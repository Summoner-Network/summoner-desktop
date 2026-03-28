/**
 * React hook for running the Fork Chronicle game engine
 */

import { useState, useCallback, useEffect, useRef } from "react";
import { initializeGame } from "../src/engine/setup";
import { executeTurn } from "../src/engine/turn-loop";
import { playEventCard as enginePlayEventCard } from "../src/engine/events";
import type { GameState, GameConfig } from "../src/types/game-state";
import type { PlayerState, BetAction, EventInjectionAction, PatronAction } from "../src/types/player";
import { fetchWikipediaEventsForYear, wikiEventToGameEvent } from "../src/utils/wikipedia-events";

export interface LiveLogEntry {
  turn: number;
  era: number;
  type: 'event' | 'combat' | 'alliance' | 'investment' | 'ip' | 'general';
  message: string;
  emoji: string;
}

export interface UseForkGameReturn {
  gameState: GameState | null;
  playerState: PlayerState | null;
  isRunning: boolean;
  isPaused: boolean;
  gameEnded: boolean;
  turnSpeed: number;
  error: string | null;
  liveLog: LiveLogEntry[];
  startGame: (config: GameConfig) => Promise<void>;
  stopGame: () => void;
  newGame: () => void;
  pauseGame: () => void;
  resumeGame: () => void;
  setTurnSpeed: (ms: number) => void;
  directiveCountdown: number;
  showDirective: boolean;
  tickerMessages: string[];
  submitDirective: (directive: string) => void;
  activeEventBanner: { title: string; description: string } | null;
  eventImpact: { title: string; lines: string[]; tier: number } | null;
  placeBet: (bet: Omit<BetAction, "type" | "placedOnTurn" | "odds">) => void;
  playEventCard: () => void;
  playEventCardWithImpact: () => void;
  patronBacking: (action: Omit<PatronAction, "type">) => void;
}

export function useForkGame(): UseForkGameReturn {
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [turnSpeed, setTurnSpeedState] = useState(3000);
  const [gameEnded, setGameEnded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [liveLog, setLiveLog] = useState<LiveLogEntry[]>([]);
  const [directiveCountdown, setDirectiveCountdown] = useState(0);
  const [showDirective, setShowDirective] = useState(false);
  const [lastDirectiveEra, setLastDirectiveEra] = useState(0);
  const [tickerMessages, setTickerMessages] = useState<string[]>([]);
  const turnTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const directiveTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastEraRef = useRef(0);
  const usedWikiEventIds = useRef<Set<string>>(new Set());

  // Draw a Wikipedia event card for the player
  const drawPlayerEventCard = useCallback(async (state: GameState): Promise<GameState> => {
    const playerId = "player_1";
    const playerState = state.playerStates[playerId];
    if (!playerState) return state;

    try {
      const epochStartYear = state.epoch?.year ?? 1914;
      const currentGameYear = epochStartYear + (state.currentEra - 1) * 5;
      const wikiEvents = await fetchWikipediaEventsForYear(currentGameYear);
      if (wikiEvents && wikiEvents.length > 0) {
        // Filter out already-used events to avoid repeats
        const unusedEvents = wikiEvents.filter(e => {
          const id = `${e.year}-${e.text.slice(0, 30)}`;
          return !usedWikiEventIds.current.has(id);
        });
        const pool = unusedEvents.length > 0 ? unusedEvents : wikiEvents;
        const picked = pool[Math.floor(Math.random() * pool.length)];
        // Mark as used
        usedWikiEventIds.current.add(`${picked.year}-${picked.text.slice(0, 30)}`);
        const tier: 1 | 2 | 3 = Math.random() < 0.15 ? 3 : Math.random() < 0.45 ? 2 : 1;
        const gameEvent = wikiEventToGameEvent(picked, tier);
        console.log('[Fork] Wikipedia event drawn for year', currentGameYear, ':', gameEvent.title, '(Wikipedia year:', picked.year, ')');
        return {
          ...state,
          playerStates: {
            ...state.playerStates,
            [playerId]: { ...playerState, currentDrawnCard: gameEvent },
          },
        };
      }
    } catch (e) {
      console.warn('[Fork] Wikipedia fetch failed, using deck:', e);
    }

    // Fallback to deck
    console.log('[Fork] Using fallback deck card');
    const deck = state.eventDeck;
    if (deck.length > 0) {
      return {
        ...state,
        playerStates: {
          ...state.playerStates,
          [playerId]: { ...playerState, currentDrawnCard: deck[0] },
        },
        eventDeck: deck.slice(1),
      };
    }
    if (state.eventDiscard.length > 0) {
      return {
        ...state,
        playerStates: {
          ...state.playerStates,
          [playerId]: { ...playerState, currentDrawnCard: state.eventDiscard[0] },
        },
      };
    }
    return state;
  }, []);

  const startGame = useCallback(async (config: GameConfig) => {
    setError(null);
    setLiveLog([]);
    setTickerMessages([]);
    try {
      // Always generate a fresh seed to avoid reusing previous game's seed
      const freshConfig: GameConfig = {
        ...config,
        seed: `fork-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      };
      let state = await initializeGame(freshConfig);
      // Draw initial Wikipedia event card for the player
      state = await drawPlayerEventCard(state);
      gameStateRef.current = state;
      isRunningRef.current = true;
      setGameState(state);
      setIsRunning(true);
    } catch (err) {
      console.error('[Fork] Failed to initialize game:', err);
      setError(`Failed to start game: ${String(err)}. Try a different epoch or faction count.`);
    }
  }, [drawPlayerEventCard]);

  const stopGame = useCallback(() => {
    setIsRunning(false);
    setIsPaused(false);
    setGameEnded(true);
    if (turnTimerRef.current) {
      clearTimeout(turnTimerRef.current);
      turnTimerRef.current = null;
    }
  }, []);

  const newGame = useCallback(() => {
    // Clear all timers
    if (turnTimerRef.current) {
      clearTimeout(turnTimerRef.current);
      turnTimerRef.current = null;
    }
    if (directiveTimerRef.current) {
      clearInterval(directiveTimerRef.current);
      directiveTimerRef.current = null;
    }
    // Reset all refs
    isRunningRef.current = false;
    isPausedRef.current = false;
    gameStateRef.current = null;
    lastEraRef.current = 0;
    lastDirectiveEraRef.current = 0;
    // Reset all state
    setGameState(null);
    setIsRunning(false);
    setIsPaused(false);
    setGameEnded(false);
    setLiveLog([]);
    setError(null);
    setDirectiveCountdown(0);
    setShowDirective(false);
    setLastDirectiveEra(0);
    setTickerMessages([]);
    setActiveEventBanner(null);
    setEventImpact(null);
    usedWikiEventIds.current = new Set();
  }, []);

  const pauseGame = useCallback(() => {
    setIsPaused(true);
    if (turnTimerRef.current) {
      clearTimeout(turnTimerRef.current);
      turnTimerRef.current = null;
    }
  }, []);

  const resumeGame = useCallback(() => {
    setIsPaused(false);
  }, []);

  const submitDirective = useCallback((directive: string) => {
    console.log('[Commander] Directive issued:', directive);
    // Clear countdown timer and resume
    if (directiveTimerRef.current) {
      clearInterval(directiveTimerRef.current);
      directiveTimerRef.current = null;
    }
    setShowDirective(false);
    setDirectiveCountdown(0);
    setIsPaused(false);
  }, []);

  const setTurnSpeed = useCallback((ms: number) => {
    setTurnSpeedState(ms);
    turnSpeedRef.current = ms;
    // Cancel current timer so the next tick uses the new speed
    if (turnTimerRef.current) {
      clearTimeout(turnTimerRef.current);
      turnTimerRef.current = null;
    }
    // The isRunning/isPaused useEffect will restart the loop with new speed
  }, []);

  // Refs to avoid stale closures
  const isRunningRef = useRef(false);
  const isPausedRef = useRef(false);
  const gameStateRef = useRef<GameState | null>(null);
  const turnSpeedRef = useRef(3000);
  const lastDirectiveEraRef = useRef(0);

  // Keep refs in sync with state
  useEffect(() => { isRunningRef.current = isRunning; }, [isRunning]);
  useEffect(() => { isPausedRef.current = isPaused; }, [isPaused]);
  useEffect(() => { gameStateRef.current = gameState; }, [gameState]);
  useEffect(() => { turnSpeedRef.current = turnSpeed; }, [turnSpeed]);

  // Turn loop function that uses refs (no stale closures)
  const runLoop = useCallback(async () => {
    if (!isRunningRef.current || isPausedRef.current) return;
    const current = gameStateRef.current;
    if (!current || current.phase === 'game_over') {
      isRunningRef.current = false;
      setIsRunning(false);
      setGameEnded(true);
      return;
    }
    try {
      console.log('[Fork] Executing turn', current.currentTurn);
      const historyLenBefore = current.history.length;
      let next = await executeTurn(current);

      // Draw a new Wikipedia card if the player has none
      const player = next.playerStates["player_1"];
      if (player && !player.currentDrawnCard) {
        next = await drawPlayerEventCard(next);
      }

      gameStateRef.current = next;
      setGameState(next);

      // Detect new era — auto-pause for directive input (once per era only)
      if (next.currentEra > lastDirectiveEraRef.current && lastEraRef.current > 0) {
        lastDirectiveEraRef.current = next.currentEra;
        setLastDirectiveEra(next.currentEra);
        setShowDirective(true);
        isPausedRef.current = true;
        setIsPaused(true);
        setDirectiveCountdown(15);
        if (directiveTimerRef.current) clearInterval(directiveTimerRef.current);
        directiveTimerRef.current = setInterval(() => {
          setDirectiveCountdown(prev => {
            if (prev <= 1) {
              if (directiveTimerRef.current) clearInterval(directiveTimerRef.current);
              directiveTimerRef.current = null;
              setShowDirective(false);
              isPausedRef.current = false;
              setIsPaused(false);
              return 0;
            }
            return prev - 1;
          });
        }, 1000);
      }
      lastEraRef.current = next.currentEra;

      // Collect ALL events from ALL new history records added this turn
      // (executeTurn adds one record per phase: event_reveal, player_actions,
      //  agent_deliberation, agent_negotiation, agent_action, resolution, [era_summary])
      const newRecords = next.history.slice(historyLenBefore);
      const allTurnEvents = newRecords.flatMap(r => r.events);
      const turnMeta = newRecords[0] ?? next.history[next.history.length - 1];

      // Extract ticker messages — agent actions only (combat, diplomacy, investment)
      {
        const agentActionEvents = allTurnEvents
          .filter(msg =>
            msg.includes('conquered') ||
            msg.includes('defended') ||
            msg.includes('reinforced') ||
            msg.includes('invested') ||
            msg.includes('formed an alliance') ||
            msg.includes('rejected') ||
            msg.includes('passed')
          )
          .filter(msg => !msg.includes('Ripple'))
          .filter(msg => !msg.includes('event_reveal'))
          .map(msg => {
            let clean = msg;
            if (next.factions) {
              Object.entries(next.factions).forEach(([id, f]) => {
                clean = clean.replaceAll(id, (f as any).name);
              });
            }
            clean = clean
              .replace(/diplomat \d+/gi, 'Diplomat')
              .replace(/conqueror \d+/gi, 'Conqueror')
              .replace(/economist \d+/gi, 'Economist')
              .replace(/historian \d+/gi, 'Historian')
              .replace(/\s+/g, ' ')
              .trim();
            return clean;
          })
          .filter(msg => msg.length > 0);

        if (agentActionEvents.length > 0) {
          setTickerMessages(prev => [...agentActionEvents, ...prev].slice(0, 30));
        }
      }

      // Extract live log entries from all new records
      {
        // Filter out engine noise — keep only meaningful agent actions
        const noisePatterns = [
          /No events remaining/i,
          /Advancing to phase/i,
          /Player actions window/i,
          /Waiting for player/i,
          /Agents deliberating/i,
          /Agent negotiation phase/i,
          /Agent action execution/i,
          /Agent actions being executed/i,
          /Resolving turn outcomes/i,
          /Generating era summary/i,
          /Personality drift/i,
          /agents completed deliberation/i,
          /Players may now act/i,
          /Odds updated/i,
          /Turn resolution phase/i,
          /Alliance negotiation phase/i,
          /Agent deliberation phase/i,
          /No agent actions/i,
          /No alliance proposals/i,
          /Recalculating faction/i,
        ];

        const meaningfulEvents = allTurnEvents.filter(event =>
          !noisePatterns.some(pattern => pattern.test(event))
        );

        const newEntries: LiveLogEntry[] = meaningfulEvents.map(event => {
          // Pattern matching for event types and icons
          const patterns = [
            { match: /conquered/i, emoji: '⚔️', type: 'combat' as const },
            { match: /defended/i, emoji: '🛡️', type: 'combat' as const },
            { match: /reinforced/i, emoji: '🔰', type: 'combat' as const },
            { match: /invested/i, emoji: '💰', type: 'investment' as const },
            { match: /formed an alliance/i, emoji: '🤝', type: 'alliance' as const },
            { match: /rejected.*alliance/i, emoji: '🚫', type: 'alliance' as const },
            { match: /Event:|World event/i, emoji: '🎴', type: 'event' as const },
            { match: /earned.*IP/i, emoji: '📈', type: 'ip' as const },
            { match: /Ripple/i, emoji: '⏱️', type: 'event' as const },
          ];

          let type: LiveLogEntry['type'] = 'general';
          let emoji = '📝';

          for (const pattern of patterns) {
            if (pattern.match.test(event)) {
              emoji = pattern.emoji;
              type = pattern.type;
              break;
            }
          }

          // Clean up message text
          let message = event.replace(/^[📝🤝⚔️🎴📈💰🛡️🔰🚫⏱️]\s*/, '');

          // Replace faction_1, faction_2, etc. with actual faction names
          Object.entries(next.factions).forEach(([factionId, faction]) => {
            message = message.replace(new RegExp(factionId, 'g'), faction.name);
          });

          // Remove archetype instance numbers (e.g., "diplomat 1" -> "Diplomat")
          message = message.replace(/\b(diplomat|conqueror|merchant|scholar|general)\s+\d+\b/gi, (match) => {
            return match.split(' ')[0].charAt(0).toUpperCase() + match.split(' ')[0].slice(1).toLowerCase();
          });

          return {
            turn: turnMeta?.turn ?? next.currentTurn,
            era: turnMeta?.era ?? next.currentEra,
            type,
            message,
            emoji
          };
        });

        // Newest first — prepend new entries
        setLiveLog(prev => [...newEntries, ...prev].slice(0, 100));
      }
    } catch (err) {
      console.error('[Fork] Turn failed:', err);
      setError(String(err));
      setIsRunning(false);
      return;
    }
    if (isRunningRef.current && !isPausedRef.current) {
      turnTimerRef.current = setTimeout(runLoop, turnSpeedRef.current);
    }
  }, []); // empty deps — uses refs only

  // Start loop when isRunning becomes true
  useEffect(() => {
    if (isRunning && !isPaused) {
      if (turnTimerRef.current) clearTimeout(turnTimerRef.current);
      turnTimerRef.current = setTimeout(runLoop, turnSpeedRef.current);
    }
    return () => {
      if (turnTimerRef.current) clearTimeout(turnTimerRef.current);
    };
  }, [isRunning, isPaused, turnSpeed, runLoop]);

  const placeBet = useCallback(
    (bet: Omit<BetAction, "type" | "placedOnTurn" | "odds">) => {
      if (!gameState) return;

      setGameState((prev) => {
        if (!prev) return prev;

        const playerState = prev.playerStates[bet.playerId];
        if (!playerState) return prev;

        // Get current odds for this bet type and target
        const currentOdds = prev.oddsHistory[prev.oddsHistory.length - 1]?.odds[bet.betType]?.[bet.targetId] ?? 1.0;

        // Create the complete bet action
        const completeBet: BetAction = {
          type: "bet",
          ...bet,
          odds: currentOdds,
          placedOnTurn: prev.currentTurn,
        };

        // Deduct stake from player's influence points
        const updatedPlayerState: PlayerState = {
          ...playerState,
          influencePoints: Math.max(0, (isNaN(playerState.influencePoints) ? 100 : playerState.influencePoints) - (bet.stake || 0)),
          bets: [...playerState.bets, completeBet],
          actionsThisTurn: [...playerState.actionsThisTurn, completeBet],
        };

        return {
          ...prev,
          playerStates: {
            ...prev.playerStates,
            [bet.playerId]: updatedPlayerState,
          },
        };
      });
    },
    [gameState]
  );

  const [activeEventBanner, setActiveEventBanner] = useState<{ title: string; description: string } | null>(null);

  const playEventCard = useCallback(() => {
    const current = gameStateRef.current;
    if (!current) return;

    const playerId = "player_1";
    const playerState = current.playerStates[playerId];
    if (!playerState?.currentDrawnCard) return;

    const card = playerState.currentDrawnCard;

    // Use the engine's playEventCard which handles:
    // IP deduction, effect application, ripple queuing, discard, analytics
    const result = enginePlayEventCard(playerId, current);

    if (!result.success) {
      setError(result.error ?? 'Failed to play event card');
      return;
    }

    console.log('[Fork] Played event card:', card.title,
      'Effects:', card.effects.length,
      'Results:', result.results);

    // Engine mutates state directly, so spread to trigger React update
    const newState = { ...current };
    gameStateRef.current = newState;
    setGameState(newState);

    // Add to live log
    setLiveLog(prev => [{
      turn: current.currentTurn,
      era: current.currentEra,
      type: 'event' as const,
      emoji: '🎴',
      message: `You played: ${card.title} (Tier ${card.tier}, -${card.ipCost} IP)`,
    }, ...prev]);

    // Show event banner for 4 seconds
    setActiveEventBanner({ title: card.title, description: card.description });
    setTimeout(() => setActiveEventBanner(null), 4000);
  }, []);

  const [eventImpact, setEventImpact] = useState<{
    title: string;
    lines: string[];
    tier: number;
  } | null>(null);

  const playEventCardWithImpact = useCallback(() => {
    const before = gameStateRef.current;
    if (!before) return;

    const card = before.playerStates['player_1']?.currentDrawnCard;
    if (!card) return;

    // Snapshot territory strengths + control before playing
    const beforeStrengths: Record<string, number> = {};
    const beforeControl: Record<string, string | null> = {};
    Object.entries(before.territories).forEach(([id, t]) => {
      beforeStrengths[id] = t.strength;
      beforeControl[id] = t.controlledBy;
    });

    // Play the card (mutates state)
    playEventCard();

    const after = gameStateRef.current;
    if (!after) return;

    // Calculate what changed
    const impactLines: string[] = [];

    Object.entries(after.territories).forEach(([id, territory]) => {
      const strengthDelta = territory.strength - (beforeStrengths[id] ?? territory.strength);
      if (Math.abs(strengthDelta) >= 5) {
        const sign = strengthDelta > 0 ? '+' : '';
        impactLines.push(`${territory.name}: strength ${sign}${Math.round(strengthDelta)}`);
      }
      if (territory.controlledBy !== beforeControl[id]) {
        const newFaction = territory.controlledBy
          ? after.factions[territory.controlledBy]?.name
          : 'Neutral';
        impactLines.push(`${territory.name} → ${newFaction}`);
      }
    });

    if (impactLines.length > 0) {
      setEventImpact({
        title: card.title,
        lines: impactLines.slice(0, 6),
        tier: card.tier ?? 1,
      });
      setTimeout(() => setEventImpact(null), 5000);
    }
  }, [playEventCard]);

  const patronBacking = useCallback(
    (action: Omit<PatronAction, "type">) => {
      setGameState((prev) => {
        if (!prev) return prev;

        const playerState = prev.playerStates[action.playerId];
        if (!playerState) return prev;

        const completeAction: PatronAction = {
          type: "patron_backing",
          ...action,
        };

        // Deduct investment and add patron commitment
        const updatedPlayerState: PlayerState = {
          ...playerState,
          influencePoints: Math.max(0, (isNaN(playerState.influencePoints) ? 100 : playerState.influencePoints) - (action.investmentAmount || 0)),
          patronCommitments: [...playerState.patronCommitments, completeAction],
          actionsThisTurn: [...playerState.actionsThisTurn, completeAction],
        };

        // Add investment to faction's patronBacking
        const faction = prev.factions[action.targetFactionId];
        if (!faction) return prev;

        const updatedFaction = {
          ...faction,
          patronBacking: faction.patronBacking + action.investmentAmount,
        };

        return {
          ...prev,
          factions: {
            ...prev.factions,
            [action.targetFactionId]: updatedFaction,
          },
          playerStates: {
            ...prev.playerStates,
            [action.playerId]: updatedPlayerState,
          },
        };
      });
    },
    []
  );

  return {
    gameState,
    playerState: gameState?.playerStates["player_1"] ?? null,
    isRunning,
    isPaused,
    gameEnded,
    turnSpeed,
    error,
    liveLog,
    startGame,
    stopGame,
    newGame,
    pauseGame,
    resumeGame,
    setTurnSpeed,
    directiveCountdown,
    showDirective,
    tickerMessages,
    submitDirective,
    activeEventBanner,
    eventImpact,
    placeBet,
    playEventCard,
    playEventCardWithImpact,
    patronBacking,
  };
}
