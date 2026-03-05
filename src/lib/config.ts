// BetMate Configuration

export const WP_API_TOKEN = process.env.WP_API_TOKEN || '';
export const WP_BASE_URL = 'https://xclsvmedia.com/wp-json/xclsv/v1';

// V1 Operators - these are the ones we support for recommendations
export const V1_OPERATORS = [
  'DraftKings',
  'Caesars',
  'BetMGM',
  'Underdog',
  'ParlayPlay',
  'Rebet',
  'Betr',
] as const;

// Operator label mapping (WP labels → our display names)
export const OPERATOR_LABEL_MAP: Record<string, string> = {
  'DraftKings Sportsbook': 'DraftKings',
  'DraftKings Sportsbook MO': 'DraftKings',
  'DraftKings': 'DraftKings',
  'Caesars Sportsbook': 'Caesars',
  'Caesars': 'Caesars',
  'BetMGM Sportsbook': 'BetMGM',
  'BetMGM': 'BetMGM',
  'Underdog – Confido': 'Underdog',
  'Underdog': 'Underdog',
  'ParlayPlay': 'ParlayPlay',
  'Rebet': 'Rebet',
  'Betr': 'Betr',
};

// Easiest Signup Score (higher = easier)
// Scale: 1-10, based on typical signup friction
export const SIGNUP_EASE_SCORES: Record<string, number> = {
  'ParlayPlay': 9,      // Very simple, pick'em style
  'Underdog': 8,        // DFS-style, less KYC
  'Betr': 8,            // Newer, streamlined signup
  'Rebet': 7,           // Simple process
  'DraftKings': 6,      // Full sportsbook KYC but smooth
  'Caesars': 5,         // More steps, promos can be confusing
  'BetMGM': 5,          // Standard sportsbook process
};

// US States list
export const US_STATES = [
  { code: 'AL', name: 'Alabama' },
  { code: 'AK', name: 'Alaska' },
  { code: 'AZ', name: 'Arizona' },
  { code: 'AR', name: 'Arkansas' },
  { code: 'CA', name: 'California' },
  { code: 'CO', name: 'Colorado' },
  { code: 'CT', name: 'Connecticut' },
  { code: 'DE', name: 'Delaware' },
  { code: 'FL', name: 'Florida' },
  { code: 'GA', name: 'Georgia' },
  { code: 'HI', name: 'Hawaii' },
  { code: 'ID', name: 'Idaho' },
  { code: 'IL', name: 'Illinois' },
  { code: 'IN', name: 'Indiana' },
  { code: 'IA', name: 'Iowa' },
  { code: 'KS', name: 'Kansas' },
  { code: 'KY', name: 'Kentucky' },
  { code: 'LA', name: 'Louisiana' },
  { code: 'ME', name: 'Maine' },
  { code: 'MD', name: 'Maryland' },
  { code: 'MA', name: 'Massachusetts' },
  { code: 'MI', name: 'Michigan' },
  { code: 'MN', name: 'Minnesota' },
  { code: 'MS', name: 'Mississippi' },
  { code: 'MO', name: 'Missouri' },
  { code: 'MT', name: 'Montana' },
  { code: 'NE', name: 'Nebraska' },
  { code: 'NV', name: 'Nevada' },
  { code: 'NH', name: 'New Hampshire' },
  { code: 'NJ', name: 'New Jersey' },
  { code: 'NM', name: 'New Mexico' },
  { code: 'NY', name: 'New York' },
  { code: 'NC', name: 'North Carolina' },
  { code: 'ND', name: 'North Dakota' },
  { code: 'OH', name: 'Ohio' },
  { code: 'OK', name: 'Oklahoma' },
  { code: 'OR', name: 'Oregon' },
  { code: 'PA', name: 'Pennsylvania' },
  { code: 'RI', name: 'Rhode Island' },
  { code: 'SC', name: 'South Carolina' },
  { code: 'SD', name: 'South Dakota' },
  { code: 'TN', name: 'Tennessee' },
  { code: 'TX', name: 'Texas' },
  { code: 'UT', name: 'Utah' },
  { code: 'VT', name: 'Vermont' },
  { code: 'VA', name: 'Virginia' },
  { code: 'WA', name: 'Washington' },
  { code: 'WV', name: 'West Virginia' },
  { code: 'WI', name: 'Wisconsin' },
  { code: 'WY', name: 'Wyoming' },
  { code: 'DC', name: 'Washington DC' },
];
