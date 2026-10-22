# Solutions Directory - Compound Knowledge Base

## Purpose

This directory contains **searchable institutional knowledge** from solved problems. Each solution document captures:
- What went wrong
- Why it happened
- How we fixed it
- How to prevent it in the future

**Philosophy**: The first time you solve a problem takes 30 minutes of research. Document it, and the next time takes 2 minutes of lookup. **Knowledge compounds.**

---

## Document Structure

All solution documents follow this structure:

### 1. YAML Frontmatter (Searchable Metadata)
```yaml
category: [issue-type]
module: [affected-code]
tags: [searchable, keywords]
symptoms: ["Observable error messages"]
difficulty: [beginner|intermediate|advanced]
date_documented: YYYY-MM-DD
```

### 2. Problem Description
- Symptoms users observed
- Error messages or unexpected behavior
- Why it happens (root cause)

### 3. Solution
- Step-by-step fix
- Code examples (before/after)
- Files modified

### 4. Verification
- Test cases to verify fix
- Manual testing steps

### 5. Prevention
- Best practices to avoid recurrence
- Code review checklist
- Testing guidelines

### 6. Related Documentation
- Links to other solutions
- Cross-references to design docs

---

## Categories

Solutions are organized by problem type:

- **`integration-issues/`** - API integration, data sync, third-party services
- **`architecture-issues/`** - Design patterns, system structure, bounded-weight systems
- **`ui-patterns/`** - React Native UI, navigation, forms, animations
- **`performance-issues/`** - Slow queries, memory leaks, optimization
- **`database-issues/`** - Schema, migrations, RLS policies
- **`security-issues/`** - Authentication, authorization, data protection
- **`runtime-errors/`** - Crashes, exceptions, error handling
- **`build-errors/`** - Compilation issues, dependency conflicts

---

## Current Solutions

### React Native + Supabase Integration
- **`react-native-supabase-data-sync-pattern.md`** - Fresh data vs cached AuthContext
  - Tags: `react-native`, `supabase`, `caching`, `state-management`
  - Lesson: Separate authentication state from profile data

### UI Patterns
- **`avatar-pagination-system-design.md`** - Paginated visual selection UI
  - Tags: `react-native`, `pagination`, `ui-ux`, `dicebear`
  - Lesson: 12 items per page is optimal for mobile

- **`multi-step-setup-flow-pattern.md`** - Multi-step onboarding forms
  - Tags: `react-native`, `multi-step-form`, `state-machine`
  - Lesson: Single-screen state machine with negative indices

### Architecture & Algorithms
- **`stable-judgement-system-critical-fixes.md`** - Bounded-weight scoring bugs
  - Tags: `bounded-weight`, `double-counting`, `half-life-decay`, `confidence-gating`
  - Lesson: Four critical bugs in scoring system and their fixes

---

## How to Create New Solutions

### When to Document

Document a problem when:
- ✅ Solution is non-trivial (took >15 minutes to solve)
- ✅ Problem might recur in similar contexts
- ✅ Solution involves reusable patterns
- ✅ Mistake could be common across team

**Don't document**:
- ❌ Simple typos or obvious errors
- ❌ One-off issues unlikely to recur
- ❌ Problems already documented elsewhere

### Step 1: Copy Template

```bash
cp Docs/solutions/_template.md Docs/solutions/your-problem-name.md
```

### Step 2: Fill in Metadata

Choose appropriate:
- Category (integration-issues, architecture-issues, etc.)
- Tags (keywords for searching)
- Symptoms (exact error messages users would search for)
- Difficulty level

### Step 3: Document Problem

Focus on:
- **Observable symptoms** (what user sees)
- **Root cause** (technical explanation)
- **Why it's not obvious** (if it was obvious, no need to document)

### Step 4: Show Solution

Include:
- Before/after code examples
- Step-by-step instructions
- Files modified with line numbers

### Step 5: Add Prevention

Most important section!
- How to avoid in future
- Testing checklist
- Code review guidelines

### Step 6: Cross-Reference

Link to:
- Related solution documents
- Design docs or specs
- GitHub issues/PRs

---

## Searching Solutions

### By Symptom (Error Message)

```bash
# Search for error text
grep -r "column users.avatar does not exist" Docs/solutions/

# Search in YAML frontmatter
grep -A 5 "symptoms:" Docs/solutions/*.md | grep "your error"
```

### By Tag

```bash
# Find all React Native patterns
grep "tags:.*react-native" Docs/solutions/*.md

# Find all caching issues
grep "tags:.*caching" Docs/solutions/*.md
```

### By Category

```bash
# List all architecture issues
ls Docs/solutions/ | grep architecture

# Or check category in frontmatter
grep "category: architecture-issues" Docs/solutions/*.md
```

### Full-Text Search

```bash
# Search all solutions for keyword
grep -r "bounded-weight" Docs/solutions/

# Search with context (3 lines before/after)
grep -C 3 -r "half-life" Docs/solutions/
```

---

## Maintenance

### Updating Existing Solutions

When a solution becomes outdated:
1. Add `⚠️ OUTDATED` tag at top
2. Link to updated solution
3. Explain what changed

**Don't delete old solutions** - they show evolution of thinking.

### Linking Related Solutions

When creating new solutions, always:
1. Search for related existing solutions
2. Add cross-references in "Related Documentation"
3. Update old solutions to reference new ones

### Periodic Review

Every quarter:
- Review all solutions for accuracy
- Update code examples if APIs changed
- Add new prevention strategies discovered
- Consolidate similar solutions

---

## Metrics (Compound Effect)

Track the value of this knowledge base:

### Time Saved Per Solution

| Solution | First Solve | Document | Future Lookup | Savings (3x use) |
|----------|-------------|----------|---------------|------------------|
| Data Sync Pattern | 30 min | 5 min | 2 min | 84 min saved |
| Avatar Pagination | 45 min | 10 min | 3 min | 116 min saved |
| Multi-Step Form | 60 min | 15 min | 5 min | 150 min saved |
| Judgment System | 120 min | 30 min | 10 min | 300 min saved |

**Total investment**: 60 minutes documentation
**Total return** (after 3 reuses each): 650 minutes saved
**ROI**: 10.8x

### Knowledge Multiplier

Each solution has a **knowledge multiplier**:
- Used by you again: 1x
- Used by teammate: 2x
- Used by new hire: 3x
- Prevents production bug: 10x

**Goal**: Every solution should be used at least 3 times to justify documentation effort.

---

## Philosophy: Compound Knowledge

Traditional engineering:
```
Problem 1 → Solve (30 min) → Forget
Problem 1 again → Solve (30 min) → Forget
Problem 1 third time → Solve (30 min) → Total: 90 min
```

Compound engineering:
```
Problem 1 → Solve (30 min) → Document (5 min) → Total: 35 min
Problem 1 again → Lookup (2 min) → Total: 37 min
Problem 1 third time → Lookup (2 min) → Total: 39 min
```

**Each documented solution makes the next problem easier.**

---

## Questions?

If you're unsure whether to document something:

**Ask yourself**:
1. "Will I remember this solution in 3 months?" (If no → document)
2. "Could a teammate encounter this?" (If yes → document)
3. "Did this take >15 minutes to solve?" (If yes → document)

**When in doubt, document.** 5 minutes now saves hours later.

---

**END OF README**
