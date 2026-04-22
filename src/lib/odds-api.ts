// The Odds API Integration
// Docs: https://the-odds-api.com/liveapi/guides/v4/

const API_KEY = process.env.ODDS_API_KEY || 'ce73eeb6f1d7ed0ce48e16fda814d5f3';
const BASE_URL = 'https://api.the-odds-api.com/v4';

// Supported sports for US betting
export const SUPPORTED_SPORTS = [
  { key: 'americanfootball_nfl', name: 'NFL', emoji: '🏈' },
  { key: 'americanfootball_ncaaf', name: 'NCAAF', emoji: '🏈' },
  { key: 'basketball_nba', name: 'NBA', emoji: '🏀' },
  { key: 'basketball_ncaab', name: 'NCAAB', emoji: '🏀' },
  { key: 'baseball_mlb', name: 'MLB', emoji: '⚾' },
  { key: 'icehockey_nhl', name: 'NHL', emoji: '🏒' },
  { key: 'mma_mixed_martial_arts', name: 'UFC/MMA', emoji: '🥊' },
  { key: 'soccer_usa_mls', name: 'MLS', emoji: '⚽' },
] as const;

// US Bookmakers we care about (matching our sportsbook recommendations)
export const US_BOOKMAKERS = [
  'fanduel',
  'draftkings', 
  'betmgm',
  'caesars',
  'espnbet',
  'fanatics',
  'betrivers',
  'pointsbet',
] as const;

export type SportKey = typeof SUPPORTED_SPORTS[number]['key'];
export type BookmakerKey = typeof US_BOOKMAKERS[number];

// API response types (snake_case as returned by The Odds API)
interface ApiOutcome {
  name: string;
  price: number;
  point?: number;
}

interface ApiMarket {
  key: string;
  last_update: string;
  outcomes: ApiOutcome[];
}

interface ApiBookmaker {
  key: string;
  title: string;
  last_update: string;
  markets: ApiMarket[];
}

interface ApiGame {
  id: string;
  sport_key: string;
  sport_title: string;
  commence_time: string;
  home_team: string;
  away_team: string;
  bookmakers: ApiBookmaker[];
}

// Normalized types (camelCase for our app)
export interface OddsOutcome {
  name: string;
  price: number;
  point?: number;
}

export interface OddsMarket {
  key: string;
  outcomes: OddsOutcome[];
}

export interface BookmakerOdds {
  key: string;
  title: string;
  lastUpdate: string;
  markets: OddsMarket[];
}

export interface GameOdds {
  id: string;
  sportKey: string;
  sportTitle: string;
  commenceTime: string;
  homeTeam: string;
  awayTeam: string;
  bookmakers: BookmakerOdds[];
}

// Transform API response to normalized format
function normalizeGame(game: ApiGame): GameOdds {
  return {
    id: game.id,
    sportKey: game.sport_key,
    sportTitle: game.sport_title,
    commenceTime: game.commence_time,
    homeTeam: game.home_team,
    awayTeam: game.away_team,
    bookmakers: game.bookmakers.map(b => ({
      key: b.key,
      title: b.title,
      lastUpdate: b.last_update,
      markets: b.markets.map(m => ({
        key: m.key,
        outcomes: m.outcomes,
      })),
    })),
  };
}

// Fetch odds for a sport
export async function getOdds(
  sportKey: SportKey,
  options: {
    markets?: ('h2h' | 'spreads' | 'totals')[];
    bookmakers?: string[];
    oddsFormat?: 'american' | 'decimal';
  } = {}
): Promise<GameOdds[]> {
  const {
    markets = ['h2h', 'spreads'],
    bookmakers = US_BOOKMAKERS as unknown as string[],
    oddsFormat = 'american',
  } = options;

  const params = new URLSearchParams({
    apiKey: API_KEY,
    regions: 'us',
    markets: markets.join(','),
    bookmakers: bookmakers.join(','),
    oddsFormat,
  });

  const res = await fetch(`${BASE_URL}/sports/${sportKey}/odds?${params}`);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to fetch odds: ${res.status} - ${text}`);
  }
  
  const data: ApiGame[] = await res.json();
  return data.map(normalizeGame);
}

// Get upcoming games across all sports (for dashboard)
export async function getUpcomingGames(limit = 10): Promise<GameOdds[]> {
  const allGames: GameOdds[] = [];
  
  // Fetch from top 3 sports for efficiency
  const prioritySports: SportKey[] = ['basketball_nba', 'americanfootball_nfl', 'baseball_mlb'];
  
  for (const sport of prioritySports) {
    try {
      const games = await getOdds(sport, { markets: ['h2h'] });
      allGames.push(...games);
    } catch (e) {
      console.error(`Failed to fetch ${sport}:`, e);
    }
  }
  
  // Sort by commence time and limit
  return allGames
    .sort((a, b) => new Date(a.commenceTime).getTime() - new Date(b.commenceTime).getTime())
    .slice(0, limit);
}

// Find best odds for a game across bookmakers
export interface BestOdds {
  homeTeam: { bookmaker: string; price: number };
  awayTeam: { bookmaker: string; price: number };
  draw?: { bookmaker: string; price: number };
}

export function findBestOdds(game: GameOdds): BestOdds | null {
  const h2hMarkets = game.bookmakers
    .map(b => ({
      bookmaker: b.title,
      market: b.markets.find(m => m.key === 'h2h'),
    }))
    .filter(b => b.market);

  if (h2hMarkets.length === 0) return null;

  let bestHome = { bookmaker: '', price: -Infinity };
  let bestAway = { bookmaker: '', price: -Infinity };
  let bestDraw: { bookmaker: string; price: number } | undefined;

  for (const { bookmaker, market } of h2hMarkets) {
    if (!market) continue;
    
    for (const outcome of market.outcomes) {
      if (outcome.name === game.homeTeam && outcome.price > bestHome.price) {
        bestHome = { bookmaker, price: outcome.price };
      } else if (outcome.name === game.awayTeam && outcome.price > bestAway.price) {
        bestAway = { bookmaker, price: outcome.price };
      } else if (outcome.name === 'Draw') {
        if (!bestDraw || outcome.price > bestDraw.price) {
          bestDraw = { bookmaker, price: outcome.price };
        }
      }
    }
  }

  return {
    homeTeam: bestHome,
    awayTeam: bestAway,
    ...(bestDraw && { draw: bestDraw }),
  };
}

// Format American odds for display
export function formatOdds(price: number): string {
  if (price >= 0) {
    return `+${price}`;
  }
  return price.toString();
}

// Get odds comparison for a specific bookmaker
export function getBookmakerOdds(game: GameOdds, bookmakerKey: string): OddsMarket[] | null {
  const bookmaker = game.bookmakers.find(b => b.key === bookmakerKey);
  return bookmaker?.markets || null;
}

// Check which bookmakers have odds for a game
export function getAvailableBookmakers(game: GameOdds): string[] {
  return game.bookmakers.map(b => b.title);
}
