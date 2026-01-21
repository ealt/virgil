export interface Location {
  path: string;
  startLine: number;
  endLine: number;
}

export interface WalkthroughStep {
  id: number;
  title: string;
  description: string;
  locations: Location[];
  notes?: string[];
}

export interface PRContext {
  number: number;
  url: string;
}

export interface WalkthroughContext {
  type: 'pr-review' | 'tour' | 'tutorial' | string;
  pr?: PRContext;
  description?: string;
}

export interface WalkthroughOverview {
  purpose: string;
  scope: string;
}

export interface WalkthroughSummary {
  keyTakeaways: string[];
  recommendation?: 'approve' | 'request-changes' | 'comment' | 'none';
}

export interface Walkthrough {
  title: string;
  description: string;
  author: string;
  created: string;
  context?: WalkthroughContext;
  overview: WalkthroughOverview;
  steps: WalkthroughStep[];
  summary: WalkthroughSummary;
}
