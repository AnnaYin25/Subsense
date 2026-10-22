
export interface Subscription {
  id: string;
  name: string;
  plan: string;
  cost: number;
  icon: string; // Emoji character
  color: string;
  usageScore?: number; // 0-100
  status: 'active' | 'paused' | 'cancelled';
  startDate?: string; // Original first payment date
  renewalDate: string; // Next payment date
  category: 'Entertainment' | 'Productivity' | 'Utilities' | 'Health';
  usageHistory: number[]; // Historical usage scores (0-100)
  customFields?: { label: string; value: string }[];
  isReminder?: boolean; // Flag for trial end reminders
}

export interface Factor {
  title: string;
  desc: string;
  type: 'risk' | 'pass';
  severity?: 'high' | 'medium' | 'low';
}

export interface AssessmentReport {
  id: string;
  name: string;
  score: number;
  status: 'Good' | 'Fair' | 'Poor';
  color: string;
  date: string;
  cost: string;
  recommendation: string;
  factors: Factor[];
  category: 'Entertainment' | 'Productivity' | 'Utilities' | 'Health';
}

export enum ViewState {
  ONBOARDING = 'ONBOARDING',
  SETUP = 'SETUP',
  HUB = 'HUB',
  CHECKIN = 'CHECKIN',
  ASSESSMENT = 'ASSESSMENT',
  REPORT = 'REPORT'
}
