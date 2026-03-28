/**
 * ForkGamePage - Main Fork Chronicle UI component
 */

import React, { useMemo, useState } from "react";
import type { MercatorParamsV1 } from "../../../utils/mercator";
import { latLonToPixel } from "../../../utils/mercator";
import type { GameState, GameConfig } from "../src/types/game-state";
import type { PlayerState, PatronAction, BetType } from "../src/types/player";
import territoryCoords from "../data/territory-coords.json";

export interface ForkGamePageProps {
  mapParams: MercatorParamsV1 | null;
  mapSvgInner: string;
  mapRootAttrs: Record<string, string>;
  mapViewBox: string;
  gameState: GameState | null;
  isRunning: boolean;
  turnSpeed: number;
  playerState: PlayerState | null;
  onStartGame: (config: GameConfig) => void;
  onStopGame: () => void;
  onSetTurnSpeed: (ms: number) => void;
  onPlaceBet: (bet: Omit<import("../src/types/player").BetAction, "type" | "placedOnTurn" | "odds">) => void;
  onPlayEventCard: () => void;
  onPatronBacking: (action: Omit<PatronAction, "type">) => void;
}

export default function ForkGamePage(props: ForkGamePageProps) {
  const {
    mapParams,
    mapSvgInner,
    mapRootAttrs,
    mapViewBox,
    gameState,
    isRunning,
    playerState,
    onStartGame,
    onStopGame,
    onPlayEventCard,
  } = props;

  const [selectedEpochId, setSelectedEpochId] = useState<string>("1914_brink");
  const [factionCount, setFactionCount] = useState<2 | 3 | 4>(4);
  const [hoveredTerritory, setHoveredTerritory] = useState<{
    name: string;
    faction: string;
    strength: number;
    x: number;
    y: number;
  } | null>(null);

  // Project territory coordinates to SVG pixels
  const projectedTerritories = useMemo(() => {
    if (!mapParams || !gameState) return [];

    return Object.values(gameState.territories).map((territory) => {
      const coords = territoryCoords[territory.id as keyof typeof territoryCoords];
      if (!coords) return null;

      const projected = latLonToPixel(coords.lat, coords.lon, mapParams);
      return {
        territory,
        x: projected.x,
        y: projected.y,
      };
    }).filter((t): t is NonNullable<typeof t> => t !== null);
  }, [mapParams, gameState]);

  // Handle game start
  const handleStartGame = () => {
    const config: GameConfig = {
      epochId: selectedEpochId,
      factionCount,
      players: [
        {
          playerId: "player_1",
          displayName: "Player",
          startingInfluencePoints: 100,
        },
      ],
      eventPackIds: ["base"],
    };
    onStartGame(config);
  };

  return (
    <div className="fork-page">
      {/* LEFT PANEL */}
      <div className="fork-left-panel">
        {/* Game Controls */}
        {!gameState ? (
          <div>
            <h3 style={{ marginTop: 0, marginBottom: 12, fontSize: 14 }}>Start New Game</h3>

            <label style={{ display: "block", marginBottom: 8, fontSize: 12 }}>
              Epoch
              <select
                value={selectedEpochId}
                onChange={(e) => setSelectedEpochId(e.target.value)}
                style={{ width: "100%", marginTop: 4, padding: 6 }}
              >
                <option value="1914_brink">1914 — The World at the Brink</option>
                <option value="1945_aftermath">1945 — The World Remade</option>
                <option value="1991_unipolar">1991 — The Unipolar Moment</option>
              </select>
            </label>

            <label style={{ display: "block", marginBottom: 12, fontSize: 12 }}>
              Faction Count
              <div style={{ display: "flex", gap: 4, marginTop: 4 }}>
                {[2, 3, 4].map((count) => (
                  <button
                    key={count}
                    onClick={() => setFactionCount(count as 2 | 3 | 4)}
                    style={{
                      flex: 1,
                      padding: "6px 12px",
                      background: factionCount === count ? "#4ECDC4" : "#2c2c2c",
                      border: "1px solid #444",
                      color: "white",
                      cursor: "pointer",
                    }}
                  >
                    {count}
                  </button>
                ))}
              </div>
            </label>

            <button
              onClick={handleStartGame}
              style={{
                width: "100%",
                padding: "8px 16px",
                background: "#4ECDC4",
                border: "none",
                color: "white",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Start Game
            </button>
          </div>
        ) : (
          <div>
            <h3 style={{ marginTop: 0, marginBottom: 12, fontSize: 14 }}>
              Turn {gameState.currentTurn} · Era {gameState.currentEra}
            </h3>

            <div style={{ marginBottom: 16 }}>
              <h4 style={{ fontSize: 12, marginBottom: 8 }}>Faction Standings</h4>
              {Object.values(gameState.factions).map((faction) => (
                <div key={faction.id} className="fork-faction-row">
                  <div
                    className="fork-faction-dot"
                    style={{ background: faction.color }}
                  />
                  <span style={{ fontSize: 13, flex: 1 }}>{faction.name}</span>
                  <span style={{ fontSize: 12, color: "#999" }}>
                    {faction.territories.length}
                  </span>
                </div>
              ))}
            </div>

            <button
              onClick={onStopGame}
              style={{
                width: "100%",
                padding: "8px 16px",
                background: "#dc3545",
                border: "none",
                color: "white",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Stop Game
            </button>

            {/* Player Actions */}
            {playerState && (
              <div style={{ marginTop: 16, paddingTop: 16, borderTop: "1px solid #444" }}>
                <div className="fork-ip-display">
                  Influence: {playerState.influencePoints} IP
                </div>

                <div style={{ marginTop: 12 }}>
                  <h4 style={{ fontSize: 12, marginBottom: 8 }}>Event Card</h4>
                  {playerState.currentDrawnCard ? (
                    <div>
                      <div className="fork-card-hidden">
                        <div className={`fork-tier-badge fork-tier-${playerState.currentDrawnCard.tier}`}>
                          Tier {playerState.currentDrawnCard.tier}
                        </div>
                        <div style={{ marginTop: 8, fontSize: 13 }}>
                          ???
                        </div>
                      </div>
                      <button
                        onClick={onPlayEventCard}
                        disabled={playerState.influencePoints < playerState.currentDrawnCard.tier * 20}
                        style={{
                          width: "100%",
                          marginTop: 8,
                          padding: "6px 12px",
                          background: playerState.influencePoints >= playerState.currentDrawnCard.tier * 20 ? "#4ECDC4" : "#555",
                          border: "none",
                          color: "white",
                          cursor: playerState.influencePoints >= playerState.currentDrawnCard.tier * 20 ? "pointer" : "not-allowed",
                          fontSize: 12,
                        }}
                      >
                        Reveal & Play ({playerState.currentDrawnCard.tier * 20} IP)
                      </button>
                    </div>
                  ) : (
                    <div style={{ fontSize: 12, color: "#999" }}>No card drawn yet</div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* CENTER PANEL - Map */}
      <div className="fork-map-panel">
        <svg
          viewBox={mapViewBox}
          preserveAspectRatio="xMidYMid meet"
          style={{ width: "100%", height: "100%" }}
          {...mapRootAttrs}
        >
          <g dangerouslySetInnerHTML={{ __html: mapSvgInner }} />

          {/* Fork Overlay - Territory Markers */}
          {projectedTerritories.map(({ territory, x, y }) => {
            const faction = territory.controlledBy
              ? gameState?.factions[territory.controlledBy]
              : null;
            const isContested = !!territory.contestedBy;

            return (
              <g key={territory.id}>
                {/* Territory Circle */}
                <circle
                  cx={x}
                  cy={y}
                  r={isContested ? 11 : 8}
                  fill={faction ? faction.color : "#888888"}
                  stroke="white"
                  strokeWidth={1.5}
                  opacity={0.75}
                  onMouseEnter={() =>
                    setHoveredTerritory({
                      name: territory.name,
                      faction: faction?.name || "Neutral",
                      strength: territory.strength,
                      x,
                      y,
                    })
                  }
                  onMouseLeave={() => setHoveredTerritory(null)}
                  style={{ cursor: "pointer" }}
                >
                  {isContested && (
                    <animate
                      attributeName="opacity"
                      values="0.75;0.3;0.75"
                      dur="1.5s"
                      repeatCount="indefinite"
                    />
                  )}
                </circle>

                {/* Strength Label */}
                <text
                  x={x}
                  y={y + 18}
                  fontSize={9}
                  fill="white"
                  textAnchor="middle"
                  pointerEvents="none"
                >
                  {territory.strength}
                </text>
              </g>
            );
          })}

          {/* Tooltip */}
          {hoveredTerritory && (
            <g>
              <rect
                x={hoveredTerritory.x + 15}
                y={hoveredTerritory.y - 25}
                width={120}
                height={50}
                fill="rgba(0, 0, 0, 0.9)"
                stroke="white"
                strokeWidth={1}
                rx={4}
              />
              <text
                x={hoveredTerritory.x + 20}
                y={hoveredTerritory.y - 10}
                fontSize={11}
                fill="white"
                fontWeight="bold"
              >
                {hoveredTerritory.name}
              </text>
              <text
                x={hoveredTerritory.x + 20}
                y={hoveredTerritory.y + 2}
                fontSize={10}
                fill="#aaa"
              >
                {hoveredTerritory.faction}
              </text>
              <text
                x={hoveredTerritory.x + 20}
                y={hoveredTerritory.y + 14}
                fontSize={10}
                fill="#4ECDC4"
              >
                Strength: {hoveredTerritory.strength}
              </text>
            </g>
          )}
        </svg>
      </div>

      {/* RIGHT PANEL - Era Summary & Chronicle */}
      <div className="fork-right-panel">
        {gameState && gameState.eraCards.length > 0 ? (
          <>
            {/* Current Era Card */}
            <div className="fork-era-card">
              <div style={{ fontSize: 11, fontWeight: 600, color: "#999", marginBottom: 8 }}>
                ERA {gameState.eraCards[gameState.eraCards.length - 1].era}
              </div>

              <div style={{ fontSize: 12, marginBottom: 4 }}>
                <strong>Leader:</strong> {gameState.factions[gameState.eraCards[gameState.eraCards.length - 1].leaderFaction]?.name}
                {" "}({gameState.factions[gameState.eraCards[gameState.eraCards.length - 1].leaderFaction]?.territories.length})
              </div>

              <div style={{ fontSize: 11, color: "#999", marginBottom: 8 }}>
                Alliances: {gameState.eraCards[gameState.eraCards.length - 1].alliancesFormed} formed,
                {" "}{gameState.eraCards[gameState.eraCards.length - 1].alliancesBroken} broken
              </div>

              <div className="fork-narrative">
                {gameState.eraCards[gameState.eraCards.length - 1].narrativeSummary}
              </div>
            </div>

            {/* Chronicle Feed */}
            <div style={{ marginTop: 16 }}>
              <h4 style={{ fontSize: 12, marginBottom: 12 }}>Chronicle</h4>
              {gameState.eraCards.slice().reverse().map((card, idx) => (
                <div key={idx} className="fork-chronicle-entry">
                  <div className="fork-chronicle-era-label">Era {card.era}</div>
                  <div style={{ fontSize: 12, lineHeight: 1.5, color: "#ccc" }}>
                    {card.narrativeSummary}
                  </div>
                </div>
              ))}
            </div>

            <button
              onClick={() => {
                const fullNarrative = gameState.eraCards
                  .map((card) => `Era ${card.era}:\n\n${card.narrativeSummary}`)
                  .join("\n\n");
                navigator.clipboard.writeText(fullNarrative);
              }}
              style={{
                width: "100%",
                marginTop: 12,
                padding: "6px 12px",
                background: "#2c2c2c",
                border: "1px solid #444",
                color: "white",
                cursor: "pointer",
                fontSize: 11,
              }}
            >
              Export Chronicle
            </button>
          </>
        ) : (
          <div style={{ fontSize: 12, color: "#999", textAlign: "center", padding: 16 }}>
            {gameState ? "No era summaries yet" : "Start a game to see chronicles"}
          </div>
        )}

        {/* Game Over */}
        {gameState?.winner && (
          <div className="fork-game-over">
            <div className="fork-winner-name">
              {gameState.factions[gameState.winner]?.name} Wins!
            </div>
            <div style={{ fontSize: 13, color: "#999" }}>
              {gameState.factions[gameState.winner]?.territories.length} territories controlled
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
