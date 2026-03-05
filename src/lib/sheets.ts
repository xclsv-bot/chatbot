// Google Sheets Sync for BetMate Submissions
// Uses a simple fetch-based approach with the Sheets API

const SHEET_ID = process.env.GOOGLE_SHEET_ID || '';
const API_KEY = process.env.GOOGLE_API_KEY || '';
const SHEET_NAME = 'BetMate Submissions';

interface SheetRow {
  sessionId: string;
  state: string;
  operator: string;
  status: string;
  registrationScreenshotUrl: string;
  betScreenshotUrl: string;
  name: string;
  email: string;
  createdAt: string;
  updatedAt: string;
}

// For V1, we'll use a simple webhook approach
// The sheet will be updated via a Google Apps Script webhook
// This keeps auth simple and avoids service account setup

export async function syncToSheet(data: SheetRow): Promise<void> {
  const webhookUrl = process.env.GOOGLE_SHEET_WEBHOOK;
  
  if (!webhookUrl) {
    console.warn('GOOGLE_SHEET_WEBHOOK not configured, skipping sheet sync');
    return;
  }
  
  try {
    await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'upsert',
        key: data.sessionId,
        data: {
          session_id: data.sessionId,
          state: data.state,
          operator: data.operator,
          status: data.status,
          registration_screenshot: data.registrationScreenshotUrl,
          bet_screenshot: data.betScreenshotUrl,
          name: data.name,
          email: data.email,
          created_at: data.createdAt,
          updated_at: data.updatedAt,
        },
      }),
    });
  } catch (error) {
    console.error('Failed to sync to Google Sheet:', error);
    // Don't throw - sheet sync is non-critical
  }
}

// Format submission for sheet
export function formatForSheet(submission: {
  sessionId: string;
  state?: string;
  operator?: string;
  status: string;
  registrationScreenshotUrl?: string;
  betScreenshotUrl?: string;
  name?: string;
  email?: string;
  createdAt: number;
  updatedAt: number;
}): SheetRow {
  return {
    sessionId: submission.sessionId,
    state: submission.state || '',
    operator: submission.operator || '',
    status: submission.status,
    registrationScreenshotUrl: submission.registrationScreenshotUrl || '',
    betScreenshotUrl: submission.betScreenshotUrl || '',
    name: submission.name || '',
    email: submission.email || '',
    createdAt: new Date(submission.createdAt).toISOString(),
    updatedAt: new Date(submission.updatedAt).toISOString(),
  };
}
