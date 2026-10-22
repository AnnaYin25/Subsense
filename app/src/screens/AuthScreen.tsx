/**
 * Auth Screen - Login & Sign Up
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '@/navigation/RootNavigator';
import { useAuth } from '@/contexts/AuthContext';
import { colors, spacing, fontSize, fontWeight, borderRadius, shadows } from '@/styles';
import { useScreenInsets } from '@/hooks/useScreenInsets';
import { supabase } from '@/utils/supabase';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;
const AUTH_ROUTE_TIMEOUT_MS = 8000;

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

export const AuthScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();
  const { signUp, signIn } = useAuth();
  const insets = useScreenInsets();

  const [mode, setMode] = useState<'signin' | 'signup'>('signup');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleAuth = async () => {
    if (!email || !password) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    setLoading(true);

    try {
      if (mode === 'signup') {
        // Sign up without name (will be collected in Setup)
        await signUp(email, password, 'User'); // Temporary name
        Alert.alert('Success', 'Account created! Welcome!');
        navigation.reset({
          index: 0,
          routes: [{ name: 'Setup' }],
        });
      } else {
        await signIn(email, password);

        // Route explicitly after sign-in so user never gets stuck on auth page.
        try {
          const {
            data: { user: authUser },
          } = await withTimeout(
            supabase.auth.getUser(),
            AUTH_ROUTE_TIMEOUT_MS,
            'get current user'
          );

          if (!authUser) {
            throw new Error('No authenticated user found after sign in');
          }

          const { data: persona, error } = await withTimeout(
            supabase
              .from('user_personas')
              .select('setup_completed')
              .eq('user_id', authUser.id)
              .single(),
            AUTH_ROUTE_TIMEOUT_MS,
            'check setup status'
          ) as any;

          if (error && error.code !== 'PGRST116') {
            throw error;
          }

          navigation.reset({
            index: 0,
            routes: [{ name: persona?.setup_completed ? 'MainTabs' : 'Setup' }],
          });
        } catch (routeError) {
          console.warn('Post-login routing fallback to Setup:', routeError);
          navigation.reset({
            index: 0,
            routes: [{ name: 'Setup' }],
          });
        }
      }
    } catch (error: any) {
      console.error('Auth error:', error);
      Alert.alert('Error', error.message || 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingTop: insets.top + spacing.xl, paddingBottom: insets.bottom + spacing.xl },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.logo}>💎</Text>
          <Text style={styles.title}>
            {mode === 'signup' ? 'Create Account' : 'Welcome Back'}
          </Text>
          <Text style={styles.subtitle}>
            {mode === 'signup'
              ? 'Sign up to start managing your subscriptions'
              : 'Sign in to your account'}
          </Text>
        </View>

        {/* Form */}
        <View style={styles.form}>
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Email</Text>
            <TextInput
              style={styles.input}
              placeholder="your@email.com"
              placeholderTextColor={colors.textTertiary}
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Password</Text>
            <TextInput
              style={styles.input}
              placeholder="••••••••"
              placeholderTextColor={colors.textTertiary}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>

          {/* Submit Button */}
          <Pressable
            style={({ pressed }) => [
              styles.button,
              pressed && styles.buttonPressed,
              loading && styles.buttonDisabled,
            ]}
            onPress={handleAuth}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color={colors.white} />
            ) : (
              <Text style={styles.buttonText}>
                {mode === 'signup' ? 'Sign Up' : 'Sign In'}
              </Text>
            )}
          </Pressable>

          {/* Toggle Mode */}
          <Pressable
            style={styles.toggleContainer}
            onPress={() => setMode(mode === 'signup' ? 'signin' : 'signup')}
          >
            <Text style={styles.toggleText}>
              {mode === 'signup' ? 'Already have an account? ' : "Don't have an account? "}
              <Text style={styles.toggleLink}>
                {mode === 'signup' ? 'Sign In' : 'Sign Up'}
              </Text>
            </Text>
          </Pressable>
        </View>

        {/* Quick Test Credentials */}
        <View style={styles.testInfo}>
          <Text style={styles.testTitle}>Quick Test:</Text>
          <Text style={styles.testText}>Email: test@example.com</Text>
          <Text style={styles.testText}>Password: test123456</Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
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
  scrollContent: {
    paddingHorizontal: spacing.xl,
  },
  header: {
    alignItems: 'center',
    marginBottom: spacing.xxxl,
  },
  logo: {
    fontSize: 48,
    marginBottom: spacing.md,
  },
  title: {
    fontSize: fontSize.xxl,
    fontWeight: fontWeight.black as any,
    color: colors.textPrimary,
    marginBottom: spacing.xs,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    textAlign: 'center',
    maxWidth: 280,
  },
  form: {
    width: '100%',
  },
  inputGroup: {
    marginBottom: spacing.lg,
  },
  label: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold as any,
    color: colors.textPrimary,
    marginBottom: spacing.xs,
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
    ...shadows.sm,
  },
  button: {
    height: 56,
    backgroundColor: colors.primary,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.md,
    ...shadows.lg,
  },
  buttonPressed: {
    transform: [{ scale: 0.98 }],
    opacity: 0.9,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold as any,
    color: colors.white,
  },
  toggleContainer: {
    alignItems: 'center',
    marginTop: spacing.lg,
  },
  toggleText: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
  },
  toggleLink: {
    color: colors.primary,
    fontWeight: fontWeight.semibold as any,
  },
  testInfo: {
    marginTop: spacing.xxxl,
    padding: spacing.md,
    backgroundColor: colors.gray50,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.gray200,
  },
  testTitle: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.bold as any,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  testText: {
    fontSize: fontSize.xs,
    color: colors.textTertiary,
  },
});
