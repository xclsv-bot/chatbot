import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';

// Vercel Blob - conditionally import
let put: any;
try {
  const blob = require('@vercel/blob');
  put = blob.put;
} catch (e) {
  // Blob not available
}

// DB imports - conditionally import to avoid errors if not configured
let updateSubmission: any, getSubmission: any, createSubmission: any;
let syncToSheet: any, formatForSheet: any;
try {
  const db = require('@/lib/db');
  updateSubmission = db.updateSubmission;
  getSubmission = db.getSubmission;
  createSubmission = db.createSubmission;
} catch (e) {
  // DB not available
}

try {
  const sheets = require('@/lib/sheets');
  syncToSheet = sheets.syncToSheet;
  formatForSheet = sheets.formatForSheet;
} catch (e) {
  // Sheets not available
}

import type { SubmissionStatus } from '@/lib/types';

interface UploadRequest {
  sessionId: string;
  type: 'registration' | 'bet';
  state?: string;
  operator?: string;
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const sessionId = formData.get('sessionId') as string;
    const type = formData.get('type') as 'registration' | 'bet';
    const state = formData.get('state') as string | null;
    const operator = formData.get('operator') as string | null;
    
    if (!file || !sessionId || !type) {
      return NextResponse.json(
        { error: 'Missing required fields: file, sessionId, type' },
        { status: 400 }
      );
    }
    
    // Validate file type
    const validTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'];
    if (!validTypes.includes(file.type)) {
      return NextResponse.json(
        { error: 'Invalid file type. Please upload PNG, JPG, or WEBP.' },
        { status: 400 }
      );
    }
    
    // Validate file size (max 10MB)
    const maxSize = 10 * 1024 * 1024;
    if (file.size > maxSize) {
      return NextResponse.json(
        { error: 'File too large. Maximum size is 10MB.' },
        { status: 400 }
      );
    }
    
    // Check if blob storage is configured
    if (!put || !process.env.BLOB_READ_WRITE_TOKEN) {
      return NextResponse.json(
        { error: 'Image storage not configured. Contact support.' },
        { status: 503 }
      );
    }
    
    // Generate filename with date folder structure
    const date = new Date();
    const folder = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    const ext = file.name.split('.').pop() || 'png';
    const filename = `betmate/${folder}/${sessionId}-${type}.${ext}`;
    
    // Upload to Vercel Blob
    const blob = await put(filename, file, {
      access: 'public',
      addRandomSuffix: false,
    });
    
    // Determine new status based on upload type
    let newStatus: SubmissionStatus;
    if (type === 'registration') {
      newStatus = 'registration_submitted';
    } else {
      newStatus = 'bet_submitted';
    }
    
    // Save to DB if configured
    let submission: any = null;
    if (getSubmission && createSubmission && updateSubmission) {
      try {
        submission = await getSubmission(sessionId);
        
        if (!submission) {
          submission = {
            id: uuidv4(),
            sessionId,
            state: state || '',
            operator: operator || '',
            status: newStatus,
            registrationScreenshotUrl: type === 'registration' ? blob.url : undefined,
            betScreenshotUrl: type === 'bet' ? blob.url : undefined,
            createdAt: Date.now(),
            updatedAt: Date.now(),
          };
          await createSubmission(submission);
        } else {
          const updates: Record<string, any> = {
            status: newStatus,
            updatedAt: Date.now(),
          };
          
          if (type === 'registration') {
            updates.registrationScreenshotUrl = blob.url;
          } else {
            updates.betScreenshotUrl = blob.url;
          }
          
          if (state) updates.state = state;
          if (operator) updates.operator = operator;
          
          await updateSubmission(sessionId, updates);
          submission = await getSubmission(sessionId);
        }
      } catch (dbError) {
        console.error('DB error:', dbError);
        // Continue without DB - image still uploaded
      }
    }
    
    // Sync to Google Sheet if configured
    if (submission && syncToSheet && formatForSheet) {
      try {
        await syncToSheet(formatForSheet(submission));
      } catch (sheetError) {
        console.error('Sheet sync error:', sheetError);
      }
    }
    
    return NextResponse.json({
      success: true,
      url: blob.url,
      type,
      status: newStatus,
    });
    
  } catch (error) {
    console.error('Upload error:', error);
    return NextResponse.json(
      { error: 'Upload failed. Please try again.' },
      { status: 500 }
    );
  }
}
