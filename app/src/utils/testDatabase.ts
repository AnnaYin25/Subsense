/**
 * Database Test Utility
 * Use this to test Supabase connection and seed initial data
 */

import { supabase } from './supabase';
import type { Subscription } from '@/types';

/**
 * Test Supabase connection
 */
export const testConnection = async (): Promise<boolean> => {
  try {
    console.log('🔍 Testing Supabase connection...');

    const { data, error } = await supabase
      .from('users')
      .select('count')
      .limit(1);

    if (error) {
      console.error('❌ Connection failed:', error.message);
      return false;
    }

    console.log('✅ Connection successful!');
    return true;
  } catch (error) {
    console.error('❌ Connection error:', error);
    return false;
  }
};

/**
 * Seed initial subscriptions for a user
 * (For testing purposes)
 */
export const seedSubscriptions = async (userId: string): Promise<boolean> => {
  try {
    console.log('🌱 Seeding subscriptions...');

    const testSubscriptions = [
      {
        user_id: userId,
        name: 'Netflix',
        plan_name: 'Premium',
        cost: 15.99,
        billing_cycle: 'monthly',
        category: 'Entertainment',
        icon_emoji: '🎬',
        color: '#E50914',
        status: 'active',
        is_reminder: true,
        start_date: '2024-01-15',
        next_renewal_date: '2024-03-15',
        usage_score: 85,
        satisfaction_score: 90,
      },
      {
        user_id: userId,
        name: 'Spotify',
        plan_name: 'Premium',
        cost: 10.99,
        billing_cycle: 'monthly',
        category: 'Entertainment',
        icon_emoji: '🎵',
        color: '#1DB954',
        status: 'active',
        is_reminder: true,
        start_date: '2024-01-01',
        next_renewal_date: '2024-03-01',
        usage_score: 95,
        satisfaction_score: 95,
      },
      {
        user_id: userId,
        name: 'ChatGPT',
        plan_name: 'Plus',
        cost: 20.0,
        billing_cycle: 'monthly',
        category: 'Productivity',
        icon_emoji: '🤖',
        color: '#10A37F',
        status: 'active',
        is_reminder: true,
        start_date: '2024-02-01',
        next_renewal_date: '2024-03-01',
        usage_score: 100,
        satisfaction_score: 100,
      },
      {
        user_id: userId,
        name: 'Notion',
        plan_name: 'Personal Pro',
        cost: 8.0,
        billing_cycle: 'monthly',
        category: 'Productivity',
        icon_emoji: '📝',
        color: '#000000',
        status: 'active',
        is_reminder: false,
        start_date: '2023-12-01',
        next_renewal_date: '2024-03-05',
        usage_score: 75,
        satisfaction_score: 85,
      },
      {
        user_id: userId,
        name: 'iCloud',
        plan_name: '200GB',
        cost: 2.99,
        billing_cycle: 'monthly',
        category: 'Utilities',
        icon_emoji: '☁️',
        color: '#007AFF',
        status: 'active',
        is_reminder: false,
        start_date: '2023-06-01',
        next_renewal_date: '2024-03-10',
        usage_score: 60,
        satisfaction_score: 70,
      },
    ];

    const { error } = await supabase
      .from('subscriptions')
      .insert(testSubscriptions);

    if (error) {
      console.error('❌ Seeding failed:', error.message);
      return false;
    }

    console.log(`✅ Seeded ${testSubscriptions.length} subscriptions!`);
    return true;
  } catch (error) {
    console.error('❌ Seeding error:', error);
    return false;
  }
};

/**
 * Create initial user profile after signup
 */
export const createInitialUserProfile = async (
  userId: string,
  email: string,
  name: string
): Promise<boolean> => {
  try {
    console.log('👤 Creating user profile...');

    const { error } = await supabase
      .from('users')
      .insert({
        id: userId,
        email,
        name,
        avatar_style: 'notionists',
        age: 25,
        monthly_budget: 100.0,
        currency: 'USD',
        reminder_day: 0, // Sunday
        reminder_days_before: 3,
      });

    if (error) {
      console.error('❌ Profile creation failed:', error.message);
      return false;
    }

    console.log('✅ User profile created!');
    return true;
  } catch (error) {
    console.error('❌ Profile creation error:', error);
    return false;
  }
};

/**
 * Delete all subscriptions for a user (for testing)
 */
export const clearSubscriptions = async (userId: string): Promise<boolean> => {
  try {
    console.log('🗑️  Clearing subscriptions...');

    const { error } = await supabase
      .from('subscriptions')
      .delete()
      .eq('user_id', userId);

    if (error) {
      console.error('❌ Clear failed:', error.message);
      return false;
    }

    console.log('✅ Subscriptions cleared!');
    return true;
  } catch (error) {
    console.error('❌ Clear error:', error);
    return false;
  }
};

/**
 * Get user subscription count
 */
export const getSubscriptionCount = async (userId: string): Promise<number> => {
  try {
    const { count, error } = await supabase
      .from('subscriptions')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId);

    if (error) throw error;
    return count || 0;
  } catch (error) {
    console.error('❌ Count error:', error);
    return 0;
  }
};
