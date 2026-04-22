import { NextRequest, NextResponse } from 'next/server';
import { getOdds, getUpcomingGames, findBestOdds, SUPPORTED_SPORTS, type SportKey } from '@/lib/odds-api';

export async function GET(req: NextRequest) {
  const searchParams = req.nextUrl.searchParams;
  const sport = searchParams.get('sport') as SportKey | null;
  const action = searchParams.get('action') || 'upcoming';

  try {
    if (action === 'upcoming') {
      // Get upcoming games across all sports
      const games = await getUpcomingGames(10);
      
      // Add best odds info
      const gamesWithBestOdds = games.map(game => ({
        ...game,
        bestOdds: findBestOdds(game),
      }));
      
      return NextResponse.json({
        success: true,
        games: gamesWithBestOdds,
        sports: SUPPORTED_SPORTS,
      });
    }
    
    if (action === 'sport' && sport) {
      const games = await getOdds(sport, {
        markets: ['h2h', 'spreads', 'totals'],
      });
      
      const gamesWithBestOdds = games.map(game => ({
        ...game,
        bestOdds: findBestOdds(game),
      }));
      
      return NextResponse.json({
        success: true,
        sport,
        games: gamesWithBestOdds,
      });
    }

    return NextResponse.json({
      success: true,
      sports: SUPPORTED_SPORTS,
    });
    
  } catch (error) {
    console.error('Odds API error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch odds' },
      { status: 500 }
    );
  }
}
