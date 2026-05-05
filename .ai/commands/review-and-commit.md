---
description: Review code changes and create commit following cyber-wiki standards
---

# Review & Commit Workflow

## Overview

This workflow reviews changed code for quality, security, and compliance, then creates a commit if all checks pass.

**Detailed review criteria are defined in:**

- `.ai/rules/cyberwiki-front.md` - Frontend architecture rules (FrontX)
- `docs/specs/` - Project specifications

## Phase 0: Automatic File Detection & Analysis

// turbo
The agent automatically detects all changed files and begins review immediately:

```bash
git status && git diff --name-only && git diff --stat
```

**Automatic Agent Actions (No User Input Required):**

1. **Detect all changed files** - Identify .ts, .tsx, .css, and other modified files
2. **Read full content** - Load complete content of each changed file
3. **Determine file types** - Categorize by extension and purpose
4. **Apply matching rules** - Automatically select applicable rules:
   - `.tsx` files → TypeScript rules + React component rules + FrontX architecture rules
   - `.ts` files → TypeScript rules + type safety rules
   - API services → Must extend `BaseApiService`, use `RestEndpointProtocol`
   - Events/Actions/Effects → Must follow Flux pattern (Action → Event → Effect → Slice)
   - Pages → Must be in `src/app/pages/`
   - Host components → Must be in `src/app/components/`
   - MFE files → Must be in `src/mfe_packages/<name>/` with relative-only imports
   - `generated-mfe-manifests.ts` → Must NOT be hand-edited; verify via `npm run generate:mfe-manifests`
   - All files → Import path rules, no `any`/`unknown`, no `eslint-disable`
5. **Scan all files** - Check each file against all applicable rules
6. **Collect findings** - Document all critical, high, and medium priority issues
7. **Begin Phase 1** - Automatically proceed to comprehensive code review

## Phase 1: Code Review of Changes

// turbo
Agent performs comprehensive code review by applying rules to each file:

### Automatic Rule Application

For each changed file, the agent:

1. **Reads the full file content**
2. **Identifies file type and purpose**
3. **Applies matching rule sets** from `cyberwiki-front.md` rules
4. **Checks for violations** against:
   - **File placement** - Host code in `src/app/`; MFE code in `src/mfe_packages/<name>/`. Enrichment domain code must NOT be added back to `src/app/` (lives in `enrichments-mfe`)
   - **Import paths** - Host: `@/` alias for cross-branch, relative for siblings. **MFE: relative only** (no `@/` alias, no imports from `src/app/` or other MFEs). Cross-package: `@cyberfabric/*`
   - **Flux architecture** - Actions emit events via `eventBus.emit()`, effects listen with `eventBus.on()`, no direct dispatch from components. MFE host-proxy actions (`hostActions.ts`) emit host-owned events
   - **Host ↔ MFE boundary** - Communication is ONLY via shared `eventBus`. No direct imports across the boundary
   - **Type safety** - `type` for objects/unions, `interface` for React props, no `any`/`unknown`, no `as unknown as` casts
   - **API services** - Extend `BaseApiService`, use `RestEndpointProtocol`, `withCredentials: true`. MFE API services registered in MFE `init.ts`, NOT in host `initApp.ts`
   - **MFE bootstrap** - `init.ts` follows: register → initialize → createHAI3 → registerSlice. `lifecycle.tsx` extends `ThemeAwareReactLifecycle`
   - **No telemetry** - No tracking code
   - **No prop drilling** - Use events for state flow
   - **Lodash** - Use lodash equivalents where available
   - **Commit size** - Maximum 4000 LOC per commit

5. **Categorizes findings**:
   - 🚨 **Critical Issues** - Must fix before commit (wrong file placement, broken Flux pattern, type errors)
   - ⚠️ **High Priority Issues** - Should fix before commit (import path violations, missing types)
   - 💡 **Medium Priority Issues** - Nice to fix (code style, minor improvements)

### Agent Review Output

The agent provides:

```markdown
## Automatic Code Review Results

### File: [filename]
**Type:** [.ts/.tsx]
**Rules Applied:** [list of applicable rules]

#### Critical Issues Found: [count]
[Detailed findings with line numbers and fix suggestions]

#### High Priority Issues Found: [count]
[Detailed findings with line numbers and fix suggestions]

#### Medium Priority Issues Found: [count]
[Detailed findings with line numbers and fix suggestions]

#### Positive Findings
[Well-written code, good patterns, etc.]
```

**Action:**

- ✅ If no critical/high priority issues: Proceed to Phase 1.1
- ❌ If issues found: Agent suggests fixes, user implements, re-run workflow

### Step 2: Validate Code Quality

// turbo
Run automated checks:

```bash
npm run lint \
  && npm run lint:check-disables \
  && npm run type-check \
  && npm run test \
  && npm run arch:check
```

**Required Checks:**

- [ ] ESLint passes (no linting errors)
- [ ] ESLint disable guard passes (zero `eslint-disable` directives)
- [ ] TypeScript compiles (no type errors)
- [ ] Tests pass
- [ ] Architecture checks pass
- [ ] No console.log or debugger statements in production code
- [ ] No hardcoded secrets or credentials

**Action:**

- ✅ If all checks pass: Proceed to Step 3
- ❌ If checks fail: Fix issues and re-run

### Step 3: Validate Commit Size

// turbo
Check total lines of code:

```bash
git diff --stat | tail -1
```

**Rules:**

- Maximum: **4000 LOC** per commit
- Count: additions + deletions

**Action:**

- ✅ If ≤ 4000 LOC: Proceed to Phase 1.1
- ❌ If > 4000 LOC: Split into smaller commits

## Phase 1.1: FrontX Architecture Verification

// turbo
Verify that changes comply with FrontX architecture:

### Pre-Diff Checklist (General)

- [ ] Import paths follow import rules (host: `@/`; MFE: relative only)
- [ ] Event-driven architecture (actions emit → effects handle)
- [ ] No `eslint-disable` comments
- [ ] No `any` or `unknown` in type definitions
- [ ] No barrel exports unless aggregating 3+ exports

### Pre-Diff Checklist (Host)

- [ ] Pages/features created under `src/app/`
- [ ] Host API types defined in `src/app/api/wikiTypes.ts`
- [ ] Enrichment code NOT added back to `src/app/` (lives in `enrichments-mfe`)
- [ ] `generated-mfe-manifests.ts` is NOT hand-edited

### Pre-Diff Checklist (MFE)

- [ ] MFE files are ONLY in `src/mfe_packages/<name>/`
- [ ] No `@/` alias imports inside MFE — all relative
- [ ] No imports from `src/app/` or from another MFE
- [ ] MFE-local types in `src/api/types.ts` (not host `wikiTypes.ts`)
- [ ] `init.ts` follows bootstrap pattern: register → initialize → createHAI3 → registerSlice
- [ ] `lifecycle.tsx` extends ThemeAwareReactLifecycle with constructor(mfeApp) and renderContent(bridge)
- [ ] Host-proxy events declared in MFE `events/` for type safety
- [ ] `mfe.json` present; `npm run generate:mfe-manifests` re-run after changes

**Verify file placement:**

```bash
git diff --name-only | grep -E "^src/" | head -30
```

**Check that:**

- New pages are in `src/app/pages/`
- New host components are in `src/app/components/`
- New host API services are in `src/app/api/`
- New host actions are in `src/app/actions/`
- New host effects are in `src/app/effects/`
- New host events are in `src/app/events/`
- MFE files are ONLY in `src/mfe_packages/<name>/`
- No enrichment domain code added to `src/app/` (it belongs in `enrichments-mfe`)

**If MFE files changed, verify manifest is up to date:**

```bash
npm run generate:mfe-manifests && git diff --name-only src/app/mfe/generated-mfe-manifests.ts
```

If the generated file has uncommitted changes, stage it.

## Phase 2: Prepare Commit Message

Create a proper commit message following standards:

**Format:**

```text
[TYPE] Brief description (50 chars max)

Detailed explanation (optional)
- Bullet point 1
- Bullet point 2
```

**Commit Types:** feat, fix, refactor, test, docs, style, chore, perf

**Examples:**

```text
[feat] Add SpaceConfigurationPage with CRUD table

Implements admin view for managing spaces.
- Add SpaceConfigurationPage with search, edit, delete
- Add EditSpaceModal with fork configuration
- Update App.tsx routing and Menu navigation
```

```text
[fix] Fix favorite toggle on DashboardPage

Correct eventBus subscription cleanup in useEffect.
- Use unsubscribe() from eventBus.on() return value
- Remove incorrect eventBus.off() calls
```

**Validation:**

- [ ] Starts with `[TYPE]`
- [ ] Description is clear and concise
- [ ] Body lists significant changes

## Phase 3: Stage Changes

// turbo
Stage all reviewed and approved changes:

```bash
git add [files]
```

**Verify:**

```bash
git status && git diff --cached --stat
```

- [ ] All intended files are staged
- [ ] No accidental files included
- [ ] Changes are logically grouped
- [ ] No `node_modules/` or generated files staged

## Phase 4: Create Commit

### Decision Point: All Checks Passed?

**If YES (All checks passed):**

- ✅ Code review complete with no critical/high priority issues
- ✅ Linting and type checking pass
- ✅ ESLint disable guard passes
- ✅ Tests pass
- ✅ FrontX architecture checks pass
- ✅ MFE manifest up to date (if MFE files changed)
- ✅ Commit size ≤ 4000 LOC
- ✅ Commit message prepared

**Then:** Proceed to automatic commit creation

**If NO (Issues found):**

- ❌ Critical or high priority issues detected
- ❌ Linting or type errors
- ❌ ESLint disable directives found
- ❌ Tests fail
- ❌ Architecture violations
- ❌ MFE manifest out of date
- ❌ Commit size exceeds limit

**Then:** Fix issues and re-run review

### Create Commit

// turbo
Create the commit:

```bash
git commit -m "[TYPE] Description"
```

**Critical Rules:**

- ⛔ **NEVER use `--no-verify`** - Pre-commit hooks MUST run (if configured)
- ⛔ **NEVER use `-n` flag** - This also bypasses hooks
- ✅ Always let pre-commit hooks run

### Handle Hook Failures

If pre-commit hooks fail:

1. **Read the error message** - Understand what failed
2. **Fix the issues:**
   - ESLint errors: `npm run lint -- --fix`
   - TypeScript errors: Fix manually or use `npm run type-check`
3. **Stage fixed files:** `git add [fixed-files]`
4. **Retry commit:** `git commit -m "[TYPE] Description"`

### Verify Commit Created

// turbo
Verify the commit was created correctly:

```bash
git log --oneline -n 1 && git show HEAD --stat
```

**Check:**

- [ ] Commit message is correct
- [ ] All intended changes are included
- [ ] No accidental files included
- [ ] Commit size is reasonable

## Review Summary Template

```markdown
## Commit Review Summary

### Commit Info
- **Hash:** [commit-hash]
- **Message:** [commit-message]
- **Size:** [X LOC]
- **Files Changed:** [count]

### Validation Results
- [ ] Commit size valid (≤ 4000 LOC)
- [ ] Pre-commit hooks passed
- [ ] No linting errors
- [ ] ESLint disable guard passes
- [ ] TypeScript compiles
- [ ] Tests pass
- [ ] FrontX architecture verified
- [ ] Commit message valid

### Critical Issues: [count]
[List or "None found ✅"]

### High Priority Issues: [count]
[List or "None found ✅"]

### Medium Priority Issues: [count]
[List or "None found ✅"]

### Positive Highlights
[Call out good practices, well-written code, etc.]

### Recommendation
- [ ] **Approve** - Ready to merge
- [ ] **Approve with suggestions** - Can merge after addressing low/medium issues
- [ ] **Request changes** - Must address issues before merge
```

## Common Issues & Fixes

### Wrong File Placement (Host)

**Problem:** Page or host component created in `src/mfe_packages/` instead of `src/app/`

Move the file to the correct location under `src/app/` and update imports.

### Wrong File Placement (MFE)

**Problem:** MFE code placed in `src/app/` or uses `@/` alias imports

MFE code must live in `src/mfe_packages/<name>/` and use only relative imports. Move the file and fix all imports to be relative.

### Direct Dispatch from Component

**Problem:** Component dispatches to Redux slice directly

```tsx
// ❌ Wrong
dispatch(setSpaces(data));

// ✅ Correct — use action → event → effect flow
import { loadSpaces } from '@/app/actions/wikiActions';
loadSpaces();
```

### Import Path Violations (Host)

**Problem:** Wrong import path style in host code

```tsx
// ❌ Wrong — relative path across branches
import { Space } from '../../api/wikiTypes';

// ✅ Correct — use @/ alias
import { Space } from '@/app/api';
```

### Import Path Violations (MFE)

**Problem:** MFE code imports from host or uses `@/` alias

```tsx
// ❌ Wrong — @/ alias inside MFE
import { CommentData } from '@/app/api';

// ❌ Wrong — cross-boundary import
import { CommentData } from '../../../../app/api/wikiTypes';

// ✅ Correct — MFE-local relative import
import type { CommentData } from '../../api/types';
```

### eventBus.off Does Not Exist

**Problem:** Trying to unsubscribe with `eventBus.off()`

```tsx
// ❌ Wrong — EventBus has no .off() method
eventBus.off('wiki/space/created', handler);

// ✅ Correct — use unsubscribe from .on() return value
const sub = eventBus.on('wiki/space/created', handler);
sub.unsubscribe();
```

### Commit Size Exceeds Limit

**Problem:** Commit is > 4000 LOC

```bash
# Reset commit but keep changes
git reset --soft HEAD~1
# Split into smaller commits
git add [subset-of-files]
git commit -m "[TYPE] Part 1: Description"
git add [remaining-files]
git commit -m "[TYPE] Part 2: Description"
```

### Wrong Commit Message

**Problem:** Typo in commit message

```bash
git commit --amend -m "[TYPE] Corrected description"
```

## Key Rules Summary

1. ⛔ **NEVER `--no-verify`** - Pre-commit hooks MUST run
2. 📏 **Max 4000 LOC** - Break large changes into smaller commits
3. 📝 **Clear messages** - Use `[TYPE] Description` format
4. 🔍 **No secrets** - Check for hardcoded credentials
5. 📁 **File placement** - Host in `src/app/`; MFE in `src/mfe_packages/<name>/`; enrichment domain in `enrichments-mfe`
6. 🔗 **Import paths** - Host: `@/` for cross-branch; MFE: relative only, no `@/` alias
7. 📦 **MFE manifest** - Regenerate via `npm run generate:mfe-manifests` after MFE changes
8. 🚫 **Host ↔ MFE boundary** - Communication only via `eventBus`; no direct imports
9. 🚫 **No `any`** - Use proper types
10. 🚫 **No `eslint-disable`** - Fix the underlying issue
11. 🚫 **No prop drilling** - Use event-driven state flow
12. 📦 **lodash over native** - Use lodash equivalents where available

## Useful Commands

```bash
# View commit details
git show HEAD
git log -1 --format=%B

# Check LOC
git diff HEAD~1 HEAD --stat

# View changes
git diff HEAD~1 HEAD
git diff HEAD~1 HEAD -- [file]

# Amend commit
git commit --amend --no-edit
git commit --amend -m "New message"

# Reset commit
git reset --soft HEAD~1

# Lint
npm run lint
npm run lint -- --fix

# Type check
npm run type-check

# Architecture check
npm run arch:check

# MFE manifest regeneration (after adding/removing/changing MFE packages)
npm run generate:mfe-manifests
```

## References

- **Frontend Rules:** `.ai/rules/cyberwiki-front.md`
- **Host API Types:** `src/app/api/wikiTypes.ts`
- **MFE API Types:** `src/mfe_packages/<name>/src/api/types.ts`
- **Architecture:** Event-driven Flux (FrontX/HAI3)
- **MFE Manifest Generator:** `scripts/generate-mfe-manifests.ts`
- **MFE Bootstrap Pattern:** See `MFE RULES` section in `.ai/rules/cyberwiki-front.md`
