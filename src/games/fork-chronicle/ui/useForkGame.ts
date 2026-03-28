/**
 * React hook for running the Fork Chronicle game engine
 */

import { useState, useCallback, useEffect, useRef } from "react";
import { initializeGame } from "../src/engine/setup";
import { executeTurn } from "../src/engine/turn-loop";
import type { GameState, GameConfig } from "../src/types/game-state";
import type { PlayerState, BetAction, EventInjectionAction, PatronAction } from "../src/types/player";

export interface UseForkGameReturn {
  gameState: GameState | null;
  playerState: PlayerState | null;
  isRunning: boolean;
  turnSpeed: number;
  startGame: (config: GameConfig) => void;
  stopGame: () => void;
  setTurnSpeed: (ms: number) => void;
  placeBet: (bet: Omit<BetAction, "type" | "placedOnTurn" | "odds">) => void;
  playEventCard: () => void;
  patronBacking: (action: Omit<PatronAction, "type">) => void;
}

export function useForkGame(): UseForkGameReturn {
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [turnSpeed, setTurnSpeedState] = useState(1500);
  const turnTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const startGame = useCallback((config: GameConfig) => {
    const state = initializeGame(config);
    setGameState(state);
    setIsRunning(true);
  }, []);

  const stopGame = useCallback(() => {
    setIsRunning(false);
    if (turnTimerRef.current) {
      clearTimeout(turnTimerRef.current);
      turnTimerRef.current = null;
    }
  }, []);

  const setTurnSpeed = useCallback((ms: number) => {
    setTurnSpeedState(ms);
  }, []);

  // Auto-advance turns when running
  useEffect(() => {
    if (!isRunning || !gameState || gameState.phase === "game_over") {
      if (gameState?.phase === "game_over") {
        setIsRunning(false);
      }
      return;
    }

    turnTimerRef.current = setTimeout(async () => {
      const nextState = await executeTurn(gameState);
      setGameState(nextState);
    }, turnSpeed);

    return () => {
      if (turnTimerRef.current) {
        clearTimeout(turnTimerRef.current);
        turnTimerRef.current = null;
      }
    };
  }, [isRunning, gameState, turnSpeed]);

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

  const playEventCard = useCallback(() => {
    setGameState((prev) => {
      if (!prev) return prev;

      // Assume single player with id "player_1"
      const playerId = "player_1";
      const playerState = prev.playerStates[playerId];
      if (!playerState || !playerState.currentDrawnCard) return prev;

      const event = playerState.currentDrawnCard;
      const cost = event.tier * 20; // Tier 1=20, Tier 2=40, Tier 3=60

      // Deduct cost and inject event
      const action: EventInjectionAction = {
        type: "event_injection",
        playerId,
        eventId: event.id,
        injectedOnTurn: prev.currentTurn,
        cost,
      };

      const updatedPlayerState: PlayerState = {
        ...playerState,
        influencePoints: playerState.influencePoints - cost,
        currentDrawnCard: null,
        actionsThisTurn: [...playerState.actionsThisTurn, action],
      };

      // Add event to active events
      return {
        ...prev,
        activeEvents: [
          ...prev.activeEvents,
          {
            event,
            activatedOnTurn: prev.currentTurn,
            expiresOnTurn: null, // Events don't expire in this implementation
          },
        ],
        playerStates: {
          ...prev.playerStates,
          [playerId]: updatedPlayerState,
        },
      };
    });
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
    turnSpeed,
    startGame,
    stopGame,
    setTurnSpeed,
    placeBet,
    playEventCard,
    patronBacking,
  };
}
