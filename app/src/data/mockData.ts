import { generateAvatarUrl } from '@/utils/avatarUtils';

// Mock data for development
export const mockUser = {
  id: '1',
  name: 'Alex Chen',
  avatar: generateAvatarUrl('Alex Chen', '1', 'notionists'),
  avatarStyle: 'notionists' as const,
  monthlyBudget: 150,
  currency: 'USD',
  persona: {
    emoji: '🎯',
    title: 'Strategic Optimizer',
    description: 'You carefully evaluate each subscription, preferring quality over quantity. You enjoy trying new services but are quick to cancel if they don\'t deliver value.',
    tip: 'Consider bundling your streaming services - family plans can save you 40% compared to individual subscriptions.'
  }
};

export const mockSubscriptions = [
  // Entertainment
  {
    id: '1',
    name: 'Netflix',
    plan: 'Premium Plan',
    cost: 19.99,
    icon: '🎬',
    category: 'Entertainment',
    status: 'active' as const,
    renewalDate: '2026-02-15',
    billingCycle: 'monthly' as const,
    isReminder: false,
  },
  {
    id: '2',
    name: 'Spotify',
    plan: 'Family Plan',
    cost: 15.99,
    icon: '🎵',
    category: 'Entertainment',
    status: 'active' as const,
    renewalDate: '2026-02-20',
    billingCycle: 'monthly' as const,
    isReminder: false,
  },
  {
    id: '3',
    name: 'Disney+',
    plan: 'Standard',
    cost: 0,
    icon: '✨',
    category: 'Entertainment',
    status: 'active' as const,
    renewalDate: '2026-02-18',
    billingCycle: 'monthly' as const,
    isReminder: true, // Trial ending soon
  },
  // Productivity
  {
    id: '4',
    name: 'Notion',
    plan: 'Personal Pro',
    cost: 10.00,
    icon: '📝',
    category: 'Productivity',
    status: 'active' as const,
    renewalDate: '2026-02-12',
    billingCycle: 'monthly' as const,
    isReminder: false,
  },
  {
    id: '5',
    name: 'ChatGPT Plus',
    plan: 'Plus',
    cost: 20.00,
    icon: '🤖',
    category: 'Productivity',
    status: 'active' as const,
    renewalDate: '2026-02-25',
    billingCycle: 'monthly' as const,
    isReminder: false,
  },
  // Utilities
  {
    id: '6',
    name: 'iCloud',
    plan: '200GB',
    cost: 2.99,
    icon: '☁️',
    category: 'Utilities',
    status: 'active' as const,
    renewalDate: '2026-02-10',
    billingCycle: 'monthly' as const,
    isReminder: false,
  },
  {
    id: '7',
    name: 'GitHub',
    plan: 'Pro',
    cost: 4.00,
    icon: '🐙',
    category: 'Utilities',
    status: 'paused' as const,
    renewalDate: '2026-03-01',
    billingCycle: 'monthly' as const,
    isReminder: false,
  },
  // Health
  {
    id: '8',
    name: 'Headspace',
    plan: 'Annual',
    cost: 12.99,
    icon: '🧘',
    category: 'Health',
    status: 'active' as const,
    renewalDate: '2026-02-22',
    billingCycle: 'monthly' as const,
    isReminder: false,
  },
];
