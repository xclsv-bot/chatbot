'use client';

import { useState, useRef, useEffect } from 'react';
import { US_STATES, V1_OPERATORS } from '@/lib/config';
import type { ChatMessage, NormalizedOffer } from '@/lib/types';

export default function WidgetPage() {
  const [sessionId, setSessionId] = useState<string>('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [chatState, setChatState] = useState<string>('loading');
  const [selectedState, setSelectedState] = useState<string>('');
  const [selectedOperators, setSelectedOperators] = useState<string[]>([]);
  const [currentOffer, setCurrentOffer] = useState<NormalizedOffer | null>(null);
  const [backupOffer, setBackupOffer] = useState<NormalizedOffer | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Start session on mount
  useEffect(() => {
    startSession();
  }, []);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const startSession = async () => {
    try {
      const res = await fetch('/api/betmate/start', { method: 'POST' });
      const data = await res.json();
      setSessionId(data.sessionId);
      setMessages([data.message]);
      setChatState(data.state);
    } catch (error) {
      console.error('Failed to start session:', error);
    }
  };

  const sendMessage = async (payload: {
    message?: string;
    state?: string;
    alreadyHave?: string[];
  }) => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/betmate/message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, ...payload }),
      });
      const data = await res.json();
      setMessages(prev => [...prev, data.message]);
      setChatState(data.state);
      if (data.offer) {
        setCurrentOffer(data.offer);
      }
      if (data.backup) {
        setBackupOffer(data.backup);
      }
    } catch (error) {
      console.error('Failed to send message:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleStateSelect = (stateName: string) => {
    setSelectedState(stateName);
    setMessages(prev => [...prev, {
      id: Date.now().toString(),
      role: 'user' as const,
      content: stateName,
      timestamp: Date.now(),
    }]);
    sendMessage({ state: stateName });
  };

  const handleOperatorToggle = (operator: string) => {
    if (operator === 'none') {
      setSelectedOperators([]);
    } else {
      setSelectedOperators(prev => 
        prev.includes(operator)
          ? prev.filter(o => o !== operator)
          : [...prev.filter(o => o !== 'none'), operator]
      );
    }
  };

  const handleOperatorSubmit = () => {
    const userMessage = selectedOperators.length === 0 
      ? "None of these"
      : selectedOperators.join(', ');
    
    setMessages(prev => [...prev, {
      id: Date.now().toString(),
      role: 'user' as const,
      content: userMessage,
      timestamp: Date.now(),
    }]);
    
    sendMessage({ alreadyHave: selectedOperators });
  };

  const handleButtonClick = async (buttonId: string, url: string, offer: NormalizedOffer) => {
    // Track click
    await fetch('/api/betmate/click', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId,
        operator: offer.operator,
        offerId: offer.wpId,
        buttonUrl: url,
        state: selectedState,
        alreadyHave: selectedOperators,
      }),
    });
    
    // Open in new tab
    window.open(url, '_blank');
  };

  const handleClose = () => {
    if (window.parent !== window) {
      window.parent.postMessage('betmate:close', '*');
    }
  };

  return (
    <div className="h-screen flex flex-col bg-white">
      {/* Header */}
      <div className="bg-gradient-to-r from-emerald-600 to-emerald-700 text-white p-4 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center text-xl">
            🎯
          </div>
          <div>
            <h3 className="font-bold">BetMate</h3>
            <p className="text-xs text-emerald-100">Find your perfect sportsbook</p>
          </div>
        </div>
        <button 
          onClick={handleClose}
          className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
        >
          ✕
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50">
        {messages.map((msg) => (
          <div 
            key={msg.id}
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div 
              className={`max-w-[85%] rounded-2xl px-4 py-3 ${
                msg.role === 'user' 
                  ? 'bg-emerald-600 text-white rounded-br-md' 
                  : 'bg-white text-gray-800 shadow-sm border border-gray-100 rounded-bl-md'
              }`}
            >
              <div className="text-sm whitespace-pre-wrap">
                {msg.content.split('**').map((part, i) => 
                  i % 2 === 1 ? <strong key={i}>{part}</strong> : part
                )}
              </div>
              
              {/* Action Buttons */}
              {msg.buttons && msg.buttons.length > 0 && (
                <div className="mt-3 space-y-2">
                  {msg.buttons.map((btn) => {
                    const offer = btn.id === 'signup' ? currentOffer : backupOffer;
                    return (
                      <button
                        key={btn.id}
                        onClick={() => offer && btn.url && handleButtonClick(btn.id, btn.url, offer)}
                        className={`w-full py-2.5 px-4 rounded-lg font-medium text-sm transition-all ${
                          btn.id === 'signup'
                            ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                            : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                        }`}
                      >
                        {btn.label} →
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        ))}
        
        {/* State Selector */}
        {chatState === 'select_state' && !isLoading && (
          <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
            <p className="text-sm text-gray-600 mb-3">Select your state:</p>
            <select 
              className="w-full p-3 border border-gray-200 rounded-lg text-gray-800 bg-white focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
              onChange={(e) => e.target.value && handleStateSelect(e.target.value)}
              defaultValue=""
            >
              <option value="">Choose a state...</option>
              {US_STATES.map(state => (
                <option key={state.code} value={state.name}>
                  {state.name}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Multi-select for operators */}
        {chatState === 'select_already_have' && !isLoading && (
          <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
            <p className="text-sm text-gray-600 mb-3">Select all that apply:</p>
            <div className="space-y-2">
              {V1_OPERATORS.map(op => (
                <button
                  key={op}
                  onClick={() => handleOperatorToggle(op)}
                  className={`w-full p-3 rounded-lg text-left text-sm font-medium transition-all ${
                    selectedOperators.includes(op)
                      ? 'bg-emerald-100 text-emerald-800 border-2 border-emerald-500'
                      : 'bg-gray-50 text-gray-700 border-2 border-transparent hover:bg-gray-100'
                  }`}
                >
                  {selectedOperators.includes(op) ? '✓ ' : ''}{op}
                </button>
              ))}
              <button
                onClick={() => setSelectedOperators([])}
                className={`w-full p-3 rounded-lg text-left text-sm font-medium transition-all ${
                  selectedOperators.length === 0
                    ? 'bg-emerald-100 text-emerald-800 border-2 border-emerald-500'
                    : 'bg-gray-50 text-gray-700 border-2 border-transparent hover:bg-gray-100'
                }`}
              >
                {selectedOperators.length === 0 ? '✓ ' : ''}None of these
              </button>
            </div>
            <button
              onClick={handleOperatorSubmit}
              className="w-full mt-4 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-medium transition-colors"
            >
              Continue →
            </button>
          </div>
        )}

        {/* Loading indicator */}
        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-white rounded-2xl px-4 py-3 shadow-sm border border-gray-100">
              <div className="flex gap-1.5">
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </div>
        )}
        
        <div ref={messagesEndRef} />
      </div>

      {/* Footer */}
      <div className="p-3 bg-white border-t border-gray-100 shrink-0">
        <p className="text-xs text-gray-400 text-center">
          Powered by XCLSV Media • 21+ Only • Please Gamble Responsibly
        </p>
      </div>
    </div>
  );
}
