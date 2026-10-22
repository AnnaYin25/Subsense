import React, { useEffect, useRef, useState } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { OnboardingScreen } from '@/screens/OnboardingScreen';
import { AuthScreen } from '@/screens/AuthScreen';
import { SetupScreen } from '@/screens/SetupScreen';
import { PersonaResultScreen } from '@/screens/PersonaResultScreen';
import { AddSubscriptionScreen } from '@/screens/AddSubscriptionScreen';
import { SubscriptionDetailScreen } from '@/screens/SubscriptionDetailScreen';
import { SettingsScreen } from '@/screens/SettingsScreen';
import { MainTabNavigator } from './MainTabNavigator';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/utils/supabase';
import { colors } from '@/styles';

export type RootStackParamList = {
  Onboarding: undefined;
  Auth: undefined;
  Setup: undefined;
  PersonaResult: undefined;
  MainTabs: undefined;
  MainApp: undefined; // Alias for MainTabs
  AddSubscription: { subscriptionId?: string; prefillData?: { name: string; cost: number; category: string; nextRenewalDate: string } };
  SubscriptionDetail: { subscriptionId: string };
  Settings: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();
const ROUTE_CHECK_TIMEOUT_MS = 8000;

export const RootNavigator: React.FC = () => {
  const { session, user, loading: authLoading } = useAuth();
  const [initialRoute, setInitialRoute] = useState<keyof RootStackParamList | null>(null);
  const [checking, setChecking] = useState(true);
  const [navKey, setNavKey] = useState(0);
  const initializedRef = useRef(false);
  const navigatorKey = navKey.toString();

  useEffect(() => {
    if (authLoading) {
      return;
    }

    // Already initialized and session is active → let AuthScreen handle post-login routing
    if (initializedRef.current && !!session) {
      return;
    }

    // Logout detected: was initialized, session now gone → reset navigator to Onboarding
    if (initializedRef.current && !session) {
      initializedRef.current = false;
      setNavKey(k => k + 1);
      setInitialRoute('Onboarding');
      setChecking(false);
      return;
    }

    let cancelled = false;
    let fallbackTimer: ReturnType<typeof setTimeout> | null = null;
    let routeResolved = false;

    const resolveRoute = (route: keyof RootStackParamList) => {
      if (cancelled || routeResolved) return;
      routeResolved = true;
      initializedRef.current = true;
      if (fallbackTimer) clearTimeout(fallbackTimer);
      setInitialRoute(route);
      setChecking(false);
    };

    const determineInitialRoute = async () => {
      console.log('[RootNavigator] Determining initial route...');
      console.log('[RootNavigator] Session exists:', !!session);
      console.log('[RootNavigator] User exists:', !!user);

      // Wait for auth to load
      // No session = show onboarding
      if (!session || !user) {
        console.log('[RootNavigator] No session, showing Onboarding');
        resolveRoute('Onboarding');
        return;
      }

      // Has session - check if setup is completed
      try {
        console.log('[RootNavigator] Checking setup status for user:', user.id);

        const result = await Promise.race([
          supabase
            .from('user_personas')
            .select('setup_completed')
            .eq('user_id', user.id)
            .single(),
          new Promise<never>((_, reject) =>
            setTimeout(
              () => reject(new Error(`setup check timed out after ${ROUTE_CHECK_TIMEOUT_MS}ms`)),
              ROUTE_CHECK_TIMEOUT_MS
            )
          ),
        ]);
        const { data: persona, error } = result as any;

        if (error && error.code !== 'PGRST116') { // PGRST116 = no rows found
          console.error('[RootNavigator] Error checking setup:', error);
        }

        if (persona?.setup_completed) {
          console.log('[RootNavigator] Setup completed, showing MainTabs');
          resolveRoute('MainTabs');
        } else {
          console.log('[RootNavigator] Setup not completed, showing Setup');
          resolveRoute('Setup');
        }
      } catch (error) {
        console.error('[RootNavigator] Failed to check setup status:', error);
        // Default to Setup if check fails
        resolveRoute('Setup');
      }
    };

    fallbackTimer = setTimeout(() => {
      if (!cancelled && !routeResolved) {
        routeResolved = true;
        initializedRef.current = true;
        console.warn('[RootNavigator] Route check fallback triggered');
        setInitialRoute(session && user ? 'Setup' : 'Onboarding');
        setChecking(false);
      }
    }, ROUTE_CHECK_TIMEOUT_MS + 1500);

    determineInitialRoute();

    return () => {
      cancelled = true;
      if (fallbackTimer) clearTimeout(fallbackTimer);
    };
  }, [session, user, authLoading]);

  // Show loading spinner while determining route
  if (authLoading || checking || !initialRoute) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.backgroundLight }}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  console.log('[RootNavigator] Rendering with initial route:', initialRoute);

  return (
    <NavigationContainer>
      <Stack.Navigator
        key={navigatorKey}
        initialRouteName={initialRoute}
        screenOptions={{
          headerShown: false,
          animation: 'fade',
        }}
      >
        <Stack.Screen name="Onboarding" component={OnboardingScreen} />
        <Stack.Screen name="Auth" component={AuthScreen} />
        <Stack.Screen name="Setup" component={SetupScreen} />
        <Stack.Screen name="PersonaResult" component={PersonaResultScreen} />
        <Stack.Screen name="MainTabs" component={MainTabNavigator} />
        <Stack.Screen name="MainApp" component={MainTabNavigator} />
        <Stack.Screen
          name="AddSubscription"
          component={AddSubscriptionScreen}
          options={{ animation: 'slide_from_bottom' }}
        />
        <Stack.Screen
          name="SubscriptionDetail"
          component={SubscriptionDetailScreen}
          options={{ animation: 'slide_from_right' }}
        />
        <Stack.Screen
          name="Settings"
          component={SettingsScreen}
          options={{ animation: 'slide_from_bottom' }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
};
