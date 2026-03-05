'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { US_STATES, V1_OPERATORS } from '@/lib/config';
import type { ChatMessage, NormalizedOffer, QuickReply } from '@/lib/types';

interface BetMateWidgetProps {
  isOpen: boolean;
  onClose: () => void;
}

// Typing indicator timing constants
const MIN_TYPING_DELAY = 450;
const BASE_TYPING_DELAY = 600;
const MAX_TYPING_DELAY = 1200;
const MAX_TYPING_CAP = 1800;

function getTypingDelay(responseLength?: number): number {
  let delay = BASE_TYPING_DELAY + Math.random() * (MAX_TYPING_DELAY - BASE_TYPING_DELAY);
  if (responseLength && responseLength > 200) {
    delay = Math.min(delay * 1.3, MAX_TYPING_CAP);
  }
  return Math.max(delay, MIN_TYPING_DELAY);
}

export default function BetMateWidget({ isOpen, onClose }: BetMateWidgetProps) {
  const [sessionId, setSessionId] = useState<string>('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [chatState, setChatState] = useState<string>('loading');
  const [selectedState, setSelectedState] = useState<string>('');
  const [selectedOperators, setSelectedOperators] = useState<string[]>([]);
  const [currentOffer, setCurrentOffer] = useState<NormalizedOffer | null>(null);
  const [isTyping, setIsTyping] = useState(false);
  const [expectUpload, setExpectUpload] = useState<'registration' | 'bet' | null>(null);
  const [collectField, setCollectField] = useState<'name' | 'email' | null>(null);
  const [textInput, setTextInput] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen && !sessionId) {
      startSession();
    }
  }, [isOpen]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  const startSession = async () => {
    try {
      setIsTyping(true);
      const res = await fetch('/api/betmate/start', { method: 'POST' });
      const data = await res.json();
      
      const delay = getTypingDelay(data.message.content?.length);
      await new Promise(resolve => setTimeout(resolve, delay));
      
      setSessionId(data.sessionId);
      setMessages([data.message]);
      setChatState(data.state);
    } catch (error) {
      console.error('Failed to start session:', error);
      setMessages([{
        id: 'error',
        role: 'assistant',
        content: 'Something went wrong. Please refresh and try again.',
        timestamp: Date.now(),
      }]);
    } finally {
      setIsTyping(false);
    }
  };

  const sendMessage = useCallback(async (payload: {
    message?: string;
    state?: string;
    alreadyHave?: string[];
    action?: string;
    imageUploaded?: { type: 'registration' | 'bet'; url: string };
    userInfo?: { name?: string; email?: string };
  }) => {
    setIsTyping(true);
    
    try {
      const fetchPromise = fetch('/api/betmate/message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, ...payload }),
      });
      
      const startTime = Date.now();
      const res = await fetchPromise;
      const data = await res.json();
      
      const elapsed = Date.now() - startTime;
      const targetDelay = getTypingDelay(data.message.content?.length);
      const remainingDelay = Math.max(targetDelay - elapsed, MIN_TYPING_DELAY);
      await new Promise(resolve => setTimeout(resolve, remainingDelay));
      
      setMessages(prev => [...prev, data.message]);
      setChatState(data.state);
      
      if (data.offer) {
        setCurrentOffer(data.offer);
      }
      
      if (data.expectUpload) {
        setExpectUpload(data.expectUpload);
      } else {
        setExpectUpload(null);
      }
      
      if (data.collectField) {
        setCollectField(data.collectField);
      } else {
        setCollectField(null);
      }
      
      if (payload.alreadyHave !== undefined || payload.action === 'change_books') {
        setSelectedOperators([]);
      }
    } catch (error) {
      console.error('Failed to send message:', error);
      setMessages(prev => [...prev, {
        id: `error-${Date.now()}`,
        role: 'assistant',
        content: 'Having trouble connecting. Give it another shot.',
        timestamp: Date.now(),
        quickReplies: [
          { id: 'restart', label: 'Try again', action: 'restart' },
        ],
      }]);
    } finally {
      setIsTyping(false);
    }
  }, [sessionId]);

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

  const handleButtonClick = async (button: { url?: string; value: string; id: string }, offer?: NormalizedOffer) => {
    if (button.url) {
      // Track click and transition to awaiting_signup state
      window.open(button.url, '_blank');
      
      // Send clicked_signup action
      setMessages(prev => [...prev, {
        id: Date.now().toString(),
        role: 'user' as const,
        content: `Opening ${offer?.operator || 'signup'} link...`,
        timestamp: Date.now(),
      }]);
      
      sendMessage({ action: 'clicked_signup' });
    }
  };

  const handleQuickReply = (quickReply: QuickReply) => {
    setMessages(prev => [...prev, {
      id: Date.now().toString(),
      role: 'user' as const,
      content: quickReply.label,
      timestamp: Date.now(),
    }]);
    
    sendMessage({ action: quickReply.action });
  };

  const handleFileUpload = async (file: File) => {
    if (!expectUpload) return;
    
    setIsUploading(true);
    
    // Show user message with thumbnail
    const thumbnail = URL.createObjectURL(file);
    setMessages(prev => [...prev, {
      id: Date.now().toString(),
      role: 'user' as const,
      content: `📷 Uploading ${expectUpload} screenshot...`,
      timestamp: Date.now(),
    }]);
    
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('sessionId', sessionId);
      formData.append('type', expectUpload);
      if (selectedState) formData.append('state', selectedState);
      if (currentOffer?.operator) formData.append('operator', currentOffer.operator);
      
      const res = await fetch('/api/betmate/upload', {
        method: 'POST',
        body: formData,
      });
      
      const data = await res.json();
      
      if (data.success) {
        // Update user message to show success
        setMessages(prev => {
          const updated = [...prev];
          const lastUserMsg = updated.findLast(m => m.role === 'user');
          if (lastUserMsg) {
            lastUserMsg.content = `📷 ${expectUpload === 'registration' ? 'Registration' : 'Bet'} screenshot uploaded`;
          }
          return updated;
        });
        
        // Send confirmation to get next message
        sendMessage({ imageUploaded: { type: expectUpload, url: data.url } });
      } else {
        setMessages(prev => [...prev, {
          id: `error-${Date.now()}`,
          role: 'assistant',
          content: data.error || 'Upload failed. Please try again.',
          timestamp: Date.now(),
        }]);
      }
    } catch (error) {
      console.error('Upload error:', error);
      setMessages(prev => [...prev, {
        id: `error-${Date.now()}`,
        role: 'assistant',
        content: 'Upload failed. Please try again.',
        timestamp: Date.now(),
      }]);
    } finally {
      setIsUploading(false);
    }
  };

  const handleFileDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('image/')) {
      handleFileUpload(file);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileUpload(file);
    }
  };

  const handleTextSubmit = () => {
    if (!textInput.trim()) return;
    
    setMessages(prev => [...prev, {
      id: Date.now().toString(),
      role: 'user' as const,
      content: textInput,
      timestamp: Date.now(),
    }]);
    
    if (collectField === 'name') {
      sendMessage({ userInfo: { name: textInput } });
    } else if (collectField === 'email') {
      sendMessage({ userInfo: { email: textInput } });
    } else {
      sendMessage({ message: textInput });
    }
    
    setTextInput('');
  };

  if (!isOpen) return null;

  return (
    <div 
      className="fixed bottom-4 right-4 w-96 h-[600px] bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden z-50 border border-gray-200"
      onDragOver={(e) => e.preventDefault()}
      onDrop={handleFileDrop}
    >
      {/* Header */}
      <div className="bg-gradient-to-r from-emerald-600 to-emerald-700 text-white p-4 flex items-center justify-between">
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
          onClick={onClose}
          className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
        >
          ✕
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50">
        {messages.map((msg) => (
          <div key={msg.id}>
            <div 
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
                
                {msg.buttons && msg.buttons.length > 0 && (
                  <div className="mt-3 space-y-2">
                    {msg.buttons.map((btn) => (
                      <button
                        key={btn.id}
                        onClick={() => handleButtonClick(btn, currentOffer || undefined)}
                        className={`w-full py-2.5 px-4 rounded-lg font-medium text-sm transition-all ${
                          btn.id === 'signup'
                            ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                            : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                        }`}
                      >
                        {btn.label} →
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
            
            {msg.quickReplies && msg.quickReplies.length > 0 && !isTyping && (
              <div className="mt-3 flex flex-wrap gap-2">
                {msg.quickReplies.map((qr) => (
                  <button
                    key={qr.id}
                    onClick={() => handleQuickReply(qr)}
                    className="px-4 py-2 rounded-full border-2 border-emerald-500 text-emerald-700 text-sm font-medium hover:bg-emerald-50 transition-colors"
                  >
                    {qr.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}
        
        {/* State Selector */}
        {chatState === 'select_state' && !isTyping && (
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
        {chatState === 'select_already_have' && !isTyping && (
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
                onClick={() => handleOperatorToggle('none')}
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

        {/* Image Upload Zone */}
        {expectUpload && !isTyping && !isUploading && (
          <div className="bg-white rounded-xl p-4 shadow-sm border-2 border-dashed border-emerald-300">
            <p className="text-sm text-gray-600 mb-3 text-center">
              📷 Upload your {expectUpload === 'registration' ? 'registration' : 'bet'} screenshot
            </p>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="w-full py-3 bg-emerald-100 hover:bg-emerald-200 text-emerald-800 rounded-lg font-medium transition-colors"
            >
              Choose Image
            </button>
            <p className="text-xs text-gray-400 text-center mt-2">
              or drag & drop an image
            </p>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileSelect}
              className="hidden"
            />
          </div>
        )}

        {/* Uploading indicator */}
        {isUploading && (
          <div className="flex justify-center">
            <div className="bg-white rounded-xl px-6 py-4 shadow-sm border border-gray-100">
              <div className="flex items-center gap-3">
                <div className="w-5 h-5 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
                <span className="text-sm text-gray-600">Uploading...</span>
              </div>
            </div>
          </div>
        )}

        {/* Typing indicator */}
        {isTyping && (
          <div className="flex justify-start">
            <div className="bg-white rounded-2xl px-4 py-3 shadow-sm border border-gray-100 rounded-bl-md">
              <div className="flex gap-1.5 items-center h-5">
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms', animationDuration: '0.6s' }} />
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms', animationDuration: '0.6s' }} />
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms', animationDuration: '0.6s' }} />
              </div>
            </div>
          </div>
        )}
        
        <div ref={messagesEndRef} />
      </div>

      {/* Text Input (for name/email collection) */}
      {collectField && !isTyping && (
        <div className="p-3 bg-white border-t border-gray-100">
          <div className="flex gap-2">
            <input
              type={collectField === 'email' ? 'email' : 'text'}
              value={textInput}
              onChange={(e) => setTextInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleTextSubmit()}
              placeholder={collectField === 'name' ? 'Your name...' : 'your@email.com'}
              className="flex-1 px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
            />
            <button
              onClick={handleTextSubmit}
              disabled={!textInput.trim()}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-300 text-white rounded-lg font-medium transition-colors"
            >
              Send
            </button>
          </div>
        </div>
      )}

      {/* Footer */}
      {!collectField && (
        <div className="p-3 bg-white border-t border-gray-100">
          <p className="text-xs text-gray-400 text-center">
            Powered by XCLSV Media • 21+ Only • Please Gamble Responsibly
          </p>
        </div>
      )}
    </div>
  );
}
