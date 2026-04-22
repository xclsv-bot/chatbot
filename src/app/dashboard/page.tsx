'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

interface BestOdds {
  homeTeam: { bookmaker: string; price: number };
  awayTeam: { bookmaker: string; price: number };
  draw?: { bookmaker: string; price: number };
}

interface Game {
  id: string;
  sportKey: string;
  sportTitle: string;
  commenceTime: string;
  homeTeam: string;
  awayTeam: string;
  bestOdds: BestOdds | null;
}

interface Sport {
  key: string;
  name: string;
  emoji: string;
}

function formatOdds(price: number): string {
  return price >= 0 ? `+${price}` : price.toString();
}

function formatTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diff = date.getTime() - now.getTime();
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  
  if (diff < 0) return 'LIVE';
  if (hours < 24) {
    return `${hours}h ${mins}m`;
  }
  return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

export default function Dashboard() {
  const [games, setGames] = useState<Game[]>([]);
  const [sports, setSports] = useState<Sport[]>([]);
  const [selectedSport, setSelectedSport] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchGames();
  }, [selectedSport]);

  const fetchGames = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const url = selectedSport 
        ? `/api/odds?action=sport&sport=${selectedSport}`
        : '/api/odds?action=upcoming';
      
      const res = await fetch(url);
      const data = await res.json();
      
      if (data.success) {
        setGames(data.games || []);
        if (data.sports) setSports(data.sports);
      } else {
        setError(data.error || 'Failed to load games');
      }
    } catch (e) {
      setError('Failed to connect to odds service');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-emerald-900">
      {/* Header */}
      <header className="bg-black/30 backdrop-blur border-b border-white/10">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3">
            <span className="text-3xl">🎯</span>
            <span className="text-xl font-bold text-white">BetMate</span>
          </Link>
          <nav className="flex gap-4">
            <Link href="/" className="text-gray-300 hover:text-white transition">Home</Link>
            <Link href="/dashboard" className="text-emerald-400 font-medium">Odds</Link>
          </nav>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Sport Filter */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-6">Live Odds</h1>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setSelectedSport(null)}
              className={`px-4 py-2 rounded-full font-medium transition ${
                !selectedSport 
                  ? 'bg-emerald-600 text-white' 
                  : 'bg-white/10 text-gray-300 hover:bg-white/20'
              }`}
            >
              🔥 Upcoming
            </button>
            {sports.map(sport => (
              <button
                key={sport.key}
                onClick={() => setSelectedSport(sport.key)}
                className={`px-4 py-2 rounded-full font-medium transition ${
                  selectedSport === sport.key 
                    ? 'bg-emerald-600 text-white' 
                    : 'bg-white/10 text-gray-300 hover:bg-white/20'
                }`}
              >
                {sport.emoji} {sport.name}
              </button>
            ))}
          </div>
        </div>

        {/* Loading State */}
        {loading && (
          <div className="flex justify-center py-12">
            <div className="flex items-center gap-3 text-gray-400">
              <div className="w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
              Loading odds...
            </div>
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="bg-red-500/20 border border-red-500/50 rounded-xl p-6 text-center">
            <p className="text-red-400">{error}</p>
            <button 
              onClick={fetchGames}
              className="mt-4 px-6 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition"
            >
              Try Again
            </button>
          </div>
        )}

        {/* Games Grid */}
        {!loading && !error && (
          <div className="grid gap-4">
            {games.length === 0 ? (
              <div className="bg-white/5 rounded-xl p-8 text-center">
                <p className="text-gray-400">No games available right now</p>
              </div>
            ) : (
              games.map(game => (
                <div 
                  key={game.id}
                  className="bg-white/5 backdrop-blur rounded-xl p-6 border border-white/10 hover:border-emerald-500/50 transition"
                >
                  <div className="flex items-start justify-between">
                    {/* Game Info */}
                    <div className="flex-1">
                      <div className="flex items-center gap-2 text-sm text-gray-400 mb-3">
                        <span>{game.sportTitle}</span>
                        <span>•</span>
                        <span className={formatTime(game.commenceTime) === 'LIVE' ? 'text-red-400 font-bold' : ''}>
                          {formatTime(game.commenceTime)}
                        </span>
                      </div>
                      
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-white font-medium">{game.awayTeam}</span>
                          {game.bestOdds && (
                            <div className="flex items-center gap-2">
                              <span className="text-emerald-400 font-mono font-bold">
                                {formatOdds(game.bestOdds.awayTeam.price)}
                              </span>
                              <span className="text-xs text-gray-500">
                                {game.bestOdds.awayTeam.bookmaker}
                              </span>
                            </div>
                          )}
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-white font-medium">{game.homeTeam}</span>
                          {game.bestOdds && (
                            <div className="flex items-center gap-2">
                              <span className="text-emerald-400 font-mono font-bold">
                                {formatOdds(game.bestOdds.homeTeam.price)}
                              </span>
                              <span className="text-xs text-gray-500">
                                {game.bestOdds.homeTeam.bookmaker}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  {game.bestOdds && (
                    <div className="mt-4 pt-4 border-t border-white/10">
                      <p className="text-xs text-gray-500">
                        Best odds shown • Powered by The Odds API
                      </p>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        )}

        {/* Promo Banner */}
        <div className="mt-8 bg-gradient-to-r from-emerald-600 to-emerald-700 rounded-xl p-6 text-center">
          <h2 className="text-xl font-bold text-white mb-2">Ready to bet?</h2>
          <p className="text-emerald-100 mb-4">Let BetMate find the best sportsbook for you</p>
          <Link 
            href="/"
            className="inline-block px-6 py-3 bg-white text-emerald-700 font-bold rounded-lg hover:bg-gray-100 transition"
          >
            Chat with BetMate →
          </Link>
        </div>
      </div>

      {/* Footer */}
      <footer className="mt-16 py-8 border-t border-white/10">
        <div className="max-w-6xl mx-auto px-4 text-center">
          <p className="text-gray-500 text-sm">
            Powered by XCLSV Media • 21+ Only • Please Gamble Responsibly
          </p>
        </div>
      </footer>
    </main>
  );
}
