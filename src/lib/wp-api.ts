// WordPress API Service
// Server-side only - token never exposed to browser

import { WP_API_TOKEN, WP_BASE_URL, OPERATOR_LABEL_MAP, SIGNUP_EASE_SCORES, V1_OPERATORS } from './config';
import type { WPStatesResponse, WPOffersResponse, WPState, NormalizedOffer } from './types';

// Cache for API responses (in-memory, resets on deploy)
let statesCache: WPStatesResponse | null = null;
let statesCacheTime = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

export async function fetchStates(): Promise<WPStatesResponse> {
  const now = Date.now();
  
  // Return cached if fresh
  if (statesCache && (now - statesCacheTime) < CACHE_TTL) {
    return statesCache;
  }
  
  const url = `${WP_BASE_URL}/states?token=${WP_API_TOKEN}`;
  
  const response = await fetch(url, {
    headers: { 'Accept': 'application/json' },
    next: { revalidate: 300 } // Next.js cache for 5 min
  });
  
  if (!response.ok) {
    throw new Error(`WP API error: ${response.status}`);
  }
  
  const data: WPStatesResponse = await response.json();
  
  // Update cache
  statesCache = data;
  statesCacheTime = now;
  
  return data;
}

export async function fetchOffers(): Promise<WPOffersResponse> {
  const url = `${WP_BASE_URL}/offers?token=${WP_API_TOKEN}`;
  
  const response = await fetch(url, {
    headers: { 'Accept': 'application/json' },
    next: { revalidate: 300 }
  });
  
  if (!response.ok) {
    throw new Error(`WP API error: ${response.status}`);
  }
  
  return response.json();
}

// Get offers for a specific state
export async function getOffersForState(stateName: string): Promise<NormalizedOffer[]> {
  const { states } = await fetchStates();
  
  // Find matching state (fuzzy match on name)
  const stateData = states.find(s => {
    const wpStateName = s.state_name.replace(' Offers', '').toLowerCase();
    return wpStateName === stateName.toLowerCase() ||
           s.state_name.toLowerCase().includes(stateName.toLowerCase());
  });
  
  if (!stateData) {
    return [];
  }
  
  return normalizeOffers(stateData);
}

// Normalize WP offers to our format
function normalizeOffers(stateData: WPState): NormalizedOffer[] {
  return stateData.offers
    .filter(offer => offer.active) // Only active offers
    .map(offer => {
      // Map label to our operator name
      const operator = mapToOperator(offer.label);
      
      return {
        wpId: offer.wp_id,
        operator,
        originalLabel: offer.label,
        title: offer.title,
        description: offer.description,
        buttonUrl: offer.button_url,
        signupEaseScore: SIGNUP_EASE_SCORES[operator] || 5,
        isActive: offer.active,
      };
    })
    // Only include V1 operators
    .filter(offer => V1_OPERATORS.includes(offer.operator as typeof V1_OPERATORS[number]));
}

// Map WP label to our operator name
function mapToOperator(label: string): string {
  // Check exact match first
  if (OPERATOR_LABEL_MAP[label]) {
    return OPERATOR_LABEL_MAP[label];
  }
  
  // Check partial match
  for (const [wpLabel, operator] of Object.entries(OPERATOR_LABEL_MAP)) {
    if (label.toLowerCase().includes(wpLabel.toLowerCase()) ||
        wpLabel.toLowerCase().includes(label.toLowerCase())) {
      return operator;
    }
  }
  
  // Return original if no match
  return label;
}

// Get best recommendation based on exclusions
export function getBestRecommendation(
  offers: NormalizedOffer[],
  alreadyHave: string[]
): { primary: NormalizedOffer | null; backup: NormalizedOffer | null } {
  // Filter out operators user already has
  const available = offers.filter(
    offer => !alreadyHave.includes(offer.operator)
  );
  
  if (available.length === 0) {
    return { primary: null, backup: null };
  }
  
  // Sort by signup ease score (descending)
  const sorted = [...available].sort((a, b) => b.signupEaseScore - a.signupEaseScore);
  
  return {
    primary: sorted[0],
    backup: sorted[1] || null,
  };
}

// Get list of available states
export async function getAvailableStates(): Promise<string[]> {
  const { states } = await fetchStates();
  
  return states.map(s => s.state_name.replace(' Offers', ''));
}

// Get ALL offers for a state (ignoring already-have filter)
// Used for "show anyway" feature
export async function getAllOffersForState(stateName: string): Promise<NormalizedOffer[]> {
  const { states } = await fetchStates();
  
  const stateData = states.find(s => {
    const wpStateName = s.state_name.replace(' Offers', '').toLowerCase();
    return wpStateName === stateName.toLowerCase() ||
           s.state_name.toLowerCase().includes(stateName.toLowerCase());
  });
  
  if (!stateData) {
    return [];
  }
  
  // Return ALL active offers (not filtered by V1_OPERATORS for "show anyway")
  return stateData.offers
    .filter(offer => offer.active)
    .map(offer => {
      const operator = mapToOperator(offer.label);
      return {
        wpId: offer.wp_id,
        operator,
        originalLabel: offer.label,
        title: offer.title,
        description: offer.description,
        buttonUrl: offer.button_url,
        signupEaseScore: SIGNUP_EASE_SCORES[operator] || 5,
        isActive: offer.active,
      };
    })
    // Filter to V1 operators for consistency
    .filter(offer => V1_OPERATORS.includes(offer.operator as typeof V1_OPERATORS[number]))
    .sort((a, b) => b.signupEaseScore - a.signupEaseScore);
}
