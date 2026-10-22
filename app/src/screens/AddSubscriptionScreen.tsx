/**
 * Add/Edit Subscription Screen
 * Form to create or update subscription
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  ScrollView,
  Pressable,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSubscriptions } from '@/contexts/SubscriptionContext';
import { colors, spacing, fontSize, fontWeight, borderRadius, shadows } from '@/styles';
import { useScreenInsets } from '@/hooks/useScreenInsets';
import { getAllCategories, addCustomCategory } from '@/utils/categoryManager';
import { scheduleRenewalNotifications, requestNotificationPermissions } from '@/utils/notificationScheduler';
import * as Notifications from 'expo-notifications';
import type { Subscription } from '@/types';

type RootStackParamList = {
  AddSubscription: {
    subscriptionId?: string;
    prefillData?: {
      name: string;
      cost: number;
      category: string;
      nextRenewalDate: string;
    };
  };
  MainTabs: undefined;
};

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;
type ScreenRouteProp = RouteProp<RootStackParamList, 'AddSubscription'>;

const DEFAULT_CATEGORIES = ['Entertainment', 'Productivity', 'Utilities', 'Health'];
const BILLING_CYCLES = ['monthly', 'yearly', 'weekly', 'quarterly', 'daily'];
const PLAN_NAMES = ['Basic', 'Standard', 'Premium', 'Pro', 'Plus', 'Enterprise', 'Individual', 'Family'];
const EMOJI_ICONS = [
  '🎬', '🎵', '🤖', '📝', '☁️', '📺', '🎨', '💪', '📚', '🎮', '📱', '💻',
  '🍕', '🏃', '🎯', '💰'
];

export const AddSubscriptionScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<ScreenRouteProp>();
  const { subscriptions, addSubscription, editSubscription } = useSubscriptions();
  const insets = useScreenInsets();

  const subscriptionId = route.params?.subscriptionId;
  const prefillData = route.params?.prefillData;
  const isEditing = !!subscriptionId;
  const existingSub = subscriptions.find(s => s.id === subscriptionId);

  // Form state
  const [name, setName] = useState(existingSub?.name || prefillData?.name || '');
  const [planName, setPlanName] = useState(existingSub?.planName || 'Standard');
  const [cost, setCost] = useState(existingSub?.cost.toString() || prefillData?.cost?.toString() || '');
  const [billingCycle, setBillingCycle] = useState<Subscription['billingCycle']>(existingSub?.billingCycle || 'monthly');
  const [category, setCategory] = useState(existingSub?.category || prefillData?.category || 'Entertainment');
  const [iconEmoji, setIconEmoji] = useState(existingSub?.iconEmoji || '📱');
  const [nextRenewalDate, setNextRenewalDate] = useState(
    existingSub?.nextRenewalDate || prefillData?.nextRenewalDate || new Date().toISOString().split('T')[0]
  );
  const [notes, setNotes] = useState(existingSub?.notes || '');
  const [loading, setLoading] = useState(false);

  // Notification settings
  const [notif3Day, setNotif3Day] = useState(existingSub?.isReminder || false);
  const [notifSameDay, setNotifSameDay] = useState(false);

  // Custom inputs
  const [showCustomEmoji, setShowCustomEmoji] = useState(false);
  const [categories, setCategories] = useState(DEFAULT_CATEGORIES);
  const [showCustomCategory, setShowCustomCategory] = useState(
    existingSub?.category && !DEFAULT_CATEGORIES.includes(existingSub.category) ? true : false
  );
  const [customCategory, setCustomCategory] = useState(
    existingSub?.category && !DEFAULT_CATEGORIES.includes(existingSub.category) ? existingSub.category : ''
  );

  // Load categories on mount
  useEffect(() => {
    const loadCategories = async () => {
      const allCats = await getAllCategories();
      setCategories(allCats);
    };
    loadCategories();
  }, []);

  const handleSave = async () => {
    // Validation
    if (!name.trim()) {
      Alert.alert('Error', 'Please enter a subscription name');
      return;
    }

    if (!cost || isNaN(parseFloat(cost)) || parseFloat(cost) < 0) {
      Alert.alert('Error', 'Please enter a valid cost');
      return;
    }

    setLoading(true);

    try {
      const finalCategory = showCustomCategory && customCategory.trim()
        ? customCategory.trim()
        : category;

      const subscriptionData = {
        name: name.trim(),
        planName: planName.trim(),
        cost: parseFloat(cost),
        billingCycle,
        category: finalCategory,
        iconEmoji,
        color: isEditing ? (existingSub?.color ?? colors.primary) : colors.primary,
        status: isEditing ? (existingSub?.status ?? 'active') : 'active' as const,
        isReminder: notif3Day,
        startDate: existingSub?.startDate || new Date().toISOString().split('T')[0],
        nextRenewalDate,
        notes: notes.trim(),
        usageScore: existingSub?.usageScore || null,
        satisfactionScore: existingSub?.satisfactionScore || null,
      };

      // Save custom category if it's new
      if (finalCategory && !DEFAULT_CATEGORIES.includes(finalCategory)) {
        await addCustomCategory(finalCategory);
      }

      if (isEditing && subscriptionId) {
        const success = await editSubscription(subscriptionId, subscriptionData);
        if (!success) throw new Error('Failed to save subscription');

        // Reschedule notifications with updated data
        const updatedSub = { ...existingSub, ...subscriptionData, id: subscriptionId } as Subscription;
        void scheduleRenewalNotifications(updatedSub, { threeDay: notif3Day, sameDay: notifSameDay });
      } else {
        const newSub = await addSubscription(subscriptionData as any);
        if (!newSub) throw new Error('Failed to save subscription');

        void scheduleRenewalNotifications(newSub, { threeDay: notif3Day, sameDay: notifSameDay });
      }

      Alert.alert(
        'Success',
        isEditing ? 'Subscription updated!' : 'Subscription added!',
        [{ text: 'OK', onPress: () => navigation.goBack() }]
      );
    } catch (error: any) {
      console.error('Save error:', error);
      Alert.alert('Error', error.message || 'Failed to save subscription');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + spacing.md }]}>
        <Pressable onPress={() => navigation.goBack()} style={styles.backButton}>
          <Text style={styles.backIcon}>←</Text>
        </Pressable>
        <Text style={styles.headerTitle}>
          {isEditing ? 'EDIT SUBSCRIPTION' : 'ADD SUBSCRIPTION'}
        </Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: insets.bottom + spacing.xl }
        ]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Icon Selector */}
        <View style={styles.section}>
          <Text style={styles.label}>Icon</Text>
          <View style={styles.emojiGrid}>
            {EMOJI_ICONS.map(emoji => (
              <Pressable
                key={emoji}
                onPress={() => {
                  setIconEmoji(emoji);
                  setShowCustomEmoji(false);
                }}
                style={[
                  styles.emojiButton,
                  iconEmoji === emoji && !showCustomEmoji && styles.emojiButtonSelected
                ]}
              >
                <Text style={styles.emojiText}>{emoji}</Text>
              </Pressable>
            ))}
            {showCustomEmoji ? (
              <View style={[styles.emojiButton, styles.emojiButtonSelected]}>
                <TextInput
                  style={styles.emojiInput}
                  value={iconEmoji}
                  onChangeText={setIconEmoji}
                  maxLength={2}
                  autoFocus
                  onBlur={() => {
                    if (!iconEmoji || iconEmoji.trim() === '') {
                      setShowCustomEmoji(false);
                      setIconEmoji('📱');
                    }
                  }}
                />
              </View>
            ) : (
              <Pressable
                onPress={() => setShowCustomEmoji(true)}
                style={[styles.emojiButton, styles.emojiButtonCustom]}
              >
                <Text style={styles.emojiCustomText}>+</Text>
              </Pressable>
            )}
          </View>
        </View>

        {/* Name */}
        <View style={styles.section}>
          <Text style={styles.label}>Service Name *</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g., Netflix, Spotify"
            placeholderTextColor={colors.textTertiary}
            value={name}
            onChangeText={setName}
            autoCapitalize="words"
          />
        </View>

        {/* Plan Name */}
        <View style={styles.section}>
          <Text style={styles.label}>Plan Name</Text>
          <View style={styles.chipGrid}>
            {PLAN_NAMES.map(plan => (
              <Pressable
                key={plan}
                onPress={() => setPlanName(plan)}
                style={[
                  styles.chip,
                  planName === plan && styles.chipSelected
                ]}
              >
                <Text style={[
                  styles.chipText,
                  planName === plan && styles.chipTextSelected
                ]}>
                  {plan}
                </Text>
              </Pressable>
            ))}
          </View>
          <TextInput
            style={[styles.input, { marginTop: spacing.sm }]}
            placeholder="Or enter custom plan name"
            placeholderTextColor={colors.textTertiary}
            value={!PLAN_NAMES.includes(planName) ? planName : ''}
            onChangeText={setPlanName}
            autoCapitalize="words"
          />
        </View>

        {/* Cost */}
        <View style={styles.section}>
          <Text style={styles.label}>Cost *</Text>
          <View style={styles.inputWithPrefix}>
            <Text style={styles.currencyPrefix}>$</Text>
            <TextInput
              style={styles.inputCost}
              placeholder="0.00"
              placeholderTextColor={colors.textTertiary}
              value={cost}
              onChangeText={setCost}
              keyboardType="decimal-pad"
            />
          </View>
        </View>

        {/* Billing Cycle */}
        <View style={styles.section}>
          <Text style={styles.label}>Billing Cycle</Text>
          <View style={styles.chipGrid}>
            {BILLING_CYCLES.map(cycle => (
              <Pressable
                key={cycle}
                onPress={() => setBillingCycle(cycle)}
                style={[
                  styles.chip,
                  billingCycle === cycle && styles.chipSelected
                ]}
              >
                <Text style={[
                  styles.chipText,
                  billingCycle === cycle && styles.chipTextSelected
                ]}>
                  {cycle.charAt(0).toUpperCase() + cycle.slice(1)}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        {/* Category */}
        <View style={styles.section}>
          <Text style={styles.label}>Category</Text>
          <View style={styles.chipGrid}>
            {categories.filter(cat => DEFAULT_CATEGORIES.includes(cat)).map(cat => (
              <Pressable
                key={cat}
                onPress={() => setCategory(cat)}
                style={[
                  styles.chip,
                  category === cat && !showCustomCategory && styles.chipSelected
                ]}
              >
                <Text style={[
                  styles.chipText,
                  category === cat && !showCustomCategory && styles.chipTextSelected
                ]}>
                  {cat}
                </Text>
              </Pressable>
            ))}
            {categories.filter(cat => !DEFAULT_CATEGORIES.includes(cat)).map(cat => (
              <Pressable
                key={cat}
                onPress={() => setCategory(cat)}
                style={[
                  styles.chip,
                  category === cat && !showCustomCategory && styles.chipSelected
                ]}
              >
                <Text style={[
                  styles.chipText,
                  category === cat && !showCustomCategory && styles.chipTextSelected
                ]}>
                  {cat}
                </Text>
              </Pressable>
            ))}
          </View>
          <TextInput
            style={[styles.input, { marginTop: spacing.sm }]}
            placeholder="Or enter custom category"
            placeholderTextColor={colors.textTertiary}
            value={showCustomCategory || (category && !DEFAULT_CATEGORIES.includes(category)) ? customCategory : ''}
            onChangeText={(text) => {
              setCustomCategory(text);
              if (text.trim()) {
                setShowCustomCategory(true);
              }
            }}
            autoCapitalize="words"
          />
        </View>

        {/* Next Renewal Date */}
        <View style={styles.section}>
          <Text style={styles.label}>Next Renewal Date</Text>
          <TextInput
            style={styles.input}
            placeholder="YYYY-MM-DD"
            placeholderTextColor={colors.textTertiary}
            value={nextRenewalDate}
            onChangeText={setNextRenewalDate}
          />
        </View>

        {/* Notification Settings — hidden when editing a watchlist item */}
        {!(isEditing && existingSub?.status === 'watchlist') && (
          <View style={styles.section}>
            <Text style={styles.label}>Notification Settings</Text>
            <View style={styles.sectionCard}>
              {/* 3-day reminder */}
              <Pressable
                style={styles.toggleRow}
                onPress={() => setNotif3Day(!notif3Day)}
              >
                <View style={styles.toggleInfo}>
                  <Text style={styles.toggleLabel}>3-Day Reminder</Text>
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
                onPress={() => setNotifSameDay(!notifSameDay)}
              >
                <View style={styles.toggleInfo}>
                  <Text style={styles.toggleLabel}>Same-Day Reminder</Text>
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

              {/* Dev test button */}
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
                      title: `${iconEmoji} ${name || 'Test'} renews in 3 days`,
                      body: `$${cost || '0'} ${billingCycle} — cancel or keep?`,
                    },
                    trigger: {
                      type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
                      seconds: 10,
                      repeats: false,
                    },
                  });
                  Alert.alert('Notification sent', 'You\'ll get a test notification in 10 seconds.');
                }}
              >
                <Text style={styles.testNotifButtonText}>Test (fires in 10s)</Text>
              </Pressable>

            </View>
          </View>
        )}

        {/* Notes */}
        <View style={styles.section}>
          <Text style={styles.label}>Notes (Optional)</Text>
          <TextInput
            style={[styles.input, styles.inputMultiline]}
            placeholder="Add any notes about this subscription"
            placeholderTextColor={colors.textTertiary}
            value={notes}
            onChangeText={setNotes}
            multiline
            numberOfLines={3}
            textAlignVertical="top"
          />
        </View>

        {/* Save Button */}
        <Pressable
          onPress={handleSave}
          disabled={loading}
          style={({ pressed }) => [
            styles.saveButton,
            pressed && styles.saveButtonPressed,
            loading && styles.saveButtonDisabled
          ]}
        >
          {loading ? (
            <ActivityIndicator color={colors.white} />
          ) : (
            <Text style={styles.saveButtonText}>
              {isEditing ? 'Update Subscription' : 'Add Subscription'}
            </Text>
          )}
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
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
  headerSpacer: {
    width: 40,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: spacing.lg,
  },
  section: {
    marginBottom: spacing.lg,
  },
  sectionCard: {
    backgroundColor: colors.white,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.gray200,
  },
  divider: {
    height: 1,
    backgroundColor: colors.gray100,
    marginVertical: spacing.sm,
  },
  label: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.bold as any,
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  input: {
    height: 56,
    backgroundColor: colors.white,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    fontSize: fontSize.base,
    color: colors.textPrimary,
    borderWidth: 1,
    borderColor: colors.gray200,
  },
  inputMultiline: {
    height: 100,
    paddingTop: spacing.md,
  },
  inputWithPrefix: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.gray200,
    paddingLeft: spacing.md,
  },
  currencyPrefix: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold as any,
    color: colors.textSecondary,
    marginRight: spacing.xs,
  },
  inputCost: {
    flex: 1,
    height: 56,
    fontSize: fontSize.base,
    color: colors.textPrimary,
  },
  emojiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  emojiButton: {
    width: 56,
    height: 56,
    borderRadius: borderRadius.md,
    backgroundColor: colors.gray50,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  emojiButtonSelected: {
    backgroundColor: colors.primaryLight,
    borderColor: colors.primary,
  },
  emojiButtonCustom: {
    borderStyle: 'dashed',
    borderWidth: 1,
    borderColor: colors.gray200,
  },
  emojiText: {
    fontSize: 28,
  },
  emojiCustomText: {
    fontSize: 24,
    color: colors.textSecondary,
    fontWeight: fontWeight.semibold as any,
  },
  emojiInput: {
    fontSize: 28,
    textAlign: 'center',
    width: '100%',
    height: '100%',
    padding: 0,
  },
  chipGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
    backgroundColor: colors.gray50,
    borderWidth: 1,
    borderColor: colors.gray200,
  },
  chipSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  chipCustom: {
    borderStyle: 'dashed',
  },
  chipText: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold as any,
    color: colors.textSecondary,
  },
  chipTextSelected: {
    color: colors.white,
  },
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
  toggleLabel: {
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
    width: 28,
    height: 28,
    borderRadius: 14,
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
  saveButton: {
    height: 56,
    backgroundColor: colors.primary,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.lg,
    ...shadows.lg,
  },
  saveButtonPressed: {
    transform: [{ scale: 0.98 }],
    opacity: 0.9,
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold as any,
    color: colors.white,
  },
});
