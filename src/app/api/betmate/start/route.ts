import { NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import type { ChatSession, ChatMessage } from '@/lib/types';
import { V1_OPERATORS } from '@/lib/config';

// In-memory session store (replace with DB in production)
const sessions = new Map<string, ChatSession>();

// Smooth guide welcome message variants
const WELCOME_MESSAGES = [
  "Hey — I'm BetMate. I'll help you find the easiest sportsbook to sign up for in your state. What state are you in?",
  "What's up — I'm BetMate. Tell me your state and I'll point you to the best signup option.",
  "Hey. BetMate here. Let's find you the right sportsbook. Which state are you in?",
  "I'm BetMate. I know which sportsbooks have the smoothest signup in each state. Where are you located?",
];

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

export async function POST() {
  const sessionId = uuidv4();
  
  const session: ChatSession = {
    id: sessionId,
    state: 'welcome',
    alreadyHave: [],
    clicks: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
  
  sessions.set(sessionId, session);
  
  // Welcome message with random variant
  const welcomeMessage: ChatMessage = {
    id: uuidv4(),
    role: 'assistant',
    content: pick(WELCOME_MESSAGES),
    timestamp: Date.now(),
  };
  
  return NextResponse.json({
    sessionId,
    message: welcomeMessage,
    state: 'select_state',
  });
}

// Export sessions for use in other routes
export { sessions };
