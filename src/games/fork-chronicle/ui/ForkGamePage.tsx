/**
 * ForkGamePage - Main Fork Chronicle UI component
 */

import React, { useMemo, useState, useEffect, useCallback } from "react";
import type { MercatorParamsV1 } from "../../../utils/mercator";
import { latLonToPixel } from "../../../utils/mercator";
import type { GameState, GameConfig } from "../src/types/game-state";
import type { PlayerState, PatronAction, BetType } from "../src/types/player";
import type { LiveLogEntry } from "./useForkGame";
import type { Epoch } from "../src/types/epoch";
import { loadEpoch } from "../src/utils/data-loader";
import territoryCoords from "../data/territory-coords.json";

const COUNTRY_FLAGS: Record<string, string> = {
  USA: '🇺🇸', GBR: '🇬🇧', FRA: '🇫🇷', DEU: '🇩🇪', RUS: '🇷🇺',
  CHN: '🇨🇳', JPN: '🇯🇵', IND: '🇮🇳', BRA: '🇧🇷', ARG: '🇦🇷',
  EGY: '🇪🇬', NGA: '🇳🇬', ZAF: '🇿🇦', AUS: '🇦🇺', SAU: '🇸🇦',
  TUR: '🇹🇷', IRN: '🇮🇷', PAK: '🇵🇰', MEX: '🇲🇽', CAN: '🇨🇦',
  KAZ: '🇰🇿', MNG: '🇲🇳', VNM: '🇻🇳', THA: '🇹🇭', POL: '🇵🇱',
  ITA: '🇮🇹', ESP: '🇪🇸', COL: '🇨🇴', PER: '🇵🇪', MAR: '🇲🇦',
  ETH: '🇪🇹', COD: '🇨🇩', IRQ: '🇮🇶', CUB: '🇨🇺', PNG: '🇵🇬',
  NZL: '🇳🇿', FJI: '🇫🇯', GTM: '🇬🇹', HTI: '🇭🇹', PAN: '🇵🇦',
  DOM: '🇩🇴', NLD: '🇳🇱',
};

const COUNTRY_NAMES: Record<string, string> = {
  USA: 'United States', GBR: 'United Kingdom', FRA: 'France', DEU: 'Germany',
  RUS: 'Russia', CHN: 'China', JPN: 'Japan', IND: 'India', BRA: 'Brazil',
  ARG: 'Argentina', EGY: 'Egypt', NGA: 'Nigeria', ZAF: 'South Africa',
  AUS: 'Australia', SAU: 'Saudi Arabia', TUR: 'Turkey', IRN: 'Iran',
  PAK: 'Pakistan', MEX: 'Mexico', CAN: 'Canada', KAZ: 'Kazakhstan',
  MNG: 'Mongolia', VNM: 'Vietnam', THA: 'Thailand', POL: 'Poland',
  ITA: 'Italy', ESP: 'Spain', COL: 'Colombia', PER: 'Peru', MAR: 'Morocco',
  ETH: 'Ethiopia', COD: 'DR Congo', IRQ: 'Iraq', CUB: 'Cuba', PNG: 'Papua New Guinea',
  NZL: 'New Zealand', FJI: 'Fiji', GTM: 'Guatemala', HTI: 'Haiti', PAN: 'Panama',
  DOM: 'Dominican Republic', NLD: 'Netherlands',
};

const COUNTRY_CONTINENTS: Record<string, string> = {
  USA: 'Americas', GBR: 'Europe', FRA: 'Europe', DEU: 'Europe', RUS: 'Europe/Asia',
  CHN: 'Asia', JPN: 'Asia', IND: 'Asia', BRA: 'Americas', ARG: 'Americas',
  EGY: 'Africa', NGA: 'Africa', ZAF: 'Africa', AUS: 'Oceania', SAU: 'Middle East',
  TUR: 'Middle East', IRN: 'Middle East', PAK: 'Asia', MEX: 'Americas', CAN: 'Americas',
  KAZ: 'Asia', MNG: 'Asia', VNM: 'Asia', THA: 'Asia', POL: 'Europe',
  ITA: 'Europe', ESP: 'Europe', COL: 'Americas', PER: 'Americas', MAR: 'Africa',
  ETH: 'Africa', COD: 'Africa', IRQ: 'Middle East', CUB: 'Americas', PNG: 'Oceania',
  NZL: 'Oceania', FJI: 'Oceania', GTM: 'Americas', HTI: 'Americas', PAN: 'Americas',
  DOM: 'Americas', NLD: 'Europe',
};

export interface ForkGamePageProps {
  mapParams: MercatorParamsV1 | null;
  mapSvgInner: string;
  mapRootAttrs: Record<string, string>;
  mapViewBox: string;
  gameState: GameState | null;
  isRunning: boolean;
  isPaused: boolean;
  gameEnded: boolean;
  turnSpeed: number;
  playerState: PlayerState | null;
  error: string | null;
  liveLog: LiveLogEntry[];
  onStartGame: (config: GameConfig) => Promise<void>;
  onStopGame: () => void;
  onNewGame: () => void;
  onPauseGame: () => void;
  onResumeGame: () => void;
  onSetTurnSpeed: (ms: number) => void;
  directiveCountdown: number;
  showDirective: boolean;
  tickerMessages: string[];
  activeEventBanner: { title: string; description: string } | null;
  eventImpact: { title: string; lines: string[]; tier: number } | null;
  onSubmitDirective: (directive: string) => void;
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
    isPaused,
    gameEnded,
    turnSpeed,
    playerState,
    error,
    liveLog,
    onStartGame,
    onStopGame,
    onNewGame,
    onPauseGame,
    onResumeGame,
    onSetTurnSpeed,
    onPlayEventCard,
    directiveCountdown,
    showDirective,
    tickerMessages,
    activeEventBanner,
    eventImpact,
    onSubmitDirective,
  } = props;

  const [selectedEpochId, setSelectedEpochId] = useState<string | null>(null);
  const [selectedFactionId, setSelectedFactionId] = useState<string | null>(null);
  const [selectedCountryId, setSelectedCountryId] = useState<string | null>(null);
  const [factionCount, setFactionCount] = useState<2 | 3 | 4>(4);
  const [directive, setDirective] = useState<string>("");
  const [exportConfirmed, setExportConfirmed] = useState(false);
  const [showingReveal, setShowingReveal] = useState(false);
  const [cardRevealed, setCardRevealed] = useState(false);
  const [hoveredTerritory, setHoveredTerritory] = useState<{
    name: string;
    faction: string;
    strength: number;
    x: number;
    y: number;
  } | null>(null);

  // Available epochs for setup screen
  const availableEpochs = useMemo(() => [
    {
      id: "1914_brink",
      name: "1914 — The World at the Brink",
      year: 1914,
      description: "The great powers stand on the edge of total war. Ancient empires and rising nations compete for dominance as the old order teeters on the brink of catastrophic change.",
    },
    {
      id: "1945_aftermath",
      name: "1945 — The World Remade",
      year: 1945,
      description: "The guns have fallen silent, but the world has been transformed. New superpowers emerge from the ashes of total war, while colonial empires crumble and the map is redrawn.",
    },
    {
      id: "1991_unipolar",
      name: "1991 — The Unipolar Moment",
      year: 1991,
      description: "The Cold War ends not with fire but with a whimper. America stands alone as the sole superpower, but new powers are rising and the old certainties are crumbling.",
    },
  ], []);

  // Load selected epoch data
  const selectedEpochData = useMemo(() => {
    if (!selectedEpochId) return null;
    try {
      return loadEpoch(selectedEpochId);
    } catch (err) {
      console.error("Failed to load epoch:", err);
      return null;
    }
  }, [selectedEpochId]);

  // Available factions for selected epoch
  const availableFactions = useMemo(() => {
    if (!selectedEpochData) return [];

    const factionColors = ["#3b82f6", "#ef4444", "#10b981", "#f59e0b"];

    return Object.entries(selectedEpochData.factionNames).map(([id, name], index) => {
      const territories = Object.entries(selectedEpochData.startingTerritoryControl)
        .filter(([_, fid]) => fid === id)
        .map(([tid]) => tid);

      return {
        id,
        name,
        color: factionColors[index] || "#888888",
        startingTerritories: territories.length,
      };
    });
  }, [selectedEpochData]);

  // Available countries for selected epoch (derived from territory control)
  const availableCountries = useMemo(() => {
    if (!selectedEpochData) return [];
    return Object.keys(selectedEpochData.startingTerritoryControl)
      .map(id => ({
        id,
        name: COUNTRY_NAMES[id] || id,
        flag: COUNTRY_FLAGS[id] || '',
        continent: COUNTRY_CONTINENTS[id] || '',
        factionId: selectedEpochData.startingTerritoryControl[id],
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [selectedEpochData]);

  // Derived faction from selected country
  const selectedCountryFaction = useMemo(() => {
    if (!selectedCountryId || !selectedEpochData) return null;
    const factionId = selectedEpochData.startingTerritoryControl[selectedCountryId];
    if (!factionId) return null;
    const factionColors = ["#3b82f6", "#ef4444", "#10b981", "#f59e0b"];
    const factionIds = Object.keys(selectedEpochData.factionNames || {});
    const index = factionIds.indexOf(factionId);
    return {
      id: factionId,
      name: (selectedEpochData.factionNames as Record<string, string>)?.[factionId] ?? factionId,
      color: factionColors[index] ?? '#888888',
    };
  }, [selectedCountryId, selectedEpochData]);

  // Convert territory bounding box to SVG rectangle coordinates
  const territoryBoxToSvgRect = useCallback(
    (box: { latN: number; latS: number; lonW: number; lonE: number }) => {
      if (!mapParams) return null;
      const topLeft = latLonToPixel(box.latN, box.lonW, mapParams);
      const bottomRight = latLonToPixel(box.latS, box.lonE, mapParams);
      return {
        x: topLeft.x,
        y: topLeft.y,
        width: Math.abs(bottomRight.x - topLeft.x),
        height: Math.abs(bottomRight.y - topLeft.y),
      };
    },
    [mapParams]
  );

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

  // Handle game start — derive faction from country, show reveal
  const handleStartGame = async () => {
    if (!selectedEpochId || !selectedCountryId || !selectedCountryFaction) return;

    // Set the faction from the country's allegiance
    setSelectedFactionId(selectedCountryFaction.id);

    // Show faction reveal animation
    setShowingReveal(true);
    await new Promise(resolve => setTimeout(resolve, 2500));
    setShowingReveal(false);

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
    await onStartGame(config);
  };

  // Export chronicle to clipboard
  const handleExportChronicle = useCallback(async () => {
    if (!gameState) return;

    const winner = gameState.winner
      ? gameState.factions[gameState.winner]?.name
      : 'Unknown';

    const epochName = gameState.epoch?.name ?? 'Unknown Epoch';

    const eraEntries = gameState.eraCards
      .map((card) => `Era ${card.era}:\n\n${card.narrativeSummary}`)
      .join('\n\n');

    const chronicle = [
      'FORK CHRONICLE — ALTERNATE HISTORIES',
      '\u2500'.repeat(40),
      '',
      `Epoch: ${epochName}`,
      `Duration: ${gameState.currentTurn} turns \u00b7 ${gameState.currentEra} eras`,
      `Victor: ${winner}`,
      '',
      '\u2500'.repeat(40),
      '',
      eraEntries,
      '',
      '\u2500'.repeat(40),
      `Generated by Fork Chronicle \u00b7 ${new Date().toLocaleDateString()}`,
    ].join('\n');

    try {
      await navigator.clipboard.writeText(chronicle);
      setExportConfirmed(true);
      setTimeout(() => setExportConfirmed(false), 2000);
    } catch {
      const blob = new Blob([chronicle], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank');
    }
  }, [gameState]);

  // Reset card revealed state when a new card is drawn
  useEffect(() => {
    setCardRevealed(false);
  }, [playerState?.currentDrawnCard?.id]);

  // Debug map rendering
  useEffect(() => {
    console.log('[Fork Map Debug]', {
      hasSvgInner: !!mapSvgInner,
      svgInnerLength: mapSvgInner?.length,
      hasMapParams: !!mapParams,
      mapParams,
      hasGameState: !!gameState,
    });
  }, [mapSvgInner, mapParams, gameState]);

  return (
    <div className="fork-page">
      {/* SETUP SCREEN - Shown when no game is running */}
      {!gameState && (
        <div className="fork-setup-screen">
          {/* Header */}
          <div className="fork-setup-header">
            <div className="fork-setup-title">Fork Chronicle</div>
            <div className="fork-setup-subtitle">A Chronicle of Alternate Histories</div>
          </div>

          {/* Epoch Selection */}
          <div className="fork-setup-section">
            <div className="fork-setup-section-title">Choose Your Epoch</div>
            <div className="fork-setup-cards">
              {availableEpochs.map((epoch) => (
                <div
                  key={epoch.id}
                  className={`fork-setup-card ${selectedEpochId === epoch.id ? 'selected' : ''}`}
                  onClick={() => setSelectedEpochId(epoch.id)}
                >
                  <div className="fork-setup-card-header">
                    <div className="fork-setup-card-name">{epoch.name}</div>
                    <div className="fork-setup-card-year">{epoch.year}</div>
                  </div>
                  <div className="fork-setup-card-desc">{epoch.description}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Faction Count */}
          {selectedEpochId && (
            <div className="fork-setup-section">
              <div className="fork-setup-section-title">Number of Factions</div>
              <div style={{ display: 'flex', gap: 8, maxWidth: 500, margin: '0 auto' }}>
                {([2, 3, 4] as const).map(n => (
                  <button
                    key={n}
                    onClick={() => setFactionCount(n)}
                    style={{
                      flex: 1,
                      padding: 10,
                      fontSize: 14,
                      fontWeight: 600,
                      background: factionCount === n
                        ? 'var(--text-primary, #e5e5e5)'
                        : 'var(--bg-secondary, #222)',
                      color: factionCount === n
                        ? 'var(--bg-primary, #1a1a1a)'
                        : 'var(--text-secondary, #aaa)',
                      border: '1px solid var(--border, #333)',
                      borderRadius: 8,
                      cursor: 'pointer',
                    }}
                  >
                    {n} factions
                  </button>
                ))}
              </div>
              <div style={{
                fontSize: 12,
                color: 'var(--text-tertiary)',
                marginTop: 6,
                textAlign: 'center',
              }}>
                {factionCount === 2 ? 'Two dominant powers compete for the world'
                  : factionCount === 3 ? 'Three factions in an unstable balance of power'
                  : 'Four factions — the full geopolitical complexity'}
              </div>
            </div>
          )}

          {/* Country Selection */}
          {selectedEpochId && (
            <div className="fork-setup-section">
              <div className="fork-setup-section-title">Choose Your Country</div>
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(4, 1fr)',
                gap: 8,
                maxHeight: 280,
                overflowY: 'auto',
                padding: 4,
              }}>
                {availableCountries.map((country) => (
                  <div
                    key={country.id}
                    onClick={() => setSelectedCountryId(country.id)}
                    style={{
                      padding: '10px 12px',
                      background: selectedCountryId === country.id
                        ? 'var(--bg-tertiary, #2a2a2a)'
                        : 'var(--bg-primary, #1a1a1a)',
                      border: selectedCountryId === country.id
                        ? '2px solid var(--text-primary, #e5e5e5)'
                        : '1px solid var(--border, #333)',
                      borderRadius: 8,
                      cursor: 'pointer',
                      textAlign: 'center',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <div style={{ fontSize: 24, marginBottom: 4 }}>
                      {country.flag || '🏳️'}
                    </div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>
                      {country.name}
                    </div>
                    <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginTop: 2 }}>
                      {country.continent}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Begin Button */}
          <div className="fork-setup-begin">
            <button
              className="fork-setup-begin-btn"
              disabled={!selectedEpochId || !selectedCountryId}
              onClick={handleStartGame}
            >
              Begin the Chronicle
            </button>
          </div>

          {/* Faction Reveal Screen */}
          {showingReveal && selectedCountryFaction && (
            <div style={{
              position: 'absolute',
              inset: 0,
              zIndex: 150,
              background: 'var(--bg-primary)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 12,
              animation: 'fadeOut 0.5s ease 2s forwards',
            }}>
              <div style={{ fontSize: 14, color: 'var(--text-secondary)' }}>
                You are playing as
              </div>
              <div style={{ fontSize: 32, fontWeight: 700 }}>
                {COUNTRY_FLAGS[selectedCountryId!] || ''} {COUNTRY_NAMES[selectedCountryId!] || selectedCountryId}
              </div>
              <div style={{ fontSize: 14, color: 'var(--text-secondary)', marginTop: 8 }}>
                Your faction is
              </div>
              <div style={{
                fontSize: 28,
                fontWeight: 700,
                color: selectedCountryFaction.color,
              }}>
                {selectedCountryFaction.name}
              </div>
              <div style={{
                fontSize: 13,
                color: 'var(--text-tertiary)',
                maxWidth: 280,
                textAlign: 'center',
                marginTop: 8,
              }}>
                Guide your agents. Shape history. One directive per era.
              </div>
            </div>
          )}
        </div>
      )}

      {/* LEFT PANEL */}
      <div className="fork-left-panel">
        {gameState && (
          <div>
            {/* Animated Turn/Era Counter */}
            <div style={{
              padding: '16px 0 8px',
              borderBottom: '1px solid var(--border)',
              marginBottom: 12,
            }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                marginBottom: 6,
              }}>
                {/* Animated clock SVG */}
                <svg
                  width="20" height="20" viewBox="0 0 24 24"
                  style={{
                    animation: isRunning && !isPaused
                      ? 'spin 4s linear infinite'
                      : 'none',
                    color: 'var(--text-secondary)',
                    flexShrink: 0,
                  }}
                >
                  <circle cx="12" cy="12" r="10"
                    fill="none" stroke="currentColor"
                    strokeWidth="1.5"/>
                  <path d="M12 6v6l4 2"
                    fill="none" stroke="currentColor"
                    strokeWidth="1.5" strokeLinecap="round"/>
                </svg>

                <div>
                  {/* Year: large */}
                  <div style={{
                    fontSize: 22,
                    fontWeight: 700,
                    color: 'var(--text-primary)',
                    lineHeight: 1.1,
                  }}
                  key={gameState.currentEra}>
                    {(gameState.epoch?.year ?? 1914) + (gameState.currentEra - 1) * 5}
                  </div>
                  {/* Era · Turn: smaller */}
                  <div style={{
                    fontSize: 13,
                    color: 'var(--text-secondary)',
                    marginTop: 2,
                  }}>
                    Era {gameState.currentEra} · Turn {gameState.currentTurn}
                  </div>
                </div>
              </div>

              {/* Turn progress bar */}
              <div style={{
                height: 3,
                background: 'var(--border)',
                borderRadius: 2,
                overflow: 'hidden',
              }}>
                <div style={{
                  height: '100%',
                  width: `${((gameState.currentTurn % 5) / 5) * 100}%`,
                  background: 'var(--text-primary)',
                  borderRadius: 2,
                  transition: 'width 0.1s linear',
                }} />
              </div>
            </div>

            <div style={{ marginBottom: 16 }}>
              <h4 style={{ fontSize: 12, marginBottom: 8 }}>Faction Standings</h4>
              {Object.values(gameState.factions).map((faction) => {
                const isCommander = selectedFactionId && faction.id === selectedFactionId;
                return (
                  <div key={faction.id} className="fork-faction-row">
                    <div
                      className="fork-faction-dot"
                      style={{ background: faction.color }}
                    />
                    <span style={{ fontSize: 13, flex: 1, fontWeight: isCommander ? 600 : 400 }}>
                      {isCommander && '★ '}
                      {faction.name}
                      {isCommander && selectedCountryId && (
                        <span style={{ fontSize: 11, color: 'var(--text-tertiary)', marginLeft: 4 }}>
                          {COUNTRY_FLAGS[selectedCountryId]} {COUNTRY_NAMES[selectedCountryId]}
                        </span>
                      )}
                    </span>
                    <span style={{ fontSize: 12, color: "#999" }}>
                      {faction.territories.length}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Commander Directive Input (once per era) */}
            {selectedFactionId && showDirective && (
              <div style={{ marginBottom: 16, padding: 12, background: 'var(--bg-secondary)', borderRadius: 6, border: '1px solid var(--border)' }}>
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: 8,
                }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
                    Era {gameState.currentEra} Directive
                  </div>
                  {directiveCountdown > 0 && (
                    <div style={{
                      fontSize: 12,
                      color: directiveCountdown <= 5
                        ? '#E24B4A'
                        : 'var(--text-secondary)',
                      fontWeight: 600,
                    }}>
                      Resuming in {directiveCountdown}s
                    </div>
                  )}
                </div>

                {/* Countdown progress bar */}
                {directiveCountdown > 0 && (
                  <div style={{
                    height: 2,
                    background: 'var(--border)',
                    borderRadius: 1,
                    marginBottom: 10,
                    overflow: 'hidden',
                  }}>
                    <div style={{
                      height: '100%',
                      width: `${(directiveCountdown / 15) * 100}%`,
                      background: directiveCountdown <= 5
                        ? '#E24B4A'
                        : 'var(--text-primary)',
                      borderRadius: 1,
                      transition: 'width 0.9s linear',
                    }} />
                  </div>
                )}

                <textarea
                  value={directive}
                  onChange={(e) => setDirective(e.target.value)}
                  placeholder="Enter your strategic directive..."
                  style={{
                    width: '100%',
                    minHeight: 60,
                    padding: 8,
                    fontSize: 12,
                    background: 'var(--bg-primary)',
                    border: '1px solid var(--border)',
                    borderRadius: 4,
                    color: 'var(--text-primary)',
                    resize: 'vertical',
                    marginBottom: 8,
                  }}
                />
                <button
                  onClick={() => {
                    onSubmitDirective(directive);
                    setDirective('');
                  }}
                  disabled={!directive.trim()}
                  style={{
                    width: '100%',
                    padding: '6px 12px',
                    fontSize: 12,
                    background: directive.trim() ? 'var(--text-primary)' : 'var(--border)',
                    color: directive.trim() ? 'var(--bg-primary)' : 'var(--text-tertiary)',
                    border: 'none',
                    borderRadius: 4,
                    cursor: directive.trim() ? 'pointer' : 'not-allowed',
                    fontWeight: 600,
                  }}
                >
                  Issue Directive
                </button>
              </div>
            )}

            {/* Turn Speed Controls */}
            <div style={{marginTop: 12}}>
              <div style={{
                fontSize: 11,
                fontWeight: 600,
                color: 'var(--text-tertiary)',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                marginBottom: 8
              }}>
                Turn Speed
              </div>
              <div style={{display: 'flex', gap: 4}}>
                {[[1500, 'Fast'], [3000, 'Normal'], [5000, 'Slow']].map(([ms, label]) => (
                  <button
                    key={ms}
                    onClick={() => onSetTurnSpeed(ms as number)}
                    style={{
                      flex: 1,
                      padding: '5px 0',
                      fontSize: 12,
                      background: turnSpeed === ms
                        ? 'var(--text-primary)'
                        : 'transparent',
                      color: turnSpeed === ms
                        ? 'var(--bg-primary)'
                        : 'var(--text-secondary)',
                      border: '1px solid var(--border)',
                      borderRadius: 4,
                      cursor: 'pointer',
                    }}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* Pause/Resume and Stop Game */}
            {gameEnded ? (
              <div style={{ marginTop: 12 }}>
                <div style={{
                  fontSize: 11,
                  fontWeight: 600,
                  color: 'var(--text-tertiary)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.1em',
                  textAlign: 'center',
                  marginBottom: 8,
                }}>
                  Chronicle Complete
                </div>
                <button
                  onClick={onNewGame}
                  style={{
                    width: '100%',
                    padding: '10px',
                    fontSize: 13,
                    background: 'var(--text-primary)',
                    color: 'var(--bg-primary)',
                    border: 'none',
                    borderRadius: 6,
                    cursor: 'pointer',
                    fontWeight: 600,
                  }}
                >
                  New Chronicle
                </button>
              </div>
            ) : (
              <div style={{display:'flex', gap:8, marginTop:12}}>
                <button
                  onClick={() => isPaused ? onResumeGame() : onPauseGame()}
                  style={{
                    flex: 1,
                    padding: '8px',
                    fontSize: 13,
                    background: 'transparent',
                    border: '1px solid var(--border)',
                    borderRadius: 6,
                    cursor: 'pointer',
                    color: 'var(--text-primary)'
                  }}
                >
                  {isPaused ? '▶ Resume' : '⏸ Pause'}
                </button>
                <button
                  onClick={onStopGame}
                  style={{
                    flex: 1,
                    padding: '8px',
                    fontSize: 13,
                    background: '#dc3545',
                    border: 'none',
                    color: 'white',
                    fontWeight: 600,
                    cursor: 'pointer',
                    borderRadius: 6,
                  }}
                >
                  Stop Game
                </button>
              </div>
            )}

            {/* Error Display */}
            {error && (
              <div style={{ color: 'red', fontSize: 12, marginTop: 8, padding: 8, background: '#331', borderRadius: 4 }}>
                ⚠️ {error}
              </div>
            )}

            {/* Player Actions */}
            {playerState && (
              <div style={{ marginTop: 16, paddingTop: 16, borderTop: "1px solid #444" }}>
                <div className="fork-ip-display">
                  Influence: {isNaN(playerState.influencePoints) ? 100 : playerState.influencePoints} IP
                </div>

                <div style={{ marginTop: 12 }}>
                  <h4 style={{ fontSize: 12, marginBottom: 8 }}>Event Card</h4>
                  {playerState.currentDrawnCard ? (
                    !cardRevealed ? (
                      /* Mystery card — before reveal */
                      <div style={{
                        background: 'var(--bg-secondary)',
                        border: '1px dashed var(--border)',
                        borderRadius: 8,
                        padding: 12,
                        textAlign: 'center',
                      }}>
                        <div style={{
                          fontSize: 11, fontWeight: 600,
                          color: 'var(--text-tertiary)',
                          textTransform: 'uppercase',
                          letterSpacing: '0.08em',
                          marginBottom: 8,
                        }}>
                          Event Card
                        </div>
                        <div style={{ fontSize: 28, marginBottom: 8 }}>?</div>
                        <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>
                          From Wikipedia
                        </div>
                        <div style={{
                          fontSize: 13, fontWeight: 600,
                          color: 'var(--text-primary)',
                          marginBottom: 12,
                        }}>
                          {playerState.currentDrawnCard.wikiYear ?? '???'}
                        </div>
                        <div style={{
                          display: 'flex', alignItems: 'center',
                          justifyContent: 'center', gap: 6, marginBottom: 12,
                        }}>
                          <span className={`fork-tier-badge fork-tier-${playerState.currentDrawnCard.tier}`}>
                            Tier {playerState.currentDrawnCard.tier}
                          </span>
                          <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
                            {playerState.currentDrawnCard.tier === 3 ? 'Global event'
                              : playerState.currentDrawnCard.tier === 2 ? 'Regional event'
                              : 'Local event'}
                          </span>
                        </div>
                        <button
                          onClick={() => setCardRevealed(true)}
                          style={{
                            width: '100%', padding: 8,
                            background: 'transparent',
                            border: '1px solid var(--border)',
                            borderRadius: 6, fontSize: 12,
                            fontWeight: 600, cursor: 'pointer',
                            color: 'var(--text-primary)',
                          }}
                        >
                          Reveal Card
                        </button>
                      </div>
                    ) : (
                      /* Revealed card — full details + play button */
                      <div style={{
                        background: 'var(--bg-secondary)',
                        border: '1px solid var(--border)',
                        borderRadius: 8,
                        padding: 12,
                      }}>
                        {/* Wikipedia thumbnail */}
                        {(playerState.currentDrawnCard.wikiThumbnailDataUrl || playerState.currentDrawnCard.wikiThumbnail) && (
                          <img
                            src={playerState.currentDrawnCard.wikiThumbnailDataUrl || playerState.currentDrawnCard.wikiThumbnail}
                            style={{ width: '100%', height: 64, objectFit: 'cover', borderRadius: 6, marginBottom: 8 }}
                            alt="Historical event"
                            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                          />
                        )}
                        {/* Tier + source */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                          <span className={`fork-tier-badge fork-tier-${playerState.currentDrawnCard.tier}`}>
                            Tier {playerState.currentDrawnCard.tier}
                          </span>
                          {playerState.currentDrawnCard.wikiYear && (
                            <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
                              Wikipedia · {playerState.currentDrawnCard.wikiYear}
                            </span>
                          )}
                        </div>
                        {/* Title */}
                        <div style={{
                          fontSize: 13, fontWeight: 600,
                          color: 'var(--text-primary)',
                          marginBottom: 6, lineHeight: 1.4,
                        }}>
                          {playerState.currentDrawnCard.title}
                        </div>
                        {/* Wikipedia excerpt */}
                        {playerState.currentDrawnCard.wikiText && (
                          <div style={{
                            fontSize: 12, fontStyle: 'italic',
                            color: 'var(--text-secondary)', lineHeight: 1.5,
                            marginBottom: 10,
                            borderLeft: '2px solid var(--border)',
                            paddingLeft: 8,
                          }}>
                            &ldquo;{playerState.currentDrawnCard.wikiText.slice(0, 100)}...&rdquo;
                          </div>
                        )}
                        {/* Effects preview */}
                        <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginBottom: 10 }}>
                          {playerState.currentDrawnCard.effects.length} effect{playerState.currentDrawnCard.effects.length !== 1 ? 's' : ''} on{' '}
                          {playerState.currentDrawnCard.tier === 3 ? 'global territories'
                            : playerState.currentDrawnCard.tier === 2 ? 'regional territories'
                            : 'local territories'}
                        </div>
                        {/* Play button */}
                        <button
                          onClick={onPlayEventCard}
                          disabled={playerState.influencePoints < playerState.currentDrawnCard.ipCost}
                          style={{
                            width: '100%', padding: 9,
                            background: playerState.influencePoints >= playerState.currentDrawnCard.ipCost
                              ? 'var(--text-primary)' : 'var(--border)',
                            color: playerState.influencePoints >= playerState.currentDrawnCard.ipCost
                              ? 'var(--bg-primary)' : 'var(--text-tertiary)',
                            border: 'none', borderRadius: 6,
                            fontSize: 13, fontWeight: 600,
                            cursor: playerState.influencePoints >= playerState.currentDrawnCard.ipCost
                              ? 'pointer' : 'not-allowed',
                          }}
                        >
                          Play Card ({playerState.currentDrawnCard.ipCost} IP)
                        </button>
                      </div>
                    )
                  ) : (
                    <div style={{ fontSize: 12, color: "#999" }}>No card drawn yet</div>
                  )}
                </div>

                {/* Live Events Feed */}
                {liveLog.length > 0 && (
                  <div style={{
                    flex: 1,
                    display: 'flex',
                    flexDirection: 'column',
                    minHeight: 0,
                    borderTop: '1px solid var(--border)',
                    paddingTop: 12,
                    marginTop: 12,
                  }}>
                    <div style={{
                      fontSize: 11,
                      fontWeight: 600,
                      color: 'var(--text-tertiary)',
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                      marginBottom: 8,
                    }}>
                      Live Events
                    </div>
                    <div style={{
                      flex: 1,
                      overflowY: 'auto',
                      display: 'flex',
                      flexDirection: 'column',
                      minHeight: 0,
                    }}>
                      {liveLog.slice(0, 50).map((entry, i) => (
                        <div key={i} style={{
                          fontSize: 13,
                          lineHeight: 1.5,
                          padding: '4px 0',
                          borderBottom: '1px solid var(--border-subtle)',
                          color: 'var(--text-primary)',
                        }}>
                          <span style={{
                            fontSize: 11,
                            color: 'var(--text-tertiary)',
                            marginRight: 6,
                          }}>
                            T{entry.turn}
                          </span>
                          {entry.emoji} {entry.message}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* CENTER PANEL - Map */}
      <div className="fork-map-panel">
        {/* Live Scoreboard */}
        {gameState && (
          <div className="fork-scoreboard">
            <div style={{
              fontSize: 11,
              color: 'var(--text-tertiary)',
              textAlign: 'center',
              padding: '4px 0',
              borderBottom: '1px solid var(--border-subtle)',
            }}>
              {gameState.epoch?.name ?? 'Unknown Epoch'} · {(gameState.epoch?.year ?? 1914) + (gameState.currentEra - 1) * 5}
            </div>
            {Object.values(gameState.factions)
              .sort((a, b) => b.territories.length - a.territories.length)
              .map((faction) => {
                const totalTerritories = Object.keys(gameState.territories).length;
                const territoryPct = Math.round(
                  (faction.territories.length / totalTerritories) * 100
                );
                const leadingFaction = Object.values(gameState.factions).reduce((max, f) =>
                  f.territories.length > max.territories.length ? f : max
                );
                const isLeading = faction.id === leadingFaction.id;
                const isCommander = selectedFactionId && faction.id === selectedFactionId;

                return (
                  <div key={faction.id} className={`score-item ${isCommander ? 'commander' : ''}`}>
                    <div className="score-dot" style={{ background: faction.color }} />
                    <div className="score-name">
                      {isCommander && '★ '}
                      {faction.name}
                      {isCommander && selectedCountryId && (
                        <span style={{ fontSize: 10, marginLeft: 4, opacity: 0.7 }}>
                          {COUNTRY_FLAGS[selectedCountryId]}
                        </span>
                      )}
                    </div>
                    <div className="score-bar-wrap">
                      <div
                        className="score-bar-fill"
                        style={{
                          width: `${territoryPct}%`,
                          background: faction.color,
                        }}
                      />
                    </div>
                    <div className="score-pct">{territoryPct}%</div>
                    {isLeading && (
                      <div className="score-leader-badge">LEADING</div>
                    )}
                  </div>
                );
              })}
            <div className="win-condition-note">
              {gameState.currentEra >= 18 ? (
                <span style={{ color: '#ef4444', fontWeight: 600 }}>
                  🔴 Final eras — {20 - gameState.currentEra} remaining
                </span>
              ) : gameState.currentEra >= 15 ? (
                <span style={{ color: '#f59e0b', fontWeight: 600 }}>
                  ⚠️ {20 - gameState.currentEra} eras remaining
                </span>
              ) : (
                'First to 70% for 2 eras wins'
              )}
            </div>
          </div>
        )}

        {/* Action Ticker Strip */}
        {gameState && (
          <div style={{
            padding: '6px 16px',
            borderBottom: '1px solid var(--border-subtle)',
            background: 'var(--bg-secondary)',
            overflow: 'hidden',
            whiteSpace: 'nowrap',
            position: 'relative',
          }}>
            <div style={{
              display: 'inline-flex',
              gap: 32,
              animationName: tickerMessages.length > 0 ? 'tickerScroll' : 'none',
              animationDuration: `${turnSpeed <= 1500 ? 15 : turnSpeed <= 3000 ? 25 : 40}s`,
              animationTimingFunction: 'linear',
              animationIterationCount: 'infinite',
              animationPlayState: isPaused ? 'paused' : 'running',
              fontSize: 12,
              color: 'var(--text-secondary)',
            }}>
              {tickerMessages.length > 0
                ? tickerMessages.map((msg, i) => (
                    <span key={i} style={{ flexShrink: 0 }}>{msg}</span>
                  ))
                : <span>Awaiting first actions...</span>
              }
              {/* Duplicate for seamless loop */}
              {tickerMessages.map((msg, i) => (
                <span key={`dup-${i}`} style={{ flexShrink: 0 }}>{msg}</span>
              ))}
            </div>
          </div>
        )}

        {/* Event Banner */}
        {activeEventBanner && (
          <div style={{
            position: 'absolute',
            top: gameState ? 80 : 10,
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 50,
            background: 'rgba(0, 0, 0, 0.9)',
            border: '1px solid rgba(255, 215, 0, 0.4)',
            borderRadius: 8,
            padding: '12px 24px',
            maxWidth: 400,
            textAlign: 'center',
            animation: 'fadeIn 0.3s ease',
          }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#fbbf24', marginBottom: 4 }}>
              🎴 {activeEventBanner.title}
            </div>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)', lineHeight: 1.4 }}>
              {activeEventBanner.description.slice(0, 150)}
            </div>
          </div>
        )}

        {/* Event Impact Overlay */}
        {eventImpact && (
          <div style={{
            position: 'absolute',
            top: 60,
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 100,
            background: eventImpact.tier === 3 ? '#712B13'
              : eventImpact.tier === 2 ? '#633806'
              : '#085041',
            color: 'white',
            padding: '16px 24px',
            borderRadius: 10,
            maxWidth: 420,
            width: '90%',
            boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
            animation: 'fadeIn 0.3s ease',
          }}>
            <div style={{
              fontSize: 11, fontWeight: 700,
              textTransform: 'uppercase', letterSpacing: '0.1em',
              opacity: 0.75, marginBottom: 4,
            }}>
              Event Played
            </div>
            <div style={{
              fontSize: 15, fontWeight: 700,
              marginBottom: 12, lineHeight: 1.3,
            }}>
              {eventImpact.title}
            </div>
            <div style={{
              fontSize: 12, fontWeight: 600,
              opacity: 0.75, textTransform: 'uppercase',
              letterSpacing: '0.08em', marginBottom: 8,
            }}>
              Impact on the timeline
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {eventImpact.lines.map((line, i) => (
                <div key={i} style={{
                  fontSize: 13, opacity: 0.9,
                  display: 'flex', alignItems: 'center', gap: 6,
                }}>
                  <span style={{ opacity: 0.6 }}>→</span>
                  {line}
                </div>
              ))}
            </div>
            <div style={{
              fontSize: 11, opacity: 0.5,
              marginTop: 12, textAlign: 'right',
            }}>
              Dismisses automatically
            </div>
          </div>
        )}

        <svg
          viewBox={mapViewBox}
          preserveAspectRatio="xMidYMid meet"
          style={{ width: "100%", height: "100%" }}
          {...mapRootAttrs}
        >
          <g dangerouslySetInnerHTML={{ __html: mapSvgInner }} />

          {/* Territory Fill Ellipses */}
          {gameState && mapParams && Object.entries(gameState.territories).map(([id, territory]) => {
            const coords = territoryCoords[id as keyof typeof territoryCoords];
            if (!coords || !coords.box) return null;

            const faction = territory.controlledBy
              ? gameState.factions[territory.controlledBy]
              : null;

            const rect = territoryBoxToSvgRect(coords.box);
            if (!rect) return null;

            // Commander Mode: Emphasize commander faction territories
            const isCommanderFaction = selectedFactionId && faction?.id === selectedFactionId;
            const ellipseOpacity = isCommanderFaction ? 0.65 : 0.25;

            return (
              <ellipse
                key={`fill-${id}`}
                cx={rect.x + rect.width / 2}
                cy={rect.y + rect.height / 2}
                rx={rect.width / 2}
                ry={rect.height / 2}
                fill={faction ? faction.color : '#888888'}
                opacity={ellipseOpacity}
                style={{ pointerEvents: 'none' }}
              />
            );
          })}

          {/* Fork Overlay - Territory Markers */}
          {projectedTerritories.map(({ territory, x, y }) => {
            const faction = territory.controlledBy
              ? gameState?.factions[territory.controlledBy]
              : null;
            const isContested = !!territory.contestedBy;

            // Commander Mode: Larger dots for commander faction
            const isCommanderFaction = selectedFactionId && faction?.id === selectedFactionId;
            const baseRadius = isCommanderFaction ? 10 : 6;
            const dotRadius = isContested ? baseRadius + 3 : baseRadius;

            return (
              <g key={territory.id}>
                {/* Territory Circle */}
                <circle
                  cx={x}
                  cy={y}
                  r={dotRadius}
                  fill={faction ? faction.color : "#888888"}
                  stroke="white"
                  strokeWidth={1.5}
                  opacity={0.6}
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
                      values="0.6;0.3;0.6"
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
              onClick={handleExportChronicle}
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
              {exportConfirmed ? '\u2713 Copied to Clipboard' : 'Export Chronicle'}
            </button>
          </>
        ) : (
          <div style={{ fontSize: 12, color: "#999", textAlign: "center", padding: 16 }}>
            {gameState ? "No era summaries yet" : "Start a game to see chronicles"}
          </div>
        )}

      </div>

      {/* Game Over Overlay */}
      {gameState?.winner && (
        <div className="fork-game-over-overlay">
          {/* Personal Result (Commander Mode) */}
          {selectedFactionId && (
            <div
              className={`game-over-result ${
                selectedFactionId === gameState.winner ? 'victory' : 'defeated'
              }`}
            >
              {selectedFactionId === gameState.winner ? 'VICTORY' : 'DEFEATED'}
            </div>
          )}

          {/* Winner Announcement */}
          <div className="game-over-winner-section">
            <div className="game-over-winner-label">Chronicle Complete</div>
            <div
              className="game-over-winner-name"
              style={{ color: gameState.factions[gameState.winner]?.color }}
            >
              {gameState.factions[gameState.winner]?.name}
            </div>

            {/* Statistics */}
            <div className="game-over-stats">
              <div className="game-over-stat">
                <div className="game-over-stat-value">
                  {Math.round(
                    (gameState.factions[gameState.winner]?.territories.length /
                      Object.keys(gameState.territories).length) *
                      100
                  )}%
                </div>
                <div className="game-over-stat-label">Territory</div>
              </div>
              <div className="game-over-stat">
                <div className="game-over-stat-value">{gameState.currentTurn}</div>
                <div className="game-over-stat-label">Turns</div>
              </div>
              <div className="game-over-stat">
                <div className="game-over-stat-value">{gameState.currentEra}</div>
                <div className="game-over-stat-label">Eras</div>
              </div>
            </div>
          </div>

          {/* Final Standings */}
          <div className="game-over-standings">
            <div className="game-over-standings-title">Final Standings</div>
            <div className="game-over-standings-list">
              {Object.values(gameState.factions)
                .sort((a, b) => b.territories.length - a.territories.length)
                .map((faction, index) => {
                  const totalTerritories = Object.keys(gameState.territories).length;
                  const territoryPct = Math.round(
                    (faction.territories.length / totalTerritories) * 100
                  );
                  return (
                    <div key={faction.id} className="game-over-standing-item">
                      <div className={`game-over-standing-rank ${index === 0 ? 'first' : ''}`}>
                        #{index + 1}
                      </div>
                      <div
                        className="game-over-standing-dot"
                        style={{ background: faction.color }}
                      />
                      <div className="game-over-standing-name">{faction.name}</div>
                      <div className="game-over-standing-pct">{territoryPct}%</div>
                    </div>
                  );
                })}
            </div>
          </div>

          {/* Actions */}
          <div className="game-over-actions">
            <button
              className="game-over-btn secondary"
              onClick={handleExportChronicle}
            >
              {exportConfirmed ? '\u2713 Copied to Clipboard' : 'Export Chronicle'}
            </button>
            <button
              className="game-over-btn primary"
              onClick={onNewGame}
            >
              New Chronicle
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
