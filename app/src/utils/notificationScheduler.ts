/**
 * Notification Scheduler
 * Schedules local renewal reminders for subscriptions.
 * Uses expo-notifications (local only — no APNs/server required).
 */

import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import type { Subscription } from '@/types';

// Show alerts + sound when a notification arrives while the app is open
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

// ---------------------------------------------------------------------------
// Permissions
// ---------------------------------------------------------------------------

export const requestNotificationPermissions = async (): Promise<boolean> => {
  // Android 12 and below grants automatically; 13+ needs explicit request
  const { status: existing } = await Notifications.getPermissionsAsync();
  if (existing === 'granted') return true;

  const { status } = await Notifications.requestPermissionsAsync();
  return status === 'granted';
};

// ---------------------------------------------------------------------------
// Identifier helpers
// ---------------------------------------------------------------------------

const ids = (subId: string) => ({
  threeDay: `${subId}_3day`,
  sameDay: `${subId}_sameday`,
});

// ---------------------------------------------------------------------------
// Cancel
// ---------------------------------------------------------------------------

export const cancelSubscriptionNotifications = async (subId: string): Promise<void> => {
  const { threeDay, sameDay } = ids(subId);
  await Promise.allSettled([
    Notifications.cancelScheduledNotificationAsync(threeDay),
    Notifications.cancelScheduledNotificationAsync(sameDay),
  ]);
};

// ---------------------------------------------------------------------------
// Schedule
// ---------------------------------------------------------------------------

interface ScheduleOptions {
  threeDay: boolean;
  sameDay: boolean;
}

export const scheduleRenewalNotifications = async (
  sub: Subscription,
  opts: ScheduleOptions,
): Promise<void> => {
  // Cancel stale notifications before (re)scheduling
  await cancelSubscriptionNotifications(sub.id);

  if (!opts.threeDay && !opts.sameDay) return;
  if (!sub.nextRenewalDate) return;

  const granted = await requestNotificationPermissions();
  if (!granted) return;

  // Parse as local time (avoid UTC midnight shift)
  const [y, m, d] = sub.nextRenewalDate.split('-').map(Number);
  const renewalAt9am = new Date(y, m - 1, d, 9, 0, 0);
  const now = Date.now();
  const { threeDay, sameDay } = ids(sub.id);

  if (opts.threeDay) {
    const threeDayBefore = new Date(renewalAt9am);
    threeDayBefore.setDate(threeDayBefore.getDate() - 3);
    const secondsUntil = Math.floor((threeDayBefore.getTime() - now) / 1000);

    if (secondsUntil > 60) {
      await Notifications.scheduleNotificationAsync({
        identifier: threeDay,
        content: {
          title: `${sub.iconEmoji} ${sub.name} renews in 3 days`,
          body: `$${sub.cost} ${sub.billingCycle} — cancel or keep?`,
          data: { subscriptionId: sub.id },
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
          seconds: secondsUntil,
          repeats: false,
        },
      });
    }
  }

  if (opts.sameDay) {
    const secondsUntil = Math.floor((renewalAt9am.getTime() - now) / 1000);

    if (secondsUntil > 60) {
      await Notifications.scheduleNotificationAsync({
        identifier: sameDay,
        content: {
          title: `${sub.iconEmoji} ${sub.name} renews today`,
          body: `$${sub.cost} will be charged today`,
          data: { subscriptionId: sub.id },
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
          seconds: secondsUntil,
          repeats: false,
        },
      });
    }
  }
};

// ---------------------------------------------------------------------------
// Bulk reschedule (called on app start)
// Only reschedules 3-day reminders — same-day is opt-in per subscription
// ---------------------------------------------------------------------------

export const rescheduleAllNotifications = async (subs: Subscription[]): Promise<void> => {
  const toSchedule = subs.filter(
    s => s.status === 'active' && s.isReminder && s.nextRenewalDate,
  );
  await Promise.allSettled(
    toSchedule.map(sub =>
      scheduleRenewalNotifications(sub, { threeDay: true, sameDay: false }),
    ),
  );
};
