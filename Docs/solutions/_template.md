# [Problem Title]: [Brief Description]

## Metadata

```yaml
category: [integration-issues|architecture-issues|ui-patterns|performance-issues|database-issues|security-issues]
module: [affected-modules]
tags: [keyword1, keyword2, keyword3]
symptoms:
  - "Observable symptom 1"
  - "Observable symptom 2"
  - "Error message if applicable"
difficulty: [beginner|intermediate|advanced]
date_documented: YYYY-MM-DD
related_files:
  - path/to/file1.ts
  - path/to/file2.tsx
related_systems:
  - system-name-1
  - system-name-2
```

## Problem

### Symptoms

Describe what the user observed, error messages, unexpected behavior.

### Observable Behavior

```typescript
// Example of the problem
// Show actual code or logs that demonstrate the issue
```

### Why This Happens

Explain the root cause. What fundamental misunderstanding or architectural issue led to this?

## Root Cause

Deeper technical explanation of why the problem exists.

**Key Insight**: [One-sentence summary of the core issue]

## Solution

### Pattern: [Solution Name]

Describe the solution approach.

```typescript
// ✅ GOOD: Corrected implementation
const solution = () => {
  // Show the fix with clear comments
};
```

### Key Principles

1. **Principle 1**: Explanation
2. **Principle 2**: Explanation

### Files Modified

**File1.tsx** (Lines X-Y):
```typescript
// Show specific changes made
```

**File2.ts** (Lines A-B):
```typescript
// Show specific changes made
```

## Verification

### Test Cases

```typescript
test('Solution solves the problem', () => {
  // Show how to verify the fix works
  expect(result).toBe(expected);
});

test('Solution prevents regression', () => {
  // Show how to ensure problem won't return
});
```

### Manual Testing

- [ ] Step 1 to verify
- [ ] Step 2 to verify
- [ ] Step 3 to verify

## Prevention

### Best Practices

1. **Practice 1**: How to avoid this in future
2. **Practice 2**: Design principle to follow

### Testing Checklist

- [ ] Test scenario 1
- [ ] Test scenario 2
- [ ] Edge case 1

### Code Review Checklist

When reviewing similar code:
- [ ] Check for pattern X
- [ ] Verify constraint Y
- [ ] Ensure principle Z

## Alternative Implementations

### Option 1: [Alternative Name]

**Pros**:
- ✅ Advantage 1
- ✅ Advantage 2

**Cons**:
- ⚠️ Limitation 1
- ⚠️ Limitation 2

### Option 2: [Another Alternative]

**Pros**:
- ✅ Advantage 1

**Cons**:
- ⚠️ Limitation 1

### Recommendation

For [use case], use [solution]. For [other use case], consider [alternative].

## Trade-offs

### This Solution

**Pros**:
- ✅ Benefit 1
- ✅ Benefit 2

**Cons**:
- ⚠️ Cost 1
- ⚠️ Cost 2

### Performance Considerations

- Memory impact: [description]
- CPU impact: [description]
- Network impact: [description]

## Related Issues

- [Issue/PR #123] - Similar problem in different context
- [Documentation section] - Related architectural decision

## Technology Context

- **Framework**: React Native / Next.js / Rails / etc
- **Database**: PostgreSQL / Supabase / etc
- **Language**: TypeScript 5.x / Ruby 3.x / etc
- **Dependencies**: List relevant packages with versions

## Additional Notes

Any other context, gotchas, or future considerations.

## Key Takeaway

**One-sentence summary**: [The most important lesson from solving this problem]

**Impact**: [How this solution improves the codebase or development process]

---

**END OF SOLUTION DOCUMENT**
