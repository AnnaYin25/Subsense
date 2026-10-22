
import React, { createContext, useContext, useState, ReactNode } from 'react';
import { Subscription, AssessmentReport } from '../types.ts';
import { MOCK_SUBSCRIPTIONS } from '../constants.ts';

interface UserProfile {
  name: string;
  avatar: string;
  avatarType: string;
  monthlyBudget: number;
  age?: string;
  usagePattern?: string;
  persona?: {
    title: string;
    description: string;
    tip: string;
    emoji: string;
  };
}

interface SubscriptionContextType {
  subscriptions: Subscription[];
  auditReports: AssessmentReport[];
  addSubscription: (sub: Subscription) => void;
  updateSubscription: (id: string, sub: Partial<Subscription>) => void;
  removeSubscription: (id: string) => void;
  getSubscription: (id: string) => Subscription | undefined;
  addAuditReport: (report: AssessmentReport) => void;
  user: UserProfile;
  updateUser: (updates: Partial<UserProfile>) => void;
}

const INITIAL_AUDITS: AssessmentReport[] = [
  {
    id: 'audit-1',
    name: 'Disney+',
    score: 72,
    status: 'Good',
    color: 'text-green-600 bg-green-50 dark:bg-green-900/20',
    date: '2026-02-10',
    cost: '$13.99/mo',
    category: 'Entertainment',
    recommendation: 'Proceed with monthly plan.',
    factors: [
       { title: 'Content Overlap', desc: 'You already subscribe to Netflix and Hulu, which covers 60% of similar genres. Consider rotating services.', type: 'risk', severity: 'medium' },
       { title: 'Price to Value', desc: 'At $13.99, the cost per hour of entertainment is projected to be low ($0.50/hr) based on your viewing habits.', type: 'pass' }
    ]
  },
  {
    id: 'audit-2',
    name: 'Calm Premium',
    score: 48,
    status: 'Poor',
    color: 'text-orange-600 bg-orange-50 dark:bg-orange-900/20',
    date: '2026-02-05',
    cost: '$69.99/yr',
    category: 'Health',
    recommendation: 'Wait 30 days. Try free alternatives first.',
    factors: [
      { title: 'Usage Probability', desc: 'Historical data shows you access meditation apps less than twice a month.', type: 'risk', severity: 'high' }
    ]
  }
];

const SubscriptionContext = createContext<SubscriptionContextType | undefined>(undefined);

export const SubscriptionProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [subscriptions, setSubscriptions] = useState<Subscription[]>(MOCK_SUBSCRIPTIONS);
  const [auditReports, setAuditReports] = useState<AssessmentReport[]>(INITIAL_AUDITS);
  const [user, setUser] = useState<UserProfile>({
    name: "Alex Johnson",
    avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Alex",
    avatarType: "Pro Saver",
    monthlyBudget: 250.00,
    age: '28',
    usagePattern: 'Balanced',
    persona: {
      title: "The Content Explorer",
      description: "You love variety but sometimes subscribe to platforms for just one show. You're great at finding niche content!",
      tip: "Try rotating your streaming services: subscribe to one for 3 months, then switch to another to catch up on their exclusives.",
      emoji: "🧭"
    }
  });

  const addSubscription = (sub: Subscription) => {
    setSubscriptions(prev => [sub, ...prev]);
  };

  const updateSubscription = (id: string, updatedFields: Partial<Subscription>) => {
    setSubscriptions(prev => prev.map(s => s.id === id ? { ...s, ...updatedFields } : s));
  };

  const removeSubscription = (id: string) => {
    setSubscriptions(prev => prev.filter(s => s.id !== id));
  };

  const getSubscription = (id: string) => {
    return subscriptions.find(s => s.id === id);
  };

  const addAuditReport = (report: AssessmentReport) => {
    setAuditReports(prev => [report, ...prev]);
  };

  const updateUser = (updates: Partial<UserProfile>) => {
    setUser(prev => ({ ...prev, ...updates }));
  };

  return (
    <SubscriptionContext.Provider value={{ 
      subscriptions, 
      auditReports, 
      addSubscription, 
      updateSubscription,
      removeSubscription, 
      getSubscription, 
      addAuditReport, 
      user,
      updateUser
    }}>
      {children}
    </SubscriptionContext.Provider>
  );
};

export const useSubscriptions = () => {
  const context = useContext(SubscriptionContext);
  if (!context) {
    throw new Error('useSubscriptions must be used within a SubscriptionProvider');
  }
  return context;
};

// Date Utility for the entire app
export const formatDate = (dateString: string) => {
  if (!dateString) return 'N/A';
  // Manually parse YYYY-MM-DD to avoid timezone shifting
  const parts = dateString.split('-');
  const year = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10) - 1; // Months are 0-indexed
  const day = parseInt(parts[2], 10);
  
  const date = new Date(year, month, day);
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  }).format(date);
};

export const calculateNextRenewal = (startDate: string, cycle: string): string => {
  const start = new Date(startDate);
  const now = new Date();
  let next = new Date(start);

  while (next <= now) {
    if (cycle === '/mo') next.setMonth(next.getMonth() + 1);
    else if (cycle === '/yr') next.setFullYear(next.getFullYear() + 1);
    else if (cycle === '/qtr') next.setMonth(next.getMonth() + 3);
    else if (cycle === '/wk') next.setDate(next.getDate() + 7);
    else {
      // Fallback if no cycle provided
      next.setMonth(next.getMonth() + 1);
      break;
    }
  }
  return next.toISOString().split('T')[0];
};
