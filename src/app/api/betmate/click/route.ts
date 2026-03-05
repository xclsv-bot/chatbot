import { NextRequest, NextResponse } from 'next/server';

// In-memory click log (replace with DB in production)
const clickLog: Array<{
  sessionId: string;
  operator: string;
  offerId: number;
  buttonUrl: string;
  state: string;
  alreadyHave: string[];
  timestamp: number;
}> = [];

interface ClickRequest {
  sessionId: string;
  operator: string;
  offerId: number;
  buttonUrl: string;
  state?: string;
  alreadyHave?: string[];
}

export async function POST(request: NextRequest) {
  const body: ClickRequest = await request.json();
  
  const clickEvent = {
    sessionId: body.sessionId,
    operator: body.operator,
    offerId: body.offerId,
    buttonUrl: body.buttonUrl,
    state: body.state || '',
    alreadyHave: body.alreadyHave || [],
    timestamp: Date.now(),
  };
  
  clickLog.push(clickEvent);
  
  // Log for monitoring (in production, this would go to analytics)
  console.log('[BetMate Click]', {
    sessionId: body.sessionId.slice(0, 8) + '...',
    operator: body.operator,
    state: body.state,
  });
  
  return NextResponse.json({ success: true });
}

// GET endpoint for analytics (protected in production)
export async function GET() {
  return NextResponse.json({
    totalClicks: clickLog.length,
    recentClicks: clickLog.slice(-10),
  });
}
