/**
 * React hook for running the Fork Chronicle game engine
 */

import { useState, useCallback, useEffect, useRef } from "react";
import { initializeGame } from "../src/engine/setup";
import { executeTurn } from "../src/engine/turn-loop";
import { playEventCard as enginePlayEventCard } from "../src/engine/events";
import type { GameState, GameConfig } from "../src/types/game-state";
import type { PlayerState, BetAction, EventInjectionAction, PatronAction } from "../src/types/player";
import { fetchWikipediaEventsForToday, wikiEventToGameEvent } from "../src/utils/wikipedia-events";

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
  tickerMessages: string[];
  submitDirective: (directive: string) => void;
  activeEventBanner: { title: string; description: string } | null;
  placeBet: (bet: Omit<BetAction, "type" | "placedOnTurn" | "odds">) => void;
  playEventCard: () => void;
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
  const [tickerMessages, setTickerMessages] = useState<string[]>([]);
  const turnTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const directiveTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastEraRef = useRef(0);

  // Draw a Wikipedia event card for the player
  const drawPlayerEventCard = useCallback(async (state: GameState): Promise<GameState> => {
    const playerId = "player_1";
    const playerState = state.playerStates[playerId];
    if (!playerState) return state;

    try {
      console.log('[Fork] Fetching Wikipedia events for today...');
      const wikiEvents = await fetchWikipediaEventsForToday();
      console.log('[Fork] Wikipedia returned', wikiEvents?.length ?? 0, 'events');
      if (wikiEvents && wikiEvents.length > 0) {
        const randomIndex = Math.floor(Math.random() * Math.min(wikiEvents.length, 20));
        const picked = wikiEvents[randomIndex];
        const tier: 1 | 2 | 3 = Math.random() < 0.15 ? 3 : Math.random() < 0.45 ? 2 : 1;
        const gameEvent = wikiEventToGameEvent(picked, tier);
        console.log('[Fork] Wikipedia event drawn:', gameEvent.title);
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
    let state = await initializeGame(config);
    // Draw initial Wikipedia event card for the player
    state = await drawPlayerEventCard(state);
    setGameState(state);
    setIsRunning(true);
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
    // Reset all state
    setGameState(null);
    setIsRunning(false);
    setIsPaused(false);
    setGameEnded(false);
    setLiveLog([]);
    setError(null);
    setDirectiveCountdown(0);
    setTickerMessages([]);
    setActiveEventBanner(null);
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
    setDirectiveCountdown(0);
    setIsPaused(false);
  }, []);

  const setTurnSpeed = useCallback((ms: number) => {
    setTurnSpeedState(ms);
  }, []);

  // Refs to avoid stale closures
  const isRunningRef = useRef(false);
  const isPausedRef = useRef(false);
  const gameStateRef = useRef<GameState | null>(null);
  const turnSpeedRef = useRef(3000);

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
      let next = await executeTurn(current);

      // Draw a new Wikipedia card if the player has none
      const player = next.playerStates["player_1"];
      if (player && !player.currentDrawnCard) {
        next = await drawPlayerEventCard(next);
      }

      gameStateRef.current = next;
      setGameState(next);

      // Detect new era — auto-pause for directive input
      if (next.currentEra > lastEraRef.current && lastEraRef.current > 0) {
        isPausedRef.current = true;
        setIsPaused(true);
        setDirectiveCountdown(15);
        if (directiveTimerRef.current) clearInterval(directiveTimerRef.current);
        directiveTimerRef.current = setInterval(() => {
          setDirectiveCountdown(prev => {
            if (prev <= 1) {
              if (directiveTimerRef.current) clearInterval(directiveTimerRef.current);
              directiveTimerRef.current = null;
              isPausedRef.current = false;
              setIsPaused(false);
              return 0;
            }
            return prev - 1;
          });
        }, 1000);
      }
      lastEraRef.current = next.currentEra;

      // Extract ticker messages from combat/conquest/alliance events
      if (next.history.length > 0) {
        const latestRecord = next.history[next.history.length - 1];
        const combatEvents = latestRecord.events
          .filter(msg =>
            msg.includes('conquered') ||
            msg.includes('defended') ||
            msg.includes('formed an alliance') ||
            msg.includes('Event:')
          )
          .map(msg => {
            let clean = msg;
            Object.entries(next.factions).forEach(([id, f]) => {
              clean = clean.replaceAll(id, f.name);
            });
            clean = clean
              .replace(/diplomat \d+/gi, '')
              .replace(/conqueror \d+/gi, '')
              .replace(/economist \d+/gi, '')
              .replace(/historian \d+/gi, '')
              .trim();
            return clean;
          });

        if (combatEvents.length > 0) {
          setTickerMessages(prev => [...combatEvents, ...prev].slice(0, 20));
        }
      }

      // Extract new log entries from the latest turn record
      if (next.history.length > 0) {
        const latestRecord = next.history[next.history.length - 1];

        // Filter out engine noise — keep only meaningful agent actions
        const noisePatterns = [
          /No events remaining/i,
          /Advancing to phase/i,
          /Player actions window/i,
          /Waiting for player/i,
          /Agents deliberating/i,
          /Agent negotiation phase/i,
          /Agent action execution/i,
          /Resolving turn outcomes/i,
          /Generating era summary/i,
          /Personality drift/i,
          /agents completed deliberation/i,
          /Players may now act/i,
          /Odds updated/i,
        ];

        const meaningfulEvents = latestRecord.events.filter(event =>
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
            turn: latestRecord.turn,
            era: latestRecord.era,
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
  }, [isRunning, isPaused, runLoop]);

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
          influencePoints: playerState.influencePoints - bet.stake,
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
          influencePoints: playerState.influencePoints - action.investmentAmount,
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
    tickerMessages,
    submitDirective,
    activeEventBanner,
    placeBet,
    playEventCard,
    patronBacking,
  };
}
