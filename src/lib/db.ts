// Neon DB Service for BetMate Submissions
import { neon } from '@neondatabase/serverless';
import type { Submission, SubmissionStatus } from './types';

const sql = neon(process.env.DATABASE_URL || '');

// Initialize the submissions table
export async function initDB() {
  await sql`
    CREATE TABLE IF NOT EXISTS betmate_submissions (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL,
      state TEXT,
      operator TEXT,
      status TEXT NOT NULL DEFAULT 'started',
      registration_screenshot_url TEXT,
      bet_screenshot_url TEXT,
      name TEXT,
      email TEXT,
      created_at BIGINT NOT NULL,
      updated_at BIGINT NOT NULL
    )
  `;
  
  // Create index on session_id for lookups
  await sql`
    CREATE INDEX IF NOT EXISTS idx_betmate_session_id 
    ON betmate_submissions(session_id)
  `;
}

// Create a new submission
export async function createSubmission(submission: Submission): Promise<void> {
  await sql`
    INSERT INTO betmate_submissions (
      id, session_id, state, operator, status,
      registration_screenshot_url, bet_screenshot_url,
      name, email, created_at, updated_at
    ) VALUES (
      ${submission.id},
      ${submission.sessionId},
      ${submission.state},
      ${submission.operator},
      ${submission.status},
      ${submission.registrationScreenshotUrl || null},
      ${submission.betScreenshotUrl || null},
      ${submission.name || null},
      ${submission.email || null},
      ${submission.createdAt},
      ${submission.updatedAt}
    )
  `;
}

// Update submission
export async function updateSubmission(
  sessionId: string, 
  updates: Partial<Omit<Submission, 'id' | 'sessionId' | 'createdAt'>>
): Promise<void> {
  const now = Date.now();
  
  // Build dynamic update
  const setClauses: string[] = ['updated_at = ' + now];
  
  if (updates.state !== undefined) {
    setClauses.push(`state = '${updates.state}'`);
  }
  if (updates.operator !== undefined) {
    setClauses.push(`operator = '${updates.operator}'`);
  }
  if (updates.status !== undefined) {
    setClauses.push(`status = '${updates.status}'`);
  }
  if (updates.registrationScreenshotUrl !== undefined) {
    setClauses.push(`registration_screenshot_url = '${updates.registrationScreenshotUrl}'`);
  }
  if (updates.betScreenshotUrl !== undefined) {
    setClauses.push(`bet_screenshot_url = '${updates.betScreenshotUrl}'`);
  }
  if (updates.name !== undefined) {
    setClauses.push(`name = '${updates.name}'`);
  }
  if (updates.email !== undefined) {
    setClauses.push(`email = '${updates.email}'`);
  }
  
  await sql`
    UPDATE betmate_submissions 
    SET updated_at = ${now},
        state = COALESCE(${updates.state || null}, state),
        operator = COALESCE(${updates.operator || null}, operator),
        status = COALESCE(${updates.status || null}, status),
        registration_screenshot_url = COALESCE(${updates.registrationScreenshotUrl || null}, registration_screenshot_url),
        bet_screenshot_url = COALESCE(${updates.betScreenshotUrl || null}, bet_screenshot_url),
        name = COALESCE(${updates.name || null}, name),
        email = COALESCE(${updates.email || null}, email)
    WHERE session_id = ${sessionId}
  `;
}

// Get submission by session ID
export async function getSubmission(sessionId: string): Promise<Submission | null> {
  const rows = await sql`
    SELECT * FROM betmate_submissions WHERE session_id = ${sessionId} LIMIT 1
  `;
  
  if (rows.length === 0) return null;
  
  const row = rows[0];
  return {
    id: row.id as string,
    sessionId: row.session_id as string,
    state: row.state as string,
    operator: row.operator as string,
    status: row.status as SubmissionStatus,
    registrationScreenshotUrl: row.registration_screenshot_url as string | undefined,
    betScreenshotUrl: row.bet_screenshot_url as string | undefined,
    name: row.name as string | undefined,
    email: row.email as string | undefined,
    createdAt: Number(row.created_at),
    updatedAt: Number(row.updated_at),
  };
}

// Get all submissions (for admin/reporting)
export async function getAllSubmissions(limit = 100): Promise<Submission[]> {
  const rows = await sql`
    SELECT * FROM betmate_submissions 
    ORDER BY created_at DESC 
    LIMIT ${limit}
  `;
  
  return rows.map(row => ({
    id: row.id as string,
    sessionId: row.session_id as string,
    state: row.state as string,
    operator: row.operator as string,
    status: row.status as SubmissionStatus,
    registrationScreenshotUrl: row.registration_screenshot_url as string | undefined,
    betScreenshotUrl: row.bet_screenshot_url as string | undefined,
    name: row.name as string | undefined,
    email: row.email as string | undefined,
    createdAt: Number(row.created_at),
    updatedAt: Number(row.updated_at),
  }));
}
