# React Native + Supabase: Fresh Data vs Cached AuthContext Pattern

## Metadata

```yaml
category: integration-issues
module: authentication, user-profile
tags: [react-native, supabase, data-sync, caching, state-management]
symptoms:
  - "Wrong avatar displaying after user updates profile"
  - "User name not showing in components"
  - "Stale data persisting across sessions"
  - "Database updates not reflected in UI"
difficulty: intermediate
date_documented: 2026-02-14
related_files:
  - app/src/screens/PersonaResultScreen.tsx
  - app/src/screens/ManagerScreen.tsx
  - app/src/components/features/PersonaCard.tsx
  - app/src/contexts/AuthContext.tsx
```

## Problem

### Symptoms

Components displaying user profile information (avatar, name, persona) were showing **stale cached data** instead of the latest database values:

1. **PersonaResultScreen** showed wrong avatar (not user's selected avatar)
2. **ManagerScreen** displayed cached name and default avatar
3. **PersonaCard** component showed outdated information
4. Data persisted incorrectly across sessions after user completed setup

### Observable Behavior

```typescript
// User completes setup and saves:
// - name: "Alice"
// - avatar: "https://api.dicebear.com/7.x/notionists/png?seed=15"

// But UI still shows:
// - name: "User" (default from signup)
// - avatar: generated from old seed or missing
```

### Why This Happens

The `AuthContext` provider loads user data at **login time** and caches it:

```typescript
// AuthContext.tsx
const [user, setUser] = useState<User | null>(null);

const loadUserProfile = async (userId: string) => {
  const { data } = await supabase
    .from('users')
    .select('*')
    .eq('id', userId)
    .single();

  setUser(data); // Cached in memory
};
```

This cached `user` object is **NOT automatically updated** when:
- User completes setup and saves name/avatar
- User updates profile in settings
- Database changes happen outside current session

Components using `const { user } = useAuth()` will always see the **login-time snapshot**, not current database state.

## Root Cause

**Mixing authentication state with profile data** in a single cached object creates data synchronization issues:

- **Authentication state** (session, userId, email) → Should be cached (changes rarely)
- **Profile data** (name, avatar, preferences) → Should be fresh from DB (changes frequently)

The AuthContext pattern is designed for **authentication**, not **real-time profile updates**.

## Solution

### Pattern: Separate Fresh Data Loading for Profile Components

Load user profile data **directly from database** in components that display it:

```typescript
import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/utils/supabase';

export const PersonaResultScreen: React.FC = () => {
  const { user } = useAuth(); // Only for user.id (authentication)
  const [userInfo, setUserInfo] = useState<any>(null); // Fresh profile data

  useEffect(() => {
    loadData();
  }, [user]);

  const loadData = async () => {
    if (!user) return;

    try {
      // Load FRESH user info from database
      const { data: userData } = await supabase
        .from('users')
        .select('name, avatar, avatar_style')
        .eq('id', user.id)
        .single();

      if (userData) {
        setUserInfo(userData); // Store fresh data in local state
      }
    } catch (error) {
      console.error('Failed to load user info:', error);
    }
  };

  // Use userInfo (fresh) instead of user (cached)
  const avatarUrl = userInfo?.avatar || generateAvatarUrl(
    userInfo?.name || 'User',
    user?.id || '',
    userInfo?.avatar_style || 'notionists'
  );

  return (
    <View>
      <Image source={{ uri: avatarUrl }} />
      <Text>{userInfo?.name}</Text>
    </View>
  );
};
```

### Key Principles

1. **Use AuthContext for authentication only**: `user.id`, `user.email`, session status
2. **Load profile data fresh**: Query database in component's `useEffect`
3. **Store in local state**: `useState` for component-specific fresh data
4. **Re-fetch on mount**: Ensures latest data when component renders

### Files Modified

**PersonaResultScreen.tsx** (Lines 23-64):
```typescript
const [userInfo, setUserInfo] = useState<any>(null);

const loadData = async () => {
  const { data: userData } = await supabase
    .from('users')
    .select('name, avatar, avatar_style')
    .eq('id', user.id)
    .single();

  setUserInfo(userData);
};
```

**ManagerScreen.tsx** (Lines 40-65):
```typescript
const [userInfo, setUserInfo] = useState<any>(null);

const loadUserInfo = async () => {
  const { data } = await supabase
    .from('users')
    .select('name, avatar, avatar_style')
    .eq('id', user.id)
    .single();

  if (data) setUserInfo(data);
};

// In JSX:
<Image source={{ uri: userInfo?.avatar || generateAvatarUrl(...) }} />
<Text>{userInfo?.name || 'User'}</Text>
```

**PersonaCard.tsx** (Lines 14-43):
```typescript
const [userInfo, setUserInfo] = useState<any>(null);

const loadData = async () => {
  const { data: userData } = await supabase
    .from('users')
    .select('name, avatar, avatar_style')
    .eq('id', user.id)
    .single();

  if (userData) setUserInfo(userData);
};
```

## Prevention

### Best Practices

1. **Design AuthContext correctly**:
   ```typescript
   // GOOD: Only authentication state
   interface AuthState {
     session: Session | null;
     userId: string;
     email: string;
   }

   // BAD: Mixing auth + profile data
   interface AuthState {
     session: Session | null;
     userId: string;
     name: string;        // ❌ Profile data
     avatar: string;      // ❌ Profile data
     preferences: any;    // ❌ Profile data
   }
   ```

2. **Load fresh data for profile screens**:
   - Setup completion screen
   - Profile settings screen
   - User info displays in navigation

3. **Consider real-time subscriptions for critical data**:
   ```typescript
   useEffect(() => {
     const channel = supabase
       .channel('user-profile-changes')
       .on('postgres_changes', {
         event: 'UPDATE',
         schema: 'public',
         table: 'users',
         filter: `id=eq.${user.id}`
       }, (payload) => {
         setUserInfo(payload.new);
       })
       .subscribe();

     return () => supabase.removeChannel(channel);
   }, [user]);
   ```

4. **Cache strategically**: Use React Query or SWR for smart caching with revalidation

### Testing Checklist

- [ ] User completes setup → Navigate to Manager → Avatar shows correct selection
- [ ] User updates profile → Refresh screen → Changes reflected immediately
- [ ] User logs out and back in → Profile data is current, not stale
- [ ] Offline scenario → Show cached data with "outdated" indicator

## Related Issues

- **Subscription data synchronization** (similar pattern needed)
- **Persona confidence score updates** (requires fresh data from `user_personas`)
- **CheckIn response history** (time-sensitive data)

## Technology Context

- **Framework**: React Native (Expo 52)
- **Database**: Supabase (PostgreSQL)
- **State Management**: React Context API + local useState
- **TypeScript**: 5.6.3

## Trade-offs

### This Solution (Fresh Queries)

**Pros**:
- ✅ Always shows latest data
- ✅ Simple to implement
- ✅ No cache invalidation complexity

**Cons**:
- ⚠️ Extra database query per component mount
- ⚠️ Slight delay on initial render (loading state needed)
- ⚠️ Multiple components = multiple queries

### Alternative: Global State with Invalidation

**Pros**:
- ✅ Single source of truth
- ✅ Fewer database queries
- ✅ Optimistic updates possible

**Cons**:
- ⚠️ Complex cache invalidation logic
- ⚠️ Requires Redux/Zustand/React Query
- ⚠️ More boilerplate code

### Recommendation

For **small-to-medium apps** with infrequent profile updates: **Use fresh queries** (current solution).

For **large apps** with frequent profile access: Consider **React Query** with smart caching:

```typescript
import { useQuery } from '@tanstack/react-query';

const { data: userInfo } = useQuery({
  queryKey: ['user', user.id],
  queryFn: () => supabase.from('users').select('name, avatar, avatar_style').eq('id', user.id).single(),
  staleTime: 5 * 60 * 1000, // 5 minutes
});
```

## Additional Notes

This pattern applies to **any user-modifiable data** in Supabase apps:
- User profiles
- Subscription lists
- CheckIn responses
- Persona settings

The key insight: **Distinguish authentication state (cached) from user data (fresh)**.
