import React, { useEffect, useState } from 'react';
import { View, Text, Pressable, StyleSheet, ScrollView, Image } from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '@/navigation/RootNavigator';
import { colors, spacing, fontSize, fontWeight, borderRadius, shadows } from '@/styles';
import { useScreenInsets } from '@/hooks/useScreenInsets';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/utils/supabase';
import { generatePersonaProfile } from '@/utils/personaGenerator';
import { generateAvatarUrl } from '@/utils/avatarUtils';
import type { SetupPreferences } from '@/types';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;
type RouteParams = RouteProp<RootStackParamList, 'PersonaResult'>;

export const PersonaResultScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<RouteParams>();
  const insets = useScreenInsets();
  const { user } = useAuth();

  const [persona, setPersona] = useState<any>(null);
  const [userInfo, setUserInfo] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    if (!user) return;

    try {
      // Load persona preferences
      const { data: personaData, error: personaError } = await supabase
        .from('user_personas')
        .select('setup_preferences')
        .eq('user_id', user.id)
        .single();

      if (personaError) throw personaError;

      if (personaData?.setup_preferences) {
        const profile = generatePersonaProfile(personaData.setup_preferences as SetupPreferences);
        setPersona(profile);
      }

      // Load updated user info (name and avatar)
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('name, avatar, avatar_style')
        .eq('id', user.id)
        .single();

      if (userError) throw userError;

      setUserInfo(userData);
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleContinue = () => {
    navigation.reset({
      index: 0,
      routes: [{ name: 'MainApp' }]
    });
  };

  if (loading || !persona || !userInfo) {
    return <View style={styles.container} />;
  }

  const avatarUrl = userInfo.avatar || generateAvatarUrl(
    userInfo.name || 'User',
    user?.id || '',
    userInfo.avatar_style || 'notionists'
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.content,
          { paddingBottom: insets.bottom + spacing.xxxl }
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.subtitle}>Your Persona</Text>
          <Text style={styles.title}>Meet Your Profile</Text>
        </View>

        {/* Avatar & Persona Card */}
        <View style={styles.personaCard}>
          {/* Avatar */}
          <View style={styles.avatarContainer}>
            <Image
              source={{ uri: avatarUrl }}
              style={styles.avatar}
            />
          </View>

          {/* User Name */}
          <Text style={styles.userName}>{userInfo.name}</Text>

          {/* Persona Type */}
          <Text style={styles.personaEmoji}>{persona.emoji}</Text>
          <Text style={styles.personaTitle}>{persona.title}</Text>
          <Text style={styles.personaDescription}>{persona.description}</Text>

          {/* Traits */}
          <View style={styles.traitsContainer}>
            {persona.traits.map((trait: string, index: number) => (
              <View key={index} style={styles.traitBadge}>
                <Text style={styles.traitText}>{trait}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Info */}
        <View style={styles.infoBox}>
          <Text style={styles.infoText}>
            💡 We'll use your persona to personalize subscription recommendations and insights.
          </Text>
          <Text style={styles.infoSubtext}>
            You can update your preferences anytime in Settings.
          </Text>
        </View>
      </ScrollView>

      {/* Continue Button */}
      <View style={[styles.bottomNav, { paddingBottom: insets.bottom + spacing.lg }]}>
        <Pressable
          onPress={handleContinue}
          style={({ pressed }) => [
            styles.continueButton,
            pressed && styles.continueButtonPressed
          ]}
        >
          <Text style={styles.continueButtonText}>Continue to App</Text>
        </Pressable>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.backgroundLight,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    paddingHorizontal: spacing.lg,
  },
  header: {
    alignItems: 'center',
    marginTop: spacing.xl,
    marginBottom: spacing.lg,
  },
  subtitle: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.bold as any,
    color: colors.primary,
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    marginBottom: spacing.xs,
  },
  title: {
    fontSize: fontSize.xxl,
    fontWeight: fontWeight.black as any,
    color: colors.textPrimary,
    textAlign: 'center',
  },
  personaCard: {
    backgroundColor: colors.white,
    borderRadius: borderRadius.xl,
    padding: spacing.xl,
    alignItems: 'center',
    ...shadows.lg,
    marginBottom: spacing.lg,
  },
  avatarContainer: {
    marginBottom: spacing.md,
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: borderRadius.full,
    backgroundColor: colors.gray100,
  },
  userName: {
    fontSize: fontSize.xl,
    fontWeight: fontWeight.bold as any,
    color: colors.textPrimary,
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },
  personaEmoji: {
    fontSize: 48,
    marginBottom: spacing.sm,
  },
  personaTitle: {
    fontSize: fontSize.xl,
    fontWeight: fontWeight.black as any,
    color: colors.textPrimary,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  personaDescription: {
    fontSize: fontSize.base,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: spacing.lg,
  },
  traitsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  traitBadge: {
    backgroundColor: `${colors.primary}15`,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  traitText: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.medium as any,
    color: colors.primary,
  },
  infoBox: {
    backgroundColor: `${colors.primary}08`,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    borderLeftWidth: 4,
    borderLeftColor: colors.primary,
  },
  infoText: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.medium as any,
    color: colors.textPrimary,
    lineHeight: 20,
    marginBottom: spacing.xs,
  },
  infoSubtext: {
    fontSize: fontSize.xs,
    color: colors.textSecondary,
    lineHeight: 18,
  },
  bottomNav: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    backgroundColor: colors.backgroundLight,
  },
  continueButton: {
    height: 56,
    backgroundColor: colors.primary,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.lg,
  },
  continueButtonPressed: {
    transform: [{ scale: 0.98 }],
    opacity: 0.9,
  },
  continueButtonText: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold as any,
    color: colors.white,
  },
});
