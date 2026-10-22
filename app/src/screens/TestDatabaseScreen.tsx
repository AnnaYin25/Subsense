/**
 * Database Test Screen
 * Use this to verify Supabase connection and seed test data
 */

import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, ActivityIndicator } from 'react-native';
import { useAuth } from '@/contexts/AuthContext';
import { useSubscriptions } from '@/contexts/SubscriptionContext';
import {
  testConnection,
  seedSubscriptions,
  clearSubscriptions,
  getSubscriptionCount,
} from '@/utils/testDatabase';
import { colors, spacing, fontSize, fontWeight } from '@/styles';

export const TestDatabaseScreen: React.FC = () => {
  const { user } = useAuth();
  const { subscriptions, refresh } = useSubscriptions();
  const [testing, setTesting] = useState(false);
  const [result, setResult] = useState<string>('');

  const runTest = async (testName: string, testFn: () => Promise<any>) => {
    setTesting(true);
    setResult(`Running: ${testName}...`);

    try {
      const success = await testFn();
      setResult(`✅ ${testName}: ${success ? 'Success' : 'Failed'}`);
    } catch (error: any) {
      setResult(`❌ ${testName}: ${error.message}`);
    } finally {
      setTesting(false);
    }
  };

  const handleTestConnection = async () => {
    await runTest('Test Connection', testConnection);
  };

  const handleSeedData = async () => {
    if (!user) {
      setResult('❌ No user logged in');
      return;
    }

    await runTest('Seed Subscriptions', async () => {
      const success = await seedSubscriptions(user.id);
      if (success) {
        await refresh();
      }
      return success;
    });
  };

  const handleClearData = async () => {
    if (!user) {
      setResult('❌ No user logged in');
      return;
    }

    await runTest('Clear Subscriptions', async () => {
      const success = await clearSubscriptions(user.id);
      if (success) {
        await refresh();
      }
      return success;
    });
  };

  const handleCountSubs = async () => {
    if (!user) {
      setResult('❌ No user logged in');
      return;
    }

    setTesting(true);
    try {
      const count = await getSubscriptionCount(user.id);
      setResult(`📊 Subscription count: ${count}`);
    } catch (error: any) {
      setResult(`❌ Count error: ${error.message}`);
    } finally {
      setTesting(false);
    }
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>Database Test</Text>

        {/* User Info */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>User Info</Text>
          {user ? (
            <>
              <Text style={styles.info}>Name: {user.name}</Text>
              <Text style={styles.info}>Email: {user.email}</Text>
              <Text style={styles.info}>ID: {user.id}</Text>
            </>
          ) : (
            <Text style={styles.info}>Not logged in</Text>
          )}
        </View>

        {/* Subscriptions */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Subscriptions ({subscriptions.length})</Text>
          {subscriptions.length > 0 ? (
            subscriptions.map(sub => (
              <Text key={sub.id} style={styles.info}>
                {sub.iconEmoji} {sub.name} - ${sub.cost}
              </Text>
            ))
          ) : (
            <Text style={styles.info}>No subscriptions</Text>
          )}
        </View>

        {/* Test Buttons */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Database Tests</Text>

          <Pressable
            style={[styles.button, testing && styles.buttonDisabled]}
            onPress={handleTestConnection}
            disabled={testing}
          >
            <Text style={styles.buttonText}>Test Connection</Text>
          </Pressable>

          <Pressable
            style={[styles.button, testing && styles.buttonDisabled]}
            onPress={handleCountSubs}
            disabled={testing}
          >
            <Text style={styles.buttonText}>Count Subscriptions</Text>
          </Pressable>

          <Pressable
            style={[styles.button, styles.buttonSuccess, testing && styles.buttonDisabled]}
            onPress={handleSeedData}
            disabled={testing}
          >
            <Text style={styles.buttonText}>Seed Test Data (5 subs)</Text>
          </Pressable>

          <Pressable
            style={[styles.button, styles.buttonDanger, testing && styles.buttonDisabled]}
            onPress={handleClearData}
            disabled={testing}
          >
            <Text style={styles.buttonText}>Clear All Subscriptions</Text>
          </Pressable>
        </View>

        {/* Result */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Result</Text>
          {testing ? (
            <ActivityIndicator size="small" color={colors.primary} />
          ) : (
            <Text style={styles.result}>{result || 'No tests run yet'}</Text>
          )}
        </View>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.backgroundLight,
  },
  content: {
    padding: spacing.lg,
  },
  title: {
    fontSize: fontSize.xl,
    fontWeight: fontWeight.black,
    color: colors.textDark,
    marginBottom: spacing.lg,
    textAlign: 'center',
  },
  card: {
    backgroundColor: colors.white,
    borderRadius: 16,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  cardTitle: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.bold,
    color: colors.textDark,
    marginBottom: spacing.sm,
  },
  info: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.medium,
    color: colors.textMedium,
    marginBottom: spacing.xs,
  },
  button: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.sm,
    alignItems: 'center',
  },
  buttonSuccess: {
    backgroundColor: colors.success,
  },
  buttonDanger: {
    backgroundColor: colors.danger,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.bold,
    color: colors.white,
  },
  result: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.medium,
    color: colors.textDark,
  },
});
