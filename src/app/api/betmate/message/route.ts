import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import type { ChatMessage, ChatSession, NormalizedOffer, QuickReply, SubmissionStatus } from '@/lib/types';
import { V1_OPERATORS, US_STATES } from '@/lib/config';
import { getOffersForState, getBestRecommendation, getAllOffersForState } from '@/lib/wp-api';

// Optional imports - may not be configured
let createSubmission: any, updateSubmission: any, getSubmission: any;
let syncToSheet: any, formatForSheet: any;

try {
  const db = require('@/lib/db');
  createSubmission = db.createSubmission;
  updateSubmission = db.updateSubmission;
  getSubmission = db.getSubmission;
} catch (e) { /* DB not configured */ }

try {
  const sheets = require('@/lib/sheets');
  syncToSheet = sheets.syncToSheet;
  formatForSheet = sheets.formatForSheet;
} catch (e) { /* Sheets not configured */ }

// In-memory session store
const sessions = new Map<string, ChatSession>();

// ====================
// SMOOTH GUIDE COPY VARIANTS
// ====================
const COPY = {
  stateConfirm: [
    (state: string) => `Solid — ${state} has some good options right now.`,
    (state: string) => `Nice. ${state} is a good market. Let me see what's available.`,
    (state: string) => `${state}, got it. You've got options there.`,
    (state: string) => `${state} — good choice. Plenty of books operate there.`,
  ],
  
  alreadyHavePrompt: [
    `Which of these do you already have an account with?`,
    `Quick check — which of these do you already use?`,
    `Which ones are you already signed up with?`,
    `Any of these you've already got?`,
  ],
  
  recommendation: [
    (op: string) => `Here's my recommendation: **${op}**.`,
    (op: string) => `Based on what you told me, I'd go with **${op}**.`,
    (op: string) => `**${op}** is the move for you.`,
    (op: string) => `For your situation, **${op}** is the best fit.`,
  ],
  
  signupEase: [
    `Their signup is fast — most people are done in under 2 minutes.`,
    `One of the quickest signups out there. Straightforward process.`,
    `Fast signup, minimal steps. You'll be in quickly.`,
    `Clean signup flow. Won't take more than a few minutes.`,
  ],
  
  backup: [
    (op: string) => `If that doesn't work out, **${op}** is also solid in your state.`,
    (op: string) => `Alternatively, **${op}** is another good option for you.`,
    (op: string) => `**${op}** would be my second pick if you want an alternative.`,
  ],
  
  noOffers: [
    (state: string) => `Looks like we don't have a new option in ${state} based on what you already have.`,
    (state: string) => `With what you've already got, there's not a new book to recommend in ${state} right now.`,
    (state: string) => `You've covered the main options in ${state}. Nothing new to add at the moment.`,
  ],
  
  noOffersFollowUp: [
    `Want to see what's available anyway, or change your list?`,
    `I can still show you what's there, or we can update your selections.`,
    `Happy to show everything anyway, or we can try a different approach.`,
  ],
  
  showingAnyway: [
    (state: string) => `Here's what's available in ${state} — even if you've got some of these:`,
    (state: string) => `Full list for ${state} coming up:`,
  ],
  
  restart: [
    `Starting fresh. What state are you in?`,
    `No problem, let's start over. Which state?`,
    `Clean slate. What state are you located in?`,
  ],
  
  // Verification flow copy
  awaitingSignup: [
    (op: string) => `Go ahead and sign up through that link. Let me know when you're done or if you hit any snags — I'm here to help.`,
    (op: string) => `Click through and get signed up. If anything looks confusing, just ask.`,
    (op: string) => `Take your time with the signup. Message me when you're through, or if you need help with any step.`,
  ],
  
  askForRegistration: [
    `Nice! Now send me a screenshot showing you completed registration. Just upload it here.`,
    `Good stuff. Can you send a screenshot showing your registration is complete? Drop it in the chat.`,
    `Perfect. Screenshot your completed registration and send it over.`,
  ],
  
  registrationReceived: [
    `Got it — registration confirmed. Now I need a screenshot of your first bet to verify. Can be any amount.`,
    `Registration looks good. One more thing — screenshot your first bet and send it over.`,
    `Perfect, that's the registration. Now just need proof of your first bet — any amount works.`,
  ],
  
  betReceived: [
    `All set on the verification side. Now let me get your info for the free year subscription.`,
    `Bet confirmed. Just need your name and email to set up your free year subscription.`,
    `Got the bet screenshot. To get your free subscription, what's your name and email?`,
  ],
  
  askName: [
    `What's your name?`,
    `And your name?`,
    `Who should I set this up for? (Name)`,
  ],
  
  askEmail: [
    (name: string) => `Thanks ${name}. What email should we send the subscription to?`,
    (name: string) => `Got it ${name}. What's your email?`,
    (name: string) => `${name} — what email do you want this sent to?`,
  ],
  
  complete: [
    (name: string, email: string) => `You're all set, ${name}! You'll get an email at ${email} with your subscription details within 24 hours. Thanks for signing up.`,
    (name: string, email: string) => `Done! ${name}, check ${email} in the next 24 hours for your free year subscription. Appreciate you.`,
    (name: string, email: string) => `That's it, ${name}. Subscription coming to ${email} within a day. Enjoy!`,
  ],
  
  helpDuringSignup: [
    `What part are you stuck on? I can walk you through it.`,
    `No worries — what step is giving you trouble?`,
    `Happy to help. What's the issue you're running into?`,
  ],
};

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

// Quick replies for different states
function getTerminalQuickReplies(): QuickReply[] {
  return [
    { id: 'change_state', label: 'Try a different state', action: 'change_state' },
    { id: 'change_books', label: 'Change the books I already have', action: 'change_books' },
    { id: 'show_anyway', label: 'Show available offers anyway', action: 'show_anyway' },
    { id: 'restart', label: 'Restart', action: 'restart' },
  ];
}

function getPostRecommendationQuickReplies(): QuickReply[] {
  return [
    { id: 'change_state', label: 'Try a different state', action: 'change_state' },
    { id: 'restart', label: 'Start over', action: 'restart' },
  ];
}

function getAwaitingSignupQuickReplies(): QuickReply[] {
  return [
    { id: 'done_signup', label: "I'm done signing up", action: 'done_signup' as any },
    { id: 'need_help', label: 'I need help', action: 'need_help' as any },
  ];
}

interface MessageRequest {
  sessionId: string;
  message?: string;
  state?: string;
  alreadyHave?: string[];
  action?: string;
  imageUploaded?: {
    type: 'registration' | 'bet';
    url: string;
  };
  userInfo?: {
    name?: string;
    email?: string;
  };
}

export async function POST(request: NextRequest) {
  const body: MessageRequest = await request.json();
  const { sessionId, message, state, alreadyHave, action, imageUploaded, userInfo } = body;
  
  // Get or create session
  let session = sessions.get(sessionId);
  if (!session) {
    session = {
      id: sessionId,
      state: 'welcome',
      alreadyHave: [],
      clicks: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    sessions.set(sessionId, session);
  }
  
  let response: ChatMessage;
  
  // ====================
  // HANDLE IMAGE UPLOADS
  // ====================
  
  if (imageUploaded) {
    if (imageUploaded.type === 'registration') {
      session.state = 'awaiting_bet';
      session.updatedAt = Date.now();
      
      response = {
        id: uuidv4(),
        role: 'assistant',
        content: pick(COPY.registrationReceived),
        timestamp: Date.now(),
      };
      
      return NextResponse.json({ 
        message: response, 
        state: session.state,
        expectUpload: 'bet',
      });
    }
    
    if (imageUploaded.type === 'bet') {
      session.state = 'collecting_info';
      session.updatedAt = Date.now();
      
      response = {
        id: uuidv4(),
        role: 'assistant',
        content: pick(COPY.betReceived) + '\n\n' + pick(COPY.askName),
        timestamp: Date.now(),
      };
      
      return NextResponse.json({ 
        message: response, 
        state: session.state,
        collectField: 'name',
      });
    }
  }
  
  // ====================
  // HANDLE USER INFO COLLECTION
  // ====================
  
  if (userInfo) {
    if (userInfo.name && !session.userName) {
      session.userName = userInfo.name;
      session.updatedAt = Date.now();
      
      response = {
        id: uuidv4(),
        role: 'assistant',
        content: pick(COPY.askEmail)(userInfo.name),
        timestamp: Date.now(),
      };
      
      return NextResponse.json({ 
        message: response, 
        state: session.state,
        collectField: 'email',
      });
    }
    
    if (userInfo.email && session.userName) {
      session.userEmail = userInfo.email;
      session.state = 'complete';
      session.updatedAt = Date.now();
      
      // Update DB with completed status (if DB configured)
      if (updateSubmission && getSubmission) {
        try {
          await updateSubmission(sessionId, {
            name: session.userName,
            email: userInfo.email,
            status: 'completed',
          });
          
          // Sync to sheet
          if (syncToSheet && formatForSheet) {
            const submission = await getSubmission(sessionId);
            if (submission) {
              await syncToSheet(formatForSheet(submission));
            }
          }
        } catch (error) {
          console.error('Failed to save completion:', error);
        }
      }
      
      response = {
        id: uuidv4(),
        role: 'assistant',
        content: pick(COPY.complete)(session.userName, userInfo.email),
        timestamp: Date.now(),
        quickReplies: [
          { id: 'restart', label: 'Sign up for another book', action: 'restart' },
        ],
      };
      
      return NextResponse.json({ 
        message: response, 
        state: session.state,
      });
    }
  }
  
  // ====================
  // HANDLE QUICK REPLY ACTIONS
  // ====================
  
  if (action === 'restart') {
    session.state = 'select_state';
    session.selectedState = undefined;
    session.alreadyHave = [];
    session.recommendedOffer = undefined;
    session.recommendedOperator = undefined;
    session.userName = undefined;
    session.userEmail = undefined;
    session.updatedAt = Date.now();
    
    response = {
      id: uuidv4(),
      role: 'assistant',
      content: pick(COPY.restart),
      timestamp: Date.now(),
    };
    return NextResponse.json({ message: response, state: session.state });
  }
  
  if (action === 'change_state') {
    session.state = 'select_state';
    session.updatedAt = Date.now();
    
    response = {
      id: uuidv4(),
      role: 'assistant',
      content: `No problem. What state do you want to try?`,
      timestamp: Date.now(),
    };
    return NextResponse.json({ message: response, state: session.state });
  }
  
  if (action === 'change_books') {
    session.state = 'select_already_have';
    session.alreadyHave = [];
    session.updatedAt = Date.now();
    
    response = {
      id: uuidv4(),
      role: 'assistant',
      content: `Got it. Let's update your list. Which of these do you already have?`,
      timestamp: Date.now(),
    };
    return NextResponse.json({ 
      message: response, 
      state: session.state,
      showMultiSelect: true,
    });
  }
  
  if (action === 'show_anyway') {
    const stateName = session.selectedState || '';
    const allOffers = await getAllOffersForState(stateName);
    
    if (allOffers.length === 0) {
      response = {
        id: uuidv4(),
        role: 'assistant',
        content: `Unfortunately there are no active offers in ${stateName} right now. Want to try a different state?`,
        timestamp: Date.now(),
        quickReplies: [
          { id: 'change_state', label: 'Try a different state', action: 'change_state' },
          { id: 'restart', label: 'Restart', action: 'restart' },
        ],
      };
      return NextResponse.json({ message: response, state: 'no_offers' });
    }
    
    const topOffers = allOffers.slice(0, 4);
    let content = pick(COPY.showingAnyway)(stateName) + '\n\n';
    
    content += topOffers.map((offer, i) => 
      `${i + 1}. **${offer.operator}** — ${offer.title}`
    ).join('\n');
    
    response = {
      id: uuidv4(),
      role: 'assistant',
      content,
      timestamp: Date.now(),
      buttons: topOffers.map(offer => ({
        id: `offer-${offer.wpId}`,
        label: `Sign Up for ${offer.operator}`,
        value: offer.operator,
        url: offer.buttonUrl,
      })),
      quickReplies: getPostRecommendationQuickReplies(),
    };
    
    return NextResponse.json({ 
      message: response, 
      state: 'show_recommendation',
      offer: topOffers[0],
    });
  }
  
  if (action === 'done_signup') {
    session.state = 'awaiting_registration';
    session.updatedAt = Date.now();
    
    response = {
      id: uuidv4(),
      role: 'assistant',
      content: pick(COPY.askForRegistration),
      timestamp: Date.now(),
    };
    
    return NextResponse.json({ 
      message: response, 
      state: session.state,
      expectUpload: 'registration',
    });
  }
  
  if (action === 'need_help') {
    response = {
      id: uuidv4(),
      role: 'assistant',
      content: pick(COPY.helpDuringSignup),
      timestamp: Date.now(),
      quickReplies: getAwaitingSignupQuickReplies(),
    };
    
    return NextResponse.json({ 
      message: response, 
      state: session.state,
    });
  }
  
  if (action === 'clicked_signup') {
    session.state = 'awaiting_signup';
    session.updatedAt = Date.now();
    
    // Create submission record (if DB configured)
    if (createSubmission) {
      try {
        await createSubmission({
          id: uuidv4(),
          sessionId,
          state: session.selectedState || '',
          operator: session.recommendedOperator || '',
          status: 'clicked_signup',
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
      } catch (error) {
        console.error('Failed to create submission:', error);
      }
    }
    
    const operator = session.recommendedOperator || 'the sportsbook';
    
    response = {
      id: uuidv4(),
      role: 'assistant',
      content: pick(COPY.awaitingSignup)(operator),
      timestamp: Date.now(),
      quickReplies: getAwaitingSignupQuickReplies(),
    };
    
    return NextResponse.json({ 
      message: response, 
      state: session.state,
    });
  }
  
  // ====================
  // HANDLE STATE SELECTION
  // ====================
  
  if (state) {
    const validState = US_STATES.find(
      s => s.name.toLowerCase() === state.toLowerCase() ||
           s.code.toLowerCase() === state.toLowerCase()
    );
    
    if (!validState) {
      response = {
        id: uuidv4(),
        role: 'assistant',
        content: "I didn't catch that state. Try selecting from the dropdown or typing the full state name.",
        timestamp: Date.now(),
      };
      return NextResponse.json({ message: response, state: session.state });
    }
    
    session.selectedState = validState.name;
    session.state = 'select_already_have';
    session.updatedAt = Date.now();
    
    const confirmMsg = pick(COPY.stateConfirm)(validState.name);
    const promptMsg = pick(COPY.alreadyHavePrompt);
    
    response = {
      id: uuidv4(),
      role: 'assistant',
      content: `${confirmMsg} ${promptMsg}`,
      timestamp: Date.now(),
      multiSelect: [
        ...V1_OPERATORS.map(op => ({
          id: op.toLowerCase(),
          label: op,
          value: op,
          selected: false,
        })),
        { id: 'none', label: "None of these", value: 'none', selected: false },
      ],
    };
    
    return NextResponse.json({ 
      message: response, 
      state: session.state,
      showMultiSelect: true,
    });
  }
  
  // ====================
  // HANDLE "ALREADY HAVE" SELECTION
  // ====================
  
  if (alreadyHave !== undefined) {
    session.alreadyHave = alreadyHave.filter(a => a !== 'none');
    session.state = 'show_recommendation';
    session.updatedAt = Date.now();
    
    const offers = await getOffersForState(session.selectedState || '');
    const { primary, backup } = getBestRecommendation(offers, session.alreadyHave);
    
    if (!primary) {
      session.state = 'no_offers';
      
      const noOffersMsg = pick(COPY.noOffers)(session.selectedState || 'your state');
      const followUpMsg = pick(COPY.noOffersFollowUp);
      
      response = {
        id: uuidv4(),
        role: 'assistant',
        content: `${noOffersMsg}\n\n${followUpMsg}`,
        timestamp: Date.now(),
        quickReplies: getTerminalQuickReplies(),
      };
      return NextResponse.json({ message: response, state: session.state });
    }
    
    session.recommendedOperator = primary.operator;
    session.recommendedOffer = primary;
    
    const recMsg = pick(COPY.recommendation)(primary.operator);
    const easeMsg = pick(COPY.signupEase);
    
    let content = `${recMsg}\n\n`;
    content += `📋 **${primary.title}**\n`;
    content += `${primary.description}\n\n`;
    content += easeMsg;
    
    if (backup) {
      content += `\n\n${pick(COPY.backup)(backup.operator)}`;
    }
    
    // Add note about verification + reward
    content += `\n\n**Bonus:** Complete signup + place your first bet, and you'll get a free year subscription as a thank you.`;
    
    response = {
      id: uuidv4(),
      role: 'assistant',
      content,
      timestamp: Date.now(),
      buttons: [
        {
          id: 'signup',
          label: `Sign Up for ${primary.operator}`,
          value: 'signup',
          url: primary.buttonUrl,
        },
        ...(backup ? [{
          id: 'backup',
          label: `Try ${backup.operator} Instead`,
          value: 'backup',
          url: backup.buttonUrl,
        }] : []),
      ],
      quickReplies: getPostRecommendationQuickReplies(),
    };
    
    return NextResponse.json({ 
      message: response, 
      state: session.state,
      offer: primary,
      backup,
    });
  }
  
  // ====================
  // HANDLE FREE-TEXT MESSAGE
  // ====================
  
  if (message) {
    // Check if we're collecting info
    if (session.state === 'collecting_info') {
      if (!session.userName) {
        // Treat as name
        return POST(new NextRequest(request.url, {
          method: 'POST',
          body: JSON.stringify({ sessionId, userInfo: { name: message } }),
        }));
      } else if (!session.userEmail) {
        // Validate email
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (emailRegex.test(message)) {
          return POST(new NextRequest(request.url, {
            method: 'POST',
            body: JSON.stringify({ sessionId, userInfo: { email: message } }),
          }));
        } else {
          response = {
            id: uuidv4(),
            role: 'assistant',
            content: `That doesn't look like a valid email. Try again?`,
            timestamp: Date.now(),
          };
          return NextResponse.json({ message: response, state: session.state, collectField: 'email' });
        }
      }
    }
    
    // Check for state input
    const matchedState = US_STATES.find(
      s => s.name.toLowerCase().includes(message.toLowerCase()) ||
           s.code.toLowerCase() === message.toLowerCase()
    );
    
    if (matchedState && session.state === 'select_state') {
      return POST(new NextRequest(request.url, {
        method: 'POST',
        body: JSON.stringify({ sessionId, state: matchedState.name }),
      }));
    }
    
    // Handle help questions during signup
    if (session.state === 'awaiting_signup') {
      response = {
        id: uuidv4(),
        role: 'assistant',
        content: pick(COPY.helpDuringSignup),
        timestamp: Date.now(),
        quickReplies: getAwaitingSignupQuickReplies(),
      };
      return NextResponse.json({ message: response, state: session.state });
    }
    
    // Default
    response = {
      id: uuidv4(),
      role: 'assistant',
      content: "I'm here to help you find the best sportsbook signup. What state are you in?",
      timestamp: Date.now(),
    };
    
    return NextResponse.json({ message: response, state: session.state });
  }
  
  // Default response
  response = {
    id: uuidv4(),
    role: 'assistant',
    content: "What state are you in? I'll find the best signup option for you.",
    timestamp: Date.now(),
  };
  
  return NextResponse.json({ message: response, state: session.state });
}
