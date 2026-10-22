import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Image, ActivityIndicator } from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '@/navigation/RootNavigator';
import { useScreenInsets } from '@/hooks/useScreenInsets';
import { useAuth } from '@/contexts/AuthContext';
import { useSubscriptions } from '@/contexts/SubscriptionContext';
import { colors, spacing, fontSize, fontWeight, borderRadius, shadows } from '@/styles';
import { generateAvatarUrl } from '@/utils/avatarUtils';
import { supabase } from '@/utils/supabase';
import { generatePersonaProfile } from '@/utils/personaGenerator';
import { getAllCategories } from '@/utils/categoryManager';
import type { SetupPreferences, Subscription } from '@/types';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

const getRiskLevel = (sub: Subscription): 'high' | 'medium' | 'none' => {
  const subAny = sub as any;
  const u: number | undefined = subAny.usageScore ?? sub.usage_score;
  const s: number | undefined = subAny.satisfactionScore ?? sub.satisfaction_score;
  if (u === undefined && s === undefined) return 'none';
  const minVal = Math.min(u ?? 65, s ?? 65);
  if (minVal < 25) return 'high';
  if (minVal < 45) return 'medium';
  return 'none';
};

type FilterType = 'All' | 'Active' | 'Paused' | 'Watchlist';

// Helper to get start of week (Sunday)
const getWeekStart = (date: Date) => {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day;
  return new Date(d.setDate(diff));
};

// Helper to format date as YYYY-MM-DD using local time (not UTC)
const toISODate = (date: Date): string => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

export const ManagerScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();
  const insets = useScreenInsets();
  const { user } = useAuth();
  const { subscriptions, loading, monthlySpend, activeSubscriptions } = useSubscriptions();

  const [filter, setFilter] = useState<FilterType>('All');
  const [isPersonaExpanded, setIsPersonaExpanded] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [currentMonth, setCurrentMonth] = useState(new Date()); // Track current month for navigation
  const [weekStart, setWeekStart] = useState(getWeekStart(new Date()));
  const [userInfo, setUserInfo] = useState<any>(null);
  const [personaTitle, setPersonaTitle] = useState<string>('PRO SAVER');
  const [categories, setCategories] = useState(['Entertainment', 'Productivity', 'Utilities', 'Health']);

  // Load fresh user data on mount and every time the screen comes into focus
  // (covers returning from Settings where budget/currency may have changed)
  useFocusEffect(useCallback(() => {
    loadUserInfo();
  }, [user]));

  // Load all categories (including custom ones)
  useEffect(() => {
    const loadCategories = async () => {
      const allCats = await getAllCategories();
      setCategories(allCats);
    };
    loadCategories();
  }, []);

  const loadUserInfo = async () => {
    if (!user) return;

    try {
      // Load user info including budget
      const { data: userData } = await supabase
        .from('users')
        .select('name, avatar, avatar_style, monthly_budget')
        .eq('id', user.id)
        .single();

      if (userData) {
        setUserInfo(userData);
      }

      // Load persona
      const { data: personaData } = await supabase
        .from('user_personas')
        .select('setup_preferences')
        .eq('user_id', user.id)
        .single();

      if (personaData?.setup_preferences) {
        const profile = generatePersonaProfile(personaData.setup_preferences as SetupPreferences);
        setPersonaTitle(profile.title);
      }
    } catch (error) {
      console.error('Failed to load user info:', error);
    }
  };

  // Filter subscriptions
  const filteredSubs = useMemo(() => {
    return subscriptions.filter(sub => {
      if (filter === 'All') return sub.status !== 'watchlist' && sub.status !== 'cancelled';
      if (filter === 'Active') return sub.status === 'active';
      if (filter === 'Paused') return sub.status === 'paused';
      if (filter === 'Watchlist') return sub.status === 'watchlist';
      return true;
    });
  }, [subscriptions, filter]);

  // Calendar logic
  const currentWeekDays = useMemo(() => {
    const days = [];
    for (let i = 0; i < 7; i++) {
      const day = new Date(weekStart);
      day.setDate(weekStart.getDate() + i);
      days.push(day);
    }
    return days;
  }, [weekStart]);

  // Compute effective next renewal date for every subscription (advances past dates forward)
  const effectiveRenewalMap = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const map = new Map<string, string>();
    subscriptions.forEach(sub => {
      if (!sub.nextRenewalDate) return;
      const [y, m, d] = sub.nextRenewalDate.split('-').map(Number);
      let renewal = new Date(y, m - 1, d);
      while (renewal <= today) {
        switch (sub.billingCycle) {
          case 'daily':     renewal.setDate(renewal.getDate() + 1); break;
          case 'weekly':    renewal.setDate(renewal.getDate() + 7); break;
          case 'monthly':   renewal.setMonth(renewal.getMonth() + 1); break;
          case 'quarterly': renewal.setMonth(renewal.getMonth() + 3); break;
          case 'yearly':    renewal.setFullYear(renewal.getFullYear() + 1); break;
        }
      }
      map.set(sub.id, toISODate(renewal));
    });
    return map;
  }, [subscriptions]);

  const getSubsForDate = (date: Date) => {
    const dateStr = toISODate(date);
    return subscriptions.filter(sub =>
      effectiveRenewalMap.get(sub.id) === dateStr && sub.status === 'active'
    );
  };

  const selectedDateStr = toISODate(selectedDate);
  const selectedSubs = getSubsForDate(selectedDate);

  const handlePrevWeek = () => {
    const newStart = new Date(weekStart);
    newStart.setDate(weekStart.getDate() - 7);
    setWeekStart(newStart);
    setCurrentMonth(new Date(newStart)); // Update current month
  };

  const handleNextWeek = () => {
    const newStart = new Date(weekStart);
    newStart.setDate(weekStart.getDate() + 7);
    setWeekStart(newStart);
    setCurrentMonth(new Date(newStart)); // Update current month
  };

  const handlePrevMonth = () => {
    const newMonth = new Date(currentMonth);
    newMonth.setMonth(currentMonth.getMonth() - 1);
    newMonth.setDate(1); // Set to first day of month
    setCurrentMonth(newMonth);
    setWeekStart(getWeekStart(newMonth)); // Update week to start of new month
    setSelectedDate(newMonth); // Update selected date
  };

  const handleNextMonth = () => {
    const newMonth = new Date(currentMonth);
    newMonth.setMonth(currentMonth.getMonth() + 1);
    newMonth.setDate(1); // Set to first day of month
    setCurrentMonth(newMonth);
    setWeekStart(getWeekStart(newMonth)); // Update week to start of new month
    setSelectedDate(newMonth); // Update selected date
  };

  const monthName = currentMonth.toLocaleDateString('en-US', { month: 'long' });
  const yearNum = currentMonth.getFullYear();

  return (
    <View style={styles.backgroundContainer}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + spacing.md }]}>
        <View style={styles.headerSpacer} />
        <Text style={styles.headerTitle}>MANAGER</Text>
        <Pressable
          style={styles.settingsButton}
          onPress={() => navigation.navigate('Settings')}
        >
          <Text style={styles.settingsIcon}>⚙️</Text>
        </Pressable>
      </View>

      <ScrollView
        style={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* User Stats Card */}
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={styles.loadingText}>Loading your subscriptions...</Text>
          </View>
        ) : (
          <>
            <View style={styles.userStatsCard}>
              <View style={styles.userHeader}>
                <View style={styles.avatarContainer}>
                  <Image
                    source={{
                      uri: userInfo?.avatar || generateAvatarUrl(
                        userInfo?.name || user?.name || 'User',
                        user?.id || '',
                        userInfo?.avatar_style || 'notionists'
                      )
                    }}
                    style={styles.avatar}
                  />
                </View>
                <View style={styles.userInfo}>
                  <Text style={styles.userName}>{userInfo?.name || user?.name || 'User'}</Text>
                  <View style={styles.badgeContainer}>
                    <Text style={styles.badgeText}>{personaTitle.toUpperCase()}</Text>
                    <Text style={styles.badgeIcon}>⭐</Text>
                  </View>
                </View>
              </View>

              {/* Budget Stats */}
              <View style={styles.statsRow}>
                <View style={styles.statCard}>
                  <View style={styles.statContent}>
                    <Text style={styles.statLabel}>BUDGET</Text>
                    <Text style={styles.statValue}>${userInfo?.monthly_budget || user?.monthlyBudget || 100}</Text>
                  </View>
                  <Text style={styles.statIcon}>💰</Text>
                </View>
                <View style={[styles.statCard, styles.statCardActive]}>
                  <View style={styles.statContent}>
                    <Text style={styles.statLabelActive}>ACTIVE</Text>
                    <Text style={styles.statValueActive}>${monthlySpend.toFixed(2)}</Text>
                  </View>
                  <Text style={styles.statIcon}>💳</Text>
                </View>
              </View>
            </View>

            {/* Calendar Widget */}
        <View style={styles.calendarSection}>
          <View style={styles.calendarCard}>
            <View style={styles.calendarHeader}>
              {/* Month navigation - double arrows */}
              <Pressable
                style={styles.calendarNavButton}
                onPress={handlePrevMonth}
              >
                <Text style={styles.calendarNavIcon}>«</Text>
              </Pressable>

              {/* Week navigation - single arrow on left */}
              <Pressable
                style={styles.weekNavArrowButton}
                onPress={handlePrevWeek}
              >
                <Text style={styles.calendarNavIcon}>‹</Text>
              </Pressable>

              {/* Center text */}
              <View style={styles.calendarHeaderText}>
                <Text style={styles.calendarMonth}>{monthName} {yearNum}</Text>
                <Text style={styles.calendarSubtitle}>WEEK VIEW</Text>
              </View>

              {/* Week navigation - single arrow on right */}
              <Pressable
                style={styles.weekNavArrowButton}
                onPress={handleNextWeek}
              >
                <Text style={styles.calendarNavIcon}>›</Text>
              </Pressable>

              {/* Month navigation - double arrows */}
              <Pressable
                style={styles.calendarNavButton}
                onPress={handleNextMonth}
              >
                <Text style={styles.calendarNavIcon}>»</Text>
              </Pressable>
            </View>

            {/* Day headers */}
            <View style={styles.calendarDayHeaders}>
              {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, idx) => (
                <Text key={idx} style={styles.calendarDayHeader}>{day}</Text>
              ))}
            </View>

            {/* Calendar days */}
            <View style={styles.calendarGrid}>
              {currentWeekDays.map((date, idx) => {
                const dayNum = date.getDate();
                const dateStr = toISODate(date);
                const subsOnDay = getSubsForDate(date);
                const hasReminders = subsOnDay.some(s => s.isReminder);
                const hasRenewals = subsOnDay.length > 0;
                const isSelected = selectedDateStr === dateStr;

                return (
                  <Pressable
                    key={idx}
                    onPress={() => setSelectedDate(date)}
                    style={[
                      styles.calendarDay,
                      isSelected && styles.calendarDaySelected
                    ]}
                  >
                    <Text style={[
                      styles.calendarDayText,
                      isSelected && styles.calendarDayTextSelected
                    ]}>
                      {dayNum}
                    </Text>
                    {hasRenewals && (
                      <View style={[
                        styles.calendarDayDot,
                        isSelected && styles.calendarDayDotSelected,
                        hasReminders && styles.calendarDayDotReminder
                      ]} />
                    )}
                  </Pressable>
                );
              })}
            </View>

            {/* Selected day subscriptions */}
            {selectedSubs.length > 0 ? (
              <View style={styles.calendarSubsList}>
                <Text style={styles.calendarSubsTitle}>
                  Scheduled for {selectedDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                </Text>
                {selectedSubs.map(sub => (
                  <View key={sub.id} style={styles.calendarSubCard}>
                    <View style={styles.calendarSubLeft}>
                      <Text style={styles.calendarSubIcon}>{sub.icon}</Text>
                      <View style={styles.calendarSubInfo}>
                        <Text style={[
                          styles.calendarSubName,
                          sub.isReminder && styles.calendarSubNameReminder
                        ]}>
                          {sub.name}
                        </Text>
                        <Text
                          style={styles.calendarSubCategory}
                          numberOfLines={1}
                        >
                          {sub.category.toUpperCase()}
                        </Text>
                      </View>
                    </View>
                    <Text style={[
                      styles.calendarSubCost,
                      sub.isReminder && styles.calendarSubCostReminder
                    ]}>
                      {sub.cost > 0 ? `$${sub.cost.toFixed(2)}` : 'Reminder'}
                    </Text>
                  </View>
                ))}
              </View>
            ) : (
              <View style={styles.calendarEmpty}>
                <Text style={styles.calendarEmptyText}>
                  No active events on {selectedDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* Filter Chips */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.filterContainer}
          contentContainerStyle={styles.filterContentContainer}
        >
          {(['All', 'Active', 'Paused', 'Watchlist'] as FilterType[]).map(f => (
            <Pressable
              key={f}
              onPress={() => setFilter(f)}
              style={({ pressed }) => [
                styles.filterChip,
                filter === f && styles.filterChipActive,
                pressed && styles.filterChipPressed
              ]}
            >
              <Text style={[
                styles.filterText,
                filter === f && styles.filterTextActive
              ]}>
                {f.toUpperCase()}
              </Text>
            </Pressable>
          ))}
        </ScrollView>

        {/* Subscription List by Category */}
        <View style={styles.listContainer}>
          {filteredSubs.length === 0 && (
            <View style={styles.emptyListState}>
              <Text style={styles.emptyListIcon}>📭</Text>
              <Text style={styles.emptyListTitle}>
                {filter === 'All' ? 'No subscriptions yet' : `No ${filter.toLowerCase()} subscriptions`}
              </Text>
              <Text style={styles.emptyListSub}>
                {filter === 'All'
                  ? 'Tap + to add your first subscription'
                  : 'Try a different filter'}
              </Text>
            </View>
          )}
          {categories.map(category => {
            const catSubs = filteredSubs.filter(s => s.category === category);
            if (catSubs.length === 0) return null;
            const riskOrder = { high: 0, medium: 1, none: 2 };
            const sortedCatSubs = [...catSubs].sort(
              (a, b) => riskOrder[getRiskLevel(a)] - riskOrder[getRiskLevel(b)]
            );

            return (
              <View key={category} style={styles.categorySection}>
                <Text style={styles.categoryTitle}>{category.toUpperCase()}</Text>
                <View style={styles.categoryList}>
                  {sortedCatSubs.map(sub => (
                    <Pressable
                      key={sub.id}
                      onPress={() => navigation.navigate('SubscriptionDetail', { subscriptionId: sub.id })}
                      style={({ pressed }) => [
                        styles.subscriptionCard,
                        sub.status === 'paused' && styles.subscriptionCardPaused,
                        sub.status === 'watchlist' && styles.subscriptionCardWatchlist,
                        pressed && styles.subscriptionCardPressed
                      ]}
                    >
                      <View style={styles.subscriptionIcon}>
                        <Text style={styles.iconEmoji}>{sub.iconEmoji}</Text>
                      </View>
                      <View style={styles.subscriptionInfo}>
                        <View style={styles.subscriptionNameRow}>
                          <Text style={[
                            styles.subscriptionName,
                            sub.isReminder && styles.subscriptionNameReminder,
                            { marginBottom: 0 }
                          ]}>
                            {sub.name}
                          </Text>
                          {getRiskLevel(sub) === 'high' && (
                            <View style={styles.riskBadgeHigh}>
                              <Text style={styles.riskBadgeHighText}>⚠ AT RISK</Text>
                            </View>
                          )}
                          {getRiskLevel(sub) === 'medium' && (
                            <View style={styles.riskBadgeMedium}>
                              <Text style={styles.riskBadgeMediumText}>• REVIEW</Text>
                            </View>
                          )}
                        </View>
                        <Text style={styles.subscriptionPlan}>
                          {sub.planName.toUpperCase()}
                        </Text>
                      </View>
                      <View style={styles.subscriptionRight}>
                        <Text style={[
                          styles.subscriptionCost,
                          sub.isReminder && styles.subscriptionCostReminder
                        ]}>
                          {sub.cost > 0 ? `$${sub.cost.toFixed(2)}` : 'Trial End'}
                        </Text>
                        <Text style={[
                          styles.subscriptionDate,
                          sub.isReminder && styles.subscriptionDateReminder
                        ]}>
                          {(() => {
                            const ds = effectiveRenewalMap.get(sub.id) || sub.nextRenewalDate;
                            const [y, mo, d] = ds.split('-').map(Number);
                            return new Date(y, mo - 1, d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                          })()}
                        </Text>
                      </View>
                    </Pressable>
                  ))}
                </View>
              </View>
            );
          })}
        </View>

            <View style={{ height: 100 }} />
          </>
        )}
      </ScrollView>

      {/* FAB Button */}
      <Pressable
        onPress={() => navigation.navigate('AddSubscription', {})}
        style={({ pressed }) => [
          styles.fab,
          { bottom: insets.bottom + spacing.lg },
          pressed && styles.fabPressed
        ]}
      >
        <Text style={styles.fabIcon}>+</Text>
      </Pressable>
    </View>
  );
};

const styles = StyleSheet.create({
  backgroundContainer: {
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
  headerSpacer: {
    width: 40,
  },
  headerTitle: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.black as any,
    color: colors.textPrimary,
    letterSpacing: 1.6,
  },
  settingsButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  settingsIcon: {
    fontSize: 20,
  },
  scrollContent: {
    flex: 1,
  },
  loadingContainer: {
    padding: spacing.xxxl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: spacing.md,
    fontSize: fontSize.sm,
    color: colors.textSecondary,
  },
  userStatsCard: {
    backgroundColor: colors.textInverse,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray100,
  },
  userHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
    marginBottom: spacing.md,
  },
  avatarContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    overflow: 'hidden',
    borderWidth: 4,
    borderColor: colors.primaryLight,
    ...shadows.lg,
  },
  avatar: {
    width: '100%',
    height: '100%',
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 24,
    fontWeight: fontWeight.black as any,
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  badgeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: fontWeight.black as any,
    color: colors.primary,
    letterSpacing: 1.2,
  },
  badgeIcon: {
    fontSize: 12,
  },
  personaCard: {
    backgroundColor: `${colors.primary}0D`,
    borderRadius: borderRadius.xxl,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: `${colors.primary}1A`,
    marginBottom: spacing.md,
  },
  personaCardExpanded: {
    backgroundColor: `${colors.primary}14`,
  },
  personaHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  personaEmoji: {
    fontSize: 32,
  },
  personaInfo: {
    flex: 1,
  },
  personaLabel: {
    fontSize: 9,
    fontWeight: fontWeight.black as any,
    color: colors.primary,
    letterSpacing: 1.2,
    opacity: 0.7,
    marginBottom: 2,
  },
  personaTitle: {
    fontSize: fontSize.base,
    fontWeight: fontWeight.black as any,
    color: colors.textPrimary,
  },
  expandButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: `${colors.primary}1A`,
    alignItems: 'center',
    justifyContent: 'center',
  },
  expandIcon: {
    fontSize: 12,
    color: colors.primary,
  },
  personaContent: {
    marginTop: spacing.lg,
    paddingTop: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: `${colors.primary}1A`,
    gap: spacing.md,
  },
  personaDescription: {
    fontSize: 12,
    color: colors.textSecondary,
    fontStyle: 'italic',
    lineHeight: 18,
  },
  personaTipCard: {
    backgroundColor: colors.textInverse,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: `${colors.primary}0D`,
  },
  tipHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: spacing.xs,
  },
  tipIcon: {
    fontSize: 14,
  },
  tipLabel: {
    fontSize: 9,
    fontWeight: fontWeight.black as any,
    color: colors.primary,
    letterSpacing: 1.2,
  },
  tipText: {
    fontSize: 11,
    fontWeight: fontWeight.bold as any,
    color: colors.textPrimary,
    lineHeight: 16,
  },
  statsRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  statCard: {
    flex: 1,
    backgroundColor: colors.gray50,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: colors.gray100,
  },
  statCardActive: {
    backgroundColor: `${colors.primary}0D`,
    borderColor: `${colors.primary}1A`,
  },
  statContent: {
    flex: 1,
  },
  statLabel: {
    fontSize: 9,
    fontWeight: fontWeight.black as any,
    color: colors.textTertiary,
    letterSpacing: 1.2,
    marginBottom: 2,
  },
  statLabelActive: {
    fontSize: 9,
    fontWeight: fontWeight.black as any,
    color: colors.primary,
    letterSpacing: 1.2,
    marginBottom: 2,
  },
  statValue: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.black as any,
    color: colors.textPrimary,
  },
  statValueActive: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.black as any,
    color: colors.primary,
  },
  statIcon: {
    fontSize: 20,
  },
  filterContainer: {
    paddingVertical: spacing.md,
  },
  filterContentContainer: {
    paddingHorizontal: spacing.lg,
    gap: spacing.sm,
    flexDirection: 'row',
  },
  filterChip: {
    height: 36,
    paddingHorizontal: spacing.md,
    borderRadius: 18,
    backgroundColor: colors.textInverse,
    borderWidth: 1,
    borderColor: colors.gray100,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
    ...shadows.lg,
  },
  filterChipPressed: {
    transform: [{ scale: 0.95 }],
  },
  filterText: {
    fontSize: 10,
    fontWeight: fontWeight.black as any,
    color: colors.textSecondary,
    letterSpacing: 1,
  },
  filterTextActive: {
    color: colors.textInverse,
  },
  listContainer: {
    paddingHorizontal: spacing.lg,
    gap: spacing.lg,
    marginTop: spacing.sm,
  },
  emptyListState: {
    paddingVertical: spacing.xxxl,
    alignItems: 'center',
    gap: spacing.sm,
  },
  emptyListIcon: {
    fontSize: 40,
    marginBottom: spacing.xs,
  },
  emptyListTitle: {
    fontSize: fontSize.base,
    fontWeight: fontWeight.bold as any,
    color: colors.textPrimary,
  },
  emptyListSub: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  categorySection: {
    gap: spacing.md,
  },
  categoryTitle: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.black as any,
    color: colors.textPrimary,
    letterSpacing: 1.6,
    paddingHorizontal: spacing.xs,
  },
  categoryList: {
    gap: spacing.md,
  },
  subscriptionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.textInverse,
    borderRadius: borderRadius.xxl,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.gray100,
    ...shadows.sm,
  },
  subscriptionCardPaused: {
    opacity: 0.5,
  },
  subscriptionCardWatchlist: {
    opacity: 0.75,
    borderLeftWidth: 3,
    borderLeftColor: colors.primary,
  },
  subscriptionCardPressed: {
    transform: [{ scale: 0.98 }],
  },
  subscriptionIcon: {
    width: 56,
    height: 56,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.gray50,
    marginRight: spacing.md,
  },
  iconEmoji: {
    fontSize: 28,
  },
  subscriptionInfo: {
    flex: 1,
  },
  subscriptionName: {
    fontSize: fontSize.base,
    fontWeight: fontWeight.black as any,
    color: colors.textPrimary,
    marginBottom: 2,
  },
  subscriptionNameReminder: {
    color: colors.danger,
  },
  subscriptionPlan: {
    fontSize: 10,
    fontWeight: fontWeight.black as any,
    color: colors.textTertiary,
    letterSpacing: 1.2,
  },
  subscriptionRight: {
    alignItems: 'flex-end',
    gap: 2,
  },
  subscriptionCost: {
    fontSize: fontSize.base,
    fontWeight: fontWeight.black as any,
    color: colors.textPrimary,
  },
  subscriptionCostReminder: {
    color: colors.danger,
  },
  subscriptionDate: {
    fontSize: 9,
    fontWeight: fontWeight.black as any,
    color: colors.textTertiary,
  },
  subscriptionDateReminder: {
    color: colors.danger,
  },
  fab: {
    position: 'absolute',
    right: spacing.lg,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.lg,
  },
  fabPressed: {
    transform: [{ scale: 0.95 }],
    opacity: 0.9,
  },
  fabIcon: {
    fontSize: 28,
    fontWeight: fontWeight.semibold as any,
    color: '#FFFFFF',
  },
  // Calendar Widget
  calendarSection: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  calendarCard: {
    backgroundColor: colors.textInverse,
    borderRadius: 32,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.gray100,
    ...shadows.xl,
  },
  calendarHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.lg,
    gap: spacing.sm,
  },
  calendarNavButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.gray50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  weekNavArrowButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.gray50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  calendarNavIcon: {
    fontSize: 18,
    fontWeight: fontWeight.bold as any,
    color: colors.primary,
  },
  calendarHeaderText: {
    alignItems: 'center',
  },
  calendarMonth: {
    fontSize: fontSize.base,
    fontWeight: fontWeight.black as any,
    color: colors.textPrimary,
    letterSpacing: 1.2,
  },
  calendarSubtitle: {
    fontSize: 8,
    fontWeight: fontWeight.bold as any,
    color: colors.textTertiary,
    letterSpacing: 1.2,
    marginTop: 2,
  },
  calendarDayHeaders: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: spacing.md,
  },
  calendarDayHeader: {
    fontSize: 10,
    fontWeight: fontWeight.black as any,
    color: colors.gray300,
    textAlign: 'center',
    flex: 1,
  },
  calendarGrid: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: spacing.lg,
    gap: spacing.xs,
  },
  calendarDay: {
    height: 48,
    flex: 1,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
    position: 'relative',
  },
  calendarDaySelected: {
    backgroundColor: colors.primary,
    ...shadows.xl,
    transform: [{ scale: 1.1 }],
  },
  calendarDayText: {
    fontSize: fontSize.base,
    fontWeight: fontWeight.black as any,
    color: colors.textPrimary,
  },
  calendarDayTextSelected: {
    color: colors.textInverse,
  },
  calendarDayDot: {
    position: 'absolute',
    bottom: 8,
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.primary,
  },
  calendarDayDotSelected: {
    backgroundColor: colors.textInverse,
  },
  calendarDayDotReminder: {
    backgroundColor: colors.danger,
  },
  calendarSubsList: {
    gap: spacing.sm,
  },
  calendarSubsTitle: {
    fontSize: 10,
    fontWeight: fontWeight.black as any,
    color: colors.textTertiary,
    letterSpacing: 1.2,
    marginBottom: spacing.xs,
    paddingHorizontal: spacing.xs,
  },
  calendarSubCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.lg,
    backgroundColor: colors.gray50,
    borderRadius: borderRadius.xxl,
    borderWidth: 1,
    borderColor: colors.gray100,
  },
  calendarSubLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    flex: 1,
    minWidth: 0,
  },
  calendarSubIcon: {
    fontSize: 32,
  },
  calendarSubInfo: {
    flex: 1,
    minWidth: 0,
  },
  calendarSubName: {
    fontSize: fontSize.base,
    fontWeight: fontWeight.black as any,
    color: colors.textPrimary,
    marginBottom: 2,
  },
  calendarSubNameReminder: {
    color: colors.danger,
  },
  calendarSubCategory: {
    fontSize: 9,
    fontWeight: fontWeight.black as any,
    color: colors.textTertiary,
    letterSpacing: 0,
  },
  calendarSubCost: {
    fontSize: fontSize.base,
    fontWeight: fontWeight.black as any,
    color: colors.primary,
    letterSpacing: 0,
    marginLeft: spacing.md,
    flexShrink: 0,
  },
  calendarSubCostReminder: {
    color: colors.danger,
  },
  calendarEmpty: {
    padding: spacing.xl,
    backgroundColor: `${colors.gray50}80`,
    borderRadius: borderRadius.xxl,
    borderWidth: 1,
    borderColor: colors.gray100,
    borderStyle: 'dashed',
    alignItems: 'center',
  },
  calendarEmptyText: {
    fontSize: 10,
    fontWeight: fontWeight.black as any,
    color: colors.gray300,
    letterSpacing: 1.2,
  },
  subscriptionNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    flexWrap: 'wrap',
    marginBottom: 2,
  },
  riskBadgeHigh: {
    backgroundColor: '#FF3B3015',
    borderRadius: 4,
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderWidth: 1,
    borderColor: '#FF3B3040',
  },
  riskBadgeMedium: {
    backgroundColor: '#FF9F0015',
    borderRadius: 4,
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderWidth: 1,
    borderColor: '#FF9F0040',
  },
  riskBadgeHighText: {
    fontSize: 8,
    fontWeight: fontWeight.black as any,
    color: '#FF3B30',
    letterSpacing: 0.5,
  },
  riskBadgeMediumText: {
    fontSize: 8,
    fontWeight: fontWeight.black as any,
    color: '#FF9F00',
    letterSpacing: 0.5,
  },
});
