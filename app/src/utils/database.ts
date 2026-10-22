/**
 * Database Utility Functions
 * Convenient wrappers for Supabase queries
 */

import { supabase } from './supabase';
import type { User, Subscription, UserPersona, CheckInLog } from '@/types';

// ============================================================================
// USER OPERATIONS
// ============================================================================

/**
 * Get current user profile
 */
export const getUserProfile = async (userId: string): Promise<User | null> => {
  try {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .single();

    if (error) throw error;
    return data as User;
  } catch (error) {
    console.error('Error fetching user profile:', error);
    return null;
  }
};

/**
 * Create or update user profile
 */
export const upsertUserProfile = async (user: User): Promise<boolean> => {
  try {
    const { error } = await supabase
      .from('users')
      .upsert({
        id: user.id,
        email: user.email,
        name: user.name,
        avatar_style: user.avatarStyle,
        age: user.age,
        monthly_budget: user.monthlyBudget,
        currency: user.currency,
        reminder_day: user.reminderDay,
        reminder_days_before: user.reminderDaysBefore,
        updated_at: new Date().toISOString(),
      });

    if (error) throw error;
    return true;
  } catch (error) {
    console.error('Error upserting user profile:', error);
    return false;
  }
};

// ============================================================================
// USER PERSONA OPERATIONS
// ============================================================================

/**
 * Get user persona data
 */
export const getUserPersona = async (userId: string): Promise<UserPersona | null> => {
  try {
    const { data, error } = await supabase
      .from('user_personas')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error) {
      // If no persona exists yet, return null (not an error)
      if (error.code === 'PGRST116') return null;
      throw error;
    }

    return data as UserPersona;
  } catch (error) {
    console.error('Error fetching user persona:', error);
    return null;
  }
};

/**
 * Create or update user persona
 */
export const upsertUserPersona = async (persona: UserPersona): Promise<boolean> => {
  try {
    const { error } = await supabase
      .from('user_personas')
      .upsert({
        id: persona.id,
        user_id: persona.userId,
        structured_data: persona.structuredData,
        conversation_history: persona.conversationHistory,
        updated_at: new Date().toISOString(),
      });

    if (error) throw error;
    return true;
  } catch (error) {
    console.error('Error upserting user persona:', error);
    return false;
  }
};

// ============================================================================
// SUBSCRIPTION OPERATIONS
// ============================================================================

/**
 * Get all subscriptions for a user
 */
export const getUserSubscriptions = async (userId: string): Promise<Subscription[]> => {
  try {
    const { data, error } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('user_id', userId)
      .order('next_renewal_date', { ascending: true });

    if (error) throw error;
    return (data || []).map(mapSubscriptionFromDB);
  } catch (error) {
    console.error('Error fetching subscriptions:', error);
    return [];
  }
};

/**
 * Get subscriptions by status
 */
export const getSubscriptionsByStatus = async (
  userId: string,
  status: 'active' | 'paused' | 'cancelled' | 'watchlist'
): Promise<Subscription[]> => {
  try {
    const { data, error } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('user_id', userId)
      .eq('status', status)
      .order('next_renewal_date', { ascending: true });

    if (error) throw error;
    return (data || []).map(mapSubscriptionFromDB);
  } catch (error) {
    console.error('Error fetching subscriptions by status:', error);
    return [];
  }
};

/**
 * Get subscriptions by category
 */
export const getSubscriptionsByCategory = async (
  userId: string,
  category: string
): Promise<Subscription[]> => {
  try {
    const { data, error } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('user_id', userId)
      .eq('category', category)
      .eq('status', 'active')
      .order('cost', { ascending: false });

    if (error) throw error;
    return (data || []).map(mapSubscriptionFromDB);
  } catch (error) {
    console.error('Error fetching subscriptions by category:', error);
    return [];
  }
};

/**
 * Get a single subscription by ID
 */
export const getSubscription = async (subscriptionId: string): Promise<Subscription | null> => {
  try {
    const { data, error } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('id', subscriptionId)
      .single();

    if (error) throw error;
    return mapSubscriptionFromDB(data);
  } catch (error) {
    console.error('Error fetching subscription:', error);
    return null;
  }
};

/**
 * Create a new subscription
 */
export const createSubscription = async (subscription: Omit<Subscription, 'id' | 'createdAt' | 'updatedAt'>): Promise<Subscription | null> => {
  try {
    const { data, error } = await supabase
      .from('subscriptions')
      .insert({
        user_id: subscription.userId,
        name: subscription.name,
        plan_name: subscription.planName,
        cost: subscription.cost,
        billing_cycle: subscription.billingCycle,
        category: subscription.category,
        icon_emoji: subscription.iconEmoji,
        color: subscription.color,
        status: subscription.status,
        is_reminder: subscription.isReminder,
        start_date: subscription.startDate,
        next_renewal_date: subscription.nextRenewalDate,
        usage_score: subscription.usageScore,
        satisfaction_score: subscription.satisfactionScore,
        notes: subscription.notes,
      })
      .select()
      .single();

    if (error) throw error;
    return mapSubscriptionFromDB(data);
  } catch (error) {
    console.error('Error creating subscription:', error);
    return null;
  }
};

/**
 * Update a subscription
 */
export const updateSubscription = async (
  subscriptionId: string,
  updates: Partial<Subscription>
): Promise<boolean> => {
  try {
    const updateData: any = {};

    if (updates.name !== undefined) updateData.name = updates.name;
    if (updates.planName !== undefined) updateData.plan_name = updates.planName;
    if (updates.cost !== undefined) updateData.cost = updates.cost;
    if (updates.billingCycle !== undefined) updateData.billing_cycle = updates.billingCycle;
    if (updates.category !== undefined) updateData.category = updates.category;
    if (updates.iconEmoji !== undefined) updateData.icon_emoji = updates.iconEmoji;
    if (updates.color !== undefined) updateData.color = updates.color;
    if (updates.status !== undefined) updateData.status = updates.status;
    if (updates.isReminder !== undefined) updateData.is_reminder = updates.isReminder;
    if (updates.startDate !== undefined) updateData.start_date = updates.startDate;
    if (updates.nextRenewalDate !== undefined) updateData.next_renewal_date = updates.nextRenewalDate;
    if (updates.usageScore !== undefined) updateData.usage_score = updates.usageScore;
    if (updates.satisfactionScore !== undefined) updateData.satisfaction_score = updates.satisfactionScore;
    if (updates.notes !== undefined) updateData.notes = updates.notes;
    if (updates.lastUsedRecency !== undefined) updateData.last_used_recency = updates.lastUsedRecency;
    if (updates.usageType !== undefined) updateData.usage_type = updates.usageType;
    if (updates.retentionAnchor !== undefined) updateData.retention_anchor = updates.retentionAnchor;
    if (updates.cancellationReason !== undefined) updateData.cancellation_reason = updates.cancellationReason;

    updateData.updated_at = new Date().toISOString();

    const { error } = await supabase
      .from('subscriptions')
      .update(updateData)
      .eq('id', subscriptionId);

    if (error) throw error;
    return true;
  } catch (error) {
    console.error('Error updating subscription:', error);
    return false;
  }
};

/**
 * Delete a subscription
 */
export const deleteSubscription = async (subscriptionId: string): Promise<boolean> => {
  try {
    const { error } = await supabase
      .from('subscriptions')
      .delete()
      .eq('id', subscriptionId);

    if (error) throw error;
    return true;
  } catch (error) {
    console.error('Error deleting subscription:', error);
    return false;
  }
};

// ============================================================================
// CHECK-IN LOG OPERATIONS
// Requires DB migration — see Docs/plans/2026-02-25-weekly-checkin-plan.md
// SQL: CREATE TABLE check_ins (id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
//   user_id uuid REFERENCES auth.users NOT NULL, sub_id uuid REFERENCES subscriptions NOT NULL,
//   created_at timestamptz DEFAULT now(), action text CHECK (action IN ('love','review','unsure')),
//   q1_answer text, q2_answer text, dive_deeper text);
// ============================================================================

/**
 * Insert a check-in log entry.
 * Silently returns false if the check_ins table doesn't exist yet.
 */
export const insertCheckInLog = async (log: CheckInLog): Promise<boolean> => {
  try {
    const { error } = await supabase.from('check_ins').insert({
      user_id: log.userId,
      sub_id: log.subId,
      action: log.action,
      q1_answer: log.q1Answer,
      q2_answer: log.q2Answer,
      dive_deeper: log.diveDeeperNote,
    });
    if (error) throw error;
    return true;
  } catch (error) {
    console.warn('[CheckIn] insertCheckInLog failed (run DB migration?):', error);
    return false;
  }
};

// ============================================================================
// CHECK-IN RESPONSE OPERATIONS
// ============================================================================

export interface CheckinResponseRecord {
  checkin_id: string;
  checkin_date: string;
  subscription_id: string;
  swipe_direction: 'left' | 'right' | 'down';
}

/**
 * Fetch recent check-in responses for a user, up to `monthsBack` months.
 * Maps action ('love'|'review'|'unsure') → swipe_direction ('right'|'left'|'down').
 */
export const getRecentCheckinResponses = async (
  userId: string,
  monthsBack: number,
): Promise<CheckinResponseRecord[]> => {
  try {
    const since = new Date();
    since.setMonth(since.getMonth() - monthsBack);

    const { data, error } = await supabase
      .from('check_ins')
      .select('id, created_at, sub_id, action')
      .eq('user_id', userId)
      .gte('created_at', since.toISOString())
      .order('created_at', { ascending: true });

    if (error) throw error;

    const actionToDirection = (action: string): 'left' | 'right' | 'down' => {
      if (action === 'love') return 'right';
      if (action === 'review') return 'left';
      return 'down'; // unsure
    };

    return (data ?? []).map(row => ({
      checkin_id: row.id,
      checkin_date: row.created_at,
      subscription_id: row.sub_id,
      swipe_direction: actionToDirection(row.action),
    }));
  } catch (error) {
    console.warn('[CheckIn] getRecentCheckinResponses failed:', error);
    return [];
  }
};

/**
 * Fetch the last N check-in signals for a single subscription.
 * Returns them oldest-first so callers can render left→right chronologically.
 */
export const getSubRecentSignals = async (
  userId: string,
  subId: string,
  limit = 6,
): Promise<Array<'right' | 'left' | 'down'>> => {
  try {
    const { data, error } = await supabase
      .from('check_ins')
      .select('action')
      .eq('user_id', userId)
      .eq('sub_id', subId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw error;

    const actionToDirection = (action: string): 'right' | 'left' | 'down' => {
      if (action === 'love') return 'right';
      if (action === 'review') return 'left';
      return 'down';
    };

    return (data ?? []).map(row => actionToDirection(row.action)).reverse();
  } catch {
    return [];
  }
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Map database subscription to app Subscription type
 * Converts snake_case to camelCase
 */
const mapSubscriptionFromDB = (dbSub: any): Subscription => {
  return {
    id: dbSub.id,
    userId: dbSub.user_id,
    user_id: dbSub.user_id,
    name: dbSub.name,
    planName: dbSub.plan_name,
    plan_name: dbSub.plan_name,
    cost: parseFloat(dbSub.cost),
    billingCycle: dbSub.billing_cycle,
    billing_cycle: dbSub.billing_cycle,
    category: dbSub.category,
    iconEmoji: dbSub.icon_emoji,
    icon_emoji: dbSub.icon_emoji,
    color: dbSub.color,
    status: dbSub.status,
    isReminder: dbSub.is_reminder,
    is_reminder: dbSub.is_reminder,
    startDate: dbSub.start_date,
    start_date: dbSub.start_date,
    nextRenewalDate: dbSub.next_renewal_date,
    next_renewal_date: dbSub.next_renewal_date,
    usageScore: dbSub.usage_score,
    usage_score: dbSub.usage_score,
    satisfactionScore: dbSub.satisfaction_score,
    satisfaction_score: dbSub.satisfaction_score,
    notes: dbSub.notes,
    lastUsedRecency: dbSub.last_used_recency,
    usageType: dbSub.usage_type,
    retentionAnchor: dbSub.retention_anchor,
    cancellationReason: dbSub.cancellation_reason,
    createdAt: dbSub.created_at,
    created_at: dbSub.created_at,
    updatedAt: dbSub.updated_at,
    updated_at: dbSub.updated_at,
  };
};

/**
 * Calculate total monthly spend for a user
 */
export const calculateMonthlySpend = (subscriptions: Subscription[]): number => {
  return subscriptions
    .filter(sub => sub.status === 'active')
    .reduce((total, sub) => {
      // Convert all to monthly cost
      let monthlyCost = sub.cost;

      switch (sub.billingCycle) {
        case 'daily':
          monthlyCost = sub.cost * 30;
          break;
        case 'weekly':
          monthlyCost = sub.cost * 4;
          break;
        case 'monthly':
          monthlyCost = sub.cost;
          break;
        case 'quarterly':
          monthlyCost = sub.cost / 3;
          break;
        case 'yearly':
          monthlyCost = sub.cost / 12;
          break;
      }

      return total + monthlyCost;
    }, 0);
};

/**
 * Compute the next future renewal date from a stored anchor date.
 * Uses calendar-correct month arithmetic (Jan 31 + 1 month = Feb 28/29).
 * Parses dates as local time to avoid UTC offset issues.
 */
export const computeNextRenewalDate = (
  storedNextRenewalDate: string,
  billingCycle: Subscription['billingCycle']
): Date => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [y, m, d] = storedNextRenewalDate.split('-').map(Number);
  let renewal = new Date(y, m - 1, d);

  while (renewal <= today) {
    switch (billingCycle) {
      case 'daily':     renewal.setDate(renewal.getDate() + 1); break;
      case 'weekly':    renewal.setDate(renewal.getDate() + 7); break;
      case 'monthly':   renewal.setMonth(renewal.getMonth() + 1); break;
      case 'quarterly': renewal.setMonth(renewal.getMonth() + 3); break;
      case 'yearly':    renewal.setFullYear(renewal.getFullYear() + 1); break;
    }
  }

  return renewal;
};

/**
 * Get subscriptions renewing on a specific date
 */
export const getSubscriptionsForDate = (
  subscriptions: Subscription[],
  date: Date
): Subscription[] => {
  const targetDate = date.toISOString().split('T')[0];
  return subscriptions.filter(sub =>
    sub.nextRenewalDate === targetDate && sub.status === 'active'
  );
};
