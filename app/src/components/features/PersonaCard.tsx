import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable, Image } from 'react-native';
import { colors, spacing, fontSize, fontWeight, borderRadius, shadows } from '@/styles';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/utils/supabase';
import { getPersonaSummary } from '@/utils/personaGenerator';
import { generateAvatarUrl } from '@/utils/avatarUtils';
import type { SetupPreferences } from '@/types';

export const PersonaCard: React.FC = () => {
  const { user } = useAuth();
  const [personaSummary, setPersonaSummary] = useState<string>('');
  const [userInfo, setUserInfo] = useState<any>(null);

  useEffect(() => {
    loadData();
  }, [user]);

  const loadData = async () => {
    if (!user) return;

    try {
      // Load persona preferences
      const { data: personaData } = await supabase
        .from('user_personas')
        .select('setup_preferences')
        .eq('user_id', user.id)
        .single();

      if (personaData?.setup_preferences) {
        const summary = getPersonaSummary(personaData.setup_preferences as SetupPreferences);
        setPersonaSummary(summary);
      }

      // Load fresh user info (name, avatar, avatar_style)
      const { data: userData } = await supabase
        .from('users')
        .select('name, avatar, avatar_style')
        .eq('id', user.id)
        .single();

      if (userData) {
        setUserInfo(userData);
      }
    } catch (error) {
      console.error('Failed to load persona:', error);
    }
  };

  if (!user || !personaSummary || !userInfo) return null;

  const avatarUrl = userInfo.avatar || generateAvatarUrl(
    userInfo.name || 'User',
    user.id,
    userInfo.avatar_style || 'notionists'
  );

  return (
    <View style={styles.card}>
      <Image source={{ uri: avatarUrl }} style={styles.avatar} />
      <View style={styles.textContainer}>
        <Text style={styles.name}>{userInfo.name}</Text>
        <Text style={styles.persona}>{personaSummary}</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
    ...shadows.sm,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: borderRadius.full,
    backgroundColor: colors.gray100,
    marginRight: spacing.md,
  },
  textContainer: {
    flex: 1,
  },
  name: {
    fontSize: fontSize.base,
    fontWeight: fontWeight.bold as any,
    color: colors.textPrimary,
    marginBottom: 2,
  },
  persona: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
  },
});
