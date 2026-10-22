/**
 * Subscription Detail Screen
 * View and manage individual subscription
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Alert,
  ActivityIndicator,
  Modal,
} from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSubscriptions } from '@/contexts/SubscriptionContext';
import { useAuth } from '@/contexts/AuthContext';
import { getSubRecentSignals } from '@/utils/database';
import { colors, spacing, fontSize, fontWeight, borderRadius, shadows } from '@/styles';
import { useScreenInsets } from '@/hooks/useScreenInsets';
import { scheduleRenewalNotifications, requestNotificationPermissions } from '@/utils/notificationScheduler';
import * as Notifications from 'expo-notifications';

type RootStackParamList = {
  SubscriptionDetail: { subscriptionId: string };
  AddSubscription: { subscriptionId?: string };
  MainTabs: undefined;
};

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;
type ScreenRouteProp = RouteProp<RootStackParamList, 'SubscriptionDetail'>;

const CANCEL_REASONS = [
  { key: 'too_expensive', label: 'Too expensive' },
  { key: 'not_using', label: 'Not using it enough' },
  { key: 'found_alternative', label: 'Found an alternative' },
  { key: 'no_longer_need', label: 'No longer need it' },
  { key: 'trial_ended', label: 'Trial ended' },
] as const;

const DELETE_WATCHLIST_REASONS = [
  { key: 'not_interested', label: 'No longer interested' },
  { key: 'too_expensive', label: 'Too expensive' },
  { key: 'found_alternative', label: 'Found an alternative' },
  { key: 'just_exploring', label: 'Was just exploring' },
  { key: 'already_have_it', label: 'Already have a similar service' },
] as const;

export const SubscriptionDetailScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<ScreenRouteProp>();
  const { subscriptions, editSubscription, removeSubscription } = useSubscriptions();
  const { user } = useAuth();
  const insets = useScreenInsets();

  const { subscriptionId } = route.params;
  const subscription = subscriptions.find(s => s.id === subscriptionId);

  const [loading, setLoading] = useState(false);
  const [notif3Day, setNotif3Day] = useState(subscription?.isReminder || false);
  const [notifSameDay, setNotifSameDay] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [showDeleteWatchlistModal, setShowDeleteWatchlistModal] = useState(false);
  const [signals, setSignals] = useState<Array<'right' | 'left' | 'down'>>([]);

  useEffect(() => {
    if (user?.id && subscriptionId) {
      getSubRecentSignals(user.id, subscriptionId, 6).then(setSignals);
    }
  }, [user?.id, subscriptionId]);

  if (!subscription) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>Subscription not found</Text>
      </View>
    );
  }

  const handleToggleStatus = async () => {
    setLoading(true);
    const newStatus = subscription.status === 'active' ? 'paused' : 'active';

    const success = await editSubscription(subscription.id, { status: newStatus });

    if (success) {
      Alert.alert(
        'Success',
        `Subscription ${newStatus === 'active' ? 'activated' : 'paused'}!`
      );
    } else {
      Alert.alert('Error', 'Failed to update subscription');
    }

    setLoading(false);
  };

  const handleDelete = () => {
    Alert.alert(
      'Delete Subscription',
      `Are you sure you want to delete ${subscription.name}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setLoading(true);
            const success = await removeSubscription(subscription.id);

            if (success) {
              navigation.goBack();
              Alert.alert('Success', 'Subscription deleted!');
            } else {
              Alert.alert('Error', 'Failed to delete subscription');
              setLoading(false);
            }
          }
        }
      ]
    );
  };

  const handleEdit = () => {
    navigation.navigate('AddSubscription', { subscriptionId: subscription.id });
  };

  const handleCancelPress = () => {
    setShowCancelModal(true);
  };

  // reason = null means user skipped; cancellation still proceeds
  const handleConfirmCancel = async (reason: string | null) => {
    setShowCancelModal(false);
    setLoading(true);
    const updates: { status: 'cancelled'; cancellationReason?: string } = { status: 'cancelled' };
    if (reason) updates.cancellationReason = reason;
    const success = await editSubscription(subscription.id, updates);
    setLoading(false);
    if (success) {
      navigation.goBack();
    } else {
      Alert.alert('Error', 'Failed to cancel subscription');
    }
  };

  const handleSkipCancel = () => {
    void handleConfirmCancel(null);
  };

  // Compute next renewal date from the stored nextRenewalDate anchor.
  // Uses calendar-correct month arithmetic and local time parsing.
  const calculateNextRenewal = () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [y, m, d] = subscription.nextRenewalDate.split('-').map(Number);
    let nextRenewal = new Date(y, m - 1, d);

    while (nextRenewal <= today) {
      switch (subscription.billingCycle) {
        case 'daily':     nextRenewal.setDate(nextRenewal.getDate() + 1); break;
        case 'weekly':    nextRenewal.setDate(nextRenewal.getDate() + 7); break;
        case 'monthly':   nextRenewal.setMonth(nextRenewal.getMonth() + 1); break;
        case 'quarterly': nextRenewal.setMonth(nextRenewal.getMonth() + 3); break;
        case 'yearly':    nextRenewal.setFullYear(nextRenewal.getFullYear() + 1); break;
      }
    }

    return nextRenewal;
  };

  // Days since subscription start (gracefully handles missing startDate)
  const daysSinceStart = () => {
    if (!subscription.startDate) return 0;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const [y, m, d] = subscription.startDate.split('-').map(Number);
    const start = new Date(y, m - 1, d);
    return Math.max(0, Math.floor((today.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)));
  };

  // Calculate days until renewal
  const daysUntilRenewal = () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const renewalDate = calculateNextRenewal();
    return Math.ceil((renewalDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  };

  const nextRenewal = calculateNextRenewal();
  const daysLeft = daysUntilRenewal();
  const daysUsed = daysSinceStart();
  const status = subscription.status;

  const handleToggle3Day = async () => {
    const newValue = !notif3Day;
    setNotif3Day(newValue);
    await editSubscription(subscription.id, { isReminder: newValue });
    void scheduleRenewalNotifications(subscription, { threeDay: newValue, sameDay: notifSameDay });
  };

  const handleToggleSameDay = async () => {
    const newValue = !notifSameDay;
    setNotifSameDay(newValue);
    void scheduleRenewalNotifications(subscription, { threeDay: notif3Day, sameDay: newValue });
  };
  const isPaused = status === 'paused';
  const isWatchlist = status === 'watchlist';

  const handleConfirmDeleteWatchlist = async (reason: string | null) => {
    setShowDeleteWatchlistModal(false);
    setLoading(true);
    const success = await removeSubscription(subscription.id);
    setLoading(false);
    if (success) {
      navigation.goBack();
    } else {
      Alert.alert('Error', 'Failed to delete from watchlist');
    }
  };

  const handleActivate = async () => {
    setLoading(true);
    const success = await editSubscription(subscription.id, { status: 'active' });
    setLoading(false);
    if (success) {
      navigation.navigate('AddSubscription', { subscriptionId: subscription.id });
    } else {
      Alert.alert('Error', 'Failed to activate subscription');
    }
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + spacing.md }]}>
        <Pressable onPress={() => navigation.goBack()} style={styles.backButton}>
          <Text style={styles.backIcon}>←</Text>
        </Pressable>
        <Text style={styles.headerTitle}>DETAILS</Text>
        <Pressable onPress={handleEdit} style={styles.editButton}>
          <View style={styles.editIconCircle}>
            <Text style={styles.editIcon}>✏️</Text>
          </View>
        </Pressable>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: insets.bottom + spacing.xl }
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Icon & Name */}
        <View style={styles.heroSection}>
          <View style={styles.iconContainer}>
            <Text style={styles.iconEmoji}>{subscription.iconEmoji}</Text>
          </View>
          <Text style={styles.name}>{subscription.name}</Text>
        </View>

        {/* Cost Section - Prominent Display with Badges */}
        <View style={styles.costSection}>
          <View style={styles.costCard}>
            {/* Status badge above price */}
            <View style={styles.statusBadgeRow}>
              <View style={[
                styles.badge,
                status === 'active' && styles.badgeActive,
                status === 'paused' && styles.badgePaused,
                isWatchlist && styles.badgeWatchlist,
              ]}>
                <Text style={[
                  styles.badgeText,
                  status === 'active' && styles.badgeTextActive,
                  status === 'paused' && styles.badgeTextPaused,
                  isWatchlist && styles.badgeTextWatchlist,
                ]}>
                  {status === 'active' ? 'ACTIVE' : status === 'paused' ? 'PAUSED' : 'WATCHLIST'}
                </Text>
              </View>
            </View>

            {/* Cost */}
            <Text style={styles.costAmount}>${subscription.cost.toFixed(2)}</Text>
            <Text style={styles.costCycle}>
              / {subscription.billingCycle}
            </Text>

            {/* Info badges below price */}
            <View style={styles.badgesRow}>
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{subscription.planName.toUpperCase()}</Text>
              </View>
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{daysUsed}d used</Text>
              </View>
              {!isWatchlist && daysLeft >= 0 && (
                <View style={[
                  styles.badge,
                  daysLeft <= 5 && daysLeft > 3 && styles.badgeWarning,
                  daysLeft <= 3 && styles.badgeUrgent
                ]}>
                  <Text style={[
                    styles.badgeText,
                    daysLeft <= 5 && daysLeft > 3 && styles.badgeTextWarning,
                    daysLeft <= 3 && styles.badgeTextUrgent
                  ]}>
                    {daysLeft === 0 ? 'Today!' : `${daysLeft}d left`}
                  </Text>
                </View>
              )}
            </View>
          </View>
        </View>

        {/* Plan Details Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>PLAN DETAILS</Text>
          <View style={styles.sectionCard}>
            {/* Renewal Date */}
            {!isWatchlist && (
              <>
                <View style={styles.detailRow}>
                  <Text style={styles.rowLabel}>Next Renewal</Text>
                  <Text style={styles.rowValue}>
                    {nextRenewal.toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric'
                    })}
                  </Text>
                </View>
                <View style={styles.divider} />
              </>
            )}

            {/* Cycle */}
            <View style={styles.detailRow}>
              <Text style={styles.rowLabel}>Cycle</Text>
              <Text style={styles.rowValue}>
                {subscription.billingCycle.charAt(0).toUpperCase() + subscription.billingCycle.slice(1)}
              </Text>
            </View>

            <View style={styles.divider} />

            {/* Category */}
            <View style={styles.detailRow}>
              <Text style={styles.rowLabel}>Category</Text>
              <Text style={styles.rowValue}>{subscription.category}</Text>
            </View>

            {subscription.startDate && (
              <>
                <View style={styles.divider} />
                <View style={styles.detailRow}>
                  <Text style={styles.rowLabel}>Start Date</Text>
                  <Text style={styles.rowValue}>
                    {new Date(subscription.startDate).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric'
                    })}
                  </Text>
                </View>
              </>
            )}
          </View>
        </View>

        {/* Notification Settings */}
        {!isWatchlist && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>NOTIFICATION SETTINGS</Text>
            <View style={styles.sectionCard}>
              {/* 3-day reminder */}
              <Pressable
                style={styles.toggleRow}
                onPress={handleToggle3Day}
              >
                <View style={styles.toggleInfo}>
                  <Text style={styles.toggleTitle}>3-Day Reminder</Text>
                  <Text style={styles.toggleDescription}>
                    Alert me 3 days before renewal
                  </Text>
                </View>
                <View style={[
                  styles.toggle,
                  notif3Day && styles.toggleActive
                ]}>
                  <View style={[
                    styles.toggleThumb,
                    notif3Day && styles.toggleThumbActive
                  ]} />
                </View>
              </Pressable>

              <View style={styles.divider} />

              {/* Same-day reminder */}
              <Pressable
                style={styles.toggleRow}
                onPress={handleToggleSameDay}
              >
                <View style={styles.toggleInfo}>
                  <Text style={styles.toggleTitle}>Same-Day Reminder</Text>
                  <Text style={styles.toggleDescription}>
                    Alert me on renewal day
                  </Text>
                </View>
                <View style={[
                  styles.toggle,
                  notifSameDay && styles.toggleActive
                ]}>
                  <View style={[
                    styles.toggleThumb,
                    notifSameDay && styles.toggleThumbActive
                  ]} />
                </View>
              </Pressable>

              <View style={styles.divider} />

              <Pressable
                style={styles.testNotifButton}
                onPress={async () => {
                  const granted = await requestNotificationPermissions();
                  if (!granted) {
                    Alert.alert('Permission denied', 'Enable notifications in Settings.');
                    return;
                  }
                  await Notifications.scheduleNotificationAsync({
                    content: {
                      title: `${subscription.iconEmoji} ${subscription.name} renews in 3 days`,
                      body: `$${subscription.cost} ${subscription.billingCycle} — cancel or keep?`,
                    },
                    trigger: {
                      type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
                      seconds: 10,
                      repeats: false,
                    },
                  });
                  Alert.alert('Notification sent', 'Check your phone in 10 seconds.');
                }}
              >
                <Text style={styles.testNotifButtonText}>Test (fires in 10s)</Text>
              </Pressable>

            </View>
          </View>
        )}

        {/* Check-in Signals */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>CHECK-IN SIGNALS</Text>
          <View style={styles.signalsCard}>
            {signals.length === 0 ? (
              <Text style={styles.signalsEmpty}>No check-ins yet — swipe through this subscription during a check-in to start tracking.</Text>
            ) : (
              <>
                <View style={styles.signalDots}>
                  {signals.map((dir, i) => (
                    <View
                      key={i}
                      style={[
                        styles.signalDot,
                        dir === 'right' && styles.signalDotPositive,
                        dir === 'left'  && styles.signalDotNegative,
                        dir === 'down'  && styles.signalDotNeutral,
                      ]}
                    />
                  ))}
                </View>
                <Text style={styles.signalsLabel}>
                  {(() => {
                    const rights = signals.filter(s => s === 'right').length;
                    const lefts  = signals.filter(s => s === 'left').length;
                    const ratio  = rights / signals.length;
                    if (ratio >= 0.6) return '♥  Loving it';
                    if (lefts / signals.length >= 0.5) return '○  On the fence';
                    return '◐  Mixed signals';
                  })()}
                </Text>
                <Text style={styles.signalsMeta}>
                  Based on your last {signals.length} check-in{signals.length > 1 ? 's' : ''}
                </Text>
              </>
            )}
          </View>
        </View>

        {/* Notes */}
        {subscription.notes && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>NOTES</Text>
            <View style={styles.notesCard}>
              <Text style={styles.notesText}>{subscription.notes}</Text>
            </View>
          </View>
        )}

        {/* Actions */}
        <View style={styles.actionsSection}>
          <View style={styles.actionsRow}>
            {isWatchlist ? (
              <>
                <Pressable
                  onPress={handleActivate}
                  disabled={loading}
                  style={({ pressed }) => [
                    styles.actionButton,
                    styles.actionButtonPrimary,
                    pressed && styles.actionButtonPressed
                  ]}
                >
                  {loading ? (
                    <ActivityIndicator color={colors.white} />
                  ) : (
                    <Text style={styles.actionButtonTextPrimary}>Subscribe Now</Text>
                  )}
                </Pressable>
                <Pressable
                  onPress={() => setShowDeleteWatchlistModal(true)}
                  disabled={loading}
                  style={({ pressed }) => [
                    styles.actionButton,
                    styles.cancelButton,
                    pressed && styles.actionButtonPressed
                  ]}
                >
                  <Text style={styles.cancelButtonText}>Delete</Text>
                </Pressable>
              </>
            ) : (
              <>
                <Pressable
                  onPress={handleToggleStatus}
                  disabled={loading}
                  style={({ pressed }) => [
                    styles.actionButton,
                    styles.actionButtonSecondary,
                    pressed && styles.actionButtonPressed
                  ]}
                >
                  {loading ? (
                    <ActivityIndicator color={colors.primary} />
                  ) : (
                    <Text style={styles.actionButtonTextSecondary}>
                      {isPaused ? 'Resume' : 'Pause'}
                    </Text>
                  )}
                </Pressable>
                <Pressable
                  onPress={handleCancelPress}
                  disabled={loading}
                  style={({ pressed }) => [
                    styles.actionButton,
                    styles.cancelButton,
                    pressed && styles.actionButtonPressed,
                  ]}
                >
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </Pressable>
              </>
            )}
          </View>
        </View>
      </ScrollView>

      {/* Delete Watchlist Reason Modal */}
      <Modal
        visible={showDeleteWatchlistModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowDeleteWatchlistModal(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setShowDeleteWatchlistModal(false)}>
          <Pressable style={styles.modalCard} onPress={() => { /* block tap-through */ }}>
            <Text style={styles.modalTitle}>Why are you removing this?</Text>
            <Text style={styles.modalSubtitle}>{subscription.name}</Text>

            {DELETE_WATCHLIST_REASONS.map(reason => (
              <Pressable
                key={reason.key}
                style={({ pressed }) => [
                  styles.reasonOption,
                  pressed && styles.reasonOptionPressed,
                ]}
                onPress={() => { void handleConfirmDeleteWatchlist(reason.key); }}
              >
                <Text style={styles.reasonLabel}>{reason.label}</Text>
              </Pressable>
            ))}

            <Pressable
              style={styles.skipButton}
              onPress={() => { void handleConfirmDeleteWatchlist(null); }}
            >
              <Text style={styles.skipText}>Skip</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Cancellation Reason Modal */}
      <Modal
        visible={showCancelModal}
        transparent
        animationType="fade"
        onRequestClose={handleSkipCancel}
      >
        <Pressable style={styles.modalOverlay} onPress={handleSkipCancel}>
          <Pressable style={styles.modalCard} onPress={() => { /* block overlay tap-through */ }}>
            <Text style={styles.modalTitle}>Why are you canceling?</Text>
            <Text style={styles.modalSubtitle}>{subscription.name}</Text>

            {CANCEL_REASONS.map(reason => (
              <Pressable
                key={reason.key}
                style={({ pressed }) => [
                  styles.reasonOption,
                  pressed && styles.reasonOptionPressed,
                ]}
                onPress={() => { void handleConfirmCancel(reason.key); }}
              >
                <Text style={styles.reasonLabel}>{reason.label}</Text>
              </Pressable>
            ))}

            <Pressable style={styles.skipButton} onPress={handleSkipCancel}>
              <Text style={styles.skipText}>Skip</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.backgroundLight,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    backgroundColor: colors.backgroundLight,
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backIcon: {
    fontSize: 24,
    color: colors.textPrimary,
  },
  headerTitle: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.black as any,
    color: colors.textPrimary,
    letterSpacing: 1.2,
  },
  editButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  editIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.gray100,
    borderWidth: 1,
    borderColor: colors.gray200,
    alignItems: 'center',
    justifyContent: 'center',
  },
  editIcon: {
    fontSize: 18,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: spacing.lg,
  },
  errorText: {
    fontSize: fontSize.base,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: spacing.xxxl,
  },
  heroSection: {
    alignItems: 'center',
    paddingTop: spacing.lg,
    paddingBottom: spacing.sm,
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
    ...shadows.lg,
  },
  iconEmoji: {
    fontSize: 40,
  },
  name: {
    fontSize: 32,
    fontWeight: fontWeight.black as any,
    color: colors.textPrimary,
  },
  // Cost section - prominent display
  costSection: {
    marginBottom: spacing.lg,
  },
  costCard: {
    backgroundColor: colors.white,
    borderRadius: borderRadius.xl,
    padding: spacing.lg,
    alignItems: 'center',
    ...shadows.md,
  },
  statusBadgeRow: {
    marginBottom: spacing.xs,
    alignItems: 'center',
  },
  badgesRow: {
    flexDirection: 'row',
    gap: spacing.xs,
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  // Unified badge style
  badge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: borderRadius.sm,
    backgroundColor: colors.gray100,
    borderWidth: 1,
    borderColor: colors.gray200,
  },
  badgeActive: {
    backgroundColor: colors.successLight,
    borderColor: colors.success,
  },
  badgePaused: {
    backgroundColor: colors.gray100,
    borderColor: colors.gray200,
  },
  badgeWarning: {
    backgroundColor: '#FFF4E6',
    borderColor: '#F97316',
  },
  badgeUrgent: {
    backgroundColor: colors.dangerLight,
    borderColor: colors.danger,
  },
  badgeText: {
    fontSize: fontSize.xxs,
    fontWeight: fontWeight.bold as any,
    color: colors.textSecondary,
    letterSpacing: 0.8,
  },
  badgeTextActive: {
    color: colors.success,
    fontWeight: fontWeight.black as any,
  },
  badgeTextPaused: {
    color: colors.textSecondary,
  },
  badgeWatchlist: {
    backgroundColor: colors.primary + '20',
    borderColor: colors.primary,
  },
  badgeTextWatchlist: {
    color: colors.primary,
    fontWeight: fontWeight.black as any,
  },
  badgeTextWarning: {
    color: '#F97316',
    fontWeight: fontWeight.black as any,
  },
  badgeTextUrgent: {
    color: colors.danger,
    fontWeight: fontWeight.black as any,
  },
  costAmount: {
    fontSize: 48,
    fontWeight: fontWeight.black as any,
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  costCycle: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.medium as any,
    color: colors.textSecondary,
    marginBottom: spacing.md,
  },
  // Section styles
  section: {
    marginBottom: spacing.lg,
  },
  sectionTitle: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.bold as any,
    color: colors.textSecondary,
    letterSpacing: 1.2,
    marginBottom: spacing.sm,
  },
  sectionCard: {
    backgroundColor: colors.white,
    borderRadius: borderRadius.xl,
    padding: spacing.lg,
    ...shadows.sm,
  },
  // Detail row (two-column layout)
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  rowLabel: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    fontWeight: fontWeight.medium as any,
  },
  rowValue: {
    fontSize: fontSize.base,
    color: colors.textPrimary,
    fontWeight: fontWeight.semibold as any,
  },
  divider: {
    height: 1,
    backgroundColor: colors.gray100,
  },
  // Toggle row
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
  },
  toggleInfo: {
    flex: 1,
    marginRight: spacing.md,
  },
  toggleTitle: {
    fontSize: fontSize.base,
    fontWeight: fontWeight.semibold as any,
    color: colors.textPrimary,
    marginBottom: 2,
  },
  toggleDescription: {
    fontSize: fontSize.xs,
    color: colors.textSecondary,
  },
  toggle: {
    width: 52,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.gray200,
    borderWidth: 1,
    borderColor: colors.gray200,
    padding: 2,
    justifyContent: 'center',
  },
  toggleActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  toggleThumb: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.white,
    ...shadows.sm,
  },
  toggleThumbActive: {
    transform: [{ translateX: 20 }],
  },
  testNotifButton: {
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
    backgroundColor: colors.gray100,
    marginTop: spacing.xs,
  },
  testNotifButtonText: {
    fontSize: fontSize.xs,
    color: colors.textSecondary,
    fontWeight: fontWeight.semibold as any,
  },
  // Check-in signals
  signalsCard: {
    backgroundColor: colors.white,
    borderRadius: borderRadius.xl,
    padding: spacing.lg,
    ...shadows.sm,
  },
  signalsEmpty: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  signalDots: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  signalDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.gray200,
  },
  signalDotPositive: {
    backgroundColor: colors.success,
  },
  signalDotNegative: {
    backgroundColor: colors.danger,
  },
  signalDotNeutral: {
    backgroundColor: colors.warning,
  },
  signalsLabel: {
    fontSize: fontSize.base,
    fontWeight: fontWeight.semibold as any,
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  signalsMeta: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
  },
  // Notes
  notesCard: {
    backgroundColor: colors.white,
    borderRadius: borderRadius.md,
    padding: spacing.xl,
    borderWidth: 1,
    borderColor: colors.gray100,
    ...shadows.sm,
  },
  notesText: {
    fontSize: fontSize.base,
    color: colors.textSecondary,
    lineHeight: 22,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  // Actions
  actionsSection: {
    marginTop: spacing.xl,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  actionButton: {
    flex: 1,
    height: 56,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.sm,
  },
  actionButtonPrimary: {
    backgroundColor: colors.primary,
  },
  actionButtonSecondary: {
    backgroundColor: colors.white,
    borderWidth: 2,
    borderColor: colors.primary,
  },
  actionButtonPressed: {
    transform: [{ scale: 0.98 }],
    opacity: 0.9,
  },
  actionButtonTextPrimary: {
    fontSize: fontSize.base,
    fontWeight: fontWeight.bold as any,
    color: colors.white,
  },
  actionButtonTextSecondary: {
    fontSize: fontSize.base,
    fontWeight: fontWeight.bold as any,
    color: colors.primary,
  },
  // Cancel subscription button (below main action row)
  cancelButton: {
    backgroundColor: colors.white,
    borderWidth: 2,
    borderColor: colors.danger,
  },
  cancelButtonText: {
    fontSize: fontSize.base,
    fontWeight: fontWeight.bold as any,
    color: colors.danger,
  },
  // Cancellation reason modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: colors.white,
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    padding: spacing.lg,
    paddingBottom: spacing.xxxl,
  },
  modalTitle: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.black as any,
    color: colors.textPrimary,
    textAlign: 'center',
    marginBottom: spacing.xs,
  },
  modalSubtitle: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  reasonOption: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.gray100,
    marginBottom: spacing.sm,
    backgroundColor: colors.white,
  },
  reasonOptionPressed: {
    backgroundColor: colors.gray100,
  },
  reasonLabel: {
    fontSize: fontSize.base,
    fontWeight: fontWeight.medium as any,
    color: colors.textPrimary,
  },
  skipButton: {
    marginTop: spacing.xs,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  skipText: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    fontWeight: fontWeight.medium as any,
  },
});
