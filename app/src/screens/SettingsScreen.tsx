import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  TextInput,
  StyleSheet,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useSubscriptions } from '@/contexts/SubscriptionContext';
import { useAuth } from '@/contexts/AuthContext';
import { useScreenInsets } from '@/hooks/useScreenInsets';
import { colors, spacing, fontSize, fontWeight, borderRadius } from '@/styles';
import { SETUP_QUESTIONS, mergeSetupAnswers } from '@/config/setupQuestions';
import { generatePersonaProfile } from '@/utils/personaGenerator';
import type { SetupPreferences } from '@/types';

const CURRENCIES = ['USD', 'EUR', 'GBP', 'JPY', 'CNY', 'CAD', 'AUD', 'KRW'];
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const REMINDER_DAYS_OPTIONS = [1, 3, 7, 14];

export const SettingsScreen: React.FC = () => {
  const insets = useScreenInsets();
  const navigation = useNavigation();
  const { user, persona, updateUserProfile, updatePersonaPreferences, refresh } = useSubscriptions();
  const { signOut } = useAuth();

  const [budget, setBudget] = useState(String(user?.monthly_budget ?? '100'));
  const [currency, setCurrency] = useState(user?.currency ?? 'USD');
  const [reminderDay, setReminderDay] = useState(user?.reminder_day ?? 0);
  const [daysBefore, setDaysBefore] = useState(user?.reminder_days_before ?? 3);
  const [saving, setSaving] = useState(false);
  const [savedFeedback, setSavedFeedback] = useState(false);

  const [showPersonaRetake, setShowPersonaRetake] = useState(false);
  const [personaAnswers, setPersonaAnswers] = useState<Partial<SetupPreferences>>({});
  const [personaStep, setPersonaStep] = useState(0);
  const [savingPersona, setSavingPersona] = useState(false);

  const currentPersona = persona?.setup_preferences
    ? generatePersonaProfile(persona.setup_preferences as SetupPreferences)
    : null;

  useEffect(() => {
    if (user) {
      setBudget(String(user.monthly_budget ?? '100'));
      setCurrency(user.currency ?? 'USD');
      setReminderDay(user.reminder_day ?? 0);
      setDaysBefore(user.reminder_days_before ?? 3);
    }
  }, [user]);

  const handleSave = async () => {
    const budgetNum = parseFloat(budget);
    if (isNaN(budgetNum) || budgetNum <= 0) {
      Alert.alert('Invalid Budget', 'Please enter a valid monthly budget greater than 0.');
      return;
    }
    setSaving(true);
    const ok = await updateUserProfile({
      monthly_budget: budgetNum,
      currency,
      reminder_day: reminderDay,
      reminder_days_before: daysBefore,
    });
    setSaving(false);
    if (ok) {
      setSavedFeedback(true);
      setTimeout(() => setSavedFeedback(false), 2000);
    } else {
      Alert.alert('Error', 'Failed to save settings. Please try again.');
    }
  };

  const handlePersonaAnswer = useCallback(async (values: Partial<SetupPreferences>) => {
    const merged = { ...personaAnswers, ...values };
    setPersonaAnswers(merged);

    if (personaStep < SETUP_QUESTIONS.length - 1) {
      setPersonaStep(s => s + 1);
    } else {
      setSavingPersona(true);
      const final = mergeSetupAnswers(merged);
      const ok = await updatePersonaPreferences(final);
      if (ok) await refresh();
      setSavingPersona(false);
      setShowPersonaRetake(false);
      setPersonaStep(0);
      setPersonaAnswers({});
      if (!ok) Alert.alert('Error', 'Failed to update persona. Please try again.');
    }
  }, [personaAnswers, personaStep, updatePersonaPreferences, refresh]);

  const cancelPersonaRetake = () => {
    setShowPersonaRetake(false);
    setPersonaStep(0);
    setPersonaAnswers({});
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Settings</Text>
        <Pressable style={styles.closeBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="close" size={22} color={colors.textPrimary} />
        </Pressable>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.xl * 2 }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >

        {/* ── Persona hero ── */}
        {!showPersonaRetake ? (
          <View style={styles.personaHero}>
            {currentPersona ? (
              <>
                <Text style={styles.personaEmoji}>{currentPersona.emoji}</Text>
                <Text style={styles.personaName}>{currentPersona.title}</Text>
                <Text style={styles.personaDesc}>{currentPersona.description}</Text>
                <View style={styles.traitRow}>
                  {currentPersona.traits.slice(0, 3).map(trait => (
                    <View key={trait} style={styles.traitPill}>
                      <Text style={styles.traitText}>{trait}</Text>
                    </View>
                  ))}
                </View>
                <Pressable style={styles.retakeBtn} onPress={() => setShowPersonaRetake(true)}>
                  <Ionicons name="refresh-outline" size={14} color={colors.primary} />
                  <Text style={styles.retakeBtnText}>Retake quiz</Text>
                </Pressable>
              </>
            ) : (
              <>
                <Text style={styles.personaEmoji}>⚖️</Text>
                <Text style={styles.personaName}>No persona yet</Text>
                <Pressable style={styles.retakeBtn} onPress={() => setShowPersonaRetake(true)}>
                  <Text style={styles.retakeBtnText}>Take quiz</Text>
                </Pressable>
              </>
            )}
          </View>
        ) : (
          <View style={styles.quizCard}>
            <View style={styles.quizTopRow}>
              <View style={styles.quizDots}>
                {SETUP_QUESTIONS.map((_, i) => (
                  <View
                    key={i}
                    style={[styles.quizDot, i === personaStep && styles.quizDotActive]}
                  />
                ))}
              </View>
              <Pressable onPress={cancelPersonaRetake}>
                <Text style={styles.cancelText}>Cancel</Text>
              </Pressable>
            </View>
            <Text style={styles.quizQuestion}>{SETUP_QUESTIONS[personaStep].question}</Text>
            <View style={styles.quizOptions}>
              {SETUP_QUESTIONS[personaStep].options.map(option => (
                <Pressable
                  key={option.label}
                  style={[styles.quizOption, savingPersona && styles.quizOptionDisabled]}
                  onPress={() => !savingPersona && handlePersonaAnswer(option.values as Partial<SetupPreferences>)}
                >
                  <Text style={styles.quizOptionEmoji}>{option.emoji}</Text>
                  <Text style={styles.quizOptionText}>{option.label}</Text>
                  <Ionicons name="chevron-forward" size={16} color={colors.gray400} />
                </Pressable>
              ))}
            </View>
            {savingPersona && <Text style={styles.savingText}>Saving…</Text>}
          </View>
        )}

        {/* ── Budget ── */}
        <View style={styles.group}>
          <Text style={styles.groupLabel}>Monthly Budget</Text>
          <View style={styles.budgetCard}>
            <Text style={styles.budgetSymbol}>$</Text>
            <TextInput
              style={styles.budgetInput}
              value={budget}
              onChangeText={setBudget}
              keyboardType="decimal-pad"
              placeholder="100"
              placeholderTextColor={colors.gray400}
              selectTextOnFocus
            />
          </View>
        </View>

        {/* ── Currency ── */}
        <View style={styles.group}>
          <Text style={styles.groupLabel}>Currency</Text>
          <View style={styles.chipWrap}>
            {CURRENCIES.map(c => (
              <Pressable
                key={c}
                style={[styles.chip, currency === c && styles.chipOn]}
                onPress={() => setCurrency(c)}
              >
                <Text style={[styles.chipLabel, currency === c && styles.chipLabelOn]}>{c}</Text>
              </Pressable>
            ))}
          </View>
        </View>

        {/* ── Reminders ── */}
        <View style={styles.group}>
          <Text style={styles.groupLabel}>Check-in Day</Text>
          <View style={styles.chipWrap}>
            {WEEKDAYS.map((day, i) => (
              <Pressable
                key={day}
                style={[styles.chip, styles.chipDay, reminderDay === i && styles.chipOn]}
                onPress={() => setReminderDay(i)}
              >
                <Text style={[styles.chipLabel, reminderDay === i && styles.chipLabelOn]}>{day}</Text>
              </Pressable>
            ))}
          </View>
        </View>

        <View style={styles.group}>
          <Text style={styles.groupLabel}>Renewal Alert</Text>
          <Text style={styles.groupSub}>Days before a subscription renews</Text>
          <View style={styles.chipWrap}>
            {REMINDER_DAYS_OPTIONS.map(d => (
              <Pressable
                key={d}
                style={[styles.chip, styles.chipDay, daysBefore === d && styles.chipOn]}
                onPress={() => setDaysBefore(d)}
              >
                <Text style={[styles.chipLabel, daysBefore === d && styles.chipLabelOn]}>
                  {d} {d === 1 ? 'day' : 'days'}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        {/* ── Save ── */}
        <Pressable
          style={[
            styles.saveBtn,
            (saving || savedFeedback) && styles.saveBtnDisabled,
            savedFeedback && styles.saveBtnSaved,
          ]}
          onPress={handleSave}
          disabled={saving || savedFeedback}
        >
          <Text style={styles.saveBtnText}>
            {savedFeedback ? 'Saved ✓' : saving ? 'Saving…' : 'Save Changes'}
          </Text>
        </Pressable>

        {/* ── Sign Out ── */}
        <Pressable
          style={styles.signOutBtn}
          onPress={() =>
            Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Sign Out', style: 'destructive', onPress: signOut },
            ])
          }
        >
          <Ionicons name="log-out-outline" size={17} color={colors.danger} />
          <Text style={styles.signOutText}>Sign Out</Text>
        </Pressable>

      </ScrollView>
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
    paddingVertical: spacing.md,
  },
  headerTitle: {
    fontSize: fontSize.xl,
    fontWeight: fontWeight.bold as any,
    color: colors.textPrimary,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.gray100,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scroll: {
    flex: 1,
  },
  content: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    gap: spacing.xl,
  },

  // ── Persona hero ──
  personaHero: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.white,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.gray200,
  },
  personaEmoji: {
    fontSize: 52,
    marginBottom: spacing.md,
  },
  personaName: {
    fontSize: fontSize.xl,
    fontWeight: fontWeight.bold as any,
    color: colors.textPrimary,
    marginBottom: spacing.sm,
    textAlign: 'center',
  },
  personaDesc: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: spacing.lg,
    paddingHorizontal: spacing.sm,
  },
  traitRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  traitPill: {
    backgroundColor: colors.gray100,
    borderRadius: borderRadius.full,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
  },
  traitText: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.semibold as any,
    color: colors.textSecondary,
    letterSpacing: 0.3,
  },
  retakeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  retakeBtnText: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold as any,
    color: colors.primary,
  },

  // ── Persona quiz ──
  quizCard: {
    backgroundColor: colors.white,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.gray200,
  },
  quizTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  quizDots: {
    flexDirection: 'row',
    gap: 6,
  },
  quizDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.gray200,
  },
  quizDotActive: {
    backgroundColor: colors.primary,
    width: 18,
  },
  cancelText: {
    fontSize: fontSize.sm,
    color: colors.primary,
    fontWeight: fontWeight.semibold as any,
  },
  quizQuestion: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.bold as any,
    color: colors.textPrimary,
    marginBottom: spacing.lg,
    lineHeight: 26,
  },
  quizOptions: {
    gap: spacing.sm,
  },
  quizOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.gray50,
    borderRadius: borderRadius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderWidth: 1,
    borderColor: colors.gray200,
  },
  quizOptionDisabled: {
    opacity: 0.4,
  },
  quizOptionEmoji: {
    fontSize: 22,
  },
  quizOptionText: {
    fontSize: fontSize.base,
    color: colors.textPrimary,
    flex: 1,
  },
  savingText: {
    textAlign: 'center',
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    marginTop: spacing.md,
  },

  // ── Groups (budget / currency / reminders) ──
  group: {
    gap: spacing.sm,
  },
  groupLabel: {
    fontSize: fontSize.base,
    fontWeight: fontWeight.semibold as any,
    color: colors.textPrimary,
  },
  groupSub: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    marginTop: -spacing.xs,
  },

  // Budget big input
  budgetCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.gray200,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md + 2,
  },
  budgetSymbol: {
    fontSize: fontSize.xxl,
    fontWeight: fontWeight.bold as any,
    color: colors.textSecondary,
    marginRight: spacing.xs,
  },
  budgetInput: {
    fontSize: fontSize.xxl,
    fontWeight: fontWeight.bold as any,
    color: colors.textPrimary,
    flex: 1,
  },

  // Chips
  chipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    borderRadius: borderRadius.sm,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.gray200,
  },
  chipDay: {
    minWidth: 52,
    alignItems: 'center',
  },
  chipOn: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  chipLabel: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold as any,
    color: colors.textSecondary,
  },
  chipLabelOn: {
    color: colors.white,
  },

  // Save
  saveBtn: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.md,
    paddingVertical: spacing.md + 2,
    alignItems: 'center',
  },
  saveBtnDisabled: {
    opacity: 0.75,
  },
  saveBtnSaved: {
    backgroundColor: colors.success,
    opacity: 1,
  },
  saveBtnText: {
    fontSize: fontSize.base,
    fontWeight: fontWeight.bold as any,
    color: colors.white,
    letterSpacing: 0.3,
  },

  // Sign out
  signOutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
  },
  signOutText: {
    fontSize: fontSize.base,
    fontWeight: fontWeight.semibold as any,
    color: colors.danger,
  },
});
