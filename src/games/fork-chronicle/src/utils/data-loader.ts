/**
 * Data loading utilities for Fork: A Chronicle of Alternate Histories
 */

import type { Territory } from "../types/territory";
import type { Epoch } from "../types/epoch";
import type { HistoricalEvent } from "../types/event";

// Data is inlined for MVP to avoid JSON import issues
// In production, this would load from the file system or API

const territoriesData: Territory[] = [
  // NORTH AMERICA (9 territories)
  {
    "id": "USA",
    "name": "United States",
    "continent": "north_america",
    "adjacencies": ["CAN", "MEX", "CUB"],
    "resources": { "food": 70, "industry": 80, "tech": 85 },
    "strength": 75,
    "controlledBy": null,
    "contestedBy": null,
    "historicalModifiers": []
  },
  {
    "id": "CAN",
    "name": "Canada",
    "continent": "north_america",
    "adjacencies": ["USA"],
    "resources": { "food": 60, "industry": 55, "tech": 70 },
    "strength": 45,
    "controlledBy": null,
    "contestedBy": null,
    "historicalModifiers": []
  },
  {
    "id": "MEX",
    "name": "Mexico",
    "continent": "north_america",
    "adjacencies": ["USA", "GTM"],
    "resources": { "food": 55, "industry": 45, "tech": 40 },
    "strength": 35,
    "controlledBy": null,
    "contestedBy": null,
    "historicalModifiers": []
  },
  {
    "id": "GTM",
    "name": "Guatemala",
    "continent": "north_america",
    "adjacencies": ["MEX", "PAN"],
    "resources": { "food": 40, "industry": 25, "tech": 20 },
    "strength": 20,
    "controlledBy": null,
    "contestedBy": null,
    "historicalModifiers": []
  },
  {
    "id": "CUB",
    "name": "Cuba",
    "continent": "north_america",
    "adjacencies": ["USA", "HTI", "DOM"],
    "resources": { "food": 35, "industry": 25, "tech": 25 },
    "strength": 25,
    "controlledBy": null,
    "contestedBy": null,
    "historicalModifiers": []
  },
  {
    "id": "DOM",
    "name": "Dominican Republic",
    "continent": "north_america",
    "adjacencies": ["CUB", "HTI"],
    "resources": { "food": 30, "industry": 20, "tech": 20 },
    "strength": 15,
    "controlledBy": null,
    "contestedBy": null,
    "historicalModifiers": []
  },
  {
    "id": "HTI",
    "name": "Haiti",
    "continent": "north_america",
    "adjacencies": ["CUB", "DOM"],
    "resources": { "food": 25, "industry": 15, "tech": 15 },
    "strength": 15,
    "controlledBy": null,
    "contestedBy": null,
    "historicalModifiers": []
  },
  {
    "id": "PAN",
    "name": "Panama",
    "continent": "north_america",
    "adjacencies": ["GTM", "CRI", "COL"],
    "resources": { "food": 30, "industry": 30, "tech": 25 },
    "strength": 20,
    "controlledBy": null,
    "contestedBy": null,
    "historicalModifiers": []
  },
  {
    "id": "CRI",
    "name": "Costa Rica",
    "continent": "north_america",
    "adjacencies": ["PAN"],
    "resources": { "food": 35, "industry": 25, "tech": 30 },
    "strength": 20,
    "controlledBy": null,
    "contestedBy": null,
    "historicalModifiers": []
  },

  // EUROPE (7 territories)
  {
    "id": "GBR",
    "name": "United Kingdom",
    "continent": "europe",
    "adjacencies": ["FRA", "DEU", "ESP"],
    "resources": { "food": 50, "industry": 75, "tech": 80 },
    "strength": 65,
    "controlledBy": null,
    "contestedBy": null,
    "historicalModifiers": []
  },
  {
    "id": "FRA",
    "name": "France",
    "continent": "europe",
    "adjacencies": ["GBR", "DEU", "ESP", "ITA"],
    "resources": { "food": 65, "industry": 70, "tech": 75 },
    "strength": 60,
    "controlledBy": null,
    "contestedBy": null,
    "historicalModifiers": []
  },
  {
    "id": "DEU",
    "name": "Germany",
    "continent": "europe",
    "adjacencies": ["GBR", "FRA", "POL", "RUS"],
    "resources": { "food": 60, "industry": 85, "tech": 80 },
    "strength": 70,
    "controlledBy": null,
    "contestedBy": null,
    "historicalModifiers": []
  },
  {
    "id": "RUS",
    "name": "Russia",
    "continent": "europe",
    "adjacencies": ["DEU", "POL", "KAZ", "MNG"],
    "resources": { "food": 55, "industry": 60, "tech": 55 },
    "strength": 80,
    "controlledBy": null,
    "contestedBy": null,
    "historicalModifiers": []
  },
  {
    "id": "POL",
    "name": "Poland",
    "continent": "europe",
    "adjacencies": ["DEU", "RUS"],
    "resources": { "food": 50, "industry": 45, "tech": 50 },
    "strength": 40,
    "controlledBy": null,
    "contestedBy": null,
    "historicalModifiers": []
  },
  {
    "id": "ESP",
    "name": "Spain",
    "continent": "europe",
    "adjacencies": ["GBR", "FRA", "MAR"],
    "resources": { "food": 55, "industry": 50, "tech": 55 },
    "strength": 45,
    "controlledBy": null,
    "contestedBy": null,
    "historicalModifiers": []
  },
  {
    "id": "ITA",
    "name": "Italy",
    "continent": "europe",
    "adjacencies": ["FRA", "EGY"],
    "resources": { "food": 60, "industry": 65, "tech": 60 },
    "strength": 50,
    "controlledBy": null,
    "contestedBy": null,
    "historicalModifiers": []
  },

  // ASIA (12 territories)
  {
    "id": "CHN",
    "name": "China",
    "continent": "asia",
    "adjacencies": ["MNG", "VNM", "THA", "IND", "PAK"],
    "resources": { "food": 70, "industry": 55, "tech": 50 },
    "strength": 75,
    "controlledBy": null,
    "contestedBy": null,
    "historicalModifiers": []
  },
  {
    "id": "IND",
    "name": "India",
    "continent": "asia",
    "adjacencies": ["CHN", "PAK", "THA"],
    "resources": { "food": 75, "industry": 45, "tech": 50 },
    "strength": 60,
    "controlledBy": null,
    "contestedBy": null,
    "historicalModifiers": []
  },
  {
    "id": "JPN",
    "name": "Japan",
    "continent": "asia",
    "adjacencies": ["MNG"],
    "resources": { "food": 45, "industry": 75, "tech": 80 },
    "strength": 65,
    "controlledBy": null,
    "contestedBy": null,
    "historicalModifiers": []
  },
  {
    "id": "MNG",
    "name": "Mongolia",
    "continent": "asia",
    "adjacencies": ["RUS", "CHN", "JPN", "KAZ"],
    "resources": { "food": 35, "industry": 30, "tech": 25 },
    "strength": 30,
    "controlledBy": null,
    "contestedBy": null,
    "historicalModifiers": []
  },
  {
    "id": "KAZ",
    "name": "Kazakhstan",
    "continent": "asia",
    "adjacencies": ["RUS", "MNG", "IRN"],
    "resources": { "food": 40, "industry": 45, "tech": 35 },
    "strength": 35,
    "controlledBy": null,
    "contestedBy": null,
    "historicalModifiers": []
  },
  {
    "id": "IRN",
    "name": "Iran",
    "continent": "asia",
    "adjacencies": ["KAZ", "IRQ", "PAK", "TUR"],
    "resources": { "food": 45, "industry": 50, "tech": 40 },
    "strength": 45,
    "controlledBy": null,
    "contestedBy": null,
    "historicalModifiers": []
  },
  {
    "id": "SAU",
    "name": "Saudi Arabia",
    "continent": "asia",
    "adjacencies": ["IRQ", "EGY"],
    "resources": { "food": 30, "industry": 70, "tech": 45 },
    "strength": 50,
    "controlledBy": null,
    "contestedBy": null,
    "historicalModifiers": []
  },
  {
    "id": "IRQ",
    "name": "Iraq",
    "continent": "asia",
    "adjacencies": ["SAU", "IRN", "TUR"],
    "resources": { "food": 35, "industry": 55, "tech": 35 },
    "strength": 40,
    "controlledBy": null,
    "contestedBy": null,
    "historicalModifiers": []
  },
  {
    "id": "PAK",
    "name": "Pakistan",
    "continent": "asia",
    "adjacencies": ["IRN", "IND", "CHN"],
    "resources": { "food": 50, "industry": 35, "tech": 30 },
    "strength": 40,
    "controlledBy": null,
    "contestedBy": null,
    "historicalModifiers": []
  },
  {
    "id": "TUR",
    "name": "Turkey",
    "continent": "asia",
    "adjacencies": ["IRQ", "IRN", "EGY"],
    "resources": { "food": 55, "industry": 50, "tech": 50 },
    "strength": 55,
    "controlledBy": null,
    "contestedBy": null,
    "historicalModifiers": []
  },
  {
    "id": "VNM",
    "name": "Vietnam",
    "continent": "asia",
    "adjacencies": ["CHN", "THA"],
    "resources": { "food": 60, "industry": 30, "tech": 25 },
    "strength": 35,
    "controlledBy": null,
    "contestedBy": null,
    "historicalModifiers": []
  },
  {
    "id": "THA",
    "name": "Thailand",
    "continent": "asia",
    "adjacencies": ["CHN", "VNM", "IND"],
    "resources": { "food": 55, "industry": 35, "tech": 30 },
    "strength": 35,
    "controlledBy": null,
    "contestedBy": null,
    "historicalModifiers": []
  },

  // SOUTH AMERICA (4 territories)
  {
    "id": "BRA",
    "name": "Brazil",
    "continent": "south_america",
    "adjacencies": ["ARG", "COL", "PER"],
    "resources": { "food": 75, "industry": 50, "tech": 45 },
    "strength": 50,
    "controlledBy": null,
    "contestedBy": null,
    "historicalModifiers": []
  },
  {
    "id": "ARG",
    "name": "Argentina",
    "continent": "south_america",
    "adjacencies": ["BRA", "PER"],
    "resources": { "food": 70, "industry": 45, "tech": 50 },
    "strength": 45,
    "controlledBy": null,
    "contestedBy": null,
    "historicalModifiers": []
  },
  {
    "id": "PER",
    "name": "Peru",
    "continent": "south_america",
    "adjacencies": ["BRA", "ARG", "COL"],
    "resources": { "food": 50, "industry": 35, "tech": 30 },
    "strength": 30,
    "controlledBy": null,
    "contestedBy": null,
    "historicalModifiers": []
  },
  {
    "id": "COL",
    "name": "Colombia",
    "continent": "south_america",
    "adjacencies": ["BRA", "PER", "PAN"],
    "resources": { "food": 55, "industry": 40, "tech": 35 },
    "strength": 35,
    "controlledBy": null,
    "contestedBy": null,
    "historicalModifiers": []
  },

  // AFRICA (6 territories)
  {
    "id": "EGY",
    "name": "Egypt",
    "continent": "africa",
    "adjacencies": ["SAU", "TUR", "ITA", "ETH"],
    "resources": { "food": 50, "industry": 35, "tech": 40 },
    "strength": 40,
    "controlledBy": null,
    "contestedBy": null,
    "historicalModifiers": []
  },
  {
    "id": "NGA",
    "name": "Nigeria",
    "continent": "africa",
    "adjacencies": ["MAR", "COD"],
    "resources": { "food": 55, "industry": 40, "tech": 30 },
    "strength": 35,
    "controlledBy": null,
    "contestedBy": null,
    "historicalModifiers": []
  },
  {
    "id": "ZAF",
    "name": "South Africa",
    "continent": "africa",
    "adjacencies": ["COD"],
    "resources": { "food": 60, "industry": 55, "tech": 50 },
    "strength": 45,
    "controlledBy": null,
    "contestedBy": null,
    "historicalModifiers": []
  },
  {
    "id": "COD",
    "name": "Congo",
    "continent": "africa",
    "adjacencies": ["NGA", "ZAF", "ETH"],
    "resources": { "food": 45, "industry": 30, "tech": 20 },
    "strength": 25,
    "controlledBy": null,
    "contestedBy": null,
    "historicalModifiers": []
  },
  {
    "id": "ETH",
    "name": "Ethiopia",
    "continent": "africa",
    "adjacencies": ["EGY", "COD"],
    "resources": { "food": 40, "industry": 25, "tech": 20 },
    "strength": 25,
    "controlledBy": null,
    "contestedBy": null,
    "historicalModifiers": []
  },
  {
    "id": "MAR",
    "name": "Morocco",
    "continent": "africa",
    "adjacencies": ["ESP", "NGA"],
    "resources": { "food": 45, "industry": 35, "tech": 30 },
    "strength": 30,
    "controlledBy": null,
    "contestedBy": null,
    "historicalModifiers": []
  },

  // OCEANIA (4 territories)
  {
    "id": "AUS",
    "name": "Australia",
    "continent": "oceania",
    "adjacencies": ["NZL", "PNG"],
    "resources": { "food": 65, "industry": 60, "tech": 70 },
    "strength": 50,
    "controlledBy": null,
    "contestedBy": null,
    "historicalModifiers": []
  },
  {
    "id": "NZL",
    "name": "New Zealand",
    "continent": "oceania",
    "adjacencies": ["AUS"],
    "resources": { "food": 60, "industry": 50, "tech": 65 },
    "strength": 40,
    "controlledBy": null,
    "contestedBy": null,
    "historicalModifiers": []
  },
  {
    "id": "PNG",
    "name": "Papua New Guinea",
    "continent": "oceania",
    "adjacencies": ["AUS", "FJI"],
    "resources": { "food": 45, "industry": 25, "tech": 20 },
    "strength": 20,
    "controlledBy": null,
    "contestedBy": null,
    "historicalModifiers": []
  },
  {
    "id": "FJI",
    "name": "Fiji",
    "continent": "oceania",
    "adjacencies": ["PNG"],
    "resources": { "food": 40, "industry": 20, "tech": 25 },
    "strength": 15,
    "controlledBy": null,
    "contestedBy": null,
    "historicalModifiers": []
  }
];

const eventsData: HistoricalEvent[] = [
  // TIER 1: Local Events (10 IP)
  {
    "id": "nile_famine",
    "title": "Famine in the Nile Delta",
    "description": "A devastating drought strikes Northeast Africa, crippling food production.",
    "era": null,
    "source": "historical",
    "tier": 1,
    "ipCost": 10,
    "effects": [
      {
        "type": "resource_delta",
        "targetType": "territory",
        "targetId": "EGY",
        "magnitude": -20,
        "description": "Egypt loses 20 food"
      }
    ],
    "rippleEffects": [],
    "probability": 0.15
  },
  {
    "id": "siberian_gold",
    "title": "Siberian Gold Rush",
    "description": "Vast gold deposits discovered in the Russian Far East spark an industrial boom.",
    "era": null,
    "source": "historical",
    "tier": 1,
    "ipCost": 10,
    "effects": [
      {
        "type": "resource_delta",
        "targetType": "territory",
        "targetId": "RUS",
        "magnitude": 30,
        "description": "Russia gains 30 industry"
      }
    ],
    "rippleEffects": [],
    "probability": 0.12
  },
  {
    "id": "balkan_uprising",
    "title": "Balkan Political Unrest",
    "description": "Revolutionary movements sweep through the Balkans, destabilizing the region.",
    "era": null,
    "source": "historical",
    "tier": 1,
    "ipCost": 10,
    "effects": [
      {
        "type": "strength_delta",
        "targetType": "territory",
        "targetId": "POL",
        "magnitude": -15,
        "description": "Poland loses 15 strength"
      }
    ],
    "rippleEffects": [],
    "probability": 0.18
  },
  {
    "id": "panama_canal",
    "title": "Panama Canal Opens Early",
    "description": "Engineering breakthroughs accelerate the canal's completion, revolutionizing global trade routes.",
    "era": null,
    "source": "counterfactual",
    "tier": 1,
    "ipCost": 10,
    "effects": [
      {
        "type": "resource_delta",
        "targetType": "territory",
        "targetId": "PAN",
        "magnitude": 40,
        "description": "Panama gains 40 industry"
      },
      {
        "type": "strength_delta",
        "targetType": "territory",
        "targetId": "PAN",
        "magnitude": 20,
        "description": "Panama gains 20 strength"
      }
    ],
    "rippleEffects": [],
    "probability": 0.10
  },
  {
    "id": "australian_gold",
    "title": "Australian Gold Boom",
    "description": "Massive gold strikes in Western Australia attract global investment and immigration.",
    "era": null,
    "source": "historical",
    "tier": 1,
    "ipCost": 10,
    "effects": [
      {
        "type": "resource_delta",
        "targetType": "territory",
        "targetId": "AUS",
        "magnitude": 35,
        "description": "Australia gains 35 industry"
      }
    ],
    "rippleEffects": [],
    "probability": 0.12
  },

  // TIER 2: Regional Events (25 IP)
  {
    "id": "great_war_avoided",
    "title": "The Great War Averted",
    "description": "Diplomatic miracles prevent the cascade of alliances from igniting a European conflagration.",
    "era": null,
    "source": "counterfactual",
    "tier": 2,
    "ipCost": 25,
    "effects": [
      {
        "type": "reputation_delta",
        "targetType": "global",
        "magnitude": 10,
        "description": "All factions gain 10 reputation"
      },
      {
        "type": "strength_delta",
        "targetType": "global",
        "magnitude": -10,
        "description": "All territories lose 10 strength (demilitarization)"
      }
    ],
    "rippleEffects": [
      {
        "type": "resource_delta",
        "targetType": "global",
        "magnitude": 15,
        "description": "All territories gain 15 industry (peace dividend)"
      }
    ],
    "probability": 0.08
  },
  {
    "id": "spanish_flu_early",
    "title": "Spanish Flu Strikes Early",
    "description": "A devastating pandemic sweeps the globe years ahead of schedule, crippling economies.",
    "era": null,
    "source": "counterfactual",
    "tier": 2,
    "ipCost": 25,
    "effects": [
      {
        "type": "resource_delta",
        "targetType": "global",
        "magnitude": -15,
        "description": "All territories lose 15 food"
      },
      {
        "type": "strength_delta",
        "targetType": "global",
        "magnitude": -20,
        "description": "All territories lose 20 strength"
      }
    ],
    "rippleEffects": [],
    "probability": 0.05
  },
  {
    "id": "oil_discovered_persia",
    "title": "Persian Oil Discovery",
    "description": "Vast petroleum reserves are discovered in Persia, reshaping the geopolitics of energy.",
    "era": null,
    "source": "historical",
    "tier": 2,
    "ipCost": 25,
    "effects": [
      {
        "type": "resource_delta",
        "targetType": "territory",
        "targetId": "IRN",
        "magnitude": 60,
        "description": "Iran gains 60 industry"
      }
    ],
    "rippleEffects": [
      {
        "type": "reputation_delta",
        "targetType": "faction",
        "magnitude": 15,
        "description": "Controlling faction gains 15 reputation"
      }
    ],
    "probability": 0.10
  },
  {
    "id": "boxer_rebellion_success",
    "title": "Boxer Rebellion Succeeds",
    "description": "The Boxers expel foreign powers from China, ushering in a new era of isolationism.",
    "era": null,
    "source": "counterfactual",
    "tier": 2,
    "ipCost": 25,
    "effects": [
      {
        "type": "strength_delta",
        "targetType": "territory",
        "targetId": "CHN",
        "magnitude": 30,
        "description": "China gains 30 strength"
      },
      {
        "type": "reputation_delta",
        "targetType": "faction",
        "magnitude": 20,
        "description": "Controlling faction gains 20 reputation"
      }
    ],
    "rippleEffects": [
      {
        "type": "resource_delta",
        "targetType": "territory",
        "targetId": "CHN",
        "magnitude": -25,
        "description": "China loses 25 tech (isolation)"
      }
    ],
    "probability": 0.07
  },
  {
    "id": "suez_collapse",
    "title": "Suez Canal Collapse",
    "description": "Catastrophic engineering failure closes the Suez Canal, rerouting global trade.",
    "era": null,
    "source": "counterfactual",
    "tier": 2,
    "ipCost": 25,
    "effects": [
      {
        "type": "resource_delta",
        "targetType": "territory",
        "targetId": "EGY",
        "magnitude": -40,
        "description": "Egypt loses 40 industry"
      },
      {
        "type": "strength_delta",
        "targetType": "territory",
        "targetId": "EGY",
        "magnitude": -15,
        "description": "Egypt loses 15 strength"
      }
    ],
    "rippleEffects": [
      {
        "type": "resource_delta",
        "targetType": "territory",
        "targetId": "ZAF",
        "magnitude": 30,
        "description": "South Africa gains 30 industry (alternate route)"
      }
    ],
    "probability": 0.06
  },

  // TIER 3: Global Events (50 IP)
  {
    "id": "early_radio",
    "title": "Radio Technology Breakthrough",
    "description": "Marconi's wireless telegraph evolves decades ahead of schedule, connecting the world instantly.",
    "era": null,
    "source": "counterfactual",
    "tier": 3,
    "ipCost": 50,
    "effects": [
      {
        "type": "resource_delta",
        "targetType": "global",
        "magnitude": 25,
        "description": "All territories gain 25 tech"
      },
      {
        "type": "reputation_delta",
        "targetType": "global",
        "magnitude": 5,
        "description": "All factions gain 5 reputation"
      }
    ],
    "rippleEffects": [
      {
        "type": "resource_delta",
        "targetType": "global",
        "magnitude": 15,
        "description": "All territories gain 15 industry (communications boom)"
      }
    ],
    "probability": 0.04
  },
  {
    "id": "meteor_siberia",
    "title": "Tunguska Event Devastates Russia",
    "description": "A massive meteor impact in Siberia causes widespread destruction and climate disruption.",
    "era": null,
    "source": "historical",
    "tier": 3,
    "ipCost": 50,
    "effects": [
      {
        "type": "resource_delta",
        "targetType": "territory",
        "targetId": "RUS",
        "magnitude": -50,
        "description": "Russia loses 50 industry"
      },
      {
        "type": "strength_delta",
        "targetType": "territory",
        "targetId": "RUS",
        "magnitude": -30,
        "description": "Russia loses 30 strength"
      },
      {
        "type": "resource_delta",
        "targetType": "global",
        "magnitude": -10,
        "description": "All territories lose 10 food (climate disruption)"
      }
    ],
    "rippleEffects": [
      {
        "type": "resource_delta",
        "targetType": "global",
        "magnitude": -15,
        "description": "All territories lose 15 food (prolonged winter)"
      }
    ],
    "probability": 0.03
  },
  {
    "id": "byzantine_survives",
    "title": "Byzantine Empire Survives",
    "description": "Constantinople never falls, and the Eastern Roman Empire endures into the modern age.",
    "era": null,
    "source": "counterfactual",
    "tier": 3,
    "ipCost": 50,
    "effects": [
      {
        "type": "strength_delta",
        "targetType": "territory",
        "targetId": "TUR",
        "magnitude": 40,
        "description": "Turkey gains 40 strength (Byzantine legacy)"
      },
      {
        "type": "resource_delta",
        "targetType": "territory",
        "targetId": "TUR",
        "magnitude": 30,
        "description": "Turkey gains 30 tech"
      },
      {
        "type": "reputation_delta",
        "targetType": "faction",
        "magnitude": 25,
        "description": "Controlling faction gains 25 reputation"
      }
    ],
    "rippleEffects": [
      {
        "type": "resource_delta",
        "targetType": "global",
        "magnitude": 10,
        "description": "All territories gain 10 tech (cultural diffusion)"
      }
    ],
    "probability": 0.02
  },
  {
    "id": "global_earthquake",
    "title": "Cascading Earthquake Series",
    "description": "A unprecedented series of earthquakes strikes major coastal cities worldwide.",
    "era": null,
    "source": "future_projection",
    "tier": 3,
    "ipCost": 50,
    "effects": [
      {
        "type": "strength_delta",
        "targetType": "global",
        "magnitude": -15,
        "description": "All territories lose 15 strength"
      },
      {
        "type": "resource_delta",
        "targetType": "global",
        "magnitude": -20,
        "description": "All territories lose 20 industry"
      }
    ],
    "rippleEffects": [
      {
        "type": "reputation_delta",
        "targetType": "global",
        "magnitude": 10,
        "description": "All factions gain 10 reputation (humanitarian aid)"
      }
    ],
    "probability": 0.03
  },
  {
    "id": "tesla_wireless_power",
    "title": "Tesla's Wireless Power Success",
    "description": "Nikola Tesla's Wardenclyffe Tower achieves global wireless power transmission.",
    "era": null,
    "source": "counterfactual",
    "tier": 3,
    "ipCost": 50,
    "effects": [
      {
        "type": "resource_delta",
        "targetType": "global",
        "magnitude": 40,
        "description": "All territories gain 40 tech"
      },
      {
        "type": "resource_delta",
        "targetType": "global",
        "magnitude": 30,
        "description": "All territories gain 30 industry"
      }
    ],
    "rippleEffects": [
      {
        "type": "tech_boost",
        "targetType": "global",
        "magnitude": 1.2,
        "description": "All territories' tech multiplied by 1.2x"
      }
    ],
    "probability": 0.02
  }
];

export function loadTerritories(): Territory[] {
  return territoriesData.map(t => ({ ...t }));
}

export function loadEpoch(epochId: string): Epoch {
  // For MVP, only support 1914_brink
  if (epochId === "1914_brink") {
    return {
      "id": "1914_brink",
      "name": "1914 — The World at the Brink",
      "year": 1914,
      "description": "The great powers stand on the edge of total war. Ancient empires and rising nations compete for dominance.",
      "startingTerritoryControl": {
        // British Empire - faction_1 (11 territories)
        "GBR": "faction_1",
        "CAN": "faction_1",
        "IND": "faction_1",
        "AUS": "faction_1",
        "NZL": "faction_1",
        "EGY": "faction_1",
        "ZAF": "faction_1",
        "NGA": "faction_1",
        "PAK": "faction_1",
        "PNG": "faction_1",
        "FJI": "faction_1",

        // Central Powers - faction_2 (11 territories)
        "DEU": "faction_2",
        "RUS": "faction_2",
        "POL": "faction_2",
        "TUR": "faction_2",
        "IRN": "faction_2",
        "KAZ": "faction_2",
        "MNG": "faction_2",
        "IRQ": "faction_2",
        "SAU": "faction_2",
        "ETH": "faction_2",
        "MAR": "faction_2",

        // Allied Powers - faction_3 (10 territories)
        "FRA": "faction_3",
        "ITA": "faction_3",
        "ESP": "faction_3",
        "USA": "faction_3",
        "BRA": "faction_3",
        "ARG": "faction_3",
        "PER": "faction_3",
        "COL": "faction_3",
        "COD": "faction_3",
        "MEX": "faction_3",

        // Asian Powers - faction_4 (10 territories)
        "JPN": "faction_4",
        "CHN": "faction_4",
        "THA": "faction_4",
        "VNM": "faction_4",
        "CUB": "faction_4",
        "DOM": "faction_4",
        "HTI": "faction_4",
        "GTM": "faction_4",
        "PAN": "faction_4",
        "CRI": "faction_4"
      },
      "startingStrengths": {
        // North America
        "USA": 75,
        "CAN": 45,
        "MEX": 35,
        "GTM": 20,
        "CUB": 25,
        "DOM": 15,
        "HTI": 15,
        "PAN": 20,
        "CRI": 20,
        // Europe
        "GBR": 65,
        "FRA": 60,
        "DEU": 70,
        "RUS": 80,
        "POL": 40,
        "ESP": 45,
        "ITA": 50,
        // Asia
        "CHN": 75,
        "IND": 60,
        "JPN": 65,
        "MNG": 30,
        "KAZ": 35,
        "IRN": 45,
        "SAU": 50,
        "IRQ": 40,
        "PAK": 40,
        "TUR": 55,
        "VNM": 35,
        "THA": 35,
        // South America
        "BRA": 50,
        "ARG": 45,
        "PER": 30,
        "COL": 35,
        // Africa
        "EGY": 40,
        "NGA": 35,
        "ZAF": 45,
        "COD": 25,
        "ETH": 25,
        "MAR": 30,
        // Oceania
        "AUS": 50,
        "NZL": 40,
        "PNG": 20,
        "FJI": 15
      },
      "eventPool": [
        "nile_famine",
        "siberian_gold",
        "balkan_uprising"
      ],
      "unlockCondition": null
    };
  }
  throw new Error(`Unknown epoch: ${epochId}`);
}

export function loadEvents(eventPackIds: string[]): HistoricalEvent[] {
  // For MVP, only support "base" pack
  if (eventPackIds.length === 1 && eventPackIds[0] === "base") {
    return eventsData.map(e => ({ ...e }));
  }
  throw new Error(`Unsupported event pack IDs: ${eventPackIds.join(", ")}`);
}
