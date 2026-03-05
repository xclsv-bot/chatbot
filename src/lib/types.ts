// BetMate Types

export interface WPOffer {
  wp_id: number;
  label: string;
  active: boolean;
  title: string;
  description: string;
  button_text: string;
  button_url: string;
  image_id: number;
  terms: string;
  types: string[];
  updated_gmt: string;
}

export interface WPState {
  wp_id: number;
  state_name: string;
  shortcode: string;
  offer_ids: number[];
  offers: WPOffer[];
  updated_gmt: string;
}

export interface WPStatesResponse {
  states: WPState[];
}

export interface WPOffersResponse {
  offers: WPOffer[];
}

export interface NormalizedOffer {
  wpId: number;
  operator: string;       // Normalized operator name (e.g., "DraftKings")
  originalLabel: string;  // Original WP label
  title: string;
  description: string;
  buttonUrl: string;
  signupEaseScore: number;
  isActive: boolean;
}

export interface ChatMessage {
  id: string;
  role: 'assistant' | 'user';
  content: string;
  timestamp: number;
  buttons?: ChatButton[];
  multiSelect?: MultiSelectOption[];
  quickReplies?: QuickReply[];
}

export interface QuickReply {
  id: string;
  label: string;
  action: 'restart' | 'change_state' | 'change_books' | 'show_anyway';
}

export interface ChatButton {
  id: string;
  label: string;
  value: string;
  url?: string;  // For external links
}

export interface MultiSelectOption {
  id: string;
  label: string;
  value: string;
  selected?: boolean;
}

export interface ChatSession {
  id: string;
  state: ChatState;
  selectedState?: string;
  alreadyHave: string[];
  recommendedOperator?: string;
  recommendedOffer?: NormalizedOffer;
  userName?: string;
  userEmail?: string;
  clicks: ClickEvent[];
  createdAt: number;
  updatedAt: number;
}

export type ChatState = 
  | 'welcome'
  | 'select_state'
  | 'select_already_have'
  | 'show_recommendation'
  | 'no_offers'
  | 'awaiting_signup'           // After clicking signup link
  | 'awaiting_registration'     // Waiting for registration screenshot
  | 'awaiting_bet'              // Waiting for bet screenshot
  | 'collecting_info'           // Collecting name + email
  | 'complete';                 // All done

// Submission status for tracking funnel
export type SubmissionStatus = 
  | 'started'
  | 'clicked_signup'
  | 'registration_submitted'
  | 'bet_submitted'
  | 'completed';

// Submission record stored in DB
export interface Submission {
  id: string;
  sessionId: string;
  state: string;
  operator: string;
  status: SubmissionStatus;
  registrationScreenshotUrl?: string;
  betScreenshotUrl?: string;
  name?: string;
  email?: string;
  createdAt: number;
  updatedAt: number;
}

export interface ClickEvent {
  operator: string;
  offerId: number;
  buttonUrl: string;
  timestamp: number;
}

export interface RecommendationResult {
  found: boolean;
  offer?: NormalizedOffer;
  backup?: NormalizedOffer;
  reason?: string;
}
