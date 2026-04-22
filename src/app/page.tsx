'use client';

import { useState } from 'react';
import Link from 'next/link';
import BetMateWidget from '@/components/BetMateWidget';

export default function Home() {
  const [isWidgetOpen, setIsWidgetOpen] = useState(false);

  return (
    <main className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-emerald-900 p-8">
      {/* Nav */}
      <nav className="fixed top-0 left-0 right-0 bg-black/20 backdrop-blur z-40">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-2xl">🎯</span>
            <span className="font-bold text-white">BetMate</span>
          </div>
          <Link 
            href="/dashboard" 
            className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg text-sm font-medium transition"
          >
            📊 Live Odds
          </Link>
        </div>
      </nav>

      <div className="max-w-2xl mx-auto text-center pt-24">
        <div className="text-6xl mb-6">🎯</div>
        <h1 className="text-4xl font-bold text-white mb-4">
          BetMate
        </h1>
        <p className="text-xl text-gray-300 mb-8">
          Find the easiest sportsbook to sign up for in your state
        </p>
        
        <button
          onClick={() => setIsWidgetOpen(true)}
          className="px-8 py-4 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-lg rounded-xl transition-all transform hover:scale-105 shadow-lg shadow-emerald-600/30"
        >
          Start Chat →
        </button>

        <div className="mt-16 grid grid-cols-3 gap-6 text-center">
          <div className="bg-white/5 rounded-xl p-6 backdrop-blur">
            <div className="text-3xl mb-2">⚡</div>
            <h3 className="text-white font-semibold mb-1">Quick Signup</h3>
            <p className="text-gray-400 text-sm">We recommend the easiest signup process</p>
          </div>
          <div className="bg-white/5 rounded-xl p-6 backdrop-blur">
            <div className="text-3xl mb-2">📍</div>
            <h3 className="text-white font-semibold mb-1">State-Specific</h3>
            <p className="text-gray-400 text-sm">Only offers available where you live</p>
          </div>
          <div className="bg-white/5 rounded-xl p-6 backdrop-blur">
            <div className="text-3xl mb-2">🎁</div>
            <h3 className="text-white font-semibold mb-1">Best Offers</h3>
            <p className="text-gray-400 text-sm">Exclusive bonuses and promos</p>
          </div>
        </div>

        <p className="mt-16 text-gray-500 text-sm">
          Powered by XCLSV Media • 21+ Only • Please Gamble Responsibly
        </p>
      </div>

      {/* Floating open button when closed */}
      {!isWidgetOpen && (
        <button
          onClick={() => setIsWidgetOpen(true)}
          className="fixed bottom-6 right-6 w-16 h-16 bg-emerald-600 hover:bg-emerald-500 rounded-full shadow-lg shadow-emerald-600/30 flex items-center justify-center text-2xl transition-all transform hover:scale-110"
        >
          💬
        </button>
      )}

      <BetMateWidget 
        isOpen={isWidgetOpen} 
        onClose={() => setIsWidgetOpen(false)} 
      />
    </main>
  );
}
