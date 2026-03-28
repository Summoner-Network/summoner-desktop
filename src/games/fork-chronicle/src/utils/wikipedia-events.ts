/**
 * Wikipedia "On This Day" API integration for Fork Chronicle
 * Fetches real historical events and converts them to alternate history scenarios
 */

import type { HistoricalEvent } from "../types/event";
import type { EventSource } from "../types/event";

export interface WikipediaEvent {
  year: number;
  text: string;
  pages: Array<{
    title: string;
    extract: string;
    thumbnail?: {
      source: string;
      width: number;
      height: number;
    };
    thumbnailDataUrl?: string;
  }>;
}

/**
 * Fetch today's historical events from Wikipedia API
 * Routes through Electron's main process via IPC to bypass CSP
 */
export async function fetchWikipediaEventsForToday(): Promise<WikipediaEvent[]> {
  const now = new Date();
  const month = now.getMonth() + 1;
  const day = now.getDate();

  console.log('[Fork] Fetching Wikipedia events via IPC...', month, day);

  const result = await window.api.wikipedia.fetchOnThisDay(month, day);

  if (!result.ok || !('data' in result)) {
    console.warn('[Fork] Wikipedia IPC fetch failed:', 'error' in result ? result.error : 'unknown');
    return [];
  }

  console.log('[Fork] Wikipedia returned', result.data.events.length, 'events');
  return result.data.events as WikipediaEvent[];
}

/**
 * Fetch Wikipedia events filtered to match a specific game year.
 * Returns events within a ±20 year window of the game year.
 */
export async function fetchWikipediaEventsForYear(
  gameYear: number
): Promise<WikipediaEvent[]> {
  const now = new Date();
  const month = now.getMonth() + 1;
  // Vary the day ±3 to get different event pools each draw
  const dayVariance = Math.floor(Math.random() * 7) - 3;
  const day = Math.max(1, Math.min(28, now.getDate() + dayVariance));

  console.log('[Fork] Fetching Wikipedia events via IPC...', month, day);

  const result = await window.api.wikipedia.fetchOnThisDay(month, day);

  if (!result.ok || !('data' in result)) {
    console.warn('[Fork] Wikipedia IPC fetch failed:', 'error' in result ? result.error : 'unknown');
    return [];
  }

  const allEvents = result.data.events as WikipediaEvent[];
  const yearMin = gameYear - 5;
  const yearMax = gameYear + 20;

  const filtered = allEvents.filter(e => e.year >= yearMin && e.year <= yearMax);

  console.log('[Fork] Wikipedia events for year', gameYear,
    '- total:', allEvents.length,
    'filtered to range', yearMin, '-', yearMax, ':', filtered.length);

  // If no events in range, fall back to nearest events
  if (filtered.length === 0) {
    console.log('[Fork] No events in year range, using closest events');
    return allEvents
      .sort((a, b) => Math.abs(a.year - gameYear) - Math.abs(b.year - gameYear))
      .slice(0, 5);
  }

  return filtered;
}

/**
 * Convert a Wikipedia event to a Fork Chronicle HistoricalEvent
 */
export function wikiEventToGameEvent(
  wikiEvent: WikipediaEvent,
  tier: 1 | 2 | 3
): HistoricalEvent {
  const title = `What if: ${wikiEvent.pages[0]?.title ?? 'History Diverges'}`;

  const description =
    `In ${wikiEvent.year}, ${wikiEvent.text} ` +
    `But in this timeline, events unfolded differently.`;

  // Generate effects based on tier
  const effects = generateEffectsFromWikiEvent(wikiEvent, tier);

  return {
    id: `wiki_${wikiEvent.year}_${Date.now()}`,
    title,
    description,
    era: null,
    source: 'counterfactual' as EventSource,
    tier,
    ipCost: tier === 1 ? 10 : tier === 2 ? 25 : 50,
    effects,
    rippleEffects: [],
    probability: 1.0,
    // Add Wikipedia metadata
    wikiYear: wikiEvent.year,
    wikiText: wikiEvent.text,
    wikiThumbnail: getWikipediaThumbnail(wikiEvent) ?? undefined,
    wikiThumbnailDataUrl: wikiEvent.pages[0]?.thumbnailDataUrl,
  };
}

/**
 * Generate game effects from a Wikipedia event
 * For MVP: generates simple random effects
 * TODO v1.1: Use Claude to intelligently map Wikipedia events to territory effects
 */
function generateEffectsFromWikiEvent(
  event: WikipediaEvent,
  tier: 1 | 2 | 3
): any[] {
  // Tier determines scope and magnitude
  const magnitude = tier === 1 ? 15 : tier === 2 ? 25 : 35;

  // For MVP: generate a strength_delta effect
  // Tier 1: single territory
  // Tier 2: single territory with larger effect
  // Tier 3: global effect
  if (tier === 3) {
    return [{
      type: 'strength_delta',
      targetType: 'global',
      magnitude: Math.random() > 0.5 ? magnitude : -magnitude,
      description: `Historical divergence: ${event.text.slice(0, 80)}...`
    }];
  } else {
    return [{
      type: 'strength_delta',
      targetType: 'territory',
      targetId: getRandomTerritoryForEvent(event),
      magnitude: Math.random() > 0.5 ? magnitude : -magnitude,
      description: `Historical divergence: ${event.text.slice(0, 80)}...`
    }];
  }
}

/**
 * Get a random territory ID appropriate for the Wikipedia event
 * For MVP: returns a random territory
 * TODO v1.1: Use NLP to extract location from Wikipedia event and map to territory
 */
function getRandomTerritoryForEvent(event: WikipediaEvent): string {
  const territories = [
    'USA', 'GBR', 'FRA', 'DEU', 'RUS', 'CHN', 'JPN', 'IND',
    'ITA', 'ESP', 'POL', 'TUR', 'IRN', 'SAU', 'IRQ', 'PAK',
    'MNG', 'KAZ', 'VNM', 'THA', 'CAN', 'MEX', 'GTM', 'CUB',
    'PAN', 'CRI', 'DOM', 'HTI', 'BRA', 'ARG', 'PER', 'COL',
    'EGY', 'NGA', 'ZAF', 'COD', 'ETH', 'MAR', 'AUS', 'NZL', 'PNG', 'FJI'
  ];

  return territories[Math.floor(Math.random() * territories.length)];
}

/**
 * Extract thumbnail URL from Wikipedia event if available
 */
export function getWikipediaThumbnail(wikiEvent: WikipediaEvent): string | null {
  return wikiEvent.pages[0]?.thumbnail?.source ?? null;
}
