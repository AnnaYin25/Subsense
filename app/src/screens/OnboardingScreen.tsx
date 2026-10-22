import React from 'react';
import { View, Text, Pressable, StyleSheet, ScrollView, Image } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '@/navigation/RootNavigator';
import { colors, spacing, fontSize, fontWeight, borderRadius, shadows } from '@/styles';
import { useScreenInsets } from '@/hooks/useScreenInsets';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

export const OnboardingScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();
  const insets = useScreenInsets();

  return (
    <View style={styles.backgroundContainer}>
      {/* Top Bar */}
      <View style={[styles.topBar, { paddingTop: insets.top + spacing.md }]}>
        <View style={styles.logoContainer}>
          <Image
            source={require('../../assets/subsense.png')}
            style={styles.logoImage}
            resizeMode="contain"
          />
        </View>
      </View>

      {/* Scrollable Content */}
      <ScrollView
        style={styles.scrollContent}
        contentContainerStyle={styles.scrollContentContainer}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero Text - Centered */}
        <View style={styles.heroSection}>
          <Text style={styles.heroTitle}>
            Stop paying for{' '}
            <Text style={styles.heroHighlight}>subscriptions</Text>
            {'\n'}you don't use.
          </Text>
          <Text style={styles.heroSubtitle}>
            We'll help you track expenses, cancel unwanted services, and decide smarter.
          </Text>
        </View>
      </ScrollView>

      {/* Bottom Action Area with Gradient Overlay */}
      <LinearGradient
        colors={['rgba(249, 250, 251, 0)', 'rgba(249, 250, 251, 0.95)', colors.backgroundLight]}
        style={[styles.bottomGradient, { paddingBottom: insets.bottom + spacing.lg }]}
      >
        <Pressable
          onPress={() => navigation.navigate('Auth')}
          style={({ pressed }) => [
            styles.ctaButton,
            pressed && styles.ctaButtonPressed
          ]}
        >
          <View style={styles.ctaContent}>
            <Text style={styles.ctaText}>Get Started</Text>
            <Text style={styles.ctaArrow}>→</Text>
          </View>
        </Pressable>

        {/* Pagination Dots */}
        <View style={styles.paginationContainer}>
          <View style={[styles.dot, styles.dotActive]} />
          <View style={styles.dot} />
          <View style={styles.dot} />
        </View>
      </LinearGradient>
    </View>
  );
};

const styles = StyleSheet.create({
  backgroundContainer: {
    flex: 1,
    backgroundColor: colors.backgroundLight,
  },
  topBar: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    zIndex: 10,
  },
  logoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  logoImage: {
    height: 36,
    width: 140,
  },
  scrollContent: {
    flex: 1,
  },
  scrollContentContainer: {
    paddingHorizontal: spacing.lg,
    paddingBottom: 180, // Space for bottom gradient overlay
    flex: 1,
    justifyContent: 'center',
  },
  heroSection: {
    alignItems: 'center',
  },
  heroTitle: {
    fontSize: 32,
    fontWeight: fontWeight.bold as any,
    lineHeight: 40,
    textAlign: 'center',
    color: colors.textPrimary,
    letterSpacing: -0.5,
    marginBottom: spacing.md,
  },
  heroHighlight: {
    color: colors.primary,
  },
  heroSubtitle: {
    fontSize: fontSize.base,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 24,
    maxWidth: 300,
  },
  bottomGradient: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xxxl,
  },
  ctaButton: {
    width: '100%',
    height: 56,
    borderRadius: borderRadius.md,
    backgroundColor: colors.primary,
    ...shadows.lg,
  },
  ctaContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  ctaText: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold as any,
    color: '#fff',
  },
  ctaArrow: {
    fontSize: fontSize.lg,
    color: '#fff',
  },
  ctaButtonPressed: {
    transform: [{ scale: 0.98 }],
    opacity: 0.9,
  },
  paginationContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: spacing.lg,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.gray300,
  },
  dotActive: {
    width: 24,
    backgroundColor: colors.primary,
  },
});
