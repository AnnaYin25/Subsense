import React, { useEffect, useRef } from 'react';
import { Animated } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { ManagerScreen } from '@/screens/ManagerScreen';
import { CheckInScreen } from '@/screens/CheckInScreen';
import { AuditScreen } from '@/screens/AuditScreen';
import { ReportScreen } from '@/screens/ReportScreen';
import { colors, spacing, fontSize, fontWeight } from '@/styles';

// Animated Tab Icon Component
const AnimatedTabIcon: React.FC<{ name: any; focused: boolean; color: string }> = ({ name, focused, color }) => {
  const scaleAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.spring(scaleAnim, {
      toValue: focused ? 1.1 : 1,
      useNativeDriver: true,
      friction: 3,
    }).start();
  }, [focused, scaleAnim]);

  return (
    <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
      <Ionicons name={name} size={22} color={color} />
    </Animated.View>
  );
};

export type MainTabParamList = {
  Manager: undefined;
  CheckIn: undefined;
  Audit: undefined;
  Report: undefined;
};

const Tab = createBottomTabNavigator<MainTabParamList>();

export const MainTabNavigator: React.FC = () => {
  const insets = useSafeAreaInsets();
  const BASE_HEIGHT = 60;

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.gray400,
        tabBarStyle: {
          backgroundColor: colors.textInverse,
          borderTopWidth: 0,
          height: BASE_HEIGHT + insets.bottom,
          paddingBottom: insets.bottom,
          paddingTop: spacing.sm,
          // Critical: left/right safe area for rounded corners
          paddingLeft: Math.max(insets.left, 12),
          paddingRight: Math.max(insets.right, 12),
          shadowColor: '#000',
          shadowOffset: { width: 0, height: -2 },
          shadowOpacity: 0.1,
          shadowRadius: 4,
          elevation: 8,
        },
        tabBarItemStyle: {
          paddingHorizontal: 6,
        },
        tabBarLabelStyle: {
          fontSize: fontSize.xs,
          fontWeight: fontWeight.black as any,
          textTransform: 'uppercase',
          letterSpacing: 0.8,
          marginTop: 4,
        },
        tabBarIconStyle: {
          marginTop: 4,
        },
      }}
    >
      <Tab.Screen
        name="Manager"
        component={ManagerScreen}
        options={{
          tabBarLabel: 'Manager',
          tabBarAccessibilityLabel: 'Subscription Manager',
          tabBarIcon: ({ focused, color }) => (
            <AnimatedTabIcon name="list" focused={focused} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="CheckIn"
        component={CheckInScreen}
        options={{
          tabBarLabel: 'Check-In',
          tabBarAccessibilityLabel: 'Weekly Check-In',
          tabBarIcon: ({ focused, color }) => (
            <AnimatedTabIcon name="checkmark-circle-outline" focused={focused} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="Audit"
        component={AuditScreen}
        options={{
          tabBarLabel: 'Audit',
          tabBarAccessibilityLabel: 'AI Audit',
          tabBarIcon: ({ focused, color }) => (
            <AnimatedTabIcon name="search" focused={focused} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="Report"
        component={ReportScreen}
        options={{
          tabBarLabel: 'Report',
          tabBarAccessibilityLabel: 'Monthly Report',
          tabBarIcon: ({ focused, color }) => (
            <AnimatedTabIcon name="stats-chart" focused={focused} color={color} />
          ),
        }}
      />
    </Tab.Navigator>
  );
};
