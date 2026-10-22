import React, { useState } from 'react';
import { View, Text, Pressable, StyleSheet, ScrollView, ActivityIndicator, Image, TextInput } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '@/navigation/RootNavigator';
import { colors, spacing, fontSize, fontWeight, borderRadius, shadows } from '@/styles';
import { useScreenInsets } from '@/hooks/useScreenInsets';
import { SETUP_QUESTIONS, mergeSetupAnswers } from '@/config/setupQuestions';
import type { SetupPreferences, AvatarStyle } from '@/types';
import { supabase } from '@/utils/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { AVATAR_STYLE_OPTIONS } from '@/utils/avatarStyles';
import { generateAvatarUrl } from '@/utils/avatarUtils';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;
const SETUP_REQUEST_TIMEOUT_MS = 10000;

const withTimeout = async <T,>(promise: PromiseLike<T>, timeoutMs: number, label: string): Promise<T> => {
  let timer: ReturnType<typeof setTimeout> | null = null;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => reject(new Error(`${label} timed out after ${timeoutMs}ms`)), timeoutMs);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
};

export const SetupScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();
  const insets = useScreenInsets();
  const { user } = useAuth();

  const [currentStep, setCurrentStep] = useState(-4); // -4 name, -3 budget, -2 avatar, -1 categories
  const [userName, setUserName] = useState('');
  const [monthlyBudget, setMonthlyBudget] = useState('100');
  const [selectedAvatarSeed, setSelectedAvatarSeed] = useState('1');
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [answers, setAnswers] = useState<Partial<SetupPreferences>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [avatarPage, setAvatarPage] = useState(0);

  const CATEGORY_OPTIONS = [
    { label: 'Music', emoji: '🎵' },
    { label: 'Video', emoji: '🎬' },
    { label: 'Podcast', emoji: '🎙️' },
    { label: 'Gaming', emoji: '🎮' },
    { label: 'Productivity', emoji: '💻' },
    { label: 'Health', emoji: '🩺' },
    { label: 'Fitness', emoji: '💪' },
    { label: 'Learning', emoji: '📚' },
    { label: 'Design', emoji: '🎨' },
    { label: 'Creative', emoji: '✨' },
    { label: 'Social', emoji: '💬' },
    { label: 'News', emoji: '📰' },
    { label: 'Finance', emoji: '💰' },
    { label: 'Career', emoji: '💼' },
  ];

  // Generate different Notionists avatars using different seeds - 3 pages with 12 each
  const allAvatarSeeds = [
    // Page 1
    ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12'],
    // Page 2
    ['13', '14', '15', '16', '17', '18', '19', '20', '21', '22', '23', '24'],
    // Page 3
    ['25', '26', '27', '28', '29', '30', '31', '32', '33', '34', '35', '36']
  ];

  const currentAvatarSeeds = allAvatarSeeds[avatarPage];

  const isNameStep = currentStep === -4;
  const isBudgetStep = currentStep === -3;
  const isAvatarStep = currentStep === -2;
  const isCategoryStep = currentStep === -1;
  const currentQuestion = (isNameStep || isBudgetStep || isAvatarStep || isCategoryStep) ? null : SETUP_QUESTIONS[currentStep];
  const isLastQuestion = currentStep === SETUP_QUESTIONS.length - 1;
  const totalSteps = SETUP_QUESTIONS.length + 4; // +4 for name, budget, avatar, categories
  const progress = ((currentStep + 5) / totalSteps) * 100; // +5 because step starts at -4

  const handleNameSubmit = () => {
    if (!userName.trim()) {
      alert('Please enter your name');
      return;
    }
    setCurrentStep(-3); // Move to budget input
  };

  const handleBudgetSubmit = () => {
    const budgetNum = parseFloat(monthlyBudget);
    if (isNaN(budgetNum) || budgetNum <= 0) {
      alert('Please enter a valid budget amount');
      return;
    }
    setCurrentStep(-2); // Move to avatar selection
  };

  const handleSelectAvatar = (seed: string) => {
    setSelectedAvatarSeed(seed);

    // Auto-advance to category step after brief delay
    setTimeout(() => {
      setCurrentStep(-1);
    }, 200);
  };

  const handleToggleCategory = (category: string) => {
    setSelectedCategories(prev =>
      prev.includes(category)
        ? prev.filter(c => c !== category)
        : [...prev, category]
    );
  };

  const handleCategorySubmit = () => {
    setAnswers(prev => ({
      ...prev,
      favorite_categories: selectedCategories,
    }));
    setCurrentStep(0);
  };

  const handleSelectOption = (optionIndex: number) => {
    if (!currentQuestion) return;

    const selectedOption = currentQuestion.options[optionIndex];

    // Merge selected values into answers
    setAnswers(prev => ({
      ...prev,
      ...selectedOption.values
    }));

    // Auto-advance after brief delay for UX feedback
    setTimeout(() => {
      if (isLastQuestion) {
        handleComplete();
      } else {
        setCurrentStep(prev => prev + 1);
      }
    }, 200);
  };

  const handleComplete = async () => {
    if (!user) return;

    setIsSubmitting(true);

    try {
      // Merge answers with defaults
      const completePreferences = mergeSetupAnswers(answers);

      // Update user name, budget, and avatar
      const { error: userUpdateError } = await withTimeout(
        supabase
          .from('users')
          .update({
            name: userName.trim(),
            monthly_budget: parseFloat(monthlyBudget),
            avatar: `https://api.dicebear.com/7.x/notionists/png?seed=${selectedAvatarSeed}&size=150`,
            avatar_style: 'notionists'
          })
          .eq('id', user.id),
        SETUP_REQUEST_TIMEOUT_MS,
        'update user profile'
      ) as any;
      if (userUpdateError) throw userUpdateError;

      // Save persona to Supabase
      const { error } = await withTimeout(
        supabase
          .from('user_personas')
          .upsert({
            user_id: user.id,
            setup_preferences: completePreferences,
            setup_completed: true,
            confidence_score: 0.3, // Base confidence from setup completion
            last_updated: new Date().toISOString()
          }, {
            onConflict: 'user_id'
          }),
        SETUP_REQUEST_TIMEOUT_MS,
        'save persona'
      ) as any;

      if (error) throw error;

      // Navigate to persona result screen
      navigation.navigate('PersonaResult' as any);
    } catch (error) {
      console.error('Setup save failed:', error);
      alert('Failed to save your preferences. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSkip = async () => {
    if (!user) return;

    try {
      // Save with defaults
      const defaultPreferences = mergeSetupAnswers({});

      await supabase
        .from('user_personas')
        .upsert({
          user_id: user.id,
          setup_preferences: defaultPreferences,
          setup_completed: false, // Mark as not completed
          confidence_score: 0.2, // Lower confidence for skipped setup
          last_updated: new Date().toISOString()
        }, {
          onConflict: 'user_id'
        });

      navigation.reset({
        index: 0,
        routes: [{ name: 'MainApp' as any }]
      });
    } catch (error) {
      console.error('Skip setup failed:', error);
      navigation.reset({
        index: 0,
        routes: [{ name: 'MainApp' as any }]
      });
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(prev => prev - 1);
    }
  };

  if (isSubmitting) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Setting up your profile...</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.progressBarContainer}>
          <View style={[styles.progressBar, { width: `${progress}%` }]} />
        </View>
        <View style={styles.headerRow}>
          <Text style={styles.stepText}>
            {isNameStep ? 'Name' : isBudgetStep ? 'Budget' : isAvatarStep ? 'Avatar' : isCategoryStep ? 'Interests' : `${currentStep + 1} of ${SETUP_QUESTIONS.length}`}
          </Text>
          {!isNameStep && !isBudgetStep && !isAvatarStep && !isCategoryStep && (
            <Pressable onPress={handleSkip} style={styles.skipButton}>
              <Text style={styles.skipText}>Skip</Text>
            </Pressable>
          )}
        </View>
      </View>

      {/* Content */}
      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        {isNameStep ? (
          /* Name Input */
          <>
            <Text style={styles.question}>What's your name?</Text>
            <Text style={styles.questionSubtitle}>
              We'll use this to personalize your experience
            </Text>

            <View style={styles.nameInputContainer}>
              <TextInput
                style={styles.nameInput}
                placeholder="Enter your name"
                placeholderTextColor={colors.textTertiary}
                value={userName}
                onChangeText={setUserName}
                autoFocus
                autoCapitalize="words"
                autoCorrect={false}
              />

              <Pressable
                onPress={handleNameSubmit}
                style={({ pressed }) => [
                  styles.nameSubmitButton,
                  pressed && styles.nameSubmitButtonPressed,
                  !userName.trim() && styles.nameSubmitButtonDisabled
                ]}
                disabled={!userName.trim()}
              >
                <Text style={styles.nameSubmitButtonText}>Continue</Text>
              </Pressable>
            </View>
          </>
        ) : isBudgetStep ? (
          /* Budget Input */
          <>
            <Text style={styles.question}>What's your monthly budget?</Text>
            <Text style={styles.questionSubtitle}>
              Set a budget to help track your subscription spending
            </Text>

            <View style={styles.nameInputContainer}>
              <View style={styles.budgetInputWrapper}>
                <Text style={styles.currencySymbol}>$</Text>
                <TextInput
                  style={styles.budgetInput}
                  placeholder="100"
                  placeholderTextColor={colors.textTertiary}
                  value={monthlyBudget}
                  onChangeText={setMonthlyBudget}
                  autoFocus
                  keyboardType="decimal-pad"
                />
              </View>

              <Pressable
                onPress={handleBudgetSubmit}
                style={({ pressed }) => [
                  styles.nameSubmitButton,
                  pressed && styles.nameSubmitButtonPressed,
                  (!monthlyBudget || parseFloat(monthlyBudget) <= 0) && styles.nameSubmitButtonDisabled
                ]}
                disabled={!monthlyBudget || parseFloat(monthlyBudget) <= 0}
              >
                <Text style={styles.nameSubmitButtonText}>Continue</Text>
              </Pressable>
            </View>
          </>
        ) : isAvatarStep ? (
          /* Avatar Selection - Notionists only */
          <>
            <Text style={styles.question}>Choose your avatar</Text>
            <Text style={styles.questionSubtitle}>
              Pick one that represents you
            </Text>

            <View style={styles.avatarGrid}>
              {currentAvatarSeeds.map((seed) => {
                const avatarUrl = `https://api.dicebear.com/7.x/notionists/png?seed=${seed}&size=150`;
                const isSelected = selectedAvatarSeed === seed;

                return (
                  <Pressable
                    key={seed}
                    onPress={() => handleSelectAvatar(seed)}
                    style={({ pressed }) => [
                      styles.avatarOption,
                      isSelected && styles.avatarOptionSelected,
                      pressed && styles.avatarOptionPressed
                    ]}
                  >
                    <Image
                      source={{ uri: avatarUrl }}
                      style={styles.avatarPreview}
                    />
                  </Pressable>
                );
              })}
            </View>

            {/* Page Navigation */}
            <View style={styles.avatarPagination}>
              <Pressable
                onPress={() => setAvatarPage(Math.max(0, avatarPage - 1))}
                disabled={avatarPage === 0}
                style={({ pressed }) => [
                  styles.pageButton,
                  avatarPage === 0 && styles.pageButtonDisabled,
                  pressed && styles.pageButtonPressed
                ]}
              >
                <Text style={[
                  styles.pageButtonText,
                  avatarPage === 0 && styles.pageButtonTextDisabled
                ]}>
                  ← Prev
                </Text>
              </Pressable>

              {/* Page Dots */}
              <View style={styles.pageDots}>
                {allAvatarSeeds.map((_, index) => (
                  <Pressable
                    key={index}
                    onPress={() => setAvatarPage(index)}
                    style={[
                      styles.pageDot,
                      avatarPage === index && styles.pageDotActive
                    ]}
                  />
                ))}
              </View>

              <Pressable
                onPress={() => setAvatarPage(Math.min(allAvatarSeeds.length - 1, avatarPage + 1))}
                disabled={avatarPage === allAvatarSeeds.length - 1}
                style={({ pressed }) => [
                  styles.pageButton,
                  avatarPage === allAvatarSeeds.length - 1 && styles.pageButtonDisabled,
                  pressed && styles.pageButtonPressed
                ]}
              >
                <Text style={[
                  styles.pageButtonText,
                  avatarPage === allAvatarSeeds.length - 1 && styles.pageButtonTextDisabled
                ]}>
                  Next →
                </Text>
              </Pressable>
            </View>
          </>
        ) : isCategoryStep ? (
          /* Favorite Categories - Multi-select */
          <>
            <Text style={styles.question}>What categories matter most to you?</Text>
            <Text style={styles.questionSubtitle}>
              Select the areas you spend on most — or skip if you don't have a favorite
            </Text>

            <View style={styles.categoryGrid}>
              {CATEGORY_OPTIONS.map(cat => {
                const isSelected = selectedCategories.includes(cat.label);
                return (
                  <Pressable
                    key={cat.label}
                    onPress={() => handleToggleCategory(cat.label)}
                    style={[
                      styles.categoryChip,
                      isSelected && styles.categoryChipSelected,
                    ]}
                  >
                    <Text style={styles.categoryChipEmoji}>{cat.emoji}</Text>
                    <Text style={[
                      styles.categoryChipLabel,
                      isSelected && styles.categoryChipLabelSelected,
                    ]}>
                      {cat.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <View style={styles.categoryActions}>
              <Pressable
                onPress={handleCategorySubmit}
                style={({ pressed }) => [
                  styles.nameSubmitButton,
                  pressed && styles.nameSubmitButtonPressed,
                ]}
              >
                <Text style={styles.nameSubmitButtonText}>
                  {selectedCategories.length > 0 ? 'Continue' : 'No Favorite — Skip'}
                </Text>
              </Pressable>
            </View>
          </>
        ) : (
          /* Questions */
          <>
            <Text style={styles.question}>{currentQuestion?.question}</Text>

            <View style={styles.optionsContainer}>
              {currentQuestion?.options.map((option, index) => (
                <Pressable
                  key={index}
                  onPress={() => handleSelectOption(index)}
                  style={({ pressed }) => [
                    styles.optionCard,
                    pressed && styles.optionCardPressed
                  ]}
                >
                  {option.emoji && (
                    <Text style={styles.optionEmoji}>{option.emoji}</Text>
                  )}
                  <Text style={styles.optionLabel}>{option.label}</Text>
                </Pressable>
              ))}
            </View>
          </>
        )}
      </ScrollView>

      {/* Bottom Navigation */}
      <View style={[styles.bottomNav, { paddingBottom: insets.bottom + spacing.lg }]}>
        {currentStep > -4 && (
          <Pressable
            onPress={handleBack}
            style={({ pressed }) => [
              styles.backButton,
              pressed && styles.backButtonPressed
            ]}
          >
            <Text style={styles.backButtonText}>← Back</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.backgroundLight,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.backgroundLight,
    gap: spacing.md,
  },
  loadingText: {
    fontSize: fontSize.base,
    fontWeight: fontWeight.medium as any,
    color: colors.textSecondary,
  },
  header: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.lg,
  },
  progressBarContainer: {
    height: 4,
    backgroundColor: colors.gray200,
    borderRadius: borderRadius.full,
    marginBottom: spacing.md,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    backgroundColor: colors.primary,
    borderRadius: borderRadius.full,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  stepText: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.bold as any,
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  skipButton: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
  },
  skipText: {
    fontSize: fontSize.base,
    fontWeight: fontWeight.semibold as any,
    color: colors.primary,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
  },
  question: {
    fontSize: fontSize.xxl,
    fontWeight: fontWeight.bold as any,
    color: colors.textPrimary,
    lineHeight: 36,
    marginBottom: spacing.md,
  },
  questionSubtitle: {
    fontSize: fontSize.base,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.xl,
  },
  nameInputContainer: {
    width: '100%',
    gap: spacing.md,
  },
  nameInput: {
    height: 56,
    backgroundColor: colors.white,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.lg,
    fontSize: fontSize.base,
    fontWeight: fontWeight.medium as any,
    color: colors.textPrimary,
    borderWidth: 2,
    borderColor: colors.gray200,
    ...shadows.sm,
  },
  nameSubmitButton: {
    height: 56,
    backgroundColor: colors.primary,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.lg,
  },
  nameSubmitButtonPressed: {
    transform: [{ scale: 0.98 }],
    opacity: 0.9,
  },
  nameSubmitButtonDisabled: {
    opacity: 0.5,
  },
  nameSubmitButtonText: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold as any,
    color: colors.white,
  },
  budgetInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 56,
    backgroundColor: colors.white,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.lg,
    borderWidth: 2,
    borderColor: colors.gray200,
    ...shadows.sm,
  },
  currencySymbol: {
    fontSize: fontSize.xl,
    fontWeight: fontWeight.bold as any,
    color: colors.primary,
    marginRight: spacing.xs,
  },
  budgetInput: {
    flex: 1,
    fontSize: fontSize.lg,
    fontWeight: fontWeight.semibold as any,
    color: colors.textPrimary,
  },
  avatarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
    justifyContent: 'center',
  },
  avatarOption: {
    width: 80,
    height: 80,
    backgroundColor: colors.white,
    borderRadius: borderRadius.lg,
    padding: spacing.xs,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: 'transparent',
    ...shadows.sm,
  },
  avatarOptionSelected: {
    borderColor: colors.primary,
    backgroundColor: `${colors.primary}08`,
  },
  avatarOptionPressed: {
    transform: [{ scale: 0.96 }],
  },
  avatarPreview: {
    width: 70,
    height: 70,
    borderRadius: borderRadius.md,
    backgroundColor: colors.gray100,
  },
  avatarPagination: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.lg,
    paddingHorizontal: spacing.sm,
  },
  pageButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.gray200,
    minWidth: 80,
    alignItems: 'center',
  },
  pageButtonDisabled: {
    opacity: 0.3,
  },
  pageButtonPressed: {
    transform: [{ scale: 0.96 }],
    backgroundColor: colors.gray50,
  },
  pageButtonText: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold as any,
    color: colors.primary,
  },
  pageButtonTextDisabled: {
    color: colors.gray300,
  },
  pageDots: {
    flexDirection: 'row',
    gap: spacing.xs,
    alignItems: 'center',
  },
  pageDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.gray200,
  },
  pageDotActive: {
    backgroundColor: colors.primary,
    width: 24,
  },
  optionsContainer: {
    gap: spacing.md,
  },
  optionCard: {
    backgroundColor: colors.white,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    ...shadows.sm,
  },
  optionCardPressed: {
    transform: [{ scale: 0.98 }],
    backgroundColor: `${colors.primary}08`,
    borderColor: colors.primary,
    borderWidth: 2,
  },
  optionEmoji: {
    fontSize: 32,
  },
  optionLabel: {
    flex: 1,
    fontSize: fontSize.base,
    fontWeight: fontWeight.medium as any,
    color: colors.textPrimary,
    lineHeight: 24,
  },
  bottomNav: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
  },
  backButton: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    alignSelf: 'flex-start',
  },
  backButtonPressed: {
    opacity: 0.6,
  },
  backButtonText: {
    fontSize: fontSize.base,
    fontWeight: fontWeight.semibold as any,
    color: colors.textSecondary,
  },

  // Category multi-select
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.lg,
  },
  categoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.white,
    borderRadius: borderRadius.xl,
    borderWidth: 2,
    borderColor: colors.gray200,
    ...shadows.sm,
  },
  categoryChipSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primary + '10',
  },
  categoryChipEmoji: {
    fontSize: fontSize.xl,
  },
  categoryChipLabel: {
    fontSize: fontSize.base,
    fontWeight: fontWeight.semibold as any,
    color: colors.textPrimary,
  },
  categoryChipLabelSelected: {
    color: colors.primary,
  },
  categoryActions: {
    marginTop: spacing.xl,
    width: '100%',
  },
});
