---
title: Phase 2.5 - Setup Flow, Persona System & Screen Improvements
type: enhancement
date: 2026-02-14
---

# Phase 2.5: User Persona System + Screen Improvements

## Context

Phase 2 successfully implemented CheckIn, Audit, and Report screens, but testing revealed critical gaps:

1. **Missing Personalization Foundation**: No user persona data collected during setup, making AI-powered features (CheckIn questions, Audit recommendations) generic rather than personalized
2. **CheckIn Issues**: Hard-coded questions, no completion summary, missing icons, question flow UX problems
3. **Audit Issues**: Prompts embedded in code, text too long, slow responses, missing radar chart, poor report formatting
4. **Report Issues**: Non-functional buttons, content structure needs redesign
5. **Technical Blocker**: react-native-reanimated 4.x incompatible with Expo Go (worklets version mismatch)

**Critical Insight from User Feedback**: Setup is not just about collecting basic info—it's the foundation for building a rich user persona that powers all AI personalization throughout the app. This requires:
- Scientific personality assessment (avoiding stereotypes)
- Behavioral tracking over time
- Dynamic persona updates from CheckIn/Audit interactions

## Problem Statement

Current app treats all users identically. CheckIn asks everyone the same questions, Audit provides generic recommendations, and there's no mechanism to learn and adapt to individual user patterns. The `user_personas` table exists but is unused.

**User Experience Gap**: Without persona-driven personalization, users get:
- ❌ Irrelevant CheckIn questions
- ❌ Generic Audit advice that doesn't match their risk tolerance
- ❌ One-size-fits-all notification timing
- ❌ No sense that the app "knows" them

## Proposed Solution

Implement a comprehensive persona system with three data sources:

1. **Explicit Setup Flow** (cold-start): 3-5 personality questions during onboarding
2. **Implicit Behavioral Tracking** (ongoing): Learn from actual user actions
3. **AI Interaction Refinement** (CheckIn/Audit): Use conversation data to improve persona

This creates a feedback loop: better personas → better questions → better data → even better personas.

## Technical Approach

### Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    PERSONA SYSTEM                            │
├─────────────────────────────────────────────────────────────┤
│  Data Sources:                                               │
│  1. Setup Flow (explicit) → Big Five traits                  │
│  2. Behavioral Tracking (implicit) → usage patterns          │
│  3. AI Conversations → decision style, communication prefs   │
│                                                               │
│  Storage: user_personas.structured_data (JSONB)              │
│                                                               │
│  Consumers:                                                   │
│  • CheckInScreen → personalized question generation          │
│  • AuditScreen → tailored prompts and recommendations        │
│  • ReportScreen → customized insights and suggestions        │
└─────────────────────────────────────────────────────────────┘
```

### Personality Framework Choice

**Use Big Five (OCEAN) as scientific foundation:**
- ✅ Empirically validated (60% predictive accuracy)
- ✅ Continuous spectrum (not binary types)
- ✅ Reduces stereotyping vs MBTI's 16 boxes
- ✅ AI-native: ML outputs probabilistic distributions

**Hybrid Approach for UX:**
- Use metaphor-based questions for engagement (not clinical "rate 1-10")
- Infer Big Five from behavioral patterns (implicit data)
- Optional explicit assessment (low-friction, skippable)

### Data Schema Design

```typescript
// New TypeScript interface to define
interface UserPersona {
  id: string;
  user_id: string;

  // Big Five personality traits (0.0-1.0 continuous scale)
  big_five_traits: {
    openness: number;          // 0.0 (conservative) to 1.0 (explorer)
    conscientiousness: number; // 0.0 (spontaneous) to 1.0 (disciplined)
    extraversion: number;      // 0.0 (reserved) to 1.0 (social)
    agreeableness: number;     // 0.0 (skeptical) to 1.0 (trusting)
    neuroticism: number;       // 0.0 (calm) to 1.0 (anxious)
  };

  // Behavioral patterns (inferred from actions)
  behavioral_patterns: {
    spending_style: 'cautious' | 'balanced' | 'explorer';
    decision_speed: 'deliberate' | 'moderate' | 'quick';
    research_depth: 'minimal' | 'moderate' | 'thorough';
    category_preferences: string[]; // ['Entertainment', 'Productivity']
    cancellation_triggers: string[]; // ['unused', 'price', 'quality']
  };

  // Episodic memory (recent interactions for context)
  episodic_memory: Array<{
    timestamp: string;
    event_type: 'checkin' | 'audit' | 'subscription_action';
    context: Record<string, any>;
    user_response: string;
    satisfaction_signal?: number; // 0.0-1.0
  }>;

  // Semantic memory (distilled long-term patterns)
  semantic_memory: {
    communication_style: 'concise' | 'detailed' | 'conversational';
    value_priorities: string[]; // ['price', 'quality', 'convenience']
    financial_anxiety_level: number; // 0.0-1.0
    subscription_awareness: number; // 0.0-1.0
  };

  // Metadata
  confidence_score: number; // 0.0-1.0 (how much data we have)
  last_updated: string;
  version: number; // Schema version for migrations

  created_at: string;
  updated_at: string;
}
```

### Implementation Phases

#### Phase 1: Foundation (Priority: P0)

**Files to Create:**
- `app/src/types/persona.ts` - UserPersona interface definition
- `app/src/utils/personaService.ts` - CRUD operations + inference logic
- `app/src/screens/SetupFlowScreen.tsx` - Multi-step persona onboarding
- `app/src/config/personalityQuestions.ts` - Question bank (separate from code)

**Files to Modify:**
- `app/src/types/index.ts` - Export UserPersona type
- `app/src/contexts/AuthContext.tsx` - Initialize persona after signup
- `app/src/navigation/RootNavigator.tsx` - Add SetupFlow after Auth

**Implementation:**

1. **Define UserPersona Type** (`app/src/types/persona.ts`):
```typescript
export interface UserPersona {
  // Full schema as defined above
}

export interface PersonaUpdate {
  source: 'explicit' | 'behavioral' | 'conversation';
  timestamp: string;
  updates: Partial<UserPersona>;
  confidence_delta: number;
}
```

2. **Create Persona Service** (`app/src/utils/personaService.ts`):
```typescript
// CRUD operations
export const createPersona = async (userId: string, initialData: Partial<UserPersona>)
export const getPersona = async (userId: string): Promise<UserPersona | null>
export const updatePersona = async (userId: string, update: PersonaUpdate)

// Inference functions
export const inferBigFiveFromBehavior = (subscriptions: Subscription[], checkIns: CheckInResponse[])
export const inferSpendingStyle = (subscriptions: Subscription[])
export const calculateConfidenceScore = (persona: UserPersona): number

// Privacy-preserving aggregation
export const anonymizePersonaForAnalytics = (persona: UserPersona)
```

3. **Build Setup Flow** (`app/src/screens/SetupFlowScreen.tsx`):

**Flow Design:**
```
Step 1: Welcome → "Let's personalize your experience"
Step 2: Budget Setup → monthly_budget, currency
Step 3: Personality Questions (3-5 questions, ~2 min)
Step 4: Preferences → notification_settings
```

**Key UX Principles:**
- Use engaging metaphors, not clinical language
- Swipeable cards (leverage existing CheckInScreen pattern)
- Visual sliders with emoji markers
- Progress indicator
- Skip option for personality step (can infer from behavior)

**Example Questions:**
```typescript
// app/src/config/personalityQuestions.ts
export const PERSONALITY_QUESTIONS = [
  {
    id: 'spending_style',
    type: 'slider',
    question: 'How do you approach new subscriptions?',
    leftLabel: '🎯 Quality curator - few, well-chosen services',
    rightLabel: '🧪 Experience explorer - love trying new things',
    metric: 'openness',
    required: false
  },
  {
    id: 'decision_style',
    type: 'scenario',
    question: 'You find a subscription you haven\'t used in months. You:',
    options: [
      { text: '⚡ Cancel immediately', value: 'quick', trait: 'conscientiousness_high' },
      { text: '📊 Check usage stats first', value: 'deliberate', trait: 'conscientiousness_high' },
      { text: '🤷 Keep it, might use later', value: 'flexible', trait: 'conscientiousness_low' },
      { text: '📅 Set reminder to decide next month', value: 'moderate', trait: 'neuroticism_medium' }
    ],
    metric: 'conscientiousness',
    required: false
  },
  {
    id: 'financial_stress',
    type: 'emoji_scale',
    question: 'How do you feel about your current subscription spending?',
    scale: [
      { emoji: '😰', label: 'Very stressed', value: 0.9 },
      { emoji: '😕', label: 'Somewhat stressed', value: 0.6 },
      { emoji: '😐', label: 'Neutral', value: 0.5 },
      { emoji: '😊', label: 'Comfortable', value: 0.3 },
      { emoji: '🎉', label: 'Very comfortable', value: 0.1 }
    ],
    metric: 'neuroticism',
    required: true
  }
];
```

4. **Initialize Persona After Signup** (`app/src/contexts/AuthContext.tsx`):
```typescript
// In signUp function, after user creation:
const initialPersona = {
  big_five_traits: {
    openness: 0.5,  // Neutral defaults
    conscientiousness: 0.5,
    extraversion: 0.5,
    agreeableness: 0.5,
    neuroticism: 0.5
  },
  behavioral_patterns: {
    spending_style: 'balanced',
    decision_speed: 'moderate',
    research_depth: 'moderate',
    category_preferences: [],
    cancellation_triggers: []
  },
  episodic_memory: [],
  semantic_memory: {
    communication_style: 'conversational',
    value_priorities: [],
    financial_anxiety_level: 0.5,
    subscription_awareness: 0.5
  },
  confidence_score: 0.1, // Low confidence, need more data
  version: 1
};

await createPersona(user.id, initialPersona);
```

#### Phase 2: CheckIn Screen Improvements (Priority: P0)

**Goals:**
1. Generate AI-powered questions based on persona
2. Display icons for subscriptions
3. Add completion summary
4. Improve question flow UX
5. Track behavioral signals

**Files to Modify:**
- `app/src/screens/CheckInScreen.simple.tsx` (current active version)
- `app/src/utils/claude.ts` - Add `generateCheckInQuestions()` function
- `app/src/config/prompts.ts` - NEW FILE for prompt management

**Implementation:**

1. **Extract Prompts to Config** (`app/src/config/prompts.ts`):
```typescript
export const CHECKIN_PROMPTS = {
  questionGeneration: (persona: UserPersona, subscription: Subscription) => `
You are generating a personalized check-in question for a subscription.

USER PERSONA:
- Spending Style: ${persona.behavioral_patterns.spending_style}
- Decision Speed: ${persona.behavioral_patterns.decision_speed}
- Financial Anxiety: ${persona.semantic_memory.financial_anxiety_level}
- Communication Style: ${persona.semantic_memory.communication_style}

SUBSCRIPTION:
- Name: ${subscription.name}
- Cost: $${subscription.cost}/${subscription.billing_cycle}
- Usage Score: ${subscription.usage_score || 'unknown'}
- Last Used: ${subscription.updated_at}

TASK: Generate ONE insightful follow-up question based on their personality.
If they're anxious and cautious, ask about concrete usage patterns.
If they're explorer type, ask about alternatives they've considered.

Return JSON: { "question": "...", "options": ["...", "...", "..."] }
`,

  completionSummary: (persona: UserPersona, results: CheckInResult[]) => `
You are summarizing a user's weekly check-in results.

USER PERSONA: ${JSON.stringify(persona.semantic_memory)}

CHECK-IN RESULTS:
${results.map(r => `${r.subscription.name}: ${r.decision} (${r.reason})`).join('\n')}

TASK: Generate a warm, personalized summary with:
1. Key insight (What pattern did you notice?)
2. One actionable recommendation
3. Encouragement aligned with their personality

Return JSON: { "summary": "...", "recommendation": "...", "encouragement": "..." }
`
};
```

2. **Add AI Question Generation** (`app/src/utils/claude.ts`):
```typescript
export async function generateCheckInQuestion(
  persona: UserPersona,
  subscription: Subscription
): Promise<{ question: string; options: string[] }> {
  const prompt = CHECKIN_PROMPTS.questionGeneration(persona, subscription);

  const message = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 500,
    messages: [{ role: 'user', content: prompt }]
  });

  return parseClaudeResponse(message.content[0].text);
}
```

3. **Display Subscription Icons** (Fix missing icon_emoji display):
```typescript
// In CheckInScreen.simple.tsx, card rendering:
<View style={styles.cardEmoji}>
  <Text style={styles.emojiText}>
    {currentSub.icon_emoji || '📦'}
  </Text>
</View>
```

4. **Add Completion Summary** (New view after all cards):
```typescript
// In CheckInScreen.simple.tsx, add new state:
const [completionSummary, setCompletionSummary] = useState<CheckInSummary | null>(null);

// After last card swiped:
const handleAllCardsComplete = async () => {
  const persona = await getPersona(user.id);
  const summary = await generateCheckInSummary(persona, checkInResults);
  setCompletionSummary(summary);
};

// Render summary view:
{completionSummary && (
  <View style={styles.summaryContainer}>
    <Ionicons name="checkmark-circle" size={80} color={colors.success} />
    <Text style={styles.summaryTitle}>Week Reviewed!</Text>
    <Text style={styles.summaryInsight}>{completionSummary.summary}</Text>

    {/* Actionable recommendations */}
    <View style={styles.recommendationCard}>
      <Text style={styles.recommendationTitle}>💡 Consider This:</Text>
      <Text style={styles.recommendationText}>{completionSummary.recommendation}</Text>
    </View>

    <Pressable style={styles.doneButton} onPress={() => navigation.navigate('Manager')}>
      <Text style={styles.doneButtonText}>Back to Manager</Text>
    </Pressable>
  </View>
)}
```

5. **Track Behavioral Signals**:
```typescript
// Track decision speed, patterns
const trackCheckInBehavior = async (userId: string, decision: CheckInDecision) => {
  const responseTime = decision.timestamp - decision.startTimestamp;

  await updatePersona(userId, {
    source: 'behavioral',
    timestamp: new Date().toISOString(),
    updates: {
      episodic_memory: [{
        timestamp: decision.timestamp,
        event_type: 'checkin',
        context: { subscription_id: decision.subscription_id },
        user_response: decision.direction,
        satisfaction_signal: decision.responseTime < 2000 ? 0.9 : 0.5 // Fast = confident
      }]
    },
    confidence_delta: 0.02 // Slightly increase confidence
  });
};
```

#### Phase 3: Audit Screen Improvements (Priority: P1)

**Goals:**
1. Extract prompts to separate file
2. Implement multi-bubble for long text
3. Investigate and fix slow responses
4. Improve UI (title formatting, input height, navbar hiding)
5. Clear input after sending
6. Add radar chart for dimensions
7. Improve report formatting
8. Dynamic button emphasis based on score

**Files to Modify:**
- `app/src/screens/AuditScreen.tsx`
- `app/src/utils/claude.ts` - Extract prompts
- `app/src/config/prompts.ts` - Add audit prompts
- `app/src/components/RadarChart.tsx` - NEW FILE

**Implementation:**

1. **Extract Audit Prompts** (`app/src/config/prompts.ts`):
```typescript
export const AUDIT_PROMPTS = {
  start: (persona: UserPersona, context: AuditContext) => `
You are SubSense AI, analyzing whether a new subscription fits this user.

USER PROFILE:
- Name: ${context.userName}
- Monthly Budget: $${context.monthlyBudget}
- Existing Subs: ${context.existingSubscriptions.map(s => `${s.name} ($${s.cost})`).join(', ')}

PERSONALITY CONTEXT:
- Spending Style: ${persona.behavioral_patterns.spending_style}
- Decision Speed: ${persona.behavioral_patterns.decision_speed}
- Financial Anxiety: ${persona.semantic_memory.financial_anxiety_level}
- Value Priorities: ${persona.semantic_memory.value_priorities.join(', ')}

YOUR MISSION: Conduct a friendly audit through conversation.
${persona.semantic_memory.communication_style === 'concise' ?
  'Keep responses SHORT (2-3 sentences max). User prefers concise.' :
  'Be conversational and thorough. User appreciates detail.'}

FIRST MESSAGE: Greet warmly, reference their spending style, ask what service they're considering.
Provide 4 example options as chips.

Response format: JSON with { "botReplies": ["string"], "options": ["string"] }
`,

  continue: (persona: UserPersona, context: AuditContext) => `
${/* ... similar personalization ... */}

CONVERSATION RULES:
1. Ask ONE focused question at a time
2. ${persona.semantic_memory.communication_style === 'concise' ?
     'Keep responses under 50 words' :
     'Be detailed and conversational'}
3. After gathering ${persona.behavioral_patterns.decision_speed === 'quick' ? '2-3' : '4-5'} key points, finish
4. Provide 2-4 quick-reply options

SCORING CRITERIA (adjust based on persona):
- If user is financially anxious, weight budget fit heavily
- If user is explorer type, be more encouraging of trials
- If user is cautious, emphasize risks more prominently

Response format: JSON...
`
};
```

2. **Multi-Bubble for Long Text** (Split messages > 100 chars):
```typescript
// In AuditScreen.tsx, modify message rendering:
const splitLongMessage = (text: string, maxLength: number = 100): string[] => {
  if (text.length <= maxLength) return [text];

  // Split at sentence boundaries
  const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
  const bubbles: string[] = [];
  let currentBubble = '';

  sentences.forEach(sentence => {
    if ((currentBubble + sentence).length > maxLength && currentBubble) {
      bubbles.push(currentBubble.trim());
      currentBubble = sentence;
    } else {
      currentBubble += sentence;
    }
  });

  if (currentBubble) bubbles.push(currentBubble.trim());
  return bubbles;
};

// Render multiple bubbles with stagger animation:
{message.role === 'assistant' && splitLongMessage(message.content).map((bubble, idx) => (
  <Animated.View
    key={`${message.id}-${idx}`}
    entering={FadeIn.delay(idx * 200)}
  >
    <ChatBubble message={{ ...message, content: bubble }} />
  </Animated.View>
))}
```

3. **Investigate Slow Response Times**:

**Likely Causes:**
- Network latency (Claude API)
- Large conversation history sent every time
- Unoptimized prompt (too many tokens)

**Fixes:**
```typescript
// Optimize Claude API calls:
export async function continueAuditConversation(
  conversationHistory: ChatMessage[],
  context: AuditContext,
  persona: UserPersona
): Promise<AuditResponse> {
  // 1. Truncate old history (keep only last 10 exchanges)
  const recentHistory = conversationHistory.slice(-20); // 10 exchanges = 20 messages

  // 2. Use streaming for perceived speed
  const stream = await anthropic.messages.stream({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 1000, // Reduced from 2000
    system: AUDIT_PROMPTS.continue(persona, context),
    messages: recentHistory.map(msg => ({
      role: msg.role === 'user' ? 'user' : 'assistant',
      content: msg.content
    }))
  });

  // 3. Show typing indicator immediately
  return new Promise((resolve) => {
    let fullText = '';

    stream.on('text', (text) => {
      fullText += text;
      // Could update UI in real-time here
    });

    stream.on('end', () => {
      resolve(parseClaudeResponse(fullText));
    });
  });
}
```

4. **UI Improvements**:

**Fix Title Formatting**:
```typescript
// In AuditScreen.tsx, header section:
<View style={styles.chatHeader}>
  <Text style={styles.headerTitle}>SUBSCRIPTION AUDIT</Text>
  {/* Better: */}
  <Text style={styles.headerTitle}>Audit Chat</Text>
  <Text style={styles.headerSubtitle}>Let's evaluate this subscription</Text>
</View>

const styles = StyleSheet.create({
  headerTitle: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.black,
    color: colors.textPrimary,
    textAlign: 'center', // Center alignment
    letterSpacing: 1.2,
  },
  headerSubtitle: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: spacing.xs,
  }
});
```

**Reduce Input Box Height**:
```typescript
chatInput: {
  flex: 1,
  backgroundColor: colors.white,
  borderRadius: borderRadius.full,
  paddingHorizontal: spacing.md,
  paddingVertical: spacing.sm, // Reduced from spacing.md
  fontSize: fontSize.base,
  maxHeight: 80, // ADD THIS: Limit height
  minHeight: 40, // ADD THIS: Minimum height
},
```

**Hide Navbar During Audit**:
```typescript
// In MainTabNavigator.tsx, add conditional tabBar visibility:
<Tab.Screen
  name="Audit"
  component={AuditScreen}
  options={({ navigation }) => ({
    tabBarStyle: {
      // Check if currently in audit chat
      display: navigation.isFocused() && isAuditActive ? 'none' : 'flex',
      // ... other styles
    }
  })}
/>

// In AuditScreen, set focus state:
useEffect(() => {
  navigation.setParams({ isAuditActive: viewMode === 'chat' });
}, [viewMode]);
```

**Clear Input After Sending**:
```typescript
// In handleSendMessage function:
const handleSendMessage = async (text: string) => {
  if (!text.trim() || isTyping) return;

  setInputValue(''); // ADD THIS LINE - clear immediately

  // Add user message
  const userMessage: ChatMessage = {
    role: 'user',
    content: text.trim()
  };

  setConversationHistory(prev => [...prev, userMessage]);
  setIsTyping(true);

  // ... rest of logic
};
```

5. **Add Radar Chart** (`app/src/components/RadarChart.tsx`):
```typescript
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Polygon, Circle, Line, Text as SvgText } from 'react-native-svg';

interface RadarChartProps {
  dimensions: Array<{
    label: string;
    value: number; // 0-100
  }>;
  size?: number;
}

export const RadarChart: React.FC<RadarChartProps> = ({
  dimensions,
  size = 200
}) => {
  const center = size / 2;
  const radius = size / 2 - 30;
  const numDimensions = dimensions.length;

  // Calculate polygon points for data
  const dataPoints = dimensions.map((dim, i) => {
    const angle = (Math.PI * 2 * i) / numDimensions - Math.PI / 2;
    const value = (dim.value / 100) * radius;
    return {
      x: center + Math.cos(angle) * value,
      y: center + Math.sin(angle) * value,
    };
  });

  // Calculate max circle points
  const maxPoints = dimensions.map((_, i) => {
    const angle = (Math.PI * 2 * i) / numDimensions - Math.PI / 2;
    return {
      x: center + Math.cos(angle) * radius,
      y: center + Math.sin(angle) * radius,
    };
  });

  return (
    <View style={styles.container}>
      <Svg width={size} height={size}>
        {/* Background circles (guide lines) */}
        {[0.25, 0.5, 0.75, 1].map(scale => (
          <Polygon
            key={scale}
            points={maxPoints.map(p =>
              `${center + (p.x - center) * scale},${center + (p.y - center) * scale}`
            ).join(' ')}
            fill="none"
            stroke="#E5E7EB"
            strokeWidth="1"
          />
        ))}

        {/* Axis lines */}
        {maxPoints.map((point, i) => (
          <Line
            key={`axis-${i}`}
            x1={center}
            y1={center}
            x2={point.x}
            y2={point.y}
            stroke="#D1D5DB"
            strokeWidth="1"
          />
        ))}

        {/* Data polygon */}
        <Polygon
          points={dataPoints.map(p => `${p.x},${p.y}`).join(' ')}
          fill="#3B82F6"
          fillOpacity="0.3"
          stroke="#3B82F6"
          strokeWidth="2"
        />

        {/* Data points */}
        {dataPoints.map((point, i) => (
          <Circle
            key={`point-${i}`}
            cx={point.x}
            cy={point.y}
            r="4"
            fill="#3B82F6"
          />
        ))}

        {/* Labels */}
        {dimensions.map((dim, i) => {
          const angle = (Math.PI * 2 * i) / numDimensions - Math.PI / 2;
          const labelRadius = radius + 20;
          const x = center + Math.cos(angle) * labelRadius;
          const y = center + Math.sin(angle) * labelRadius;

          return (
            <SvgText
              key={`label-${i}`}
              x={x}
              y={y}
              fill="#374151"
              fontSize="12"
              fontWeight="600"
              textAnchor="middle"
            >
              {dim.label}
            </SvgText>
          );
        })}
      </Svg>

      {/* Legend */}
      <View style={styles.legend}>
        {dimensions.map((dim, i) => (
          <View key={i} style={styles.legendItem}>
            <Text style={styles.legendLabel}>{dim.label}:</Text>
            <Text style={styles.legendValue}>{dim.value}/100</Text>
          </View>
        ))}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  legend: {
    marginTop: 20,
    width: '100%',
  },
  legendItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  legendLabel: {
    fontSize: 14,
    color: '#6B7280',
  },
  legendValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
  },
});
```

**Use in AuditScreen report view**:
```typescript
{report.dimension_scores && (
  <RadarChart
    dimensions={[
      { label: 'Value', value: report.dimension_scores.value },
      { label: 'Budget Fit', value: report.dimension_scores.budget_fit },
      { label: 'Usage Likelihood', value: report.dimension_scores.usage },
      { label: 'Alternatives', value: report.dimension_scores.alternatives },
      { label: 'Quality', value: report.dimension_scores.quality },
    ]}
  />
)}
```

6. **Improve Report Formatting**:
```typescript
// Larger text, better hierarchy
<View style={styles.reportHeader}>
  <Text style={styles.reportScore}>{report.score}</Text>
  <Text style={styles.reportScoreLabel}>Efficiency Score</Text>
  <View style={[styles.statusBadge, getStatusColor(report.status)]}>
    <Text style={styles.statusBadgeText}>
      {report.status === 'Good' ? '✓ Good Fit' :
       report.status === 'Fair' ? '~ Fair Match' :
       '⚠ Poor Fit'}
    </Text>
  </View>
</View>

<View style={styles.recommendationCard}>
  <Text style={styles.recommendationTitle}>AI Recommendation</Text>
  <Text style={styles.recommendationText}>{report.recommendation}</Text>
</View>

const styles = StyleSheet.create({
  reportScore: {
    fontSize: fontSize.xxxxl, // 48px, much larger
    fontWeight: fontWeight.black,
    color: colors.primary,
  },
  reportScoreLabel: {
    fontSize: fontSize.base, // 16px
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  recommendationText: {
    fontSize: fontSize.md, // 18px, increased from base
    lineHeight: 26,
    color: colors.textPrimary,
  }
});
```

7. **Dynamic Button Emphasis**:
```typescript
// In report view, render buttons with conditional styling:
const getActionButtons = (status: 'Good' | 'Fair' | 'Poor') => {
  const buttons = [
    { id: 'track', label: 'Track It!', icon: 'add-circle', color: colors.success },
    { id: 'remind', label: 'Set Reminder', icon: 'notifications', color: colors.warning },
    { id: 'pass', label: 'Pass For Now', icon: 'close-circle', color: colors.textTertiary },
  ];

  // Emphasize based on score
  if (status === 'Good') {
    return buttons.map(b => ({
      ...b,
      emphasized: b.id === 'track',
      size: b.id === 'track' ? 'large' : 'medium',
    }));
  } else if (status === 'Poor') {
    return buttons.map(b => ({
      ...b,
      emphasized: b.id === 'remind',
      size: b.id === 'remind' ? 'large' : 'medium',
    }));
  } else {
    return buttons.map(b => ({ ...b, emphasized: false, size: 'medium' }));
  }
};

// Render:
<View style={styles.actionsContainer}>
  {getActionButtons(report.status).map(button => (
    <Pressable
      key={button.id}
      style={[
        styles.actionButton,
        button.emphasized && styles.actionButtonEmphasized,
        button.size === 'large' && styles.actionButtonLarge,
      ]}
      onPress={() => handleAction(button.id)}
    >
      <Ionicons name={button.icon} size={button.size === 'large' ? 28 : 20} color={button.color} />
      <Text style={[
        styles.actionButtonText,
        button.emphasized && styles.actionButtonTextEmphasized,
      ]}>
        {button.label}
      </Text>
    </Pressable>
  ))}
</View>

const styles = StyleSheet.create({
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: borderRadius.full,
    borderWidth: 2,
    borderColor: colors.gray200,
    backgroundColor: colors.white,
  },
  actionButtonLarge: {
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.xl,
    borderWidth: 3,
    transform: [{ scale: 1.1 }],
  },
  actionButtonEmphasized: {
    backgroundColor: colors.primaryLight,
    borderColor: colors.primary,
    elevation: 4,
  },
  actionButtonTextEmphasized: {
    fontWeight: fontWeight.black,
    color: colors.primary,
  }
});
```

#### Phase 4: Report Screen Improvements (Priority: P2)

**Goals:**
1. Make all buttons functional
2. Redesign content structure for better UX

**Files to Modify:**
- `app/src/screens/ReportScreen.tsx`
- `app/src/utils/reportService.ts` - NEW FILE for calculations

**Implementation:**

1. **Implement Button Actions**:

**Monthly Spending Detail**:
```typescript
const handleSpendingDetail = () => {
  const sortedSubs = subscriptions
    .filter(s => s.status === 'active')
    .sort((a, b) => b.cost - a.cost);

  setSelectedDetail({
    type: 'spending',
    title: 'Monthly Spending Breakdown',
    data: sortedSubs,
    total: sortedSubs.reduce((sum, s) => sum + s.cost, 0)
  });
};
```

**AI Audits History**:
```typescript
const handleAuditsHistory = async () => {
  const audits = await supabase
    .from('assessments')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(10);

  setSelectedDetail({
    type: 'audits',
    title: 'Recent AI Audits',
    data: audits.data || []
  });
};
```

**Newly Tracked Detail**:
```typescript
const handleNewlyTrackedDetail = () => {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const newSubs = subscriptions.filter(s =>
    new Date(s.created_at) > thirtyDaysAgo
  );

  setSelectedDetail({
    type: 'new',
    title: 'Recently Added',
    data: newSubs
  });
};
```

**Active Savings Detail**:
```typescript
const handleActiveSavingsDetail = () => {
  const pausedSubs = subscriptions.filter(s => s.status === 'paused');
  const totalSavings = pausedSubs.reduce((sum, s) => sum + s.cost, 0);

  setSelectedDetail({
    type: 'savings',
    title: 'Your Active Savings',
    data: pausedSubs,
    total: totalSavings
  });
};
```

**Category Drill-Down**:
```typescript
const handleCategoryDetail = (category: string) => {
  const categorySubs = subscriptions.filter(s => s.category === category && s.status === 'active');
  const total = categorySubs.reduce((sum, s) => sum + s.cost, 0);

  setSelectedDetail({
    type: 'category',
    title: `${category} Subscriptions`,
    data: categorySubs,
    total
  });
};
```

**Share Button**:
```typescript
import * as Sharing from 'expo-sharing';

const handleShareReport = async () => {
  const shareMessage = `My Subscription Health Report:

🎯 Health Score: ${healthScore}/100
💰 Monthly Spending: $${monthlyTotal}
📊 Active Subscriptions: ${activeCount}
💵 Savings This Month: $${activeSavings}

Track your subscriptions with SubSense!`;

  await Sharing.shareAsync({
    message: shareMessage
  });
};
```

2. **Redesign Content Structure**:

**New Layout Hierarchy**:
```typescript
// Reorganize Report Screen structure
const REPORT_SECTIONS = [
  {
    id: 'hero',
    component: 'HealthScoreHero',
    content: 'Large circular progress + score + status'
  },
  {
    id: 'insights',
    component: 'PersonalizedInsights',
    content: 'AI-generated insights based on persona + monthly data'
  },
  {
    id: 'stats',
    component: 'StatsGrid',
    content: '4 key metrics with tap-to-detail'
  },
  {
    id: 'trends',
    component: 'TrendChart',
    content: 'Line chart showing 6-month spending trend'
  },
  {
    id: 'categories',
    component: 'CategoryBreakdown',
    content: 'Horizontal scrollable category cards'
  },
  {
    id: 'actions',
    component: 'QuickActions',
    content: 'Based on persona: Cancel Unused, Explore Bundles, Set Limits'
  }
];
```

**Personalized Insights Section** (NEW):
```typescript
// Generate insights using persona + monthly data
const generatePersonalizedInsights = async (userId: string) => {
  const persona = await getPersona(userId);
  const subscriptions = await getSubscriptions(userId);
  const monthlyData = calculateMonthlyStats(subscriptions);

  const insights = await anthropic.messages.create({
    model: 'claude-haiku-4-20250514', // Faster model for insights
    max_tokens: 300,
    messages: [{
      role: 'user',
      content: `
Generate 2-3 personalized insights for this user's subscription report:

PERSONA: ${JSON.stringify(persona.semantic_memory)}
MONTHLY DATA: ${JSON.stringify(monthlyData)}

Focus on actionable insights matching their personality.
If they're anxious, highlight savings opportunities.
If they're explorer, suggest new categories to try.

Return JSON: { "insights": ["...", "...", "..."] }
`
    }]
  });

  return parseClaudeResponse(insights.content[0].text).insights;
};

// Render in ReportScreen:
<View style={styles.insightsSection}>
  <Text style={styles.sectionTitle}>INSIGHTS FOR YOU</Text>
  {insights.map((insight, i) => (
    <View key={i} style={styles.insightCard}>
      <Ionicons name="bulb" size={24} color={colors.primary} />
      <Text style={styles.insightText}>{insight}</Text>
    </View>
  ))}
</View>
```

**Trend Chart** (NEW):
```typescript
// Use Victory Native for trend line
import { VictoryLine, VictoryChart, VictoryTheme, VictoryAxis } from 'victory-native';

const TrendChart = ({ data }) => (
  <VictoryChart theme={VictoryTheme.material} height={200}>
    <VictoryAxis
      tickFormat={(t) => `${t.substring(0, 3)}`}
      style={{
        tickLabels: { fontSize: 10, fill: '#6B7280' }
      }}
    />
    <VictoryAxis
      dependentAxis
      tickFormat={(t) => `$${t}`}
      style={{
        tickLabels: { fontSize: 10, fill: '#6B7280' }
      }}
    />
    <VictoryLine
      data={data}
      x="month"
      y="spending"
      style={{
        data: { stroke: "#3B82F6", strokeWidth: 3 }
      }}
    />
  </VictoryChart>
);
```

**Quick Actions** (NEW):
```typescript
// Generate persona-based action recommendations
const getQuickActions = (persona: UserPersona, subscriptions: Subscription[]) => {
  const actions = [];

  // If financially anxious + has unused subs
  if (persona.semantic_memory.financial_anxiety_level > 0.6) {
    const unused = subscriptions.filter(s => s.usage_score < 3);
    if (unused.length > 0) {
      actions.push({
        id: 'cancel_unused',
        icon: 'close-circle',
        label: `Cancel ${unused.length} Unused`,
        action: () => navigation.navigate('CheckIn')
      });
    }
  }

  // If explorer + no entertainment subs
  if (persona.behavioral_patterns.spending_style === 'explorer') {
    const hasEntertainment = subscriptions.some(s => s.category === 'Entertainment');
    if (!hasEntertainment) {
      actions.push({
        id: 'explore_entertainment',
        icon: 'film',
        label: 'Explore Streaming',
        action: () => navigation.navigate('Audit')
      });
    }
  }

  return actions;
};
```

#### Phase 5: Behavioral Tracking & Persona Refinement (Priority: P2)

**Goal**: Continuously improve persona based on user actions

**Implementation:**

1. **Track Behavioral Signals**:
```typescript
// app/src/utils/behaviorTracker.ts
export const trackBehaviorSignal = async (
  userId: string,
  event: BehaviorEvent
) => {
  const persona = await getPersona(userId);

  // Infer personality traits from behavior
  const updates = inferTraitsFromEvent(event, persona);

  await updatePersona(userId, {
    source: 'behavioral',
    timestamp: new Date().toISOString(),
    updates,
    confidence_delta: 0.01
  });
};

// Events to track:
// - Subscription added (openness +)
// - Subscription cancelled quickly (conscientiousness +)
// - CheckIn completed fast (decision_speed +)
// - Audit taken before signup (research_depth +)
// - Notification settings changed (communication preference)
```

2. **Persona Confidence Score**:
```typescript
export const calculateConfidenceScore = (persona: UserPersona): number => {
  let confidence = 0.0;

  // Explicit assessment completed: +0.3
  if (persona.big_five_traits.openness !== 0.5) confidence += 0.3;

  // Each checkin response: +0.05
  const checkinCount = persona.episodic_memory.filter(e => e.event_type === 'checkin').length;
  confidence += Math.min(checkinCount * 0.05, 0.3);

  // Each audit completed: +0.1
  const auditCount = persona.episodic_memory.filter(e => e.event_type === 'audit').length;
  confidence += Math.min(auditCount * 0.1, 0.4);

  return Math.min(confidence, 1.0);
};
```

3. **Privacy-Preserving Updates**:
```typescript
// Use differential privacy when updating persona from behavior
export const updatePersonaWithPrivacy = async (
  userId: string,
  update: PersonaUpdate
) => {
  // Add controlled noise to trait updates (differential privacy)
  const noisyUpdate = {
    ...update,
    updates: {
      ...update.updates,
      big_five_traits: addLaplaceNoise(update.updates.big_five_traits, epsilon = 0.1)
    }
  };

  await updatePersona(userId, noisyUpdate);
};
```

### Dependency Resolution

**react-native-reanimated 4.x worklets issue:**

**Root Cause**: Expo Go native modules don't support worklets 0.7.2 (reanimated 4.x dependency)

**Solution Options:**
1. **Continue using simplified CheckInScreen** (current approach) - No animations but functional
2. **Build Development Build** - Requires Xcode, supports full reanimated 4.x
3. **Wait for Expo Go update** - Next Expo SDK release may support worklets 0.7.2

**Recommendation**: Keep simplified version for now, plan Development Build for Phase 3 (production release).

## Success Metrics

**Persona System:**
- [ ] 85%+ users complete personality setup (< 2 minutes)
- [ ] Persona confidence score reaches 0.7+ after 2 weeks of use
- [ ] AI-generated questions feel personalized (user survey)

**CheckIn Screen:**
- [ ] All subscriptions display correct icons
- [ ] Completion summary shows actionable insights
- [ ] AI questions vary based on persona (not same for everyone)

**Audit Screen:**
- [ ] Response time < 3 seconds (currently slow)
- [ ] Text split into max 2 bubbles (no walls of text)
- [ ] Radar chart renders correctly
- [ ] Button emphasis matches score correctly

**Report Screen:**
- [ ] All detail buttons functional (no console.log placeholders)
- [ ] Personalized insights feel relevant (user survey)
- [ ] Share feature works

## Acceptance Criteria

### Functional Requirements

- [ ] UserPersona type defined and exported
- [ ] Setup flow collects 3-5 personality questions
- [ ] Big Five traits stored in database
- [ ] CheckInScreen generates AI questions based on persona
- [ ] Audit prompts extracted to config file
- [ ] Audit responses < 3 seconds
- [ ] Audit report shows radar chart
- [ ] Report buttons all functional
- [ ] Behavioral signals tracked and stored

### Non-Functional Requirements

- [ ] Setup flow completion rate > 85%
- [ ] Average setup time < 4 minutes
- [ ] Persona confidence score calculable
- [ ] Privacy: behavioral data anonymizable
- [ ] GDPR compliance: consent flow implemented

### Quality Gates

- [ ] TypeScript: No `any` types, all interfaces defined
- [ ] Testing: Persona CRUD operations unit tested
- [ ] Performance: Audit responses < 3s average
- [ ] Accessibility: All personality questions have labels
- [ ] Documentation: Prompt config file well-commented

## Risk Analysis & Mitigation

**High Risks:**

1. **Stereotype Amplification**: Personality assessments could reinforce biases
   - **Mitigation**: Use Big Five (continuous spectrum), avoid gendered language, A/B test questions

2. **Privacy Concerns**: Collecting behavioral data raises privacy issues
   - **Mitigation**: Transparent consent, differential privacy, data minimization, GDPR compliance

3. **Low Setup Completion**: Long personality questionnaire causes drop-off
   - **Mitigation**: Keep to 3-5 questions, make skippable, use engaging format (swipes/sliders)

4. **Slow Audit Responses**: Claude API latency hurts UX
   - **Mitigation**: Truncate history, reduce max_tokens, use streaming, show immediate typing indicator

**Medium Risks:**

5. **Poor Persona Quality**: Insufficient data leads to bad recommendations
   - **Mitigation**: Start with cautious neutral defaults, require confidence threshold before acting

6. **Animation Performance**: Reanimated issues persist
   - **Mitigation**: Continue with simplified version, plan Development Build for production

## Dependencies & Prerequisites

**Technical Dependencies:**
- TypeScript 5.6.3
- React Native 0.81.5 (note: should be 0.76.x per docs, verify)
- Expo 54
- Supabase (user_personas table)
- Claude API (Sonnet 4.5)
- react-native-svg (for radar chart)
- Victory Native (for trend chart)

**Data Dependencies:**
- `user_personas` table exists (✅)
- `users` table has required fields (✅)
- `subscriptions` table (✅)
- New table needed: `checkin_responses`

**Design Dependencies:**
- Personality question bank (need to create)
- Prompt templates (need to create)
- Radar chart design (need to implement)

## File Structure

```
app/
├── src/
│   ├── types/
│   │   ├── index.ts (modify - export UserPersona)
│   │   └── persona.ts (NEW - UserPersona interface)
│   │
│   ├── config/
│   │   ├── prompts.ts (NEW - all Claude prompts)
│   │   └── personalityQuestions.ts (NEW - question bank)
│   │
│   ├── utils/
│   │   ├── personaService.ts (NEW - CRUD + inference)
│   │   ├── behaviorTracker.ts (NEW - track signals)
│   │   ├── reportService.ts (NEW - calculations)
│   │   └── claude.ts (modify - extract prompts)
│   │
│   ├── components/
│   │   ├── RadarChart.tsx (NEW - dimension visualization)
│   │   └── TrendChart.tsx (NEW - spending trend)
│   │
│   ├── screens/
│   │   ├── SetupFlowScreen.tsx (NEW - persona onboarding)
│   │   ├── CheckInScreen.simple.tsx (modify - AI questions, icons, summary)
│   │   ├── AuditScreen.tsx (modify - prompts, UI, radar, buttons)
│   │   └── ReportScreen.tsx (modify - button actions, insights)
│   │
│   ├── contexts/
│   │   └── AuthContext.tsx (modify - init persona)
│   │
│   └── navigation/
│       ├── RootNavigator.tsx (modify - add SetupFlow)
│       └── MainTabNavigator.tsx (modify - conditional navbar)
│
└── supabase-schema.sql (no changes - user_personas already exists)
```

## Database Schema Changes

**New Table: checkin_responses**
```sql
CREATE TABLE checkin_responses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  subscription_id UUID NOT NULL REFERENCES subscriptions(id) ON DELETE CASCADE,
  direction TEXT NOT NULL, -- 'left' | 'right' | 'down'
  reason TEXT,
  follow_up_answers JSONB,
  response_time_ms INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_checkin_responses_user_id ON checkin_responses(user_id);
CREATE INDEX idx_checkin_responses_created_at ON checkin_responses(created_at DESC);
```

**Extend assessments table:**
```sql
ALTER TABLE assessments
ADD COLUMN IF NOT EXISTS dimension_scores JSONB;

-- Example dimension_scores structure:
-- {
--   "value": 85,
--   "budget_fit": 72,
--   "usage": 68,
--   "alternatives": 55,
--   "quality": 90
-- }
```

## Implementation Priority

**Phase 1 (P0 - Critical):** Weeks 1-2
1. Define UserPersona type
2. Create personaService.ts
3. Build SetupFlowScreen
4. Initialize persona after signup
5. Display subscription icons in CheckIn

**Phase 2 (P0 - Critical):** Weeks 2-3
6. Extract prompts to config
7. Add AI question generation to CheckIn
8. Add completion summary to CheckIn
9. Track behavioral signals

**Phase 3 (P1 - High):** Weeks 3-4
10. Audit: Multi-bubble text splitting
11. Audit: Optimize response speed
12. Audit: UI improvements (title, input, navbar)
13. Audit: Clear input after send
14. Audit: Add radar chart

**Phase 4 (P1 - High):** Week 4
15. Audit: Improve report formatting
16. Audit: Dynamic button emphasis
17. Report: Implement all button actions
18. Report: Add personalized insights

**Phase 5 (P2 - Medium):** Week 5
19. Report: Add trend chart
20. Report: Add quick actions
21. Continuous persona refinement logic
22. Privacy-preserving updates

## Testing Strategy

**Unit Tests:**
```typescript
// personaService.test.ts
describe('personaService', () => {
  test('inferBigFiveFromBehavior calculates openness correctly', () => {
    const subs = [/* high variety */];
    const traits = inferBigFiveFromBehavior(subs, []);
    expect(traits.openness).toBeGreaterThan(0.6);
  });

  test('calculateConfidenceScore increases with data', () => {
    const basePersona = { /* minimal data */ };
    const richPersona = { /* 10 checkins, 3 audits */ };
    expect(calculateConfidenceScore(richPersona)).toBeGreaterThan(
      calculateConfidenceScore(basePersona)
    );
  });
});
```

**Integration Tests:**
```typescript
// setupFlow.test.ts
describe('SetupFlowScreen', () => {
  test('completes full flow and saves persona', async () => {
    const { getByText, getByTestId } = render(<SetupFlowScreen />);

    // Step 1: Budget
    fireEvent.changeText(getByTestId('budget-input'), '100');
    fireEvent.press(getByText('Next'));

    // Step 2: Personality
    fireEvent.press(getByText('Quality curator'));
    fireEvent.press(getByText('Next'));

    // Step 3: Preferences
    fireEvent.press(getByText('Weekly'));
    fireEvent.press(getByText('Complete Setup'));

    // Verify persona saved
    await waitFor(() => {
      expect(mockCreatePersona).toHaveBeenCalled();
    });
  });
});
```

**E2E Tests:**
```typescript
// checkin.e2e.ts
describe('CheckIn Flow', () => {
  it('generates personalized questions based on persona', async () => {
    await login();
    await tap('CheckIn Tab');

    // Verify question is personalized (not generic)
    await expect(element(by.id('checkin-question'))).toExist();
    const questionText = await element(by.id('checkin-question')).getText();
    expect(questionText).not.toBe('How do you feel about this subscription?'); // Generic
  });

  it('shows completion summary after all cards', async () => {
    await swipeAllCards();
    await expect(element(by.id('completion-summary'))).toBeVisible();
    await expect(element(by.text(/reviewed/i))).toExist();
  });
});
```

## Documentation Requirements

1. **API Documentation**: Document all personaService functions (JSDoc)
2. **Prompt Library**: Comment each prompt in prompts.ts with expected inputs/outputs
3. **Personality Questions**: Document scoring logic in personalityQuestions.ts
4. **Privacy Policy**: Update app privacy policy to include behavioral tracking disclosure
5. **User Guide**: In-app tooltip explaining how persona improves experience

## Future Considerations

**Phase 3 (Future Enhancements):**
- MBTI-style personality quiz as engagement feature (for fun, not logic)
- Social comparison: "Users like you typically spend..."
- Persona sharing: "Share your subscription personality"
- ML model training: Predict cancellation risk from persona + behavior
- Voice of customer: "Other explorers recommend..."

**Technical Debt to Address:**
- React Native version inconsistency (0.81.5 vs 0.76.x in docs)
- Reanimated 4.x compatibility (requires Development Build)
- Incremental persona updates (currently full replace)

## References

### Internal
- `/app/src/types/index.ts` - Current type definitions
- `/app/src/utils/claude.ts` - Existing Claude API integration
- `/app/src/screens/CheckInScreen.tsx` - Original swipe pattern (reference)
- `/app/supabase-schema.sql` - Database schema
- `/Docs/PRD.md` - Product requirements

### External Research
- Big Five Personality Traits: https://formalpsychology.com/big-five-personality-traits-beyond-mbti/
- Bias in AI Personas: https://www.frontiersin.org/journals/psychology/articles/10.3389/fpsyg.2025.1657227/full
- Privacy-Preserving Personalization: https://www.mdpi.com/2076-3417/16/2/848
- LLM Persona Prompting: https://learnprompting.org/docs/advanced/zero_shot/role_prompting
- Netflix Personalization: https://www.shaped.ai/blog/key-insights-from-the-netflix-personalization-search-recommendation-workshop-2025

---

## Verification

**End-to-End Test Scenario:**

1. **New User Signup**:
   - User signs up with email/password
   - Sees SetupFlowScreen with 3-5 personality questions
   - Answers questions (or skips) in < 3 minutes
   - Persona created in database with initial Big Five traits

2. **First CheckIn**:
   - User navigates to CheckIn tab
   - Sees subscription cards with correct icons
   - Swipes through cards (left/right/down)
   - Questions generated by Claude based on persona
   - Completes all cards, sees personalized summary
   - Behavioral signals tracked and stored

3. **First Audit**:
   - User navigates to Audit tab
   - Starts audit for "Netflix"
   - Prompts loaded from config file (not hardcoded)
   - Responses arrive in < 3 seconds
   - Text split into multiple bubbles if long
   - Final report shows radar chart with dimensions
   - Button emphasis matches score (Good = "Track It!" larger)
   - User taps "Track It!" - subscription added

4. **Monthly Report**:
   - User navigates to Report tab
   - Sees health score with circular progress
   - Taps "Monthly Spending" - detail modal opens with subscriptions
   - Taps "AI Audits" - sees history of past audits
   - Sees personalized insights based on persona
   - Taps Share button - share sheet opens

5. **Persona Evolution**:
   - After 2 weeks of use (multiple CheckIns + Audits)
   - Persona confidence score increases from 0.3 to 0.7+
   - Next CheckIn questions feel more personalized
   - Report insights reference user's specific patterns

**Success Criteria:**
- ✅ All features functional without errors
- ✅ Persona data persists across app restarts
- ✅ AI interactions feel personalized (not generic)
- ✅ Performance acceptable (< 3s for API calls)
- ✅ Privacy controls accessible and transparent

---

**Ready to implement?** This plan addresses all user feedback while building a sophisticated persona system that powers true personalization across the app.