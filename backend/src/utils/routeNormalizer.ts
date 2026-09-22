/**
 * Route Search and Identifier Normalization Utility
 *
 * Normalizes route identifiers and queries to ensure robust search across
 * punctuation, hyphens, unicode dashes, spaces, and casing.
 *
 * Examples:
 *  - "600-F" -> "600f"
 *  - "600F"  -> "600f"
 *  - "600 F" -> "600f"
 *  - "600–F" -> "600f" (en-dash U+2013)
 *  - "600—F" -> "600f" (em-dash U+2014)
 */

/**
 * Normalizes a route identifier string by removing all hyphens, unicode dashes,
 * spaces, and special characters, returning a lowercase alphanumeric string.
 */
export function normalizeRouteIdentifier(identifier?: string | null): string {
  if (!identifier) return '';
  return identifier
    .toLowerCase()
    .replace(/[\s\-_–—\.\/\\,]+/g, '')
    .trim();
}

/**
 * Normalizes a user search query for route matching.
 */
export function normalizeRouteSearchQuery(query?: string | null): string {
  return normalizeRouteIdentifier(query);
}

export type RouteMatchQuality = 'EXACT' | 'PREFIX' | 'CONTAINS' | 'NONE';

export interface RouteMatchResult {
  matches: boolean;
  quality: RouteMatchQuality;
  score: number;
}

/**
 * Evaluate how well a route number matches a search query
 */
export function matchRouteNumber(
  routeNumber: string,
  searchQuery: string
): RouteMatchResult {
  const normRoute = normalizeRouteIdentifier(routeNumber);
  const normQuery = normalizeRouteSearchQuery(searchQuery);

  if (!normQuery) {
    return { matches: true, quality: 'EXACT', score: 100 };
  }

  if (normRoute === normQuery) {
    return { matches: true, quality: 'EXACT', score: 100 };
  }

  if (normRoute.startsWith(normQuery)) {
    return { matches: true, quality: 'PREFIX', score: 80 };
  }

  if (normRoute.includes(normQuery)) {
    return { matches: true, quality: 'CONTAINS', score: 60 };
  }

  return { matches: false, quality: 'NONE', score: 0 };
}
