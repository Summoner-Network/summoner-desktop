# Fork: A Chronicle of Alternate Histories — MVP Rules & Implementation Specification

> **For Claude Code:** This document is the authoritative game design spec for **Fork: A Chronicle of Alternate Histories**. It defines rules, data schemas, game loop logic, and extensibility contracts. Implement each section in order. Sections marked `[IMPLEMENT]` require code. Sections marked `[DATA]` define types/schemas. Sections marked `[RULE]` are game logic constraints that must be enforced. Sections marked `[EXTENSIBLE]` define interfaces that third-party developers can override.

---

## 0. Overview

**Fork: A Chronicle of Alternate Histories** is an autonomous multi-agent grand strategy simulation. AI agents form factions, negotiate alliances, and compete to control a world map initialized from real historical state. Human players participate in exactly three ways: betting on factions, injecting alternate history events, and backing factions as long-term patrons.

**Core design principle:** *Humans bend the world. Agents decide within it.*

### Technology Stack Assumptions
- Built on **Summoner Protocol (SPLT)** for agent coordination and messaging
- Map rendered via Summoner desktop app map component
- Agent communication uses SPLT structured negotiation flows
- Analytics via Scorcerer (audit log, decision traces)
- Language: TypeScript/Python (match existing Summoner SDK)

### MVP Scope
- 2–4 factions
- Real-world map (country-level territories)
- 3 human interaction types
- 10–15 alternate history events
- Turn-based (not real-time)
- Single win condition: territory majority

---

## 1. Data Schemas

### `[DATA]` Territory

```typescript
interface Territory {
  id: string;                    // ISO 3166-1 alpha-3 country code e.g. "FRA"
  name: string;                  // Display name e.g. "France"
  continent: Continent;          // See Continent enum
  adjacencies: string[];         // List of adjacent territory IDs (land borders + sea lanes)
  resources: ResourceBundle;     // Starting resource values
  strength: number;              // Military strength 1–100
  controlledBy: FactionId | null;
  contestedBy: FactionId | null; // Set during attack resolution
  historicalModifiers: Modifier[];
}

type Continent = "europe" | "asia" | "africa" | "north_america" | "south_america" | "oceania" | "middle_east";

interface ResourceBundle {
  food: number;       // 0–100
  industry: number;   // 0–100
  tech: number;       // 0–100
}
```

### `[DATA]` Faction

```typescript
interface Faction {
  id: FactionId;           // e.g. "eastern_coalition"
  name: string;            // Display name
  color: string;           // Hex color for map rendering
  agents: Agent[];         // 2–4 agents per faction
  territories: string[];   // Controlled territory IDs
  resources: ResourceBundle;
  reputation: number;      // 0–100, affects negotiation outcomes
  patronBacking: number;   // Accumulated patron investment points
  stats: FactionStats;
}

interface FactionStats {
  territoriesControlled: number;
  alliances: FactionId[];
  roundsInLead: number;
  betrayalsCommitted: number;
  betrayalsSuffered: number;
}
```

### `[DATA]` Agent

```typescript
interface Agent {
  id: string;
  name: string;
  factionId: FactionId;
  archetype: AgentArchetype;
  homeTerritory: string;   // Starting territory ID
  personality: PersonalityProfile;
  reputation: number;      // 0–100, individual reputation score
  memory: InteractionMemory[];
}

type AgentArchetype = "conqueror" | "diplomat" | "economist" | "historian";

interface PersonalityProfile {
  aggression: number;    // 0.0–1.0
  loyalty: number;       // 0.0–1.0
  riskTolerance: number; // 0.0–1.0
  expansionism: number;  // 0.0–1.0
}

// [RULE] Personality values are set at game initialization and drift ±0.1 per era
// based on outcomes. A diplomat who is betrayed twice raises aggression by 0.15.

interface InteractionMemory {
  turn: number;
  targetAgentId: string;
  interactionType: "alliance_offer" | "attack" | "trade" | "betrayal";
  outcome: "accepted" | "rejected" | "succeeded" | "failed";
}
```

### `[DATA]` HistoricalEvent

```typescript
interface HistoricalEvent {
  id: string;
  title: string;               // e.g. "Byzantine Empire Survives"
  description: string;         // Flavor text for UI display
  era: number | null;          // If null, can fire in any era
  source: EventSource;
  effects: EventEffect[];
  rippleEffects: EventEffect[]; // Secondary effects that fire 1 era later
  probability: number;          // 0.0–1.0, base draw probability from deck
}

type EventSource = "historical" | "counterfactual" | "community" | "future_projection";

interface EventEffect {
  type: EffectType;
  targetType: "territory" | "faction" | "global";
  targetId?: string;            // Specific territory or faction; if null, applies globally
  magnitude: number;            // Effect size, interpreted per EffectType
  description: string;          // Human-readable description for audit log
}

type EffectType =
  | "strength_delta"        // ±N to territory strength
  | "resource_delta"        // ±N to a resource
  | "control_transfer"      // Transfer territory to a faction or neutral
  | "alliance_break"        // Force dissolution of a specific alliance
  | "reputation_delta"      // ±N to faction reputation
  | "spawn_territory"       // Add a new territory to the map
  | "tech_boost";           // Multiply tech resource for a territory or faction
```

### `[DATA]` Alliance

```typescript
interface Alliance {
  id: string;
  factionIds: FactionId[];    // 2+ factions
  formedOnTurn: number;
  terms: AllianceTerm[];
  trustScore: number;         // 0–100, degrades if terms are violated
  status: "active" | "broken" | "expired";
}

interface AllianceTerm {
  type: "non_aggression" | "resource_share" | "joint_attack" | "defense_pact";
  durationEras: number | "indefinite";
}
```

### `[DATA]` PlayerAction

```typescript
// All three human interaction types are represented as PlayerAction

type PlayerAction =
  | BetAction
  | EventInjectionAction
  | PatronAction;

interface BetAction {
  type: "bet";
  playerId: string;
  betType: BetType;
  targetId: string;          // FactionId or other target depending on betType
  stake: number;             // Points wagered
  odds: number;              // Snapshot odds at time of bet
  placedOnTurn: number;
}

type BetType =
  | "faction_wins"           // Target faction wins the game
  | "faction_controls_continent" // Target faction controls a full continent by game end
  | "alliance_breaks"        // Named alliance breaks before game ends
  | "first_continent"        // Target faction is first to control any full continent
  | "faction_eliminated";    // Target faction is eliminated

interface EventInjectionAction {
  type: "event_injection";
  playerId: string;
  eventId: string;           // Must be from player's current drawn card
  injectedOnTurn: number;
  cost: number;              // Influence points spent (varies by event tier)
}

interface PatronAction {
  type: "patron_backing";
  playerId: string;
  targetFactionId: FactionId;
  investmentAmount: number;  // Influence points committed
  benefit: PatronBenefit;
}

type PatronBenefit =
  | "resource_bonus"         // +10 to one resource per era
  | "reputation_shield"      // Reputation cannot drop below 30 while patron active
  | "negotiation_edge";      // +15 to all negotiation rolls for 2 eras
```

### `[DATA]` GameState

```typescript
interface GameState {
  gameId: string;
  seed: string;              // Random seed for reproducibility
  epoch: Epoch;
  currentTurn: number;
  currentEra: number;        // Era = every 5 turns
  phase: GamePhase;
  territories: Record<string, Territory>;
  factions: Record<FactionId, Faction>;
  alliances: Alliance[];
  eventDeck: HistoricalEvent[];   // Shuffled at game start
  eventDiscard: HistoricalEvent[];
  activeEvents: ActiveEvent[];    // Currently in effect
  playerStates: Record<string, PlayerState>;
  history: TurnRecord[];          // Append-only audit log
  winner: FactionId | null;
}

interface ActiveEvent {
  event: HistoricalEvent;
  activatedOnTurn: number;
  expiresOnTurn: number | null;   // null = permanent
}

type GamePhase =
  | "setup"
  | "event_reveal"
  | "player_actions"          // Bet / Roll / Back window
  | "agent_deliberation"
  | "agent_negotiation"
  | "agent_action"
  | "resolution"
  | "era_summary"             // Fires every 5 turns
  | "game_over";

interface PlayerState {
  playerId: string;
  influencePoints: number;    // Currency for all player actions
  currentDrawnCard: HistoricalEvent | null;  // Secret until played
  bets: BetAction[];
  patronCommitments: PatronAction[];
  actionsThisTurn: PlayerAction[];
}

interface TurnRecord {
  turn: number;
  era: number;
  phase: GamePhase;
  events: string[];           // Human-readable log entries
  agentDecisions: AgentDecision[];
  stateSnapshot: Partial<GameState>;
}

interface AgentDecision {
  agentId: string;
  factionId: FactionId;
  action: AgentAction;
  rationale: string;          // Plain-language explanation for UI display
}
```

### `[DATA]` Epoch

```typescript
interface Epoch {
  id: string;
  name: string;               // e.g. "1914 — The World at the Brink"
  year: number;
  description: string;
  startingTerritoryControl: Record<string, FactionId>;  // Pre-assigned at epoch start
  startingStrengths: Record<string, number>;
  eventPool: string[];        // Event IDs valid for this epoch
  unlockCondition: UnlockCondition | null;  // null = available from start
}

// [RULE] MVP ships with 3 epochs. Additional epochs are unlocked by win conditions.
// Starting epochs: "1914_brink", "1945_aftermath", "1991_unipolar"
```

---

## 2. Game Setup

### `[IMPLEMENT]` `initializeGame(config: GameConfig): GameState`

```typescript
interface GameConfig {
  epochId: string;
  factionCount: 2 | 3 | 4;
  players: PlayerConfig[];
  eventPackIds: string[];     // ["base"] for MVP; community packs added later
  seed?: string;              // Optional fixed seed for replays
}

interface PlayerConfig {
  playerId: string;
  displayName: string;
  startingInfluencePoints: number;  // Default: 100
}
```

**Setup steps (implement in order):**

1. Load epoch data and apply `startingTerritoryControl` and `startingStrengths` to all territories
2. Assign 2–4 agents to each faction with randomized `PersonalityProfile` values (uniform random within 0.2–0.8 per trait)
3. Shuffle the event deck using the game seed — events are drawn in shuffle order, never random mid-game
4. Deal each player one face-down event card from the top of the deck (their starting `currentDrawnCard`)
5. Calculate and store opening odds for all available `BetType` values (see Odds Engine)
6. Set `phase = "player_actions"` for the first turn (no event reveal on turn 1)

### `[RULE]` Faction Starting Validity

Before finalizing setup, verify no faction starts with more than 60% calculated territorial advantage over any other faction. If the seed produces an imbalanced starting state, increment the seed by 1 and retry. Max 10 retries before surfacing an error.

Advantage formula:
```
advantage(faction) = (territories_controlled * 0.5) + (total_strength / global_strength * 0.3) + (total_resources / global_resources * 0.2)
```

---

## 3. Turn Structure

Each turn progresses through phases in strict order. No phase may be skipped.

```
[event_reveal] → [player_actions] → [agent_deliberation] → [agent_negotiation] → [agent_action] → [resolution] → (if turn % 5 == 0: [era_summary])
```

### Phase 1 — Event Reveal

- Draw the top card from `eventDeck` and display it publicly (this is a *world event*, separate from player cards)
- Apply `effects` immediately; queue `rippleEffects` to fire at the start of the next era
- Append event to `history`
- **Skip on turn 1**

### Phase 2 — Player Actions Window

**Duration:** All players act simultaneously. Turn timer: 60 seconds (configurable).

Each player may perform **up to one action per action type per turn:**
- Place or update one bet
- Play their drawn event card (optional — card expires at era end if unplayed)
- Make or increase one patron commitment

**`[RULE]` Influence Point Costs:**

| Action | Cost |
|--------|------|
| Place a bet | 0 (free; stake deducted on loss) |
| Play event card (Tier 1) | 10 IP |
| Play event card (Tier 2) | 25 IP |
| Play event card (Tier 3) | 50 IP |
| Patron — resource_bonus | 20 IP per era |
| Patron — reputation_shield | 30 IP per era |
| Patron — negotiation_edge | 40 IP per 2 eras |

**`[RULE]` Influence Point Earnings per turn:**
- Base: +5 IP
- Backed faction gained territory this turn: +3 IP
- Backed faction formed a new alliance: +2 IP
- Played event card that affected 3+ territories: +5 IP
- Any bet resolved this turn: +10 IP (win) or +2 IP (loss — consolation)

### Phase 3 — Agent Deliberation

Each agent independently evaluates the current `GameState` and produces an `AgentAction`. Deliberation is parallel (all agents deliberate simultaneously).

**`[IMPLEMENT]`** `agentDeliberate(agent: Agent, state: GameState): AgentAction`

```typescript
type AgentAction =
  | { type: "reinforce"; territoryId: string; amount: number }
  | { type: "attack"; fromTerritoryId: string; targetTerritoryId: string; strength: number }
  | { type: "propose_alliance"; targetFactionId: FactionId; terms: AllianceTerm[] }
  | { type: "break_alliance"; allianceId: string }
  | { type: "invest"; territoryId: string; resourceType: keyof ResourceBundle; amount: number }
  | { type: "pass" };
```

**Decision weights by archetype:**

| Archetype | Attack bias | Alliance bias | Invest bias | Reinforce bias |
|-----------|-------------|---------------|-------------|----------------|
| conqueror | 0.5 | 0.1 | 0.1 | 0.3 |
| diplomat  | 0.1 | 0.5 | 0.2 | 0.2 |
| economist | 0.1 | 0.2 | 0.5 | 0.2 |
| historian | 0.2 | 0.3 | 0.2 | 0.3 |

Weights are multiplied by the agent's `PersonalityProfile` aggression/loyalty values and the `patronBacking` bonus of their faction.

**`[RULE]`** Every `AgentAction` must produce a `rationale` string of 1–2 sentences in plain English explaining the decision. This is displayed in the UI and written to the audit log.

### Phase 4 — Agent Negotiation

Agents broadcast and respond to `propose_alliance` actions via SPLT structured messaging.

**`[IMPLEMENT]`** `resolveNegotiations(proposals: AgentAction[], state: GameState): Alliance[]`

Negotiation resolution:
1. Group all `propose_alliance` actions by target faction
2. For each proposal, calculate acceptance probability:
   ```
   p_accept = base_trust(proposer, target) * loyalty_factor * reputation_factor * patron_factor
   base_trust = 0.5 (default) | modified by InteractionMemory
   loyalty_factor = target.personality.loyalty
   reputation_factor = proposer.faction.reputation / 100
   patron_factor = 1.0 + (target.faction.patronBacking / 500)
   ```
3. Roll against `p_accept` — if accepted, create new `Alliance`
4. **`[RULE]`** A faction may not be in more than 3 active alliances simultaneously
5. Append all negotiation outcomes to `history` with rationale strings

### Phase 5 — Agent Action

Execute all `AgentAction` values that are not alliance proposals.

**`[IMPLEMENT]`** `resolveActions(actions: AgentAction[], state: GameState): GameState`

**Attack resolution:**
```
attacker_strength = territory.strength * attacker_army_size * (1 + faction.reputation/200)
defender_strength = territory.strength * (1 + alliance_defense_bonus)
alliance_defense_bonus = 0.15 per allied faction that controls an adjacent territory

outcome_roll = random(0, attacker_strength + defender_strength)
if outcome_roll <= attacker_strength: attacker wins
else: defender holds
```

**`[RULE]`** An agent may not attack a faction they have an active `non_aggression` or `defense_pact` alliance with. Attempting to do so automatically triggers `break_alliance` and applies a `-20` reputation penalty.

**`[RULE]`** Maximum one attack action per agent per turn in MVP.

### Phase 6 — Resolution

1. Apply all territory control changes from Phase 5
2. Recalculate all faction `resources` based on currently controlled territories
3. Fire any `rippleEffects` due this turn
4. Evaluate all active bets against current state — mark resolved bets, award IP
5. Apply patron benefit effects for active patron commitments
6. Drift agent personality values based on outcomes (see Agent Personality Drift)
7. Check win condition
8. Append full `TurnRecord` to `history`
9. Advance `currentTurn`

### `[IMPLEMENT]` Era Summary (every 5 turns)

Fire `phase = "era_summary"` between Resolution and the next Event Reveal.

Era summary must produce:
- `EraCard`: a structured object with territory delta, faction rankings, notable events, MVP agent
- A **narrative paragraph** (1–3 sentences) describing what happened this era in plain English — written as alternate history prose, past tense
- Replenish each player's drawn event card (draw new card from deck)
- Update `currentEra`

```typescript
interface EraCard {
  era: number;
  turns: number[];
  leaderFaction: FactionId;
  biggestGain: { factionId: FactionId; territoriesGained: number };
  biggestLoss: { factionId: FactionId; territoriesLost: number };
  alliancesFormed: number;
  alliancesBroken: number;
  eventsInjected: number;
  mvpAgent: { agentId: string; reason: string };
  narrativeSummary: string;
}
```

---

## 4. Win Condition

**`[RULE]`** A faction wins when it controls ≥ 70% of all territories for **2 consecutive eras**.

Check at the end of every era summary. If win condition is met:
1. Set `phase = "game_over"` and `winner = factionId`
2. Resolve all open bets
3. Calculate and award Director Scores to all players (see Player Scoring)
4. Generate final narrative export

**`[RULE]`** If no faction achieves 70% after 20 eras, the faction with the most territories at era 20 wins. Tiebreaker: highest `reputation` score.

---

## 5. Player Mechanics (The Three Interactions)

### 5.1 Betting System

**`[IMPLEMENT]`** `calculateOdds(betType: BetType, targetId: string, state: GameState): number`

Odds are expressed as a multiplier (e.g., 2.5 = 2.5× return on stake).

```
base_odds(faction_wins) = total_factions / territory_share
territory_share = faction.territories.length / total_territories
favorite_cap = 1.3x minimum (no faction pays out less than 1.3×)
underdog_floor = 8.0x maximum (no faction pays out more than 8×)
```

Odds update at the start of every turn. Players see live odds changes.

**`[RULE]`** A player may hold a maximum of 5 open bets at any time.

**`[RULE]`** A player may place a secondary (hedge) bet on a different faction mid-game, but at current odds, not opening odds.

**Side bet resolution triggers:**

| Bet Type | Resolves when |
|----------|--------------|
| `faction_wins` | Game over |
| `faction_controls_continent` | Faction achieves full continent control |
| `alliance_breaks` | Alliance status changes to "broken" |
| `first_continent` | First faction to control a full continent |
| `faction_eliminated` | Faction has 0 territories |

### 5.2 Event Injection (The Dice Roll)

Each player holds one face-down event card. The card identity is hidden until the moment it is played.

**`[RULE]`** The card is revealed and its effects are applied immediately in Phase 2.

**`[RULE]`** Cards expire at the end of the current era if not played — they are discarded without effect.

**`[RULE]`** A player may not play their card on Turn 1.

**Event Tiers:**

| Tier | Scope | Examples | IP Cost |
|------|-------|---------|---------|
| 1 | Local (1–2 territories) | "Famine hits the Nile Delta", "Gold rush in Siberia" | 10 |
| 2 | Regional (1 continent) | "Industrial Revolution arrives early in Asia", "Pandemic sweeps Europe" | 25 |
| 3 | Global (all factions affected) | "Byzantine Empire survives", "Mongol Empire never fragments", "Black Death averted" | 50 |

**`[RULE]`** Events are globally targeted — a player cannot aim an event at a specific faction. Timing is the only strategic variable.

**Multiplayer event veto (optional rule, configurable at game setup):**
- After a Tier 3 event card is revealed but before effects apply, other players have 10 seconds to vote veto
- If majority veto: event is discarded, player refunded 50% of IP cost
- If veto fails: event fires and all voters lose 5 IP

### 5.3 Patron Backing

**`[IMPLEMENT]`** `applyPatronBenefits(commitments: PatronAction[], state: GameState): GameState`

Patron benefits are passive and apply automatically each turn while the commitment is active.

**`[RULE]`** A player may only back one faction at a time.

**`[RULE]`** Switching patron targets costs 20 IP and removes all previously accumulated `patronBacking` from the old faction.

**`[RULE]`** `patronBacking` is a visible stat on the faction card. Other players can see which factions are heavily backed — this is intentional information asymmetry.

**Patron benefit effects:**
- `resource_bonus`: +10 to a randomly assigned resource in the faction's lowest-resource territory each era
- `reputation_shield`: faction reputation cannot drop below 30 while benefit is active; costs 30 IP/era
- `negotiation_edge`: all negotiation `p_accept` calculations for this faction get +0.15 for 2 eras

---

## 6. Agent Personality Drift

**`[IMPLEMENT]`** `driftPersonality(agent: Agent, turnRecord: TurnRecord): PersonalityProfile`

Apply at end of each turn's Resolution phase.

```
Rules (all clamped to 0.0–1.0):

if agent's faction lost a territory this turn:
  aggression += 0.05

if agent was betrayed (alliance broken by other party) this turn:
  aggression += 0.10
  loyalty -= 0.08

if agent's alliance held for 3+ eras:
  loyalty += 0.05

if agent's attack succeeded:
  aggression += 0.03
  expansionism += 0.04

if agent's attack failed:
  aggression -= 0.05
  riskTolerance -= 0.04

if faction reputation > 80:
  loyalty += 0.02

if faction reputation < 30:
  riskTolerance += 0.06  // desperate agents take bigger risks
```

---

## 7. Odds Engine

**`[IMPLEMENT]`** Full odds calculation runs at the start of Phase 2 every turn.

Store odds history — UI should display odds movement sparkline per faction.

```typescript
interface OddsSnapshot {
  turn: number;
  odds: Record<BetType, Record<string, number>>;  // betType → targetId → multiplier
}
```

---

## 8. Narrative Engine

**`[IMPLEMENT]`** `generateNarrativeSummary(eraCard: EraCard, history: TurnRecord[]): string`

Called once per era to produce the `narrativeSummary` field on `EraCard`.

The narrative must:
- Be written in past tense as alternate history prose
- Reference specific faction names and territories
- Mention the most impactful event of the era if one fired
- Be 2–4 sentences
- Not use game-mechanics language ("faction gained +3 strength") — use political/historical language ("the Eastern Coalition extended its dominion across the Caucasus")

At game end, concatenate all `EraCard.narrativeSummary` values into a full **Fork Chronicle** — a complete alternate history document. This is the primary shareable artifact.

---

## 9. Map Rendering Contract

**`[EXTENSIBLE]`** The map renderer consumes `GameState.territories` and renders territory control via faction colors.

```typescript
interface MapRenderPayload {
  territories: Record<string, {
    controlledBy: FactionId | null;
    strength: number;
    contested: boolean;
    activeEffects: string[];
  }>;
  factionColors: Record<FactionId, string>;
  highlightedTerritories?: string[];  // For event effect animations
}
```

The map component must support:
- Per-territory fill color (faction color or neutral gray)
- Strength indicator (opacity or border weight)
- Contested animation (pulse)
- Event effect highlight (brief color flash on affected territories)
- Click-to-inspect (returns territory details)

---

## 10. Extensibility Contracts

These interfaces are stable for v1 — third-party developers plug into them.

### `[EXTENSIBLE]` Custom Agent Strategy

```typescript
interface AgentStrategy {
  archetype: string;
  decisionWeights: Record<string, number>;
  deliberate(agent: Agent, state: GameState): AgentAction;
  reflect(agent: Agent, outcome: TurnRecord): PersonalityProfile;
}
```

### `[EXTENSIBLE]` Custom Event Pack

Event packs are JSON files conforming to `HistoricalEvent[]`. Required fields per event:
- `id`, `title`, `description`, `effects[]`, `tier` (1–3), `source`

Optional: `era`, `rippleEffects`, `probability`

Pack registry entry:
```json
{
  "packId": "cold_war_1947",
  "displayName": "Cold War Tensions",
  "author": "community",
  "epochCompatibility": ["1945_aftermath", "1991_unipolar"],
  "events": [...]
}
```

### `[EXTENSIBLE]` Custom Epoch

Epochs are JSON files conforming to `Epoch`. Required: `startingTerritoryControl` covering ≥80% of territories.

### `[EXTENSIBLE]` Custom Victory Condition

```typescript
interface VictoryCondition {
  id: string;
  label: string;
  evaluate(state: GameState): FactionId | null;  // returns winner or null
  description: string;
}
```

Register custom victory conditions in game config:
```typescript
interface GameConfig {
  // ...
  victoryConditionId?: string;  // defaults to "territory_majority"
}
```

---

## 11. Scorcerer Analytics Integration

Every `AgentDecision` must be written to the Scorcerer audit log with:
- `agentId`, `factionId`, `turn`, `era`
- `action` (full serialized `AgentAction`)
- `rationale` (plain English string)
- `stateHash` (hash of relevant `GameState` slice at decision time)

This enables full replay, counterfactual analysis, and agent performance scoring.

**`[IMPLEMENT]`** `exportChronicle(state: GameState): ForkChronicle`

```typescript
interface ForkChronicle {
  gameId: string;
  seed: string;
  epoch: string;
  totalTurns: number;
  winner: FactionId;
  winCondition: string;
  eraSummaries: EraCard[];
  fullNarrative: string;       // Concatenated era narratives
  playerScores: PlayerScore[];
  agentPerformance: AgentPerformanceReport[];
  replayData: TurnRecord[];    // Full state log for replay
}
```

---

## 12. Player Scoring

**`[IMPLEMENT]`** `calculatePlayerScore(player: PlayerState, state: GameState): PlayerScore`

```typescript
interface PlayerScore {
  playerId: string;
  influencePointsEarned: number;
  betsWon: number;
  betsLost: number;
  netBettingReturn: number;         // IP won minus IP wagered
  patronEffectiveness: number;      // % of turns patron faction gained territory
  eventsInjected: number;
  tier3EventsPlayed: number;
  directorTitle: DirectorTitle;     // See below
  totalScore: number;
}

type DirectorTitle =
  | "the_kingmaker"    // Won primarily through patron backing
  | "the_arsonist"     // Injected 3+ Tier 3 events
  | "the_oracle"       // Won 4+ bets in a single game
  | "the_historian"    // Backed the winning faction from turn 1
  | "the_contrarian"   // Backed an underdog (opening odds > 4.0) that won
  | "the_patron"       // Patron-backed faction won the game
  | "the_director";    // Default title
```

---

## 13. MVP Event Pack — Base Set

The base event pack ships with 15 events across all 3 tiers. Each event below is a seed for implementation — expand descriptions and effects as needed.

**Tier 1 (Local):**
1. `nile_famine` — Famine in Northeast Africa: -20 food to Egypt and Sudan territories
2. `siberian_gold` — Gold discovery: +30 industry to Russia Far East
3. `balkan_uprising` — Political unrest: -15 strength to 2 Balkan territories, both become contested
4. `silk_road_revival` — Trade route reopens: +15 tech and +10 food to Central Asia territories
5. `volcanic_eruption` — Natural disaster: -25 strength to Indonesia; -10 food to neighboring territories

**Tier 2 (Regional):**
6. `early_industrialization_asia` — Industry arrives early: +25 tech to all Asian territories not already at tech > 70
7. `european_pandemic` — Disease sweeps Europe: -20 strength to all European territories; alliances tested (each European alliance has 30% chance of straining: -15 trustScore)
8. `african_union_early` — Political unification movement: all African territories gain +10 reputation modifier; coordinated defense bonus +0.1
9. `american_isolation` — Americas withdraw: all North and South American territories gain +5 strength but lose -20 to any active alliance trust scores with non-American factions
10. `middle_east_oil_boom` — Resource surge: +40 industry to all Middle East territories; immediately recalculate faction resources

**Tier 3 (Global):**
11. `byzantine_survives` — Byzantine Empire endures: transfer control of Turkey, Greece, and Bulgaria to a new "Byzantine" neutral zone; all factions must renegotiate adjacency
12. `mongol_unity` — Mongol Empire holds: +30 strength to all Central Asian and East European territories; a new faction spawns if no faction currently controls the region
13. `black_death_averted` — Disease never comes: +20 population/food to all European and Middle Eastern territories; Europe tech modifier +15 permanent
14. `early_ai_1950` — Artificial intelligence emerges in 1950: +40 tech globally; historian-archetype agents gain +0.2 to all decision weights for 3 eras
15. `climate_crisis_accelerated` — Environmental collapse: all coastal territories lose -15 strength per era; interior territories gain +10 food as agriculture shifts inland

---

## 14. Implementation Order (Suggested for Claude Code)

Implement in this order to reach a playable state as fast as possible:

1. **Data types** — implement all interfaces from Section 1
2. **`initializeGame`** — setup + seed validation (Section 2)
3. **Turn loop skeleton** — phase progression without agent logic (Section 3 structure)
4. **Territory control + attack resolution** — Phase 5 combat (Section 3, Phase 5)
5. **Win condition check** (Section 4)
6. **Agent deliberation (rule-based)** — implement `agentDeliberate` with archetype weights, no LLM yet (Section 3, Phase 3)
7. **Negotiation resolution** (Section 3, Phase 4)
8. **Betting system + odds engine** (Sections 5.1 and 7)
9. **Event injection** (Section 5.2) + base event pack (Section 13)
10. **Patron backing** (Section 5.3)
11. **Personality drift** (Section 6)
12. **Era summary + narrative engine** (Section 3, Era Summary)
13. **Scorcerer integration + Fork Chronicle export** (Section 11)
14. **Map rendering contract** (Section 9)
15. **Player scoring + Director titles** (Section 12)
16. **Extensibility interfaces** — formalize and document (Section 10)

---

## 15. Open Questions (Resolve Before v1.1)

These are intentionally deferred from MVP:

- [ ] Real-time vs turn-based toggle — MVP is turn-based; real-time is a future mode
- [ ] LLM-powered agent deliberation — MVP uses rule-based weights; LLM integration is v1.1
- [ ] Wikipedia event sourcing pipeline — base event pack is hardcoded; live Wikipedia pull is future
- [ ] Future projection mode (news feed → events) — post-MVP
- [ ] Multiplayer synchronization — MVP supports local/async; real-time multiplayer sync is v1.1
- [ ] Mobile map rendering — desktop first
- [ ] Community event pack registry — designed for in Section 10 but not implemented in MVP

---

## 16. Claude Code Handoff Guide

> **This section is for the human handing off this document — not for Claude Code to implement.**

### Recommended Project Setup

Before opening Claude Code, create the following folder structure and paste this file into the root:

```
fork-chronicle/
├── fork_chronicle_mvp.md     ← this file
├── src/
│   ├── types/                ← Section 1 schemas go here
│   ├── engine/               ← Core game loop (Sections 2–6)
│   ├── player/               ← Human interaction systems (Section 5)
│   ├── narrative/            ← Narrative + era summary (Section 8)
│   ├── analytics/            ← Scorcerer integration (Section 11)
│   └── extensions/           ← Extensibility interfaces (Section 10)
├── data/
│   ├── epochs/               ← Epoch JSON files
│   ├── events/               ← Event pack JSON files
│   └── territories/          ← Territory adjacency + starting data
└── tests/
```

### Opening Prompt for Claude Code

Copy and paste this exactly:

```
Read fork_chronicle_mvp.md in full before writing any code.

This is the complete game design spec for Fork: A Chronicle of Alternate Histories.
Build the project using TypeScript. Use the folder structure in Section 16.

Follow the implementation order in Section 14 exactly — do not skip ahead.
Treat all [RULE] tags as enforced invariants: throw a descriptive error if any rule
is violated at runtime.

Start with Step 1: implement all TypeScript interfaces from Section 1 into src/types/.
Create one file per major data type (territory.ts, faction.ts, agent.ts, event.ts,
player.ts, game-state.ts). Export all types from a single src/types/index.ts barrel.

Do not implement game logic yet. Types only. Confirm when done.
```

### Why Step-by-Step Matters

Claude Code performs significantly better when given one section at a time rather than
asked to build everything at once. After each step is confirmed, use the following
continuation prompts:

**After Step 1 (types):**
```
Types look good. Now implement Step 2: initializeGame() from Section 2.
Include the seed validation and faction balance check. Add unit tests in tests/setup.test.ts.
```

**After Step 2 (setup):**
```
Now implement Step 3: the turn loop skeleton from Section 3.
Phase progression only — no agent logic yet. Each phase should log its name
and advance state. Add a runGame() entry point that loops until phase = "game_over".
```

**After Step 3 (turn loop):**
```
Now implement Step 4: territory control and attack resolution from Section 3 Phase 5.
Use the exact formula provided. Add tests covering: attacker wins, defender holds,
alliance defense bonus, and the rule that breaks alliance on friendly-fire attack.
```

Continue this pattern through all 16 steps in Section 14.

### Key Things to Tell Claude Code Upfront

- **Language:** TypeScript throughout. Python only if explicitly noted.
- **No LLM calls in MVP:** Agent deliberation in Step 6 is rule-based weights only.
  Do not make any API calls for agent decisions in v1.
- **[RULE] tags are hard constraints:** Every `[RULE]` must be enforced with a
  thrown error and a descriptive message, not silently ignored.
- **[EXTENSIBLE] tags are interfaces:** These must be defined as TypeScript interfaces
  or abstract classes with clear extension points — not implemented as closed classes.
- **Seed reproducibility is required:** The same seed must produce the identical game
  every time. All randomness must route through a single seeded RNG instance.
- **Audit log is non-negotiable:** Every AgentDecision must be written to the history
  array. Do not skip this for performance reasons in MVP.

### Data Files to Create Manually

Claude Code cannot source these from Wikipedia — create them as static JSON before
handing off:

1. **territories.json** — ~50 key countries with adjacencies, starting strength 
   (1–100), and resource bundles. Prioritize coverage of all 6 continents.
   At minimum include: USA, RUS, CHN, GBR, FRA, DEU, BRA, IND, JPN, EGY, NGA,
   AUS, SAU, TUR, MEX, ARG, ZAF, IDN, PAK, IRN.

2. **epoch_1914.json**, **epoch_1945.json**, **epoch_1991.json** — starting territory
   control assignments per the three base epochs. Research approximate great-power
   control at each date for the 50 territories.

3. **events_base.json** — the 15 events from Section 13 fully fleshed out with all
   required fields per the HistoricalEvent schema.

### Testing Strategy to Request

After Step 4, ask Claude Code to maintain a test suite covering:
- Seed reproducibility: same seed → same game state after 10 turns
- Rule enforcement: each [RULE] has at least one test that verifies the error throws
- Win condition: a synthetic game state that triggers the 70% / 2-era win condition
- Odds calculation: underdog odds always > favorite odds; no value outside 1.3–8.0×
- Personality drift: all trait values stay clamped to 0.0–1.0 after 20 turns of drift

### Repo and Open Source Setup

Once the MVP is working:

1. Create GitHub repo: `summoner-network/fork-chronicle`
2. Add `CONTRIBUTING.md` explaining the three extension points from Section 10
   (custom agents, event packs, epochs)
3. Add `events/` and `epochs/` as the community contribution targets
4. Tag the first working build as `v0.1.0-mvp`
