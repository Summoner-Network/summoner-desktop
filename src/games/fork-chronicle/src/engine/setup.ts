/**
 * Game setup and initialization for Fork: A Chronicle of Alternate Histories
 * Section 2: Game Setup
 */

import type {
  GameConfig,
  GameState,
  GamePhase
} from "../types/game-state";
import type { Territory, ResourceBundle } from "../types/territory";
import type { Faction, FactionId } from "../types/faction";
import type { Agent, PersonalityProfile } from "../types/agent";
import type { PlayerState } from "../types/player";
import type { HistoricalEvent } from "../types/event";
import { SeededRandom } from "../utils/random";
import { loadTerritories, loadEpoch, loadEvents } from "../utils/data-loader";
import { InMemorySummonerAnalyticsBridge, generateStateHash } from "../analytics/summoner-analytics-bridge";

/**
 * [RULE] Faction Starting Validity
 * Before finalizing setup, verify no faction starts with more than 60% calculated
 * territorial advantage over any other faction. If the seed produces an imbalanced
 * starting state, increment the seed by 1 and retry. Max 10 retries before surfacing an error.
 */
const MAX_ADVANTAGE_RATIO = 0.6;
const MAX_BALANCE_RETRIES = 10;

/**
 * Calculate faction advantage using the spec formula:
 * advantage(faction) = (territories_controlled * 0.5) + (total_strength / global_strength * 0.3) + (total_resources / global_resources * 0.2)
 */
function calculateFactionAdvantage(
  faction: Faction,
  allFactions: Faction[],
  territories: Record<string, Territory>
): number {
  const totalTerritories = Object.keys(territories).length;
  const territoryScore = faction.territories.length / totalTerritories;

  // Calculate global strength
  const globalStrength = Object.values(territories).reduce(
    (sum, t) => sum + t.strength,
    0
  );
  const factionStrength = faction.territories.reduce(
    (sum, tId) => sum + territories[tId].strength,
    0
  );
  const strengthScore = factionStrength / globalStrength;

  // Calculate global resources
  const globalResources = Object.values(territories).reduce(
    (sum, t) => sum + t.resources.food + t.resources.industry + t.resources.tech,
    0
  );
  const factionResources = faction.territories.reduce(
    (sum, tId) => {
      const t = territories[tId];
      return sum + t.resources.food + t.resources.industry + t.resources.tech;
    },
    0
  );
  const resourceScore = factionResources / globalResources;

  return territoryScore * 0.5 + strengthScore * 0.3 + resourceScore * 0.2;
}

/**
 * Check if faction distribution is balanced according to the spec
 */
function isFactionBalanceValid(
  factions: Record<FactionId, Faction>,
  territories: Record<string, Territory>
): boolean {
  const factionList = Object.values(factions);
  const advantages = factionList.map((f) =>
    calculateFactionAdvantage(f, factionList, territories)
  );

  // Check if any faction has more than 60% advantage over any other
  for (let i = 0; i < advantages.length; i++) {
    for (let j = 0; j < advantages.length; j++) {
      if (i !== j) {
        const ratio = advantages[i] / advantages[j];
        if (ratio > 1 + MAX_ADVANTAGE_RATIO) {
          return false;
        }
      }
    }
  }

  return true;
}

/**
 * Generate a randomized personality profile for an agent
 * [RULE] Uniform random within 0.2–0.8 per trait
 */
function generatePersonality(rng: SeededRandom): PersonalityProfile {
  return {
    aggression: rng.nextFloat(0.2, 0.8),
    loyalty: rng.nextFloat(0.2, 0.8),
    riskTolerance: rng.nextFloat(0.2, 0.8),
    expansionism: rng.nextFloat(0.2, 0.8)
  };
}

/**
 * Assign 2-4 agents to each faction
 */
function createAgentsForFaction(
  factionId: FactionId,
  factionTerritories: string[],
  rng: SeededRandom
): Agent[] {
  const agentCount = rng.nextInt(2, 4);
  const archetypes: Array<Agent["archetype"]> = [
    "conqueror",
    "diplomat",
    "economist",
    "historian"
  ];

  const agents: Agent[] = [];
  for (let i = 0; i < agentCount; i++) {
    const archetype = rng.choice(archetypes);
    const homeTerritory = rng.choice(factionTerritories);

    agents.push({
      id: `${factionId}_agent_${i + 1}`,
      name: `${factionId} ${archetype} ${i + 1}`,
      factionId,
      archetype,
      homeTerritory,
      personality: generatePersonality(rng),
      reputation: 65, // Start at above-neutral reputation (raised from 50 to 65)
      memory: []
    });
  }

  return agents;
}

/**
 * Initialize factions based on epoch starting territory control
 */
function initializeFactions(
  config: GameConfig,
  territories: Record<string, Territory>,
  rng: SeededRandom
): Record<FactionId, Faction> {
  const epoch = loadEpoch(config.epochId);
  const factions: Record<FactionId, Faction> = {};

  // Create faction IDs based on factionCount
  const factionIds: FactionId[] = [];
  for (let i = 1; i <= config.factionCount; i++) {
    factionIds.push(`faction_${i}`);
  }

  // Define faction colors
  const colors = ["#FF6B6B", "#4ECDC4", "#FFE66D", "#A8E6CF"];

  // Initialize each faction
  factionIds.forEach((factionId, index) => {
    factions[factionId] = {
      id: factionId,
      name: `Faction ${index + 1}`,
      color: colors[index] || `#${Math.floor(rng.next() * 16777215).toString(16)}`,
      agents: [], // Will be populated below
      territories: [],
      resources: { food: 0, industry: 0, tech: 0 },
      reputation: 65, // Raised from 50 to 65 for better alliance acceptance
      patronBacking: 0,
      stats: {
        territoriesControlled: 0,
        alliances: [],
        roundsInLead: 0,
        betrayalsCommitted: 0,
        betrayalsSuffered: 0
      }
    };
  });

  // Apply epoch starting territory control
  Object.entries(epoch.startingTerritoryControl).forEach(([territoryId, factionId]) => {
    if (territories[territoryId] && factions[factionId]) {
      territories[territoryId].controlledBy = factionId;
      factions[factionId].territories.push(territoryId);
    }
  });

  // Apply starting strengths from epoch
  Object.entries(epoch.startingStrengths).forEach(([territoryId, strength]) => {
    if (territories[territoryId]) {
      territories[territoryId].strength = strength;
    }
  });

  // Calculate faction resources from controlled territories
  Object.values(factions).forEach((faction) => {
    const totalResources: ResourceBundle = { food: 0, industry: 0, tech: 0 };
    faction.territories.forEach((tId) => {
      const territory = territories[tId];
      totalResources.food += territory.resources.food;
      totalResources.industry += territory.resources.industry;
      totalResources.tech += territory.resources.tech;
    });
    faction.resources = totalResources;
    faction.stats.territoriesControlled = faction.territories.length;

    // Create agents for this faction
    faction.agents = createAgentsForFaction(faction.id, faction.territories, rng);
  });

  return factions;
}

/**
 * Initialize player states
 */
function initializePlayerStates(config: GameConfig): Record<string, PlayerState> {
  const playerStates: Record<string, PlayerState> = {};

  config.players.forEach((playerConfig) => {
    playerStates[playerConfig.playerId] = {
      playerId: playerConfig.playerId,
      influencePoints: playerConfig.startingInfluencePoints,
      currentDrawnCard: null, // Will be dealt from deck
      bets: [],
      patronCommitments: [],
      actionsThisTurn: []
    };
  });

  return playerStates;
}

/**
 * Main game initialization function
 * Implements all setup steps from Section 2
 */
export function initializeGame(config: GameConfig): GameState {
  let attempts = 0;
  let seed = config.seed || Date.now().toString();

  while (attempts < MAX_BALANCE_RETRIES) {
    try {
      const rng = new SeededRandom(seed);

      // Step 1: Load epoch data and territories
      const epoch = loadEpoch(config.epochId);
      const territoryList = loadTerritories();
      const territories: Record<string, Territory> = {};
      territoryList.forEach((t) => {
        territories[t.id] = { ...t };
      });

      // Initialize factions with starting control
      const factions = initializeFactions(config, territories, rng);

      // Check faction balance
      if (!isFactionBalanceValid(factions, territories)) {
        if (attempts === MAX_BALANCE_RETRIES - 1) {
          throw new Error(
            `Failed to create balanced starting state after ${MAX_BALANCE_RETRIES} attempts. ` +
            `Try a different seed or epoch configuration.`
          );
        }
        // Increment seed and retry
        seed = (parseInt(seed) + 1).toString();
        attempts++;
        continue;
      }

      // Step 3: Shuffle the event deck using the game seed
      const allEvents = loadEvents(config.eventPackIds);
      const eventDeck = rng.shuffle(allEvents);

      // Step 4: Deal each player one face-down event card
      const playerStates = initializePlayerStates(config);
      const dealtCards: HistoricalEvent[] = [];
      Object.keys(playerStates).forEach((playerId) => {
        if (eventDeck.length > 0) {
          const card = eventDeck.shift()!;
          playerStates[playerId].currentDrawnCard = card;
          dealtCards.push(card);
        }
      });

      // Step 6: Set phase to player_actions for first turn
      const phase: GamePhase = "player_actions";

      // Create initial game state
      const gameState: GameState = {
        gameId: `game_${Date.now()}_${seed}`,
        seed,
        epoch,
        currentTurn: 1,
        currentEra: 1,
        phase,
        territories,
        factions,
        alliances: [],
        eventDeck,
        eventDiscard: [],
        activeEvents: [],
        playerStates,
        history: [],
        oddsHistory: [], // Odds snapshots populated at start of each turn
        eraCards: [], // Era summaries populated at end of each era
        winner: null,
        lastEraDominantFaction: null,
        analytics: new InMemorySummonerAnalyticsBridge(), // Summoner Analytics integration
        currentTurnStateHash: "" // Will be set immediately below
      };

      // Initialize state hash for turn 1
      gameState.currentTurnStateHash = generateStateHash(gameState);

      return gameState;
    } catch (error) {
      if (attempts === MAX_BALANCE_RETRIES - 1) {
        throw error;
      }
      attempts++;
    }
  }

  throw new Error(`Failed to initialize game after ${MAX_BALANCE_RETRIES} attempts`);
}
